import asyncio
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import (
    get_current_user,
    get_current_student,
    get_current_instructor,
    get_client_ip,
    get_device_uuid,
)
from app.models.user import User
from app.models.course import Course, CourseEnrollment
from app.models.session import CourseSession
from app.models.attendance import AttendanceRecord
from app.services.qr_engine import (
    generate_session_secret,
    generate_qr_payload,
    verify_qr_payload,
)
from app.services.audit_service import record_audit_log, hash_sensitive_value
from app.services.sse_manager import sse_manager
from app.schemas.attendance import (
    CreateSessionRequest,
    CourseSessionResponse,
    RotatingQrResponse,
    VerifyAttendanceRequest,
    VerifyAttendanceResponse,
    AttendanceVerifiedRecord,
    AttendanceShowResponse,
    AttendanceRecordItem,
)

router = APIRouter(prefix="/attendance", tags=["Yoklama Yönetimi ve Doğrulama"])


# --------------------------------------------------------------------------
# 1. ÖĞRETİM GÖREVLİSİ: Yoklama Oturumu Başlatma
# --------------------------------------------------------------------------
@router.post("/sessions", response_model=CourseSessionResponse, status_code=status.HTTP_201_CREATED, summary="Yoklama Oturumu Başlat (Öğretim Görevlisi)")
async def create_session(
    payload: CreateSessionRequest,
    request: Request,
    current_user: User = Depends(get_current_instructor),
    db: AsyncSession = Depends(get_db),
):
    """Yetkili öğretim görevlisi ders için süreli yoklama oturumu açar."""
    # 1. Ders kontrolü ve hoca yetkisi
    res = await db.execute(select(Course).where(Course.id == payload.course_id))
    course = res.scalars().first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ders bulunamadı.")

    if current_user.role != "admin" and course.instructor_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu dersin yoklama oturumunu yalnızca dersin sorumlu öğretim üyesi açabilir.",
        )

    # 2. Hâlihazırda aktif oturum var mı?
    now = datetime.now(timezone.utc)
    active_res = await db.execute(
        select(CourseSession).where(
            and_(
                CourseSession.course_id == course.id,
                CourseSession.status == "active",
                CourseSession.expires_at > now,
            )
        )
    )
    existing_session = active_res.scalars().first()
    if existing_session:
        # Mevcut aktif oturumu döndür
        return CourseSessionResponse(
            id=existing_session.id,
            course_id=course.id,
            course_code=course.course_code,
            course_name=course.name,
            started_at=existing_session.started_at,
            expires_at=existing_session.expires_at,
            status=existing_session.status,
        )

    # 3. Yeni oturum oluştur
    duration = max(1, min(payload.duration_minutes, 180))  # 1 ile 180 dk arası
    expires_at = now + timedelta(minutes=duration)
    session_secret = generate_session_secret()

    new_session = CourseSession(
        course_id=course.id,
        started_at=now,
        expires_at=expires_at,
        status="active",
        session_secret=session_secret,
    )
    db.add(new_session)
    await db.flush()

    await record_audit_log(
        db=db,
        action="CREATE_SESSION",
        result="SUCCESS",
        actor_user_id=current_user.id,
        course_session_id=new_session.id,
        ip_address=get_client_ip(request),
        metadata_json={"duration_minutes": duration, "course_code": course.course_code},
    )
    await db.commit()

    return CourseSessionResponse(
        id=new_session.id,
        course_id=course.id,
        course_code=course.course_code,
        course_name=course.name,
        started_at=new_session.started_at,
        expires_at=new_session.expires_at,
        status=new_session.status,
    )


