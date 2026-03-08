"""Data-access helpers for users, wardrobe items, and outfit workflows."""

import hashlib
import uuid
from datetime import datetime
from typing import Optional

from passlib.context import CryptContext
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import RESET_TOKEN_EXPIRE_MINUTES
from app.weather import map_temperature_to_category

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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

def create_clothing_item(db: Session, item: schemas.ClothingItemCreate, user_id: int):
    db_item = models.ClothingItem(
        name=item.name,
        category=item.category,
        clothing_type=item.clothing_type,
        fit_tag=item.fit_tag,
        color=item.color,
        season=item.season,
        comfort_level=item.comfort_level,
        image_url=item.image_url,
        brand=item.brand,
        is_available=item.is_available,
        is_favorite=item.is_favorite,
        is_archived=item.is_archived,
        last_worn_timestamp=item.last_worn_timestamp,
        owner_id=user_id
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
        query = query.filter(models.ClothingItem.color.ilike(f"%{color.strip()}%"))
    if clothing_type:
        query = query.filter(models.ClothingItem.clothing_type.ilike(f"%{clothing_type.strip()}%"))
    if season:
        query = query.filter(models.ClothingItem.season.ilike(f"%{season.strip()}%"))
    if fit_tag:
        query = query.filter(models.ClothingItem.fit_tag.ilike(f"%{fit_tag.strip()}%"))

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


def get_clothing_item_by_id(db: Session, item_id: int):
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id
    ).first()


def update_clothing_item(
    db: Session,
    db_item: models.ClothingItem,
    updated_data: schemas.ClothingItemUpdate
):
    for field_name, field_value in updated_data.model_dump(exclude_unset=True).items():
        setattr(db_item, field_name, field_value)

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
            item.fit_tag or "",
            item.color or "",
            item.season or "",
            item.brand or "",
        ]
    ).lower()


def _item_matches_exclusions(item: models.ClothingItem, exclusions: list[str]) -> bool:
    if not exclusions:
        return False
    blob = _item_text_blob(item)
    return any(token in blob for token in exclusions)


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

    if any(token in normalized_occasion for token in ["formal", "wedding", "interview", "office", "work"]):
        if any(token in blob for token in ["formal", "tailored", "blazer", "dress", "oxford", "loafer"]):
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
    penalties = 0

    if weather_category == "cold":
        if item_category == "bottom" and any(token in blob for token in ["short", "mini"]):
            penalties += 5
        if item_category == "shoes" and any(token in blob for token in ["sandal", "flip flop"]):
            penalties += 5
        if any(token in blob for token in ["tank", "linen", "lightweight"]):
            penalties += 3
    elif weather_category == "cool":
        if item_category == "outerwear" and any(token in blob for token in ["parka", "heavy", "thick"]):
            penalties += 3
    elif weather_category == "warm":
        if item_category == "outerwear":
            penalties += 5
        if any(token in blob for token in ["heavy", "wool", "thick", "sweater"]):
            penalties += 3
    elif weather_category == "hot":
        if item_category == "outerwear":
            penalties += 8
        if any(token in blob for token in ["jacket", "coat", "sweater", "heavy", "wool"]):
            penalties += 4

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


def get_recommendations_for_user(
    db: Session,
    user: models.User,
    manual_temp: Optional[int] = None,
    weather_category: Optional[str] = None,
    occasion: Optional[str] = None,
    exclude: Optional[str] = None,
):
    normalized_weather = (weather_category or "").strip().lower()
    if normalized_weather not in {"cold", "cool", "mild", "warm", "hot"}:
        normalized_weather = map_temperature_to_category(manual_temp) if manual_temp is not None else "mild"

    exclusions = [
        token.strip().lower()
        for token in (exclude or "").split(",")
        if token.strip()
    ]

    items = get_clothing_items_for_user(db, user.id)
    available = [
        item for item in items
        if item.is_available and not item.is_archived and not _item_matches_exclusions(item, exclusions)
    ]

    by_category: dict[str, list[models.ClothingItem]] = {
        "top": [],
        "bottom": [],
        "shoes": [],
        "outerwear": [],
        "accessory": [],
    }
    for item in available:
        normalized_category = _normalize_category(item.category)
        if normalized_category in by_category:
            by_category[normalized_category].append(item)

    chosen_ids: set[int] = set()
    recommended: list[models.ClothingItem] = []

    for required_category in ["top", "bottom", "shoes"]:
        chosen_item = _choose_best(
            by_category[required_category],
            weather_category=normalized_weather,
            occasion=occasion,
            body_type=user.body_type,
            chosen_ids=chosen_ids,
        )
        if chosen_item:
            chosen_ids.add(chosen_item.id)
            recommended.append(chosen_item)

    if normalized_weather == "cold":
        outerwear_item = _choose_best(
            by_category["outerwear"],
            weather_category=normalized_weather,
            occasion=occasion,
            body_type=user.body_type,
            chosen_ids=chosen_ids,
        )
        if outerwear_item:
            chosen_ids.add(outerwear_item.id)
            recommended.append(outerwear_item)
    elif normalized_weather == "cool":
        outerwear_item = _choose_best(
            by_category["outerwear"],
            weather_category=normalized_weather,
            occasion=occasion,
            body_type=user.body_type,
            chosen_ids=chosen_ids,
        )
        if outerwear_item and _temperature_penalty(outerwear_item, "cool") <= 2:
            chosen_ids.add(outerwear_item.id)
            recommended.append(outerwear_item)

    accessory_candidates = sorted(
        [item for item in by_category["accessory"] if item.id not in chosen_ids],
        key=lambda item: _build_sort_key(
            item,
            weather_category=normalized_weather,
            occasion=occasion,
            body_type=user.body_type,
        ),
    )
    hat_used = False
    for accessory in accessory_candidates:
        if len([item for item in recommended if _normalize_category(item.category) == "accessory"]) >= 3:
            break
        text_blob = _item_text_blob(accessory)
        is_hat = "hat" in text_blob
        if is_hat and hat_used:
            continue
        if is_hat:
            hat_used = True
        chosen_ids.add(accessory.id)
        recommended.append(accessory)

    return recommended


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
