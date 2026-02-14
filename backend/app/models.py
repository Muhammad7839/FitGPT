from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # --- Profile / Preferences ---
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
    image_url = Column(String, nullable=True)

    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="wardrobe_items")