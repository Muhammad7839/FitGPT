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
    exclude: Optional[str]
    style_preference: Optional[str]
    preferred_seasons: list[str]
    request_id: str


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
        recent_fingerprints = set(history.get_recent_fingerprints(db, user.id))
        item_map = {item.id: item for item in all_items}
        effective_preferred_seasons = crud.resolve_preferred_seasons(context.preferred_seasons)
        feedback_signals = crud.get_recommendation_feedback_signals_for_user(db, user.id)

        deterministic_options = deterministic.recommend_many(
            items=all_items,
            user=user,
            manual_temp=context.manual_temp,
            weather_category=context.weather_category,
            occasion=context.occasion,
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
            if ai_fingerprint in recent_fingerprints:
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
                explanation=parsed.explanation,
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
        style_context_active = _looks_style_related(latest_user_text) or (
            previous_user_text and _looks_style_related(previous_user_text)
        )
        if _looks_like_greeting(latest_user_text):
            if wardrobe_items:
                return (
                    "Hi, I’m AURA. I can help you put together something that feels styled without making it feel overdone. "
                    "Tell me the occasion, weather, or one piece you want to wear, and I’ll build the look around it."
                )
            return (
                "Hi, I’m AURA. I can help with outfits, packing, and style decisions in a way that feels a little more thoughtful than generic fashion advice. "
                "Tell me where you’re going, the vibe you want, or one piece you want to build around."
            )
        if latest_user_text and not style_context_active:
            return (
                "I’m best at outfit, wardrobe, packing, and style help. "
                "Tell me the occasion, weather, or a piece you feel like wearing and I’ll help you style it."
            )
        if not wardrobe_items:
            return (
                "I can absolutely help with that. Start by adding a few basics like tops, bottoms, and shoes, "
                "or tell me the occasion, weather, and vibe you want so I can guide you in a more styled direction."
            )
        wardrobe_summary = prompts.summarize_wardrobe_for_chat(wardrobe_items)
        style_seed = _style_seed_from_text(latest_user_text, wardrobe_items)
        if previous_user_text:
            return (
                f"Got it. Building on what you just said, I’d lean {style_seed}. "
                f"From your wardrobe, I’m seeing {wardrobe_summary.lower()} "
                "Tell me the setting or the temperature and I’ll turn that into a more finished outfit."
            )
        return (
            f"I can work with that. I’m seeing {wardrobe_summary.lower()} "
            f"A strong next step would be to start {style_seed}. "
            "Tell me the occasion, weather, or item you want to center and I’ll make it feel more pulled together."
        )


def _normalize_category(value: str) -> str:
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
    normalized = message.strip().lower().strip("!?. ,")
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


def _looks_style_related(message: str) -> bool:
    normalized = message.strip().lower()
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
        "pack",
        "packing",
        "laundry",
        "formal",
        "casual",
        "help",
        "vibe",
        "smart casual",
        "interview",
        "wedding",
        "cute",
        "stylish",
    }
    return any(keyword in normalized for keyword in style_keywords)


def _style_seed_from_text(message: str, wardrobe_items: list[models.ClothingItem]) -> str:
    normalized = message.strip().lower()
    if any(token in normalized for token in {"dress up", "dressy", "formal", "elegant", "wedding", "date"}):
        return "toward a cleaner, more polished combination"
    if any(token in normalized for token in {"casual", "relaxed", "comfortable", "comfy", "weekend"}):
        return "toward an easy, relaxed combination"
    if any(token in normalized for token in {"work", "office", "meeting", "interview"}):
        return "toward something sharp but still comfortable enough for the day"
    categories = {_normalize_category(item.category) for item in wardrobe_items if item.category}
    if "outerwear" in categories or "jacket" in categories:
        return "with a strong base layer and an easy outer layer"
    return "with a balanced top, bottom, and shoes"
