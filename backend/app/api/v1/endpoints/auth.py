from __future__ import annotations

import logging
from datetime import timezone

import aiomysql
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import ValidationError

from app.core.config import get_settings
from app.core.database import QueryParameterError, RepositoryQueryError, get_db_conn
from app.core.security import (
    TokenError,
    build_access_token,
    build_refresh_token,
    decode_access_token,
    decode_refresh_token,
    fingerprint_token,
    now_utc,
    verify_password,
)
from app.models.auth_types import AccessTokenResponse, LoginRequest, MeResponse, RefreshSessionRecord, UserAuthRecord
from app.repositories.auth_repo import (
    fetch_user_by_id,
    fetch_user_by_username,
    get_refresh_session,
    insert_refresh_session,
    prune_expired_sessions,
    revoke_refresh_session,
    revoke_all_user_sessions,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _auth_unavailable(reason: str) -> HTTPException:
    logger.warning("auth.dependency.unavailable", extra={"reason": reason})
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="auth_unavailable")


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    settings = get_settings()
    max_age = settings.jwt_refresh_ttl_days * 24 * 60 * 60
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        max_age=max_age,
        httponly=settings.refresh_cookie_httponly,
        secure=settings.refresh_cookie_secure,
        samesite=settings.refresh_cookie_samesite,
        domain=settings.refresh_cookie_domain,
        path=settings.refresh_cookie_path,
    )


def _clear_refresh_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.refresh_cookie_name,
        domain=settings.refresh_cookie_domain,
        path=settings.refresh_cookie_path,
        secure=settings.refresh_cookie_secure,
        httponly=settings.refresh_cookie_httponly,
        samesite=settings.refresh_cookie_samesite,
    )


