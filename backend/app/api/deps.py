from typing import AsyncGenerator
from fastapi import Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.services.admin_auth import verify_token

__all__ = ["get_db", "AsyncSession", "get_admin"]


async def get_admin(
    x_admin_token: str | None = Header(default=None, alias=settings.ADMIN_TOKEN_HEADER),
) -> bool:
    """Yönetici doğrulaması: geçerli admin token'ı zorunlu kılar."""
    if not verify_token(x_admin_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yönetici yetkisi gerekli. Geçerli bir admin token sağlayın.",
        )
    return True