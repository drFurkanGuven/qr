import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import String, Text, Boolean, Float, Integer, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RequestTemplate(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    method: Mapped[str] = mapped_column(String(10), default="POST", nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    headers: Mapped[Dict[str, Any]] = mapped_column(
        JSON, default=lambda: {"Content-Type": "application/json"}, nullable=False
    )
    body_type: Mapped[str] = mapped_column(String(20), default="json", nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    query_params: Mapped[Dict[str, Any]] = mapped_column(
        JSON, default=dict, nullable=False
    )
    timeout_seconds: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    group_name: Mapped[str] = mapped_column(String(100), default="default", nullable=False, index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
