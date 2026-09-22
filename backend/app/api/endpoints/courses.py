from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.course import Course, CourseEnrollment
from app.schemas.course import CourseResponse

router = APIRouter(prefix="/courses", tags=["Dersler"])


@router.get("", response_model=List[CourseResponse], summary="Kullanıcının İlgili Derslerini Listele")
async def list_courses(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Eğer kullanıcı öğretim görevlisi ise sorumlu olduğu dersleri,
    öğrenci ise kayıtlı olduğu dersleri listeler.
    """
    if current_user.role in ["instructor", "admin"]:
        query = select(Course).options(selectinload(Course.instructor))
        if current_user.role != "admin":
            query = query.where(Course.instructor_id == current_user.id)
        res = await db.execute(query)
        courses = res.scalars().all()
        return [
            CourseResponse(
                id=c.id,
                course_code=c.course_code,
                name=c.name,
                academic_semester=c.academic_semester,
                instructor_name=c.instructor.full_name if c.instructor else None,
            )
            for c in courses
        ]
    else:
        # Öğrencinin kayıtlı olduğu dersler
        res = await db.execute(
            select(CourseEnrollment)
            .options(selectinload(CourseEnrollment.course).selectinload(Course.instructor))
            .where(CourseEnrollment.student_id == current_user.id)
        )
        enrollments = res.scalars().all()
        return [
            CourseResponse(
                id=e.course.id,
                course_code=e.course.course_code,
                name=e.course.name,
                academic_semester=e.course.academic_semester,
                instructor_name=e.course.instructor.full_name if e.course.instructor else None,
            )
            for e in enrollments
            if e.course
        ]
