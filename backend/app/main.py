from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
<<<<<<< HEAD
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
=======
from app.routes.auth import router as auth_router

app = FastAPI()

# ✅ CORS (VERY IMPORTANT for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change later to frontend URL
>>>>>>> origin/main
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< HEAD
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
=======
# ✅ include routes
app.include_router(auth_router)

@app.get("/")
def home():
    return {"message": "Backend running 🚀"}
>>>>>>> origin/main
