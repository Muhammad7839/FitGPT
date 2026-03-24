"""SQLAlchemy ORM entities for users, wardrobe items, and outfit records."""

import json
from typing import Optional

from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    auth_provider = Column(String, default="email")

    # Profile / Preferences
    body_type = Column(String, default="unspecified")
    lifestyle = Column(String, default="casual")
    comfort_preference = Column(String, default="medium")

    is_active = Column(Boolean, default=True)
    onboarding_complete = Column(Boolean, default=False)
    reset_token_hash = Column(String, nullable=True)
    reset_token_expires_at = Column(Integer, nullable=True)

    wardrobe_items = relationship(
        "ClothingItem",
        back_populates="owner",
        cascade="all, delete-orphan"
    )


class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=True)
    category = Column(String, nullable=False)
    clothing_type = Column(String, nullable=True)
    layer_type = Column(String, nullable=True)
    is_one_piece = Column(Boolean, nullable=False, default=False)
    set_identifier = Column(String, nullable=True)
    fit_tag = Column(String, nullable=True)
    color = Column(String, nullable=False)
    colors_json = Column(String, nullable=False, default="[]")
    season = Column(String, nullable=False, default="All")
    season_tags_json = Column(String, nullable=False, default="[]")
    style_tags_json = Column(String, nullable=False, default="[]")
    occasion_tags_json = Column(String, nullable=False, default="[]")
    accessory_type = Column(String, nullable=True)
    comfort_level = Column(Integer, nullable=False, default=3)

    fit_type = Column(String, nullable=False, default="regular")
    style_tag = Column(String, nullable=False, default="casual")

    image_url = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    is_available = Column(Boolean, nullable=False, default=True)
    is_favorite = Column(Boolean, nullable=False, default=False)
    is_archived = Column(Boolean, nullable=False, default=False)
    last_worn_timestamp = Column(Integer, nullable=True)

    is_deleted = Column(Boolean, default=False, nullable=False)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    owner = relationship("User", back_populates="wardrobe_items")

    @staticmethod
    def _decode_json_list(raw: Optional[str]) -> list[str]:
        if not raw:
            return []
        try:
            value = json.loads(raw)
        except (TypeError, ValueError):
            return []
        if not isinstance(value, list):
            return []
        normalized: list[str] = []
        for entry in value:
            text = str(entry).strip()
            if text:
                normalized.append(text)
        return normalized

    @staticmethod
    def _encode_json_list(values: list[str]) -> str:
        return json.dumps(values, ensure_ascii=False)

    @property
    def style_tags(self) -> list[str]:
        return self._decode_json_list(self.style_tags_json)

    @style_tags.setter
    def style_tags(self, values: list[str]) -> None:
        self.style_tags_json = self._encode_json_list(values)

    @property
    def season_tags(self) -> list[str]:
        values = self._decode_json_list(self.season_tags_json)
        if values:
            return values
        if self.season and self.season.strip():
            return [self.season.strip()]
        return []

    @season_tags.setter
    def season_tags(self, values: list[str]) -> None:
        self.season_tags_json = self._encode_json_list(values)

    @property
    def colors(self) -> list[str]:
        values = self._decode_json_list(self.colors_json)
        if values:
            return values
        if self.color and self.color.strip():
            return [self.color.strip()]
        return []

    @colors.setter
    def colors(self, values: list[str]) -> None:
        self.colors_json = self._encode_json_list(values)

    @property
    def occasion_tags(self) -> list[str]:
        return self._decode_json_list(self.occasion_tags_json)

    @occasion_tags.setter
    def occasion_tags(self, values: list[str]) -> None:
        self.occasion_tags_json = self._encode_json_list(values)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)


class OutfitHistory(Base):
    __tablename__ = "outfit_history"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_ids_csv = Column(String, nullable=False)
    worn_at_timestamp = Column(Integer, nullable=False)


class SavedOutfit(Base):
    __tablename__ = "saved_outfits"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_ids_csv = Column(String, nullable=False)
    saved_at_timestamp = Column(Integer, nullable=False)


class PlannedOutfit(Base):
    __tablename__ = "planned_outfits"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_ids_csv = Column(String, nullable=False)
    planned_date = Column(String, nullable=False)
    occasion = Column(String, nullable=True)
    created_at_timestamp = Column(Integer, nullable=False)


class RecommendationFingerprint(Base):
    """Tracks recently served recommendation combinations per user."""

    __tablename__ = "recommendation_fingerprints"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    fingerprint = Column(String, nullable=False, index=True)
    created_at_timestamp = Column(Integer, nullable=False, index=True)
