from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=5, max_length=30)
    email: EmailStr
    password: str = Field(min_length=8, max_length=1024)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
