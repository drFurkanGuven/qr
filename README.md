# 🚀 API Test ve Otomasyon Motoru (QR / Metin Girişli Toplu İstek İşleyici)

Genel amaçlı, modern web arayüzüne sahip, QR/Barkod tarayıcılı veya metin girdili, dinamik değişkenlerle zenginleştirilmiş HTTP istek şablonlarını dış API uç noktalarına tekil veya toplu (eşzamanlı / sıralı) olarak ileten ve tüm telemetriyi (durum kodu, yanıt süresi, yanıt gövdesi vb.) loglayan tam kapsamlı otomasyon platformu.

---

## 🛠 Teknoloji Yığını (Tech Stack)

- **Backend**: FastAPI (Python 3.11+), SQLAlchemy 2.0 (Async), AsyncPG, HTTPX (Asenkron HTTP İstemcisi), Pydantic v2
- **Frontend**: Next.js 14 (React 18), TypeScript, Tailwind CSS, Lucide React, `html5-qrcode` (Kamera ile QR/Barkod Okuyucu)
- **Veritabanı**: PostgreSQL 16
- **Konteyner & Dağıtım**: Docker, Docker Compose (Multi-arch: Apple Silicon ARM64 & Fedora Linux AMD64/x86_64 uyumlu)

---

## 🏗 Proje Mimarisi

```
├── backend/                  # FastAPI Asenkron REST API
│   ├── app/
│   │   ├── api/              # API rotaları (Templates, Batch, Executions, Stats)
│   │   ├── core/             # Ayarlar ve Veritabanı bağlantısı (Async SQLAlchemy)
│   │   ├── models/           # PostgreSQL ORM modelleri
│   │   ├── schemas/          # Pydantic v2 veri şemaları
│   │   ├── services/         # Dinamik Değişken Motoru & HTTPX Toplu İstek Motoru
│   │   └── main.py           # FastAPI başlangıç ve CORS
│   ├── tests/                # Birim testleri
│   ├── Dockerfile            # Python slim multi-arch imajı
│   └── requirements.txt
├── frontend/                 # Next.js 14 Modern Web Arayüzü
│   ├── src/
│   │   ├── app/              # App Router sayfaları (Dashboard, Templates, Runner, History)
│   │   ├── components/       # Kamera QR Tarayıcı, Şablon Formu, Log Denetleyici (Inspector)
│   │   └── lib/              # API istemcisi ve TypeScript modelleri
│   ├── Dockerfile            # Multi-stage standalone optimize imaj (~120MB)
│   └── package.json
├── docker-compose.yml        # PostgreSQL + Backend + Frontend orkestrasyonu
├── .env.example              # Ortam değişkenleri şablonu
├── deploy.sh                 # Fedora / Linux sunucu tek komut dağıtım betiği
└── README.md
```

---

## ⚡ Temel Özellikler

0. **Yönetici (Admin) Korumalı Profil Yönetimi**:
   - Profiller (istek şablonları) yalnızca yönetici ekleyebilir, düzenleyebilir, silebilir ve klonlayabilir.
   - `ADMIN_PASSWORD` ortam değişkeni ile tek yönetici şifresi (varsayılan: `admin123` — değiştirmeyi unutmayın).
   - Normal ziyaretçi; site açılışında `Toplu Çalıştırıcı` sayfasına yönlenir ve yöneticinin eklediği profillere anında istek gönderebilir.
   - **Profil Klonlama**: Her karttaki "Kopyala" butonu, kaynak profilin Authorization token, X-Device-Uuid, User-Agent gibi tüm alanları dolu **yeni profil formunu** açar. Yönetici bu değerleri değiştirip "Kaydet" deyince yeni profil kayıt altına alınır.

