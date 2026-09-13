import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    String,
    Text,
    Boolean,
    Float,
    Integer,
    DateTime,
    JSON,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class BatchRun(Base):
    __tablename__ = "batch_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    input_value: Mapped[str] = mapped_column(Text, nullable=False)
    input_type: Mapped[str] = mapped_column(
        String(50), default="qr_camera", nullable=False
    )
    execution_mode: Mapped[str] = mapped_column(
        String(20), default="concurrent", nullable=False
    )
    total_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    successful_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_requests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), default="completed", nullable=False, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    # Relationships
    logs: Mapped[List["RequestLog"]] = relationship(
        "RequestLog",
        back_populates="batch_run",
        cascade="all, delete-orphan",
        order_by="RequestLog.created_at",
    )


class RequestLog(Base):
    __tablename__ = "request_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    batch_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("batch_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    template_name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Executed Request Details
    request_url: Mapped[str] = mapped_column(Text, nullable=False)
    request_method: Mapped[str] = mapped_column(String(10), nullable=False)
    request_headers: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict)
    request_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Captured Response Details
    response_status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_headers: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    response_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    response_time_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    is_success: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    # Relationships
    batch_run: Mapped["BatchRun"] = relationship("BatchRun", back_populates="logs")
