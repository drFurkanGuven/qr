import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from app.schemas.execution import RequestLogOut


class BatchExecutionRequest(BaseModel):
    input_value: str = Field(..., min_length=1, example="BARCODE_987654321")
    input_type: str = Field("qr_camera", example="qr_camera")
    execution_mode: str = Field("concurrent", example="concurrent")  # 'concurrent' or 'sequential'
    template_ids: Optional[List[uuid.UUID]] = Field(
        None,
        description="List of template IDs to execute. If omitted or empty, all active templates are executed."
    )
    custom_variables: Optional[Dict[str, str]] = Field(
        default_factory=dict,
        example={"auth_token": "secret123", "device_id": "scanner-01"}
    )
    delay_ms_between_requests: int = Field(
        0, ge=0, le=5000, description="Delay between requests in sequential mode (ms)"
    )


class BatchExecutionResponse(BaseModel):
    batch_run_id: uuid.UUID
    input_value: str
    execution_mode: str
    total_requests: int
    successful_requests: int
    failed_requests: int
    total_duration_ms: float
    status: str
    results: List[RequestLogOut]
