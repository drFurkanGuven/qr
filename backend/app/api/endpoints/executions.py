import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_db
from app.models.execution import BatchRun, RequestLog
from app.schemas.execution import BatchRunDetailOut, BatchRunOut, RequestLogOut

router = APIRouter()


@router.get("", response_model=List[BatchRunOut])
async def list_executions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    """List historical batch execution runs, ordered by newest first."""
    query = select(BatchRun).order_by(BatchRun.created_at.desc()).offset(offset).limit(limit)
    if status_filter:
        query = query.where(BatchRun.status == status_filter)

    result = await db.execute(query)
    runs = result.scalars().all()
    return runs


@router.get("/{batch_run_id}", response_model=BatchRunDetailOut)
async def get_execution_detail(
    batch_run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Retrieve details and all individual request logs for a batch run."""
    query = (
        select(BatchRun)
        .options(selectinload(BatchRun.logs))
        .where(BatchRun.id == batch_run_id)
    )
    result = await db.execute(query)
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch run with ID {batch_run_id} not found",
        )
    return run


@router.delete("/{batch_run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_execution(
    batch_run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a batch run and its associated request logs."""
    result = await db.execute(select(BatchRun).where(BatchRun.id == batch_run_id))
    run = result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Batch run with ID {batch_run_id} not found",
        )

    await db.delete(run)
    await db.commit()
    return None
