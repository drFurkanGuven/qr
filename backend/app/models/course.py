import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    course_code: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    instructor_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    academic_semester: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="2026-Guz",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("course_code", "academic_semester", name="uq_course_code_semester"),
    )

    # Relationships
    instructor = relationship("User", back_populates="taught_courses")
    enrollments = relationship("CourseEnrollment", back_populates="course", cascade="all, delete-orphan")
    sessions = relationship("CourseSession", back_populates="course", cascade="all, delete-orphan")


class CourseEnrollment(Base):
    __tablename__ = "course_enrollments"

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
    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("course_id", "student_id", name="uq_course_student"),
    )

    # Relationships
    course = relationship("Course", back_populates="enrollments")
    student = relationship("User", back_populates="enrollments")
