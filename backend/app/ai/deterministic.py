"""Deterministic recommendation engine used for legacy and AI fallback flows."""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha1
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
]
_EXPLANATION_TEMPLATES = (
    "Built for {weather} weather with {color_phrase}, this outfit keeps the structure practical for {occasion}.",
    "This combination is tuned for {weather} conditions and uses {color_phrase} to keep the look cohesive for {occasion}.",
    "Selected with {weather} in mind, the pieces follow a balanced structure and use {color_phrase} for {occasion}.",
    "A weather-aware pick for {occasion}: it keeps outfit structure logical and relies on {color_phrase}.",
)


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


def recommend_many(
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
    max_options: int = 3,
) -> list[RecommendationCandidate]:
    """Returns ranked deterministic options while avoiding recent repeats when possible."""
    normalized_weather = normalize_weather_category(weather_category, manual_temp)
    eligible_items = _filter_eligible_items(items=items, exclude=exclude)
    combos = _build_candidate_combos(eligible_items, normalized_weather)

    if not combos:
        fallback_ids = [item.id for item in eligible_items[:3]]
        return [
            RecommendationCandidate(
                item_ids=fallback_ids,
                score=0.0,
                explanation="Add more wardrobe variety across top, bottom, and shoes to unlock stronger outfits.",
                item_explanations={},
                weather_category=normalized_weather,
            )
        ]

    ranked = sorted(
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

    preferred = [candidate for candidate in ranked if candidate.fingerprint not in recent_fingerprints]
    fallback = [candidate for candidate in ranked if candidate.fingerprint in recent_fingerprints]
    merged = preferred + fallback
    return merged[: max(1, min(max_options, 10))]


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
    """Returns the best deterministic candidate."""
    return recommend_many(
        items=items,
        user=user,
        manual_temp=manual_temp,
        weather_category=weather_category,
        occasion=occasion,
        exclude=exclude,
        style_preference=style_preference,
        preferred_seasons=preferred_seasons,
        recent_fingerprints=recent_fingerprints,
        max_options=1,
    )[0]


def score_existing_combo(
    *,
    combo: list[models.ClothingItem],
    user: models.User,
    weather_category: str,
    occasion: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: Optional[list[str]],
) -> RecommendationCandidate:
    """Scores and explains an existing combo using the same deterministic rubric."""
    return _score_candidate(
        combo=combo,
        user=user,
        weather_category=weather_category,
        occasion=occasion,
        style_preference=style_preference,
        preferred_seasons=preferred_seasons,
    )


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
                " ".join(item.style_tags),
                " ".join(item.season_tags),
                " ".join(item.colors),
                " ".join(item.occasion_tags),
            ]
        ).lower()
        return all(token not in blob for token in exclude_tokens)

    filtered = [item for item in items if allowed(item)]
    filtered.sort(key=lambda item: (item.last_worn_timestamp or 0, item.id))
    return filtered


def _normalize_category(raw_category: Optional[str]) -> str:
    normalized = (raw_category or "").strip().lower()
    if normalized in {"top", "tops", "shirt", "t-shirt", "tee", "blouse"}:
        return "top"
    if normalized in {"bottom", "bottoms", "pants", "jeans", "shorts", "skirt"}:
        return "bottom"
    if normalized in {"shoe", "shoes", "sneaker", "sneakers", "boot", "boots", "sandal", "sandals"}:
        return "shoes"
    if normalized in {"outerwear", "jacket", "coat", "hoodie", "sweater"}:
        return "outerwear"
    if normalized in {"accessory", "accessories", "hat", "watch", "scarf", "belt", "bag"}:
        return "accessory"
    return normalized


def _is_accessory(item: models.ClothingItem) -> bool:
    if _normalize_category(item.category) == "accessory":
        return True
    if (item.accessory_type or "").strip():
        return True
    return False


def _is_one_piece(item: models.ClothingItem) -> bool:
    if item.is_one_piece:
        return True
    clothing_type = (item.clothing_type or "").strip().lower()
    return clothing_type in {"dress", "jumpsuit", "overall", "overalls", "romper"}


def _season_values(item: models.ClothingItem) -> set[str]:
    values = {value.strip().lower() for value in item.season_tags if value.strip()}
    if not values and (item.season or "").strip():
        values.add(item.season.strip().lower())
    return values


def _occasion_values(item: models.ClothingItem) -> set[str]:
    return {value.strip().lower() for value in item.occasion_tags if value.strip()}


