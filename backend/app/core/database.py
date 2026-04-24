from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

import aiomysql

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_pool: aiomysql.Pool | None = None
_pool_lock = asyncio.Lock()


async def init_pool() -> aiomysql.Pool:
    """Initialize the aiomysql pool exactly once per process lifecycle."""
    global _pool

    if _pool is not None:
        return _pool

    async with _pool_lock:
        if _pool is not None:
            return _pool

        settings = get_settings()
        logger.info(
            "db_pool_starting",
            extra={
                "db_host": settings.db_host,
                "db_port": settings.db_port,
                "db_name": settings.db_name,
                "pool_min": settings.db_pool_min_size,
                "pool_max": settings.db_pool_max_size,
                "connect_timeout_seconds": settings.db_pool_connect_timeout_seconds,
            },
        )

        _pool = await aiomysql.create_pool(
            host=settings.db_host,
            port=settings.db_port,
            user=settings.db_user,
            password=settings.db_password,
            db=settings.db_name,
            minsize=settings.db_pool_min_size,
            maxsize=settings.db_pool_max_size,
            connect_timeout=settings.db_pool_connect_timeout_seconds,
            autocommit=True,
        )

        logger.info("db_pool_started", extra={"pool_size": _pool.size, "pool_free": _pool.freesize})
        return _pool


async def close_pool() -> None:
    """Close the aiomysql pool if it exists."""
    global _pool

    if _pool is None:
        return

    async with _pool_lock:
        if _pool is None:
            return

        logger.info("db_pool_stopping")
        _pool.close()
        await _pool.wait_closed()
        _pool = None
        logger.info("db_pool_stopped")


def pool_ready() -> bool:
    return _pool is not None


def get_pool() -> aiomysql.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool


async def get_db_conn() -> AsyncIterator[aiomysql.Connection]:
    """Dependency that acquires and always releases a pooled DB connection."""
    pool = get_pool()
    conn = await pool.acquire()
    try:
        yield conn
    finally:
        pool.release(conn)


async def fetch_one(query: str, params: tuple[Any, ...] | None = None) -> dict[str, Any] | None:
    pool = get_pool()
    async with pool.acquire() as conn:
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(query, params)
            return await cursor.fetchone()
