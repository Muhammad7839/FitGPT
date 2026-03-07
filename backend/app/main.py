"""FastAPI application entrypoint and router registration."""

from fastapi import FastAPI
from app.database.database import engine, Base
from app import models  # noqa: F401 - imported so SQLAlchemy models register with metadata.
from app.routes import router

app = FastAPI()

# Creates missing tables for local/dev usage.
Base.metadata.create_all(bind=engine)

app.include_router(router)


@app.get("/")
def root():
    """Health-style endpoint used by local checks."""
    return {"message": "FitGPT backend is running"}
