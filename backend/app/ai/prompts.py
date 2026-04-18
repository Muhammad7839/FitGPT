"""Prompt builders for AI chat and AI-assisted recommendations."""

from __future__ import annotations

from typing import Optional

from app import models


_MAX_PROMPT_FIELD_LEN = 120


def _safe_text(value: Optional[str], fallback: str = "unspecified") -> str:
    """Sanitize a user-controlled string for safe insertion into an LLM prompt.

    Collapses newlines/tabs to spaces (prevents injected instructions) and caps
    length so a malicious profile field cannot dominate the system prompt.
    """
    raw = (value or "").strip()
    if not raw:
        return fallback
    sanitized = raw.replace("\r", " ").replace("\n", " ").replace("\t", " ")
    sanitized = " ".join(sanitized.split())
    if len(sanitized) > _MAX_PROMPT_FIELD_LEN:
        sanitized = sanitized[:_MAX_PROMPT_FIELD_LEN].rstrip() + "..."
    return sanitized or fallback


def build_chat_system_prompt(
    user: Optional[models.User],
    wardrobe_items: list[models.ClothingItem],
    client_context=None,
) -> str:
    """Builds a concise system prompt scoped to the authenticated user's context."""
    base = (
        "You are FitGPT, a practical personal stylist. "
        "Give clear and short recommendations with actionable next steps. "
        "Stay focused on clothing, wardrobe planning, and outfit decisions.\n\n"
    )

    if user is None:
        # Use client-supplied wardrobe/preferences for guests
        guest_parts = []
        if client_context:
            ws = (getattr(client_context, "wardrobe_summary", None) or "").strip()
            prefs = (getattr(client_context, "preferences", None) or "").strip()
            if ws:
                guest_parts.append(f"Wardrobe snapshot: {ws}")
            if prefs:
                guest_parts.append(f"Preferences: {prefs}")
        if not guest_parts:
            guest_parts.append("The user is a guest (not signed in). No wardrobe data is available.")
        prompt = base + "\n".join(guest_parts)
    else:
        item_preview = ", ".join(
            f"{item.category}:{item.color}" for item in wardrobe_items[:20]
        ) or "No wardrobe items available yet"

        prompt = (
            base
            + f"User profile: body_type={_safe_text(user.body_type)}, "
            f"lifestyle={_safe_text(user.lifestyle)}, "
            f"comfort_preference={_safe_text(user.comfort_preference)}.\n"
            f"Wardrobe snapshot: {item_preview}."
        )

    # Append current home screen recommendations if provided
    recs = ""
    if client_context:
        recs = (getattr(client_context, "recommendations_summary", None) or "").strip()
    if recs:
        prompt += (
            "\n\n## Current Home Screen Recommendations\n"
            "These outfit options are currently shown on the user's home screen. "
            "When the user asks about their recommendations, refer to these:\n"
            + recs
        )

    return prompt


def build_recommendation_prompt(
    user: models.User,
    wardrobe_items: list[models.ClothingItem],
    *,
    weather_category: str,
    occasion: Optional[str],
    exclude: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: list[str],
) -> str:
    """Builds a strict JSON-only prompt for AI ranking on top of deterministic candidates."""
    rows = []
    for item in wardrobe_items:
        rows.append(
            (
                f"id={item.id}; category={item.category}; type={item.clothing_type or 'n/a'}; "
                f"fit_tag={item.fit_tag or 'n/a'}; color={item.color}; season={item.season}; "
                f"comfort={item.comfort_level}; brand={item.brand or 'n/a'}"
            )
        )

    profile_style = _safe_text(style_preference or user.lifestyle)
    occasion_text = _safe_text(occasion, fallback="everyday")
    exclude_text = _safe_text(exclude, fallback="none")
    season_text = ", ".join(preferred_seasons) if preferred_seasons else "all"

    return (
        "You are FitGPT AI ranking outfits from a fixed wardrobe.\n"
        "Rules:\n"
        "1) Use ONLY listed item ids.\n"
        "2) Return one outfit with 3-6 items.\n"
        "3) Must include top, bottom, and shoes when available.\n"
        "4) Follow weather + occasion fit and color harmony.\n"
        "5) Keep explanation natural and concise.\n\n"
        f"User profile: body_type={_safe_text(user.body_type)}, style={profile_style}, comfort={_safe_text(user.comfort_preference)}.\n"
        f"Weather category: {weather_category}\n"
        f"Occasion: {occasion_text}\n"
        f"Preferred seasons: {season_text}\n"
        f"Exclude tokens: {exclude_text}\n\n"
        "Wardrobe items:\n"
        f"{chr(10).join(rows)}\n\n"
        "Output valid JSON only with this shape:\n"
        '{"item_ids":[1,2,3],"explanation":"...","item_explanations":{"1":"...","2":"..."}}'
    )

