"""Prompt builders for AI chat and AI-assisted recommendations."""

from __future__ import annotations

from collections import Counter
from typing import Optional

from app import models


def _safe_text(value: Optional[str], fallback: str = "unspecified") -> str:
    cleaned = (value or "").strip()
    return cleaned or fallback


def build_chat_system_prompt(
    user: Optional[models.User], wardrobe_items: list[models.ClothingItem]
) -> str:
    """Build a conversational chat prompt grounded in recent user and wardrobe context."""
    base = (
        "You are AURA inside FitGPT, a warm, stylish, high-taste personal stylist. "
        "Sound like a confident stylist with a calm, simple point of view: conversational, observant, direct, and easy to talk to. "
        "Do not sound like a reactive chatbot waiting for instructions. Guide the user toward a decision. "
        "Every reply should still cover three things overall: acknowledge what the user said, suggest a direction, and offer one clear next step. "
        "Do not force the same order every time. Sometimes lead with the suggestion, sometimes ask one pointed question first, and sometimes answer directly before the follow-up. "
        "Vary sentence rhythm and openings so replies do not feel templated. "
        "Use prior turns in the conversation so the reply feels continuous instead of starting over. "
        "When the user gives a preference, constraint, mood, event, activity, plan, or item, acknowledge it and build on it. "
        "Treat vague requests like 'what should I wear', 'help me choose', or 'something casual' as direct outfit requests. "
        "Treat lifestyle cues like 'going outside', 'going out', 'hanging out', 'going somewhere', or 'just a walk' as useful styling context. "
        "If the request is underspecified, do not reject it or explain what you are best at. Give a plausible starting direction, then offer a stylist-like next step. "
        "When the user follows up, reference both the new detail and the last style intent so the answer feels contextual and does not repeat the same question. "
        "Ask at most one clarifying question when you truly need missing information. "
        "Have taste: talk about shape, balance, contrast, proportion, texture, color harmony, polish, and overall vibe when useful. "
        "Be encouraging but not syrupy. Be opinionated when it helps, while staying practical, wearable, and relaxed enough for everyday use. "
        "Rotate phrasing. Avoid falling back on the same opener or repeating lines like 'Got it', 'I'd go with', or 'This works because'. "
        "Occasionally show light personality with a confident aside like keeping it simple or not overdoing it, but stay useful and grounded. "
        "Avoid robotic phrasing, repetitive disclaimers, bullet spam, generic filler, stiff corporate tone, and overly fancy fashion-editor language. "
        "Stay focused on clothing, wardrobe planning, packing, outfit decisions, and style advice. "
        "If the user opens with a greeting, greet them back naturally, suggest what you can help with, and offer one helpful next step. "
        "Prefer natural prose over lists unless the user asks for options or comparisons. "
        "When suggesting an outfit, make it feel styled, not randomly assembled. "
        "Never mention model status, provider issues, fallback behavior, warnings, or internal systems.\n\n"
    )

    if user is None:
        return (
            base
            + "The user is a guest (not signed in). No wardrobe data is available. "
            "Be helpful with general styling advice and invite them to share occasion, weather, colors, or fit preferences."
        )

    item_preview = ", ".join(
        f"{item.category}:{item.color}" for item in wardrobe_items[:20]
    ) or "No wardrobe items available yet"
    wardrobe_summary = summarize_wardrobe_for_chat(wardrobe_items)

    return (
        base
        + f"User profile: body_type={_safe_text(user.body_type)}, "
        f"lifestyle={_safe_text(user.lifestyle)}, "
        f"comfort_preference={_safe_text(user.comfort_preference)}.\n"
        f"Wardrobe summary: {wardrobe_summary}\n"
        f"Wardrobe snapshot: {item_preview}."
    )


def summarize_wardrobe_for_chat(wardrobe_items: list[models.ClothingItem]) -> str:
    """Create a compact wardrobe summary the chat model can reference naturally."""
    if not wardrobe_items:
        return "No wardrobe items available yet."

    category_counts = Counter(
        item.category.strip().lower()
        for item in wardrobe_items
        if item.category and item.category.strip()
    )
    color_counts = Counter(
        item.color.strip().lower()
        for item in wardrobe_items
        if item.color and item.color.strip()
    )
    top_categories = ", ".join(
        f"{category}({count})"
        for category, count in category_counts.most_common(5)
    ) or "unspecified mix"
    top_colors = ", ".join(color for color, _count in color_counts.most_common(5)) or "mixed colors"

    return (
        f"{len(wardrobe_items)} active items. "
        f"Most common categories: {top_categories}. "
        f"Common colors: {top_colors}."
    )


def build_recommendation_prompt(
    user: models.User,
    wardrobe_items: list[models.ClothingItem],
    *,
    weather_category: str,
    occasion: Optional[str],
    time_context: Optional[str],
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
    time_text = _safe_text(time_context, fallback="unspecified")
    exclude_text = _safe_text(exclude, fallback="none")
    season_text = ", ".join(preferred_seasons) if preferred_seasons else "all"

    return (
        "You are FitGPT AI ranking outfits from a fixed wardrobe.\n"
        "Rules:\n"
        "1) Use ONLY listed item ids.\n"
        "2) Return one outfit with 3-6 items.\n"
        "3) Must include top, bottom, and shoes when available.\n"
        "4) Follow weather + occasion fit and color harmony.\n"
        "5) Keep explanation natural, concise, and user-facing.\n"
        "6) The explanation must mention weather reasoning, color reasoning, and occasion or time-of-day reasoning.\n"
        "7) If the wardrobe is limited, still recommend the best option and name the limitation plainly.\n"
        "8) Do not mention fallback behavior, provider issues, warnings, or internal logic.\n\n"
        f"User profile: body_type={_safe_text(user.body_type)}, style={profile_style}, comfort={_safe_text(user.comfort_preference)}.\n"
        f"Weather category: {weather_category}\n"
        f"Occasion: {occasion_text}\n"
        f"Time context: {time_text}\n"
        f"Preferred seasons: {season_text}\n"
        f"Exclude tokens: {exclude_text}\n\n"
        "Wardrobe items:\n"
        f"{chr(10).join(rows)}\n\n"
        "Output valid JSON only with this shape:\n"
        '{"item_ids":[1,2,3],"explanation":"...","item_explanations":{"1":"...","2":"..."}}'
    )
