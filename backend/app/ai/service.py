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
                reply=self._build_chat_fallback_reply(wardrobe_items),
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
                reply=self._build_chat_fallback_reply(wardrobe_items),
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
                preferred_seasons=context.preferred_seasons,
                recent_fingerprints=recent_fingerprints,
                max_options=1,
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
                if len(combined_options) >= 5:
                    break
            return RecommendationResult(
                items=ai_items,
                explanation=parsed.explanation,
                outfit_score=ai_candidate.score,
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
    def _build_chat_fallback_reply(wardrobe_items: list[models.ClothingItem]) -> str:
        if not wardrobe_items:
            return (
                "I can help you style outfits. First add a few items across top, bottom, and shoes, "
                "then ask me for a look by weather or occasion."
            )
        categories = sorted(
            {_normalize_category(item.category) for item in wardrobe_items if item.category}
        )
        category_text = ", ".join(categories) or "your current items"
        return (
            "I’m in fallback mode right now, but I can still help. "
            f"You currently have {len(wardrobe_items)} items across {category_text}. "
            "Ask for an outfit by occasion or weather and I’ll suggest a practical combination."
        )


def _normalize_category(value: str) -> str:
    return value.strip().lower()
