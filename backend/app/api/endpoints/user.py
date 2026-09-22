from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User

router = APIRouter(tags=["Kullanıcı (Resmi API Sözleşmesi)"])


@router.get("/user", summary="Kullanıcı Bilgisi (Resmi API Uyumu)")
async def get_official_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resmi Fırat API sözleşmesine birebir uygun kullanıcı bilgisi döndürür."""
    return {
        "id": current_user.id,
        "student_id": current_user.university_student_id,
        "name": current_user.full_name,
        "email": current_user.email,
        "role": current_user.role,
        "status": "active" if current_user.is_active else "inactive",
    }
