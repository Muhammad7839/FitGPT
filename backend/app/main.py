import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError, ProgrammingError
from app.database.database import engine, Base
from app import models
from app.routes import router

logger = logging.getLogger(__name__)

app = FastAPI()

_DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://fit-gpt-i3co.vercel.app",
    "https://www.fitgpt.tech",
]


def _parse_origins(raw: str) -> list[str]:
    return [item.strip() for item in raw.split(",") if item.strip()]


_cors_env = os.getenv("CORS_ORIGINS", "").strip()
origins = _parse_origins(_cors_env) if _cors_env else _DEFAULT_ORIGINS

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
    user_alters: list[str] = []
    if "avatar_url" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN avatar_url VARCHAR")
    if "full_name" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN full_name VARCHAR")
    if "body_type" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN body_type VARCHAR DEFAULT 'unspecified'")
    if "lifestyle" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN lifestyle VARCHAR DEFAULT 'casual'")
    if "comfort_preference" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN comfort_preference VARCHAR DEFAULT 'medium'")
    if "is_active" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
    if "onboarding_complete" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN DEFAULT 0")
    if "reset_token_hash" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN reset_token_hash VARCHAR")
    if "reset_token_expires_at" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN reset_token_expires_at INTEGER")
    if user_alters:
        with engine.begin() as connection:
            for sql in user_alters:
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
        if "accessory_type" not in clothing_columns:
            pending_alters.append("ALTER TABLE clothing_items ADD COLUMN accessory_type VARCHAR")
        for sql in pending_alters:
            try:
                with engine.begin() as connection:
                    connection.execute(text(sql))
            except (OperationalError, ProgrammingError) as exc:
                # Another worker may have raced to ADD COLUMN — tolerate duplicate.
                logger.info("Skipping additive migration %r (%s)", sql, exc)

    # Additive indexes for common filter columns. CREATE INDEX IF NOT EXISTS is
    # supported by both SQLite and PostgreSQL, so the same statement works.
    index_statements = [
        "CREATE INDEX IF NOT EXISTS ix_clothing_items_owner_id ON clothing_items (owner_id)",
        "CREATE INDEX IF NOT EXISTS ix_clothing_items_owner_archived ON clothing_items (owner_id, is_archived)",
        "CREATE INDEX IF NOT EXISTS ix_clothing_items_owner_favorite ON clothing_items (owner_id, is_favorite)",
        "CREATE INDEX IF NOT EXISTS ix_outfit_history_owner_id ON outfit_history (owner_id)",
        "CREATE INDEX IF NOT EXISTS ix_saved_outfits_owner_id ON saved_outfits (owner_id)",
        "CREATE INDEX IF NOT EXISTS ix_planned_outfits_owner_id ON planned_outfits (owner_id)",
    ]
    for sql in index_statements:
        try:
            with engine.begin() as connection:
                connection.execute(text(sql))
        except (OperationalError, ProgrammingError) as exc:
            logger.info("Skipping index migration %r (%s)", sql, exc)


_ensure_runtime_schema()


@app.get("/health")
def healthcheck() -> dict:
    """Lightweight health check — probes DB connectivity."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:  # noqa: BLE001
        logger.warning("Health check DB probe failed: %s", exc)
        db_status = "error"
    return {"status": "ok" if db_status == "ok" else "degraded", "db": db_status}

app.include_router(router)
uploads_dir = Path("uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
def root():
    return {"message": "FitGPT backend is running"}
