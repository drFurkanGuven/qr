import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.student_profile import StudentProfile
from app.services.attendance_dispatcher import attendance_dispatcher


@pytest.mark.asyncio
async def test_batch_dispatch_multiple_students(test_db: AsyncSession):
    # 3 öğrenci profili ekle
    p1 = StudentProfile(student_no="210101001", password="test_password", device_uuid="dev-1", full_name="Ali", group_tag="tubitak_ekip")
    p2 = StudentProfile(student_no="210101002", password="test_password", device_uuid="dev-2", full_name="Ayse", group_tag="tubitak_ekip")
    p3 = StudentProfile(student_no="210101003", password="test_password", device_uuid="dev-3", full_name="Mehmet", group_tag="tubitak_ekip")
    test_db.add_all([p1, p2, p3])
    await test_db.commit()

    # Tek bir QR token ile toplu yoklama ateşle
    qr_token = "sample_qr_token_scanned_from_board"
    response = await attendance_dispatcher.dispatch_batch(
        qr_token=qr_token,
        group_tag="tubitak_ekip",
        db=test_db,
    )

    assert response.total_count == 3
    assert response.success_count == 3
    assert response.failed_count == 0
    assert len(response.results) == 3

    # Her bir öğrencinin bağımsız device_uuid ve öğrenci numarası ile işlem gördüğünü doğrula
    device_uuids = {r.device_uuid for r in response.results}
    assert device_uuids == {"dev-1", "dev-2", "dev-3"}
