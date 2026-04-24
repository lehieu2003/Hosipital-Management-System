from __future__ import annotations

import logging
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status

from app.api.dependencies.auth import AuthenticatedPrincipal, get_current_principal

logger = logging.getLogger(__name__)


_ALLOWED_ROLES = {"admin", "receptionist", "doctor"}


def require_roles(*roles: str) -> Callable[..., AuthenticatedPrincipal]:
    allowed_roles = tuple(role.strip().lower() for role in roles if role and role.strip())

    async def dependency(
        request: Request,
        principal: AuthenticatedPrincipal = Depends(get_current_principal),
    ) -> AuthenticatedPrincipal:
        endpoint = request.url.path

        if not allowed_roles:
            logger.info(
                "rbac.deny",
                extra={
                    "reason": "policy_missing",
                    "endpoint": endpoint,
                    "user_id": principal.user_id,
                    "role": principal.role,
                },
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

        normalized = set(allowed_roles)
        if not normalized.issubset(_ALLOWED_ROLES):
            logger.warning(
                "rbac.deny",
                extra={
                    "reason": "invalid_policy_role",
                    "endpoint": endpoint,
                    "policy_roles": sorted(normalized),
                },
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

        if principal.role not in normalized:
            logger.info(
                "rbac.deny",
                extra={
                    "reason": "role_forbidden",
                    "endpoint": endpoint,
                    "user_id": principal.user_id,
                    "role": principal.role,
                    "allowed_roles": sorted(normalized),
                },
            )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden")

        logger.info(
            "rbac.allow",
            extra={
                "endpoint": endpoint,
                "user_id": principal.user_id,
                "role": principal.role,
                "allowed_roles": sorted(normalized),
            },
        )
        return principal

    return dependency