# --------------------------------------------------------------------------
# 2. ÖĞRETİM GÖREVLİSİ: Dönen Dinamik QR Kodu Alma
# --------------------------------------------------------------------------
@router.get("/sessions/{session_id}/qr", response_model=RotatingQrResponse, summary="Dönen Dinamik QR Kodu Al")
async def get_rotating_qr(
    session_id: str,
    current_user: User = Depends(get_current_instructor),
    db: AsyncSession = Depends(get_db),
):
    """
    Projeksiyona yansıtılmak üzere her 30 saniyede bir dönen kriptografik QR kodu üretir.
    Yalnızca dersin öğretim üyesi görebilir.
    """
    res = await db.execute(
        select(CourseSession)
        .options(selectinload(CourseSession.course))
        .where(CourseSession.id == session_id)
    )
    session_obj = res.scalars().first()
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Yoklama oturumu bulunamadı.")

    if current_user.role != "admin" and session_obj.course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    now = datetime.now(timezone.utc)
    if session_obj.status != "active" or now >= session_obj.expires_at:
        session_obj.status = "closed"
        await db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Yoklama oturumu sona ermiş.")

    qr_payload = generate_qr_payload(session_obj.id, session_obj.session_secret)
    return RotatingQrResponse(
        success=True,
        session_id=session_obj.id,
        qr_token=qr_payload["qr_token"],
        raw_data=qr_payload["raw_data"],
        seconds_remaining=qr_payload["seconds_remaining"],
    )


