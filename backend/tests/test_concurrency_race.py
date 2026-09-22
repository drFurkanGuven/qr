import asyncio
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.models.user import User
from app.models.course import Course, CourseEnrollment
from app.models.session import CourseSession
from app.models.attendance import AttendanceRecord
from app.services.session_service import create_session_token
from app.services.qr_engine import generate_session_secret, generate_qr_payload
from app.main import app
from app.core.database import get_db, Base


@pytest.mark.asyncio
async def test_race_condition_same_student_concurrent_requests():
    """
    Aynı öğrencinin aynı milisaniyede 20 paralel istek atması durumunda
    veritabanı seviyesindeki UNIQUE kısıtlaması sayesinde kesinlikle yalnızca
    1 kaydın oluştuğunu ve diğer tüm isteklerin 409 Conflict aldığını doğrular.
    """
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        instructor = User(university_student_id="INS99", cas_subject="hoca", email="h@f.edu.tr", full_name="Hoca", role="instructor")
        student = User(university_student_id="STU01", cas_subject="ogr_race", email="s@f.edu.tr", full_name="Ogrenci", role="student")
        session.add_all([instructor, student])
        await session.flush()

        course = Course(course_code="BLM999", name="Yarış Koşulu Dersi", instructor_id=instructor.id, academic_semester="2026-Guz")
        session.add(course)
        await session.flush()

        enr = CourseEnrollment(course_id=course.id, student_id=student.id)
        session.add(enr)
        await session.flush()

        from datetime import datetime, timezone, timedelta
        secret = generate_session_secret()
        cs = CourseSession(
            course_id=course.id,
            started_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
            status="active",
            session_secret=secret,
        )
        session.add(cs)
        await session.commit()
        session_id = cs.id

    qr_payload = generate_qr_payload(session_id, secret, ttl_seconds=60)
    qr_token = qr_payload["qr_token"]

    async def run_client_request(req_idx: int):
        async with async_session() as s:
            async def get_db_override():
                yield s
            app.dependency_overrides[get_db] = get_db_override
            transport = ASGITransport(app=app)
            st_token = create_session_token({"sub": student.id, "role": "student", "cas_subject": "ogr_race"})
            async with AsyncClient(transport=transport, base_url="http://testserver", cookies={"session_token": st_token}) as client:
                res = await client.post(
                    "/api/v1/attendance/verify",
                    json={"qr_token": qr_token, "idempotency_key": f"race-{req_idx}"}
                )
                return res.status_code

    # 20 paralel istek başlat
    results = await asyncio.gather(*[run_client_request(i) for i in range(20)], return_exceptions=True)

    success_count = sum(1 for r in results if r == 200)
    conflict_count = sum(1 for r in results if r == 409)

    # Kesin kural: Yalnızca 1 istek 200 dönebilir, diğer 19'u 409 almalıdır
    assert success_count == 1, f"Beklenen: 1 basarili kayit, Gerceklesen: {success_count}"
    assert conflict_count == 19, f"Beklenen: 19 conflict, Gerceklesen: {conflict_count}"

    # Veritabanında tek bir kayıt olduğunu teyit et
    async with async_session() as session:
        from sqlalchemy import select
        records = (await session.execute(select(AttendanceRecord).where(AttendanceRecord.student_id == student.id))).scalars().all()
        assert len(records) == 1

    app.dependency_overrides.clear()
    await engine.dispose()
