import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class TemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, example="Verify QR Code")
    description: Optional[str] = Field(None, example="Sends scanned ticket QR code to external verification API")
    method: str = Field("POST", example="POST")
    url: str = Field(..., example="https://httpbin.org/post")
    headers: Dict[str, Any] = Field(default_factory=lambda: {"Content-Type": "application/json"})
    body_type: str = Field("json", example="json")
    body: Optional[str] = Field(
        None,
        example='{\n  "qr_data": "{{qr_data}}",\n  "timestamp": "{{iso_timestamp}}",\n  "request_id": "{{uuid}}"\n}'
    )
    query_params: Dict[str, Any] = Field(default_factory=dict)
    timeout_seconds: float = Field(10.0, ge=1.0, le=120.0)
    is_active: bool = True
    group_name: str = Field("default", max_length=100)
    order_index: int = Field(0, ge=0)


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    body_type: Optional[str] = None
    body: Optional[str] = None
    query_params: Optional[Dict[str, Any]] = None
    timeout_seconds: Optional[float] = Field(None, ge=1.0, le=120.0)
    is_active: Optional[bool] = None
    group_name: Optional[str] = None
    order_index: Optional[int] = None


class TemplateOut(TemplateBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplateTestRequest(BaseModel):
    input_value: str = Field(..., example="QR_CODE_12345")
    custom_variables: Optional[Dict[str, str]] = Field(default_factory=dict)


class TemplatePreviewRequest(BaseModel):
    input_value: str = Field(..., example="QR_CODE_12345")
    custom_variables: Optional[Dict[str, str]] = Field(default_factory=dict)
    template: Optional[TemplateBase] = None


class TemplatePreviewResponse(BaseModel):
    url: str
    method: str
    headers: Dict[str, Any]
    body: Optional[str] = None
    query_params: Dict[str, Any]
