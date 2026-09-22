import hashlib
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog
from app.core.config import settings


def hash_sensitive_value(value: Optional[str]) -> Optional[str]:
    """Computes a salted SHA-256 hash of an IP or device identifier for privacy."""
    if not value:
        return None
    salted = f"{settings.AUDIT_SALT}:{value.strip()}"
    return hashlib.sha256(salted.encode("utf-8")).hexdigest()


async def record_audit_log(
    db: AsyncSession,
    action: str,
    result: str,
    actor_user_id: Optional[str] = None,
    course_session_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    device_uuid: Optional[str] = None,
    metadata_json: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """Inserts an immutable audit log record."""
    # Filter out any sensitive keys from metadata if present
    safe_metadata = {}
    if metadata_json:
        for k, v in metadata_json.items():
            if any(forbidden in k.lower() for forbidden in ["token", "password", "ticket", "secret"]):
                safe_metadata[k] = "[REDACTED]"
            else:
                safe_metadata[k] = v

    log_entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        course_session_id=course_session_id,
        result=result,
        metadata_json=safe_metadata,
        ip_hash=hash_sensitive_value(ip_address),
        device_uuid_hash=hash_sensitive_value(device_uuid),
    )
    db.add(log_entry)
    await db.flush()
    return log_entry
