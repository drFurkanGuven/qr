from datetime import datetime
from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    password: str = Field(..., min_length=1, description="Admin parolası")


class AdminLoginResponse(BaseModel):
    token: str
    token_type: str = "admin"
    expires_in: int


class AdminVerifyResponse(BaseModel):
    valid: bool
    is_admin: bool = False