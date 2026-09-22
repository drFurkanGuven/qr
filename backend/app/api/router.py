from fastapi import APIRouter
from app.api.endpoints import auth, attendance, courses, device, user

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(attendance.router)
api_router.include_router(courses.router)
api_router.include_router(device.router)
api_router.include_router(user.router)
