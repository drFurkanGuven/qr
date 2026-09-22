from pydantic import BaseModel
from typing import Optional


class DeviceRegisterRequest(BaseModel):
    device_uuid: str
    device_name: Optional[str] = None


class DeviceRegisterResponse(BaseModel):
    success: bool = True
    registered: bool = True
    device_uuid_hash: str
