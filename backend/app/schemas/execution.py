import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class RequestLogOut(BaseModel):
    id: uuid.UUID
    batch_run_id: uuid.UUID
    template_id: Optional[uuid.UUID] = None
    template_name: str
    request_url: str
    request_method: str
    request_headers: Dict[str, Any]
    request_body: Optional[str] = None
    response_status_code: Optional[int] = None
    response_headers: Optional[Dict[str, Any]] = None
    response_body: Optional[str] = None
    response_time_ms: float
    is_success: bool
    error_message: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BatchRunOut(BaseModel):
    id: uuid.UUID
    input_value: str
    input_type: str
    execution_mode: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    total_duration_ms: float
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class BatchRunDetailOut(BatchRunOut):
    logs: List[RequestLogOut] = []


class DashboardStats(BaseModel):
    total_batch_runs: int
    total_requests_executed: int
    successful_requests: int
    failed_requests: int
    overall_success_rate_pct: float
    average_latency_ms: float
    total_templates: int
    active_templates: int
