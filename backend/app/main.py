from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.router import router as v1_router
from app.core.config import get_settings
from app.core.database import close_pool, init_pool, pool_ready

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()

    if settings.db_require_on_startup:
        try:
            await init_pool()
        except Exception as exc:
            logger.exception(
                "db_pool_startup_failed",
                extra={
                    "error": str(exc),
                    "db_host": settings.db_host,
                    "db_port": settings.db_port,
                },
            )
            raise
    else:
        logger.info("db_pool_startup_skipped", extra={"reason": "DB_REQUIRE_ON_STARTUP is false"})

    try:
        yield
    finally:
        await close_pool()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict[str, bool | str]:
        return {
            "status": "ok",
            "ready": pool_ready() or not settings.db_require_on_startup,
        }

    app.include_router(v1_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
