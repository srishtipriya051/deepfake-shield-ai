from sqlalchemy import create_engine
<<<<<<< HEAD
from sqlalchemy.orm import sessionmaker
import os
=======
from sqlalchemy.orm import sessionmaker, declarative_base
>>>>>>> origin/main

# Default to a local (git-ignored) dev database. Override with DATABASE_URL if needed.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./deepfake_local.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()