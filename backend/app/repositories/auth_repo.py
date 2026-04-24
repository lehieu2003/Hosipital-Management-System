from __future__ import annotations

from datetime import datetime
from typing import Any

import aiomysql

from app.core.database import query_execute, query_fetch_one


async def fetch_user_by_username(conn: aiomysql.Connection, username: str) -> dict[str, Any] | None:
    query = """
        SELECT id, username, password_hash, role, is_active
        FROM users
        WHERE username = %s
        LIMIT 1
    """
    return await query_fetch_one(
        conn,
        statement_id="auth.fetch_user_by_username",
        query=query,
        params=(username,),
    )


async def fetch_user_by_id(conn: aiomysql.Connection, user_id: int) -> dict[str, Any] | None:
    query = """
        SELECT id, username, password_hash, role, is_active
        FROM users
        WHERE id = %s
        LIMIT 1
    """
    return await query_fetch_one(
        conn,
        statement_id="auth.fetch_user_by_id",
        query=query,
        params=(user_id,),
    )


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
    await query_execute(
        conn,
        statement_id="auth.insert_refresh_session",
        query=query,
        params=(token_jti, user_id, expires_at, ip_address, user_agent),
    )


async def get_refresh_session(conn: aiomysql.Connection, token_jti: str) -> dict[str, Any] | None:
    query = """
        SELECT token_jti, user_id, expires_at, revoked_at, replaced_by_jti
        FROM refresh_tokens
        WHERE token_jti = %s
        LIMIT 1
    """
    return await query_fetch_one(
        conn,
        statement_id="auth.get_refresh_session",
        query=query,
        params=(token_jti,),
    )


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
    return await query_execute(
        conn,
        statement_id="auth.revoke_refresh_session",
        query=query,
        params=(reason, replaced_by_jti, token_jti),
    )


async def revoke_all_user_sessions(conn: aiomysql.Connection, *, user_id: int, reason: str) -> int:
    query = """
        UPDATE refresh_tokens
        SET revoked_at = UTC_TIMESTAMP(6),
            revoke_reason = %s
        WHERE user_id = %s AND revoked_at IS NULL
    """
    return await query_execute(
        conn,
        statement_id="auth.revoke_all_user_sessions",
        query=query,
        params=(reason, user_id),
    )


async def prune_expired_sessions(conn: aiomysql.Connection) -> int:
    query = "DELETE FROM refresh_tokens WHERE expires_at < UTC_TIMESTAMP(6)"
    return await query_execute(
        conn,
        statement_id="auth.prune_expired_sessions",
        query=query,
    )