# --------------------------------------------------------------------------
# 3. ÖĞRETİM GÖREVLİSİ: Canlı Katılım SSE Yayını
# --------------------------------------------------------------------------
@router.get("/sessions/{session_id}/stream", summary="Canlı Katılım SSE Yayını")
async def attendance_stream(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_instructor),
    db: AsyncSession = Depends(get_db),
):
    """Öğretim görevlisi projeksiyon paneline anlık katılan öğrencileri akıtır."""
    res = await db.execute(
        select(CourseSession)
        .options(selectinload(CourseSession.course))
        .where(CourseSession.id == session_id)
    )
    session_obj = res.scalars().first()
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oturum bulunamadı.")

    if current_user.role != "admin" and session_obj.course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    queue = sse_manager.subscribe(session_id)

    async def event_generator():
        try:
            # İlk bağlantı sinyali
            yield f"event: ping\ndata: {{\"status\": \"connected\", \"session_id\": \"{session_id}\"}}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=20.0)
                    yield data
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            sse_manager.unsubscribe(session_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# --------------------------------------------------------------------------
# 4. ÖĞRENCİ: QR Tarama ve Yoklama Doğrulama
# --------------------------------------------------------------------------
@router.post("/verify", response_model=VerifyAttendanceResponse, summary="QR Kodu Doğrula ve Yoklama Al (Öğrenci)")
async def verify_attendance(
    payload: VerifyAttendanceRequest,
    request: Request,
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """
    Öğrencinin kamerasından okunan QR kodunu doğrular.
    1. Oturum & Süre Kontrolü
    2. HMAC-SHA256 İmza Kontrolü
    3. Derse Kayıt Kontrolü
    4. UniqueConstraint ile mükerrer kayıt engelleme
    5. Audit log ve SSE bildirimi
    """
    ip = get_client_ip(request)
    device_uuid = get_device_uuid(request)

    # 1. QR Parse ve Session Id çıkarma
    from app.services.qr_engine import parse_qr_token
    token_dict = parse_qr_token(payload.qr_token)
    if not token_dict or "session_id" not in token_dict:
        await record_audit_log(
            db=db,
            action="ATTENDANCE_VERIFY",
            result="FAILED_INVALID_QR",
            actor_user_id=current_student.id,
            ip_address=ip,
            device_uuid=device_uuid,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR kod içeriği geçersiz veya bozuk.",
        )

    session_id = token_dict["session_id"]

    # 2. Oturum bilgilerini getir
    res = await db.execute(
        select(CourseSession)
        .options(selectinload(CourseSession.course))
        .where(CourseSession.id == session_id)
    )
    session_obj = res.scalars().first()
    if not session_obj:
        await record_audit_log(
            db=db,
            action="ATTENDANCE_VERIFY",
            result="FAILED_SESSION_NOT_FOUND",
            actor_user_id=current_student.id,
            course_session_id=session_id,
            ip_address=ip,
            device_uuid=device_uuid,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Yoklama oturumu bulunamadı veya kapatılmış.",
        )

    now = datetime.now(timezone.utc)
    if session_obj.status != "active" or now >= session_obj.expires_at:
        await record_audit_log(
            db=db,
            action="ATTENDANCE_VERIFY",
            result="FAILED_SESSION_CLOSED",
            actor_user_id=current_student.id,
            course_session_id=session_id,
            ip_address=ip,
            device_uuid=device_uuid,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Bu dersin yoklama oturumu sona ermiştir.",
        )

    # 3. Kriptografik İmza ve Süre Kontrolü
    is_valid_sig, _, err_sig = verify_qr_payload(payload.qr_token, session_obj.session_secret)
    if not is_valid_sig:
        await record_audit_log(
            db=db,
            action="ATTENDANCE_VERIFY",
            result=f"FAILED_{err_sig}",
            actor_user_id=current_student.id,
            course_session_id=session_id,
            ip_address=ip,
            device_uuid=device_uuid,
        )
        await db.commit()
        if err_sig == "QR_EXPIRED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="QR kodunun süresi dolmuş. Lütfen tahtadaki güncel QR kodunu okutun.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="QR kod imzası doğrulanamadı.",
        )

    # 4. Derse Kayıt Kontrolü (Enrollment Check)
    enr_res = await db.execute(
        select(CourseEnrollment).where(
            and_(
                CourseEnrollment.course_id == session_obj.course_id,
                CourseEnrollment.student_id == current_student.id,
            )
        )
    )
    is_enrolled = enr_res.scalars().first()
    if not is_enrolled:
        await record_audit_log(
            db=db,
            action="ATTENDANCE_VERIFY",
            result="FAILED_NOT_ENROLLED",
            actor_user_id=current_student.id,
            course_session_id=session_id,
            ip_address=ip,
            device_uuid=device_uuid,
            metadata_json={"course_id": session_obj.course_id},
        )
        await db.commit()
        # Öğretim görevlisi paneline red uyarısı yolla
        await sse_manager.broadcast_event(
            session_id=session_id,
            event_type="student_rejected",
            data={
                "reason": "NOT_ENROLLED",
                "student_id": current_student.university_student_id or current_student.id,
                "name": current_student.full_name,
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu derse kayıtlı görünmüyorsunuz.",
        )

    # 5. Yoklama Kaydı Ekleme (ACID Transaction + Unique Constraint Koruması)
    user_agent = request.headers.get("User-Agent")
    record = AttendanceRecord(
        course_session_id=session_id,
        student_id=current_student.id,
        verified_at=now,
        device_uuid_hash=hash_sensitive_value(device_uuid),
        ip_hash=hash_sensitive_value(ip),
        user_agent_hash=hash_sensitive_value(user_agent),
        verification_result="SUCCESS",
        idempotency_key=payload.idempotency_key,
    )
    db.add(record)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        await record_audit_log(
            db=db,
            action="ATTENDANCE_VERIFY",
            result="FAILED_DUPLICATE",
            actor_user_id=current_student.id,
            course_session_id=session_id,
            ip_address=ip,
            device_uuid=device_uuid,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu ders için yoklamanız daha önce başarıyla alınmıştır.",
        )

    # 6. Başarılı İşlem: Audit Log ve SSE Canlı Bildirimi
    await record_audit_log(
        db=db,
        action="ATTENDANCE_VERIFY",
        result="SUCCESS",
        actor_user_id=current_student.id,
        course_session_id=session_id,
        ip_address=ip,
        device_uuid=device_uuid,
        metadata_json={"course_code": session_obj.course.course_code},
    )
    await db.commit()

    # Öğretim görevlisi ekranına anlık düşür
    await sse_manager.broadcast_event(
        session_id=session_id,
        event_type="student_verified",
        data={
            "student_id": current_student.university_student_id or current_student.id,
            "full_name": current_student.full_name,
            "verified_at": now.isoformat(),
        },
    )

    return VerifyAttendanceResponse(
        success=True,
        status="VERIFIED",
        message="Yoklamanız başarıyla kaydedildi.",
        record=AttendanceVerifiedRecord(
            id=record.id,
            course_code=session_obj.course.course_code,
            course_name=session_obj.course.name,
            verified_at=record.verified_at,
        ),
    )


# --------------------------------------------------------------------------
# 5. ÖĞRETİM GÖREVLİSİ: Oturumu Manuel Kapatma
# --------------------------------------------------------------------------
@router.post("/sessions/{session_id}/close", summary="Yoklama Oturumunu Kapat")
async def close_session(
    session_id: str,
    request: Request,
    current_user: User = Depends(get_current_instructor),
    db: AsyncSession = Depends(get_db),
):
    """Oturumu manuel olarak sonlandırır."""
    res = await db.execute(
        select(CourseSession)
        .options(selectinload(CourseSession.course))
        .where(CourseSession.id == session_id)
    )
    session_obj = res.scalars().first()
    if not session_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Oturum bulunamadı.")

    if current_user.role != "admin" and session_obj.course.instructor_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Yetkisiz erişim.")

    session_obj.status = "closed"

    count_res = await db.execute(
        select(AttendanceRecord).where(AttendanceRecord.course_session_id == session_id)
    )
    total_count = len(count_res.scalars().all())

    await record_audit_log(
        db=db,
        action="CLOSE_SESSION",
        result="SUCCESS",
        actor_user_id=current_user.id,
        course_session_id=session_id,
        ip_address=get_client_ip(request),
        metadata_json={"total_verified": total_count},
    )
    await db.commit()

    # Canlı akışa kapatma sinyali
    await sse_manager.broadcast_event(
        session_id=session_id,
        event_type="session_closed",
        data={"total_verified": total_count},
    )

    return {"success": True, "message": "Oturum kapatıldı.", "total_verified": total_count}


# --------------------------------------------------------------------------
# 6. LİSTELEME: Oturumun Katılım Listesi (Resmi show ile uyumlu)
# --------------------------------------------------------------------------
@router.get("/sessions/{session_id}/records", response_model=AttendanceShowResponse, summary="Katılım Listesi")
@router.get("/show", response_model=AttendanceShowResponse, summary="Yoklama Görüntüleme (Resmi API Uyumu)")
async def get_attendance_records(
    session_id: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Yoklama kayıtlarını listeler."""
    query = (
        select(AttendanceRecord)
        .options(
            selectinload(AttendanceRecord.student),
            selectinload(AttendanceRecord.session).selectinload(CourseSession.course),
        )
    )
    if session_id:
        query = query.where(AttendanceRecord.course_session_id == session_id)

    res = await db.execute(query.order_by(AttendanceRecord.verified_at.desc()))
    records = res.scalars().all()

    record_items = [
        AttendanceRecordItem(
            id=r.id,
            university_student_id=r.student.university_student_id if r.student else None,
            full_name=r.student.full_name if r.student else "Öğrenci",
            verified_at=r.verified_at,
        )
        for r in records
    ]

    course_code = records[0].session.course.course_code if records and records[0].session and records[0].session.course else "DERS"

    return AttendanceShowResponse(
        success=True,
        session_id=session_id or (records[0].course_session_id if records else ""),
        course_code=course_code,
        total_count=len(record_items),
        records=record_items,
    )


# --------------------------------------------------------------------------
# 7. ÖĞRENCİ: Kendi Yoklama Geçmişi
# --------------------------------------------------------------------------
@router.get("/my-records", summary="Öğrencinin Kendi Yoklama Geçmişi")
async def get_my_records(
    current_student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
):
    """Öğrencinin katıldığı tüm ders yoklamalarını listeler."""
    res = await db.execute(
        select(AttendanceRecord)
        .options(selectinload(AttendanceRecord.session).selectinload(CourseSession.course))
        .where(AttendanceRecord.student_id == current_student.id)
        .order_by(AttendanceRecord.verified_at.desc())
    )
    records = res.scalars().all()

    return {
        "success": True,
        "records": [
            {
                "id": r.id,
                "course_code": r.session.course.course_code if r.session and r.session.course else "-",
                "course_name": r.session.course.name if r.session and r.session.course else "-",
                "verified_at": r.verified_at.isoformat(),
                "status": r.verification_result,
            }
            for r in records
        ],
    }
