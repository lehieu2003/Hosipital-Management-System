from __future__ import annotations

from datetime import datetime
from typing import Any

import aiomysql


async def fetch_user_by_username(conn: aiomysql.Connection, username: str) -> dict[str, Any] | None:
    query = """
        SELECT id, username, password_hash, role, is_active
        FROM users
        WHERE username = %s
        LIMIT 1
    """
    async with conn.cursor(aiomysql.DictCursor) as cursor:
        await cursor.execute(query, (username,))
        return await cursor.fetchone()


async def fetch_user_by_id(conn: aiomysql.Connection, user_id: int) -> dict[str, Any] | None:
    query = """
        SELECT id, username, password_hash, role, is_active
        FROM users
        WHERE id = %s
        LIMIT 1
    """
    async with conn.cursor(aiomysql.DictCursor) as cursor:
        await cursor.execute(query, (user_id,))
        return await cursor.fetchone()


async def insert_refresh_session(
    conn: aiomysql.Connection,
    *,
    token_jti: str,
    user_id: int,
    expires_at: datetime,
    ip_address: str | None,
    user_agent: str | None,
) -> None:
    query = """
        INSERT INTO refresh_tokens (token_jti, user_id, expires_at, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s)
    """
    async with conn.cursor() as cursor:
        await cursor.execute(query, (token_jti, user_id, expires_at, ip_address, user_agent))


async def get_refresh_session(conn: aiomysql.Connection, token_jti: str) -> dict[str, Any] | None:
    query = """
        SELECT token_jti, user_id, expires_at, revoked_at, replaced_by_jti
        FROM refresh_tokens
        WHERE token_jti = %s
        LIMIT 1
    """
    async with conn.cursor(aiomysql.DictCursor) as cursor:
        await cursor.execute(query, (token_jti,))
        return await cursor.fetchone()


async def revoke_refresh_session(
    conn: aiomysql.Connection,
    *,
    token_jti: str,
    reason: str,
    replaced_by_jti: str | None = None,
) -> int:
    query = """
        UPDATE refresh_tokens
        SET revoked_at = UTC_TIMESTAMP(6),
            revoke_reason = %s,
            replaced_by_jti = COALESCE(%s, replaced_by_jti)
        WHERE token_jti = %s AND revoked_at IS NULL
    """
    async with conn.cursor() as cursor:
        await cursor.execute(query, (reason, replaced_by_jti, token_jti))
        return cursor.rowcount


async def prune_expired_sessions(conn: aiomysql.Connection) -> int:
    query = "DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP(6)"
    async with conn.cursor() as cursor:
        await cursor.execute(query)
        return cursor.rowcount
