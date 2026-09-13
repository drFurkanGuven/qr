import uuid
from typing import List, Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db
from app.models.template import RequestTemplate
from app.schemas.execution import RequestLogOut
from app.schemas.template import (
    TemplateCreate,
    TemplateOut,
    TemplatePreviewRequest,
    TemplatePreviewResponse,
    TemplateTestRequest,
    TemplateUpdate,
)
from app.services.batch_executor import BatchExecutorService
from app.services.placeholder_engine import PlaceholderEngine

router = APIRouter()


@router.get("", response_model=List[TemplateOut])
async def list_templates(
    group: Optional[str] = Query(None, description="Filter by group name"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve all request templates, ordered by order_index and created_at."""
    query = select(RequestTemplate).order_by(RequestTemplate.order_index, RequestTemplate.created_at.desc())
    if group:
        query = query.where(RequestTemplate.group_name == group)
    if is_active is not None:
        query = query.where(RequestTemplate.is_active == is_active)

    result = await db.execute(query)
    templates = result.scalars().all()
    return templates


@router.post("", response_model=TemplateOut, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_in: TemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new request template."""
    template = RequestTemplate(
        name=template_in.name,
        description=template_in.description,
        method=template_in.method.upper(),
        url=template_in.url,
        headers=template_in.headers,
        body_type=template_in.body_type,
        body=template_in.body,
        query_params=template_in.query_params,
        timeout_seconds=template_in.timeout_seconds,
        is_active=template_in.is_active,
        group_name=template_in.group_name,
        order_index=template_in.order_index,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateOut)
async def get_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific template by ID."""
    result = await db.execute(select(RequestTemplate).where(RequestTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found",
        )
    return template


@router.put("/{template_id}", response_model=TemplateOut)
async def update_template(
    template_id: uuid.UUID,
    template_in: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing template."""
    result = await db.execute(select(RequestTemplate).where(RequestTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found",
        )

    update_data = template_in.model_dump(exclude_unset=True)
    if "method" in update_data and update_data["method"]:
        update_data["method"] = update_data["method"].upper()

    for field, value in update_data.items():
        setattr(template, field, value)

    await db.commit()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Delete a template."""
    result = await db.execute(select(RequestTemplate).where(RequestTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found",
        )
    await db.delete(template)
    await db.commit()
    return None


@router.post("/preview", response_model=TemplatePreviewResponse)
async def preview_template(
    preview_req: TemplatePreviewRequest,
):
    """Preview how variables are substituted into a template before firing."""
    if not preview_req.template:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template definition is required for preview",
        )

    tpl = preview_req.template
    resolved_url, resolved_headers, resolved_body, resolved_params = (
        PlaceholderEngine.resolve_template(
            url=tpl.url,
            method=tpl.method,
            headers=tpl.headers,
            body=tpl.body,
            query_params=tpl.query_params,
            input_value=preview_req.input_value,
            custom_vars=preview_req.custom_variables,
        )
    )

    return TemplatePreviewResponse(
        url=resolved_url,
        method=tpl.method.upper(),
        headers=resolved_headers,
        body=resolved_body,
        query_params=resolved_params,
    )


@router.post("/{template_id}/test", response_model=RequestLogOut)
async def test_single_template(
    template_id: uuid.UUID,
    test_req: TemplateTestRequest,
    db: AsyncSession = Depends(get_db),
):
    """Execute a single test request using the template and the given input value."""
    result = await db.execute(select(RequestTemplate).where(RequestTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Template with ID {template_id} not found",
        )

    async with httpx.AsyncClient(follow_redirects=True, verify=False) as client:
        log = await BatchExecutorService.execute_single_request(
            client=client,
            template=template,
            input_value=test_req.input_value,
            custom_vars=test_req.custom_variables,
        )

    return RequestLogOut.model_validate(log)