@router.post("/login", response_model=AccessTokenResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_conn),
) -> AccessTokenResponse:
    try:
        row = await fetch_user_by_username(conn, payload.username)
    except (RepositoryQueryError, QueryParameterError, aiomysql.Error, TimeoutError) as exc:
        raise _auth_unavailable("user_query_failed") from exc

    if row is None:
        logger.info("auth.login.failure", extra={"reason": "invalid_credentials"})
        raise _unauthorized("invalid_credentials")

    try:
        user = UserAuthRecord.model_validate(row)
    except ValidationError:
        logger.warning("auth.login.failure", extra={"reason": "malformed_user_row"})
        raise _unauthorized("invalid_credentials")

    if not user.is_active:
        logger.info("auth.login.failure", extra={"reason": "inactive_user", "user_id": user.id})
        raise _unauthorized("invalid_credentials")

    if not verify_password(payload.password, user.password_hash):
        logger.info("auth.login.failure", extra={"reason": "invalid_credentials"})
        raise _unauthorized("invalid_credentials")

    try:
        access_token, access_expires_at = build_access_token(
            user_id=user.id,
            role=user.role,
            username=user.username,
        )
        refresh_token, refresh_jti, refresh_expires_at = build_refresh_token(user_id=user.id)
    except Exception as exc:
        logger.exception("auth.login.failure", extra={"reason": "jwt_signing_error"})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="token_signing_error") from exc

    try:
        await prune_expired_sessions(conn)
        await insert_refresh_session(
            conn,
            token_jti=refresh_jti,
            user_id=user.id,
            expires_at=refresh_expires_at,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except (aiomysql.Error, TimeoutError) as exc:
        raise _auth_unavailable("refresh_store_write_failed") from exc

    _set_refresh_cookie(response, refresh_token)
    logger.info("auth.login.success", extra={"user_id": user.id, "refresh_jti": refresh_jti})

    return AccessTokenResponse(access_token=access_token, expires_at=access_expires_at)


@router.post("/refresh", response_model=AccessTokenResponse)
async def refresh(
    request: Request,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_conn),
) -> AccessTokenResponse:
    settings = get_settings()
    refresh_token = request.cookies.get(settings.refresh_cookie_name)
    if not refresh_token:
        logger.info("auth.refresh.denied", extra={"reason": "missing_cookie"})
        raise _unauthorized("missing_refresh_token")

    try:
        payload = decode_refresh_token(refresh_token)
    except TokenError as exc:
        logger.info(
            "auth.refresh.denied",
            extra={"reason": exc.detail, "token_fingerprint": fingerprint_token(refresh_token)},
        )
        raise exc

    token_jti = str(payload["jti"])
    user_id = int(payload["sub"])

    try:
        session_row = await get_refresh_session(conn, token_jti)
    except (aiomysql.Error, TimeoutError) as exc:
        raise _auth_unavailable("refresh_store_read_failed") from exc

    if session_row is None:
        logger.info("auth.refresh.denied", extra={"reason": "missing_session", "token_jti": token_jti})
        raise _unauthorized("revoked_refresh_token")

    try:
        session = RefreshSessionRecord.model_validate(session_row)
    except ValidationError:
        logger.warning("auth.refresh.denied", extra={"reason": "malformed_refresh_row", "token_jti": token_jti})
        raise _unauthorized("invalid_refresh_token")

    if session.user_id != user_id:
        logger.warning("auth.refresh.denied", extra={"reason": "subject_mismatch", "token_jti": token_jti})
        raise _unauthorized("invalid_refresh_token")

    now = now_utc()
    session_expires_at = session.expires_at
    if session_expires_at.tzinfo is None:
        session_expires_at = session_expires_at.replace(tzinfo=timezone.utc)

    if session.revoked_at is not None:
        logger.info("auth.refresh.denied", extra={"reason": "revoked", "token_jti": token_jti})
        raise _unauthorized("revoked_refresh_token")

    if session_expires_at <= now:
        logger.info("auth.refresh.denied", extra={"reason": "expired", "token_jti": token_jti})
        raise _unauthorized("expired_refresh_token")

    try:
        current_user_row = await fetch_user_by_id(conn, user_id)
    except (RepositoryQueryError, QueryParameterError, aiomysql.Error, TimeoutError) as exc:
        raise _auth_unavailable("user_query_failed") from exc

    if current_user_row is None:
        logger.info("auth.refresh.denied", extra={"reason": "user_not_found", "token_jti": token_jti})
        raise _unauthorized("invalid_refresh_token")

    try:
        current_user = UserAuthRecord.model_validate(current_user_row)
    except ValidationError:
        logger.warning("auth.refresh.denied", extra={"reason": "malformed_user_row", "token_jti": token_jti})
        raise _unauthorized("invalid_refresh_token")

    if not current_user.is_active:
        logger.info("auth.refresh.denied", extra={"reason": "inactive_user", "user_id": user_id})
        raise _unauthorized("invalid_refresh_token")

    try:
        access_token, access_expires_at = build_access_token(
            user_id=user_id,
            role=current_user.role,
            username=current_user.username,
        )
        rotated_refresh_token, rotated_jti, rotated_expires_at = build_refresh_token(user_id=user_id)
    except Exception as exc:
        logger.exception("auth.refresh.denied", extra={"reason": "jwt_signing_error"})
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="token_signing_error") from exc

    try:
        updated = await revoke_refresh_session(
            conn,
            token_jti=token_jti,
            reason="rotated",
            replaced_by_jti=rotated_jti,
        )
        if updated == 0:
            logger.info("auth.refresh.denied", extra={"reason": "already_rotated", "token_jti": token_jti})
            raise _unauthorized("revoked_refresh_token")

        await insert_refresh_session(
            conn,
            token_jti=rotated_jti,
            user_id=user_id,
            expires_at=rotated_expires_at,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    except HTTPException:
        raise
    except (RepositoryQueryError, QueryParameterError, aiomysql.Error, TimeoutError) as exc:
        raise _auth_unavailable("refresh_store_rotation_failed") from exc

    _set_refresh_cookie(response, rotated_refresh_token)
    logger.info("auth.refresh.success", extra={"user_id": user_id, "token_jti": token_jti, "rotated_jti": rotated_jti})

    return AccessTokenResponse(access_token=access_token, expires_at=access_expires_at)


@router.get("/me", response_model=MeResponse)
async def me(token: str | None = Depends(oauth2_scheme)) -> MeResponse:
    if not token:
        raise _unauthorized("missing_bearer_token")

    payload = decode_access_token(token)
    username = payload.get("username") or "authenticated-user"
    return MeResponse(user_id=int(payload["sub"]), username=username, role=str(payload.get("role", "user")))


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    conn: aiomysql.Connection = Depends(get_db_conn),
) -> dict[str, bool]:
    settings = get_settings()
    refresh_token = request.cookies.get(settings.refresh_cookie_name)

    if refresh_token:
        try:
            payload = decode_refresh_token(refresh_token)
            await revoke_refresh_session(conn, token_jti=str(payload["jti"]), reason="logout")
            logger.info("auth.logout.success", extra={"user_id": int(payload["sub"])})
        except TokenError:
            logger.info("auth.logout.success", extra={"reason": "invalid_cookie_ignored"})
        except (aiomysql.Error, TimeoutError) as exc:
            raise _auth_unavailable("refresh_store_logout_failed") from exc

    _clear_refresh_cookie(response)
    return {"ok": True}


@router.post("/logout-all")
async def logout_all(token: str | None = Depends(oauth2_scheme), conn: aiomysql.Connection = Depends(get_db_conn)) -> dict[str, int]:
    if not token:
        raise _unauthorized("missing_bearer_token")

    payload = decode_access_token(token)
    user_id = int(payload["sub"])

    try:
        revoked = await revoke_all_user_sessions(conn, user_id=user_id, reason="logout_all")
    except (RepositoryQueryError, QueryParameterError, aiomysql.Error, TimeoutError) as exc:
        raise _auth_unavailable("refresh_store_logout_all_failed") from exc

    logger.info("auth.logout_all.success", extra={"user_id": user_id, "revoked": revoked})
    return {"revoked": revoked}
