from datetime import datetime

from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime
from sqlalchemy.orm import relationship
from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

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