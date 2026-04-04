"""Data-access helpers for users, wardrobe items, and outfit workflows."""

import hashlib
import uuid
from collections import defaultdict
from datetime import datetime
from itertools import combinations
from typing import Optional
from urllib.parse import quote_plus

from passlib.context import CryptContext
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.ai import deterministic, history
from app.config import RESET_TOKEN_EXPIRE_MINUTES
from app.weather import map_temperature_to_category

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
PROMPT_DEFAULT_COOLDOWN_SECONDS = 24 * 60 * 60
PROMPT_IGNORE_COOLDOWN_SECONDS = 72 * 60 * 60


def get_current_season_tag(*, reference_date: Optional[datetime] = None) -> str:
    date = reference_date or datetime.utcnow()
    month = date.month
    if month in {12, 1, 2}:
        return "winter"
    if month in {3, 4, 5}:
        return "spring"
    if month in {6, 7, 8}:
        return "summer"
    return "fall"


def resolve_preferred_seasons(preferred_seasons: Optional[list[str]]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for season in preferred_seasons or []:
        cleaned = season.strip().lower()
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        normalized.append(cleaned)
    if normalized:
        return normalized
    return [get_current_season_tag()]


# =============================
# User CRUD
# =============================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = hash_password(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password
    )
    _apply_default_preferences(db_user)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_or_create_google_user(db: Session, email: str, full_name: Optional[str]):
    existing_user = get_user_by_email(db, email)
    if existing_user:
        if full_name and not existing_user.full_name:
            existing_user.full_name = full_name
            db.commit()
            db.refresh(existing_user)
        return existing_user

    generated_password = uuid.uuid4().hex
    db_user = models.User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(generated_password),
    )
    _apply_default_preferences(db_user)
    db.add(db_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return get_user_by_email(db, email)
    db.refresh(db_user)
    return db_user


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(
        models.User.email == email
    ).first()


def _hash_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_password_reset_token(db: Session, db_user: models.User) -> str:
    token = uuid.uuid4().hex
    expires_at = int(datetime.utcnow().timestamp()) + (RESET_TOKEN_EXPIRE_MINUTES * 60)
    db_user.reset_token_hash = _hash_reset_token(token)
    db_user.reset_token_expires_at = expires_at
    db.commit()
    db.refresh(db_user)
    return token


def get_user_by_reset_token(db: Session, token: str):
    token_hash = _hash_reset_token(token)
    now = int(datetime.utcnow().timestamp())
    return db.query(models.User).filter(
        models.User.reset_token_hash == token_hash,
        models.User.reset_token_expires_at.is_not(None),
        models.User.reset_token_expires_at >= now,
    ).first()


def reset_user_password(db: Session, db_user: models.User, new_password: str):
    db_user.hashed_password = hash_password(new_password)
    db_user.reset_token_hash = None
    db_user.reset_token_expires_at = None
    db.commit()
    db.refresh(db_user)
    return db_user


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _normalize_tag_list(values: Optional[list[str]]) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in values:
        cleaned = str(raw).strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(cleaned)
    return normalized


def _first_or_default(values: list[str], fallback: str) -> str:
    if values:
        return values[0]
    return fallback


def _determine_suggested_clothing_type(
    *,
    category: str,
    clothing_type: Optional[str],
    name: Optional[str],
) -> Optional[str]:
    if clothing_type:
        return _normalize_optional_text(clothing_type)
    blob = f"{name or ''} {category}".lower()
    keyword_to_type = (
        ("blazer", "Blazer"),
        ("hoodie", "Hoodie"),
        ("sweater", "Sweater"),
        ("shirt", "Shirt"),
        ("tee", "T-Shirt"),
        ("tshirt", "T-Shirt"),
        ("jeans", "Jeans"),
        ("shorts", "Shorts"),
        ("boots", "Boots"),
        ("sneakers", "Sneakers"),
        ("sandal", "Sandals"),
        ("coat", "Coat"),
        ("jacket", "Jacket"),
    )
    for token, resolved in keyword_to_type:
        if token in blob:
            return resolved
    normalized_category = _normalize_category(category)
    fallback_map = {
        "top": "Shirt",
        "bottom": "Pants",
        "shoes": "Shoes",
        "outerwear": "Jacket",
        "accessory": "Accessory",
    }
    return fallback_map.get(normalized_category)


def _determine_suggested_fit_tag(*, fit_tag: Optional[str], name: Optional[str]) -> Optional[str]:
    if fit_tag:
        return _normalize_optional_text(fit_tag)
    blob = (name or "").lower()
    if any(token in blob for token in {"oversized", "baggy", "loose"}):
        return "oversized"
    if any(token in blob for token in {"slim", "skinny", "tailored"}):
        return "slim"
    if blob:
        return "regular"
    return None


def _determine_suggested_season_tags(*, season: Optional[str], name: Optional[str], clothing_type: Optional[str]) -> list[str]:
    if season and season.strip() and season.strip().lower() != "all":
        return [season.strip()]
    blob = f"{name or ''} {clothing_type or ''}".lower()
    if any(token in blob for token in {"coat", "jacket", "hoodie", "sweater", "boots"}):
        return ["Winter", "Fall"]
    if any(token in blob for token in {"shorts", "tank", "sandal", "linen"}):
        return ["Summer", "Spring"]
    return []


def _determine_suggested_style_tags(*, name: Optional[str], category: str, clothing_type: Optional[str]) -> list[str]:
    blob = f"{name or ''} {category} {clothing_type or ''}".lower()
    styles: list[str] = []
    if any(token in blob for token in {"blazer", "dress", "formal", "tailored"}):
        styles.append("formal")
    if any(token in blob for token in {"running", "sport", "gym", "athletic", "training"}):
        styles.append("athletic")
    if any(token in blob for token in {"hoodie", "tee", "t-shirt", "jeans", "sneaker", "casual"}):
        styles.append("casual")
    if _normalize_category(category) == "outerwear" and "formal" not in styles:
        styles.append("layered")
    return _normalize_tag_list(styles)


def _determine_suggested_occasion_tags(*, style_tags: list[str]) -> list[str]:
    occasions: list[str] = []
    lowered = {tag.lower() for tag in style_tags}
    if "formal" in lowered:
        occasions.extend(["work", "event"])
    if "athletic" in lowered:
        occasions.extend(["gym"])
    if not occasions:
        occasions.append("daily")
    return _normalize_tag_list(occasions)


def build_tag_suggestions(
    *,
    name: Optional[str],
    category: str,
    clothing_type: Optional[str],
    fit_tag: Optional[str],
    color: str,
    colors: Optional[list[str]],
    season: Optional[str],
) -> dict:
    suggested_clothing_type = _determine_suggested_clothing_type(
        category=category,
        clothing_type=clothing_type,
        name=name,
    )
    suggested_fit_tag = _determine_suggested_fit_tag(fit_tag=fit_tag, name=name)
    suggested_colors = _normalize_tag_list(colors or []) or _normalize_tag_list([color])
    suggested_season_tags = _determine_suggested_season_tags(
        season=season,
        name=name,
        clothing_type=suggested_clothing_type,
    )
    suggested_style_tags = _determine_suggested_style_tags(
        name=name,
        category=category,
        clothing_type=suggested_clothing_type,
    )
    suggested_occasion_tags = _determine_suggested_occasion_tags(style_tags=suggested_style_tags)
    generated = any(
        [
            bool(suggested_clothing_type),
            bool(suggested_fit_tag),
            bool(suggested_colors),
            bool(suggested_season_tags),
            bool(suggested_style_tags),
            bool(suggested_occasion_tags),
        ]
    )
    return {
        "generated": generated,
        "suggested_clothing_type": suggested_clothing_type,
        "suggested_fit_tag": suggested_fit_tag,
        "suggested_colors": suggested_colors,
        "suggested_season_tags": suggested_season_tags,
        "suggested_style_tags": suggested_style_tags,
        "suggested_occasion_tags": suggested_occasion_tags,
    }


def _assign_suggested_tags(db_item: models.ClothingItem, suggestions: dict) -> None:
    db_item.suggested_clothing_type = suggestions.get("suggested_clothing_type")
    db_item.suggested_fit_tag = suggestions.get("suggested_fit_tag")
    db_item.suggested_colors = suggestions.get("suggested_colors", [])
    db_item.suggested_season_tags = suggestions.get("suggested_season_tags", [])
    db_item.suggested_style_tags = suggestions.get("suggested_style_tags", [])
    db_item.suggested_occasion_tags = suggestions.get("suggested_occasion_tags", [])


def _apply_default_preferences(db_user: models.User) -> None:
    db_user.body_type = _normalize_optional_text(db_user.body_type) or schemas.DEFAULT_BODY_TYPE
    db_user.lifestyle = _normalize_optional_text(db_user.lifestyle) or schemas.DEFAULT_LIFESTYLE
    db_user.comfort_preference = (
        _normalize_optional_text(db_user.comfort_preference) or schemas.DEFAULT_COMFORT_PREFERENCE
    )


def build_profile_summary(db: Session, db_user: models.User) -> dict:
    """Return a compact profile summary payload with preference + wardrobe stats."""
    wardrobe_count = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == db_user.id
    ).count()
    active_wardrobe_count = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == db_user.id,
        models.ClothingItem.is_archived.is_(False),
    ).count()
    favorite_count = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == db_user.id,
        models.ClothingItem.is_favorite.is_(True),
        models.ClothingItem.is_archived.is_(False),
    ).count()
    saved_outfit_count = db.query(models.SavedOutfit).filter(
        models.SavedOutfit.owner_id == db_user.id
    ).count()
    planned_outfit_count = db.query(models.PlannedOutfit).filter(
        models.PlannedOutfit.owner_id == db_user.id
    ).count()
    history_count = db.query(models.OutfitHistory).filter(
        models.OutfitHistory.owner_id == db_user.id
    ).count()

    return {
        "id": db_user.id,
        "email": db_user.email,
        "full_name": db_user.full_name,
        "avatar_url": db_user.avatar_url,
        "body_type": db_user.body_type,
        "lifestyle": db_user.lifestyle,
        "comfort_preference": db_user.comfort_preference,
        "onboarding_complete": db_user.onboarding_complete,
        "wardrobe_count": wardrobe_count,
        "active_wardrobe_count": active_wardrobe_count,
        "favorite_count": favorite_count,
        "saved_outfit_count": saved_outfit_count,
        "planned_outfit_count": planned_outfit_count,
        "history_count": history_count,
    }


