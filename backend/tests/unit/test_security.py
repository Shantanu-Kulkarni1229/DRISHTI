import pytest
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)


def test_password_hashing_and_verification():
    plain = "SuperSecret_Drishti!2026"
    hashed = get_password_hash(plain)
    assert hashed != plain
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


def test_jwt_access_and_refresh_tokens():
    subject = "user-12345"
    claims = {"org_id": "org-99", "role": "analyst"}

    access_token = create_access_token(subject=subject, claims=claims)
    refresh_token = create_refresh_token(subject=subject, claims=claims)

    decoded_access = decode_token(access_token)
    assert decoded_access["sub"] == subject
    assert decoded_access["type"] == "access"
    assert decoded_access["org_id"] == "org-99"

    decoded_refresh = decode_token(refresh_token)
    assert decoded_refresh["sub"] == subject
    assert decoded_refresh["type"] == "refresh"


def test_tampered_token_fails_decoding():
    token = create_access_token(subject="user-1")
    tampered = token[:-4] + "fake"
    with pytest.raises(ValueError):
        decode_token(tampered)
