from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import sha256
from uuid import uuid4

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext

from app.core.config import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class TokenError(HTTPException):
    def __init__(self, detail: str = "invalid_token") -> None:
        super().__init__(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def now_utc() -> datetime:
    return datetime.now(tz=timezone.utc)


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return _pwd_context.verify(password, password_hash)


def _encode(payload: dict, *, secret: str) -> str:
    settings = get_settings()
    return jwt.encode(payload, secret, algorithm=settings.jwt_algorithm)


def _decode(token: str, *, secret: str, audience: str | None = None) -> dict:
    settings = get_settings()
    options = {"require": ["exp", "iat", "sub", "type", "jti"]}
    return jwt.decode(
        token,
        secret,
        algorithms=[settings.jwt_algorithm],
        issuer=settings.jwt_issuer,
        audience=audience,
        options=options,
    )


def build_access_token(*, user_id: int, role: str, username: str | None = None) -> tuple[str, datetime]:
    settings = get_settings()
    issued_at = now_utc()
    expires_at = issued_at + timedelta(minutes=settings.jwt_access_ttl_minutes)
    payload = {
        "sub": str(user_id),
        "role": role,
        "username": username,
        "type": "access",
        "jti": str(uuid4()),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_access_audience,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return _encode(payload, secret=settings.jwt_access_secret), expires_at


def build_refresh_token(*, user_id: int, jti: str | None = None) -> tuple[str, str, datetime]:
    settings = get_settings()
    issued_at = now_utc()
    expires_at = issued_at + timedelta(days=settings.jwt_refresh_ttl_days)
    token_jti = jti or str(uuid4())
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": token_jti,
        "iss": settings.jwt_issuer,
        "iat": int(issued_at.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    return _encode(payload, secret=settings.jwt_refresh_secret), token_jti, expires_at


def decode_access_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = _decode(token, secret=settings.jwt_access_secret, audience=settings.jwt_access_audience)
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("expired_access_token") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("invalid_access_token") from exc

    if payload.get("type") != "access":
        raise TokenError("invalid_access_token")

    return payload


def decode_refresh_token(token: str) -> dict:
    settings = get_settings()
    try:
        payload = _decode(token, secret=settings.jwt_refresh_secret)
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("expired_refresh_token") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("invalid_refresh_token") from exc

    if payload.get("type") != "refresh":
        raise TokenError("invalid_refresh_token")

    return payload


def fingerprint_token(value: str) -> str:
    return sha256(value.encode("utf-8")).hexdigest()[:12]