1. **Şablon Yönetimi (Template Management)**:
   - Farklı HTTP istek şablonları (POST, GET, PUT, PATCH, DELETE), özel header'lar, URL query parametreleri ve gövde (body) tanımlama.
   - Şablonları gruplama (örn: `bilet_kontrol`, `odeme_sorgu`, `stok_giris`) ve sıralama (`order_index`).
   - Tekil test aracı ile şablonu form üzerinden kaydedip doğrudan test edebilme.

2. **Dinamik Değişken (Placeholder) Motoru**:
   - `{{qr_data}}` veya `{{input}}`: Taranan QR kodu veya girilen metin.
   - `{{timestamp}}`: Unix epoch saniyesi.
   - `{{iso_timestamp}}`: ISO 8601 UTC formatı (`2026-09-13T09:30:00Z`).
   - `{{uuid}}`: Benzersiz UUIDv4 dizesi.
   - `{{random_int:100:999}}`: Belirlenen aralıkta rastgele tam sayı.
   - İsteğe bağlı özel anahtar-değer parametreleri.

3. **QR Kamera & Metin Giriş Mekanizması**:
   - Web kamerası veya cep telefonu kamerası ile anında QR/barkod okuma (`html5-qrcode`).
   - Hızlı manuel metin girişi ve canlı değişken çözümleme önizlemesi.

4. **Toplu İstek Motoru (Batch Request Engine)**:
   - **Eşzamanlı (Concurrent) Mod**: HTTPX havuzu ile tüm API isteklerini paralel olarak gönderir.
   - **Sıralı (Sequential) Mod**: İstekleri şablon sırasına göre ve istenirse araya milisaniyelik gecikme (delay) ekleyerek sırayla iletir.
   - Milisaniyelik hassasiyette yanıt süresi (latency) ölçümü.
   - Tüm istek ve yanıt gövdelerinin PostgreSQL'e loglanması.

5. **Ayrıntılı Log ve Yanıt İnceleyici (Response Inspector)**:
   - Giden HTTP metodunu, URL'yi, çözülmüş header'ları ve gövdeyi,
   - Dönen HTTP durum kodunu (200, 400, 500 vb.), yanıt başlıklarını, JSON biçimlendirilmiş yanıt gövdesini ve olası ağ hatalarını tek tıkla kopyalama ve inceleme desteği.

---

## 💻 1. Mac'te Yerel Geliştirme (Local Development)

### Docker ile Çalıştırma:
```bash
# 1. Ortam dosyasını oluşturun
cp .env.example .env

# 2. Docker Compose ile servisleri başlatın
docker compose up -d --build

# 3. Tarayıcınızda açın:
# Frontend: http://localhost:3000
# Backend Swagger Docs: http://localhost:8000/docs
```

### Docker Olmadan Çalıştırma:
#### Backend:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### Frontend:
```bash
cd frontend
npm install
npm run dev
```

---

## 🐙 2. GitHub'a Gönderme (Push Workflow)

Projeyi Mac ortamınızda GitHub reponuza yüklemek için:

```bash
# 1. Git durumunu kontrol edin
git status

# 2. Değişiklikleri ekleyin ve commitleyin
git add .
git commit -m "feat: initial release of API Test & Automation platform"

# 3. GitHub reponuzu bağlayın (kendi repo linkinizi yazın)
git remote add origin https://github.com/KULLANICI_ADI/REPO_ADI.git

# 4. Ana dala push edin
git branch -M main
git push -u origin main
```

