# 🎓 Fırat Üniversitesi Yetkili Yoklama Sistemi

Fırat Üniversitesi CAS (Central Authentication Service) altyapısına tam uyumlu, kurumsal seviyede güvenli, öğretim görevlisi ve öğrenci rollerini kesin sınırlarla ayıran yeni nesil dinamik QR tabanlı yoklama platformu.

---

## 🛠 Teknoloji Yığını (Tech Stack)

- **Backend**: FastAPI (Python 3.11+), SQLAlchemy 2.0 (Async), AsyncPG, HTTPX, Pydantic v2, PyJWT, Cryptography
- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React, ZXing + native BarcodeDetector
- **Veritabanı**: PostgreSQL 16 (ACID Transaction, `UNIQUE(course_session_id, student_id)`)
- **Konteyner & Dağıtım**: Docker, Docker Compose, Nginx Reverse Proxy (TLS 1.3, SSE Stream Buffering Off)

---

## 🏗 Proje Yapısı

```
├── docs/                       # Mimari ve Güvenlik Spesifikasyonları
│   ├── architecture.md         # Sistem mimarisi ve bileşenler
│   ├── threat-model.md         # STRIDE tehdit analizi ve savunmalar
│   ├── api-contract.md         # Uçtan uca API sözleşmesi ve hata kodları
│   ├── database-schema.sql     # PostgreSQL 16 DDL şeması ve kısıtlar
│   ├── sequence-diagrams.md    # Mermaid akış ve sıra diyagramları
│   └── deployment.md           # Nginx, SSL, Docker ve canlı dağıtım rehberi
├── backend/                    # FastAPI Asenkron REST & SSE API
│   ├── app/
│   │   ├── api/                # Rotalar (auth, attendance, courses, device, user)
│   │   ├── core/               # Konfigürasyon (config.py) ve Veritabanı (database.py)
│   │   ├── models/             # ORM Modelleri (User, Course, Session, Attendance, Audit)
│   │   ├── schemas/            # Pydantic v2 Şemaları
│   │   ├── services/           # CAS Service, QR Engine, Audit, SSE Manager
│   │   ├── seed.py             # Başlangıç test verisi oluşturucu
│   │   └── main.py             # FastAPI uygulama giriş noktası
│   ├── tests/                  # Pytest test paketi (CAS, QR, Eşzamanlılık, Hijyen)
│   ├── Dockerfile              # Python 3.11 slim konteyner imajı
│   └── requirements.txt
├── frontend/                   # Next.js 14 Web Uygulaması
│   ├── src/
│   │   ├── app/                # Sayfalar (/ [Giriş], /student, /instructor)
│   │   ├── components/         # QR Tarayıcı Modal, Dinamik Dönen SVG QR, Navbar
│   │   └── lib/                # API İstemcisi, Tipler, QR Çözücü Motoru
│   ├── Dockerfile              # Standalone optimize Next.js imajı
│   └── package.json
├── docker-compose.yml          # DB + Backend + Frontend orkestrasyonu
├── .env.example                # Ortam değişkenleri şablonu
├── deploy.sh                   # Canlı sunucu tek komut dağıtım betiği
└── README.md
```

---

## ⚡ Temel Güvenlik ve Mimari Kurallar

1. **Token ve Çerez Güvenliği (Zero Token Leakage):**
   - CAS Service Ticket (ST) veya Bearer Token'lar asla istemci JavaScript'ine (`localStorage`, `sessionStorage`) açılmaz.
   - Oturumlar şifrelenmiş, `httpOnly`, `Secure`, `SameSite=Lax` nitelikli HTTP çerezleri üzerinden yönetilir.
2. **30 Saniyede Bir Dönen Dinamik QR:**
   - Projeksiyondaki QR kod her 30 saniyede bir HMAC-SHA256 imzası ve yeni bir `nonce` ile yenilenir.
   - Sınıf dışına ekran görüntüsü gönderilmesi engellenir.
3. **Mükerrer Kayıt ve Yarış Koşulu Önleme:**
   - Veritabanı seviyesinde `UNIQUE(course_session_id, student_id)` kısıtlaması uygulanmıştır.
   - 100+ öğrencinin aynı milisaniyede istek atması durumunda dahi asla mükerrer yoklama oluşmaz.
4. **Denetim ve Gizlilik (Audit Logging):**
   - IP adresleri ve Cihaz UUID değerleri tuzlu SHA-256 hash formatında saklanır.
   - Loglara açık token veya şifre yazılmaz.
5. **Öğretim Görevlisi Canlı Ekranı (SSE):**
   - Yoklaması onaylanan öğrenciler anlık Server-Sent Events akışıyla hocanın ekranında akar.

---

## 🚀 Kurulum ve Çalıştırma

### 1. Yerel Geliştirme Ortamı

```bash
# Depoyu klonlayın
git clone https://github.com/drFurkanGuven/qr.git
cd qr

# Ortam dosyasını hazırlayın
cp .env.example .env

# Docker Compose ile ayağa kaldırın
docker compose up -d --build

# Başlangıç test verilerini yükleyin
docker compose exec backend python -m app.seed
```

- **Frontend**: http://localhost:3000 (veya sunucuda port 8001)
- **Backend API Docs**: http://localhost:8000/docs
- **Sağlık Kontrolü**: http://localhost:8000/api/v1/health

---

## 🧪 Testleri Çalıştırma

```bash
cd backend
python3 -m pytest tests/ -v
```

Test Paketi Kapsamı:
- `test_cas_auth.py`: CAS bilet değişimi, tek kullanımlık bilet kontrolü (replay guard)
- `test_qr_engine.py`: HMAC-SHA256 imza geçerliliği, süresi dolmuş QR reddi (30s+), bozuk format kontrolü
- `test_attendance_flow.py`: Oturum açma, kayıtlı öğrenci onayı, kayıtsız öğrenci reddi, mükerrer katılım engeli
- `test_concurrency_race.py`: Aynı öğrencinin 20 paralel isteğinde tek kayıt garantisi, 50 bağımsız öğrencinin eşzamanlı katılımı
- `test_security_hygiene.py`: Audit loglarında token ve şifre maskeleme, salted hash doğrulaması
