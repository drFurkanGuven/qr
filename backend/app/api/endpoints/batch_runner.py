from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.batch_job import BatchJob
from app.schemas.batch_runner import BatchDispatchInput, BatchDispatchResponse
from app.services.attendance_dispatcher import attendance_dispatcher

router = APIRouter(prefix="/batch", tags=["Çoklu Yoklama Motoru (Batch Dispatcher)"])


@router.post("/dispatch", response_model=BatchDispatchResponse, summary="Tek QR ile Tüm Ekip Adına Eşzamanlı Yoklama Gönder")
async def dispatch_attendance(
    payload: BatchDispatchInput,
    db: AsyncSession = Depends(get_db),
):
    """
    Sınıfta okunan tek bir QR kodu alır; sunucuda kayıtlı aktif TÜBİTAK ekibi
    öğrencilerinin hesapları adına aynı anda Fırat API'sine yoklama isteği gönderir.
    """
    qr_token = payload.qr_token.strip()
    if not qr_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR token değeri boş olamaz.",
        )

    response = await attendance_dispatcher.dispatch_batch(
        qr_token=qr_token,
        group_tag=payload.group_tag,
        db=db,
    )
    return response


@router.get("/history", summary="Geçmiş Çoklu Yoklama İşlemleri")
async def get_batch_history(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Geçmişte tek QR ile yapılan çoklu yoklama gönderimlerini ve sonuçlarını listeler."""
    res = await db.execute(
        select(BatchJob).order_by(BatchJob.created_at.desc()).limit(limit)
    )
    jobs = res.scalars().all()
    return [
        {
            "id": j.id,
            "qr_token_preview": j.qr_token[:30] + "..." if len(j.qr_token) > 30 else j.qr_token,
            "group_tag": j.group_tag or "all",
            "total_count": j.total_count,
            "success_count": j.success_count,
            "failed_count": j.failed_count,
            "created_at": j.created_at.isoformat(),
            "results": j.results_json,
        }
        for j in jobs
    ]
