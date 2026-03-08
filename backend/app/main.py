from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.database.database import engine, Base
from app import models
from app.routes import router

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(router)
uploads_dir = Path("uploads")
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.get("/")
def root():
    return {"message": "FitGPT backend is running"}
