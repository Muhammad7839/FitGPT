"""API route definitions for auth, wardrobe, profile, planning, and recommendation flows."""

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import crud, models, schemas
from app.ai.provider import ProviderMessage
from app.ai.service import AiService, RecommendationContext as AiRecommendationContext
from app.auth import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    get_current_user,
    verify_password,
)
from app.config import EXPOSE_RESET_TOKEN_IN_RESPONSE, MAX_UPLOAD_IMAGE_BYTES
from app.database.database import get_db
from app.google_oauth import GoogleTokenValidationError, verify_google_id_token
from app.recommendation_explanations import RecommendationContext, build_recommendation_explanation
from app.weather import WeatherLookupError, fetch_current_weather, map_temperature_to_category

logger = logging.getLogger(__name__)

router = APIRouter()
UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ai_service = AiService()


def _serialize_saved_outfits(saved_outfits: list[models.SavedOutfit]) -> list[dict]:
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


def _ensure_owned_items(db: Session, user_id: int, item_ids: list[int]) -> None:
    owned_item_count = db.query(models.ClothingItem).filter(
        models.ClothingItem.owner_id == user_id,
        models.ClothingItem.id.in_(item_ids),
    ).count()
    if owned_item_count != len(set(item_ids)):
        raise HTTPException(status_code=403, detail="Some items do not belong to current user")


def _store_uploaded_image(image: UploadFile, user_id: int, *, prefix: str = "item") -> str:
    content_type = (image.content_type or "").lower()
    if content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WEBP images are allowed")

    extension = ".jpg"
    if content_type == "image/png":
        extension = ".png"
    elif content_type == "image/webp":
        extension = ".webp"

    filename = f"{prefix}_{user_id}_{uuid4().hex}{extension}"
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

    logger.info("Stored uploaded image for user=%s file=%s bytes=%s", user_id, filename, bytes_written)
    return f"/uploads/{filename}"


def _normalize_weather_category(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().lower()
    if normalized in {"cold", "cool", "mild", "warm", "hot"}:
        return normalized
    return None


def fetch_current_temperature_f(city: str) -> int:
    """Compatibility helper used by recommendation flow and tests."""
    return fetch_current_weather(city=city).temperature_f


def _resolve_recommendation_weather_context(
    *,
    manual_temp: Optional[int],
    weather_city: Optional[str],
    weather_lat: Optional[float],
    weather_lon: Optional[float],
    weather_category: Optional[str],
) -> tuple[Optional[int], str, Optional[str]]:
    normalized_city = weather_city.strip() if weather_city else None
    normalized_weather_category = _normalize_weather_category(weather_category)

    effective_temp = manual_temp
    resolved_weather_city = normalized_city

    if effective_temp is None and normalized_city and weather_lat is None and weather_lon is None:
        try:
            effective_temp = fetch_current_temperature_f(normalized_city)
        except WeatherLookupError as exc:
            logger.warning("Weather lookup failed for recommendation city=%s error=%s", normalized_city, exc)
            if not normalized_weather_category:
                raise

    if effective_temp is None and (normalized_city or (weather_lat is not None and weather_lon is not None)):
        try:
            weather = fetch_current_weather(
                city=normalized_city,
                lat=weather_lat,
                lon=weather_lon,
            )
            effective_temp = weather.temperature_f
            normalized_weather_category = normalized_weather_category or weather.weather_category
            resolved_weather_city = weather.city
        except WeatherLookupError as exc:
            logger.warning("Weather lookup failed for recommendation weather=%s", exc)
            if not normalized_weather_category:
                raise

    if effective_temp is not None and not normalized_weather_category:
        normalized_weather_category = map_temperature_to_category(effective_temp)
    if not normalized_weather_category:
        normalized_weather_category = "mild"

    return effective_temp, normalized_weather_category, resolved_weather_city


def _login_with_credentials(db: Session, *, email: str, password: str) -> schemas.Token:
    user = crud.get_user_by_email(db, email)

    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


# =============================
# Register
# =============================

@router.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = crud.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user)


