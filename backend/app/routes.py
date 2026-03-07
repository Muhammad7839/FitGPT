import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app import schemas, crud, models
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    verify_google_token,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from app.schemas import RecommendationResponse, AIRecommendationRequest, AIRecommendationResponse
from app.weather import get_weather
from app.groq_service import get_ai_recommendations
from app.email import send_password_reset_email

router = APIRouter()
auth_router = APIRouter(prefix="/auth")


# =============================
# Onboarding Enforcement
# =============================

def require_onboarding_complete(current_user: models.User):
    if not current_user.onboarding_complete:
        raise HTTPException(
            status_code=403,
            detail="Complete onboarding before accessing this feature."
        )


# =============================
# Auth helpers (shared logic)
# =============================

def _register(user: schemas.UserCreate, db: Session):
    existing_user = crud.get_user_by_email(db, user.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db, user)


def _login(user: schemas.UserLogin, db: Session):
    db_user = crud.get_user_by_email(db, user.email)

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    access_token = create_access_token(
        data={"sub": str(db_user.id)},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =============================
# Register  —  /register  &  /auth/register
# =============================

@router.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return _register(user, db)

@auth_router.post("/register", response_model=schemas.UserResponse)
def auth_register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    return _register(user, db)


# =============================
# Login  —  /login  &  /auth/login
# =============================

@router.post("/login", response_model=schemas.Token)
def login_user_json(user: schemas.UserLogin, db: Session = Depends(get_db)):
    return _login(user, db)

@auth_router.post("/login", response_model=schemas.Token)
def auth_login_user_json(user: schemas.UserLogin, db: Session = Depends(get_db)):
    return _login(user, db)


# =============================
# Google OAuth  —  /auth/google/callback
# =============================

@auth_router.post("/google/callback", response_model=schemas.Token)
def google_auth_callback(body: schemas.GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        idinfo = verify_google_token(body.id_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=f"Invalid Google token: {exc}")

    email = idinfo.get("email")
    google_id = idinfo.get("sub")

    if not email or not google_id:
        raise HTTPException(status_code=401, detail="Google token missing required fields")

    # Try to find existing user by google_id
    user = crud.get_user_by_google_id(db, google_id)

    if not user:
        # Try to find by email (link Google to existing email/password account)
        user = crud.get_user_by_email(db, email)
        if user:
            user.google_id = google_id
            if user.auth_provider == "email":
                user.auth_provider = "both"
            db.commit()
        else:
            user = crud.create_google_user(db, email, google_id)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


# =============================
# Forgot Password  —  /auth/forgot-password
# =============================

@auth_router.post("/forgot-password")
def forgot_password(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, body.email)
    if user:
        token = secrets.token_urlsafe(32)
        reset_token = models.PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.add(reset_token)
        db.commit()
        try:
            send_password_reset_email(body.email, token)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Failed to send reset email: %s", e)
    return {"message": "If an account exists, a reset link has been sent."}


# =============================
# Reset Password  —  /auth/reset-password
# =============================

@auth_router.post("/reset-password")
def reset_password(body: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_token = (
        db.query(models.PasswordResetToken)
        .filter(models.PasswordResetToken.token == body.token)
        .first()
    )
    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    if reset_token.used:
        raise HTTPException(status_code=400, detail="This reset link has already been used.")
    if reset_token.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link has expired.")

    user = db.query(models.User).filter(models.User.id == reset_token.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

    user.hashed_password = hash_password(body.new_password)
    reset_token.used = True
    db.commit()

    return {"message": "Password has been reset successfully."}


# =============================
# Current User  —  /me  &  /auth/me
# =============================

@router.get("/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user

@auth_router.get("/me", response_model=schemas.UserResponse)
def auth_read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user


# =============================
# Update User Profile
# =============================

@router.put("/me/profile", response_model=schemas.UserResponse)
def update_my_profile(
    updated_data: schemas.UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return crud.update_user_profile(db, current_user, updated_data)


# =============================
# Wardrobe CRUD
# =============================

@router.post("/wardrobe/items", response_model=schemas.ClothingItemResponse)
def create_wardrobe_item(
    item: schemas.ClothingItemCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    return crud.create_clothing_item(db, item, current_user.id)


@router.get("/wardrobe/items", response_model=list[schemas.ClothingItemResponse])
def get_my_wardrobe(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):

    return crud.get_clothing_items_for_user(db, current_user.id)


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
        raise HTTPException(status_code=403, detail="Not authorized")

    return crud.update_clothing_item(db, db_item, updated_item)


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
        raise HTTPException(status_code=403, detail="Not authorized")

    crud.delete_clothing_item(db, db_item)
    return {"detail": "Item deleted successfully"}


# =============================
# Dashboard Context
# =============================

@router.get("/dashboard/context")
def get_dashboard_context(
    current_user: models.User = Depends(get_current_user)
):

    weather = get_weather()
    return {"weather": weather}


# =============================
# Advanced Outfit Recommendations
# =============================

@router.get("/recommendations", response_model=RecommendationResponse)
def get_recommendations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):


    items = crud.get_clothing_items_for_user(db, current_user.id)

    if not items:
        return {
            "body_type": current_user.body_type,
            "lifestyle": current_user.lifestyle,
            "outfits": []
        }

    tops = [i for i in items if i.category == "top"]
    bottoms = [i for i in items if i.category == "bottom"]
    shoes = [i for i in items if i.category == "shoes"]
    outerwear = [i for i in items if i.category == "outerwear"]
    accessories = [i for i in items if i.category == "accessory"]

    outfits = []
    seen = set()

    neutral = {"black", "white", "gray", "beige"}
    warm = {"red", "orange", "yellow"}
    cool = {"blue", "green", "purple"}

    for top in tops:
        for bottom in bottoms:

            combo = (top.id, bottom.id)
            if combo in seen:
                continue
            seen.add(combo)

            score = 1
            reasons = []

            # Style scoring
            if top.style_tag == current_user.lifestyle:
                score += 3
                reasons.append("Top matches lifestyle")

            if bottom.style_tag == current_user.lifestyle:
                score += 2
                reasons.append("Bottom matches lifestyle")

            # Fit scoring
            if current_user.body_type == "athletic" and top.fit_type in ["slim", "athletic"]:
                score += 2
                reasons.append("Fit complements athletic build")

            # Color harmony logic
            if top.color in neutral or bottom.color in neutral:
                score += 2
                reasons.append("Neutral color balance")

            elif (top.color in warm and bottom.color in warm):
                score += 2
                reasons.append("Warm color harmony")

            elif (top.color in cool and bottom.color in cool):
                score += 2
                reasons.append("Cool color harmony")

            else:
                score += 1
                reasons.append("Balanced contrast")

            confidence = round((score / 10) * 100, 2)

            outfit = {
                "top": top,
                "bottom": bottom,
                "shoes": shoes[0] if shoes else None,
                "outerwear": outerwear[0] if outerwear else None,
                "accessory": accessories[0] if accessories else None,
                "score": score,
                "confidence": confidence,
                "reason": ", ".join(reasons)
            }

            outfits.append(outfit)

    outfits.sort(key=lambda x: x["score"], reverse=True)

    return {
        "body_type": current_user.body_type,
        "lifestyle": current_user.lifestyle,
        "outfits": outfits[:3]
    }


# =============================
# AI-Powered Recommendations (no auth required)
# =============================

@router.post("/recommendations/ai", response_model=AIRecommendationResponse)
def get_ai_recommendations_endpoint(request: AIRecommendationRequest):
    items_dicts = [item.model_dump() for item in request.items]
    context_dict = request.context.model_dump() if request.context else {}

    result = get_ai_recommendations(items_dicts, context_dict)

    if result is None:
        return {"source": "fallback", "outfits": []}

    return {
        "source": "ai",
        "outfits": result,
    }