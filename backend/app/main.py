import logging
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from app.database.database import engine, Base
from app import models  # noqa: F401  # imported for SQLAlchemy table registration side effect
from app.config import CORS_ORIGINS, log_optional_config_warnings
from app.routes import router

logger = logging.getLogger(__name__)
app = FastAPI()
log_optional_config_warnings(logger)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "X-Auth-Attempt-Id"],
    expose_headers=["Content-Type"],
    max_age=600,
)


@app.middleware("http")
async def _apply_security_headers(request: Request, call_next) -> Response:
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response

Base.metadata.create_all(bind=engine)


def _ensure_runtime_schema() -> None:
    """Apply minimal additive schema changes for local environments without migrations."""
    # TODO: Replace this startup schema patching with reviewed migrations before production hardening.
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

    index_statements: list[str] = []
    if "clothing_items" in table_names:
        index_statements.extend(
            [
                "CREATE INDEX IF NOT EXISTS ix_clothing_items_owner_archived ON clothing_items (owner_id, is_archived)",
                "CREATE INDEX IF NOT EXISTS ix_clothing_items_owner_last_worn ON clothing_items (owner_id, last_worn_timestamp)",
            ]
        )
    if "outfit_history" in table_names:
        index_statements.append(
            "CREATE INDEX IF NOT EXISTS ix_outfit_history_owner_worn_at ON outfit_history (owner_id, worn_at_timestamp)"
        )
    if "saved_outfits" in table_names:
        index_statements.append(
            "CREATE INDEX IF NOT EXISTS ix_saved_outfits_owner_saved_at ON saved_outfits (owner_id, saved_at_timestamp)"
        )
    if "planned_outfits" in table_names:
        index_statements.append(
            "CREATE INDEX IF NOT EXISTS ix_planned_outfits_owner_date ON planned_outfits (owner_id, planned_date)"
        )
    if index_statements:
        with engine.begin() as connection:
            for sql in index_statements:
                connection.execute(text(sql))


_ensure_runtime_schema()

app.include_router(router)
uploads_dir = Path("uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        logger.exception("Health check database probe failed")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "degraded",
                "database": "unavailable",
            },
        )

    return {
        "status": "ok",
        "database": "ok",
    }


@app.get("/")
def root():
    return {"message": "FitGPT backend is running"}
