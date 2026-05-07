"""Deterministic recommendation engine used for legacy and AI fallback flows."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from hashlib import sha1
from itertools import count
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
_GROUNDING_COLORS = {
    "olive",
    "sage",
    "green",
    "teal",
    "beige",
    "camel",
    "tan",
    "khaki",
    "brown",
    "rust",
    "terracotta",
    "burgundy",
    "maroon",
    "cream",
    "ivory",
}
_CONTROLLED_CREATIVE_COLORS = {
    "olive",
    "sage",
    "teal",
    "green",
    "khaki",
    "beige",
    "camel",
    "tan",
    "rust",
    "terracotta",
    "burgundy",
    "maroon",
}
_CREATIVE_COLOR_REASON_TEMPLATES = (
    "this one is a bit more styled than usual, and the {first} with {second} still feels easy to wear",
    "the {first} and {second} mix leans a little more into style without feeling like too much",
    "the {first} and {second} pairing keeps it clean, just with a little extra edge",
    "this is not the safest combo, but the {first} and {second} really work together",
    "it starts from a simple base, and the {first} with {second} gives it more character",
    "the {first} and {second} pull it slightly past basic, but it still looks grounded",
)
_CREATIVE_TEXT_LABELS = ("", "Slightly styled", "Clean but elevated")
_REASONING_MODES = ("direct_stylist", "casual", "opinionated", "observational", "minimal")
_EXPLANATION_VARIATION_SEQUENCE = count()


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
    time_context: Optional[str],
    exclude: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: Optional[list[str]],
    recent_fingerprints: list[str],
    max_options: int = 3,
) -> list[RecommendationCandidate]:
    """Returns ranked deterministic options while avoiding recent repeats when possible."""
    normalized_weather = normalize_weather_category(weather_category, manual_temp)
    eligible_items = _filter_eligible_items(items=items, exclude=exclude)
    combos = _build_candidate_combos(eligible_items, normalized_weather)
    item_map = {item.id: item for item in items}
    recent_combos = _recent_combos_from_fingerprints(recent_fingerprints, item_map)
    wardrobe_limitation = _wardrobe_limitation_note(eligible_items, combos)

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
                time_context=time_context,
                style_preference=style_preference,
                preferred_seasons=preferred_seasons,
                recent_combos=recent_combos,
                wardrobe_limitation=wardrobe_limitation,
            )
            for combo in combos
        ),
        key=lambda candidate: candidate.score,
        reverse=True,
    )

    recent_fingerprint_set = set(recent_fingerprints)
    preferred = [candidate for candidate in ranked if candidate.fingerprint not in recent_fingerprint_set]
    fallback = [candidate for candidate in ranked if candidate.fingerprint in recent_fingerprint_set]
    merged = preferred + fallback
    return merged[: max(1, min(max_options, 10))]


def recommend(
    *,
    items: list[models.ClothingItem],
    user: models.User,
    manual_temp: Optional[int],
    weather_category: Optional[str],
    occasion: Optional[str],
    time_context: Optional[str],
    exclude: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: Optional[list[str]],
    recent_fingerprints: list[str],
) -> RecommendationCandidate:
    """Returns the best deterministic candidate."""
    return recommend_many(
        items=items,
        user=user,
        manual_temp=manual_temp,
        weather_category=weather_category,
        occasion=occasion,
        time_context=time_context,
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
    time_context: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: Optional[list[str]],
) -> RecommendationCandidate:
    """Scores and explains an existing combo using the same deterministic rubric."""
    return _score_candidate(
        combo=combo,
        user=user,
        weather_category=weather_category,
        occasion=occasion,
        time_context=time_context,
        style_preference=style_preference,
        preferred_seasons=preferred_seasons,
        recent_combos=[],
        wardrobe_limitation=None,
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
    time_context: Optional[str],
    style_preference: Optional[str],
    preferred_seasons: Optional[list[str]],
    recent_combos: list[list[models.ClothingItem]],
    wardrobe_limitation: Optional[str],
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
    novelty_bonus = _novelty_bonus(combo, recent_combos)
    creativity_bonus = _controlled_creativity_bonus(
        combo=combo,
        weather_category=weather_category,
        occasion=occasion_text,
        color_bonus=color_bonus,
    )
    repeat_penalty = _repeat_penalty(combo, recent_combos)
    temp_penalty = sum(_temperature_penalty(item, weather_category) for item in combo) / len(combo)

    score = (
        (avg_item_score * 0.52)
        + (color_bonus * 0.16)
        + (diversity_bonus * 0.10)
        + (structure_bonus * 0.10)
        + (set_bonus * 0.08)
        + (novelty_bonus * 0.10)
        + (creativity_bonus * 0.08)
        - (temp_penalty * 0.12)
        - (repeat_penalty * 0.16)
    )
    explanation = _build_combo_explanation(
        combo=combo,
        weather_category=weather_category,
        occasion=occasion_text,
        time_context=time_context,
        color_bonus=color_bonus,
        creativity_bonus=creativity_bonus,
        wardrobe_limitation=wardrobe_limitation,
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
    if style_target in {"casual", "layered", "streetwear", "smart casual", "everyday"} and "formal" in styles:
        return 0.4
    return 0.7


def _occasion_score(item: models.ClothingItem, occasion: str) -> float:
    occasion_values = _occasion_values(item)
    if not occasion:
        return 0.7
    if not occasion_values:
        blob = f"{item.name or ''} {item.clothing_type or ''}".lower()
        formal_item = any(token in blob for token in {"blazer", "dress shirt", "oxford shirt", "slacks", "trousers", "loafer"})
        casual_occasion = any(token in occasion for token in {"casual", "campus", "class", "daily", "weekend", "errand"})
        if formal_item and casual_occasion:
            return 0.35
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


def _controlled_creativity_bonus(
    *,
    combo: list[models.ClothingItem],
    weather_category: str,
    occasion: str,
    color_bonus: float,
) -> float:
    if color_bonus < 0.82:
        return 0.0

    unique_colors = _unique_combo_colors(combo)
    if len(unique_colors) < 2:
        return 0.0

    accent_colors = [color for color in unique_colors if color not in _NEUTRAL_COLORS]
    if not accent_colors or len(accent_colors) > 2:
        return 0.0

    grounded_colors = [color for color in unique_colors if color in _GROUNDING_COLORS]
    if not grounded_colors:
        return 0.0

    neutral_count = sum(1 for color in unique_colors if color in _NEUTRAL_COLORS)
    if neutral_count == 0:
        return 0.0

    controlled_colors = [color for color in unique_colors if color in _CONTROLLED_CREATIVE_COLORS]
    if not controlled_colors:
        return 0.0

    if weather_category == "cold" and any(color in {"cream", "ivory", "beige"} for color in unique_colors):
        weather_fit_bonus = 0.08
    elif weather_category in {"mild", "warm"} and any(color in {"olive", "sage", "khaki", "tan"} for color in unique_colors):
        weather_fit_bonus = 0.08
    else:
        weather_fit_bonus = 0.0

    occasion_bonus = 0.08 if occasion in {"daily", "casual", "social", "weekend"} else 0.0
    accent_bonus = 0.12 if len(accent_colors) == 1 else 0.06
    grounding_bonus = 0.16 if any(color in {"olive", "sage", "beige", "camel", "khaki", "tan"} for color in grounded_colors) else 0.08
    paired_bonus = 0.1 if len(controlled_colors) >= 2 else 0.0
    return min(0.58, grounding_bonus + accent_bonus + weather_fit_bonus + occasion_bonus + paired_bonus)


def _recent_combos_from_fingerprints(
    recent_fingerprints: list[str],
    item_map: dict[int, models.ClothingItem],
) -> list[list[models.ClothingItem]]:
    recent_combos: list[list[models.ClothingItem]] = []
    for fingerprint in recent_fingerprints:
        item_ids = []
        for token in fingerprint.split(","):
            cleaned = token.strip()
            if not cleaned:
                continue
            try:
                item_ids.append(int(cleaned))
            except ValueError:
                continue
        combo = [item_map[item_id] for item_id in item_ids if item_id in item_map]
        if combo:
            recent_combos.append(combo)
    return recent_combos


def _core_combo_items(combo: list[models.ClothingItem]) -> list[models.ClothingItem]:
    return [item for item in combo if not _is_accessory(item)]


def _unique_combo_colors(combo: list[models.ClothingItem]) -> list[str]:
    unique_colors: list[str] = []
    for item in combo:
        for color in _item_colors(item):
            if color not in unique_colors:
                unique_colors.append(color)
    return unique_colors


def _anchor_items(combo: list[models.ClothingItem]) -> list[models.ClothingItem]:
    anchors = [item for item in combo if _normalize_category(item.category) == "top"]
    if anchors:
        return anchors
    one_pieces = [item for item in combo if _is_one_piece(item)]
    if one_pieces:
        return one_pieces
    return _core_combo_items(combo)[:1]


def _style_palette(items: list[models.ClothingItem]) -> set[str]:
    palette: set[str] = set()
    for item in items:
        palette.update(_style_values(item))
    return palette


def _novelty_bonus(combo: list[models.ClothingItem], recent_combos: list[list[models.ClothingItem]]) -> float:
    if not recent_combos:
        return 0.0

    candidate_anchor_items = _anchor_items(combo)
    candidate_anchor_colors = {color for item in candidate_anchor_items for color in _item_colors(item)}
    candidate_anchor_styles = _style_palette(candidate_anchor_items)
    candidate_core_ids = {item.id for item in _core_combo_items(combo)}
    latest_combo = recent_combos[0]
    latest_core_ids = {item.id for item in _core_combo_items(latest_combo)}
    latest_anchor_items = _anchor_items(latest_combo)
    latest_anchor_colors = {color for item in latest_anchor_items for color in _item_colors(item)}
    latest_anchor_styles = _style_palette(latest_anchor_items)

    bonus = 0.0
    if candidate_anchor_colors and candidate_anchor_colors.isdisjoint(latest_anchor_colors):
        bonus += 0.65
    if candidate_anchor_styles and candidate_anchor_styles.isdisjoint(latest_anchor_styles):
        bonus += 0.45
    if len(candidate_core_ids - latest_core_ids) >= 2:
        bonus += 0.35
    return min(bonus, 1.2)


def _repeat_penalty(combo: list[models.ClothingItem], recent_combos: list[list[models.ClothingItem]]) -> float:
    if not recent_combos:
        return 0.0

    candidate_core_ids = {item.id for item in _core_combo_items(combo)}
    candidate_anchor_ids = {item.id for item in _anchor_items(combo)}
    if not candidate_core_ids:
        return 0.0

    penalty = 0.0
    for index, recent_combo in enumerate(recent_combos[:5]):
        recent_core_ids = {item.id for item in _core_combo_items(recent_combo)}
        if not recent_core_ids:
            continue
        recency_weight = max(0.35, 1 - (index * 0.16))
        if candidate_core_ids == recent_core_ids:
            penalty += 1.6 * recency_weight
            continue
        overlap = len(candidate_core_ids.intersection(recent_core_ids)) / len(candidate_core_ids.union(recent_core_ids))
        penalty += overlap * 0.45 * recency_weight
        if candidate_anchor_ids.intersection(recent_core_ids):
            penalty += 0.6 * recency_weight
    return min(penalty, 2.2)


def _wardrobe_limitation_note(
    eligible_items: list[models.ClothingItem],
    combos: list[list[models.ClothingItem]],
) -> Optional[str]:
    category_counts = Counter(_normalize_category(item.category) for item in eligible_items if item.category)
    top_count = category_counts.get("top", 0) + category_counts.get("one_piece", 0)
    bottom_count = category_counts.get("bottom", 0)
    shoes_count = category_counts.get("shoes", 0)
    distinct_core_colors = {
        color
        for item in eligible_items
        if _normalize_category(item.category) in {"top", "bottom", "shoes", "outerwear"} or _is_one_piece(item)
        for color in _item_colors(item)
    }
    if top_count <= 1 or bottom_count <= 1 or shoes_count <= 1:
        return "Your wardrobe options are a little tight here, so I kept the recommendation practical."
    if len(combos) <= 2 or len(distinct_core_colors) <= 2:
        return "There is not a lot of rotation in this part of your wardrobe yet, so I leaned on the strongest mix."
    return None


def _build_combo_explanation(
    *,
    combo: list[models.ClothingItem],
    weather_category: str,
    occasion: str,
    time_context: Optional[str],
    color_bonus: float,
    creativity_bonus: float,
    wardrobe_limitation: Optional[str],
) -> str:
    fingerprint = ",".join(str(item.id) for item in sorted(combo, key=lambda item: item.id))
    variation_seed = next(_EXPLANATION_VARIATION_SEQUENCE)
    reasoning_mode = _REASONING_MODES[_seeded_index(fingerprint, variation_seed, len(_REASONING_MODES))]
    weather_reason = _weather_reason(combo, weather_category)
    color_reason = _color_reason(combo, color_bonus, creativity_bonus, variation_seed)
    occasion_reason = _occasion_reason(occasion, time_context)
    creativity_label = _creativity_label(fingerprint, creativity_bonus, variation_seed)
    explanation = _render_reasoning_mode(
        mode=reasoning_mode,
        weather_reason=weather_reason,
        color_reason=color_reason,
        occasion_reason=occasion_reason,
    )
    if creativity_label:
        explanation = f"{creativity_label}: {explanation}"
    if wardrobe_limitation:
        explanation = f"{explanation} {wardrobe_limitation}"
    return explanation


def _seeded_index(fingerprint: str, variation_seed: int, size: int) -> int:
    if size <= 0:
        return 0
    keyed = f"{fingerprint}:{variation_seed}"
    return int(sha1(keyed.encode("utf-8")).hexdigest(), 16) % size


def _capitalize_reason(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return cleaned
    return cleaned[0].upper() + cleaned[1:]


def _render_reasoning_mode(
    *,
    mode: str,
    weather_reason: str,
    color_reason: str,
    occasion_reason: str,
) -> str:
    if mode == "direct_stylist":
        return f"I’d go with this for {occasion_reason} because it is right for {weather_reason}, and {color_reason}."
    if mode == "casual":
        return (
            f"This would work really well for {occasion_reason}. "
            f"It stays right for {weather_reason}, and {color_reason}."
        )
    if mode == "opinionated":
        return (
            f"Honestly, this combo just works for {occasion_reason}. "
            f"It is right for {weather_reason}, and {color_reason}."
        )
    if mode == "observational":
        return (
            f"This one feels balanced for {occasion_reason}. "
            f"It is right for {weather_reason}, and {color_reason}."
        )
    return (
        f"Simple, clean, right for {weather_reason}. "
        f"{_capitalize_reason(color_reason)}. "
        f"Works for {occasion_reason}."
    )


def _weather_reason(combo: list[models.ClothingItem], weather_category: str) -> str:
    core_blob = " ".join(
        f"{item.name or ''} {item.clothing_type or ''} {item.category or ''}".lower()
        for item in combo
    )
    if weather_category == "hot":
        return "hot weather because the layers stay light and breathable"
    if weather_category == "warm":
        return "warm weather because it stays light without feeling too bare"
    if weather_category == "cool":
        return "cool weather because it keeps a little coverage without getting heavy"
    if weather_category == "cold":
        if "coat" in core_blob or "jacket" in core_blob or "sweater" in core_blob:
            return "cold weather because the extra layer keeps the outfit grounded"
        return "cold weather because it keeps more coverage in the mix"
    return "mild weather because the layering stays easy"


def _color_reason(
    combo: list[models.ClothingItem],
    color_bonus: float,
    creativity_bonus: float,
    variation_seed: int,
) -> str:
    featured = _unique_combo_colors(combo)[:3]
    if not featured:
        return "the color balance stays clean and easy"
    if len(featured) == 1:
        return f"the {featured[0]} color keeps everything clean"
    if creativity_bonus >= 0.3:
        first = featured[0]
        second = featured[1] if len(featured) > 1 else featured[0]
        template = _CREATIVE_COLOR_REASON_TEMPLATES[
            _seeded_index(",".join(featured), variation_seed, len(_CREATIVE_COLOR_REASON_TEMPLATES))
        ]
        return template.format(first=first, second=second)
    if color_bonus >= 0.9:
        return f"the {featured[0]} and {featured[1]} colors work well together"
    if color_bonus >= 0.75:
        return f"the {', '.join(featured[:-1])} and {featured[-1]} color mix stays balanced"
    return f"the color contrast between {featured[0]} and {featured[1]} gives it some life"


def _creativity_label(fingerprint: str, creativity_bonus: float, variation_seed: int) -> str:
    if creativity_bonus < 0.3:
        return ""
    return _CREATIVE_TEXT_LABELS[_seeded_index(fingerprint, variation_seed + 7, len(_CREATIVE_TEXT_LABELS))]


def _occasion_reason(occasion: str, time_context: Optional[str]) -> str:
    cleaned_occasion = (occasion or "daily wear").strip().lower()
    cleaned_time_context = (time_context or "").strip().lower()
    time_phrase = (
        f"an {cleaned_time_context} plan"
        if cleaned_time_context.startswith(("a", "e", "i", "o", "u"))
        else f"a {cleaned_time_context} plan"
    ) if cleaned_time_context else ""
    if cleaned_time_context and cleaned_occasion and cleaned_occasion not in {"daily", "daily wear"}:
        return f"{cleaned_occasion} and {time_phrase}"
    if cleaned_time_context:
        return time_phrase
    return cleaned_occasion or "daily wear"


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
