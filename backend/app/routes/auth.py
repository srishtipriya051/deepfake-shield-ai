from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from backend.app.database.connection import SessionLocal
from backend.app.models.user import User
from backend.app.schemas.user import UserCreate, UserLogin, UserForgotPassword
from backend.app.utils.security import hash_password, verify_password, create_access_token

router = APIRouter()


def _normalize_email(value: str) -> str:
    return value.strip().lower()


# DB Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ Signup
@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    email = _normalize_email(user.email)
    existing = db.query(User).filter(func.lower(User.email) == email).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=email,
        password=hash_password(user.password)
    )

    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")
    db.refresh(new_user)

    return {"message": "User created successfully"}

# ✅ Login
@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    email = _normalize_email(user.email)
    db_user = db.query(User).filter(func.lower(User.email) == email).first()

    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": db_user.email})

    return {"access_token": token, "token_type": "bearer"}

@router.post("/forgot-password")
def forgot_password(payload: UserForgotPassword, db: Session = Depends(get_db)):
    email = _normalize_email(payload.email)
    db_user = db.query(User).filter(func.lower(User.email) == email).first()

    if not db_user:
        raise HTTPException(status_code=404, detail="Email not found")

    db_user.password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
