from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from app.core.config import get_settings
from app.core.database import get_db_conn
from app.core.security import decode_refresh_token, hash_password


@dataclass
class FakeDBState:
    users: dict[int, dict[str, Any]] = field(default_factory=dict)
    refresh_tokens: dict[str, dict[str, Any]] = field(default_factory=dict)


class FakeCursor:
    def __init__(self, state: FakeDBState, dict_mode: bool = False) -> None:
        self.state = state
        self.dict_mode = dict_mode
        self._result: Any = None
        self.rowcount = 0

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def execute(self, query: str, params: tuple[Any, ...] | None = None) -> None:
        q = " ".join(query.split()).lower()
        params = params or ()
        now = datetime.now(tz=timezone.utc)

        if "select id, username, password_hash, role, is_active from users where username = %s" in q:
            username = str(params[0])
            self._result = next((u for u in self.state.users.values() if u["username"] == username), None)
            self.rowcount = 1 if self._result else 0
            return

        if "select id, username, password_hash, role, is_active from users where id = %s" in q:
            user_id = int(params[0])
            self._result = self.state.users.get(user_id)
            self.rowcount = 1 if self._result else 0
            return

        if "insert into refresh_tokens" in q:
            token_jti, user_id, expires_at, ip_address, user_agent = params
            self.state.refresh_tokens[str(token_jti)] = {
                "token_jti": str(token_jti),
                "user_id": int(user_id),
                "expires_at": expires_at,
                "revoked_at": None,
                "replaced_by_jti": None,
                "revoke_reason": None,
                "ip_address": ip_address,
                "user_agent": user_agent,
            }
            self.rowcount = 1
            return

        if "select token_jti, user_id, expires_at, revoked_at, replaced_by_jti from refresh_tokens where token_jti = %s" in q:
            token_jti = str(params[0])
            row = self.state.refresh_tokens.get(token_jti)
            self._result = (
                {
                    "token_jti": row["token_jti"],
                    "user_id": row["user_id"],
                    "expires_at": row["expires_at"],
                    "revoked_at": row["revoked_at"],
                    "replaced_by_jti": row["replaced_by_jti"],
                }
                if row
                else None
            )
            self.rowcount = 1 if self._result else 0
            return

        if "update refresh_tokens set revoked_at = utc_timestamp(6), revoke_reason = %s, replaced_by_jti = coalesce(%s, replaced_by_jti) where token_jti = %s and revoked_at is null" in q:
            reason, replaced_by, token_jti = params
            row = self.state.refresh_tokens.get(str(token_jti))
            if row and row["revoked_at"] is None:
                row["revoked_at"] = now
                row["revoke_reason"] = str(reason)
                if replaced_by is not None:
                    row["replaced_by_jti"] = str(replaced_by)
                self.rowcount = 1
            else:
                self.rowcount = 0
            return

        if "update refresh_tokens set revoked_at = utc_timestamp(6), revoke_reason = %s where user_id = %s and revoked_at is null" in q:
            reason, user_id = params
            count = 0
            for row in self.state.refresh_tokens.values():
                if row["user_id"] == int(user_id) and row["revoked_at"] is None:
                    row["revoked_at"] = now
                    row["revoke_reason"] = str(reason)
                    count += 1
            self.rowcount = count
            return

        if "delete from refresh_tokens where expires_at < utc_timestamp(6)" in q:
            to_delete = [jti for jti, row in self.state.refresh_tokens.items() if row["expires_at"] < now]
            for jti in to_delete:
                del self.state.refresh_tokens[jti]
            self.rowcount = len(to_delete)
            return

        raise AssertionError(f"Unhandled query: {query}")

    async def fetchone(self) -> Any:
        return self._result


class FakeConnection:
    def __init__(self, state: FakeDBState) -> None:
        self.state = state

    def cursor(self, *_args, **_kwargs) -> FakeCursor:
        return FakeCursor(self.state)


@pytest.fixture
def auth_state() -> FakeDBState:
    return FakeDBState(
        users={
            1: {
                "id": 1,
                "username": "doctor",
                "password_hash": hash_password("secret123"),
                "role": "doctor",
                "is_active": 1,
            }
        }
    )


