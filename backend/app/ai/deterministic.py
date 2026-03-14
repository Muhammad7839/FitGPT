"""Deterministic recommendation engine used as a safe AI fallback."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app import models
from app.weather import map_temperature_to_category

_NEUTRAL_COLORS = {
    "black",
    "white",
    "gray",
    "grey",
    "beige",
    "navy",
    "tan",
    "cream",
    "khaki",
    "ivory",
}
_COMPLEMENTARY_PAIRS = {
    frozenset({"blue", "orange"}),
    frozenset({"red", "green"}),
    frozenset({"yellow", "purple"}),
    frozenset({"teal", "red"}),
    frozenset({"pink", "green"}),
}
_ANALOGOUS_GROUPS = [
    {"red", "orange", "coral", "pink"},
    {"orange", "yellow", "gold"},
    {"yellow", "green", "lime"},
    {"green", "teal", "olive"},
    {"blue", "teal", "navy"},
    {"blue", "purple", "indigo"},
    {"purple", "pink", "magenta"},
    {"brown", "orange", "tan", "rust"},
]


@dataclass(frozen=True)
class RecommendationCandidate:
    """Internal ranked outfit candidate."""

    item_ids: list[int]
    score: float
    explanation: str
    item_explanations: dict[int, str]
    weather_category: str

    @property
    def fingerprint(self) -> str:
        return ",".join(str(item_id) for item_id in sorted(self.item_ids))


def normalize_weather_category(weather_category: Optional[str], manual_temp: Optional[int]) -> str:
    normalized = (weather_category or "").strip().lower()
    if normalized in {"cold", "cool", "mild", "warm", "hot"}:
        return normalized
    if manual_temp is not None:
        return map_temperature_to_category(manual_temp)
    return "mild"


def recommend(
    *,
    items: list[models.ClothingItem],
    user: models.User,
    manual_temp: Optional[int],
    weather_category: Optional[str],
    occasion: Optional[str],
    exclude: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: Optional[list[str]],
    recent_fingerprints: set[str],
) -> RecommendationCandidate:
    """Returns the best deterministic candidate while avoiding recent repeats when possible."""
    normalized_weather = normalize_weather_category(weather_category, manual_temp)
    eligible_items = _filter_eligible_items(items=items, exclude=exclude)

    combos = _build_candidate_combos(eligible_items, normalized_weather)
    if not combos:
        fallback_items = [item.id for item in eligible_items[:3]]
        return RecommendationCandidate(
            item_ids=fallback_items,
            score=0.0,
            explanation="Add more wardrobe items across top, bottom, and shoes for stronger recommendations.",
            item_explanations={},
            weather_category=normalized_weather,
        )

    ranked_candidates = sorted(
        (
            _score_candidate(
                combo=combo,
                user=user,
                weather_category=normalized_weather,
                occasion=occasion,
                style_preference=style_preference,
                preferred_seasons=preferred_seasons,
            )
            for combo in combos
        ),
        key=lambda candidate: candidate.score,
        reverse=True,
    )

    for candidate in ranked_candidates:
        if candidate.fingerprint not in recent_fingerprints:
            return candidate
    return ranked_candidates[0]


def _filter_eligible_items(items: list[models.ClothingItem], exclude: Optional[str]) -> list[models.ClothingItem]:
    exclude_tokens = [token.strip().lower() for token in (exclude or "").split(",") if token.strip()]

    def allowed(item: models.ClothingItem) -> bool:
        if not item.is_available or item.is_archived:
            return False
        if not exclude_tokens:
            return True
        blob = " ".join(
            [
                item.name or "",
                item.category or "",
                item.clothing_type or "",
                item.fit_tag or "",
                item.color or "",
                item.season or "",
                item.brand or "",
            ]
        ).lower()
        return all(token not in blob for token in exclude_tokens)

    return [item for item in items if allowed(item)]


def _normalize_category(raw_category: Optional[str]) -> str:
    normalized = (raw_category or "").strip().lower()
    if normalized in {"top", "tops", "shirt", "t-shirt", "tee"}:
        return "top"
    if normalized in {"bottom", "bottoms", "pants", "jeans", "shorts", "skirt"}:
        return "bottom"
    if normalized in {"shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals"}:
        return "shoes"
    if normalized in {"outerwear", "jacket", "coat", "hoodie", "sweater"}:
        return "outerwear"
    if normalized in {"accessory", "accessories", "hat", "watch", "scarf"}:
        return "accessory"
    return normalized


def _build_candidate_combos(items: list[models.ClothingItem], weather_category: str) -> list[list[models.ClothingItem]]:
    categories = {"top": [], "bottom": [], "shoes": [], "outerwear": [], "accessory": []}
    for item in items:
        normalized_category = _normalize_category(item.category)
        if normalized_category in categories:
            categories[normalized_category].append(item)

    tops = categories["top"]
    bottoms = categories["bottom"]
    shoes = categories["shoes"]
    outerwear_items = categories["outerwear"]
    accessories = categories["accessory"]

    if not tops or not bottoms or not shoes:
        return []

    combos: list[list[models.ClothingItem]] = []
    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                base = [top, bottom, shoe]

                outerwear_options: list[Optional[models.ClothingItem]] = [None]
                if weather_category == "cold" and outerwear_items:
                    outerwear_options = outerwear_items
                elif weather_category in {"cool", "mild"} and outerwear_items:
                    outerwear_options = [None] + outerwear_items

                for outerwear in outerwear_options:
                    selected = list(base)
                    if outerwear is not None:
                        selected.append(outerwear)

                    accessory_pool = [item for item in accessories if item.id not in {entry.id for entry in selected}]
                    accessory_pool = sorted(
                        accessory_pool,
                        key=lambda item: (item.last_worn_timestamp or 0, item.id),
                    )
                    combos.append(selected)

                    if accessory_pool:
                        combos.append(selected + accessory_pool[:1])
                    if len(accessory_pool) >= 2:
                        limited = _limit_accessories(selected + accessory_pool[:2])
                        combos.append(limited)
                    if len(accessory_pool) >= 3 and weather_category not in {"hot"}:
                        limited = _limit_accessories(selected + accessory_pool[:3])
                        combos.append(limited)

    unique: dict[str, list[models.ClothingItem]] = {}
    for combo in combos:
        key = ",".join(str(item_id) for item_id in sorted(item.id for item in combo))
        unique[key] = combo
    return list(unique.values())


def _limit_accessories(combo: list[models.ClothingItem]) -> list[models.ClothingItem]:
    """Keeps accessory count <= 3 and hat count <= 1."""
    result: list[models.ClothingItem] = []
    accessory_count = 0
    hat_used = False
    for item in combo:
        if _normalize_category(item.category) != "accessory":
            result.append(item)
            continue
        blob = f"{item.name or ''} {item.clothing_type or ''}".lower()
        is_hat = "hat" in blob
        if accessory_count >= 3:
            continue
        if is_hat and hat_used:
            continue
        if is_hat:
            hat_used = True
        accessory_count += 1
        result.append(item)
    return result


def _score_candidate(
    *,
    combo: list[models.ClothingItem],
    user: models.User,
    weather_category: str,
    occasion: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: Optional[list[str]],
) -> RecommendationCandidate:
    comfort_target = _resolve_comfort_target(user.comfort_preference)
    style_target = (style_preference or user.lifestyle or "casual").strip().lower()
    body_type = (user.body_type or "unspecified").strip().lower()
    preferred_seasons_set = {
        season.strip().lower()
        for season in (preferred_seasons or [])
        if season.strip()
    }

    item_scores = [
        _score_item(
            item=item,
            comfort_target=comfort_target,
            style_target=style_target,
            body_type=body_type,
            weather_category=weather_category,
            preferred_seasons=preferred_seasons_set,
            occasion=occasion,
        )
        for item in combo
    ]
    avg_item_score = sum(item_scores) / len(item_scores)
    color_bonus = _color_harmony_bonus(combo)
    diversity_bonus = _category_diversity_bonus(combo)
    temp_penalty = sum(_temperature_penalty(item, weather_category) for item in combo) / len(combo)

    score = (
        (avg_item_score * 0.62)
        + (color_bonus * 0.20)
        + (diversity_bonus * 0.10)
        - (temp_penalty * 0.08)
    )
    explanation = _build_combo_explanation(
        combo=combo,
        weather_category=weather_category,
        style_target=style_target,
        body_type=body_type,
        occasion=occasion,
        color_bonus=color_bonus,
    )
    item_explanations = {
        item.id: _build_item_explanation(item, weather_category, style_target, comfort_target)
        for item in combo
    }
    return RecommendationCandidate(
        item_ids=[item.id for item in combo],
        score=round(score, 3),
        explanation=explanation,
        item_explanations=item_explanations,
        weather_category=weather_category,
    )


def _score_item(
    *,
    item: models.ClothingItem,
    comfort_target: int,
    style_target: str,
    body_type: str,
    weather_category: str,
    preferred_seasons: set[str],
    occasion: Optional[str],
) -> float:
    season_score = _season_score(item, preferred_seasons)
    comfort_score = _comfort_score(item, comfort_target)
    style_score = _style_score(item, style_target)
    fit_score = _fit_score(item, body_type)
    weather_penalty = _temperature_penalty(item, weather_category)
    occasion_penalty = _occasion_penalty(item, occasion)

    return (
        (season_score * 0.35)
        + (comfort_score * 0.25)
        + (style_score * 0.20)
        + (fit_score * 0.20)
        - (weather_penalty * 0.10)
        - (occasion_penalty * 0.05)
    )


def _resolve_comfort_target(raw_value: Optional[str]) -> int:
    cleaned = (raw_value or "").strip().lower()
    if cleaned in {"low", "1", "2"}:
        return 2
    if cleaned in {"medium", "3"}:
        return 3
    if cleaned in {"high", "4", "5"}:
        return 4
    try:
        numeric = int(cleaned)
        return min(max(numeric, 1), 5)
    except ValueError:
        return 3


def _season_score(item: models.ClothingItem, preferred_seasons: set[str]) -> float:
    season = (item.season or "").strip().lower()
    if not season or season == "all":
        return 0.85
    if not preferred_seasons:
        return 0.75
    return 1.0 if season in preferred_seasons else 0.3


def _comfort_score(item: models.ClothingItem, comfort_target: int) -> float:
    diff = abs(item.comfort_level - comfort_target)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.75
    if diff == 2:
        return 0.45
    return 0.15


def _style_score(item: models.ClothingItem, style_target: str) -> float:
    item_category = _normalize_category(item.category)
    style_map = {
        "casual": {"top", "bottom", "shoes", "accessory"},
        "formal": {"top", "bottom", "outerwear", "shoes"},
        "sporty": {"top", "bottom", "shoes"},
        "streetwear": {"top", "bottom", "outerwear", "shoes", "accessory"},
    }
    matched_categories = style_map.get(style_target, {"top", "bottom", "shoes", "outerwear", "accessory"})
    return 0.85 if item_category in matched_categories else 0.5


def _fit_score(item: models.ClothingItem, body_type: str) -> float:
    item_category = _normalize_category(item.category)
    if body_type == "slim":
        if item_category == "outerwear":
            return 0.9
        if item_category == "accessory":
            return 0.85
        return 0.72
    if body_type == "athletic":
        if item_category == "top":
            return 0.9
        if item_category == "shoes":
            return 0.85
        if item_category == "bottom":
            return 0.8
        return 0.72
    if body_type in {"plus-size", "plus size", "plus"}:
        if item_category == "outerwear":
            return 0.9
        if item_category == "accessory":
            return 0.84
        if item_category == "top":
            return 0.8
        return 0.72
    return 0.74


def _temperature_penalty(item: models.ClothingItem, weather_category: str) -> float:
    blob = " ".join(
        [item.name or "", item.clothing_type or "", item.category or "", item.color or ""]
    ).lower()
    category = _normalize_category(item.category)
    penalty = 0.0
    if weather_category == "cold":
        if category == "bottom" and any(token in blob for token in {"short", "mini"}):
            penalty += 1.0
        if category == "shoes" and any(token in blob for token in {"sandal", "flip flop"}):
            penalty += 1.0
        if any(token in blob for token in {"tank", "linen", "light"}):
            penalty += 0.6
        if category == "outerwear":
            penalty -= 0.3
    elif weather_category == "cool":
        if category == "outerwear" and any(token in blob for token in {"parka", "heavy", "thick"}):
            penalty += 0.5
    elif weather_category == "warm":
        if category == "outerwear":
            penalty += 0.9
        if any(token in blob for token in {"wool", "thick", "heavy"}):
            penalty += 0.6
    elif weather_category == "hot":
        if category == "outerwear":
            penalty += 1.2
        if any(token in blob for token in {"jacket", "coat", "sweater", "wool", "heavy"}):
            penalty += 0.8
    return penalty


def _occasion_penalty(item: models.ClothingItem, occasion: Optional[str]) -> float:
    normalized_occasion = (occasion or "").strip().lower()
    if not normalized_occasion:
        return 0.0

    blob = " ".join(
        [item.name or "", item.category or "", item.clothing_type or "", item.brand or ""]
    ).lower()
    if any(token in normalized_occasion for token in {"formal", "interview", "office", "wedding"}):
        if any(token in blob for token in {"formal", "tailored", "blazer", "dress", "oxford", "loafer"}):
            return 0.0
        return 0.4
    if any(token in normalized_occasion for token in {"gym", "workout", "sport", "running"}):
        if any(token in blob for token in {"sport", "athletic", "training", "running", "sneaker"}):
            return 0.0
        return 0.4
    return 0.0


def _category_diversity_bonus(combo: list[models.ClothingItem]) -> float:
    categories = {_normalize_category(item.category) for item in combo}
    has_top = "top" in categories
    has_bottom = "bottom" in categories
    if has_top and has_bottom and len(categories) >= 3:
        return 1.0
    if has_top and has_bottom:
        return 0.75
    if has_top or has_bottom:
        return 0.4
    return 0.2


def _color_harmony_bonus(combo: list[models.ClothingItem]) -> float:
    colors = [(item.color or "").strip().lower() for item in combo if (item.color or "").strip()]
    if len(colors) < 2:
        return 0.3
    accent_colors = [color for color in colors if color not in _NEUTRAL_COLORS]
    neutral_count = len(colors) - len(accent_colors)

    if neutral_count == len(colors):
        return 0.7
    unique_accents = set(accent_colors)
    if len(unique_accents) == 1 and neutral_count >= 1:
        return 1.0
    if neutral_count >= 1 and len(accent_colors) == 1:
        return 0.95
    if len(accent_colors) >= 2:
        first, second = accent_colors[0], accent_colors[1]
        if frozenset({first, second}) in _COMPLEMENTARY_PAIRS:
            return 0.9 if neutral_count >= 1 else 0.8
        if any(first in group and second in group for group in _ANALOGOUS_GROUPS):
            return 0.95 if neutral_count >= 1 else 0.85
    if neutral_count >= 1 and len(accent_colors) > 2:
        return 0.5
    return 0.4


def _build_combo_explanation(
    *,
    combo: list[models.ClothingItem],
    weather_category: str,
    style_target: str,
    body_type: str,
    occasion: Optional[str],
    color_bonus: float,
) -> str:
    categories = ", ".join(item.category for item in combo)
    occasion_text = (occasion or "everyday use").strip()
    color_text = (
        "cohesive color harmony"
        if color_bonus >= 0.9
        else "balanced color contrast"
        if color_bonus >= 0.7
        else "a bold color mix"
    )
    return (
        f"This outfit combines {categories} for {occasion_text}. "
        f"It is tuned for {weather_category} weather, matches a {style_target} style, "
        f"and uses {color_text} while keeping {body_type} fit preferences in mind."
    )


def _build_item_explanation(
    item: models.ClothingItem,
    weather_category: str,
    style_target: str,
    comfort_target: int,
) -> str:
    comfort_diff = item.comfort_level - comfort_target
    if comfort_diff >= 1:
        comfort_note = "more comfortable than your baseline"
    elif comfort_diff == 0:
        comfort_note = "aligned with your comfort baseline"
    elif comfort_diff == -1:
        comfort_note = "slightly less comfortable than your baseline"
    else:
        comfort_note = "style-forward with lower comfort"

    return (
        f"{item.category} in {item.color} supports {style_target} styling, "
        f"works for {weather_category} conditions, and is {comfort_note}."
    )

