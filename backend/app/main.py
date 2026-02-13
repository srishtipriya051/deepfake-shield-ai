from fastapi import FastAPI
from app.database.connection import engine
from app.database.base import Base
from app.routes import auth

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(auth.router)