# =============================
# User Profile Update
# =============================

def update_user_profile(
    db: Session,
    db_user: models.User,
    updated_data: schemas.UserProfileUpdate
):
    if updated_data.body_type is not None:
        db_user.body_type = updated_data.body_type

    if updated_data.lifestyle is not None:
        db_user.lifestyle = updated_data.lifestyle

    if updated_data.comfort_preference is not None:
        db_user.comfort_preference = updated_data.comfort_preference

    if updated_data.onboarding_complete is not None:
        db_user.onboarding_complete = updated_data.onboarding_complete

    _apply_default_preferences(db_user)

    db.commit()
    db.refresh(db_user)

    return db_user


# =============================
# Clothing CRUD
# =============================

WARDROBE_GAP_BASELINE: dict[str, dict[str, object]] = {
    "top": {
        "min_count": 2,
        "item_name": "Everyday top",
        "image_url": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab",
        "shopping_query": "everyday tops",
    },
    "bottom": {
        "min_count": 2,
        "item_name": "Versatile bottoms",
        "image_url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246",
        "shopping_query": "versatile bottoms",
    },
    "shoes": {
        "min_count": 1,
        "item_name": "Daily shoes",
        "image_url": "https://images.unsplash.com/photo-1549298916-b41d501d3772",
        "shopping_query": "daily shoes",
    },
    "outerwear": {
        "min_count": 1,
        "item_name": "Layering jacket",
        "image_url": "https://images.unsplash.com/photo-1544441893-675973e31985",
        "shopping_query": "lightweight jacket",
    },
}


def _build_target_shopping_link(query: str) -> str:
    encoded_query = quote_plus(query.strip())
    return f"https://www.target.com/s?searchTerm={encoded_query}"


def create_clothing_item(db: Session, item: schemas.ClothingItemCreate, user_id: int):
    colors = _normalize_tag_list(item.colors)
    season_tags = _normalize_tag_list(item.season_tags)
    style_tags = _normalize_tag_list(item.style_tags)
    occasion_tags = _normalize_tag_list(item.occasion_tags)
    db_item = models.ClothingItem(
        name=item.name,
        category=item.category,
        clothing_type=item.clothing_type,
        layer_type=item.layer_type,
        is_one_piece=item.is_one_piece,
        set_identifier=item.set_identifier,
        fit_tag=item.fit_tag,
        color=_first_or_default(colors, item.color),
        season=_first_or_default(season_tags, item.season),
        accessory_type=item.accessory_type,
        comfort_level=item.comfort_level,
        image_url=item.image_url,
        brand=item.brand,
        is_available=item.is_available,
        is_favorite=item.is_favorite,
        is_archived=item.is_archived,
        last_worn_timestamp=item.last_worn_timestamp,
        owner_id=user_id
    )
    db_item.colors = colors
    db_item.season_tags = season_tags
    db_item.style_tags = style_tags
    db_item.occasion_tags = occasion_tags
    _assign_suggested_tags(
        db_item,
        build_tag_suggestions(
            name=item.name,
            category=item.category,
            clothing_type=item.clothing_type,
            fit_tag=item.fit_tag,
            color=item.color,
            colors=colors,
            season=item.season,
        ),
    )

    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def bulk_create_clothing_items(
    db: Session,
    user_id: int,
    items: list[schemas.ClothingItemCreate]
) -> list[dict]:
    """Create clothing items in batch, isolating failures per entry."""
    results: list[dict] = []
    for index, item in enumerate(items):
        try:
            created_item = create_clothing_item(db, item, user_id)
            results.append(
                {
                    "index": index,
                    "status": "success",
                    "item": created_item,
                    "error": None,
                }
            )
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            results.append(
                {
                    "index": index,
                    "status": "failed",
                    "item": None,
                    "error": str(exc),
                }
            )
    return results


