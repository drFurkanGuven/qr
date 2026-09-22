import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from app.core.config import settings

ALGORITHM = "HS256"


def create_session_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT session token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(seconds=settings.COOKIE_MAX_AGE_SECONDS)
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_session_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and verifies a JWT session token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None
