from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class StudentProfileCreate(BaseModel):
    student_no: str
    password: Optional[str] = ""
    device_uuid: str
    full_name: str
    group_tag: str = "tubitak_ekip"
    is_active: bool = True
    cached_token: Optional[str] = None


class StudentProfileUpdate(BaseModel):
    student_no: Optional[str] = None
    password: Optional[str] = None
    device_uuid: Optional[str] = None
    full_name: Optional[str] = None
    group_tag: Optional[str] = None
    is_active: Optional[bool] = None
    cached_token: Optional[str] = None


class StudentProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_no: str
    full_name: str
    device_uuid: str
    group_tag: str
    is_active: bool
    has_valid_token: bool = False
    created_at: datetime
    updated_at: datetime
