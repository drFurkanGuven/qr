from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import api_router
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Veritabanı tablolarını başlat
    try:
        await init_db()
        print("Veritabanı tabloları başarıyla doğrulandı/oluşturuldu.")
    except Exception as e:
        print(f"Veritabanı başlatma hatası: {e}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Fırat Üniversitesi CAS uyumlu Yetkili Yoklama Sistemi API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS Yapılandırması: credentials (çerez) taşınabilmesi için origin regex veya liste
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8001",
        "http://127.0.0.1:8001",
        "https://qr.firat.edu.tr",
        "https://yoklama.firat.edu.tr",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "version": "2.0.0",
    }


# Standart sürüm yolu: /api/v1/...
app.include_router(api_router, prefix="/api/v1")

# Resmi Fırat API yolları ile tam uyumluluk: /api/...
app.include_router(api_router, prefix="/api")
