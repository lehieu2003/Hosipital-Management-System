from __future__ import annotations

import os

import pytest
from asgi_lifespan import LifespanManager
from pydantic import ValidationError


@pytest.mark.asyncio
async def test_startup_fails_fast_when_db_unavailable(monkeypatch):
    monkeypatch.setenv("JWT_ACCESS_SECRET", "test-access-secret")
    monkeypatch.setenv("JWT_REFRESH_SECRET", "test-refresh-secret")
    monkeypatch.setenv("DB_HOST", "127.0.0.1")
    monkeypatch.setenv("DB_PORT", "1")
    monkeypatch.setenv("DB_USER", "root")
    monkeypatch.setenv("DB_PASSWORD", "bad")
    monkeypatch.setenv("DB_NAME", "missing")
    monkeypatch.setenv("DB_REQUIRE_ON_STARTUP", "true")
    monkeypatch.setenv("DB_POOL_CONNECT_TIMEOUT_SECONDS", "1")

    from app.core.config import get_settings

    get_settings.cache_clear()

    from app.main import create_app

    app = create_app()
    with pytest.raises(Exception):
        async with LifespanManager(app):
            pass


def test_settings_reject_missing_required_env(monkeypatch):
    monkeypatch.delenv("JWT_ACCESS_SECRET", raising=False)
    monkeypatch.setenv("JWT_REFRESH_SECRET", "test-refresh-secret")
    monkeypatch.setenv("DB_HOST", "127.0.0.1")
    monkeypatch.setenv("DB_PORT", "3306")
    monkeypatch.setenv("DB_USER", "test")
    monkeypatch.setenv("DB_PASSWORD", "test")
    monkeypatch.setenv("DB_NAME", "test")

    from app.core.config import load_settings

    with pytest.raises(ValidationError):
        load_settings()


def test_settings_reject_invalid_pool_bounds(monkeypatch):
    monkeypatch.setenv("JWT_ACCESS_SECRET", "test-access-secret")
    monkeypatch.setenv("JWT_REFRESH_SECRET", "test-refresh-secret")
    monkeypatch.setenv("DB_HOST", "127.0.0.1")
    monkeypatch.setenv("DB_PORT", "3306")
    monkeypatch.setenv("DB_USER", "test")
    monkeypatch.setenv("DB_PASSWORD", "test")
    monkeypatch.setenv("DB_NAME", "test")
    monkeypatch.setenv("DB_POOL_MIN_SIZE", "5")
    monkeypatch.setenv("DB_POOL_MAX_SIZE", "1")

    from app.core.config import load_settings

    with pytest.raises(ValidationError):
        load_settings()


def test_settings_accept_minimal_valid_pool_bounds(monkeypatch):
    monkeypatch.setenv("JWT_ACCESS_SECRET", "test-access-secret")
    monkeypatch.setenv("JWT_REFRESH_SECRET", "test-refresh-secret")
    monkeypatch.setenv("DB_HOST", "127.0.0.1")
    monkeypatch.setenv("DB_PORT", "3306")
    monkeypatch.setenv("DB_USER", "test")
    monkeypatch.setenv("DB_PASSWORD", "test")
    monkeypatch.setenv("DB_NAME", "test")
    monkeypatch.setenv("DB_POOL_MIN_SIZE", "1")
    monkeypatch.setenv("DB_POOL_MAX_SIZE", "1")

    from app.core.config import load_settings

    settings = load_settings()

    assert settings.db_pool_min_size == 1
    assert settings.db_pool_max_size == 1
