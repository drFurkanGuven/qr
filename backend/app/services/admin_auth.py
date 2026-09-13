"""Statelesiz (stateless) admin auth token üretme/doğrulama.

Token, ADMIN_PASSWORD ile HMAC-SHA256 imzalanmış, süre damgalı bir
payload olarak üretilir; doğrulama veritabanı gerektirmez.
"""

import base64
import hashlib
import hmac
import json
import time

from app.core.config import settings

_ALGO = hashlib.sha256


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def issue_token(ttl_seconds: int | None = None) -> str:
    """Admin şifresi ile zaman damgalı imzalı token üretir."""
    ttl = ttl_seconds or settings.ADMIN_TOKEN_TTL_SECONDS
    payload = {"exp": int(time.time()) + int(ttl)}
    body = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(
        settings.ADMIN_PASSWORD.encode("utf-8"), body.encode("ascii"), _ALGO
    ).hexdigest()
    return f"{body}.{signature}"


def verify_token(token: str | None) -> bool:
    """Verilen token geçerli ve süresi dolmamış mı kontrol eder."""
    if not token:
        return False
    try:
        body, signature = token.split(".", 1)
        expected = hmac.new(
            settings.ADMIN_PASSWORD.encode("utf-8"), body.encode("ascii"), _ALGO
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return False
        raw = _b64decode(body).decode("utf-8")
        payload = json.loads(raw)
        return float(payload["exp"]) > time.time()
    except Exception:
        return False