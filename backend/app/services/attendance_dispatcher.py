import time
import asyncio
import httpx
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.student_profile import StudentProfile
from app.models.batch_job import BatchJob
from app.schemas.batch_runner import StudentVerifyResult, BatchDispatchResponse
from app.services.cas_authenticator import cas_authenticator
from app.core.config import settings


async def verify_single_student(
    profile: StudentProfile,
    qr_token: str,
    db: AsyncSession,
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
) -> StudentVerifyResult:
    async with semaphore:
        start_time = time.time()

        # 1. Öğrenci için geçerli Bearer token temin et
        token, token_err = await cas_authenticator.get_valid_token(profile, db)
        if not token:
            elapsed = int((time.time() - start_time) * 1000)
            return StudentVerifyResult(
                profile_id=profile.id,
                student_no=profile.student_no,
                full_name=profile.full_name,
                device_uuid=profile.device_uuid,
                status_code=401,
                success=False,
                message=token_err or "CAS token alınamadı.",
                response_time_ms=elapsed,
            )

        # 2. Fırat Üniversitesi Resmi Yoklama API'sine İlet
        headers = {
            "Host": "qr.firat.edu.tr",
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "X-Device-Uuid": profile.device_uuid,
            "User-Agent": "FiratMobil/2 CFNetwork/3896.100.1.2.1 Darwin/27.0.0",
            "Accept-Language": "tr-TR,tr;q=0.9",
            "Connection": "keep-alive",
        }
        body = {
            "qr_token": qr_token.strip(),
        }

        target_url = settings.FIRAT_ATTENDANCE_VERIFY_ENDPOINT

        # Geliştirme ve simülasyon ortamı desteği
        if settings.ENVIRONMENT == "development" and not settings.UPSTREAM_MODE:
            elapsed = int((time.time() - start_time) * 1000)
            return StudentVerifyResult(
                profile_id=profile.id,
                student_no=profile.student_no,
                full_name=profile.full_name,
                device_uuid=profile.device_uuid,
                status_code=200,
                success=True,
                message="Yoklama başarıyla işlendi (Simülasyon Modu).",
                response_data={"status": "VERIFIED", "student_no": profile.student_no},
                response_time_ms=elapsed,
            )

        try:
            res = await client.post(target_url, json=body, headers=headers)
            elapsed = int((time.time() - start_time) * 1000)
            data = None
            try:
                data = res.json()
            except Exception:
                data = {"raw_text": res.text[:200]}

            is_success = res.status_code in [200, 201]
            message = "Yoklama başarıyla alındı." if is_success else f"Hata ({res.status_code})"
            if isinstance(data, dict):
                if "message" in data:
                    message = data["message"]
                elif "detail" in data:
                    message = data["detail"]

            return StudentVerifyResult(
                profile_id=profile.id,
                student_no=profile.student_no,
                full_name=profile.full_name,
                device_uuid=profile.device_uuid,
                status_code=res.status_code,
                success=is_success,
                message=message,
                response_data=data,
                response_time_ms=elapsed,
            )

        except Exception as e:
            elapsed = int((time.time() - start_time) * 1000)
            return StudentVerifyResult(
                profile_id=profile.id,
                student_no=profile.student_no,
                full_name=profile.full_name,
                device_uuid=profile.device_uuid,
                status_code=500,
                success=False,
                message=f"Bağlantı hatası: {str(e)}",
                response_time_ms=elapsed,
            )


class AttendanceDispatcher:
    @classmethod
    async def dispatch_batch(
        cls,
        qr_token: str,
        group_tag: Optional[str],
        db: AsyncSession
    ) -> BatchDispatchResponse:
        """
        Aktif öğrencileri çeker ve tek bir QR kodu için eşzamanlı olarak yoklama isteği gönderir.
        """
        query = select(StudentProfile).where(StudentProfile.is_active == True)
        if group_tag and group_tag != "all":
            query = query.where(StudentProfile.group_tag == group_tag)

        res = await db.execute(query.order_by(StudentProfile.student_no.asc()))
        profiles = res.scalars().all()

        if not profiles:
            job = BatchJob(
                qr_token=qr_token[:500],
                group_tag=group_tag,
                total_count=0,
                success_count=0,
                failed_count=0,
                results_json={"message": "Aktif profil bulunamadı."},
            )
            db.add(job)
            await db.commit()
            return BatchDispatchResponse(
                success=False,
                batch_job_id=job.id,
                total_count=0,
                success_count=0,
                failed_count=0,
                results=[],
            )

        semaphore = asyncio.Semaphore(15)  # En fazla 15 paralel HTTP bağlantısı
        timeout = httpx.Timeout(15.0, connect=8.0)

        async with httpx.AsyncClient(timeout=timeout) as client:
            tasks = [
                verify_single_student(p, qr_token, db, client, semaphore)
                for p in profiles
            ]
            results: List[StudentVerifyResult] = await asyncio.gather(*tasks)

        success_count = sum(1 for r in results if r.success)
        failed_count = len(results) - success_count

        # Veritabanına toplu işlem kaydını yaz
        batch_job = BatchJob(
            qr_token=qr_token[:500],
            group_tag=group_tag,
            total_count=len(results),
            success_count=success_count,
            failed_count=failed_count,
            results_json=[r.model_dump() for r in results],
        )
        db.add(batch_job)
        await db.commit()

        return BatchDispatchResponse(
            success=success_count > 0,
            batch_job_id=batch_job.id,
            total_count=len(results),
            success_count=success_count,
            failed_count=failed_count,
            results=results,
        )


attendance_dispatcher = AttendanceDispatcher()
