import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    actor_user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        index=True,
    )
    course_session_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("course_sessions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    result: Mapped[str] = mapped_column(
        String(32),
        nullable=False,  # SUCCESS, FAILED_EXPIRED, FAILED_NOT_ENROLLED, FAILED_DUPLICATE vb.
        index=True,
    )
    metadata_json: Mapped[dict | None] = mapped_column(
        JSON,
        nullable=True,
    )
    ip_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    device_uuid_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    actor = relationship("User")
    session = relationship("CourseSession", back_populates="audit_logs")
