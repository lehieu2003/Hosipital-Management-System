from fastapi import APIRouter

from app.api.v1.endpoints.admin_probe import router as admin_probe_router
from app.api.v1.endpoints.auth import router as auth_router

router = APIRouter()


@router.get("/ping", tags=["meta"])
async def ping() -> dict[str, str]:
    return {"status": "ok"}


router.include_router(auth_router)
router.include_router(admin_probe_router)
