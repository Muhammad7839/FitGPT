"""API route definitions for auth, wardrobe, profile, and recommendation flows."""

from typing import Optional
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
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
from app.google_oauth import GoogleTokenValidationError, verify_google_id_token
from app.recommendation_explanations import (
    RecommendationContext,
    build_recommendation_explanation,
)
from app.weather import (
    WeatherLookupError,
    fetch_current_temperature_f,
    fetch_current_weather,
)
from app.config import EXPOSE_RESET_TOKEN_IN_RESPONSE, MAX_UPLOAD_IMAGE_BYTES

router = APIRouter()
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _serialize_saved_outfits(saved_outfits: list[models.SavedOutfit]) -> list[dict]:
    """Serialize saved outfit rows into API payload format."""
    return [
        {
            "id": saved_outfit.id,
            "item_ids": [
                int(item_id)
                for item_id in saved_outfit.item_ids_csv.split(",")
                if item_id
            ],
            "saved_at_timestamp": saved_outfit.saved_at_timestamp,
        }
        for saved_outfit in saved_outfits
    ]


def _serialize_history_entries(history_entries: list[models.OutfitHistory]) -> list[dict]:
    """Serialize outfit history rows into API payload format."""
    return [
        {
            "id": entry.id,
            "item_ids": [
                int(item_id)
                for item_id in entry.item_ids_csv.split(",")
                if item_id
            ],
            "worn_at_timestamp": entry.worn_at_timestamp,
        }
        for entry in history_entries
    ]


def _serialize_planned_outfits(planned_outfits: list[models.PlannedOutfit]) -> list[dict]:
    """Serialize planned outfit rows into API payload format."""
    return [
        {
            "id": planned_outfit.id,
            "item_ids": [
                int(item_id)
                for item_id in planned_outfit.item_ids_csv.split(",")
                if item_id
            ],
            "planned_date": planned_outfit.planned_date,
            "occasion": planned_outfit.occasion,
            "created_at_timestamp": planned_outfit.created_at_timestamp,
        }
        for planned_outfit in planned_outfits
    ]


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
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive"
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


@router.post("/login/google", response_model=schemas.Token)
def login_with_google(
    payload: schemas.GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    """Authenticate a user with a verified Google ID token."""
    try:
        identity = verify_google_id_token(payload.id_token)
    except GoogleTokenValidationError as exc:
        status_code = status.HTTP_401_UNAUTHORIZED if exc.is_expired else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    user = crud.get_or_create_google_user(
        db=db,
        email=identity.email,
        full_name=identity.full_name,
    )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )
    return {
        "access_token": access_token,
        "token_type": "bearer",
    }


@router.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
def forgot_password(
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, payload.email)
    detail = "If the account exists, reset instructions were issued"
    if not user:
        return {
            "detail": detail,
            "reset_token": None,
        }

    token = crud.create_password_reset_token(db, user)
    if not EXPOSE_RESET_TOKEN_IN_RESPONSE:
        token = None

    return {
        "detail": detail,
        "reset_token": token,
    }


