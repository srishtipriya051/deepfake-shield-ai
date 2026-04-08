from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from app.database import users_db
from app.auth import create_access_token

app = FastAPI()

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/login")
def login(data: LoginRequest):
    user = users_db.get(data.email)

    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": data.email})

    return {
        "access_token": token,
        "token_type": "bearer"
    }