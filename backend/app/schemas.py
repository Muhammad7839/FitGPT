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
    is_archived: bool
    last_worn_timestamp: Optional[int] = None

    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    items: list[ClothingItemResponse]
    explanation: str


class OutfitHistoryCreate(BaseModel):
    item_ids: list[int]
    worn_at_timestamp: int


class OutfitHistoryResponse(BaseModel):
    detail: str
