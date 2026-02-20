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
        name=item.name,
        category=item.category,
        color=item.color,
        image_url=item.image_url,
        owner_id=user_id
    )

    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def get_clothing_items_for_user(db: Session, user_id: int):
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id
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
    db_item.name = updated_data.name
    db_item.category = updated_data.category
    db_item.color = updated_data.color
    db_item.image_url = updated_data.image_url

    db.commit()
    db.refresh(db_item)

    return db_item


def delete_clothing_item(db: Session, db_item: models.ClothingItem):
    db.delete(db_item)
    db.commit()
