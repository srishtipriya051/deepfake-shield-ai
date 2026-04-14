from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

# backend/deepfake_local.db — stable path regardless of shell cwd. Override with DATABASE_URL.
_backend_dir = Path(__file__).resolve().parent.parent.parent
_default_sqlite = _backend_dir / "deepfake_local.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_default_sqlite.as_posix()}")

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)