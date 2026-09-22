import re
import time
import httpx
from datetime import datetime, timezone, timedelta
from typing import Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.student_profile import StudentProfile
from app.core.config import settings


class CasAuthenticator:
    """
    Öğrenci profilleri adına Fırat Üniversitesi CAS sunucusuna otomatik giriş yapıp
    resmi Bearer Access Token elde eden motor.
    """

    @classmethod
    async def get_valid_token(
        cls,
        profile: StudentProfile,
        db: AsyncSession
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Öğrencinin geçerli Bearer token'ını döner.
        Önbellekte geçerli token varsa doğrudan onu kullanır; yoksa CAS login yapar.
        Döner: (access_token, error_message)
        """
        now = datetime.now(timezone.utc)

        # 1. Önbellekteki token hâlâ geçerli mi?
        if profile.cached_token and profile.token_expires_at:
            if profile.token_expires_at > now + timedelta(seconds=60):
                return profile.cached_token, None

        # 2. Test / Geliştirme Ortamı ise yerel simüle token üret
        if profile.password.startswith("test_") or settings.ENVIRONMENT == "development" and not settings.UPSTREAM_MODE:
            mock_token = f"simulated_token_{profile.student_no}_{int(time.time())}"
            profile.cached_token = mock_token
            profile.token_expires_at = now + timedelta(hours=12)
            await db.flush()
            return mock_token, None

        # 3. Gerçek Fırat CAS Login Akışı
        try:
            async with httpx.AsyncClient(timeout=12.0, follow_redirects=False) as client:
                # 3a. CAS Login formunu ve execution biletini çek
                cas_url = f"{settings.CAS_SERVER_URL}/login?service={settings.CAS_SERVICE_URL}"
                init_res = await client.get(cas_url)
                if init_res.status_code != 200:
                    return None, f"CAS sunucusuna erişilemedi (HTTP {init_res.status_code})"

                html = init_res.text
                exec_match = re.search(r'name=["\']execution["\']\s+value=["\']([^"\']+)["\']', html)
                if not exec_match:
                    exec_match = re.search(r'value=["\']([^"\']+)["\']\s+name=["\']execution["\']', html)
                execution_token = exec_match.group(1) if exec_match else ""

                # 3b. Kullanıcı adı ve şifre ile POST et
                login_data = {
                    "username": profile.student_no,
                    "password": profile.password,
                    "execution": execution_token,
                    "_eventId": "submit",
                }
                headers = {
                    "Referer": cas_url,
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
                }

                post_res = await client.post(cas_url, data=login_data, headers=headers)

                # CAS başarılı girişte 302 ile service URL'ine döner: service?ticket=ST-...
                ticket = None
                location = post_res.headers.get("Location") or ""
                ticket_match = re.search(r"ticket=([a-zA-Z0-9_\-]+)", location)
                if ticket_match:
                    ticket = ticket_match.group(1)
                else:
                    # Bazen body içinde veya takip edilen URL'de olabilir
                    body_ticket = re.search(r"ticket=([a-zA-Z0-9_\-]+)", post_res.text)
                    if body_ticket:
                        ticket = body_ticket.group(1)

                if not ticket:
                    return None, "CAS kimlik doğrulaması başarısız (Öğrenci no veya şifre hatalı olabilir)"

                # 3c. Bilet ile resmi API'den Token Exchange yap
                exchange_res = await client.post(
                    settings.FIRAT_CAS_TOKEN_ENDPOINT,
                    json={
                        "ticket": ticket,
                        "service": settings.CAS_SERVICE_URL,
                        "device_uuid": profile.device_uuid,
                    },
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    }
                )

                if exchange_res.status_code == 200:
                    data = exchange_res.json()
                    access_token = data.get("access_token")
                    expires_in = data.get("expires_in", 86400)

                    if access_token:
                        profile.cached_token = access_token
                        profile.token_expires_at = now + timedelta(seconds=expires_in)
                        await db.flush()
                        return access_token, None

                return None, f"Token exchange başarısız: HTTP {exchange_res.status_code}"

        except Exception as e:
            return None, f"CAS bağlantı hatası: {str(e)}"


cas_authenticator = CasAuthenticator()
