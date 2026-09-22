"""
Yetkili Üniversite Yoklama Sistemi - Başlangıç Test Verisi (Seed Script)
Dersler, öğretim görevlileri ve kayıtlı öğrencileri oluşturur.
"""

import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal, init_db
from app.models.user import User
from app.models.course import Course, CourseEnrollment


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

        # Öğrencileri oluştur
        sample_students = [
            ("210101001", "ogr_ali", "Ali Veli", "ali@firat.edu.tr"),
            ("210101002", "ogr_ayse", "Ayşe Yılmaz", "ayse@firat.edu.tr"),
            ("210101003", "ogr_mehmet", "Mehmet Demir", "mehmet@firat.edu.tr"),
            ("210101004", "ogr_zeynep", "Zeynep Kaya", "zeynep@firat.edu.tr"),
            ("210101005", "ogr_can", "Can Öztürk", "can@firat.edu.tr"),
        ]

        student_objs = []
        for num, subj, name, email in sample_students:
            s_res = await session.execute(select(User).where(User.cas_subject == subj))
            st = s_res.scalars().first()
            if not st:
                st = User(
                    university_student_id=num,
                    cas_subject=subj,
                    email=email,
                    full_name=name,
                    role="student",
                )
                session.add(st)
                await session.flush()
            student_objs.append(st)

        # Derse Kayıtları Ekle (CourseEnrollment)
        # Tüm 5 öğrenci BLM301'e kayıtlı
        for st in student_objs:
            enr_res = await session.execute(
                select(CourseEnrollment).where(
                    CourseEnrollment.course_id == course1.id,
                    CourseEnrollment.student_id == st.id,
                )
            )
            if not enr_res.scalars().first():
                session.add(CourseEnrollment(course_id=course1.id, student_id=st.id))

        # Yalnızca ilk 3 öğrenci BLM405'e kayıtlı (Kayıtsız öğrenci testi için)
        for st in student_objs[:3]:
            enr_res = await session.execute(
                select(CourseEnrollment).where(
                    CourseEnrollment.course_id == course2.id,
                    CourseEnrollment.student_id == st.id,
                )
            )
            if not enr_res.scalars().first():
                session.add(CourseEnrollment(course_id=course2.id, student_id=st.id))

        await session.commit()
        print("✅ 5 adet test öğrencisi ve ders kayıtları başarıyla oluşturuldu.")


if __name__ == "__main__":
    asyncio.run(seed())
