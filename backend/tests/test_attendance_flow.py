import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.course import Course, CourseEnrollment
from app.services.session_service import create_session_token


@pytest.mark.asyncio
async def test_full_attendance_verification_flow(client: AsyncClient, test_db: AsyncSession):
    # 1. Test verilerini veritabanına ekle
    instructor = User(
        university_student_id="INS01",
        cas_subject="instructor_1",
        email="ins1@firat.edu.tr",
        full_name="Prof. Dr. Ahmet",
        role="instructor",
    )
    student1 = User(
        university_student_id="210101001",
        cas_subject="student_1",
        email="s1@firat.edu.tr",
        full_name="Ali Veli",
        role="student",
    )
    student2_not_enrolled = User(
        university_student_id="210101099",
        cas_subject="student_not_enrolled",
        email="s99@firat.edu.tr",
        full_name="Yabancı Öğrenci",
        role="student",
    )
    test_db.add_all([instructor, student1, student2_not_enrolled])
    await test_db.flush()

    course = Course(
        course_code="BLM301",
        name="Yazılım Mühendisliği",
        instructor_id=instructor.id,
        academic_semester="2026-Guz",
    )
    test_db.add(course)
    await test_db.flush()

    # Yalnızca student1 kayıtlı
    enrollment = CourseEnrollment(course_id=course.id, student_id=student1.id)
    test_db.add(enrollment)
    await test_db.commit()

    # 2. Öğretim üyesi oturumu ile yoklama başlat
    ins_token = create_session_token({"sub": instructor.id, "role": "instructor", "cas_subject": "instructor_1"})
    client.cookies.set("session_token", ins_token)

    session_resp = await client.post(
        "/api/v1/attendance/sessions",
        json={"course_id": course.id, "duration_minutes": 20},
    )
    assert session_resp.status_code == 201
    session_data = session_resp.json()
    session_id = session_data["id"]

    # 3. Dönen QR tokenını al
    qr_resp = await client.get(f"/api/v1/attendance/sessions/{session_id}/qr")
    assert qr_resp.status_code == 200
    qr_token = qr_resp.json()["qr_token"]

    # 4. Kayıtlı öğrenci (student1) ile QR doğrula -> BAŞARILI
    st1_token = create_session_token({"sub": student1.id, "role": "student", "cas_subject": "student_1"})
    client.cookies.set("session_token", st1_token)

    verify_resp = await client.post(
        "/api/v1/attendance/verify",
        json={"qr_token": qr_token, "idempotency_key": "test-uuid-1"},
    )
    assert verify_resp.status_code == 200
    v_data = verify_resp.json()
    assert v_data["success"] is True
    assert v_data["status"] == "VERIFIED"

    # 5. Aynı öğrenci tekrar okutursa -> 409 CONFLICT
    verify_again = await client.post(
        "/api/v1/attendance/verify",
        json={"qr_token": qr_token, "idempotency_key": "test-uuid-2"},
    )
    assert verify_again.status_code == 409
    assert "daha önce" in verify_again.json()["detail"]

    # 6. Derse kayıtlı olmayan öğrenci okutursa -> 403 NOT_ENROLLED
    st2_token = create_session_token({"sub": student2_not_enrolled.id, "role": "student", "cas_subject": "student_not_enrolled"})
    client.cookies.set("session_token", st2_token)

    verify_unregistered = await client.post(
        "/api/v1/attendance/verify",
        json={"qr_token": qr_token},
    )
    assert verify_unregistered.status_code == 403
    assert "kayıtlı" in verify_unregistered.json()["detail"]
