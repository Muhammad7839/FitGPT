"""Data-access helpers for users, wardrobe items, and outfit workflows."""

import uuid
import hashlib
from datetime import datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app import models, schemas
from passlib.context import CryptContext
from app.config import RESET_TOKEN_EXPIRE_MINUTES

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

    db.commit()
    db.refresh(db_user)

    return db_user


# =============================
# Clothing CRUD
# =============================

def create_clothing_item(db: Session, item: schemas.ClothingItemCreate, user_id: int):
    db_item = models.ClothingItem(
        category=item.category,
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


def get_clothing_items_for_user(db: Session, user_id: int, include_archived: bool = False):
    query = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
    )
    if not include_archived:
        query = query.filter(models.ClothingItem.is_archived.is_(False))
    return query.all()


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


def delete_clothing_item(db: Session, db_item: models.ClothingItem):
    db_item.is_archived = True
    db.add(db_item)
    db.commit()


def get_recommendations_for_user(
    db: Session,
    user_id: int,
):
    items = get_clothing_items_for_user(db, user_id)
    available = [
        item for item in items
        if item.is_available and not item.is_archived
    ]
    available.sort(key=lambda item: item.last_worn_timestamp or 0)

    tops = [item for item in available if item.category.lower() == "top"]
    bottoms = [item for item in available if item.category.lower() == "bottom"]
    shoes = [item for item in available if item.category.lower() == "shoes"]

    recommended = []
    if tops:
        recommended.append(tops[0])
    if bottoms:
        recommended.append(bottoms[0])
    if shoes:
        recommended.append(shoes[0])

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
