from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_admin
from app.core.config import settings
from app.schemas.admin import (
    AdminLoginRequest,
    AdminLoginResponse,
    AdminVerifyResponse,
)
from app.services.admin_auth import issue_token, verify_token

router = APIRouter()


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(login_req: AdminLoginRequest):
    if login_req.password != settings.ADMIN_PASSWORD:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yanlış yönetici parolası.",
        )
    token = issue_token()
    return AdminLoginResponse(
        token=token,
        token_type="admin",
        expires_in=settings.ADMIN_TOKEN_TTL_SECONDS,
    )


@router.get("/verify", response_model=AdminVerifyResponse)
async def admin_verify(admin: bool = Depends(get_admin)):
    return AdminVerifyResponse(valid=admin, is_admin=admin)