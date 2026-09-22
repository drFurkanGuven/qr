# Yetkili Üniversite Yoklama Sistemi - Dağıtım ve Kurulum Kılavuzu (Deployment Guide)

Bu doküman, sistemin Docker Compose ve Nginx ters proxy arkasında canlı sunucu ortamında (Ubuntu/Debian) yüksek güvenlik ve yüksek eşzamanlılık standartlarıyla nasıl kurulacağını açıklar.

---

## 1. Dağıtım Topolojisi

```
             İNTERNET (HTTPS / 443)
                       │
                       ▼
           [ Nginx Ters Proxy & TLS ]
             - Let's Encrypt / Kurumsal SSL
             - HSTS, CSP, X-Frame-Options
             - Rate Limiting (IP & Endpoint)
             - SSE Stream Desteği (Buffering Off)
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[ Next.js Frontend ]       [ FastAPI Backend ]
Port 3000                  Port 8000
         │                           │
         └─────────────┬─────────────┘
                       ▼
             [ PostgreSQL 16 DB ]
             Port 5432 (Yalnızca İç Ağ)
```

---

## 2. Ortam Değişkenleri (.env)

Sunucuda proje kök dizininde `.env` dosyası aşağıdaki gibi yapılandırılmalıdır:

```ini
# --- Genel Ayarlar ---
ENVIRONMENT=production
DEBUG=False
APP_PORT=8001
SECRET_KEY=BURAYA_EN_AZ_64_KARAKTERLI_GUCLU_RASTGELE_ANAHTAR_URETIN

# --- PostgreSQL Veritabanı ---
POSTGRES_SERVER=db
POSTGRES_PORT=5432
POSTGRES_USER=qr_admin
POSTGRES_PASSWORD=BURAYA_GUCLU_VERITABANI_PAROLASI_YAZIN
POSTGRES_DB=qr_university
DATABASE_URL=postgresql+asyncpg://qr_admin:PAROLA@db:5432/qr_university

# --- Fırat Üniversitesi CAS & Servis Bağlantıları ---
CAS_SERVER_URL=https://jasig.firat.edu.tr/cas
CAS_SERVICE_URL=https://qr.firat.edu.tr
FIRAT_API_BASE_URL=https://qr.firat.edu.tr/api

# --- CORS & Çerez Güvenliği ---
BACKEND_CORS_ORIGINS=["https://qr.firat.edu.tr", "https://yoklama.firat.edu.tr"]
COOKIE_DOMAIN=.firat.edu.tr
COOKIE_SECURE=True
COOKIE_SAMESITE=lax

# --- QR ve Oturum Süreleri ---
QR_ROTATION_SECONDS=30
QR_TOLERANCE_SECONDS=10
SESSION_MAX_AGE_SECONDS=86400
```

---

## 3. Örnek Nginx Yapılandırması (`/etc/nginx/sites-available/qr.firat.edu.tr`)

```nginx
upstream frontend_upstream {
    server 127.0.0.1:8001; # Docker container portu
    keepalive 32;
}

server {
    listen 80;
    server_name qr.firat.edu.tr;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name qr.firat.edu.tr;

    ssl_certificate /etc/ssl/certs/qr_firat_edu_tr.crt;
    ssl_certificate_key /etc/ssl/private/qr_firat_edu_tr.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Güvenlik Başlıkları
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Statik ve Dinamik İstekler
    location / {
        proxy_pass http://frontend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Canlı Katılım SSE Yayını için Buffer Kapatma
    location /api/v1/attendance/sessions/.*/stream {
        proxy_pass http://frontend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}
```

---

## 4. PostgreSQL Bağlantı Havuzu (Connection Pool) Ayarları

Amfi ortamında 100+ öğrencinin eşzamanlı yoklama göndermesini kaldırmak için `backend/app/core/database.py` dosyasında asyncpg motoru optimize edilmiştir:

- `pool_size=20`: Normal havuzdaki kalıcı bağlantı sayısı.
- `max_overflow=30`: Ani yoğunlukta açılabilen ek bağlantı sayısı (toplam 50 bağlantı).
- `pool_timeout=10`: Bağlantı bekleme zaman aşımı.
- `pool_recycle=1800`: 30 dakikada bir bayat bağlantıları yenileme.
