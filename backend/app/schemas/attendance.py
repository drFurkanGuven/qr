from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List, Dict, Any


class CreateSessionRequest(BaseModel):
    course_id: str
    duration_minutes: int = 15


class CourseSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    course_code: Optional[str] = None
    course_name: Optional[str] = None
    started_at: datetime
    expires_at: datetime
    status: str


class RotatingQrResponse(BaseModel):
    success: bool = True
    session_id: str
    qr_token: str
    raw_data: Dict[str, Any]
    seconds_remaining: int


class VerifyAttendanceRequest(BaseModel):
    qr_token: str
    idempotency_key: Optional[str] = None


class AttendanceVerifiedRecord(BaseModel):
    id: str
    course_code: str
    course_name: str
    verified_at: datetime


class VerifyAttendanceResponse(BaseModel):
    success: bool
    status: str  # 'VERIFIED', 'ALREADY_VERIFIED', 'REJECTED'
    message: str
    record: Optional[AttendanceVerifiedRecord] = None


class AttendanceRecordItem(BaseModel):
    id: str
    university_student_id: Optional[str] = None
    full_name: str
    verified_at: datetime


class AttendanceShowResponse(BaseModel):
    success: bool = True
    session_id: str
    course_code: str
    total_count: int
    records: List[AttendanceRecordItem] = []