def get_clothing_items_for_user(
    db: Session,
    user_id: int,
    include_archived: bool = False,
    search: Optional[str] = None,
    category: Optional[str] = None,
    color: Optional[str] = None,
    clothing_type: Optional[str] = None,
    season: Optional[str] = None,
    fit_tag: Optional[str] = None,
    layer_type: Optional[str] = None,
    is_one_piece: Optional[bool] = None,
    set_identifier: Optional[str] = None,
    style_tag: Optional[str] = None,
    season_tag: Optional[str] = None,
    occasion_tag: Optional[str] = None,
    accessory_type: Optional[str] = None,
    favorites_only: bool = False,
):
    query = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
    )
    if not include_archived:
        query = query.filter(models.ClothingItem.is_archived.is_(False))
    if favorites_only:
        query = query.filter(models.ClothingItem.is_favorite.is_(True))

    if category:
        query = query.filter(models.ClothingItem.category.ilike(f"%{category.strip()}%"))
    if color:
        cleaned_color = color.strip()
        query = query.filter(
            or_(
                models.ClothingItem.color.ilike(f"%{cleaned_color}%"),
                models.ClothingItem.colors_json.ilike(f"%{cleaned_color}%"),
            )
        )
    if clothing_type:
        query = query.filter(models.ClothingItem.clothing_type.ilike(f"%{clothing_type.strip()}%"))
    if season:
        cleaned_season = season.strip()
        query = query.filter(
            or_(
                models.ClothingItem.season.ilike(f"%{cleaned_season}%"),
                models.ClothingItem.season_tags_json.ilike(f"%{cleaned_season}%"),
            )
        )
    if fit_tag:
        query = query.filter(models.ClothingItem.fit_tag.ilike(f"%{fit_tag.strip()}%"))
    if layer_type:
        query = query.filter(models.ClothingItem.layer_type.ilike(f"%{layer_type.strip()}%"))
    if is_one_piece is not None:
        query = query.filter(models.ClothingItem.is_one_piece.is_(is_one_piece))
    if set_identifier:
        query = query.filter(models.ClothingItem.set_identifier.ilike(f"%{set_identifier.strip()}%"))
    if style_tag:
        query = query.filter(models.ClothingItem.style_tags_json.ilike(f"%{style_tag.strip()}%"))
    if season_tag:
        query = query.filter(models.ClothingItem.season_tags_json.ilike(f"%{season_tag.strip()}%"))
    if occasion_tag:
        query = query.filter(models.ClothingItem.occasion_tags_json.ilike(f"%{occasion_tag.strip()}%"))
    if accessory_type:
        query = query.filter(models.ClothingItem.accessory_type.ilike(f"%{accessory_type.strip()}%"))

    if search:
        cleaned_search = search.strip()
        query = query.filter(
            or_(
                models.ClothingItem.name.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.category.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.color.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.clothing_type.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.brand.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.fit_tag.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.layer_type.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.set_identifier.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.accessory_type.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.colors_json.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.style_tags_json.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.season_tags_json.ilike(f"%{cleaned_search}%"),
                models.ClothingItem.occasion_tags_json.ilike(f"%{cleaned_search}%"),
            )
        )

    return query.order_by(models.ClothingItem.id.desc()).all()


def get_favorite_items_for_user(db: Session, user_id: int):
    return get_clothing_items_for_user(
        db=db,
        user_id=user_id,
        include_archived=False,
        favorites_only=True,
    )


def get_wardrobe_gap_analysis(db: Session, user_id: int) -> dict:
    items = get_clothing_items_for_user(
        db=db,
        user_id=user_id,
        include_archived=False,
    )
    category_counts = {category: 0 for category in WARDROBE_GAP_BASELINE}

    for item in items:
        normalized_category = _normalize_category(item.category)
        if normalized_category in category_counts:
            category_counts[normalized_category] += 1

    missing_categories: list[str] = []
    suggestions: list[dict] = []
    for category, config in WARDROBE_GAP_BASELINE.items():
        min_count = int(config.get("min_count", 1))
        current_count = category_counts.get(category, 0)
        if current_count >= min_count:
            continue
        missing_categories.append(category)
        item_name = str(config.get("item_name") or f"{category.title()} staple")
        shopping_query = str(config.get("shopping_query") or f"{category} clothing")
        suggestions.append(
            {
                "category": category,
                "item_name": item_name,
                "reason": f"Only {current_count} item(s) found. Target baseline is {min_count}.",
                "image_url": str(config.get("image_url") or "").strip() or None,
                "shopping_link": _build_target_shopping_link(shopping_query),
            }
        )

    insufficient_data = len(items) < 3
    return {
        "baseline_categories": list(WARDROBE_GAP_BASELINE.keys()),
        "category_counts": category_counts,
        "missing_categories": missing_categories,
        "suggestions": suggestions,
        "insufficient_data": insufficient_data,
    }


def _build_similarity_key_for_items(items: list[models.ClothingItem]) -> str:
    components: list[str] = []
    for item in items:
        category = _normalize_category(item.category) or "item"
        clothing_type = (item.clothing_type or "").strip().lower()
        components.append(f"{category}:{clothing_type}")
    return "|".join(sorted(components))


def record_rejected_outfit(
    db: Session,
    *,
    user_id: int,
    item_ids: list[int],
    suggestion_id: Optional[str] = None,
) -> dict:
    normalized_item_ids = sorted({int(item_id) for item_id in item_ids})
    if not normalized_item_ids:
        return {"created": False, "fingerprint": "", "similarity_key": ""}

    items = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
        models.ClothingItem.id.in_(normalized_item_ids),
        models.ClothingItem.is_archived.is_(False),
    ).all()
    item_by_id = {item.id: item for item in items}
    ordered_items = [item_by_id[item_id] for item_id in normalized_item_ids if item_id in item_by_id]
    fingerprint = (suggestion_id or ",".join(str(item_id) for item_id in normalized_item_ids)).strip()
    similarity_key = _build_similarity_key_for_items(ordered_items)

    existing = db.query(models.RejectedOutfit).filter(
        models.RejectedOutfit.owner_id == user_id,
        models.RejectedOutfit.fingerprint == fingerprint,
    ).first()
    if existing:
        return {
            "created": False,
            "fingerprint": existing.fingerprint,
            "similarity_key": existing.similarity_key,
        }

    rejected = models.RejectedOutfit(
        owner_id=user_id,
        fingerprint=fingerprint,
        similarity_key=similarity_key,
        item_ids_csv=",".join(str(item_id) for item_id in normalized_item_ids),
        rejected_at_timestamp=int(datetime.utcnow().timestamp()),
    )
    db.add(rejected)
    db.commit()
    db.refresh(rejected)
    return {
        "created": True,
        "fingerprint": rejected.fingerprint,
        "similarity_key": rejected.similarity_key,
    }


def get_rejected_outfit_filters(db: Session, user_id: int) -> tuple[set[str], set[str]]:
    rows = db.query(models.RejectedOutfit).filter(
        models.RejectedOutfit.owner_id == user_id
    ).all()
    fingerprints = {row.fingerprint for row in rows if row.fingerprint}
    similarity_keys = {row.similarity_key for row in rows if row.similarity_key}
    return fingerprints, similarity_keys


def is_rejected_outfit(
    db: Session,
    *,
    user_id: int,
    items: list[models.ClothingItem],
    fingerprint: str,
) -> bool:
    rejected_fingerprints, rejected_similarity_keys = get_rejected_outfit_filters(db, user_id)
    if fingerprint in rejected_fingerprints:
        return True
    similarity_key = _build_similarity_key_for_items(items)
    return bool(similarity_key and similarity_key in rejected_similarity_keys)


