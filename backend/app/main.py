from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func

from backend.app.database.base import Base
from backend.app.database.connection import SessionLocal, engine
from backend.app.models.user import User
from backend.app.routes.analyze import router as analyze_router
from backend.app.routes.auth import router as auth_router
from backend.app.utils.security import hash_password


def seed_demo_user() -> None:
    email = os.getenv("DEMO_EMAIL", "demo@deepfake.ai").strip().lower()
    password = os.getenv("DEMO_PASSWORD", "Demo@1234")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(func.lower(User.email) == email).first()
        if not existing:
            db.add(User(email=email, password=hash_password(password)))
            db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    seed_demo_user()
    yield


Base.metadata.create_all(bind=engine)

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(analyze_router)


@app.get("/")
def home():
    return {"message": "Backend running"}
