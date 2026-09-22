import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    course_session_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("course_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    verified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    device_uuid_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    ip_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    user_agent_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    verification_result: Mapped[str] = mapped_column(
        String(32),
        default="SUCCESS",
        nullable=False,
    )
    idempotency_key: Mapped[str | None] = mapped_column(
        String(36),
        nullable=True,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("course_session_id", "student_id", name="uq_session_student"),
    )

    # Relationships
    session = relationship("CourseSession", back_populates="records")
    student = relationship("User", back_populates="attendance_records")