def filter_rejected_candidates_for_user(
    db: Session,
    *,
    user_id: int,
    candidates: list[deterministic.RecommendationCandidate],
    item_map: dict[int, models.ClothingItem],
) -> list[deterministic.RecommendationCandidate]:
    if not candidates:
        return []
    rejected_fingerprints, rejected_similarity_keys = get_rejected_outfit_filters(db, user_id)
    if not rejected_fingerprints and not rejected_similarity_keys:
        return candidates

    preferred: list[deterministic.RecommendationCandidate] = []
    deprioritized: list[deterministic.RecommendationCandidate] = []
    for candidate in candidates:
        if candidate.fingerprint in rejected_fingerprints:
            continue
        candidate_items = [item_map[item_id] for item_id in candidate.item_ids if item_id in item_map]
        similarity_key = _build_similarity_key_for_items(candidate_items)
        if similarity_key and similarity_key in rejected_similarity_keys:
            deprioritized.append(candidate)
        else:
            preferred.append(candidate)
    return preferred + deprioritized


def get_clothing_item_by_id(db: Session, item_id: int):
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id
    ).first()


def regenerate_item_tag_suggestions(db: Session, db_item: models.ClothingItem) -> dict:
    suggestions = build_tag_suggestions(
        name=db_item.name,
        category=db_item.category,
        clothing_type=db_item.clothing_type,
        fit_tag=db_item.fit_tag,
        color=db_item.color,
        colors=db_item.colors,
        season=db_item.season,
    )
    _assign_suggested_tags(db_item, suggestions)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return suggestions


def apply_suggested_tags(db: Session, db_item: models.ClothingItem) -> models.ClothingItem:
    if not db_item.clothing_type and db_item.suggested_clothing_type:
        db_item.clothing_type = db_item.suggested_clothing_type
    if not db_item.fit_tag and db_item.suggested_fit_tag:
        db_item.fit_tag = db_item.suggested_fit_tag
    if not db_item.colors and db_item.suggested_colors:
        db_item.colors = db_item.suggested_colors
        db_item.color = _first_or_default(db_item.suggested_colors, db_item.color)
    existing_season_tags = _normalize_tag_list(db_item.season_tags)
    if (
        db_item.suggested_season_tags
        and (
            not existing_season_tags
            or (len(existing_season_tags) == 1 and existing_season_tags[0].lower() == "all")
        )
    ):
        db_item.season_tags = db_item.suggested_season_tags
        db_item.season = _first_or_default(db_item.suggested_season_tags, db_item.season)
    if not db_item.style_tags and db_item.suggested_style_tags:
        db_item.style_tags = db_item.suggested_style_tags
    if not db_item.occasion_tags and db_item.suggested_occasion_tags:
        db_item.occasion_tags = db_item.suggested_occasion_tags
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def update_clothing_item(
    db: Session,
    db_item: models.ClothingItem,
    updated_data: schemas.ClothingItemUpdate
):
    payload = updated_data.model_dump(exclude_unset=True)
    for field_name, field_value in payload.items():
        if field_name in {"colors", "season_tags", "style_tags", "occasion_tags"}:
            continue
        setattr(db_item, field_name, field_value)

    if "colors" in payload:
        colors = _normalize_tag_list(payload["colors"])
        db_item.colors = colors
        db_item.color = _first_or_default(colors, db_item.color)
    if "season_tags" in payload:
        season_tags = _normalize_tag_list(payload["season_tags"])
        db_item.season_tags = season_tags
        db_item.season = _first_or_default(season_tags, db_item.season)
    if "style_tags" in payload:
        db_item.style_tags = _normalize_tag_list(payload["style_tags"])
    if "occasion_tags" in payload:
        db_item.occasion_tags = _normalize_tag_list(payload["occasion_tags"])

    db.commit()
    db.refresh(db_item)

    return db_item


def set_item_favorite(
    db: Session,
    db_item: models.ClothingItem,
    is_favorite: bool
):
    db_item.is_favorite = is_favorite
    db.commit()
    db.refresh(db_item)
    return db_item


def delete_clothing_item(db: Session, db_item: models.ClothingItem):
    db_item.is_archived = True
    db.add(db_item)
    db.commit()


def _normalize_category(value: Optional[str]) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"top", "tops", "shirt", "t-shirt"}:
        return "top"
    if normalized in {"bottom", "bottoms", "pants", "jeans", "shorts", "skirt"}:
        return "bottom"
    if normalized in {"shoe", "shoes", "sneakers", "boots", "sandals"}:
        return "shoes"
    if normalized in {"outerwear", "jacket", "coat", "hoodie", "sweater"}:
        return "outerwear"
    if normalized in {"accessory", "accessories"}:
        return "accessory"
    return normalized


