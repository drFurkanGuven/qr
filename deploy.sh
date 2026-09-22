#!/bin/bash
set -e

echo "=========================================================="
echo "🎓 Fırat Üniversitesi Yetkili Yoklama Sistemi - Dağıtım"
echo "=========================================================="

# 1. Ortam dosyası kontrolü
if [ ! -f .env ]; then
    echo "⚠️  .env dosyası bulunamadı. .env.example dosyasından kopyalanıyor..."
    cp .env.example .env
    echo "Lütfen .env dosyasını sunucu IP veya domain bilginize göre düzenleyin!"
fi

# 2. Git güncellemelerini çek (eğer git reposu ise)
if [ -d .git ]; then
    echo "📥 En güncel kodlar Git reposundan çekiliyor..."
    git pull origin main || echo "Git pull atlandı"
fi

# 3. Docker Compose ile inşa et ve ayağa kaldır
echo "🐳 Docker konteynerleri derleniyor ve başlatılıyor..."
if command -v docker-compose &> /dev/null; then
    COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    COMPOSE="docker compose"
else
    echo "❌ Hata: 'docker compose' veya 'docker-compose' bulunamadı!"
    exit 1
fi

$COMPOSE down
$COMPOSE up -d --build

# 4. Veritabanı tablolarının oluşması için kısa bekleme ve seed çalıştırma
echo "⏳ Veritabanı hazır bekleniyor ve test verileri yükleniyor..."
sleep 5
$COMPOSE exec -T backend python -m app.seed || echo "Seed atlandı veya zaten yüklü."

echo "=========================================================="
echo "✅ Dağıtım tamamlandı!"
echo "🌐 Web Portalı: http://<sunucu-ip>:8001 (veya 3000)"
echo "🔌 Backend API Dokümantasyonu: http://<sunucu-ip>:8000/docs"
echo "=========================================================="
