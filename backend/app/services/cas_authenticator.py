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
    async def verify_token_alive(cls, token: str, device_uuid: str) -> Tuple[bool, Optional[str]]:
        """
        Token'ın Fırat API (/api/user) nezdinde geçerli olup olmadığını test eder.
        Döner: (is_alive, user_display_name_or_error)
        """
        if not token or not token.strip():
            return False, "Token boş"
        try:
            headers = {
                "Host": "qr.firat.edu.tr",
                "Accept": "application/json",
                "Authorization": f"Bearer {token.strip()}",
                "X-Device-Uuid": device_uuid,
                "User-Agent": "FiratMobil/2 CFNetwork/3896.100.1.2.1 Darwin/27.0.0",
                "Accept-Language": "tr-TR,tr;q=0.9",
            }
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(f"{settings.FIRAT_API_BASE_URL}/user", headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    name = data.get("name") or data.get("full_name") or data.get("username") or "Aktif Kullanıcı"
                    return True, name
                return False, f"HTTP {res.status_code}"
        except Exception as e:
            return False, str(e)

    @classmethod
    async def get_valid_token(
        cls,
        profile: StudentProfile,
        db: AsyncSession
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Öğrencinin geçerli Bearer token'ını döner.
        1. Önbellekteki veya manuel girilen token geçerliyse doğrudan kullanır (CAS'ı atlar).
        2. Gerekirse /api/user ile token'ın canlılığını teyit eder.
        3. Token yoksa veya geçersizse Fırat CAS oturumu açar.
        """
        now = datetime.now(timezone.utc)

        # 1. Önbellekteki veya manuel girilmiş token var mı?
        if profile.cached_token and profile.cached_token.strip():
            clean_token = profile.cached_token.strip()
            # Süresi hâlâ devam ediyorsa direkt kullan
            if profile.token_expires_at and profile.token_expires_at > now + timedelta(seconds=60):
                return clean_token, None

            # Süresi belirsizse veya bitmişse, canlılığını /api/user ile test et
            alive, info = await cls.verify_token_alive(clean_token, profile.device_uuid)
            if alive:
                profile.token_expires_at = now + timedelta(days=30)
                await db.flush()
                return clean_token, None
            elif not profile.password:
                return None, f"Kayıtlı Bearer Token geçersiz veya süresi dolmuş ({info}). Lütfen yeni token girin."

        # 2. Test / Geliştirme Ortamı ise yerel simüle token üret
        if profile.password and profile.password.startswith("test_") or (settings.ENVIRONMENT == "development" and not settings.UPSTREAM_MODE):
            mock_token = f"simulated_token_{profile.student_no}_{int(time.time())}"
            profile.cached_token = mock_token
            profile.token_expires_at = now + timedelta(hours=12)
            await db.flush()
            return mock_token, None

        if not profile.password:
            return None, "Öğrenci profili için ne geçerli bir Bearer token ne de CAS parolası bulunuyor."

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
                        "Host": "qr.firat.edu.tr",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "X-Device-Uuid": profile.device_uuid,
                        "User-Agent": "FiratMobil/2 CFNetwork/3896.100.1.2.1 Darwin/27.0.0",
                        "Accept-Language": "tr-TR,tr;q=0.9",
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