@router.post("/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(
    payload: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = crud.get_user_by_reset_token(db, payload.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    crud.reset_user_password(db, user, payload.new_password)
    return {"detail": "Password reset successful"}


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
    include_archived: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.get_clothing_items_for_user(
        db,
        current_user.id,
        include_archived=include_archived,
    )


@router.post("/wardrobe/items/image", response_model=schemas.ImageUploadResponse)
def upload_wardrobe_image(
    image: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    content_type = (image.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images are allowed")

    extension = ".jpg"
    if content_type == "image/png":
        extension = ".png"
    elif content_type == "image/webp":
        extension = ".webp"

    filename = f"user_{current_user.id}_{uuid4().hex}{extension}"
    destination = UPLOADS_DIR / filename

    bytes_written = 0
    try:
        with destination.open("wb") as output:
            while True:
                chunk = image.file.read(1024 * 1024)
                if not chunk:
                    break
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_IMAGE_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Image exceeds max upload size",
                    )
                output.write(chunk)
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        image.file.close()

    return {"image_url": f"/uploads/{filename}"}

# =============================
# Wardrobe - Update Item
# =============================

@router.put("/wardrobe/items/{item_id}", response_model=schemas.ClothingItemResponse)
def update_wardrobe_item(
    item_id: int,
    updated_item: schemas.ClothingItemUpdate,
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


@router.get("/weather/current", response_model=schemas.WeatherCurrentResponse)
def get_current_weather(
    city: str,
    current_user: models.User = Depends(get_current_user),
):
    _ = current_user
    try:
        weather = fetch_current_weather(city)
    except WeatherLookupError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "city": weather.city,
        "temperature_f": weather.temperature_f,
        "condition": weather.condition,
        "description": weather.description,
    }


@router.get("/recommendations", response_model=schemas.RecommendationResponse)
def get_recommendations(
    manual_temp: Optional[int] = None,
    time_context: Optional[str] = None,
    plan_date: Optional[str] = None,
    exclude: Optional[str] = None,
    weather_city: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    normalized_city = weather_city.strip() if weather_city else None
    effective_temp = manual_temp

    if effective_temp is None and normalized_city:
        try:
            effective_temp = fetch_current_temperature_f(normalized_city)
        except WeatherLookupError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    items = crud.get_recommendations_for_user(db, current_user.id)
    explanation = build_recommendation_explanation(
        user=current_user,
        items=items,
        context=RecommendationContext(
            manual_temp=effective_temp,
            time_context=time_context,
            plan_date=plan_date,
            exclude=exclude,
            weather_city=normalized_city,
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


@router.get("/outfits/history", response_model=schemas.OutfitHistoryListResponse)
def list_outfit_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    history_entries = crud.get_outfit_history_for_user(db, current_user.id)
    return {"history": _serialize_history_entries(history_entries)}


@router.delete("/outfits/history", response_model=schemas.OutfitHistoryResponse)
def clear_outfit_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    crud.clear_outfit_history_for_user(db, current_user.id)
    return {"detail": "Outfit history cleared"}


@router.get("/outfits/saved", response_model=schemas.SavedOutfitListResponse)
def get_saved_outfits(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    saved_outfits = crud.get_saved_outfits_for_user(db, current_user.id)
    return {"outfits": _serialize_saved_outfits(saved_outfits)}


@router.post("/outfits/saved", response_model=schemas.SavedOutfitListResponse)
def save_outfit(
    payload: schemas.SavedOutfitCreate,
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

    crud.save_saved_outfit(
        db=db,
        user_id=current_user.id,
        item_ids=payload.item_ids,
        saved_at_timestamp=payload.saved_at_timestamp or int(datetime.utcnow().timestamp()),
    )
    saved_outfits = crud.get_saved_outfits_for_user(db, current_user.id)
    return {"outfits": _serialize_saved_outfits(saved_outfits)}


@router.delete("/outfits/saved/{outfit_id}", response_model=schemas.SavedOutfitListResponse)
def delete_saved_outfit(
    outfit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deleted = crud.delete_saved_outfit(db, current_user.id, outfit_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Saved outfit not found")
    saved_outfits = crud.get_saved_outfits_for_user(db, current_user.id)
    return {"outfits": _serialize_saved_outfits(saved_outfits)}


@router.get("/outfits/planned", response_model=schemas.PlannedOutfitListResponse)
def list_planned_outfits(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    planned_outfits = crud.get_planned_outfits_for_user(db, current_user.id)
    return {"outfits": _serialize_planned_outfits(planned_outfits)}


@router.post("/outfits/planned", response_model=schemas.PlannedOutfitListResponse)
def save_planned_outfit(
    payload: schemas.PlannedOutfitCreate,
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

    crud.save_planned_outfit(
        db=db,
        user_id=current_user.id,
        item_ids=payload.item_ids,
        planned_date=payload.planned_date,
        occasion=payload.occasion,
        created_at_timestamp=payload.created_at_timestamp or int(datetime.utcnow().timestamp()),
    )
    planned_outfits = crud.get_planned_outfits_for_user(db, current_user.id)
    return {"outfits": _serialize_planned_outfits(planned_outfits)}


@router.delete("/outfits/planned/{outfit_id}", response_model=schemas.PlannedOutfitListResponse)
def delete_planned_outfit(
    outfit_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    deleted = crud.delete_planned_outfit(db, current_user.id, outfit_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Planned outfit not found")
    planned_outfits = crud.get_planned_outfits_for_user(db, current_user.id)
    return {"outfits": _serialize_planned_outfits(planned_outfits)}
