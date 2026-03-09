from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from app.database.database import engine, Base
from app import models
from app.routes import router

app = FastAPI()

Base.metadata.create_all(bind=engine)


def _ensure_runtime_schema() -> None:
    """Apply minimal additive schema changes for local environments without migrations."""
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    if "avatar_url" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))


_ensure_runtime_schema()

app.include_router(router)
uploads_dir = Path("uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
def root():
    return {"message": "FitGPT backend is running"}
