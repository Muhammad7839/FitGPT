from fastapi import FastAPI
from app.database.database import engine, Base
from app import models
from app.routes import router

app = FastAPI()

Base.metadata.create_all(bind=engine)

app.include_router(router)

@app.get("/")
def root():
    return {"message": "FitGPT backend is running"}