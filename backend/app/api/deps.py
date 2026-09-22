from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.services.session_service import decode_session_token
from app.models.user import User


def get_client_ip(request: Request) -> str:
    """Extracts client IP address safely from headers or connection."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def get_device_uuid(request: Request) -> str | None:
    """Extracts X-Device-UUID header."""
    return request.headers.get("X-Device-UUID") or request.headers.get("x-device-uuid")


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Authenticates user via:
    1. httpOnly 'session_token' cookie (primary, secure)
    2. 'Authorization: Bearer <token>' header (API clients / official contract)
    """
    token = request.cookies.get(settings.COOKIE_NAME)

    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Oturum açmanız gerekiyor.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_session_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz veya süresi dolmuş oturum.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload["sub"]
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Kullanıcı hesabı bulunamadı veya pasif.",
        )

    return user


async def get_current_student(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensures the authenticated user is a student."""
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem yalnızca öğrenciler tarafından yapılabilir.",
        )
    return current_user


async def get_current_instructor(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensures the authenticated user is an instructor or admin."""
    if current_user.role not in ["instructor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem yalnızca yetkili öğretim görevlileri tarafından yapılabilir.",
        )
    return current_user