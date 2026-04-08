from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# Default to a local (git-ignored) dev database. Override with DATABASE_URL if needed.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./deepfake_local.db")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)