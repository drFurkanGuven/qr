import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class CourseSession(Base):
    __tablename__ = "course_sessions"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    course_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(
        String(32),
        default="active",  # 'active', 'closed', 'expired'
        nullable=False,
        index=True,
    )
    session_secret: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
    )
    qr_nonce_hash: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )
    last_rotated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    course = relationship("Course", back_populates="sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="session")
