from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import AuthenticatedPrincipal
from app.api.dependencies.rbac import require_roles

router = APIRouter(prefix="/probe", tags=["rbac-probe"])


@router.get("/admin")
async def admin_probe(
    principal: AuthenticatedPrincipal = Depends(require_roles("admin")),
) -> dict[str, str | int]:
    return {"scope": "admin", "role": principal.role, "user_id": principal.user_id}


@router.get("/reception")
async def reception_probe(
    principal: AuthenticatedPrincipal = Depends(require_roles("receptionist")),
) -> dict[str, str | int]:
    return {"scope": "reception", "role": principal.role, "user_id": principal.user_id}


@router.get("/doctor")
async def doctor_probe(
    principal: AuthenticatedPrincipal = Depends(require_roles("doctor")),
) -> dict[str, str | int]:
    return {"scope": "doctor", "role": principal.role, "user_id": principal.user_id}


@router.get("/deny-default")
async def deny_default_probe(
    principal: AuthenticatedPrincipal = Depends(require_roles()),
) -> dict[str, str | int]:
    return {"scope": "deny-default", "role": principal.role, "user_id": principal.user_id}
