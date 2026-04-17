import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from app.database.database import engine, Base
from app import models
from app.config import log_optional_config_warnings
from app.routes import router

logger = logging.getLogger(__name__)
app = FastAPI()
log_optional_config_warnings(logger)

origins = [
    "https://fit-gpt-i3co.vercel.app",
    "https://www.fitgpt.tech"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def _ensure_runtime_schema() -> None:
    """Apply minimal additive schema changes for local environments without migrations."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    pending_user_alters: list[str] = []
    if "avatar_url" not in user_columns:
        pending_user_alters.append("ALTER TABLE users ADD COLUMN avatar_url VARCHAR")
    if "style_preferences_json" not in user_columns:
        pending_user_alters.append("ALTER TABLE users ADD COLUMN style_preferences_json VARCHAR DEFAULT '[]'")
    if "comfort_preferences_json" not in user_columns:
        pending_user_alters.append("ALTER TABLE users ADD COLUMN comfort_preferences_json VARCHAR DEFAULT '[]'")
    if "dress_for_json" not in user_columns:
        pending_user_alters.append("ALTER TABLE users ADD COLUMN dress_for_json VARCHAR DEFAULT '[]'")
    if "gender" not in user_columns:
        pending_user_alters.append("ALTER TABLE users ADD COLUMN gender VARCHAR DEFAULT ''")
    if "height_cm" not in user_columns:
        pending_user_alters.append("ALTER TABLE users ADD COLUMN height_cm INTEGER")
    if pending_user_alters:
        with engine.begin() as connection:
            for sql in pending_user_alters:
                connection.execute(text(sql))

    if "clothing_items" in table_names:
        clothing_columns = {column["name"] for column in inspector.get_columns("clothing_items")}
        pending_alters: list[str] = []
        if "layer_type" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN layer_type VARCHAR")
        if "is_one_piece" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN is_one_piece BOOLEAN DEFAULT 0")
        if "set_identifier" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN set_identifier VARCHAR")
        if "style_tags_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN style_tags_json VARCHAR DEFAULT '[]'")
        if "season_tags_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN season_tags_json VARCHAR DEFAULT '[]'")
        if "colors_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN colors_json VARCHAR DEFAULT '[]'")
        if "occasion_tags_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN occasion_tags_json VARCHAR DEFAULT '[]'")
        if "suggested_clothing_type" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN suggested_clothing_type VARCHAR")
        if "suggested_fit_tag" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN suggested_fit_tag VARCHAR")
        if "suggested_colors_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN suggested_colors_json VARCHAR DEFAULT '[]'")
        if "suggested_season_tags_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN suggested_season_tags_json VARCHAR DEFAULT '[]'")
        if "suggested_style_tags_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN suggested_style_tags_json VARCHAR DEFAULT '[]'")
        if "suggested_occasion_tags_json" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN suggested_occasion_tags_json VARCHAR DEFAULT '[]'")
        if "accessory_type" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN accessory_type VARCHAR")
        if pending_alters:
            with engine.begin() as connection:
                for sql in pending_alters:
                    connection.execute(text(sql))


_ensure_runtime_schema()

app.include_router(router)
uploads_dir = Path("uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
def root():
    return {"message": "FitGPT backend is running"}
