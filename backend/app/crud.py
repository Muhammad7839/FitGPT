"""Data-access helpers for users, wardrobe items, and outfit history."""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app import models, schemas
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hash a plaintext password for database storage."""
    return pwd_context.hash(password)


def create_user(db: Session, user: schemas.UserCreate):
    """Persist a new user record."""
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
    """Return existing user by email or create one for first-time Google login."""
    existing_user = get_user_by_email(db, email)
    if existing_user:
        if full_name and not existing_user.full_name:
            existing_user.full_name = full_name
            db.commit()
            db.refresh(existing_user)
        return existing_user

    # Google accounts have no local password; store a random hash to satisfy schema.
    generated_password = uuid.uuid4().hex
    new_user = models.User(
        email=email,
        full_name=full_name,
        hashed_password=hash_password(generated_password),
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return get_user_by_email(db, email)
    db.refresh(new_user)
    return new_user


def get_user_by_email(db: Session, email: str):
    """Return user by email, or None when not found."""
    return db.query(models.User).filter(
        models.User.email == email
    ).first()

def update_user_profile(
    db: Session,
    db_user: models.User,
    updated_data: schemas.UserProfileUpdate
):
    """Apply profile updates to the current user."""
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


def create_clothing_item(db: Session, item: schemas.ClothingItemCreate, user_id: int):
    """Create a wardrobe item owned by a specific user."""
    db_item = models.ClothingItem(
        category=item.category,
        color=item.color,
        season=item.season,
        comfort_level=item.comfort_level,
        image_url=item.image_url,
        brand=item.brand,
        is_available=item.is_available,
        is_archived=item.is_archived,
        last_worn_timestamp=item.last_worn_timestamp,
        owner_id=user_id
    )

    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def get_clothing_items_for_user(db: Session, user_id: int):
    """List active wardrobe items for a user."""
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
        models.ClothingItem.is_archived.is_(False)
    ).all()


def get_clothing_item_by_id(db: Session, item_id: int):
    """Get a wardrobe item by its primary key."""
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id
    ).first()


def update_clothing_item(
    db: Session,
    db_item: models.ClothingItem,
    updated_data: schemas.ClothingItemUpdate
):
    """Update an existing wardrobe item with partial fields from UI edits."""
    for field_name, field_value in updated_data.model_dump(exclude_unset=True).items():
        setattr(db_item, field_name, field_value)

    db.commit()
    db.refresh(db_item)

    return db_item


def delete_clothing_item(db: Session, db_item: models.ClothingItem):
    """Soft-delete an item by marking it archived."""
    db_item.is_archived = True
    db.add(db_item)
    db.commit()


def get_recommendations_for_user(
    db: Session,
    user_id: int,
):
    """Build a simple outfit recommendation from available wardrobe items."""
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
    """Store a worn-outfit history record."""
    history = models.OutfitHistory(
        owner_id=user_id,
        item_ids_csv=",".join(str(item_id) for item_id in item_ids),
        worn_at_timestamp=worn_at_timestamp,
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


def save_saved_outfit(
    db: Session,
    user_id: int,
    item_ids: list[int],
    saved_at_timestamp: Optional[int] = None,
):
    """Persist a saved outfit row for the given user."""
    timestamp = saved_at_timestamp or int(datetime.utcnow().timestamp())
    saved_outfit = models.SavedOutfit(
        owner_id=user_id,
        item_ids_csv=",".join(str(item_id) for item_id in item_ids),
        saved_at_timestamp=timestamp,
    )
    db.add(saved_outfit)
    db.commit()
    db.refresh(saved_outfit)
    return saved_outfit


def get_saved_outfits_for_user(db: Session, user_id: int):
    """Return saved outfits ordered by most recent first."""
    return db.query(models.SavedOutfit).filter(
        models.SavedOutfit.owner_id == user_id
    ).order_by(models.SavedOutfit.saved_at_timestamp.desc()).all()
