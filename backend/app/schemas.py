from pydantic import BaseModel, EmailStr
from typing import Optional, List
from enum import Enum


# =============================
# ENUMS
# =============================

class BodyTypeEnum(str, Enum):
    rectangle = "rectangle"
    athletic = "athletic"
    curvy = "curvy"
    petite = "petite"
    tall = "tall"
    unspecified = "unspecified"


class CategoryEnum(str, Enum):
    top = "top"
    bottom = "bottom"
    shoes = "shoes"
    outerwear = "outerwear"
    accessory = "accessory"


class FitTypeEnum(str, Enum):
    slim = "slim"
    regular = "regular"
    oversized = "oversized"


class StyleTagEnum(str, Enum):
    casual = "casual"
    sporty = "sporty"
    formal = "formal"
    street = "street"
    
class ColorEnum(str, Enum):
    black = "black"
    white = "white"
    gray = "gray"
    beige = "beige"
    red = "red"
    blue = "blue"
    green = "green"
    yellow = "yellow"
    purple = "purple"
    orange = "orange"


# =============================
# User Schemas
# =============================

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    body_type: BodyTypeEnum
    lifestyle: str
    comfort_preference: str
    onboarding_complete: bool

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    body_type: Optional[BodyTypeEnum] = None
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
    category: CategoryEnum
    color: ColorEnum
    fit_type: FitTypeEnum
    style_tag: StyleTagEnum
    image_url: Optional[str] = None


class ClothingItemResponse(BaseModel):
    id: int
    name: str
    category: CategoryEnum
    color: ColorEnum
    fit_type: FitTypeEnum
    style_tag: StyleTagEnum
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


# =============================
# Recommendation Schemas
# =============================

from typing import List


class OutfitItem(BaseModel):
    id: int
    name: str
    category: CategoryEnum
    color: ColorEnum
    fit_type: FitTypeEnum
    style_tag: StyleTagEnum
    image_url: Optional[str] = None

    class Config:
        from_attributes = True


class OutfitResponse(BaseModel):
    top: Optional[OutfitItem] = None
    bottom: Optional[OutfitItem] = None
    shoes: Optional[OutfitItem] = None
    outerwear: Optional[OutfitItem] = None
    accessory: Optional[OutfitItem] = None

    score: int
    confidence: float
    reason: str


class RecommendationResponse(BaseModel):
    body_type: str
    lifestyle: str
    outfits: List[OutfitResponse]