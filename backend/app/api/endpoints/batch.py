from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.template import RequestTemplate
from app.schemas.batch import BatchExecutionRequest, BatchExecutionResponse
from app.services.batch_executor import BatchExecutorService

router = APIRouter()


@router.post("/run", response_model=BatchExecutionResponse)
async def run_batch_requests(
    batch_req: BatchExecutionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute batch requests against external API endpoints using stored templates."""
    # 1. Fetch matching templates
    if batch_req.template_ids and len(batch_req.template_ids) > 0:
        query = (
            select(RequestTemplate)
            .where(RequestTemplate.id.in_(batch_req.template_ids))
            .order_by(RequestTemplate.order_index, RequestTemplate.created_at)
        )
    else:
        # Default: all active templates
        query = (
            select(RequestTemplate)
            .where(RequestTemplate.is_active == True)  # noqa: E712
            .order_by(RequestTemplate.order_index, RequestTemplate.created_at)
        )

    result = await db.execute(query)
    templates = list(result.scalars().all())

    if not templates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No matching active templates found to execute.",
        )

    # 2. Run batch execution
    batch_response = await BatchExecutorService.run_batch(
        db=db,
        templates=templates,
        input_value=batch_req.input_value,
        input_type=batch_req.input_type,
        execution_mode=batch_req.execution_mode,
        custom_vars=batch_req.custom_variables,
        delay_ms=batch_req.delay_ms_between_requests,
    )

    return batch_response
