from sqlalchemy.orm import Session
from app import models, schemas
from passlib.context import CryptContext

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


def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(
        models.User.email == email
    ).first()


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
        is_archived=item.is_archived,
        last_worn_timestamp=item.last_worn_timestamp,
        owner_id=user_id
    )

    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def get_clothing_items_for_user(db: Session, user_id: int):
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
        models.ClothingItem.is_archived == False  # noqa: E712
    ).all()


def get_clothing_item_by_id(db: Session, item_id: int):
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id
    ).first()


def update_clothing_item(
    db: Session,
    db_item: models.ClothingItem,
    updated_data: schemas.ClothingItemCreate
):
    db_item.category = updated_data.category
    db_item.color = updated_data.color
    db_item.season = updated_data.season
    db_item.comfort_level = updated_data.comfort_level
    db_item.image_url = updated_data.image_url
    db_item.brand = updated_data.brand
    db_item.is_available = updated_data.is_available
    db_item.is_archived = updated_data.is_archived
    db_item.last_worn_timestamp = updated_data.last_worn_timestamp

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
