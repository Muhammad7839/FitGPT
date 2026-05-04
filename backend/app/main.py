import logging

from app.config import ENVIRONMENT, SENTRY_DSN


def _scrub_sentry_event(value):
    sensitive_keys = {"password", "token", "access_token", "refresh_token", "image_url"}
    if isinstance(value, dict):
        return {
            key: "[Filtered]" if str(key).lower() in sensitive_keys else _scrub_sentry_event(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_scrub_sentry_event(item) for item in value]
    return value


def _before_sentry_send(event, hint):
    return _scrub_sentry_event(event)


if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
        environment=ENVIRONMENT,
        before_send=_before_sentry_send,
    )

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from app.database.database import engine, Base
from app import models  # noqa: F401  # imported for SQLAlchemy table registration side effect
from app.config import CORS_ORIGINS, STORAGE_BACKEND, log_optional_config_warnings
from app.routes import router
from app.storage import LOCAL_UPLOAD_DIR

logger = logging.getLogger(__name__)
app = FastAPI()
log_optional_config_warnings(logger)


@app.middleware("http")
async def _suppress_internal_error_details(request: Request, call_next):
    """Never leak stack traces or DB messages to API clients."""
    try:
        return await call_next(request)
    except (StarletteHTTPException, RequestValidationError):
        raise
    except Exception:
        logger.exception("Unhandled error path=%s", request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )


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
    response.headers.setdefault(
        "Content-Security-Policy",
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://accounts.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https:; "
        "connect-src 'self' https://fitgpt-backend-tdiq.onrender.com https://api.groq.com; "
        "frame-ancestors 'none';"
    )
    return response

Base.metadata.create_all(bind=engine)


def _ensure_rate_limit_schema(inspector) -> None:
    """Keep auth rate limiting non-fatal when older databases miss this table."""
    try:
        models.RateLimitEvent.__table__.create(bind=engine, checkfirst=True)
    except SQLAlchemyError:
        logger.exception("Rate limit table creation failed; auth will continue without throttling")
        return

    table_names = set(inspector.get_table_names())
    if "rate_limit_events" not in table_names:
        if hasattr(inspector, "clear_cache"):
            inspector.clear_cache()
        else:
            inspector = inspect(engine)

    table_names = set(inspector.get_table_names())
    if "rate_limit_events" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("rate_limit_events")}
    pending_alters: list[str] = []
    if "key" not in columns:
        pending_alters.append("ALTER TABLE rate_limit_events ADD COLUMN key VARCHAR")
    if "event_type" not in columns:
        pending_alters.append("ALTER TABLE rate_limit_events ADD COLUMN event_type VARCHAR")
    if "created_at" not in columns:
        pending_alters.append("ALTER TABLE rate_limit_events ADD COLUMN created_at TIMESTAMP")

    if pending_alters:
        try:
            with engine.begin() as connection:
                for sql in pending_alters:
                    connection.execute(text(sql))
        except SQLAlchemyError:
            logger.exception("Rate limit schema patch failed; auth will continue without throttling")


def _ensure_runtime_schema() -> None:
    import os
    """Apply minimal additive schema changes for local environments without migrations."""
    # TODO: Replace this startup schema patching with reviewed migrations before production hardening.
    inspector = inspect(engine)
    _ensure_rate_limit_schema(inspector)

    if os.getenv("DATABASE_URL") and not os.getenv("RUN_SCHEMA_PATCH"):
        return

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
    if "style_preferences_json" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN style_preferences_json VARCHAR DEFAULT '[]'")
    if "comfort_preferences_json" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN comfort_preferences_json VARCHAR DEFAULT '[]'")
    if "dress_for_json" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN dress_for_json VARCHAR DEFAULT '[]'")
    if "gender" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN gender VARCHAR DEFAULT ''")
    if "height_cm" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN height_cm INTEGER")
    if "is_active" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT 1")
    if "is_verified" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT 0")
    if "onboarding_complete" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN onboarding_complete BOOLEAN DEFAULT 0")
    if "verification_token" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN verification_token VARCHAR")
    if "verification_token_expires_at" not in user_columns:
        user_alters.append("ALTER TABLE users ADD COLUMN verification_token_expires_at DATETIME")
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
if STORAGE_BACKEND == "local":
    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=LOCAL_UPLOAD_DIR), name="uploads")


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
