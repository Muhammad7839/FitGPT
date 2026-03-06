"""API route definitions for auth, wardrobe, profile, and recommendation flows."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.database.database import get_db
from app import schemas, crud, models
from app.auth import (
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.recommendation_explanations import (
    RecommendationContext,
    build_recommendation_explanation,
)

router = APIRouter()


# =============================
# Register
# =============================

@router.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = crud.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    return crud.create_user(db, user)


# =============================
# Login (JWT)
# =============================

@router.post("/login", response_model=schemas.Token)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, form_data.username)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =============================
# Protected Test Route
# =============================

@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

# =============================
# Wardrobe - Create Item
# =============================

@router.post("/wardrobe/items", response_model=schemas.ClothingItemResponse)
def create_wardrobe_item(
    item: schemas.ClothingItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.create_clothing_item(db, item, current_user.id)


# =============================
# Wardrobe - Get My Items
# =============================

@router.get("/wardrobe/items", response_model=list[schemas.ClothingItemResponse])
def get_my_wardrobe(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_clothing_items_for_user(db, current_user.id)

# =============================
# Wardrobe - Update Item
# =============================

@router.put("/wardrobe/items/{item_id}", response_model=schemas.ClothingItemResponse)
def update_wardrobe_item(
    item_id: int,
    updated_item: schemas.ClothingItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = crud.get_clothing_item_by_id(db, item_id)

    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    if db_item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this item")

    return crud.update_clothing_item(db, db_item, updated_item)


# =============================
# Wardrobe - Delete Item
# =============================

@router.delete("/wardrobe/items/{item_id}")
def delete_wardrobe_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = crud.get_clothing_item_by_id(db, item_id)

    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    if db_item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this item")

    crud.delete_clothing_item(db, db_item)

    return {"detail": "Item deleted successfully"}

# =============================
# Update User Profile (Onboarding)
# =============================

@router.put("/me/profile", response_model=schemas.UserResponse)
def update_my_profile(
    updated_data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.update_user_profile(db, current_user, updated_data)


@router.get("/recommendations", response_model=schemas.RecommendationResponse)
def get_recommendations(
    manual_temp: Optional[int] = None,
    time_context: Optional[str] = None,
    plan_date: Optional[str] = None,
    exclude: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    items = crud.get_recommendations_for_user(db, current_user.id)
    explanation = build_recommendation_explanation(
        user=current_user,
        items=items,
        context=RecommendationContext(
            manual_temp=manual_temp,
            time_context=time_context,
            plan_date=plan_date,
            exclude=exclude,
        ),
    )
    return {
        "items": items,
        "explanation": explanation,
    }


@router.post("/outfits/history", response_model=schemas.OutfitHistoryResponse)
def create_outfit_history(
    payload: schemas.OutfitHistoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not payload.item_ids:
        raise HTTPException(status_code=400, detail="item_ids cannot be empty")

    owned_item_count = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == current_user.id,
        models.ClothingItem.id.in_(payload.item_ids),
    ).count()
    if owned_item_count != len(set(payload.item_ids)):
        raise HTTPException(status_code=403, detail="Some items do not belong to current user")

    crud.save_outfit_history(
        db=db,
        user_id=current_user.id,
        item_ids=payload.item_ids,
        worn_at_timestamp=payload.worn_at_timestamp,
    )
    return {"detail": "Outfit history saved"}
