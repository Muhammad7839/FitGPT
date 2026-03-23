import json
from datetime import datetime
from sqlalchemy.orm import Session
from app import models, schemas
from app.auth import hash_password


# =============================
# User CRUD
# =============================


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


def get_user_by_google_id(db: Session, google_id: str):
    return db.query(models.User).filter(
        models.User.google_id == google_id
    ).first()


def create_google_user(db: Session, email: str, google_id: str):
    db_user = models.User(
        email=email,
        google_id=google_id,
        auth_provider="google",
        hashed_password=None,
    )
    db.add(db_user)
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
        name=item.name,
        category=item.category,
        color=item.color,
        fit_type=item.fit_type,
        style_tag=item.style_tag,
        image_url=item.image_url,
        is_active=True,
        is_favorite=False,
        owner_id=user_id
    )

    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    return db_item


def get_clothing_items_for_user(db: Session, user_id: int):
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
        models.ClothingItem.is_deleted == False
    ).all()


def get_clothing_item_by_id(db: Session, item_id: int):
    return db.query(models.ClothingItem).filter(
        models.ClothingItem.id == item_id
    ).first()


def update_clothing_item(
    db: Session,
    db_item: models.ClothingItem,
    updated_data: schemas.ClothingItemUpdate
):
    if updated_data.name is not None:
        db_item.name = updated_data.name
    if updated_data.category is not None:
        db_item.category = updated_data.category
    if updated_data.color is not None:
        db_item.color = updated_data.color
    if updated_data.fit_type is not None:
        db_item.fit_type = updated_data.fit_type
    if updated_data.style_tag is not None:
        db_item.style_tag = updated_data.style_tag
    if updated_data.image_url is not None:
        db_item.image_url = updated_data.image_url
    if updated_data.is_active is not None:
        db_item.is_active = updated_data.is_active
    if updated_data.is_favorite is not None:
        db_item.is_favorite = updated_data.is_favorite

    db.commit()
    db.refresh(db_item)

    return db_item


def delete_clothing_item(db: Session, db_item: models.ClothingItem):
    db_item.is_deleted = True
    db.commit()

def _json_loads(raw, fallback):
    try:
        return json.loads(raw) if raw else fallback
    except Exception:
        return fallback


def _saved_outfit_to_dict(row: models.SavedOutfit):
    return {
        "saved_outfit_id": str(row.id),
        "user_id": str(row.owner_id),
        "name": row.name or "",
        "items": _json_loads(row.items_json, []),
        "item_details": _json_loads(row.item_details_json, []),
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "source": row.source or "recommended",
        "context": _json_loads(row.context_json, {}),
        "notes": row.notes or "",
        "outfit_signature": row.outfit_signature or "",
    }


def list_saved_outfits(db: Session, user_id: int):
    rows = db.query(models.SavedOutfit).filter(models.SavedOutfit.owner_id == user_id).order_by(models.SavedOutfit.created_at.desc()).all()
    return [_saved_outfit_to_dict(row) for row in rows]


def get_saved_outfit_by_signature(db: Session, user_id: int, signature: str):
    return db.query(models.SavedOutfit).filter(models.SavedOutfit.owner_id == user_id, models.SavedOutfit.outfit_signature == signature).first()


def create_saved_outfit(db: Session, user_id: int, payload: schemas.SavedOutfitCreate, signature: str):
    row = models.SavedOutfit(
        owner_id=user_id,
        outfit_signature=signature,
        name=payload.name or "",
        items_json=json.dumps(payload.items),
        item_details_json=json.dumps(payload.item_details or []),
        source=payload.source or "recommended",
        context_json=json.dumps(payload.context or {}),
        notes=payload.notes or "",
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _saved_outfit_to_dict(row)


def delete_saved_outfit(db: Session, row: models.SavedOutfit):
    db.delete(row)
    db.commit()


def _history_entry_to_dict(row: models.OutfitHistoryEntry):
    return {
        "history_id": str(row.id),
        "user_id": str(row.owner_id),
        "item_ids": _json_loads(row.item_ids_json, []),
        "worn_at": row.worn_at.isoformat() if row.worn_at else "",
        "source": row.source or "recommendation",
        "context": _json_loads(row.context_json, {}),
        "confidence_score": row.confidence_score,
    }


def list_history_entries(db: Session, user_id: int):
    rows = db.query(models.OutfitHistoryEntry).filter(models.OutfitHistoryEntry.owner_id == user_id).order_by(models.OutfitHistoryEntry.worn_at.desc()).all()
    return [_history_entry_to_dict(row) for row in rows]


def create_history_entry(db: Session, user_id: int, payload: schemas.OutfitHistoryCreate):
    row = models.OutfitHistoryEntry(
        owner_id=user_id,
        item_ids_json=json.dumps(payload.item_ids),
        source=payload.source or "recommendation",
        context_json=json.dumps(payload.context or {}),
        confidence_score=payload.confidence_score,
        worn_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _history_entry_to_dict(row)


def remove_history_by_signature(db: Session, user_id: int, signature: str):
    rows = db.query(models.OutfitHistoryEntry).filter(models.OutfitHistoryEntry.owner_id == user_id).all()
    deleted = 0
    for row in rows:
        item_ids = _json_loads(row.item_ids_json, [])
        if "|".join(sorted(str(x).strip() for x in item_ids if str(x).strip())) == signature:
            db.delete(row)
            deleted += 1
    db.commit()
    return deleted


def clear_history_entries(db: Session, user_id: int):
    db.query(models.OutfitHistoryEntry).filter(models.OutfitHistoryEntry.owner_id == user_id).delete()
    db.commit()


def _planned_outfit_to_dict(row: models.PlannedOutfit):
    return {
        "planned_id": str(row.id),
        "item_ids": _json_loads(row.item_ids_json, []),
        "item_details": _json_loads(row.item_details_json, []),
        "planned_date": row.planned_date or "",
        "occasion": row.occasion or "",
        "notes": row.notes or "",
        "created_at": row.created_at.isoformat() if row.created_at else "",
        "source": row.source or "planner",
        "outfit_signature": row.outfit_signature or "",
    }


def list_planned_outfits(db: Session, user_id: int):
    rows = db.query(models.PlannedOutfit).filter(models.PlannedOutfit.owner_id == user_id).order_by(models.PlannedOutfit.planned_date.asc(), models.PlannedOutfit.created_at.desc()).all()
    return [_planned_outfit_to_dict(row) for row in rows]


def create_planned_outfit(db: Session, user_id: int, payload: schemas.PlannedOutfitCreate, signature: str):
    row = models.PlannedOutfit(
        owner_id=user_id,
        outfit_signature=signature,
        item_ids_json=json.dumps(payload.item_ids),
        item_details_json=json.dumps(payload.item_details or []),
        planned_date=payload.planned_date or "",
        occasion=payload.occasion or "",
        notes=payload.notes or "",
        source=payload.source or "planner",
        created_at=datetime.utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _planned_outfit_to_dict(row)


def get_planned_outfit_by_id(db: Session, user_id: int, planned_id: int):
    return db.query(models.PlannedOutfit).filter(models.PlannedOutfit.owner_id == user_id, models.PlannedOutfit.id == planned_id).first()


def delete_planned_outfit(db: Session, row: models.PlannedOutfit):
    db.delete(row)
    db.commit()
