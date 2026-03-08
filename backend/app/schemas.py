from pydantic import BaseModel, EmailStr
from typing import Optional


# =============================
# User Schemas
# =============================

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    body_type: str
    lifestyle: str
    comfort_preference: str
    onboarding_complete: bool

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    body_type: Optional[str] = None
    lifestyle: Optional[str] = None
    comfort_preference: Optional[str] = None
    onboarding_complete: Optional[bool] = None


# =============================
# Auth Schemas
# =============================

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


class GoogleLoginRequest(BaseModel):
    id_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    detail: str
    reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    detail: str


# =============================
# Clothing Schemas
# =============================

class ClothingItemCreate(BaseModel):
    category: str
    color: str
    season: str
    comfort_level: int
    image_url: Optional[str] = None
    brand: Optional[str] = None
    is_available: bool = True
    is_favorite: bool = False
    is_archived: bool = False
    last_worn_timestamp: Optional[int] = None


class ClothingItemResponse(BaseModel):
    id: int
    category: str
    color: str
    season: str
    comfort_level: int
    image_url: Optional[str] = None
    brand: Optional[str] = None
    is_available: bool
    is_favorite: bool
    is_archived: bool
    last_worn_timestamp: Optional[int] = None

    class Config:
        from_attributes = True


class ClothingItemUpdate(BaseModel):
    category: Optional[str] = None
    color: Optional[str] = None
    season: Optional[str] = None
    comfort_level: Optional[int] = None
    image_url: Optional[str] = None
    brand: Optional[str] = None
    is_available: Optional[bool] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    last_worn_timestamp: Optional[int] = None


class RecommendationResponse(BaseModel):
    items: list[ClothingItemResponse]
    explanation: str


class WeatherCurrentResponse(BaseModel):
    city: str
    temperature_f: int
    condition: str
    description: str


class OutfitHistoryCreate(BaseModel):
    item_ids: list[int]
    worn_at_timestamp: int


class OutfitHistoryResponse(BaseModel):
    detail: str


class OutfitHistoryEntry(BaseModel):
    id: int
    item_ids: list[int]
    worn_at_timestamp: int


class OutfitHistoryListResponse(BaseModel):
    history: list[OutfitHistoryEntry]


class SavedOutfitCreate(BaseModel):
    item_ids: list[int]
    saved_at_timestamp: Optional[int] = None


class SavedOutfitEntry(BaseModel):
    id: int
    item_ids: list[int]
    saved_at_timestamp: int


class SavedOutfitListResponse(BaseModel):
    outfits: list[SavedOutfitEntry]


class PlannedOutfitCreate(BaseModel):
    item_ids: list[int]
    planned_date: str
    occasion: Optional[str] = None
    created_at_timestamp: Optional[int] = None


class PlannedOutfitEntry(BaseModel):
    id: int
    item_ids: list[int]
    planned_date: str
    occasion: Optional[str] = None
    created_at_timestamp: int


class PlannedOutfitListResponse(BaseModel):
    outfits: list[PlannedOutfitEntry]


class ImageUploadResponse(BaseModel):
    image_url: str
