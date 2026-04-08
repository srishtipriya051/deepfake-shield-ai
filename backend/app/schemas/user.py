from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
<<<<<<< HEAD
    password: str

class UserForgotPassword(BaseModel):
    email: str
    new_password: str
=======
    password: str
>>>>>>> origin/main
