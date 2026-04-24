from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(scope="session", autouse=True)
def _test_env() -> None:
    os.environ.setdefault("JWT_ACCESS_SECRET", "test-access-secret")
    os.environ.setdefault("JWT_REFRESH_SECRET", "test-refresh-secret")
    os.environ.setdefault("DB_HOST", "127.0.0.1")
    os.environ.setdefault("DB_PORT", "3306")
    os.environ.setdefault("DB_USER", "test")
    os.environ.setdefault("DB_PASSWORD", "test")
    os.environ.setdefault("DB_NAME", "test")
    os.environ.setdefault("DB_REQUIRE_ON_STARTUP", "false")


@pytest.fixture
def app_instance():
    from app.core.config import get_settings

    get_settings.cache_clear()

    from app.main import create_app

    return create_app()


@pytest.fixture
async def client(app_instance):
    async with LifespanManager(app_instance):
        transport = ASGITransport(app=app_instance)
        async with AsyncClient(transport=transport, base_url="http://test") as async_client:
            yield async_client
