from fastapi import APIRouter
from app.api.endpoints import batch, executions, stats, templates

api_router = APIRouter()

api_router.include_router(templates.router, prefix="/templates", tags=["Templates"])
api_router.include_router(batch.router, prefix="/batch", tags=["Batch Engine"])
api_router.include_router(executions.router, prefix="/executions", tags=["Executions & Logs"])
api_router.include_router(stats.router, prefix="/stats", tags=["Dashboard Stats"])
