import pytest
from httpx import AsyncClient
from app.services.cas_service import cas_service


@pytest.mark.asyncio
async def test_cas_callback_valid_ticket(client: AsyncClient):
    ticket = "ST-TEST-STUDENT-210101099"
    resp = await client.get(f"/api/v1/auth/cas/callback?ticket={ticket}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert data["user"]["university_student_id"] == "210101099"
    assert data["user"]["role"] == "student"
    # Verify httpOnly cookie was set
    assert "session_token" in resp.cookies


@pytest.mark.asyncio
async def test_cas_replay_ticket_rejected(client: AsyncClient):
    ticket = "ST-TEST-REPLAY-999"
    resp1 = await client.get(f"/api/v1/auth/cas/callback?ticket={ticket}")
    assert resp1.status_code == 200

    # Same ticket second time must be rejected
    resp2 = await client.get(f"/api/v1/auth/cas/callback?ticket={ticket}")
    assert resp2.status_code == 401
    assert "TICKET_ALREADY_USED" in resp2.json()["detail"]


@pytest.mark.asyncio
async def test_direct_cas_token_exchange(client: AsyncClient):
    payload = {
        "ticket": "ST-TEST-INSTRUCTOR-5001",
        "service": "https://qr.firat.edu.tr",
        "device_uuid": "test-device-uuid-1234",
    }
    resp = await client.post("/api/v1/auth/cas/token", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "access_token" in data
    assert data["user"]["role"] == "instructor"
