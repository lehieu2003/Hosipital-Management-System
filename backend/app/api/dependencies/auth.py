from __future__ import annotations

import logging
from dataclasses import dataclass

import aiomysql
from fastapi import Depends, HTTPException, Request, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import ValidationError

from app.core.database import QueryParameterError, RepositoryQueryError, get_db_conn
from app.core.security import TokenError, decode_access_token
from app.models.auth_types import UserAuthRecord
from app.repositories.auth_repo import fetch_user_by_id

logger = logging.getLogger(__name__)

bearer_auth = HTTPBearer(
    auto_error=False,
    scheme_name="BearerAuth",
    description="JWT Bearer access token",
)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    user_id: int
    username: str
    role: str


_ALLOWED_ROLES = {"admin", "receptionist", "doctor"}


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _service_unavailable(detail: str = "auth_unavailable") -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


async def get_current_principal(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Security(bearer_auth),
    conn: aiomysql.Connection = Depends(get_db_conn),
) -> AuthenticatedPrincipal:
    endpoint = request.url.path

    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        logger.info("rbac.deny", extra={"reason": "missing_token", "endpoint": endpoint})
        raise _unauthorized("missing_bearer_token")

    try:
        payload = decode_access_token(credentials.credentials)
    except TokenError as exc:
        logger.info(
            "rbac.deny",
            extra={
                "reason": "invalid_token",
                "endpoint": endpoint,
                "token_error": exc.detail,
            },
        )
        raise exc

    subject = payload.get("sub")
    if subject is None:
        logger.info("rbac.deny", extra={"reason": "malformed_claims", "endpoint": endpoint})
        raise _unauthorized("invalid_access_token")

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        logger.info("rbac.deny", extra={"reason": "malformed_claims", "endpoint": endpoint})
        raise _unauthorized("invalid_access_token")

    try:
        row = await fetch_user_by_id(conn, user_id)
    except (RepositoryQueryError, QueryParameterError, aiomysql.Error, TimeoutError):
        logger.warning("rbac.deny", extra={"reason": "principal_lookup_failed", "endpoint": endpoint})
        raise _service_unavailable()

    if row is None:
        logger.info("rbac.deny", extra={"reason": "user_not_found", "endpoint": endpoint, "user_id": user_id})
        raise _unauthorized("invalid_access_token")

    try:
        user = UserAuthRecord.model_validate(row)
    except ValidationError:
        logger.warning("rbac.deny", extra={"reason": "malformed_user_row", "endpoint": endpoint, "user_id": user_id})
        raise _unauthorized("invalid_access_token")

    if not user.is_active:
        logger.info("rbac.deny", extra={"reason": "inactive_user", "endpoint": endpoint, "user_id": user_id})
        raise _unauthorized("invalid_access_token")

    if user.role not in _ALLOWED_ROLES:
        logger.info(
            "rbac.deny",
            extra={
                "reason": "unknown_role",
                "endpoint": endpoint,
                "user_id": user.id,
                "role": user.role,
            },
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

    return AuthenticatedPrincipal(user_id=user.id, username=user.username, role=user.role)
