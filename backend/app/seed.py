"""
Yetkili Üniversite Yoklama Sistemi - Başlangıç Test Verisi (Seed Script)
Dersler, öğretim görevlileri, kayıtlı öğrenciler ve 10 kişilik TÜBİTAK ekibi profillerini oluşturur.
"""

import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models.user import User
from app.models.course import Course, CourseEnrollment
from app.models.student_profile import StudentProfile


async def seed():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Hoca var mı kontrol et
        res = await session.execute(select(User).where(User.cas_subject == "fguven"))
        instructor = res.scalars().first()

        if not instructor:
            instructor = User(
                university_student_id="1001",
                cas_subject="fguven",
                email="fguven@firat.edu.tr",
                full_name="Dr. Öğr. Üyesi Furkan Güven",
                role="instructor",
            )
            session.add(instructor)
            await session.flush()
            print("👤 Öğretim üyesi eklendi: Dr. Öğr. Üyesi Furkan Güven")

        # Dersleri oluştur
        course_res = await session.execute(select(Course).where(Course.course_code == "BLM301"))
        course1 = course_res.scalars().first()
        if not course1:
            course1 = Course(
                course_code="BLM301",
                name="Yazılım Mühendisliği",
                instructor_id=instructor.id,
                academic_semester="2026-Guz",
            )
            session.add(course1)

        course2_res = await session.execute(select(Course).where(Course.course_code == "BLM405"))
        course2 = course2_res.scalars().first()
        if not course2:
            course2 = Course(
                course_code="BLM405",
                name="Bilgisayar Ağları ve Güvenliği",
                instructor_id=instructor.id,
                academic_semester="2026-Guz",
            )
            session.add(course2)

        await session.flush()
        print(f"📚 Dersler eklendi: {course1.course_code}, {course2.course_code}")

        # 10 Kişilik TÜBİTAK / Araştırma Ekibi Profilleri (StudentProfile)
        tubitak_team = [
            ("210101001", "sifre123", "e1c2d3a4-0001-4a5b-8c9d-111111111111", "Ahmet Yılmaz (TÜBİTAK 1)"),
            ("210101002", "sifre123", "e1c2d3a4-0002-4a5b-8c9d-222222222222", "Mehmet Kaya (TÜBİTAK 2)"),
            ("210101003", "sifre123", "e1c2d3a4-0003-4a5b-8c9d-333333333333", "Ayşe Demir (TÜBİTAK 3)"),
            ("210101004", "sifre123", "e1c2d3a4-0004-4a5b-8c9d-444444444444", "Fatma Çelik (TÜBİTAK 4)"),
            ("210101005", "sifre123", "e1c2d3a4-0005-4a5b-8c9d-555555555555", "Mustafa Şahin (TÜBİTAK 5)"),
            ("210101006", "sifre123", "e1c2d3a4-0006-4a5b-8c9d-666666666666", "Zeynep Aydın (TÜBİTAK 6)"),
            ("210101007", "sifre123", "e1c2d3a4-0007-4a5b-8c9d-777777777777", "Emre Öztürk (TÜBİTAK 7)"),
            ("210101008", "sifre123", "e1c2d3a4-0008-4a5b-8c9d-888888888888", "Burak Arslan (TÜBİTAK 8)"),
            ("210101009", "sifre123", "e1c2d3a4-0009-4a5b-8c9d-999999999999", "Büşra Yıldız (TÜBİTAK 9)"),
            ("210101010", "sifre123", "e1c2d3a4-0010-4a5b-8c9d-000000000000", "Can Polat (TÜBİTAK 10)"),
        ]

        for sno, pwd, dev_uuid, name in tubitak_team:
            p_res = await session.execute(select(StudentProfile).where(StudentProfile.student_no == sno))
            prof = p_res.scalars().first()
            if not prof:
                session.add(
                    StudentProfile(
                        student_no=sno,
                        password=pwd,
                        device_uuid=dev_uuid,
                        full_name=name,
                        group_tag="tubitak_ekip",
                        is_active=True,
                    )
                )

        await session.commit()
        print("✅ 10 kişilik TÜBİTAK ekip profilleri başarıyla hazırlandı.")


if __name__ == "__main__":
    asyncio.run(seed())
