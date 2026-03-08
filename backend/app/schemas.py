"""Pydantic request/response contracts for backend API routes."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# =============================
# User Schemas
# =============================

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        cleaned = value.strip()
        if cleaned != value:
            raise ValueError("password cannot have leading or trailing spaces")
        return value


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    body_type: str
    lifestyle: str
    comfort_preference: str
    onboarding_complete: bool

    model_config = ConfigDict(from_attributes=True)


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
    id_token: str = Field(min_length=20, max_length=4096)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    detail: str
    reset_token: Optional[str] = None


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=255)
    new_password: str = Field(min_length=6, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        cleaned = value.strip()
        if cleaned != value:
            raise ValueError("new_password cannot have leading or trailing spaces")
        return value


class ResetPasswordResponse(BaseModel):
    detail: str


# =============================
# Clothing Schemas
# =============================

class ClothingItemCreate(BaseModel):
    category: str = Field(min_length=1, max_length=64)
    color: str = Field(min_length=1, max_length=64)
    season: str = Field(min_length=1, max_length=32)
    comfort_level: int = Field(ge=1, le=5)
    image_url: Optional[str] = Field(default=None, max_length=1024)
    brand: Optional[str] = Field(default=None, max_length=128)
    is_available: bool = True
    is_favorite: bool = False
    is_archived: bool = False
    last_worn_timestamp: Optional[int] = Field(default=None, ge=0)

    @field_validator("category", "color", "season")
    @classmethod
    def validate_required_text(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value cannot be blank")
        return cleaned

    @field_validator("image_url", "brand")
    @classmethod
    def validate_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


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

    model_config = ConfigDict(from_attributes=True)


class ClothingItemUpdate(BaseModel):
    category: Optional[str] = Field(default=None, min_length=1, max_length=64)
    color: Optional[str] = Field(default=None, min_length=1, max_length=64)
    season: Optional[str] = Field(default=None, min_length=1, max_length=32)
    comfort_level: Optional[int] = Field(default=None, ge=1, le=5)
    image_url: Optional[str] = Field(default=None, max_length=1024)
    brand: Optional[str] = Field(default=None, max_length=128)
    is_available: Optional[bool] = None
    is_favorite: Optional[bool] = None
    is_archived: Optional[bool] = None
    last_worn_timestamp: Optional[int] = Field(default=None, ge=0)

    @field_validator("category", "color", "season")
    @classmethod
    def validate_optional_required_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value cannot be blank")
        return cleaned

    @field_validator("image_url", "brand")
    @classmethod
    def validate_optional_free_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


class RecommendationResponse(BaseModel):
    items: list[ClothingItemResponse]
    explanation: str


class WeatherCurrentResponse(BaseModel):
    city: str
    temperature_f: int
    condition: str
    description: str


class OutfitHistoryCreate(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=32)
    worn_at_timestamp: int = Field(gt=0)

    @field_validator("item_ids")
    @classmethod
    def validate_item_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("item_ids must be unique")
        if any(item_id <= 0 for item_id in value):
            raise ValueError("item_ids must contain positive integers")
        return value


class OutfitHistoryResponse(BaseModel):
    detail: str


class OutfitHistoryEntry(BaseModel):
    id: int
    item_ids: list[int]
    worn_at_timestamp: int


class OutfitHistoryListResponse(BaseModel):
    history: list[OutfitHistoryEntry]


class SavedOutfitCreate(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=32)
    saved_at_timestamp: Optional[int] = Field(default=None, gt=0)

    @field_validator("item_ids")
    @classmethod
    def validate_saved_item_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("item_ids must be unique")
        if any(item_id <= 0 for item_id in value):
            raise ValueError("item_ids must contain positive integers")
        return value


class SavedOutfitEntry(BaseModel):
    id: int
    item_ids: list[int]
    saved_at_timestamp: int


class SavedOutfitListResponse(BaseModel):
    outfits: list[SavedOutfitEntry]


class PlannedOutfitCreate(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=32)
    planned_date: str = Field(min_length=10, max_length=10)
    occasion: Optional[str] = Field(default=None, max_length=128)
    created_at_timestamp: Optional[int] = Field(default=None, gt=0)

    @field_validator("item_ids")
    @classmethod
    def validate_planned_item_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("item_ids must be unique")
        if any(item_id <= 0 for item_id in value):
            raise ValueError("item_ids must contain positive integers")
        return value

    @field_validator("planned_date")
    @classmethod
    def validate_planned_date(cls, value: str) -> str:
        cleaned = value.strip()
        try:
            datetime.strptime(cleaned, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("planned_date must be in YYYY-MM-DD format") from exc
        return cleaned

    @field_validator("occasion")
    @classmethod
    def validate_occasion(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


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
