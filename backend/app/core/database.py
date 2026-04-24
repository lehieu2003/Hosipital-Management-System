from __future__ import annotations

import asyncio
import logging
from typing import Any, AsyncIterator

import aiomysql

from app.core.config import get_settings

logger = logging.getLogger(__name__)

PoolParams = tuple[Any, ...] | dict[str, Any] | list[Any] | None

_pool: aiomysql.Pool | None = None
_pool_lock = asyncio.Lock()


class QueryParameterError(ValueError):
    """Raised when a repository call attempts an unsupported parameter shape."""


class RepositoryQueryError(RuntimeError):
    """Raised for repository-layer execution failures after structured logging."""


def _normalize_params(params: PoolParams) -> tuple[Any, ...] | dict[str, Any] | None:
    if params is None:
        return None
    if isinstance(params, tuple):
        return params
    if isinstance(params, list):
        return tuple(params)
    if isinstance(params, dict):
        return params
    raise QueryParameterError(f"unsupported_query_params:{type(params).__name__}")


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


async def query_fetch_one(
    conn: aiomysql.Connection,
    *,
    statement_id: str,
    query: str,
    params: PoolParams = None,
) -> dict[str, Any] | None:
    try:
        normalized = _normalize_params(params)
        async with conn.cursor(aiomysql.DictCursor) as cursor:
            await cursor.execute(query, normalized)
            return await cursor.fetchone()
    except QueryParameterError:
        logger.warning(
            "db.query.failure",
            extra={"statement_id": statement_id, "reason": "parameter_binding", "error_type": "QueryParameterError"},
        )
        raise
    except (aiomysql.Error, TimeoutError) as exc:
        logger.warning(
            "db.query.failure",
            extra={
                "statement_id": statement_id,
                "reason": "execution_failed",
                "error_type": type(exc).__name__,
            },
        )
        raise RepositoryQueryError(f"query_failed:{statement_id}") from exc


async def query_execute(
    conn: aiomysql.Connection,
    *,
    statement_id: str,
    query: str,
    params: PoolParams = None,
) -> int:
    try:
        normalized = _normalize_params(params)
        async with conn.cursor() as cursor:
            await cursor.execute(query, normalized)
            return cursor.rowcount
    except QueryParameterError:
        logger.warning(
            "db.query.failure",
            extra={"statement_id": statement_id, "reason": "parameter_binding", "error_type": "QueryParameterError"},
        )
        raise
    except (aiomysql.Error, TimeoutError) as exc:
        logger.warning(
            "db.query.failure",
            extra={
                "statement_id": statement_id,
                "reason": "execution_failed",
                "error_type": type(exc).__name__,
            },
        )
        raise RepositoryQueryError(f"query_failed:{statement_id}") from exc
