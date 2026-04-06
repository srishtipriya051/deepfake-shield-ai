from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.database.connection import engine, SessionLocal
from backend.app.database.base import Base
from backend.app.routes import auth
from backend.app.models.user import User
from backend.app.utils.security import hash_password
import os

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)

@app.on_event("startup")
def seed_demo_user():
    email = os.getenv("DEMO_EMAIL", "demo@deepfake.ai")
    password = os.getenv("DEMO_PASSWORD", "Demo@1234")

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if not existing:
            db.add(User(email=email, password=hash_password(password)))
            db.commit()
    finally:
        db.close()
