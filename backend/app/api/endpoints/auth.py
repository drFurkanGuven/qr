from fastapi import APIRouter, Depends, HTTPException, status, Response, Request, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user, get_client_ip, get_device_uuid
from app.services.cas_service import cas_service
from app.services.session_service import create_session_token
from app.services.audit_service import record_audit_log
from app.models.user import User
from app.models.course import CourseEnrollment
from app.schemas.auth import (
    CasTokenExchangeRequest,
    TokenResponse,
    UserBrief,
    UserMeResponse,
    EnrolledCourseBrief,
)

router = APIRouter(prefix="/auth", tags=["Kimlik Doğrulama (Auth & CAS)"])


@router.get("/cas/start", summary="CAS Giriş Sayfasına Yönlendirme")
async def cas_start(return_url: str | None = None):
    """Kullanıcıyı resmi Fırat Üniversitesi CAS giriş sayfasına yönlendirir."""
    target_service = f"{settings.CAS_SERVICE_URL}/api/v1/auth/cas/callback"
    cas_login_url = f"{settings.CAS_SERVER_URL}/login?service={target_service}"
    return RedirectResponse(url=cas_login_url, status_code=status.HTTP_302_FOUND)


@router.get("/cas/callback", summary="CAS Bilet Doğrulama ve Oturum Oluşturma")
async def cas_callback(
    request: Request,
    response: Response,
    ticket: str = Query(..., description="CAS Service Ticket (ST-xxxx)"),
    db: AsyncSession = Depends(get_db),
):
    """
    CAS sunucusunun yönlendirdiği bilet ile oturum açar.
    Güvenlik: Token JS'e açılmaz; httpOnly Secure çerez olarak atanır.
    """
    ip = get_client_ip(request)
    is_valid, user_data, err_code = await cas_service.validate_ticket(ticket)

    if not is_valid or not user_data:
        await record_audit_log(
            db=db,
            action="CAS_LOGIN",
            result=err_code or "FAILED",
            ip_address=ip,
            metadata_json={"ticket_prefix": ticket[:8] if ticket else None},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"CAS bileti geçersiz veya süresi dolmuş: {err_code}",
        )

    # Kullanıcıyı DB'de bul veya oluştur
    cas_subject = user_data["cas_subject"]
    res = await db.execute(select(User).where(User.cas_subject == cas_subject))
    user = res.scalars().first()

    if not user:
        user = User(
            university_student_id=user_data.get("university_student_id"),
            cas_subject=cas_subject,
            email=user_data["email"],
            full_name=user_data["full_name"],
            role=user_data.get("role", "student"),
        )
        db.add(user)
        await db.flush()

    # Session token üret ve httpOnly çereze koy
    token = create_session_token({"sub": user.id, "role": user.role, "cas_subject": user.cas_subject})
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        max_age=settings.COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )

    await record_audit_log(
        db=db,
        action="CAS_LOGIN",
        result="SUCCESS",
        actor_user_id=user.id,
        ip_address=ip,
    )
    await db.commit()

    return {
        "success": True,
        "message": "Giriş başarılı.",
        "user": UserBrief.model_validate(user),
    }


@router.post("/cas/token", response_model=TokenResponse, summary="Doğrudan CAS Bilet Değişimi (Resmi API Sözleşmesi)")
async def cas_token_exchange(
    payload: CasTokenExchangeRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    Resmi Fırat API sözleşmesine uygun CAS bilet değişimi.
    Hem Bearer access_token döner hem de httpOnly çerez atar.
    """
    ip = get_client_ip(request)
    device_uuid = payload.device_uuid or get_device_uuid(request)
    is_valid, user_data, err_code = await cas_service.validate_ticket(payload.ticket, payload.service)

    if not is_valid or not user_data:
        await record_audit_log(
            db=db,
            action="TOKEN_EXCHANGE",
            result=err_code or "FAILED",
            ip_address=ip,
            device_uuid=device_uuid,
            metadata_json={"ticket_prefix": payload.ticket[:8]},
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"CAS ticket geçersiz veya süresi dolmuş: {err_code}",
        )

    cas_subject = user_data["cas_subject"]
    res = await db.execute(select(User).where(User.cas_subject == cas_subject))
    user = res.scalars().first()

    if not user:
        user = User(
            university_student_id=user_data.get("university_student_id"),
            cas_subject=cas_subject,
            email=user_data["email"],
            full_name=user_data["full_name"],
            role=user_data.get("role", "student"),
        )
        db.add(user)
        await db.flush()

    token = create_session_token({"sub": user.id, "role": user.role, "cas_subject": user.cas_subject})
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=token,
        max_age=settings.COOKIE_MAX_AGE_SECONDS,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )

    await record_audit_log(
        db=db,
        action="TOKEN_EXCHANGE",
        result="SUCCESS",
        actor_user_id=user.id,
        ip_address=ip,
        device_uuid=device_uuid,
    )
    await db.commit()

    return TokenResponse(
        success=True,
        access_token=token,
        token_type="Bearer",
        expires_in=settings.COOKIE_MAX_AGE_SECONDS,
        user=UserBrief.model_validate(user),
    )


@router.get("/me", response_model=UserMeResponse, summary="Aktif Kullanıcı Bilgisi")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Giriş yapmış kullanıcının profil ve ders kayıt bilgilerini döner."""
    res = await db.execute(
        select(CourseEnrollment)
        .options(selectinload(CourseEnrollment.course))
        .where(CourseEnrollment.student_id == current_user.id)
    )
    enrollments = res.scalars().all()

    courses_brief = [
        EnrolledCourseBrief(
            course_id=e.course.id,
            course_code=e.course.course_code,
            name=e.course.name,
        )
        for e in enrollments
        if e.course
    ]

    return UserMeResponse(
        success=True,
        user=UserBrief.model_validate(current_user),
        enrolled_courses=courses_brief,
    )


@router.post("/logout", summary="Güvenli Çıkış (Logout)")
async def logout(
    response: Response,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Oturum çerezini sıfırlar."""
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        domain=settings.COOKIE_DOMAIN,
        path="/",
    )
    await record_audit_log(
        db=db,
        action="LOGOUT",
        result="SUCCESS",
        actor_user_id=current_user.id,
        ip_address=get_client_ip(request),
    )
    await db.commit()
    return {"success": True, "message": "Başarıyla çıkış yapıldı."}