import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database.database import engine, Base
from app import models
from app.routes import router, auth_router

app = FastAPI()

origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
extra_origins = os.environ.get("CORS_ORIGINS", "")
if extra_origins:
    origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

# Add columns that create_all won't add to existing tables
from sqlalchemy import inspect, text
with engine.connect() as conn:
    inspector = inspect(engine)
    existing = {c["name"] for c in inspector.get_columns("users")}
    if "google_id" not in existing:
        conn.execute(text("ALTER TABLE users ADD COLUMN google_id VARCHAR"))
        conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users (google_id)"))
    if "auth_provider" not in existing:
        conn.execute(text("ALTER TABLE users ADD COLUMN auth_provider VARCHAR DEFAULT 'email'"))
    if existing and "hashed_password" in existing:
        # Make hashed_password nullable for Google-only users
        try:
            conn.execute(text("ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL"))
        except Exception:
            pass  # SQLite doesn't support ALTER COLUMN; column is already nullable in new DBs
    conn.commit()

app.include_router(router)
app.include_router(auth_router)

@app.get("/")
def root():
    return {"message": "FitGPT backend is running"}