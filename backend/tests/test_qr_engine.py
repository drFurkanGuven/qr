import time
import pytest
from app.services.qr_engine import (
    generate_session_secret,
    generate_qr_payload,
    verify_qr_payload,
)


def test_qr_valid_signature():
    secret = generate_session_secret()
    payload = generate_qr_payload("ses_123", secret, ttl_seconds=30)
    token = payload["qr_token"]

    is_valid, session_id, err = verify_qr_payload(token, secret, tolerance_seconds=10)
    assert is_valid is True
    assert session_id == "ses_123"
    assert err is None


def test_qr_expired_rejected():
    secret = generate_session_secret()
    # Expired token (ttl = -20s)
    payload = generate_qr_payload("ses_123", secret, ttl_seconds=-20)
    token = payload["qr_token"]

    is_valid, session_id, err = verify_qr_payload(token, secret, tolerance_seconds=5)
    assert is_valid is False
    assert err == "QR_EXPIRED"


def test_qr_tampered_signature_rejected():
    secret = generate_session_secret()
    wrong_secret = generate_session_secret()
    payload = generate_qr_payload("ses_123", secret, ttl_seconds=30)
    token = payload["qr_token"]

    is_valid, session_id, err = verify_qr_payload(token, wrong_secret)
    assert is_valid is False
    assert err == "QR_SIGNATURE_MISMATCH"


def test_qr_malformed_rejected():
    is_valid, session_id, err = verify_qr_payload("not-a-valid-token", "some-secret")
    assert is_valid is False
    assert err == "QR_INVALID_FORMAT"
