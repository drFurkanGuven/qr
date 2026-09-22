from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class BatchDispatchInput(BaseModel):
    qr_token: str
    group_tag: Optional[str] = None


class StudentVerifyResult(BaseModel):
    profile_id: str
    student_no: str
    full_name: str
    device_uuid: str
    status_code: int
    success: bool
    message: str
    response_data: Optional[Any] = None
    response_time_ms: int


class BatchDispatchResponse(BaseModel):
    success: bool
    batch_job_id: str
    total_count: int
    success_count: int
    failed_count: int
    results: List[StudentVerifyResult]
