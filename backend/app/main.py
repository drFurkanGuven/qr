from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    try:
        await init_db()
        print("Database tables verified/initialized successfully.")
    except Exception as e:
        print(f"Database initialization error (may be expected during first container boot): {e}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="General purpose API Test & Automation Engine with dynamic placeholders and batch processing",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Configuration
origins = settings.BACKEND_CORS_ORIGINS
if "*" in origins:
    allow_origins = ["*"]
else:
    allow_origins = origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
    }


# Include v1 API router
app.include_router(api_router, prefix=settings.API_V1_STR)
