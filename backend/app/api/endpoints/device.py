from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user, get_client_ip
from app.models.user import User
from app.services.audit_service import record_audit_log, hash_sensitive_value
from app.schemas.device import DeviceRegisterRequest, DeviceRegisterResponse

router = APIRouter(prefix="/device", tags=["Cihaz Kaydı (Device)"])


@router.post("/register", response_model=DeviceRegisterResponse, summary="Cihaz / Tarayıcı Kaydı (Resmi API Uyumu)")
async def register_device(
    payload: DeviceRegisterRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Resmi Fırat API sözleşmesine uygun cihaz parmak izi eşleme.
    Cihaz UUID değeri açık değil, tuzlu SHA-256 hash ile kaydedilir.
    """
    ip = get_client_ip(request)
    device_hash = hash_sensitive_value(payload.device_uuid)

    await record_audit_log(
        db=db,
        action="DEVICE_REGISTER",
        result="SUCCESS",
        actor_user_id=current_user.id,
        ip_address=ip,
        device_uuid=payload.device_uuid,
        metadata_json={"device_name": payload.device_name},
    )
    await db.commit()

    return DeviceRegisterResponse(
        success=True,
        registered=True,
        device_uuid_hash=device_hash or "",
    )
