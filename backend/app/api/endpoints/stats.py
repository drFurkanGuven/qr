from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.execution import BatchRun, RequestLog
from app.models.template import RequestTemplate
from app.schemas.execution import DashboardStats

router = APIRouter()


@router.get("", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
):
    """Calculates overall metrics, success rate, and latency averages for dashboard cards."""
    # 1. Template counts
    tpl_count_res = await db.execute(select(func.count(RequestTemplate.id)))
    total_templates = tpl_count_res.scalar() or 0

    active_tpl_res = await db.execute(
        select(func.count(RequestTemplate.id)).where(RequestTemplate.is_active == True)  # noqa: E712
    )
    active_templates = active_tpl_res.scalar() or 0

    # 2. Batch Run count
    batch_count_res = await db.execute(select(func.count(BatchRun.id)))
    total_batch_runs = batch_count_res.scalar() or 0

    # 3. Request logs aggregates
    log_stats_res = await db.execute(
        select(
            func.count(RequestLog.id),
            func.sum(func.cast(RequestLog.is_success, func.INTEGER if db.bind.dialect.name == "sqlite" else None)),
            func.avg(RequestLog.response_time_ms),
        )
    )
    # Alternative robust aggregation across postgres
    total_req_res = await db.execute(select(func.count(RequestLog.id)))
    total_requests = total_req_res.scalar() or 0

    success_req_res = await db.execute(
        select(func.count(RequestLog.id)).where(RequestLog.is_success == True)  # noqa: E712
    )
    successful_requests = success_req_res.scalar() or 0
    failed_requests = total_requests - successful_requests

    avg_latency_res = await db.execute(select(func.avg(RequestLog.response_time_ms)))
    avg_latency = avg_latency_res.scalar() or 0.0

    success_rate = 0.0
    if total_requests > 0:
        success_rate = round((successful_requests / total_requests) * 100, 1)

    return DashboardStats(
        total_batch_runs=total_batch_runs,
        total_requests_executed=total_requests,
        successful_requests=successful_requests,
        failed_requests=failed_requests,
        overall_success_rate_pct=success_rate,
        average_latency_ms=round(avg_latency, 1),
        total_templates=total_templates,
        active_templates=active_templates,
    )