*(Not: `.gitignore` ve `.dockerignore` dosyaları `node_modules`, `.next`, `__pycache__`, `.env` ve sanal ortam dosyalarını GitHub'a göndermeyecek şekilde eksiksiz yapılandırılmıştır.)*

---

## 🐧 3. Fedora Server'a Kurulum ve Dağıtım (Production)

Fedora Server üzerinde projeyi tek seferde ayağa kaldırmak için aşağıdaki adımları izleyin:

### Adım 1: Fedora Server'da Docker ve Git Kurulumu
Fedora sunucunuzda terminali açın:

```bash
# Paketleri güncelleyin
sudo dnf update -y

# Git, Docker ve Docker Compose eklentisini kurun
sudo dnf install -y git docker moby-engine docker-compose-plugin

# Docker servisini başlatın ve açılışta çalışması için etkinleştirin
sudo systemctl enable --now docker

# Mevcut kullanıcınızı docker grubuna ekleyin (oturum açıp kapatmanız gerekebilir)
sudo usermod -aG docker $USER
```

### Adım 2: Nginx ve Fedora Güvenlik Ayarları (Port 8001 & SELinux)

Sunucunuzda Nginx `qr.$DOMAIN` alt alan adını `http://127.0.0.1:8001` portuna yönlendirmektedir:

```nginx
server {
    listen 80;
    server_name qr.$DOMAIN;
    access_log /var/www/$DOMAIN/qr/logs/access.log;
    error_log /var/www/$DOMAIN/qr/logs/error.log;

    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!IMPORTANT]
> **Fedora SELinux Ayarı**: Fedora Server'da Nginx'in yerel portlara (8001) proxy isteği atabilmesi için aşağıdaki SELinux iznini vermeniz gerekir:
> ```bash
> sudo setsebool -P httpd_can_network_connect 1
> ```

> [!NOTE]
> **Port Çakışması Yoktur**: Bu projede yalnızca port `8001` (ve sadece yerel `127.0.0.1` arayüzüne) bağlanır. PostgreSQL ve FastAPI backend'i konteyner içi izole ağda çalışır; host üzerindeki `cv` veya `farmacograph` (port 8002) gibi diğer projelerinizle **asla çakışmaz**.
> Frontend (`Next.js`), arka plandaki `/api/v1` ve `/docs` isteklerini otomatik olarak FastAPI'ye ilettiği için Nginx'te ikinci bir backend portu açmanıza gerek kalmaz.

### Adım 3: Projeyi GitHub'dan Çekme
```bash
cd /opt # veya dilediğiniz bir dizin: ~/apps
git clone https://github.com/KULLANICI_ADI/REPO_ADI.git qr-automation
cd qr-automation
```

### Adım 4: Ortam Değişkenlerini Ayarlama
```bash
cp .env.example .env
nano .env
```
`.env` dosyasındaki ayarları sunucunuza göre düzenleyin:
- `POSTGRES_PASSWORD`: Güçlü ve güvenli bir şifre belirleyin.
- `ADMIN_PASSWORD`: Yönetici (profil yönetimi) parolasını **mutlaka** `admin123` dışında bir değerle değiştirin.
- `NEXT_PUBLIC_API_URL`: Sunucunuzun IP adresi veya alan adı (Örn: `http://192.168.1.100:8000/api/v1` veya `https://api.alanadiniz.com/api/v1`).

### Adım 5: Servisleri Başlatma
Hazırladığımız `deploy.sh` betiği ile tek komutta başlatabilirsiniz:
```bash
./deploy.sh
```
Veya doğrudan Docker Compose ile:
```bash
docker compose up -d --build
```

### Adım 6: Doğrulama
- **Web Arayüzü**: `http://<FEDORA-SUNUCU-IP>:3000`
- **FastAPI OpenAPI Belgeleri**: `http://<FEDORA-SUNUCU-IP>:8000/docs`
- **Konteyner Durumu**: `docker compose ps`
- **Canlı Loglar**: `docker compose logs -f`

---

## 🔄 Fedora Server'da Güncelleme Almak
Kodlarınızda Mac üzerinde değişiklik yapıp GitHub'a push ettikten sonra, Fedora sunucunuzda sadece şu komutu çalıştırmanız yeterlidir:

```bash
cd /opt/qr-automation
./deploy.sh
```
Bu betik `git pull` yapacak, değişen servisleri derleyecek ve kesintisiz şekilde konteynerleri güncelleyecektir.