@router.post("/auth/register", response_model=schemas.UserResponse)
def register_user_alias(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Compatibility alias for web clients expecting /auth/register."""
    return register_user(user=user, db=db)


# =============================
# Login (JWT)
# =============================

@router.post("/login", response_model=schemas.Token)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    return _login_with_credentials(
        db=db,
        email=form_data.username,
        password=form_data.password,
    )


@router.post("/auth/login", response_model=schemas.Token)
def login_user_alias(
    payload: schemas.UserLogin,
    db: Session = Depends(get_db),
):
    """Compatibility alias for web clients expecting JSON login at /auth/login."""
    return _login_with_credentials(
        db=db,
        email=payload.email,
        password=payload.password,
    )


@router.post("/login/google", response_model=schemas.Token)
def login_with_google(
    payload: schemas.GoogleLoginRequest,
    db: Session = Depends(get_db)
):
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
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
def forgot_password(
    payload: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_email(db, payload.email)
    detail = "If the account exists, reset instructions were issued"
    if not user:
        return {"detail": detail, "reset_token": None}

    token = crud.create_password_reset_token(db, user)
    logger.info("Generated password reset token for user_id=%s exposed=%s", user.id, EXPOSE_RESET_TOKEN_IN_RESPONSE)
    return {
        "detail": detail,
        "reset_token": token if EXPOSE_RESET_TOKEN_IN_RESPONSE else None,
    }


@router.post("/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(
    payload: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    user = crud.get_user_by_reset_token(db, payload.token)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    crud.reset_user_password(db, user, payload.new_password)
    logger.info("Reset password for user_id=%s", user.id)
    return {"detail": "Password reset successful"}


# =============================
# Profile Routes
# =============================

@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


@router.get("/auth/me", response_model=schemas.UserResponse)
def read_current_user_alias(current_user: models.User = Depends(get_current_user)):
    """Compatibility alias for web clients expecting /auth/me."""
    return current_user


@router.put("/me/profile", response_model=schemas.UserResponse)
def update_my_profile(
    updated_data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    updated_user = crud.update_user_profile(db, current_user, updated_data)
    return updated_user


@router.post("/me/avatar", response_model=schemas.AvatarUploadResponse)
def upload_my_avatar(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    avatar_url = _store_uploaded_image(image, current_user.id, prefix="avatar")
    current_user.avatar_url = avatar_url
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    logger.info("Updated avatar for user_id=%s", current_user.id)
    return {"avatar_url": avatar_url}


@router.post("/onboarding/complete", response_model=schemas.UserResponse)
def complete_onboarding(
    updated_data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    updated_user = crud.update_user_profile(db, current_user, updated_data)
    if not updated_user.onboarding_complete:
        updated_user.onboarding_complete = True
        db.commit()
        db.refresh(updated_user)
    logger.info("Completed onboarding for user_id=%s", updated_user.id)
    return updated_user


@router.get("/me/summary", response_model=schemas.UserProfileSummaryResponse)
def get_profile_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.build_profile_summary(db, current_user)


# =============================
# Wardrobe Routes
# =============================

@router.post("/wardrobe/items", response_model=schemas.ClothingItemResponse)
def create_wardrobe_item(
    item: schemas.ClothingItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    created = crud.create_clothing_item(db, item, current_user.id)
    logger.info("Created wardrobe item user_id=%s item_id=%s", current_user.id, created.id)
    return created


@router.post("/wardrobe/items/bulk", response_model=schemas.BulkCreateClothingItemsResponse)
def create_wardrobe_items_bulk(
    payload: schemas.BulkCreateClothingItemsRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    results = crud.bulk_create_clothing_items(db, current_user.id, payload.items)
    success_count = sum(1 for result in results if result["status"] == "success")
    logger.info(
        "Bulk created wardrobe items user_id=%s requested=%s success=%s",
        current_user.id,
        len(payload.items),
        success_count,
    )
    return {"results": results}


@router.get("/wardrobe/items", response_model=list[schemas.ClothingItemResponse])
def get_my_wardrobe(
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
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    items = crud.get_clothing_items_for_user(
        db=db,
        user_id=current_user.id,
        include_archived=include_archived,
        search=search,
        category=category,
        color=color,
        clothing_type=clothing_type,
        season=season,
        fit_tag=fit_tag,
        layer_type=layer_type,
        is_one_piece=is_one_piece,
        set_identifier=set_identifier,
        style_tag=style_tag,
        season_tag=season_tag,
        occasion_tag=occasion_tag,
        accessory_type=accessory_type,
        favorites_only=favorites_only,
    )
    return items


@router.get("/wardrobe/items/favorites", response_model=list[schemas.ClothingItemResponse])
def get_favorite_items(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return crud.get_favorite_items_for_user(db, current_user.id)


@router.post("/wardrobe/items/image", response_model=schemas.ImageUploadResponse)
def upload_wardrobe_image(
    image: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    image_url = _store_uploaded_image(image, current_user.id)
    return {"image_url": image_url}


@router.post("/wardrobe/items/images", response_model=schemas.ImageBatchUploadResponse)
def upload_wardrobe_images_batch(
    images: list[UploadFile] = File(...),
    current_user: models.User = Depends(get_current_user),
):
    results: list[dict] = []
    for image in images:
        file_name = image.filename or "unnamed"
        try:
            image_url = _store_uploaded_image(image, current_user.id)
            results.append(
                {
                    "file_name": file_name,
                    "status": "success",
                    "image_url": image_url,
                    "error": None,
                }
            )
        except HTTPException as exc:
            results.append(
                {
                    "file_name": file_name,
                    "status": "failed",
                    "image_url": None,
                    "error": str(exc.detail),
                }
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Batch image upload failed user_id=%s file=%s", current_user.id, file_name)
            results.append(
                {
                    "file_name": file_name,
                    "status": "failed",
                    "image_url": None,
                    "error": str(exc),
                }
            )
    return {"results": results}


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

    updated = crud.update_clothing_item(db, db_item, updated_item)
    logger.info("Updated wardrobe item user_id=%s item_id=%s", current_user.id, item_id)
    return updated


@router.post("/wardrobe/items/{item_id}/favorite", response_model=schemas.ClothingItemResponse)
def toggle_wardrobe_favorite(
    item_id: int,
    payload: schemas.FavoriteToggleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db_item = crud.get_clothing_item_by_id(db, item_id)
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    if db_item.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this item")

    updated = crud.set_item_favorite(db, db_item, payload.is_favorite)
    logger.info("Updated favorite state user_id=%s item_id=%s favorite=%s", current_user.id, item_id, payload.is_favorite)
    return updated


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
    logger.info("Archived wardrobe item user_id=%s item_id=%s", current_user.id, item_id)
    return {"detail": "Item deleted successfully"}


# =============================
# Weather + Recommendation Routes
# =============================

@router.get("/weather/current", response_model=schemas.WeatherCurrentResponse)
def get_current_weather(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    current_user: models.User = Depends(get_current_user),
):
    _ = current_user
    try:
        if lat is not None and lon is not None:
            weather = fetch_current_weather(city=city, lat=lat, lon=lon)
        else:
            weather = fetch_current_weather(city=city)
    except WeatherLookupError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc
    weather_category = getattr(weather, "weather_category", None)
    if not weather_category:
        weather_category = map_temperature_to_category(int(weather.temperature_f))
    return {
        "city": weather.city,
        "temperature_f": weather.temperature_f,
        "weather_category": weather_category,
        "condition": weather.condition,
        "description": weather.description,
    }


@router.get("/dashboard/context", response_model=schemas.DashboardContextResponse)
def get_dashboard_context(
    city: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    current_user: models.User = Depends(get_current_user),
):
    """Web compatibility endpoint for dashboard bootstrap context."""
    _ = current_user
    if not city and (lat is None or lon is None):
        return {
            "weather": None,
            "status": "idle",
            "detail": "Weather not requested",
        }

    try:
        weather = fetch_current_weather(city=city, lat=lat, lon=lon)
    except WeatherLookupError as exc:
        logger.warning("Dashboard context weather lookup failed: %s", exc)
        return {
            "weather": None,
            "status": "unavailable",
            "detail": str(exc),
        }

    return {
        "weather": {
            "city": weather.city,
            "temperature_f": weather.temperature_f,
            "weather_category": weather.weather_category,
            "condition": weather.condition,
            "description": weather.description,
        },
        "status": "available",
        "detail": None,
    }


@router.get("/recommendations", response_model=schemas.RecommendationResponse)
def get_recommendations(
    manual_temp: Optional[int] = None,
    time_context: Optional[str] = None,
    plan_date: Optional[str] = None,
    exclude: Optional[str] = None,
    weather_city: Optional[str] = None,
    weather_lat: Optional[float] = None,
    weather_lon: Optional[float] = None,
    weather_category: Optional[str] = None,
    occasion: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    try:
        effective_temp, normalized_weather_category, resolved_weather_city = _resolve_recommendation_weather_context(
            manual_temp=manual_temp,
            weather_city=weather_city,
            weather_lat=weather_lat,
            weather_lon=weather_lon,
            weather_category=weather_category,
        )
    except WeatherLookupError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc

    options = crud.get_recommendation_options_for_user(
        db=db,
        user=current_user,
        manual_temp=effective_temp,
        weather_category=normalized_weather_category,
        occasion=occasion,
        exclude=exclude,
        limit=1,
    )
    top_option = options[0] if options else {
        "items": [],
        "explanation": "",
        "outfit_score": 0.0,
    }
    items = top_option["items"]
    explanation = build_recommendation_explanation(
        user=current_user,
        items=items,
        context=RecommendationContext(
            manual_temp=effective_temp,
            time_context=time_context,
            plan_date=plan_date,
            exclude=exclude,
            weather_city=resolved_weather_city,
            weather_category=normalized_weather_category,
            occasion=occasion,
        ),
    )
    deterministic_explanation = (top_option["explanation"] or "").strip()
    final_explanation = explanation
    if deterministic_explanation and deterministic_explanation.lower() not in explanation.lower():
        final_explanation = f"{deterministic_explanation} {explanation}".strip()
    return {
        "items": items,
        "explanation": final_explanation,
        "outfit_score": top_option["outfit_score"],
        "weather_category": normalized_weather_category,
        "occasion": occasion,
    }


@router.get("/recommendations/options", response_model=schemas.RecommendationOptionsResponse)
def get_recommendation_options(
    manual_temp: Optional[int] = None,
    time_context: Optional[str] = None,
    plan_date: Optional[str] = None,
    exclude: Optional[str] = None,
    weather_city: Optional[str] = None,
    weather_lat: Optional[float] = None,
    weather_lon: Optional[float] = None,
    weather_category: Optional[str] = None,
    occasion: Optional[str] = None,
    limit: int = 3,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ = time_context
    _ = plan_date
    try:
        effective_temp, normalized_weather_category, _ = _resolve_recommendation_weather_context(
            manual_temp=manual_temp,
            weather_city=weather_city,
            weather_lat=weather_lat,
            weather_lon=weather_lon,
            weather_category=weather_category,
        )
    except WeatherLookupError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc

    options = crud.get_recommendation_options_for_user(
        db=db,
        user=current_user,
        manual_temp=effective_temp,
        weather_category=normalized_weather_category,
        occasion=occasion,
        exclude=exclude,
        limit=limit,
    )
    return {
        "outfits": [
            {
                "items": option["items"],
                "explanation": option["explanation"],
                "outfit_score": option["outfit_score"],
            }
            for option in options
        ],
        "weather_category": normalized_weather_category,
        "occasion": occasion,
    }


@router.post("/ai/chat", response_model=schemas.ChatResponse)
def chat_with_ai(
    payload: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    request_id = uuid4().hex[:12]
    wardrobe_items = crud.get_clothing_items_for_user(
        db=db,
        user_id=current_user.id,
        include_archived=False,
    )
    messages = [ProviderMessage(role=entry.role, content=entry.content) for entry in payload.messages]

    result = ai_service.run_chat(
        user=current_user,
        wardrobe_items=wardrobe_items,
        messages=messages,
        request_id=request_id,
    )
    logger.info(
        "request_id=%s endpoint=/ai/chat user_id=%s source=%s fallback=%s warning=%s",
        request_id,
        current_user.id,
        result.source,
        result.fallback_used,
        result.warning,
    )
    return {
        "reply": result.reply,
        "source": result.source,
        "fallback_used": result.fallback_used,
        "warning": result.warning,
    }


@router.post("/chat", response_model=schemas.ChatResponse)
def chat_with_ai_alias(
    payload: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Compatibility alias for web clients expecting /chat."""
    return chat_with_ai(payload=payload, db=db, current_user=current_user)


@router.post("/ai/recommendations", response_model=schemas.AiRecommendationResponse)
def get_ai_recommendations(
    payload: schemas.AiRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    request_id = uuid4().hex[:12]
    try:
        effective_temp, normalized_weather_category, _ = _resolve_recommendation_weather_context(
            manual_temp=payload.manual_temp,
            weather_city=payload.weather_city,
            weather_lat=payload.weather_lat,
            weather_lon=payload.weather_lon,
            weather_category=payload.weather_category,
        )
    except WeatherLookupError as exc:
        raise HTTPException(status_code=getattr(exc, "status_code", 400), detail=str(exc)) from exc

    result = ai_service.run_recommendation(
        db=db,
        user=current_user,
        context=AiRecommendationContext(
            manual_temp=effective_temp,
            weather_category=normalized_weather_category,
            occasion=payload.occasion,
            exclude=payload.exclude,
            style_preference=payload.style_preference,
            preferred_seasons=payload.preferred_seasons,
            request_id=request_id,
        ),
    )
    logger.info(
        "request_id=%s endpoint=/ai/recommendations user_id=%s source=%s fallback=%s warning=%s suggestion_id=%s",
        request_id,
        current_user.id,
        result.source,
        result.fallback_used,
        result.warning,
        result.suggestion_id,
    )
    wardrobe_item_map = {
        item.id: item
        for item in crud.get_clothing_items_for_user(db, current_user.id, include_archived=False)
    }
    return {
        "items": result.items,
        "explanation": result.explanation,
        "outfit_score": result.outfit_score,
        "weather_category": result.weather_category,
        "occasion": payload.occasion,
        "source": result.source,
        "fallback_used": result.fallback_used,
        "warning": result.warning,
        "suggestion_id": result.suggestion_id,
        "item_explanations": [
            {"item_id": item_id, "explanation": explanation}
            for item_id, explanation in result.item_explanations.items()
        ],
        "outfit_options": [
            {
                "items": [
                    wardrobe_item_map[item_id]
                    for item_id in option.item_ids
                    if item_id in wardrobe_item_map
                ],
                "explanation": option.explanation,
                "outfit_score": option.score,
            }
            for option in result.outfit_options
        ],
    }


@router.post("/recommendations/ai", response_model=schemas.CompatAiRecommendationResponse)
def get_ai_recommendations_compat(
    payload: schemas.CompatAiRecommendationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Compatibility alias for web clients expecting /recommendations/ai."""
    request_id = uuid4().hex[:12]
    context = payload.context or schemas.CompatAiContext()
    style_preference = context.style_preferences[0] if context.style_preferences else None

    result = ai_service.run_recommendation(
        db=db,
        user=current_user,
        context=AiRecommendationContext(
            manual_temp=None,
            weather_category=context.weather_category,
            occasion=context.occasion,
            exclude=None,
            style_preference=style_preference,
            preferred_seasons=[],
            request_id=request_id,
        ),
    )
    logger.info(
        "request_id=%s endpoint=/recommendations/ai user_id=%s source=%s fallback=%s warning=%s suggestion_id=%s",
        request_id,
        current_user.id,
        result.source,
        result.fallback_used,
        result.warning,
        result.suggestion_id,
    )
    outfits: list[dict] = []
    if result.items:
        outfits.append(
            {
                "item_ids": [str(item.id) for item in result.items],
                "explanation": result.explanation,
            }
        )
    return {
        "source": result.source,
        "outfits": outfits,
        "fallback_used": result.fallback_used,
        "warning": result.warning,
    }


# =============================
# Outfit History Routes
# =============================

@router.post("/outfits/history", response_model=schemas.OutfitHistoryResponse)
def create_outfit_history(
    payload: schemas.OutfitHistoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_owned_items(db, current_user.id, payload.item_ids)
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


# =============================
# Saved Outfit Routes
# =============================

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
    _ensure_owned_items(db, current_user.id, payload.item_ids)

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


# =============================
# Planned Outfit Routes
# =============================

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
    _ensure_owned_items(db, current_user.id, payload.item_ids)

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


@router.put("/outfits/planned/assign", response_model=schemas.PlannedOutfitAssignmentResponse)
def assign_planned_outfit(
    payload: schemas.PlannedOutfitAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _ensure_owned_items(db, current_user.id, payload.item_ids)
    for planned_date in payload.planned_dates:
        crud.assign_planned_outfit_to_date(
            db=db,
            user_id=current_user.id,
            item_ids=payload.item_ids,
            planned_date=planned_date,
            occasion=payload.occasion,
            replace_existing=payload.replace_existing,
            created_at_timestamp=payload.created_at_timestamp or int(datetime.utcnow().timestamp()),
        )

    planned_outfits = crud.get_planned_outfits_for_user(db, current_user.id)
    logger.info(
        "Assigned planned outfits user_id=%s dates=%s replace_existing=%s",
        current_user.id,
        payload.planned_dates,
        payload.replace_existing,
    )
    return {
        "detail": "Planner assignments saved",
        "planned_dates": payload.planned_dates,
        "outfits": _serialize_planned_outfits(planned_outfits),
    }


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
