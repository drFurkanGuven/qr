import hmac
import hashlib
import json
import base64
import uuid
import time
from typing import Tuple, Optional, Dict, Any
from app.core.config import settings


def generate_session_secret() -> str:
    """Generates a high-entropy secret for a course session."""
    return uuid.uuid4().hex + uuid.uuid4().hex


def generate_qr_payload(session_id: str, session_secret: str, ttl_seconds: Optional[int] = None) -> Dict[str, Any]:
    """
    Generates a short-lived rotating QR payload signed with HMAC-SHA256.
    Rotates every 30 seconds.
    """
    ttl = ttl_seconds or settings.QR_ROTATION_SECONDS
    now = int(time.time())
    expires_at = now + ttl
    nonce = uuid.uuid4().hex[:12]

    # Message format: session_id:nonce:expires_at
    message = f"{session_id}:{nonce}:{expires_at}".encode("utf-8")
    signature = hmac.new(session_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()

    raw_data = {
        "session_id": session_id,
        "nonce": nonce,
        "expires_at": expires_at,
        "signature": signature,
    }

    raw_json = json.dumps(raw_data, separators=(",", ":"))
    qr_token = base64.urlsafe_b64encode(raw_json.encode("utf-8")).decode("utf-8")

    return {
        "qr_token": qr_token,
        "raw_data": raw_data,
        "seconds_remaining": ttl,
    }


def parse_qr_token(token_str: str) -> Optional[Dict[str, Any]]:
    """Tries to decode token_str from base64 JSON or direct JSON."""
    token_clean = token_str.strip()
    # 1. Try base64 urlsafe
    try:
        # Add padding if missing
        missing_padding = len(token_clean) % 4
        if missing_padding:
            token_clean_padded = token_clean + "=" * (4 - missing_padding)
        else:
            token_clean_padded = token_clean
        decoded = base64.urlsafe_b64decode(token_clean_padded.encode("utf-8")).decode("utf-8")
        data = json.loads(decoded)
        if isinstance(data, dict) and "session_id" in data and "signature" in data:
            return data
    except Exception:
        pass

    # 2. Try direct JSON
    try:
        data = json.loads(token_str)
        if isinstance(data, dict) and "session_id" in data and "signature" in data:
            return data
    except Exception:
        pass

    return None


def verify_qr_payload(
    token_str: str,
    session_secret: str,
    tolerance_seconds: Optional[int] = None
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Verifies the HMAC signature and timestamp of a scanned QR token.
    Returns (is_valid, session_id, error_code).
    """
    payload = parse_qr_token(token_str)
    if not payload:
        return False, None, "QR_INVALID_FORMAT"

    session_id = payload.get("session_id")
    nonce = payload.get("nonce")
    expires_at = payload.get("expires_at")
    signature = payload.get("signature")

    if not all([session_id, nonce, expires_at, signature]):
        return False, None, "QR_INVALID_FORMAT"

    # Verify HMAC-SHA256 signature
    message = f"{session_id}:{nonce}:{expires_at}".encode("utf-8")
    expected_sig = hmac.new(session_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_sig, signature):
        return False, session_id, "QR_SIGNATURE_MISMATCH"

    # Verify Expiration
    now = int(time.time())
    tolerance = tolerance_seconds if tolerance_seconds is not None else settings.QR_TOLERANCE_SECONDS
    if now > int(expires_at) + tolerance:
        return False, session_id, "QR_EXPIRED"

    return True, session_id, None