def _style_values(item: models.ClothingItem) -> set[str]:
    values = {value.strip().lower() for value in item.style_tags if value.strip()}
    if not values:
        guess = _guess_style_from_item(item)
        if guess:
            values.add(guess)
    return values


def _guess_style_from_item(item: models.ClothingItem) -> Optional[str]:
    blob = f"{item.name or ''} {item.clothing_type or ''} {item.brand or ''}".lower()
    if any(token in blob for token in {"formal", "tailored", "blazer", "dress", "oxford"}):
        return "formal"
    if any(token in blob for token in {"sport", "athletic", "running", "training"}):
        return "athletic"
    return "casual"


def _build_candidate_combos(items: list[models.ClothingItem], weather_category: str) -> list[list[models.ClothingItem]]:
    categories = {"top": [], "bottom": [], "shoes": [], "outerwear": [], "accessory": [], "one_piece": []}
    for item in items:
        normalized_category = _normalize_category(item.category)
        if _is_one_piece(item):
            categories["one_piece"].append(item)
        elif normalized_category in categories:
            categories[normalized_category].append(item)
        elif _is_accessory(item):
            categories["accessory"].append(item)

    tops = categories["top"][:10]
    bottoms = categories["bottom"][:10]
    shoes = categories["shoes"][:10]
    one_pieces = categories["one_piece"][:10]
    outerwear_items = categories["outerwear"][:8]
    accessories = categories["accessory"][:12]

    if not shoes:
        return []

    combos: list[list[models.ClothingItem]] = []
    # Standard structure: top + bottom + shoes.
    for top in tops:
        for bottom in bottoms:
            for shoe in shoes:
                base = [top, bottom, shoe]
                for layered in _apply_layer_rules(base, outerwear_items, weather_category):
                    combos.extend(_expand_with_accessories(layered, accessories, weather_category))

    # One-piece structure: one-piece + shoes.
    for one_piece in one_pieces:
        for shoe in shoes:
            base = [one_piece, shoe]
            for layered in _apply_layer_rules(base, outerwear_items, weather_category):
                combos.extend(_expand_with_accessories(layered, accessories, weather_category))

    unique: dict[str, list[models.ClothingItem]] = {}
    for combo in combos:
        if not _validate_outfit_structure(combo, weather_category):
            continue
        key = ",".join(str(item_id) for item_id in sorted(item.id for item in combo))
        unique[key] = combo
    return list(unique.values())


def _apply_layer_rules(
    base: list[models.ClothingItem],
    outerwear_items: list[models.ClothingItem],
    weather_category: str,
) -> list[list[models.ClothingItem]]:
    if not outerwear_items:
        return [base]

    options: list[list[models.ClothingItem]] = [base]
    outer_candidates = [item for item in outerwear_items if item.id not in {entry.id for entry in base}]
    if not outer_candidates:
        return options

    if weather_category in {"cold", "cool"}:
        options.append(base + [outer_candidates[0]])
        if weather_category == "cold" and len(outer_candidates) > 1:
            # Allow a second layer in deep cold conditions when available.
            options.append(base + outer_candidates[:2])
    elif weather_category == "mild":
        options.append(base + [outer_candidates[0]])
    return options


def _expand_with_accessories(
    combo: list[models.ClothingItem],
    accessories: list[models.ClothingItem],
    weather_category: str,
) -> list[list[models.ClothingItem]]:
    base_ids = {item.id for item in combo}
    pool = [item for item in accessories if item.id not in base_ids]
    if not pool:
        return [_limit_accessories(combo)]

    options = [_limit_accessories(combo)]
    options.append(_limit_accessories(combo + pool[:1]))
    if len(pool) >= 2:
        options.append(_limit_accessories(combo + pool[:2]))
    if len(pool) >= 3 and weather_category != "hot":
        options.append(_limit_accessories(combo + pool[:3]))
    return options


def _limit_accessories(combo: list[models.ClothingItem]) -> list[models.ClothingItem]:
    """Keeps accessory count <= 3 and hat-like accessory count <= 1."""
    result: list[models.ClothingItem] = []
    accessory_count = 0
    hat_like_used = False
    for item in combo:
        if not _is_accessory(item):
            result.append(item)
            continue
        if accessory_count >= 3:
            continue
        hint = f"{item.name or ''} {item.clothing_type or ''} {item.accessory_type or ''}".lower()
        is_hat_like = "hat" in hint or "cap" in hint or (item.accessory_type or "").strip().lower() in {"hat", "cap"}
        if is_hat_like and hat_like_used:
            continue
        if is_hat_like:
            hat_like_used = True
        accessory_count += 1
        result.append(item)
    return result


