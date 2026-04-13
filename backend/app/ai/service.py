"""Orchestration service for AI chat and AI recommendation flows."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app import crud, models
from app.ai import deterministic, history, parser, prompts
from app.ai.provider import AiProviderError, GroqProviderClient, ProviderMessage

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ChatResult:
    """Result payload for AI chat endpoint."""

    reply: str
    source: str
    fallback_used: bool
    warning: Optional[str]


@dataclass(frozen=True)
class RecommendationResult:
    """Result payload for AI recommendation endpoint."""

    items: list[models.ClothingItem]
    explanation: str
    outfit_score: float
    source: str
    fallback_used: bool
    warning: Optional[str]
    weather_category: str
    item_explanations: dict[int, str]
    suggestion_id: str
    outfit_options: list[deterministic.RecommendationCandidate]


@dataclass(frozen=True)
class RecommendationContext:
    """Normalized request context for AI recommendation orchestration."""

    manual_temp: Optional[int]
    weather_category: Optional[str]
    occasion: Optional[str]
    time_context: Optional[str]
    exclude: Optional[str]
    style_preference: Optional[str]
    preferred_seasons: list[str]
    request_id: str


@dataclass(frozen=True)
class ChatFallbackContext:
    """Derived context used to keep fallback chat replies conversational."""

    latest_user_text: str
    previous_user_text: str
    latest_intent: str
    last_style_intent: str
    style_seed: str
    context_label: str
    variation_seed: int


class AiService:
    """Coordinates provider calls, deterministic fallback, and repeat-prevention storage."""

    def __init__(self, provider_client: Optional[GroqProviderClient] = None) -> None:
        self.provider_client = provider_client or GroqProviderClient()

    def run_chat(
        self,
        *,
        user: Optional[models.User],
        wardrobe_items: list[models.ClothingItem],
        messages: list[ProviderMessage],
        request_id: str,
    ) -> ChatResult:
        if not self.provider_client.is_available:
            return ChatResult(
                reply=self._build_chat_fallback_reply(wardrobe_items, messages),
                source="fallback",
                fallback_used=True,
                warning="provider_not_configured",
            )

        system_prompt = prompts.build_chat_system_prompt(user=user, wardrobe_items=wardrobe_items)
        try:
            reply = self.provider_client.chat(
                [ProviderMessage(role="system", content=system_prompt)] + messages
            )
            return ChatResult(
                reply=reply.strip(),
                source="ai",
                fallback_used=False,
                warning=None,
            )
        except AiProviderError as exc:
            logger.warning(
                "request_id=%s ai_chat_provider_error code=%s retryable=%s",
                request_id,
                exc.code,
                exc.retryable,
            )
            return ChatResult(
                reply=self._build_chat_fallback_reply(wardrobe_items, messages),
                source="fallback",
                fallback_used=True,
                warning=exc.code,
            )

    def run_recommendation(
        self,
        *,
        db: Session,
        user: models.User,
        context: RecommendationContext,
    ) -> RecommendationResult:
        all_items = crud.get_clothing_items_for_user(db, user.id, include_archived=False)
        recent_fingerprints = history.get_recent_fingerprints(db, user.id)
        recent_fingerprint_set = set(recent_fingerprints)
        item_map = {item.id: item for item in all_items}
        effective_preferred_seasons = crud.resolve_preferred_seasons(context.preferred_seasons)
        feedback_signals = crud.get_recommendation_feedback_signals_for_user(db, user.id)

        deterministic_options = deterministic.recommend_many(
            items=all_items,
            user=user,
            manual_temp=context.manual_temp,
            weather_category=context.weather_category,
            occasion=context.occasion,
            time_context=context.time_context,
            exclude=context.exclude,
            style_preference=context.style_preference,
            preferred_seasons=effective_preferred_seasons,
            recent_fingerprints=recent_fingerprints,
            max_options=5,
        )
        deterministic_options = crud.filter_rejected_candidates_for_user(
            db=db,
            user_id=user.id,
            candidates=deterministic_options,
            item_map=item_map,
        )
        if not deterministic_options:
            deterministic_options = deterministic.recommend_many(
                items=all_items,
                user=user,
                manual_temp=context.manual_temp,
                weather_category=context.weather_category,
                occasion=context.occasion,
                time_context=context.time_context,
                exclude=context.exclude,
                style_preference=context.style_preference,
                preferred_seasons=effective_preferred_seasons,
                recent_fingerprints=recent_fingerprints,
                max_options=1,
            )
        deterministic_options = crud.rank_candidates_with_feedback(deterministic_options, feedback_signals)
        deterministic_options = crud._select_diverse_candidates(
            deterministic_options,
            item_map=item_map,
            limit=5,
        )
        deterministic_pick = deterministic_options[0]

        deterministic_items = [item_map[item_id] for item_id in deterministic_pick.item_ids if item_id in item_map]
        if not deterministic_items:
            return RecommendationResult(
                items=[],
                explanation=deterministic_pick.explanation,
                outfit_score=0.0,
                source="fallback",
                fallback_used=True,
                warning="insufficient_wardrobe_data",
                weather_category=deterministic_pick.weather_category,
                item_explanations={},
                suggestion_id=deterministic_pick.fingerprint,
                outfit_options=deterministic_options,
            )

        if not self.provider_client.is_available:
            history.save_fingerprint(db, user.id, deterministic_pick.fingerprint)
            return RecommendationResult(
                items=deterministic_items,
                explanation=deterministic_pick.explanation,
                outfit_score=deterministic_pick.score,
                source="fallback",
                fallback_used=True,
                warning="provider_not_configured",
                weather_category=deterministic_pick.weather_category,
                item_explanations=deterministic_pick.item_explanations,
                suggestion_id=deterministic_pick.fingerprint,
                outfit_options=deterministic_options,
            )

        prompt = prompts.build_recommendation_prompt(
            user=user,
            wardrobe_items=all_items,
            weather_category=deterministic_pick.weather_category,
            occasion=context.occasion,
            time_context=context.time_context,
            exclude=context.exclude,
            style_preference=context.style_preference,
            preferred_seasons=effective_preferred_seasons,
        )
        provider_messages = [
            ProviderMessage(
                role="system",
                content="Return only valid JSON. Do not include markdown fences.",
            ),
            ProviderMessage(role="user", content=prompt),
        ]

        try:
            raw_response = self.provider_client.chat(provider_messages)
            parsed = parser.parse_recommendation_payload(raw_response, set(item_map.keys()))
            ai_items = [item_map[item_id] for item_id in parsed.item_ids if item_id in item_map]
            if len(ai_items) < 2:
                raise ValueError("AI recommendation returned too few valid items")

            ai_fingerprint = ",".join(str(item.id) for item in sorted(ai_items, key=lambda item: item.id))
            if ai_fingerprint in recent_fingerprint_set:
                logger.info(
                    "request_id=%s ai_recommendation_repeat_detected fingerprint=%s",
                    context.request_id,
                    ai_fingerprint,
                )
                history.save_fingerprint(db, user.id, deterministic_pick.fingerprint)
                return RecommendationResult(
                    items=deterministic_items,
                    explanation=deterministic_pick.explanation,
                    outfit_score=deterministic_pick.score,
                    source="fallback",
                    fallback_used=True,
                    warning="repeat_prevention_applied",
                    weather_category=deterministic_pick.weather_category,
                    item_explanations=deterministic_pick.item_explanations,
                    suggestion_id=deterministic_pick.fingerprint,
                    outfit_options=deterministic_options,
                )
            if crud.is_rejected_outfit(
                db,
                user_id=user.id,
                items=ai_items,
                fingerprint=ai_fingerprint,
            ):
                logger.info(
                    "request_id=%s ai_recommendation_rejected_filtered fingerprint=%s",
                    context.request_id,
                    ai_fingerprint,
                )
                history.save_fingerprint(db, user.id, deterministic_pick.fingerprint)
                return RecommendationResult(
                    items=deterministic_items,
                    explanation=deterministic_pick.explanation,
                    outfit_score=deterministic_pick.score,
                    source="fallback",
                    fallback_used=True,
                    warning="rejected_outfit_filtered",
                    weather_category=deterministic_pick.weather_category,
                    item_explanations=deterministic_pick.item_explanations,
                    suggestion_id=deterministic_pick.fingerprint,
                    outfit_options=deterministic_options,
                )

            ai_feedback_signal = feedback_signals.get(ai_fingerprint)
            if ai_feedback_signal in {"dislike", "reject"}:
                logger.info(
                    "request_id=%s ai_recommendation_feedback_filter fingerprint=%s signal=%s",
                    context.request_id,
                    ai_fingerprint,
                    ai_feedback_signal,
                )
                history.save_fingerprint(db, user.id, deterministic_pick.fingerprint)
                return RecommendationResult(
                    items=deterministic_items,
                    explanation=deterministic_pick.explanation,
                    outfit_score=deterministic_pick.score,
                    source="fallback",
                    fallback_used=True,
                    warning="feedback_filter_applied",
                    weather_category=deterministic_pick.weather_category,
                    item_explanations=deterministic_pick.item_explanations,
                    suggestion_id=deterministic_pick.fingerprint,
                    outfit_options=deterministic_options,
                )

            history.save_fingerprint(db, user.id, ai_fingerprint)
            item_explanations = {
                item_id: explanation
                for item_id, explanation in parsed.item_explanations.items()
                if item_id in {item.id for item in ai_items}
            }
            ai_candidate = deterministic.score_existing_combo(
                combo=ai_items,
                user=user,
                weather_category=deterministic_pick.weather_category,
                occasion=context.occasion,
                time_context=context.time_context,
                style_preference=context.style_preference,
                preferred_seasons=effective_preferred_seasons,
            )
            combined_options: list[deterministic.RecommendationCandidate] = [ai_candidate]
            seen = {ai_candidate.fingerprint}
            for option in deterministic_options:
                if option.fingerprint in seen:
                    continue
                combined_options.append(option)
                seen.add(option.fingerprint)
            combined_options = crud._select_diverse_candidates(
                combined_options,
                item_map=item_map,
                limit=5,
            )
            return RecommendationResult(
                items=ai_items,
                explanation=_merge_recommendation_explanations(
                    ai_explanation=parsed.explanation,
                    deterministic_explanation=ai_candidate.explanation,
                    weather_category=deterministic_pick.weather_category,
                    occasion=context.occasion,
                    time_context=context.time_context,
                ),
                outfit_score=ai_candidate.score + crud.recommendation_feedback_delta(ai_feedback_signal),
                source="ai",
                fallback_used=False,
                warning=None,
                weather_category=deterministic_pick.weather_category,
                item_explanations=item_explanations,
                suggestion_id=ai_fingerprint,
                outfit_options=combined_options,
            )
        except (AiProviderError, ValueError) as exc:
            warning_code = exc.code if isinstance(exc, AiProviderError) else "provider_malformed_response"
            logger.warning(
                "request_id=%s ai_recommendation_fallback warning=%s",
                context.request_id,
                warning_code,
            )
            history.save_fingerprint(db, user.id, deterministic_pick.fingerprint)
            return RecommendationResult(
                items=deterministic_items,
                explanation=deterministic_pick.explanation,
                outfit_score=deterministic_pick.score,
                source="fallback",
                fallback_used=True,
                warning=warning_code,
                weather_category=deterministic_pick.weather_category,
                item_explanations=deterministic_pick.item_explanations,
                suggestion_id=deterministic_pick.fingerprint,
                outfit_options=deterministic_options,
            )

    @staticmethod
    def _build_chat_fallback_reply(
        wardrobe_items: list[models.ClothingItem],
        messages: list[ProviderMessage],
    ) -> str:
        latest_user_text = _latest_message_content(messages, role="user")
        previous_user_text = _previous_user_message_content(messages)
        context = _build_chat_fallback_context(
            latest_user_text=latest_user_text,
            previous_user_text=previous_user_text,
            messages=messages,
            wardrobe_items=wardrobe_items,
        )

        if context.latest_intent == "greeting":
            if wardrobe_items:
                return _pick_variant(
                    (
                        "Hi, I’m AURA. I can help you make this feel styled without overthinking it. A good place to start is the piece you already want to wear. Want me to build a quick outfit around it?",
                        "Hi, I’m AURA. Start with the piece you already feel like wearing and I’ll shape the rest around it. Want me to turn that into a quick outfit?",
                        "Hi. Keep this easy: pick the piece you already want on, and I can make the rest feel intentional. Want me to build around it?",
                    ),
                    context.variation_seed,
                )
            return (
                _pick_variant(
                    (
                        "Hi, I’m AURA. I can help you make outfit decisions faster and make them feel more pulled together. We can start with where you’re going, the vibe you want, or one piece you feel like wearing. Want me to build a quick outfit?",
                        "Hi, I’m AURA. We can keep this simple: tell me where you’re headed, the vibe, or one piece you want to wear, and I’ll shape it. Want a quick outfit?",
                        "Hi. I can help you get to an outfit faster. Give me the plan, the mood, or one item you want in the mix, and I’ll take it from there. Want me to build one now?",
                    ),
                    context.variation_seed,
                )
            )
        if not wardrobe_items:
            if _is_recommendation_intent(context.latest_intent):
                return _compose_chat_reply(
                    context=context,
                    suggestion=f"If you’re {context.context_label}, start with {context.style_seed}.",
                    question="Do you want to keep it casual, clean it up a bit, or build it around the weather?",
                    acknowledge=(
                        "Makes sense.",
                        "That gives me enough to start.",
                        "Honestly, I’d keep this simple.",
                    ),
                    opinion=(
                        "",
                        "No need to overdo it here.",
                        "A clean base is usually the right move.",
                    ),
                )
            if _has_style_context(context):
                return _compose_chat_reply(
                    context=context,
                    suggestion=f"Since you mentioned {context.context_label}, I’d lean {context.style_seed}. I don’t have your wardrobe yet, but I can still shape this.",
                    question="Want to give me the weather or one piece you want to wear?",
                    acknowledge=(
                        "That helps.",
                        "Alright, that gives me the shape of it.",
                        "Good, that points it in the right direction.",
                    ),
                    opinion=(
                        "",
                        "I wouldn’t make this too complicated.",
                        "Simple usually looks better here.",
                    ),
                )
            return _compose_chat_reply(
                context=context,
                suggestion="Start with something easy and wearable, then sharpen it once the plan is clearer.",
                question="Want me to keep it casual, make it cleaner, or just build a quick outfit?",
                acknowledge=(
                    "I can help with that.",
                    "Sure.",
                    "Alright.",
                ),
                opinion=(
                    "",
                    "I’d keep the first pass straightforward.",
                    "Better to keep this clean than overstyled.",
                ),
            )
        wardrobe_summary = prompts.summarize_wardrobe_for_chat(wardrobe_items)
        if _is_recommendation_intent(context.latest_intent):
            return _compose_chat_reply(
                context=context,
                suggestion=(
                    f"If you’re {context.context_label}, I’d start with {context.style_seed}. "
                    f"From your wardrobe, I’m seeing {wardrobe_summary.lower()}"
                ),
                question="Do you want me to keep it easy, make it cleaner, or pull one full outfit together?",
                acknowledge=(
                    "Makes sense.",
                    "Alright.",
                    "That’s easy to work with.",
                ),
                opinion=(
                    "",
                    "Honestly, this one is better kept clean.",
                    "You do not need to overthink this.",
                ),
            )
        if _has_style_context(context):
            return _compose_chat_reply(
                context=context,
                suggestion=(
                    f"Since you mentioned {context.context_label}, I’d lean {context.style_seed}. "
                    f"From your wardrobe, I’m seeing {wardrobe_summary.lower()}"
                ),
                question="Want me to refine it around the temperature or build it around one piece?",
                acknowledge=(
                    "That gives me enough to work with.",
                    "Good, that helps.",
                    "Alright, now we have direction.",
                ),
                opinion=(
                    "",
                    "I’d rather refine this than add more noise.",
                    "This should feel considered, not fussy.",
                ),
            )
        return _compose_chat_reply(
            context=context,
            suggestion=f"I can turn that into something more styled. From your wardrobe, I’m seeing {wardrobe_summary.lower()}",
            question="Want me to make it more casual, a little cleaner, or build a quick outfit now?",
            acknowledge=(
                "Sure.",
                "Alright.",
                "Makes sense.",
            ),
            opinion=(
                "",
                "I’d keep the direction clean.",
                "The best move here is usually the simpler one.",
            ),
        )


def _merge_recommendation_explanations(
    *,
    ai_explanation: str,
    deterministic_explanation: str,
    weather_category: Optional[str],
    occasion: Optional[str],
    time_context: Optional[str],
) -> str:
    cleaned_ai = (ai_explanation or "").strip()
    cleaned_deterministic = (deterministic_explanation or "").strip()
    if not cleaned_ai:
        return cleaned_deterministic
    if not cleaned_deterministic:
        return cleaned_ai
    if _explanation_mentions_context(
        cleaned_ai,
        weather_category=weather_category,
        occasion=occasion,
        time_context=time_context,
    ):
        return cleaned_ai
    if cleaned_deterministic.lower() in cleaned_ai.lower():
        return cleaned_ai
    return f"{cleaned_ai.rstrip('.')} {cleaned_deterministic}".strip()


def _explanation_mentions_context(
    explanation: str,
    *,
    weather_category: Optional[str],
    occasion: Optional[str],
    time_context: Optional[str],
) -> bool:
    normalized = explanation.strip().lower()
    if not normalized:
        return False
    mentions_color = "color" in normalized or "tone" in normalized or "contrast" in normalized
    mentions_weather = bool(weather_category and weather_category.lower() in normalized) or "weather" in normalized
    mentions_occasion = bool(occasion and occasion.lower() in normalized)
    mentions_time = bool(time_context and time_context.lower() in normalized)
    return mentions_color and mentions_weather and (mentions_occasion or mentions_time)


def _normalize_category(value: str) -> str:
    return value.strip().lower()


def _normalize_message(value: str) -> str:
    return value.strip().lower()


def _latest_message_content(messages: list[ProviderMessage], *, role: str) -> str:
    return next(
        (
            message.content.strip()
            for message in reversed(messages)
            if message.role == role and message.content.strip()
        ),
        "",
    )


def _previous_user_message_content(messages: list[ProviderMessage]) -> str:
    user_messages = [
        message.content.strip()
        for message in messages
        if message.role == "user" and message.content.strip()
    ]
    if len(user_messages) < 2:
        return ""
    return user_messages[-2]


def _looks_like_greeting(message: str) -> bool:
    normalized = _normalize_message(message).strip("!?. ,")
    if not normalized:
        return False
    greeting_tokens = {
        "hi",
        "hello",
        "hey",
        "yo",
        "hiya",
        "good morning",
        "good afternoon",
        "good evening",
    }
    return normalized in greeting_tokens


def _detect_chat_intent(message: str) -> str:
    normalized = _normalize_message(message)
    if not normalized:
        return "unknown"
    if _looks_like_greeting(normalized):
        return "greeting"

    vague_recommendation_phrases = {
        "what should i wear",
        "help me choose",
        "help me pick",
        "help me decide",
        "pick something",
        "choose something",
        "something casual",
        "not sure what to wear",
        "what do i wear",
    }
    if any(phrase in normalized for phrase in vague_recommendation_phrases):
        return "vague_recommendation"

    lifestyle_phrases = {
        "going outside",
        "go outside",
        "going out",
        "going somewhere",
        "headed out",
        "heading out",
        "hanging out",
        "hang out",
        "out and about",
        "just a walk",
        "for a walk",
        "taking a walk",
    }
    if any(phrase in normalized for phrase in lifestyle_phrases):
        return "lifestyle"

    if _looks_style_related(normalized):
        return "explicit_style"
    return "unknown"


def _looks_style_related(message: str) -> bool:
    normalized = _normalize_message(message)
    if not normalized:
        return False
    style_keywords = {
        "outfit",
        "wear",
        "style",
        "wardrobe",
        "closet",
        "jacket",
        "shirt",
        "shoe",
        "shoes",
        "jeans",
        "pants",
        "dress",
        "look",
        "color",
        "match",
        "matching",
        "weather",
        "temperature",
        "cold",
        "warm",
        "hot",
        "cool",
        "rain",
        "office",
        "work",
        "party",
        "date",
        "dinner",
        "event",
        "trip",
        "travel",
        "outside",
        "outside?",
        "outdoor",
        "outdoors",
        "outside today",
        "go outside",
        "going outside",
        "going out",
        "going somewhere",
        "step out",
        "walk",
        "walking",
        "park",
        "brunch",
        "coffee",
        "lunch",
        "hangout",
        "hang out",
        "hanging out",
        "casual",
        "pack",
        "packing",
        "laundry",
        "formal",
        "help",
        "vibe",
        "smart casual",
        "interview",
        "wedding",
        "cute",
        "stylish",
        "choose",
        "pick",
        "decide",
    }
    return any(keyword in normalized for keyword in style_keywords)


def _style_seed_from_text(message: str, wardrobe_items: list[models.ClothingItem]) -> str:
    normalized = _normalize_message(message)
    if any(
        token in normalized
        for token in {"outside", "going out", "go outside", "walk", "outdoor", "park", "coffee", "brunch"}
    ):
        return "an easy, weather-ready base with comfortable shoes"
    if any(token in normalized for token in {"dress up", "dressy", "formal", "elegant", "wedding", "date"}):
        return "a cleaner, more polished mix"
    if any(token in normalized for token in {"casual", "relaxed", "comfortable", "comfy", "weekend"}):
        return "a relaxed base with one piece that adds shape"
    if any(token in normalized for token in {"work", "office", "meeting", "interview"}):
        return "something sharp but still comfortable enough for the day"
    categories = {_normalize_category(item.category) for item in wardrobe_items if item.category}
    if "outerwear" in categories or "jacket" in categories:
        return "a clean base with an easy outer layer"
    return "a balanced top, bottom, and shoes"


def _last_style_intent(messages: list[ProviderMessage]) -> str:
    for message in reversed(messages):
        if message.role != "user" or not message.content.strip():
            continue
        intent = _detect_chat_intent(message.content)
        if _is_recommendation_intent(intent) or intent == "explicit_style":
            return intent
    return "unknown"


def _context_label_from_messages(latest_user_text: str, previous_user_text: str) -> str:
    combined = f"{previous_user_text} {latest_user_text}".strip().lower()
    if not combined:
        return "getting dressed"
    context_map = (
        ("walk", "heading outside for a walk"),
        ("coffee", "heading out for coffee"),
        ("brunch", "heading out for brunch"),
        ("errand", "running errands"),
        ("office", "getting dressed for work"),
        ("work", "getting dressed for work"),
        ("meeting", "getting dressed for work"),
        ("interview", "getting dressed for an interview"),
        ("date", "getting dressed for a date"),
        ("dinner", "going out for dinner"),
        ("party", "going out"),
        ("event", "going out"),
        ("formal", "getting dressed for something more formal"),
        ("casual", "keeping it casual"),
        ("outside", "heading outside"),
        ("going somewhere", "heading out"),
        ("going out", "heading out"),
        ("hanging out", "hanging out"),
        ("hang out", "hanging out"),
    )
    for token, label in context_map:
        if token in combined:
            return label
    return "getting dressed"


def _build_chat_fallback_context(
    *,
    latest_user_text: str,
    previous_user_text: str,
    messages: list[ProviderMessage],
    wardrobe_items: list[models.ClothingItem],
) -> ChatFallbackContext:
    combined_user_text = " ".join(
        part for part in [previous_user_text, latest_user_text] if part
    ).strip()
    latest_intent = _detect_chat_intent(latest_user_text)
    return ChatFallbackContext(
        latest_user_text=latest_user_text,
        previous_user_text=previous_user_text,
        latest_intent=latest_intent,
        last_style_intent=_last_style_intent(messages),
        style_seed=_style_seed_from_text(combined_user_text or latest_user_text, wardrobe_items),
        context_label=_context_label_from_messages(latest_user_text, previous_user_text),
        variation_seed=_chat_variation_seed(messages, latest_user_text),
    )


def _has_style_context(context: ChatFallbackContext) -> bool:
    if _is_recommendation_intent(context.latest_intent) or context.latest_intent == "explicit_style":
        return True
    previous_intent = _detect_chat_intent(context.previous_user_text)
    return previous_intent == "explicit_style" or _is_recommendation_intent(previous_intent) or (
        context.last_style_intent == "explicit_style" or _is_recommendation_intent(context.last_style_intent)
    )


def _is_recommendation_intent(intent: str) -> bool:
    return intent in {"vague_recommendation", "lifestyle"}


def _pick_variant(options: tuple[str, ...], seed: int) -> str:
    if not options:
        return ""
    return options[seed % len(options)]


def _compose_chat_reply(
    *,
    context: ChatFallbackContext,
    suggestion: str,
    question: str,
    acknowledge: tuple[str, ...],
    opinion: tuple[str, ...],
) -> str:
    ack = _pick_variant(acknowledge, context.variation_seed).strip()
    aside = _pick_variant(opinion, context.variation_seed + 1).strip()
    suggestion = suggestion.strip()
    question = question.strip()
    pattern = context.variation_seed % 3

    if pattern == 0:
        parts = [ack, suggestion, aside, question]
    elif pattern == 1:
        parts = [suggestion, aside, question]
    else:
        parts = [question, ack, suggestion, aside]
    return " ".join(part for part in parts if part).strip()


def _chat_variation_seed(messages: list[ProviderMessage], latest_user_text: str) -> int:
    normalized_latest = _normalize_message(latest_user_text)
    repeated_prompt_count = sum(
        1
        for message in messages
        if message.role == "user" and _normalize_message(message.content) == normalized_latest
    )
    return max(0, (len(messages) * 3) + repeated_prompt_count - 1)
