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
    name: str
    category: str
    color: str
    image_url: Optional[str] = None


class ClothingItemResponse(BaseModel):
    id: int
    name: str
    category: str
    color: str
    image_url: Optional[str] = None

    class Config:
        from_attributes = True
