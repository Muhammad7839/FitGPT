from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Text, Float
from sqlalchemy.orm import relationship
from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    google_id = Column(String, unique=True, index=True, nullable=True)
    auth_provider = Column(String, default="email")

    # Profile / Preferences
    body_type = Column(String, default="unspecified")
    lifestyle = Column(String, default="casual")
    comfort_preference = Column(String, default="medium")

    is_active = Column(Boolean, default=True)
    onboarding_complete = Column(Boolean, default=False)

    wardrobe_items = relationship(
        "ClothingItem",
        back_populates="owner",
        cascade="all, delete-orphan"
    )


class ClothingItem(Base):
    __tablename__ = "clothing_items"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    color = Column(String, nullable=False)

    fit_type = Column(String, nullable=False, default="regular")
    style_tag = Column(String, nullable=False, default="casual")

    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_favorite = Column(Boolean, default=False, nullable=False)

    is_deleted = Column(Boolean, default=False, nullable=False)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    owner = relationship("User", back_populates="wardrobe_items")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)

class SavedOutfit(Base):
    __tablename__ = "saved_outfits"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    outfit_signature = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False, default="")
    items_json = Column(Text, nullable=False)
    item_details_json = Column(Text, nullable=False, default="[]")
    source = Column(String, nullable=False, default="recommended")
    context_json = Column(Text, nullable=False, default="{}")
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class OutfitHistoryEntry(Base):
    __tablename__ = "outfit_history_entries"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    item_ids_json = Column(Text, nullable=False)
    source = Column(String, nullable=False, default="recommendation")
    context_json = Column(Text, nullable=False, default="{}")
    confidence_score = Column(Float, nullable=True)
    worn_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class PlannedOutfit(Base):
    __tablename__ = "planned_outfits"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    outfit_signature = Column(String, nullable=False, index=True)
    item_ids_json = Column(Text, nullable=False)
    item_details_json = Column(Text, nullable=False, default="[]")
    planned_date = Column(String, nullable=False, default="")
    occasion = Column(String, nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    source = Column(String, nullable=False, default="planner")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
