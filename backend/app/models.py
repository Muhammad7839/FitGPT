from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=False)

    # --- Profile / Preferences ---
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

    category = Column(String, nullable=False)
    color = Column(String, nullable=False)
    season = Column(String, nullable=False, default="All")
    comfort_level = Column(Integer, nullable=False, default=3)
    image_url = Column(String, nullable=True)
    brand = Column(String, nullable=True)
    is_available = Column(Boolean, nullable=False, default=True)
    is_favorite = Column(Boolean, nullable=False, default=False)
    is_archived = Column(Boolean, nullable=False, default=False)
    last_worn_timestamp = Column(Integer, nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="wardrobe_items")


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
