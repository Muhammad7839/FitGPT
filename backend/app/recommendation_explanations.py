"""Builds user-facing recommendation explanations from outfit and context signals."""

from dataclasses import dataclass
from datetime import date
from typing import Optional

from app import models


@dataclass(frozen=True)
class RecommendationContext:
    """Optional request context used when composing recommendation explanations."""

    manual_temp: Optional[int]
    time_context: Optional[str]
    plan_date: Optional[str]
    exclude: Optional[str]
    weather_city: Optional[str]


def _normalize_text(value: Optional[str]) -> Optional[str]:
    """Trim user-provided text and normalize empty values to None."""
    if not value:
        return None
    normalized = value.strip()
    return normalized or None


def _parse_exclusions(raw_exclude: Optional[str]) -> list[str]:
    """Split a comma-delimited exclusion list into clean tokens."""
    cleaned = _normalize_text(raw_exclude)
    if not cleaned:
        return []
    return [part.strip() for part in cleaned.split(",") if part.strip()]


def _format_plan_date(raw_date: Optional[str]) -> Optional[str]:
    """Format an ISO date string for human-readable explanations."""
    cleaned = _normalize_text(raw_date)
    if not cleaned:
        return None
    try:
        parsed = date.fromisoformat(cleaned)
        return parsed.strftime("%B %d").replace(" 0", " ")
    except ValueError:
        return cleaned


def build_recommendation_explanation(
    *,
    user: models.User,
    items: list[models.ClothingItem],
    context: RecommendationContext,
) -> str:
    """Compose an explanation string from user profile, items, and request context."""
    if not items:
        return "No available items to recommend yet."

    parts: list[str] = []

    categories = [item.category.lower() for item in items]
    readable_categories = ", ".join(categories)
    parts.append(
        f"I picked this outfit to keep your rotation fresh, combining {readable_categories} pieces you have available now."
    )

    if context.time_context:
        parts.append(f"It is tuned for a {context.time_context.lower()} plan.")

    if context.manual_temp is not None:
        if context.weather_city:
            parts.append(
                f"The layering balance is adjusted for around {context.manual_temp}F based on current weather in {context.weather_city}."
            )
        else:
            parts.append(
                f"The layering balance is adjusted for around {context.manual_temp}F."
            )

    plan_date = _format_plan_date(context.plan_date)
    if plan_date:
        parts.append(f"It should work well for {plan_date}.")

    comfort_preference = _normalize_text(user.comfort_preference)
    if comfort_preference and comfort_preference.lower() != "medium":
        parts.append(
            f"I leaned toward your {comfort_preference.lower()} comfort preference."
        )

    lifestyle = _normalize_text(user.lifestyle)
    if lifestyle and lifestyle.lower() != "casual":
        parts.append(f"The styling direction matches your {lifestyle.lower()} routine.")

    exclusions = _parse_exclusions(context.exclude)
    if exclusions:
        parts.append(f"I avoided {', '.join(exclusions)} based on your exclusion list.")

    return " ".join(parts)
