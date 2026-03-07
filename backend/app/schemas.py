"""Pydantic request/response models used by API routes."""

from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional

class UserCreate(BaseModel):
    """Payload for account registration."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Serialized user profile returned from API endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    body_type: str
    lifestyle: str
    comfort_preference: str
    onboarding_complete: bool


class UserProfileUpdate(BaseModel):
    """Partial update payload for onboarding/profile preferences."""

    body_type: Optional[str] = None
    lifestyle: Optional[str] = None
    comfort_preference: Optional[str] = None
    onboarding_complete: Optional[bool] = None

class Token(BaseModel):
    """JWT bearer token response."""

    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Decoded token payload content."""

    user_id: Optional[int] = None


class GoogleLoginRequest(BaseModel):
    """Payload for Google ID token login."""

    id_token: str

class ClothingItemCreate(BaseModel):
    """Create/update payload for a wardrobe item."""

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
    """Wardrobe item returned to API consumers."""

    model_config = ConfigDict(from_attributes=True)

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


class ClothingItemUpdate(BaseModel):
    """Partial update payload for a wardrobe item edited from UI workflows."""

    category: Optional[str] = None
    color: Optional[str] = None
    season: Optional[str] = None
    comfort_level: Optional[int] = None
    image_url: Optional[str] = None
    brand: Optional[str] = None
    is_available: Optional[bool] = None
    is_archived: Optional[bool] = None
    last_worn_timestamp: Optional[int] = None


class RecommendationResponse(BaseModel):
    """Recommendation response containing selected items and explanation."""

    items: list[ClothingItemResponse]
    explanation: str


class OutfitHistoryCreate(BaseModel):
    """Payload for recording an outfit as worn."""

    item_ids: list[int]
    worn_at_timestamp: int


class OutfitHistoryResponse(BaseModel):
    """Simple acknowledgement response for history recording."""

    detail: str


class SavedOutfitCreate(BaseModel):
    """Payload for saving a recommended outfit."""

    item_ids: list[int]
    saved_at_timestamp: Optional[int] = None


class SavedOutfitEntry(BaseModel):
    """Saved outfit returned to clients."""

    id: int
    item_ids: list[int]
    saved_at_timestamp: int


class SavedOutfitListResponse(BaseModel):
    """Collection response for saved outfits."""

    outfits: list[SavedOutfitEntry]
