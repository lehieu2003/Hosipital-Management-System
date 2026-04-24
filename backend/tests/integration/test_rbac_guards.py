from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from app.core.database import get_db_conn
from app.core.security import build_access_token


@dataclass
class FakeDBState:
    users: dict[int, dict[str, Any]] = field(default_factory=dict)


class FakeCursor:
    def __init__(self, state: FakeDBState) -> None:
        self.state = state
        self._result: Any = None
        self.rowcount = 0

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def execute(self, query: str, params: tuple[Any, ...] | None = None) -> None:
        q = " ".join(query.split()).lower()
        params = params or ()

        if "select id, username, password_hash, role, is_active from users where id = %s" in q:
            user_id = int(params[0])
            self._result = self.state.users.get(user_id)
            self.rowcount = 1 if self._result else 0
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
def rbac_state() -> FakeDBState:
    return FakeDBState(
        users={
            1: {
                "id": 1,
                "username": "admin-user",
                "password_hash": "$2b$12$placeholder",
                "role": "admin",
                "is_active": 1,
            },
            2: {
                "id": 2,
                "username": "reception-user",
                "password_hash": "$2b$12$placeholder",
                "role": "receptionist",
                "is_active": 1,
            },
            3: {
                "id": 3,
                "username": "doctor-user",
                "password_hash": "$2b$12$placeholder",
                "role": "doctor",
                "is_active": 1,
            },
            4: {
                "id": 4,
                "username": "unknown-role",
                "password_hash": "$2b$12$placeholder",
                "role": "janitor",
                "is_active": 1,
            },
        }
    )


@pytest.fixture
async def rbac_client(app_instance, rbac_state: FakeDBState):
    conn = FakeConnection(rbac_state)

    async def _override_db_conn():
        yield conn

    app_instance.dependency_overrides[get_db_conn] = _override_db_conn

    async with LifespanManager(app_instance):
        transport = ASGITransport(app=app_instance)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, rbac_state

    app_instance.dependency_overrides.clear()


def _auth_header(*, user_id: int, role: str, username: str) -> dict[str, str]:
    token, _ = build_access_token(user_id=user_id, role=role, username=username)
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("path", "user_id", "role", "username", "expected_status"),
    [
        ("/api/v1/probe/admin", 1, "admin", "admin-user", 200),
        ("/api/v1/probe/admin", 2, "receptionist", "reception-user", 403),
        ("/api/v1/probe/admin", 3, "doctor", "doctor-user", 403),
        ("/api/v1/probe/reception", 2, "receptionist", "reception-user", 200),
        ("/api/v1/probe/doctor", 3, "doctor", "doctor-user", 200),
    ],
)
async def test_role_matrix_enforced(rbac_client, path, user_id, role, username, expected_status):
    client, _ = rbac_client

    response = await client.get(path, headers=_auth_header(user_id=user_id, role=role, username=username))

    assert response.status_code == expected_status


@pytest.mark.asyncio
async def test_missing_authorization_header_denied(rbac_client, caplog):
    caplog.set_level(logging.INFO)
    client, _ = rbac_client

    response = await client.get("/api/v1/probe/admin")

    assert response.status_code == 401
    assert response.json()["detail"] == "missing_bearer_token"
    assert any(r.msg == "rbac.deny" and getattr(r, "reason", "") == "missing_token" for r in caplog.records)


@pytest.mark.asyncio
async def test_unknown_role_is_forbidden(rbac_client, caplog):
    caplog.set_level(logging.INFO)
    client, _ = rbac_client

    response = await client.get(
        "/api/v1/probe/admin",
        headers=_auth_header(user_id=4, role="janitor", username="unknown-role"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"
    assert any(r.msg == "rbac.deny" and getattr(r, "reason", "") == "unknown_role" for r in caplog.records)


@pytest.mark.asyncio
async def test_tampered_role_claim_cannot_escalate_privilege(rbac_client, caplog):
    caplog.set_level(logging.INFO)
    client, _ = rbac_client

    response = await client.get(
        "/api/v1/probe/admin",
        headers=_auth_header(user_id=3, role="admin", username="doctor-user"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"
    assert any(r.msg == "rbac.deny" and getattr(r, "reason", "") == "role_forbidden" for r in caplog.records)


@pytest.mark.asyncio
async def test_deny_by_default_without_allowed_roles(rbac_client, caplog):
    caplog.set_level(logging.INFO)
    client, _ = rbac_client

    response = await client.get(
        "/api/v1/probe/deny-default",
        headers=_auth_header(user_id=1, role="admin", username="admin-user"),
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "forbidden"
    assert any(r.msg == "rbac.deny" and getattr(r, "reason", "") == "policy_missing" for r in caplog.records)


@pytest.mark.asyncio
async def test_rbac_allow_event_emitted_on_authorized_request(rbac_client, caplog):
    caplog.set_level(logging.INFO)
    client, _ = rbac_client

    response = await client.get(
        "/api/v1/probe/admin",
        headers=_auth_header(user_id=1, role="admin", username="admin-user"),
    )

    assert response.status_code == 200
    assert any(r.msg == "rbac.allow" and getattr(r, "role", "") == "admin" for r in caplog.records)
