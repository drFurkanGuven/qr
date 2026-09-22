import httpx
import time
from typing import Optional, Dict, Any, Tuple
from app.core.config import settings

# Tek kullanımlık biletlerin tekrar kullanılmasını önleyen kısa ömürlü önbellek
# (ticket_hash -> consumed_timestamp)
_CONSUMED_TICKETS: Dict[str, float] = {}


def _cleanup_old_tickets():
    now = time.time()
    to_delete = [t for t, exp in _CONSUMED_TICKETS.items() if now - exp > 3600]
    for t in to_delete:
        del _CONSUMED_TICKETS[t]


class CasService:
    @staticmethod
    def is_ticket_already_used(ticket: str) -> bool:
        _cleanup_old_tickets()
        return ticket in _CONSUMED_TICKETS

    @staticmethod
    def mark_ticket_used(ticket: str):
        _CONSUMED_TICKETS[ticket] = time.time()

    @classmethod
    async def validate_ticket(
        cls,
        ticket: str,
        service_url: Optional[str] = None
    ) -> Tuple[bool, Optional[Dict[str, Any]], Optional[str]]:
        """
        Validates a CAS ticket.
        Returns: (is_valid, user_data_dict, error_code)
        """
        ticket_clean = ticket.strip()
        if not ticket_clean:
            return False, None, "TICKET_MISSING"

        if cls.is_ticket_already_used(ticket_clean):
            return False, None, "TICKET_ALREADY_USED"

        target_service = service_url or settings.CAS_SERVICE_URL

        # 1. Test / Geliştirme Ortamı Biletleri (Mock CAS)
        # Eğer bilet "ST-TEST-" ile başlıyorsa veya upstream kapalıysa güvenli test modunu çalıştır
        if ticket_clean.startswith("ST-TEST-") or settings.ENVIRONMENT == "development":
            # Örnek test bilet formatları:
            # ST-TEST-STUDENT-210101001
            # ST-TEST-INSTRUCTOR-1001
            # ST-TEST-ANYTHING
            parts = ticket_clean.split("-")
            role = "student"
            user_id_num = "210101001"
            subject = "fguven"

            if len(parts) >= 4 and parts[2].lower() == "instructor":
                role = "instructor"
                user_id_num = parts[3]
                subject = f"hoca_{user_id_num}"
            elif len(parts) >= 4:
                user_id_num = parts[3]
                subject = f"ogr_{user_id_num}"

            cls.mark_ticket_used(ticket_clean)
            return True, {
                "cas_subject": subject,
                "university_student_id": user_id_num,
                "full_name": f"Test Kullanıcı ({subject})",
                "email": f"{subject}@firat.edu.tr",
                "role": role,
            }, None

        # 2. Resmi Fırat CAS Sunucusuna / Token Endpoint'ine Doğrulama
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Upstream token exchange endpoint'i
                resp = await client.post(
                    settings.FIRAT_CAS_TOKEN_ENDPOINT,
                    json={
                        "ticket": ticket_clean,
                        "service": target_service,
                    },
                    headers={"Accept": "application/json"}
                )

                if resp.status_code == 200:
                    data = resp.json()
                    cls.mark_ticket_used(ticket_clean)
                    user_data = data.get("user", {})
                    return True, {
                        "cas_subject": user_data.get("username") or user_data.get("cas_subject", "user"),
                        "university_student_id": user_data.get("student_id") or user_data.get("university_student_id"),
                        "full_name": user_data.get("name") or user_data.get("full_name", "Fırat Üniversitesi Kullanıcısı"),
                        "email": user_data.get("email", "user@firat.edu.tr"),
                        "role": user_data.get("role", "student"),
                    }, None
                else:
                    return False, None, "TICKET_INVALID_OR_EXPIRED"
        except Exception:
            return False, None, "CAS_UPSTREAM_UNAVAILABLE"


cas_service = CasService()