def _item_text_blob(item: models.ClothingItem) -> str:
    return " ".join(
        [
            item.name or "",
            item.category or "",
            item.clothing_type or "",
            item.layer_type or "",
            item.set_identifier or "",
            item.accessory_type or "",
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


def _item_matches_exclusions(item: models.ClothingItem, exclusions: list[str]) -> bool:
    if not exclusions:
        return False
    blob = _item_text_blob(item)
    return any(token in blob for token in exclusions)


def _tokenize(value: Optional[str]) -> set[str]:
    if not value:
        return set()
    normalized = "".join(char if char.isalnum() else " " for char in value.lower())
    return {token for token in normalized.split() if len(token) >= 2}


def _jaccard_similarity(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    overlap = left & right
    union = left | right
    if not union:
        return 0.0
    return len(overlap) / len(union)


def _duplicate_similarity(item: models.ClothingItem, other: models.ClothingItem) -> tuple[float, list[str]]:
    if _normalize_category(item.category) != _normalize_category(other.category):
        return 0.0, []

    score = 0.0
    reasons: list[str] = ["same category"]

    left_type = (item.clothing_type or "").strip().lower()
    right_type = (other.clothing_type or "").strip().lower()
    if left_type and right_type and left_type == right_type:
        score += 0.22
        reasons.append("matching clothing type")

    left_color = (item.color or "").strip().lower()
    right_color = (other.color or "").strip().lower()
    if left_color and right_color and left_color == right_color:
        score += 0.22
        reasons.append("matching color")

    left_brand = (item.brand or "").strip().lower()
    right_brand = (other.brand or "").strip().lower()
    if left_brand and right_brand and left_brand == right_brand:
        score += 0.12
        reasons.append("matching brand")

    style_overlap = _jaccard_similarity(
        {value.lower() for value in item.style_tags},
        {value.lower() for value in other.style_tags},
    )
    if style_overlap > 0:
        score += 0.15 * style_overlap
        reasons.append("style tags overlap")

    season_overlap = _jaccard_similarity(
        {value.lower() for value in item.season_tags},
        {value.lower() for value in other.season_tags},
    )
    if season_overlap > 0:
        score += 0.12 * season_overlap
        reasons.append("season tags overlap")

    left_tokens = _tokenize(item.name) | _tokenize(item.set_identifier) | _tokenize(item.fit_tag)
    right_tokens = _tokenize(other.name) | _tokenize(other.set_identifier) | _tokenize(other.fit_tag)
    name_similarity = _jaccard_similarity(left_tokens, right_tokens)
    if name_similarity > 0:
        score += 0.17 * name_similarity
        reasons.append("name/details overlap")

    return min(score, 1.0), reasons


def get_duplicate_candidates_for_user(
    db: Session,
    user_id: int,
    *,
    threshold: float = 0.72,
    limit: int = 50,
) -> list[dict]:
    normalized_threshold = max(0.0, min(threshold, 1.0))
    normalized_limit = max(1, min(limit, 200))
    items = get_clothing_items_for_user(
        db=db,
        user_id=user_id,
        include_archived=False,
    )
    grouped: dict[str, list[models.ClothingItem]] = {}
    for item in items:
        grouped.setdefault(_normalize_category(item.category), []).append(item)

    candidates: list[dict] = []
    for group_items in grouped.values():
        for first, second in combinations(group_items, 2):
            score, reasons = _duplicate_similarity(first, second)
            if score < normalized_threshold:
                continue
            item_id, duplicate_item_id = sorted([first.id, second.id])
            candidates.append(
                {
                    "item_id": item_id,
                    "duplicate_item_id": duplicate_item_id,
                    "similarity_score": round(score, 3),
                    "reasons": reasons,
                }
            )

    candidates.sort(
        key=lambda candidate: (
            candidate["similarity_score"],
            -candidate["item_id"],
            -candidate["duplicate_item_id"],
        ),
        reverse=True,
    )
    return candidates[:normalized_limit]


def get_duplicate_candidates_for_item(
    db: Session,
    user_id: int,
    item_id: int,
    *,
    threshold: float = 0.72,
    limit: int = 20,
) -> list[dict]:
    normalized_threshold = max(0.0, min(threshold, 1.0))
    normalized_limit = max(1, min(limit, 100))
    target_item = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
        models.ClothingItem.id == item_id,
        models.ClothingItem.is_archived.is_(False),
    ).first()
    if not target_item:
        return []

    peers = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
        models.ClothingItem.id != item_id,
        models.ClothingItem.is_archived.is_(False),
    ).all()

    candidates: list[dict] = []
    for peer in peers:
        score, reasons = _duplicate_similarity(target_item, peer)
        if score < normalized_threshold:
            continue
        candidates.append(
            {
                "item_id": target_item.id,
                "duplicate_item_id": peer.id,
                "similarity_score": round(score, 3),
                "reasons": reasons,
            }
        )
    candidates.sort(
        key=lambda candidate: (
            candidate["similarity_score"],
            -candidate["duplicate_item_id"],
        ),
        reverse=True,
    )
    return candidates[:normalized_limit]


def _fit_penalty(item: models.ClothingItem, body_type: Optional[str]) -> int:
    fit_tag = (item.fit_tag or "").strip().lower()
    body = (body_type or "").strip().lower()
    if not fit_tag or not body:
        return 0

    if body == "apple" and fit_tag in {"tight", "slim"}:
        return 4
    if body == "pear" and _normalize_category(item.category) == "bottom" and fit_tag in {"tight", "slim"}:
        return 3
    if body == "inverted" and _normalize_category(item.category) == "top" and fit_tag in {"tight", "slim"}:
        return 3
    if body == "hourglass" and fit_tag == "oversized":
        return 2
    return 0


def _occasion_penalty(item: models.ClothingItem, occasion: Optional[str]) -> int:
    normalized_occasion = (occasion or "").strip().lower()
    if not normalized_occasion:
        return 0
    blob = _item_text_blob(item)
    occasion_tags = {tag.lower() for tag in item.occasion_tags}
    if occasion_tags and any(token in occasion_tags for token in normalized_occasion.split()):
        return 0

    if any(token in normalized_occasion for token in ["formal", "wedding", "interview", "office", "work"]):
        if any(token in blob for token in ["formal", "tailored", "blazer", "dress", "oxford", "loafer", "work"]):
            return 0
        return 2
    if any(token in normalized_occasion for token in ["gym", "workout", "sport", "running"]):
        if any(token in blob for token in ["sport", "athletic", "training", "running", "sneaker"]):
            return 0
        return 2
    return 0


def _temperature_penalty(item: models.ClothingItem, weather_category: str) -> int:
    blob = _item_text_blob(item)
    item_category = _normalize_category(item.category)
    season_tags = {value.lower() for value in item.season_tags}
    penalties = 0

    if weather_category == "cold":
        if item_category == "bottom" and any(token in blob for token in ["short", "mini"]):
            penalties += 5
        if item_category == "shoes" and any(token in blob for token in ["sandal", "flip flop"]):
            penalties += 5
        if any(token in blob for token in ["tank", "linen", "lightweight"]):
            penalties += 3
        if "summer" in season_tags:
            penalties += 2
    elif weather_category == "cool":
        if item_category == "outerwear" and any(token in blob for token in ["parka", "heavy", "thick"]):
            penalties += 3
    elif weather_category == "warm":
        if item_category == "outerwear":
            penalties += 5
        if any(token in blob for token in ["heavy", "wool", "thick", "sweater"]):
            penalties += 3
        if "winter" in season_tags:
            penalties += 2
    elif weather_category == "hot":
        if item_category == "outerwear":
            penalties += 8
        if any(token in blob for token in ["jacket", "coat", "sweater", "heavy", "wool"]):
            penalties += 4
        if "winter" in season_tags:
            penalties += 3

    return penalties


def _build_sort_key(
    item: models.ClothingItem,
    *,
    weather_category: str,
    occasion: Optional[str],
    body_type: Optional[str],
):
    last_worn = item.last_worn_timestamp or 0
    # Lower penalties are better; lower last_worn means less recently worn.
    return (
        _temperature_penalty(item, weather_category),
        _occasion_penalty(item, occasion),
        _fit_penalty(item, body_type),
        last_worn,
        item.id,
    )


def _choose_best(
    candidates: list[models.ClothingItem],
    *,
    weather_category: str,
    occasion: Optional[str],
    body_type: Optional[str],
    chosen_ids: set[int],
) -> Optional[models.ClothingItem]:
    available_candidates = [item for item in candidates if item.id not in chosen_ids]
    if not available_candidates:
        return None
    available_candidates.sort(
        key=lambda item: _build_sort_key(
            item,
            weather_category=weather_category,
            occasion=occasion,
            body_type=body_type,
        )
    )
    return available_candidates[0]


def _build_feedback_signals(
    db: Session,
    *,
    user_id: int,
    items: list[models.ClothingItem],
) -> dict:
    favorite_item_ids = {
        item.id
        for item in items
        if item.is_favorite and not item.is_archived
    }
    wear_counts: dict[int, int] = defaultdict(int)
    history_rows = db.query(models.OutfitHistory).filter(
        models.OutfitHistory.owner_id == user_id
    ).order_by(models.OutfitHistory.worn_at_timestamp.desc()).limit(200).all()
    for row in history_rows:
        for raw_item_id in (row.item_ids_csv or "").split(","):
            text = raw_item_id.strip()
            if text.isdigit():
                wear_counts[int(text)] += 1
    return {
        "favorite_item_ids": favorite_item_ids,
        "wear_counts": wear_counts,
    }


def _feedback_adjustment_for_candidate(
    candidate: deterministic.RecommendationCandidate,
    *,
    feedback_signals: dict,
) -> float:
    favorite_item_ids: set[int] = feedback_signals.get("favorite_item_ids", set())
    wear_counts: dict[int, int] = feedback_signals.get("wear_counts", {})
    if not favorite_item_ids and not wear_counts:
        return 0.0

    adjustment = 0.0
    for item_id in candidate.item_ids:
        if item_id in favorite_item_ids:
            adjustment += 0.08
        wear_count = wear_counts.get(item_id, 0)
        if wear_count >= 4:
            adjustment -= 0.12
        elif wear_count >= 2:
            adjustment -= 0.05
    return round(adjustment, 3)


_FEEDBACK_SCORE_DELTA = {
    "like": 0.35,
    "dislike": -0.45,
    "reject": -1.5,
}


def recommendation_feedback_delta(signal: Optional[str]) -> float:
    return _FEEDBACK_SCORE_DELTA.get((signal or "").strip().lower(), 0.0)


def get_recommendation_feedback_signals_for_user(db: Session, user_id: int) -> dict[str, str]:
    entries = db.query(models.RecommendationFeedback).filter(
        models.RecommendationFeedback.owner_id == user_id
    ).all()
    return {
        entry.suggestion_id: entry.signal
        for entry in entries
        if entry.suggestion_id and entry.signal
    }


def rank_candidates_with_feedback(
    candidates: list[deterministic.RecommendationCandidate],
    feedback_signals: dict[str, str],
) -> list[deterministic.RecommendationCandidate]:
    def sort_key(candidate: deterministic.RecommendationCandidate):
        signal = feedback_signals.get(candidate.fingerprint)
        reject_flag = 1 if signal == "reject" else 0
        adjusted_score = candidate.score + recommendation_feedback_delta(signal)
        return (reject_flag, adjusted_score, candidate.score)

    ranked = sorted(candidates, key=sort_key, reverse=True)

    # Keep rejected outfits at the tail when non-rejected options exist.
    preferred = [candidate for candidate in ranked if feedback_signals.get(candidate.fingerprint) != "reject"]
    rejected = [candidate for candidate in ranked if feedback_signals.get(candidate.fingerprint) == "reject"]
    return preferred + rejected


def upsert_recommendation_feedback(
    db: Session,
    *,
    user_id: int,
    suggestion_id: str,
    signal: str,
    item_ids: Optional[list[int]],
) -> tuple[models.RecommendationFeedback, bool]:
    timestamp = int(datetime.utcnow().timestamp())
    entry = db.query(models.RecommendationFeedback).filter(
        models.RecommendationFeedback.owner_id == user_id,
        models.RecommendationFeedback.suggestion_id == suggestion_id,
    ).first()
    created = False
    if entry is None:
        created = True
        entry = models.RecommendationFeedback(
            owner_id=user_id,
            suggestion_id=suggestion_id,
            signal=signal,
            item_ids_csv=",".join(str(item_id) for item_id in (item_ids or [])) or None,
            created_at_timestamp=timestamp,
            updated_at_timestamp=timestamp,
        )
    else:
        entry.signal = signal
        if item_ids is not None:
            entry.item_ids_csv = ",".join(str(item_id) for item_id in item_ids) or None
        entry.updated_at_timestamp = timestamp
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry, created


_INTERACTION_SIGNAL_WEIGHT = {
    "like": 0.45,
    "save": 0.3,
    "wear": 0.0,
    "dislike": -0.55,
    "reject": -0.9,
}


def record_recommendation_interaction(
    db: Session,
    *,
    user_id: int,
    suggestion_id: str,
    signal: str,
    item_ids: Optional[list[int]],
) -> models.RecommendationInteraction:
    timestamp = int(datetime.utcnow().timestamp())
    interaction = models.RecommendationInteraction(
        owner_id=user_id,
        suggestion_id=suggestion_id,
        signal=signal,
        item_ids_csv=",".join(str(item_id) for item_id in (item_ids or [])) or None,
        created_at_timestamp=timestamp,
    )
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return interaction


def _parse_item_ids_csv(raw_value: Optional[str]) -> list[int]:
    if not raw_value:
        return []
    item_ids: list[int] = []
    for token in raw_value.split(","):
        cleaned = token.strip()
        if not cleaned:
            continue
        try:
            parsed = int(cleaned)
        except ValueError:
            continue
        if parsed > 0:
            item_ids.append(parsed)
    return item_ids


def build_personalization_item_weights(db: Session, user_id: int) -> dict[int, float]:
    weights: defaultdict[int, float] = defaultdict(float)

    # Personalization weights are based on explicit interaction events only.
    # Favorite/wear-history signals are already applied by existing feedback logic.
    interactions = db.query(models.RecommendationInteraction).filter(
        models.RecommendationInteraction.owner_id == user_id,
    ).order_by(models.RecommendationInteraction.created_at_timestamp.desc()).limit(250).all()
    for interaction in interactions:
        signal_weight = _INTERACTION_SIGNAL_WEIGHT.get((interaction.signal or "").strip().lower(), 0.0)
        if signal_weight == 0.0:
            continue
        for item_id in _parse_item_ids_csv(interaction.item_ids_csv):
            weights[item_id] += signal_weight

    # Clamp extreme values so sparse/conflicting signals remain stable.
    clamped_weights = {
        item_id: max(-1.2, min(weight, 1.2))
        for item_id, weight in weights.items()
    }
    return clamped_weights


def personalization_adjustment_for_candidate(item_ids: list[int], item_weights: dict[int, float]) -> float:
    if not item_ids or not item_weights:
        return 0.0
    weighted_values = [item_weights.get(item_id, 0.0) for item_id in item_ids]
    if not weighted_values:
        return 0.0
    return sum(weighted_values) / len(weighted_values)


def get_recommendation_options_for_user(
    db: Session,
    user: models.User,
    manual_temp: Optional[int] = None,
    weather_category: Optional[str] = None,
    occasion: Optional[str] = None,
    exclude: Optional[str] = None,
    limit: int = 3,
    preferred_seasons: Optional[list[str]] = None,
) -> list[dict]:
    normalized_limit = max(1, min(limit, 10))
    all_items = get_clothing_items_for_user(db, user.id)
    item_map = {item.id: item for item in all_items}
    recent_fingerprints = set(history.get_recent_fingerprints(db, user.id))
    implicit_feedback_signals = _build_feedback_signals(
        db,
        user_id=user.id,
        items=all_items,
    )
    effective_preferred_seasons = resolve_preferred_seasons(preferred_seasons)
    explicit_feedback_signals = get_recommendation_feedback_signals_for_user(db, user.id)
    personalization_weights = build_personalization_item_weights(db, user.id)

    raw_candidates = deterministic.recommend_many(
        items=all_items,
        user=user,
        manual_temp=manual_temp,
        weather_category=weather_category,
        occasion=occasion,
        exclude=exclude,
        style_preference=user.lifestyle,
        preferred_seasons=effective_preferred_seasons,
        recent_fingerprints=recent_fingerprints,
        max_options=max(normalized_limit, 3),
    )
    candidates = filter_rejected_candidates_for_user(
        db=db,
        user_id=user.id,
        candidates=raw_candidates,
        item_map=item_map,
    )
    candidates = sorted(
        candidates,
        key=lambda candidate: (
            candidate.score
            + _feedback_adjustment_for_candidate(
                candidate,
                feedback_signals=implicit_feedback_signals,
            )
            + personalization_adjustment_for_candidate(candidate.item_ids, personalization_weights)
        ),
        reverse=True,
    )
    candidates = rank_candidates_with_feedback(candidates, explicit_feedback_signals)

    options: list[dict] = []
    seen_fingerprints: set[str] = set()
    for candidate in candidates:
        if candidate.fingerprint in seen_fingerprints:
            continue
        outfit_items = [item_map[item_id] for item_id in candidate.item_ids if item_id in item_map]
        if not outfit_items:
            continue
        seen_fingerprints.add(candidate.fingerprint)
        adjusted_score = candidate.score + _feedback_adjustment_for_candidate(
            candidate,
            feedback_signals=implicit_feedback_signals,
        )
        adjusted_score += personalization_adjustment_for_candidate(
            candidate.item_ids,
            personalization_weights,
        )
        signal = explicit_feedback_signals.get(candidate.fingerprint)
        adjusted_score += recommendation_feedback_delta(signal)
        options.append(
            {
                "items": outfit_items,
                "explanation": candidate.explanation,
                "outfit_score": round(adjusted_score, 3),
                "weather_category": candidate.weather_category,
                "fingerprint": candidate.fingerprint,
            }
        )
        if len(options) >= normalized_limit:
            break
    return options


def get_recommendations_for_user(
    db: Session,
    user: models.User,
    manual_temp: Optional[int] = None,
    weather_category: Optional[str] = None,
    occasion: Optional[str] = None,
    exclude: Optional[str] = None,
):
    options = get_recommendation_options_for_user(
        db=db,
        user=user,
        manual_temp=manual_temp,
        weather_category=weather_category,
        occasion=occasion,
        exclude=exclude,
        limit=1,
    )
    if not options:
        return []
    return options[0]["items"]


def record_feedback_prompt_event(
    db: Session,
    *,
    user_id: int,
    event_type: str,
    suggestion_id: Optional[str] = None,
    event_timestamp: Optional[int] = None,
):
    timestamp = event_timestamp or int(datetime.utcnow().timestamp())
    event = models.FeedbackPromptEvent(
        owner_id=user_id,
        event_type=event_type.strip().lower(),
        suggestion_id=suggestion_id,
        event_timestamp=timestamp,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


def build_feedback_prompt_metadata(
    db: Session,
    *,
    user_id: int,
    now_timestamp: Optional[int] = None,
) -> dict:
    now = now_timestamp or int(datetime.utcnow().timestamp())
    recent_events = db.query(models.FeedbackPromptEvent).filter(
        models.FeedbackPromptEvent.owner_id == user_id
    ).order_by(models.FeedbackPromptEvent.event_timestamp.desc()).limit(20).all()

    last_shown = next((event for event in recent_events if event.event_type == "shown"), None)
    recent_interactions = [event for event in recent_events if event.event_type in {"ignored", "dismissed", "accepted"}]
    recent_ignore_count = sum(1 for event in recent_interactions[:3] if event.event_type in {"ignored", "dismissed"})
    cooldown_seconds = (
        PROMPT_IGNORE_COOLDOWN_SECONDS if recent_ignore_count >= 3 else PROMPT_DEFAULT_COOLDOWN_SECONDS
    )
    if not last_shown:
        return {
            "should_prompt": True,
            "reason": "no_previous_prompt",
            "cooldown_seconds_remaining": 0,
        }

    elapsed = max(0, now - int(last_shown.event_timestamp))
    remaining = max(0, cooldown_seconds - elapsed)
    if remaining > 0:
        reason = "cooldown_after_ignores" if recent_ignore_count >= 3 else "cooldown_active"
        return {
            "should_prompt": False,
            "reason": reason,
            "cooldown_seconds_remaining": remaining,
        }

    return {
        "should_prompt": True,
        "reason": "cadence_due",
        "cooldown_seconds_remaining": 0,
    }


def maybe_record_feedback_prompt_impression(
    db: Session,
    *,
    user_id: int,
    suggestion_id: Optional[str],
) -> dict:
    metadata = build_feedback_prompt_metadata(db, user_id=user_id)
    if metadata["should_prompt"]:
        record_feedback_prompt_event(
            db,
            user_id=user_id,
            event_type="shown",
            suggestion_id=suggestion_id,
        )
    return metadata


def get_underused_clothing_alerts(
    db: Session,
    *,
    user_id: int,
    analysis_window_days: int = 21,
    max_results: int = 20,
    reference_timestamp: Optional[int] = None,
) -> dict:
    now_timestamp = reference_timestamp or int(datetime.utcnow().timestamp())
    window_days = max(1, min(analysis_window_days, 180))
    active_items = get_clothing_items_for_user(
        db=db,
        user_id=user_id,
        include_archived=False,
    )
    wear_counts: dict[int, int] = {}
    latest_worn_by_item: dict[int, int] = {}

    history_entries = get_outfit_history_for_user(db, user_id)
    for entry in history_entries:
        for raw_item_id in (entry.item_ids_csv or "").split(","):
            text = raw_item_id.strip()
            if not text.isdigit():
                continue
            item_id = int(text)
            wear_counts[item_id] = wear_counts.get(item_id, 0) + 1
            previous_latest = latest_worn_by_item.get(item_id, 0)
            latest_worn_by_item[item_id] = max(previous_latest, entry.worn_at_timestamp)

    alerts: list[dict] = []
    for item in active_items:
        wear_count = wear_counts.get(item.id, 0)
        last_worn_timestamp = item.last_worn_timestamp or latest_worn_by_item.get(item.id)
        days_since_worn: Optional[int] = None
        if last_worn_timestamp:
            days_since_worn = max(0, int((now_timestamp - int(last_worn_timestamp)) / 86400))

        is_underused = False
        if wear_count == 0:
            is_underused = True
        elif days_since_worn is None:
            is_underused = True
        elif days_since_worn >= window_days:
            is_underused = True
        elif wear_count == 1 and days_since_worn >= max(7, window_days // 2):
            is_underused = True

        if not is_underused:
            continue

        if days_since_worn is None:
            alert_level = "high"
        elif days_since_worn >= window_days * 2:
            alert_level = "high"
        elif days_since_worn >= window_days:
            alert_level = "medium"
        else:
            alert_level = "low"

        alerts.append(
            {
                "item_id": item.id,
                "item_name": item.name or f"Item {item.id}",
                "category": item.category,
                "wear_count": wear_count,
                "last_worn_timestamp": last_worn_timestamp,
                "days_since_worn": days_since_worn,
                "alert_level": alert_level,
            }
        )

    alerts.sort(
        key=lambda entry: (
            0 if entry["days_since_worn"] is None else -entry["days_since_worn"],
            entry["wear_count"],
            entry["item_id"],
        )
    )
    limited_alerts = alerts[: max(1, min(max_results, 100))]
    return {
        "generated_at_timestamp": now_timestamp,
        "analysis_window_days": window_days,
        "alerts": limited_alerts,
        "insufficient_data": len(active_items) < 3,
    }


def generate_trip_packing_list(
    db: Session,
    *,
    user_id: int,
    destination_city: str,
    start_date: str,
    trip_days: int,
    forecast_days: list[dict],
) -> dict:
    normalized_days = max(1, min(trip_days, 30))
    wardrobe_items = get_clothing_items_for_user(
        db=db,
        user_id=user_id,
        include_archived=False,
    )

    by_category: dict[str, list[models.ClothingItem]] = {
        "top": [],
        "bottom": [],
        "shoes": [],
        "outerwear": [],
        "accessory": [],
    }
    for item in wardrobe_items:
        key = _normalize_category(item.category)
        if key in by_category:
            by_category[key].append(item)

    weather_categories = {str(day.get("weather_category", "")).strip().lower() for day in forecast_days}
    weather_descriptions = " ".join(str(day.get("description", "")).lower() for day in forecast_days)
    needs_outerwear = (
        bool(weather_categories.intersection({"cold", "cool"}))
        or "rain" in weather_descriptions
        or "snow" in weather_descriptions
    )
    recommended_quantities = {
        "top": normalized_days,
        "bottom": max(2, (normalized_days + 1) // 2),
        "shoes": 1 if normalized_days <= 4 else 2,
        "outerwear": 1 if needs_outerwear else 0,
        "accessory": 1 if normalized_days >= 3 else 0,
    }

    items: list[dict] = []
    for category, quantity in recommended_quantities.items():
        if quantity <= 0:
            continue
        available = by_category.get(category, [])
        selected = available[:quantity]
        missing_quantity = max(0, quantity - len(selected))
        items.append(
            {
                "category": category,
                "recommended_quantity": quantity,
                "selected_item_ids": [item.id for item in selected],
                "selected_item_names": [item.name or f"Item {item.id}" for item in selected],
                "missing_quantity": missing_quantity,
            }
        )

    summary_parts = [
        f"{day.get('date')}: {day.get('weather_category')} {day.get('description')}"
        for day in forecast_days[:3]
    ]
    weather_summary = "; ".join(summary_parts) if summary_parts else "Forecast unavailable"
    return {
        "destination_city": destination_city,
        "start_date": start_date,
        "trip_days": normalized_days,
        "weather_summary": weather_summary,
        "items": items,
        "generated_at_timestamp": int(datetime.utcnow().timestamp()),
        "insufficient_data": len(wardrobe_items) < 3,
    }


def save_outfit_history(
    db: Session,
    user_id: int,
    item_ids: list[int],
    worn_at_timestamp: int,
):
    history = models.OutfitHistory(
        owner_id=user_id,
        item_ids_csv=",".join(str(item_id) for item_id in item_ids),
        worn_at_timestamp=worn_at_timestamp,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def get_outfit_history_for_user(db: Session, user_id: int):
    return db.query(models.OutfitHistory).filter(
        models.OutfitHistory.owner_id == user_id
    ).order_by(models.OutfitHistory.worn_at_timestamp.desc()).all()


def get_outfit_history_for_user_in_range(
    db: Session,
    user_id: int,
    start_timestamp: int,
    end_timestamp: int,
):
    # Support both second-based and millisecond-based timestamps.
    start_millis = start_timestamp * 1000
    end_millis = (end_timestamp * 1000) + 999
    return db.query(models.OutfitHistory).filter(
        models.OutfitHistory.owner_id == user_id,
        or_(
            and_(
                models.OutfitHistory.worn_at_timestamp >= start_timestamp,
                models.OutfitHistory.worn_at_timestamp <= end_timestamp,
            ),
            and_(
                models.OutfitHistory.worn_at_timestamp >= start_millis,
                models.OutfitHistory.worn_at_timestamp <= end_millis,
            ),
        ),
    ).order_by(models.OutfitHistory.worn_at_timestamp.desc()).all()


def update_outfit_history_entry(
    db: Session,
    *,
    user_id: int,
    history_id: int,
    item_ids: Optional[list[int]] = None,
    worn_at_timestamp: Optional[int] = None,
) -> Optional[models.OutfitHistory]:
    entry = db.query(models.OutfitHistory).filter(
        models.OutfitHistory.owner_id == user_id,
        models.OutfitHistory.id == history_id,
    ).first()
    if not entry:
        return None
    if item_ids is not None:
        entry.item_ids_csv = ",".join(str(item_id) for item_id in item_ids)
    if worn_at_timestamp is not None:
        entry.worn_at_timestamp = worn_at_timestamp
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def delete_outfit_history_entry(db: Session, *, user_id: int, history_id: int) -> bool:
    deleted = db.query(models.OutfitHistory).filter(
        models.OutfitHistory.owner_id == user_id,
        models.OutfitHistory.id == history_id,
    ).delete()
    db.commit()
    return deleted > 0


def clear_outfit_history_for_user(db: Session, user_id: int):
    db.query(models.OutfitHistory).filter(
        models.OutfitHistory.owner_id == user_id
    ).delete()
    db.commit()


def save_saved_outfit(
    db: Session,
    user_id: int,
    item_ids: list[int],
    saved_at_timestamp: Optional[int] = None,
):
    timestamp = saved_at_timestamp or int(datetime.utcnow().timestamp())
    outfit = models.SavedOutfit(
        owner_id=user_id,
        item_ids_csv=",".join(str(item_id) for item_id in item_ids),
        saved_at_timestamp=timestamp,
    )
    db.add(outfit)
    db.commit()
    db.refresh(outfit)
    return outfit


def get_saved_outfits_for_user(db: Session, user_id: int):
    return db.query(models.SavedOutfit).filter(
        models.SavedOutfit.owner_id == user_id
    ).order_by(models.SavedOutfit.saved_at_timestamp.desc()).all()


def delete_saved_outfit(db: Session, user_id: int, outfit_id: int) -> bool:
    deleted = db.query(models.SavedOutfit).filter(
        models.SavedOutfit.owner_id == user_id,
        models.SavedOutfit.id == outfit_id,
    ).delete()
    db.commit()
    return deleted > 0


def save_planned_outfit(
    db: Session,
    user_id: int,
    item_ids: list[int],
    planned_date: str,
    occasion: Optional[str] = None,
    created_at_timestamp: Optional[int] = None,
):
    timestamp = created_at_timestamp or int(datetime.utcnow().timestamp())
    outfit = models.PlannedOutfit(
        owner_id=user_id,
        item_ids_csv=",".join(str(item_id) for item_id in item_ids),
        planned_date=planned_date,
        occasion=occasion,
        created_at_timestamp=timestamp,
    )
    db.add(outfit)
    db.commit()
    db.refresh(outfit)
    return outfit


def assign_planned_outfit_to_date(
    db: Session,
    user_id: int,
    item_ids: list[int],
    planned_date: str,
    occasion: Optional[str],
    replace_existing: bool,
    created_at_timestamp: Optional[int] = None,
):
    if replace_existing:
        db.query(models.PlannedOutfit).filter(
            models.PlannedOutfit.owner_id == user_id,
            models.PlannedOutfit.planned_date == planned_date,
        ).delete()
        db.commit()
    return save_planned_outfit(
        db=db,
        user_id=user_id,
        item_ids=item_ids,
        planned_date=planned_date,
        occasion=occasion,
        created_at_timestamp=created_at_timestamp,
    )


def get_planned_outfits_for_user(db: Session, user_id: int):
    return db.query(models.PlannedOutfit).filter(
        models.PlannedOutfit.owner_id == user_id
    ).order_by(models.PlannedOutfit.planned_date.asc()).all()


def delete_planned_outfit(db: Session, user_id: int, outfit_id: int) -> bool:
    deleted = db.query(models.PlannedOutfit).filter(
        models.PlannedOutfit.owner_id == user_id,
        models.PlannedOutfit.id == outfit_id,
    ).delete()
    db.commit()
    return deleted > 0
