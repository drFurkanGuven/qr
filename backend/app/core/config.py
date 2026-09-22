from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Yetkili Üniversite Yoklama Sistemi"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "dev-secret-key-change-in-production-min-64-characters-long-please-123456"

    # Fırat Üniversitesi Bilinen Servis URL'leri
    CAS_SERVER_URL: str = "https://jasig.firat.edu.tr/cas"
    CAS_SERVICE_URL: str = "https://qr.firat.edu.tr"
    FIRAT_API_BASE_URL: str = "https://qr.firat.edu.tr/api"
    FIRAT_CAS_TOKEN_ENDPOINT: str = "https://qr.firat.edu.tr/api/auth/cas/token"
    FIRAT_ATTENDANCE_VERIFY_ENDPOINT: str = "https://qr.firat.edu.tr/api/attendance/verify"
    FIRAT_ATTENDANCE_SHOW_ENDPOINT: str = "https://qr.firat.edu.tr/api/attendance/show"
    FIRAT_DEVICE_REGISTER_ENDPOINT: str = "https://qr.firat.edu.tr/api/device/register"
    FIRAT_USER_ENDPOINT: str = "https://qr.firat.edu.tr/api/user"

    # Upstream entegrasyon modu: Test ortamında yerel doğrulama yapar,
    # üniversite izinli ortamında doğrudan Fırat API'sine istek gönderir.
    UPSTREAM_MODE: bool = False

    # Güvenli Oturum Çerezi (httpOnly Cookie)
    COOKIE_NAME: str = "session_token"
    COOKIE_SECURE: bool = False  # Development: False, Production: True (HTTPS)
    COOKIE_SAMESITE: str = "lax"
    COOKIE_MAX_AGE_SECONDS: int = 24 * 60 * 60  # 24 saat
    COOKIE_DOMAIN: str | None = None

    # QR Rotasyon & Geçerlilik Süreleri (saniye)
    QR_ROTATION_SECONDS: int = 30
    QR_TOLERANCE_SECONDS: int = 15

    # Audit Log Hashleme Tuzu (Salt)
    AUDIT_SALT: str = "firat-qr-audit-salt-2026"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "qr_automation"
    DATABASE_URL: str | None = None

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
            return self.DATABASE_URL
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "https://qr.firat.edu.tr",
        "*"
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
