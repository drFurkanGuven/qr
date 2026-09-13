import asyncio
import json
import time
import uuid
from typing import Any, Dict, List, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.execution import BatchRun, RequestLog
from app.models.template import RequestTemplate
from app.schemas.batch import BatchExecutionResponse
from app.schemas.execution import RequestLogOut
from app.services.placeholder_engine import PlaceholderEngine

HOP_BY_HOP_HEADERS = {
    "content-length",
    "accept-encoding",
    "connection",
    "keep-alive",
    "priority",
    "transfer-encoding",
    "host",
    "proxy-connection",
}


def sanitize_request_headers(headers: Dict[str, Any]) -> Dict[str, str]:
    cleaned: Dict[str, str] = {}
    for key, value in (headers or {}).items():
        if value is None:
            continue
        name = str(key)
        if name.lower() in HOP_BY_HOP_HEADERS:
            continue
        text = str(value).strip()
        if not text:
            continue
        cleaned[name] = text
    return cleaned


class BatchExecutorService:
    """Handles execution of single and batch HTTP requests with logging and metric calculation."""

    @staticmethod
    async def execute_single_request(
        client: httpx.AsyncClient,
        template: RequestTemplate,
        input_value: str,
        custom_vars: Optional[Dict[str, str]] = None,
        batch_run_id: Optional[uuid.UUID] = None,
    ) -> RequestLog:
        """Resolves variables and executes a single HTTP request, capturing full telemetry."""
        # 1. Resolve placeholders
        url, headers, body, query_params = PlaceholderEngine.resolve_template(
            url=template.url,
            method=template.method,
            headers=template.headers or {},
            body=template.body,
            query_params=template.query_params or {},
            input_value=input_value,
            custom_vars=custom_vars,
        )
        headers = sanitize_request_headers(headers)

        # 2. Prepare request content
        content = None
        data = None
        json_payload = None

        if body and template.method.upper() in ["POST", "PUT", "PATCH", "DELETE"]:
            if template.body_type == "json":
                try:
                    json_payload = json.loads(body)
                except Exception:
                    # If not valid JSON, send as raw text
                    content = body.encode("utf-8")
            elif template.body_type == "x-www-form-urlencoded":
                try:
                    data = json.loads(body)
                except Exception:
                    content = body.encode("utf-8")
            else:
                content = body.encode("utf-8")

        start_time = time.perf_counter()
        status_code: Optional[int] = None
        resp_headers: Optional[Dict[str, Any]] = None
        resp_body: Optional[str] = None
        error_msg: Optional[str] = None
        is_success = False

        # 3. Perform request
        try:
            response = await client.request(
                method=template.method.upper(),
                url=url,
                headers=headers,
                params=query_params,
                content=content,
                data=data,
                json=json_payload,
                timeout=template.timeout_seconds,
            )
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            status_code = response.status_code
            resp_headers = dict(response.headers)
            resp_body = response.text
            is_success = 200 <= response.status_code < 400
        except httpx.TimeoutException:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            error_msg = f"Request timed out after {template.timeout_seconds} seconds"
        except httpx.ConnectError as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            error_msg = f"Connection failed: {str(e)}"
        except Exception as e:
            duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
            error_msg = f"Unexpected error: {str(e)}"

        # 4. Construct RequestLog model
        log_entry = RequestLog(
            id=uuid.uuid4(),
            batch_run_id=batch_run_id or uuid.uuid4(),
            template_id=template.id,
            template_name=template.name,
            request_url=url,
            request_method=template.method.upper(),
            request_headers=headers,
            request_body=body,
            response_status_code=status_code,
            response_headers=resp_headers,
            response_body=resp_body,
            response_time_ms=duration_ms,
            is_success=is_success,
            error_message=error_msg,
        )

        return log_entry

    @classmethod
    async def run_batch(
        cls,
        db: AsyncSession,
        templates: List[RequestTemplate],
        input_value: str,
        input_type: str = "qr_camera",
        execution_mode: str = "concurrent",
        custom_vars: Optional[Dict[str, str]] = None,
        delay_ms: int = 0,
    ) -> BatchExecutionResponse:
        """Executes multiple templates against an input value and commits the batch run to DB."""
        batch_run_id = uuid.uuid4()
        batch_start_time = time.perf_counter()

        # Create BatchRun record
        batch_run = BatchRun(
            id=batch_run_id,
            input_value=input_value,
            input_type=input_type,
            execution_mode=execution_mode,
            total_requests=len(templates),
            successful_requests=0,
            failed_requests=0,
            total_duration_ms=0.0,
            status="running",
        )
        db.add(batch_run)
        await db.flush()

        logs: List[RequestLog] = []

        # Configure HTTPX client limits
        limits = httpx.Limits(max_keepalive_connections=20, max_connections=50)
        async with httpx.AsyncClient(limits=limits, follow_redirects=True, verify=False) as client:
            if execution_mode == "sequential":
                # Sequential execution with optional delay
                for idx, tpl in enumerate(templates):
                    if idx > 0 and delay_ms > 0:
                        await asyncio.sleep(delay_ms / 1000.0)
                    log_entry = await cls.execute_single_request(
                        client=client,
                        template=tpl,
                        input_value=input_value,
                        custom_vars=custom_vars,
                        batch_run_id=batch_run_id,
                    )
                    logs.append(log_entry)
            else:
                # Concurrent execution with semaphore limit
                semaphore = asyncio.Semaphore(15)

                async def sem_task(tpl: RequestTemplate) -> RequestLog:
                    async with semaphore:
                        return await cls.execute_single_request(
                            client=client,
                            template=tpl,
                            input_value=input_value,
                            custom_vars=custom_vars,
                            batch_run_id=batch_run_id,
                        )

                tasks = [sem_task(tpl) for tpl in templates]
                logs = await asyncio.gather(*tasks)

        # Calculate metrics
        total_duration = round((time.perf_counter() - batch_start_time) * 1000, 2)
        success_count = sum(1 for log in logs if log.is_success)
        fail_count = len(logs) - success_count

        if fail_count == 0:
            status = "completed"
        elif success_count == 0:
            status = "failed"
        else:
            status = "partial_failure"

        # Update BatchRun
        batch_run.successful_requests = success_count
        batch_run.failed_requests = fail_count
        batch_run.total_duration_ms = total_duration
        batch_run.status = status

        # Add all logs to session
        for log in logs:
            db.add(log)

        await db.commit()
        await db.refresh(batch_run)

        return BatchExecutionResponse(
            batch_run_id=batch_run.id,
            input_value=batch_run.input_value,
            execution_mode=batch_run.execution_mode,
            total_requests=batch_run.total_requests,
            successful_requests=batch_run.successful_requests,
            failed_requests=batch_run.failed_requests,
            total_duration_ms=batch_run.total_duration_ms,
            status=batch_run.status,
            results=[RequestLogOut.model_validate(log) for log in logs],
        )
