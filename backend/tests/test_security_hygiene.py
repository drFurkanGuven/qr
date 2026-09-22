import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.services.audit_service import record_audit_log, hash_sensitive_value
from app.models.audit import AuditLog
from app.core.config import settings


@pytest.mark.asyncio
async def test_audit_log_token_redaction(test_db: AsyncSession):
    # Pass metadata containing sensitive keys
    metadata = {
        "access_token": "secret_bearer_token_12345",
        "cas_ticket": "ST-99999-secret",
        "course_code": "BLM301",
    }
    raw_ip = "192.168.1.105"
    raw_device = "device-uuid-my-phone-4455"

    log_entry = await record_audit_log(
        db=test_db,
        action="TEST_ACTION",
        result="SUCCESS",
        ip_address=raw_ip,
        device_uuid=raw_device,
        metadata_json=metadata,
    )
    await test_db.commit()

    res = await test_db.execute(select(AuditLog).where(AuditLog.id == log_entry.id))
    saved = res.scalars().first()
    assert saved is not None

    # Sensitive values in metadata must be REDACTED
    assert saved.metadata_json["access_token"] == "[REDACTED]"
    assert saved.metadata_json["cas_ticket"] == "[REDACTED]"
    assert saved.metadata_json["course_code"] == "BLM301"

    # IP and device UUID must NOT be stored as raw text, but hashed
    assert saved.ip_hash is not None
    assert saved.ip_hash != raw_ip
    assert len(saved.ip_hash) == 64
    assert saved.ip_hash == hash_sensitive_value(raw_ip)

    assert saved.device_uuid_hash is not None
    assert saved.device_uuid_hash != raw_device
    assert len(saved.device_uuid_hash) == 64
    assert saved.device_uuid_hash == hash_sensitive_value(raw_device)
