from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_dummy_password,
    verify_password,
)


def test_hash_and_verify_roundtrip():
    password_hash = hash_password("secret123")

    assert password_hash != "secret123"
    assert verify_password("secret123", password_hash) is True
    assert verify_password("wrong", password_hash) is False


def test_verify_password_rejects_broken_hash():
    assert verify_password("secret123", "not-a-valid-hash") is False


def test_access_token_roundtrip():
    token = create_access_token(42)

    payload = decode_access_token(token)

    assert payload is not None
    assert payload["sub"] == "42"


def test_decoded_token_rejects_tampered_token():
    token = create_access_token(42)

    assert decode_access_token(token + "x") is None


def test_decoded_token_rejects_expired_token():
    expired = jwt.encode(
        {"sub": "42", "exp": datetime.now(UTC) - timedelta(seconds=1)},
        settings.secret_key,
        algorithm="HS256",
    )

    assert decode_access_token(expired) is None


def test_verify_dummy_password_never_raises():
    verify_dummy_password("anything")
