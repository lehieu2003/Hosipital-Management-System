from fastapi import APIRouter

router = APIRouter()


@router.get("/ping", tags=["meta"])
async def ping() -> dict[str, str]:
    return {"status": "ok"}
