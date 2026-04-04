"""Pydantic request/response contracts for backend API routes."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# =============================
# User Schemas
# =============================

DEFAULT_BODY_TYPE = "unspecified"
DEFAULT_LIFESTYLE = "casual"
DEFAULT_COMFORT_PREFERENCE = "medium"


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


class UserLogin(BaseModel):
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
    avatar_url: Optional[str] = None
    body_type: str
    lifestyle: str
    comfort_preference: str
    onboarding_complete: bool

    model_config = ConfigDict(from_attributes=True)


class UserProfileSummaryResponse(BaseModel):
    id: int
    email: EmailStr
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    body_type: str
    lifestyle: str
    comfort_preference: str
    onboarding_complete: bool
    wardrobe_count: int
    active_wardrobe_count: int
    favorite_count: int
    saved_outfit_count: int
    planned_outfit_count: int
    history_count: int


class UserProfileUpdate(BaseModel):
    body_type: Optional[str] = Field(default=None, max_length=64)
    lifestyle: Optional[str] = Field(default=None, max_length=64)
    comfort_preference: Optional[str] = Field(default=None, max_length=64)
    onboarding_complete: Optional[bool] = None

    @field_validator("body_type", "lifestyle", "comfort_preference")
    @classmethod
    def normalize_optional_profile_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


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
    name: Optional[str] = Field(default=None, max_length=128)
    category: str = Field(min_length=1, max_length=64)
    clothing_type: Optional[str] = Field(default=None, max_length=64)
    layer_type: Optional[str] = Field(default=None, max_length=16)
    is_one_piece: bool = False
    set_identifier: Optional[str] = Field(default=None, max_length=64)
    fit_tag: Optional[str] = Field(default=None, max_length=32)
    color: str = Field(min_length=1, max_length=64)
    colors: list[str] = Field(default_factory=list, max_length=10)
    season: str = Field(min_length=1, max_length=32)
    season_tags: list[str] = Field(default_factory=list, max_length=8)
    style_tags: list[str] = Field(default_factory=list, max_length=12)
    occasion_tags: list[str] = Field(default_factory=list, max_length=12)
    accessory_type: Optional[str] = Field(default=None, max_length=32)
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

    @field_validator("name", "clothing_type", "fit_tag", "layer_type", "set_identifier", "accessory_type", "image_url", "brand")
    @classmethod
    def validate_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @field_validator("layer_type")
    @classmethod
    def validate_layer_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"base", "mid", "outer"}:
            raise ValueError("layer_type must be base/mid/outer")
        return normalized

    @field_validator("style_tags", "season_tags", "colors", "occasion_tags")
    @classmethod
    def normalize_tag_list(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in value:
            cleaned = raw.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(cleaned)
        return normalized


class ClothingItemResponse(BaseModel):
    id: int
    name: Optional[str] = None
    category: str
    clothing_type: Optional[str] = None
    layer_type: Optional[str] = None
    is_one_piece: bool = False
    set_identifier: Optional[str] = None
    fit_tag: Optional[str] = None
    color: str
    colors: list[str] = Field(default_factory=list)
    season: str
    season_tags: list[str] = Field(default_factory=list)
    style_tags: list[str] = Field(default_factory=list)
    occasion_tags: list[str] = Field(default_factory=list)
    suggested_clothing_type: Optional[str] = None
    suggested_fit_tag: Optional[str] = None
    suggested_colors: list[str] = Field(default_factory=list)
    suggested_season_tags: list[str] = Field(default_factory=list)
    suggested_style_tags: list[str] = Field(default_factory=list)
    suggested_occasion_tags: list[str] = Field(default_factory=list)
    accessory_type: Optional[str] = None
    comfort_level: int
    image_url: Optional[str] = None
    brand: Optional[str] = None
    is_available: bool
    is_favorite: bool
    is_archived: bool
    last_worn_timestamp: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ClothingItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=128)
    category: Optional[str] = Field(default=None, min_length=1, max_length=64)
    clothing_type: Optional[str] = Field(default=None, max_length=64)
    layer_type: Optional[str] = Field(default=None, max_length=16)
    is_one_piece: Optional[bool] = None
    set_identifier: Optional[str] = Field(default=None, max_length=64)
    fit_tag: Optional[str] = Field(default=None, max_length=32)
    color: Optional[str] = Field(default=None, min_length=1, max_length=64)
    colors: Optional[list[str]] = Field(default=None, max_length=10)
    season: Optional[str] = Field(default=None, min_length=1, max_length=32)
    season_tags: Optional[list[str]] = Field(default=None, max_length=8)
    style_tags: Optional[list[str]] = Field(default=None, max_length=12)
    occasion_tags: Optional[list[str]] = Field(default=None, max_length=12)
    accessory_type: Optional[str] = Field(default=None, max_length=32)
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

    @field_validator("name", "clothing_type", "fit_tag", "layer_type", "set_identifier", "accessory_type", "image_url", "brand")
    @classmethod
    def validate_optional_free_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @field_validator("layer_type")
    @classmethod
    def validate_optional_layer_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"base", "mid", "outer"}:
            raise ValueError("layer_type must be base/mid/outer")
        return normalized

    @field_validator("style_tags", "season_tags", "colors", "occasion_tags")
    @classmethod
    def normalize_optional_tag_list(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return None
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in value:
            cleaned = raw.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key in seen:
                continue
            seen.add(key)
            normalized.append(cleaned)
        return normalized


class FavoriteToggleRequest(BaseModel):
    is_favorite: bool


class BulkCreateClothingItemsRequest(BaseModel):
    items: list[ClothingItemCreate] = Field(min_length=1, max_length=100)


class BulkCreateItemResult(BaseModel):
    index: int
    status: str
    item: Optional[ClothingItemResponse] = None
    error: Optional[str] = None


class BulkCreateClothingItemsResponse(BaseModel):
    results: list[BulkCreateItemResult]


class ImageUploadResponse(BaseModel):
    image_url: str


class AvatarUploadResponse(BaseModel):
    avatar_url: str


class ImageBatchUploadEntry(BaseModel):
    file_name: str
    status: str
    image_url: Optional[str] = None
    error: Optional[str] = None


class ImageBatchUploadResponse(BaseModel):
    results: list[ImageBatchUploadEntry]


class TagSuggestionsResponse(BaseModel):
    item_id: Optional[int] = None
    generated: bool
    suggested_clothing_type: Optional[str] = None
    suggested_fit_tag: Optional[str] = None
    suggested_colors: list[str] = Field(default_factory=list)
    suggested_season_tags: list[str] = Field(default_factory=list)
    suggested_style_tags: list[str] = Field(default_factory=list)
    suggested_occasion_tags: list[str] = Field(default_factory=list)


class WardrobeGapSuggestion(BaseModel):
    category: str
    item_name: str
    reason: str
    image_url: Optional[str] = None
    shopping_link: str


class WardrobeGapResponse(BaseModel):
    baseline_categories: list[str] = Field(default_factory=list)
    category_counts: dict[str, int] = Field(default_factory=dict)
    missing_categories: list[str] = Field(default_factory=list)
    suggestions: list[WardrobeGapSuggestion] = Field(default_factory=list)
    insufficient_data: bool = False


class UnderusedItemAlert(BaseModel):
    item_id: int
    item_name: str
    category: str
    wear_count: int
    last_worn_timestamp: Optional[int] = None
    days_since_worn: Optional[int] = None
    alert_level: str


class UnderusedAlertsResponse(BaseModel):
    generated_at_timestamp: int
    analysis_window_days: int
    alerts: list[UnderusedItemAlert] = Field(default_factory=list)
    insufficient_data: bool = False


class RecommendationResponse(BaseModel):
    items: list[ClothingItemResponse]
    explanation: str
    outfit_score: float = 0.0
    confidence_score: float = 0.0
    weather_category: Optional[str] = None
    occasion: Optional[str] = None
    prompt_feedback: Optional["FeedbackPromptMetadata"] = None


class OutfitOptionResponse(BaseModel):
    items: list[ClothingItemResponse]
    explanation: str
    outfit_score: float
    confidence_score: float


class RecommendationOptionsResponse(BaseModel):
    outfits: list[OutfitOptionResponse]
    weather_category: str
    occasion: Optional[str] = None


class RejectOutfitRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=12)
    suggestion_id: Optional[str] = Field(default=None, max_length=128)
    reason: Optional[str] = Field(default=None, max_length=160)

    @field_validator("suggestion_id", "reason")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


class FeedbackPromptMetadata(BaseModel):
    should_prompt: bool
    reason: str
    cooldown_seconds_remaining: int = 0


class FeedbackPromptEventCreate(BaseModel):
    event_type: str = Field(min_length=1, max_length=32)
    suggestion_id: Optional[str] = Field(default=None, max_length=128)

    @field_validator("event_type")
    @classmethod
    def validate_event_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"shown", "ignored", "dismissed", "accepted"}:
            raise ValueError("event_type must be shown/ignored/dismissed/accepted")
        return normalized

    @field_validator("suggestion_id")
    @classmethod
    def normalize_suggestion_id(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None


class RejectOutfitResponse(BaseModel):
    detail: str
    fingerprint: str
    similarity_key: str
    created: bool


class FeedbackPromptEventResponse(BaseModel):
    detail: str


class ChatMessage(BaseModel):
    role: str = Field(min_length=1, max_length=16)
    content: str = Field(min_length=1, max_length=1200)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"user", "assistant", "system"}:
            raise ValueError("role must be one of: user, assistant, system")
        return normalized

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("content cannot be blank")
        return cleaned


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)


class ChatResponse(BaseModel):
    reply: str
    source: str
    fallback_used: bool = False
    warning: Optional[str] = None


class AiRecommendationRequest(BaseModel):
    manual_temp: Optional[int] = Field(default=None, ge=-30, le=130)
    time_context: Optional[str] = Field(default=None, max_length=64)
    plan_date: Optional[str] = Field(default=None, max_length=10)
    exclude: Optional[str] = Field(default=None, max_length=256)
    weather_city: Optional[str] = Field(default=None, max_length=128)
    weather_lat: Optional[float] = None
    weather_lon: Optional[float] = None
    weather_category: Optional[str] = Field(default=None, max_length=16)
    occasion: Optional[str] = Field(default=None, max_length=128)
    style_preference: Optional[str] = Field(default=None, max_length=64)
    preferred_seasons: list[str] = Field(default_factory=list, max_length=6)

    @field_validator("time_context", "exclude", "weather_city", "occasion", "style_preference")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @field_validator("weather_category")
    @classmethod
    def validate_weather_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip().lower()
        if not normalized:
            return None
        if normalized not in {"cold", "cool", "mild", "warm", "hot"}:
            raise ValueError("weather_category must be cold/cool/mild/warm/hot")
        return normalized

    @field_validator("plan_date")
    @classmethod
    def validate_optional_plan_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        try:
            datetime.strptime(cleaned, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("plan_date must be in YYYY-MM-DD format") from exc
        return cleaned

    @field_validator("preferred_seasons")
    @classmethod
    def normalize_seasons(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in value:
            cleaned = raw.strip()
            if not cleaned:
                continue
            key = cleaned.lower()
            if key not in seen:
                normalized.append(cleaned)
                seen.add(key)
        return normalized


class AiRecommendationItemExplanation(BaseModel):
    item_id: int
    explanation: str


class AiRecommendationResponse(BaseModel):
    items: list[ClothingItemResponse]
    explanation: str
    outfit_score: float = 0.0
    confidence_score: float = 0.0
    weather_category: str
    occasion: Optional[str] = None
    source: str
    fallback_used: bool = False
    warning: Optional[str] = None
    suggestion_id: str
    item_explanations: list[AiRecommendationItemExplanation] = Field(default_factory=list)
    outfit_options: list[OutfitOptionResponse] = Field(default_factory=list)
    prompt_feedback: Optional[FeedbackPromptMetadata] = None


class RecommendationFeedbackCreate(BaseModel):
    suggestion_id: str = Field(min_length=3, max_length=256)
    signal: str = Field(min_length=4, max_length=16)
    item_ids: Optional[list[int]] = Field(default=None, min_length=1, max_length=32)

    @field_validator("suggestion_id")
    @classmethod
    def normalize_suggestion_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("suggestion_id cannot be blank")
        return cleaned

    @field_validator("signal")
    @classmethod
    def normalize_signal(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"like", "dislike", "reject"}:
            raise ValueError("signal must be like/dislike/reject")
        return normalized

    @field_validator("item_ids")
    @classmethod
    def validate_optional_item_ids(cls, value: Optional[list[int]]) -> Optional[list[int]]:
        if value is None:
            return value
        if len(set(value)) != len(value):
            raise ValueError("item_ids must be unique")
        if any(item_id <= 0 for item_id in value):
            raise ValueError("item_ids must contain positive integers")
        return value


class RecommendationFeedbackResponse(BaseModel):
    detail: str
    suggestion_id: str
    signal: str


class DashboardContextWeather(BaseModel):
    city: str
    temperature_f: int
    weather_category: str
    condition: str
    description: str


class DashboardContextResponse(BaseModel):
    weather: Optional[DashboardContextWeather] = None
    status: str
    detail: Optional[str] = None


class CompatWardrobeItemInput(BaseModel):
    id: str
    name: Optional[str] = ""
    category: Optional[str] = ""
    color: Optional[str] = ""
    fit_type: Optional[str] = ""
    style_tag: Optional[str] = ""


class CompatAiContext(BaseModel):
    weather_category: Optional[str] = "mild"
    time_category: Optional[str] = "work hours"
    occasion: Optional[str] = "daily"
    body_type: Optional[str] = DEFAULT_BODY_TYPE
    style_preferences: list[str] = Field(default_factory=list)

    @field_validator("weather_category")
    @classmethod
    def normalize_weather_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip().lower()
        if not cleaned:
            return None
        if cleaned not in {"cold", "cool", "mild", "warm", "hot"}:
            raise ValueError("weather_category must be cold/cool/mild/warm/hot")
        return cleaned

    @field_validator("time_category", "occasion", "body_type")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        cleaned = value.strip()
        return cleaned or None

    @field_validator("style_preferences")
    @classmethod
    def normalize_style_preferences(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw in values:
            cleaned = raw.strip()
            if not cleaned:
                continue
            lowered = cleaned.lower()
            if lowered in seen:
                continue
            seen.add(lowered)
            normalized.append(cleaned)
        return normalized


class CompatAiRecommendationRequest(BaseModel):
    items: list[CompatWardrobeItemInput] = Field(default_factory=list, max_length=256)
    context: Optional[CompatAiContext] = None


class CompatAiOutfit(BaseModel):
    item_ids: list[str]
    explanation: str


class CompatAiRecommendationResponse(BaseModel):
    source: str
    outfits: list[CompatAiOutfit]
    fallback_used: bool = False
    warning: Optional[str] = None


class WeatherCurrentResponse(BaseModel):
    city: str
    temperature_f: int
    weather_category: str
    condition: str
    description: str


class TripPackingRequest(BaseModel):
    destination_city: str = Field(min_length=1, max_length=128)
    start_date: str = Field(min_length=10, max_length=10)
    trip_days: int = Field(ge=1, le=30)

    @field_validator("destination_city")
    @classmethod
    def validate_destination_city(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("destination_city cannot be blank")
        return cleaned

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, value: str) -> str:
        cleaned = value.strip()
        try:
            datetime.strptime(cleaned, "%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("start_date must be in YYYY-MM-DD format") from exc
        return cleaned


class TripPackingItem(BaseModel):
    category: str
    recommended_quantity: int
    selected_item_ids: list[int] = Field(default_factory=list)
    selected_item_names: list[str] = Field(default_factory=list)
    missing_quantity: int = 0


class TripPackingResponse(BaseModel):
    destination_city: str
    start_date: str
    trip_days: int
    weather_summary: str
    items: list[TripPackingItem] = Field(default_factory=list)
    generated_at_timestamp: int
    insufficient_data: bool = False


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


class OutfitHistoryUpdate(BaseModel):
    item_ids: Optional[list[int]] = Field(default=None, min_length=1, max_length=32)
    worn_at_timestamp: Optional[int] = Field(default=None, gt=0)

    @field_validator("item_ids")
    @classmethod
    def validate_optional_item_ids(cls, value: Optional[list[int]]) -> Optional[list[int]]:
        if value is None:
            return value
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


class PlannedOutfitAssignmentRequest(BaseModel):
    item_ids: list[int] = Field(min_length=1, max_length=32)
    planned_dates: list[str] = Field(min_length=1, max_length=31)
    occasion: Optional[str] = Field(default=None, max_length=128)
    replace_existing: bool = True
    created_at_timestamp: Optional[int] = Field(default=None, gt=0)

    @field_validator("item_ids")
    @classmethod
    def validate_assignment_item_ids(cls, value: list[int]) -> list[int]:
        if len(set(value)) != len(value):
            raise ValueError("item_ids must be unique")
        if any(item_id <= 0 for item_id in value):
            raise ValueError("item_ids must contain positive integers")
        return value

    @field_validator("planned_dates")
    @classmethod
    def validate_planned_dates(cls, values: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for raw_value in values:
            cleaned = raw_value.strip()
            try:
                datetime.strptime(cleaned, "%Y-%m-%d")
            except ValueError as exc:
                raise ValueError("planned_dates must use YYYY-MM-DD format") from exc
            if cleaned not in seen:
                normalized.append(cleaned)
                seen.add(cleaned)
        return normalized

    @field_validator("occasion")
    @classmethod
    def validate_assignment_occasion(cls, value: Optional[str]) -> Optional[str]:
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


class PlannedOutfitAssignmentResponse(BaseModel):
    detail: str
    planned_dates: list[str]
    outfits: list[PlannedOutfitEntry]
