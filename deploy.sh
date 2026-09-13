#!/bin/bash
set -e

echo "=========================================================="
echo "🚀 API Test & Otomasyon Servisi - Güncelleme ve Dağıtım"
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
    git pull origin main || git pull origin master || echo "Git pull atlandı (lokal değişiklikler olabilir)"
fi

# 3. Docker Compose ile inşa et ve ayağa kaldır
echo "🐳 Docker konteynerleri derleniyor ve başlatılıyor..."
if command -v docker-compose &> /dev/null; then
    docker-compose down
    docker-compose up -d --build
elif docker compose version &> /dev/null; then
    docker compose down
    docker compose up -d --build
else
    echo "❌ Hata: 'docker compose' veya 'docker-compose' bulunamadı!"
    exit 1
fi

echo "✅ Dağıtım tamamlandı!"
echo "🌐 Frontend: http://<sunucu-ip>:3000"
echo "🔌 Backend API: http://<sunucu-ip>:8000/docs"