@pytest.fixture
async def auth_client(app_instance, auth_state: FakeDBState):
    conn = FakeConnection(auth_state)

    async def _override_db_conn():
        yield conn

    app_instance.dependency_overrides[get_db_conn] = _override_db_conn

    async with LifespanManager(app_instance):
        transport = ASGITransport(app=app_instance)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, auth_state

    app_instance.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_login_refresh_me_and_replay_denial(auth_client, caplog):
    caplog.set_level(logging.INFO)
    client, state = auth_client

    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "doctor", "password": "secret123"},
    )
    assert login.status_code == 200
    body = login.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]

    set_cookie = login.headers.get("set-cookie", "")
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Path=/api/v1/auth" in set_cookie

    refresh_cookie = login.cookies.get(get_settings().refresh_cookie_name)
    assert refresh_cookie is not None

    me = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json() == {"user_id": 1, "username": "doctor", "role": "doctor"}

    refresh = await client.post("/api/v1/auth/refresh")
    assert refresh.status_code == 200
    new_access = refresh.json()["access_token"]
    assert new_access != body["access_token"]

    rotated_cookie = refresh.cookies.get(get_settings().refresh_cookie_name)
    assert rotated_cookie and rotated_cookie != refresh_cookie

    replay = await client.post(
        "/api/v1/auth/refresh",
        cookies={get_settings().refresh_cookie_name: refresh_cookie},
    )
    assert replay.status_code == 401
    assert replay.json()["detail"] == "revoked_refresh_token"

    decoded = decode_refresh_token(rotated_cookie)
    rotated_row = state.refresh_tokens[str(decoded["jti"])]
    assert rotated_row["revoked_at"] is None

    denied_records = [r for r in caplog.records if r.msg == "auth.refresh.denied"]
    assert any(getattr(r, "reason", "") in {"revoked", "already_rotated"} for r in denied_records)
    assert any(r.msg == "auth.login.success" for r in caplog.records)
    assert any(r.msg == "auth.refresh.success" for r in caplog.records)


@pytest.mark.asyncio
async def test_invalid_credentials_and_malformed_inputs(auth_client, caplog):
    caplog.set_level(logging.INFO)
    client, _ = auth_client

    empty_payload = await client.post(
        "/api/v1/auth/login",
        json={"username": "", "password": ""},
    )
    assert empty_payload.status_code == 422

    invalid = await client.post(
        "/api/v1/auth/login",
        json={"username": "doctor", "password": "bad"},
    )
    assert invalid.status_code == 401
    assert invalid.json()["detail"] == "invalid_credentials"

    malicious_username = await client.post(
        "/api/v1/auth/login",
        json={"username": "' OR 1=1 --", "password": "secret123"},
    )
    assert malicious_username.status_code == 401
    assert malicious_username.json()["detail"] == "invalid_credentials"

    malformed_cookie = await client.post(
        "/api/v1/auth/refresh",
        cookies={get_settings().refresh_cookie_name: "not-a-jwt"},
    )
    assert malformed_cookie.status_code == 401
    assert malformed_cookie.json()["detail"] == "invalid_refresh_token"

    malformed_bearer = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer bad.token"})
    assert malformed_bearer.status_code == 401
    assert malformed_bearer.json()["detail"] == "invalid_access_token"

    login_failures = [r for r in caplog.records if r.msg == "auth.login.failure"]
    assert any(getattr(r, "reason", "") == "invalid_credentials" for r in login_failures)

    refresh_denials = [r for r in caplog.records if r.msg == "auth.refresh.denied"]
    assert any(getattr(r, "reason", "") == "invalid_refresh_token" for r in refresh_denials)
    assert all("not-a-jwt" not in r.getMessage() for r in refresh_denials)
    assert all(getattr(r, "token_fingerprint", "") != "not-a-jwt" for r in refresh_denials)


@pytest.mark.asyncio
async def test_expired_refresh_token_denied(auth_client):
    client, _ = auth_client
    settings = get_settings()
    now = datetime.now(tz=timezone.utc)

    expired_token = jwt.encode(
        {
            "sub": "1",
            "type": "refresh",
            "jti": "expired-token-jti",
            "iss": settings.jwt_issuer,
            "iat": int((now - timedelta(days=2)).timestamp()),
            "exp": int((now - timedelta(days=1)).timestamp()),
        },
        settings.jwt_refresh_secret,
        algorithm=settings.jwt_algorithm,
    )

    res = await client.post(
        "/api/v1/auth/refresh",
        cookies={settings.refresh_cookie_name: expired_token},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "expired_refresh_token"


@pytest.mark.asyncio
async def test_logout_revokes_cookie_session(auth_client):
    client, state = auth_client

    login = await client.post(
        "/api/v1/auth/login",
        json={"username": "doctor", "password": "secret123"},
    )
    token = login.cookies.get(get_settings().refresh_cookie_name)
    token_jti = str(decode_refresh_token(token)["jti"])

    logout = await client.post("/api/v1/auth/logout")
    assert logout.status_code == 200
    assert logout.json() == {"ok": True}

    row = state.refresh_tokens[token_jti]
    assert row["revoked_at"] is not None
