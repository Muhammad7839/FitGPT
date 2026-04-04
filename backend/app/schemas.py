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


class UserLogin(BaseModel):
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


class GoogleAuthRequest(BaseModel):
    id_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


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


class ClothingItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[CategoryEnum] = None
    color: Optional[ColorEnum] = None
    fit_type: Optional[FitTypeEnum] = None
    style_tag: Optional[StyleTagEnum] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    is_favorite: Optional[bool] = None


class ClothingItemResponse(BaseModel):
    id: int
    name: str
    category: CategoryEnum
    color: ColorEnum
    fit_type: FitTypeEnum
    style_tag: StyleTagEnum
    image_url: Optional[str] = None
    is_active: bool = True
    is_favorite: bool = False

    class Config:
        from_attributes = True


# =============================
# Recommendation Schemas
# =============================


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


# =============================
# AI Recommendation Schemas
# =============================

class WardrobeItemInput(BaseModel):
    id: str
    name: Optional[str] = ""
    category: Optional[str] = ""
    color: Optional[str] = ""
    fit_type: Optional[str] = ""
    style_tag: Optional[str] = ""


class AIRecommendationContext(BaseModel):
    weather_category: Optional[str] = "mild"
    time_category: Optional[str] = "work hours"
    occasion: Optional[str] = "daily"
    body_type: Optional[str] = "rectangle"
    style_preferences: Optional[List[str]] = []


class AIRecommendationRequest(BaseModel):
    items: List[WardrobeItemInput]
    context: Optional[AIRecommendationContext] = None


class AIOutfitResult(BaseModel):
    item_ids: List[str]
    explanation: str


class AIRecommendationResponse(BaseModel):
    source: str  # "ai" or "fallback"
    outfits: List[AIOutfitResult]


# =============================
# Chat Schemas
# =============================

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatContext(BaseModel):
    wardrobe_summary: Optional[str] = None
    preferences: Optional[str] = None


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[ChatContext] = None


class ChatResponse(BaseModel):
    reply: str

# =============================
# Saved / History / Planning Schemas
# =============================

class SavedOutfitCreate(BaseModel):
    items: List[str]
    item_details: Optional[List[dict]] = []
    source: Optional[str] = "recommended"
    context: Optional[dict] = {}
    notes: Optional[str] = ""
    name: Optional[str] = ""


class OutfitHistoryCreate(BaseModel):
    item_ids: List[str]
    source: Optional[str] = "recommendation"
    context: Optional[dict] = {}
    confidence_score: Optional[float] = None


class PlannedOutfitCreate(BaseModel):
    item_ids: List[str]
    item_details: Optional[List[dict]] = []
    planned_date: Optional[str] = ""
    occasion: Optional[str] = ""
    notes: Optional[str] = ""
    source: Optional[str] = "planner"
