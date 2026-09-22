from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.student_profile import StudentProfile
from app.schemas.profile import (
    StudentProfileCreate,
    StudentProfileUpdate,
    StudentProfileResponse,
)
from app.services.cas_authenticator import cas_authenticator

router = APIRouter(prefix="/profiles", tags=["Öğrenci Profilleri (Dekanlık / TÜBİTAK)"])


@router.get("", response_model=List[StudentProfileResponse], summary="Tüm Öğrenci Profillerini Listele")
async def list_profiles(
    group_tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Kayıtlı TÜBİTAK / öğrenci profillerini listeler."""
    query = select(StudentProfile)
    if group_tag and group_tag != "all":
        query = query.where(StudentProfile.group_tag == group_tag)

    res = await db.execute(query.order_by(StudentProfile.student_no.asc()))
    profiles = res.scalars().all()

    now = datetime.now(timezone.utc)
    return [
        StudentProfileResponse(
            id=p.id,
            student_no=p.student_no,
            full_name=p.full_name,
            device_uuid=p.device_uuid,
            group_tag=p.group_tag,
            is_active=p.is_active,
            has_valid_token=bool(p.cached_token and p.token_expires_at and p.token_expires_at > now),
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in profiles
    ]


@router.post("", response_model=StudentProfileResponse, status_code=status.HTTP_201_CREATED, summary="Yeni Öğrenci Profili Ekle")
async def create_profile(
    payload: StudentProfileCreate,
    db: AsyncSession = Depends(get_db),
):
    """Yeni bir öğrenci profili ekler (Öğrenci No, Şifre, Device UUID)."""
    # Tekillik kontrolü
    res = await db.execute(select(StudentProfile).where(StudentProfile.student_no == payload.student_no))
    existing = res.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{payload.student_no} numaralı öğrenci zaten kayıtlı.",
        )

    profile = StudentProfile(
        student_no=payload.student_no.strip(),
        password=payload.password.strip(),
        device_uuid=payload.device_uuid.strip(),
        full_name=payload.full_name.strip(),
        group_tag=payload.group_tag.strip() or "tubitak_ekip",
        is_active=payload.is_active,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)

    return StudentProfileResponse(
        id=profile.id,
        student_no=profile.student_no,
        full_name=profile.full_name,
        device_uuid=profile.device_uuid,
        group_tag=profile.group_tag,
        is_active=profile.is_active,
        has_valid_token=False,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.put("/{profile_id}", response_model=StudentProfileResponse, summary="Öğrenci Profilini Güncelle")
async def update_profile(
    profile_id: str,
    payload: StudentProfileUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Öğrenci profil bilgilerini veya aktifliğini günceller."""
    res = await db.execute(select(StudentProfile).where(StudentProfile.id == profile_id))
    profile = res.scalars().first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil bulunamadı.")

    if payload.student_no is not None:
        profile.student_no = payload.student_no.strip()
    if payload.password is not None and payload.password.strip():
        profile.password = payload.password.strip()
        profile.cached_token = None  # Parola değiştiyse token sıfırlanır
    if payload.device_uuid is not None:
        profile.device_uuid = payload.device_uuid.strip()
    if payload.full_name is not None:
        profile.full_name = payload.full_name.strip()
    if payload.group_tag is not None:
        profile.group_tag = payload.group_tag.strip()
    if payload.is_active is not None:
        profile.is_active = payload.is_active

    await db.commit()
    await db.refresh(profile)

    now = datetime.now(timezone.utc)
    return StudentProfileResponse(
        id=profile.id,
        student_no=profile.student_no,
        full_name=profile.full_name,
        device_uuid=profile.device_uuid,
        group_tag=profile.group_tag,
        is_active=profile.is_active,
        has_valid_token=bool(profile.cached_token and profile.token_expires_at and profile.token_expires_at > now),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.delete("/{profile_id}", summary="Öğrenci Profilini Sil")
async def delete_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Öğrenci profilini siler."""
    res = await db.execute(select(StudentProfile).where(StudentProfile.id == profile_id))
    profile = res.scalars().first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil bulunamadı.")

    await db.delete(profile)
    await db.commit()
    return {"success": True, "message": "Profil silindi."}


@router.post("/{profile_id}/test-auth", summary="Öğrencinin CAS Girişini Test Et")
async def test_student_auth(
    profile_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Tek bir öğrencinin şifre ve device_uuid ile CAS oturum açıp açamadığını test eder."""
    res = await db.execute(select(StudentProfile).where(StudentProfile.id == profile_id))
    profile = res.scalars().first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profil bulunamadı.")

    token, err = await cas_authenticator.get_valid_token(profile, db)
    await db.commit()

    if not token:
        return {
            "success": False,
            "message": f"CAS Girişi Başarısız: {err}",
            "student_no": profile.student_no,
        }

    return {
        "success": True,
        "message": "Fırat CAS girişi ve Token Exchange başarıyla tamamlandı!",
        "student_no": profile.student_no,
        "token_preview": token[:16] + "...",
    }