def _validate_outfit_structure(combo: list[models.ClothingItem], weather_category: str) -> bool:
    categories = [_normalize_category(item.category) for item in combo if not _is_one_piece(item)]
    one_piece_count = sum(1 for item in combo if _is_one_piece(item))
    shoes_count = sum(1 for item in combo if _normalize_category(item.category) == "shoes")
    top_count = categories.count("top")
    bottom_count = categories.count("bottom")
    outerwear_count = categories.count("outerwear")

    if shoes_count != 1:
        return False
    if one_piece_count > 1:
        return False
    if one_piece_count == 1 and (top_count > 0 or bottom_count > 0):
        return False
    if one_piece_count == 0 and not (top_count == 1 and bottom_count == 1):
        return False
    if outerwear_count > 2:
        return False
    if weather_category == "cold" and outerwear_count == 0:
        return False
    return True


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
    preferred_seasons_set = {
        season.strip().lower()
        for season in (preferred_seasons or [])
        if season.strip()
    }
    occasion_text = (occasion or "daily").strip().lower()

    item_scores = [
        _score_item(
            item=item,
            comfort_target=comfort_target,
            style_target=style_target,
            weather_category=weather_category,
            preferred_seasons=preferred_seasons_set,
            occasion=occasion_text,
        )
        for item in combo
    ]
    avg_item_score = sum(item_scores) / len(item_scores)
    color_bonus = _color_harmony_bonus(combo)
    diversity_bonus = _category_diversity_bonus(combo)
    structure_bonus = _structure_bonus(combo, weather_category)
    set_bonus = _set_bonus(combo)
    temp_penalty = sum(_temperature_penalty(item, weather_category) for item in combo) / len(combo)

    score = (
        (avg_item_score * 0.52)
        + (color_bonus * 0.16)
        + (diversity_bonus * 0.10)
        + (structure_bonus * 0.10)
        + (set_bonus * 0.08)
        - (temp_penalty * 0.12)
    )
    explanation = _build_combo_explanation(
        combo=combo,
        weather_category=weather_category,
        occasion=occasion_text,
        color_bonus=color_bonus,
    )
    item_explanations = {
        item.id: _build_item_explanation(item, weather_category, style_target, comfort_target, occasion_text)
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
    weather_category: str,
    preferred_seasons: set[str],
    occasion: str,
) -> float:
    season_score = _season_score(item, preferred_seasons, weather_category)
    comfort_score = _comfort_score(item, comfort_target)
    style_score = _style_score(item, style_target)
    occasion_score = _occasion_score(item, occasion)
    weather_penalty = _temperature_penalty(item, weather_category)
    return (
        (season_score * 0.30)
        + (comfort_score * 0.25)
        + (style_score * 0.25)
        + (occasion_score * 0.20)
        - (weather_penalty * 0.12)
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


def _season_score(item: models.ClothingItem, preferred_seasons: set[str], weather_category: str) -> float:
    seasons = _season_values(item)
    if not seasons or "all" in seasons:
        return 0.9
    if preferred_seasons and seasons.intersection(preferred_seasons):
        return 1.0
    preferred_weather_map = {
        "cold": {"winter", "fall"},
        "cool": {"fall", "spring", "winter"},
        "mild": {"spring", "fall", "all"},
        "warm": {"spring", "summer"},
        "hot": {"summer", "spring"},
    }
    expected = preferred_weather_map.get(weather_category, {"all"})
    return 0.95 if seasons.intersection(expected) else 0.35


def _comfort_score(item: models.ClothingItem, comfort_target: int) -> float:
    diff = abs(item.comfort_level - comfort_target)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.75
    if diff == 2:
        return 0.5
    return 0.2


def _style_score(item: models.ClothingItem, style_target: str) -> float:
    styles = _style_values(item)
    if not styles:
        return 0.7
    if style_target in styles:
        return 1.0
    if style_target == "formal" and "casual" in styles:
        return 0.45
    if style_target in {"athletic", "sporty"} and "formal" in styles:
        return 0.4
    return 0.7


def _occasion_score(item: models.ClothingItem, occasion: str) -> float:
    occasion_values = _occasion_values(item)
    if not occasion:
        return 0.7
    if not occasion_values:
        return 0.65
    if any(value in occasion for value in occasion_values):
        return 1.0
    return 0.45


def _temperature_penalty(item: models.ClothingItem, weather_category: str) -> float:
    blob = " ".join(
        [item.name or "", item.clothing_type or "", item.category or "", " ".join(item.season_tags)]
    ).lower()
    category = _normalize_category(item.category)
    penalty = 0.0
    if weather_category == "cold":
        if category == "bottom" and any(token in blob for token in {"short", "mini"}):
            penalty += 1.2
        if category == "shoes" and any(token in blob for token in {"sandal", "flip flop"}):
            penalty += 1.2
        if any(token in blob for token in {"tank", "linen", "light"}):
            penalty += 0.7
    elif weather_category == "cool":
        if category == "outerwear" and any(token in blob for token in {"parka", "heavy", "thick"}):
            penalty += 0.4
    elif weather_category == "warm":
        if category == "outerwear":
            penalty += 1.0
        if any(token in blob for token in {"wool", "thick", "heavy"}):
            penalty += 0.6
    elif weather_category == "hot":
        if category == "outerwear":
            penalty += 1.4
        if any(token in blob for token in {"jacket", "coat", "sweater", "wool", "heavy"}):
            penalty += 0.8
    return penalty


def _structure_bonus(combo: list[models.ClothingItem], weather_category: str) -> float:
    if not _validate_outfit_structure(combo, weather_category):
        return 0.0
    categories = {_normalize_category(item.category) for item in combo}
    bonus = 0.7
    if "top" in categories and "bottom" in categories and "shoes" in categories:
        bonus += 0.15
    if any(_is_one_piece(item) for item in combo):
        bonus += 0.1
    if weather_category == "cold" and "outerwear" in categories:
        bonus += 0.15
    return min(bonus, 1.0)


def _set_bonus(combo: list[models.ClothingItem]) -> float:
    set_ids = [item.set_identifier.strip().lower() for item in combo if (item.set_identifier or "").strip()]
    if not set_ids:
        return 0.0
    counts: dict[str, int] = {}
    for value in set_ids:
        counts[value] = counts.get(value, 0) + 1
    return 1.0 if max(counts.values()) >= 2 else 0.25


def _category_diversity_bonus(combo: list[models.ClothingItem]) -> float:
    categories = {_normalize_category(item.category) for item in combo if not _is_accessory(item)}
    if len(categories) >= 4:
        return 1.0
    if len(categories) == 3:
        return 0.85
    if len(categories) == 2:
        return 0.6
    return 0.2


def _item_colors(item: models.ClothingItem) -> list[str]:
    colors = [color.strip().lower() for color in item.colors if color.strip()]
    if colors:
        return colors
    if (item.color or "").strip():
        return [item.color.strip().lower()]
    return []


def _color_harmony_bonus(combo: list[models.ClothingItem]) -> float:
    colors: list[str] = []
    for item in combo:
        colors.extend(_item_colors(item))
    if len(colors) < 2:
        return 0.4
    accent_colors = [color for color in colors if color not in _NEUTRAL_COLORS]
    neutral_count = len(colors) - len(accent_colors)

    if neutral_count == len(colors):
        return 0.75
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
            return 0.9 if neutral_count >= 1 else 0.82
    return 0.5


def _build_combo_explanation(
    *,
    combo: list[models.ClothingItem],
    weather_category: str,
    occasion: str,
    color_bonus: float,
) -> str:
    fingerprint = ",".join(str(item.id) for item in sorted(combo, key=lambda item: item.id))
    template_index = int(sha1(fingerprint.encode("utf-8")).hexdigest(), 16) % len(_EXPLANATION_TEMPLATES)
    color_phrase = (
        "cohesive color harmony"
        if color_bonus >= 0.9
        else "balanced color coordination"
        if color_bonus >= 0.75
        else "a bold color contrast"
    )
    template = _EXPLANATION_TEMPLATES[template_index]
    return template.format(
        weather=weather_category,
        color_phrase=color_phrase,
        occasion=occasion or "daily wear",
    )


def _build_item_explanation(
    item: models.ClothingItem,
    weather_category: str,
    style_target: str,
    comfort_target: int,
    occasion: str,
) -> str:
    comfort_diff = item.comfort_level - comfort_target
    if comfort_diff >= 1:
        comfort_note = "more comfortable than your baseline"
    elif comfort_diff == 0:
        comfort_note = "aligned with your comfort baseline"
    elif comfort_diff == -1:
        comfort_note = "slightly lower comfort than your baseline"
    else:
        comfort_note = "style-forward with lower comfort"

    colors = ", ".join(_item_colors(item)[:2]) or "neutral"
    return (
        f"{item.category} in {colors} supports {style_target} styling, fits {weather_category} weather, "
        f"and is {comfort_note} for {occasion or 'daily use'}."
    )
