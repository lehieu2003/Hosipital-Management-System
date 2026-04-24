from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import pytest

from app.core.database import QueryParameterError, RepositoryQueryError, query_execute
from app.repositories.auth_repo import fetch_user_by_id, fetch_user_by_username


@dataclass
class QueryLog:
    query: str
    params: Any


@dataclass
class FakeDBState:
    users: dict[int, dict[str, Any]] = field(default_factory=dict)
    query_log: list[QueryLog] = field(default_factory=list)
    fail_with: Exception | None = None


class FakeCursor:
    def __init__(self, state: FakeDBState) -> None:
        self.state = state
        self._result: Any = None
        self.rowcount = 0

    async def __aenter__(self) -> "FakeCursor":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def execute(self, query: str, params: tuple[Any, ...] | dict[str, Any] | None = None) -> None:
        if self.state.fail_with is not None:
            raise self.state.fail_with

        self.state.query_log.append(QueryLog(query=query, params=params))
        q = " ".join(query.split()).lower()

        if "from users where username = %s" in q:
            username = str((params or ("",))[0])
            self._result = next((u for u in self.state.users.values() if u["username"] == username), None)
            self.rowcount = 1 if self._result else 0
            return

        if "from users where id = %s" in q:
            requested_id = str((params or ("",))[0])
            self._result = next((u for u in self.state.users.values() if str(u["id"]) == requested_id), None)
            self.rowcount = 1 if self._result else 0
            return

        self._result = None
        self.rowcount = 1

    async def fetchone(self) -> Any:
        return self._result


class FakeConnection:
    def __init__(self, state: FakeDBState) -> None:
        self.state = state

    def cursor(self, *_args, **_kwargs) -> FakeCursor:
        return FakeCursor(self.state)


@pytest.mark.asyncio
async def test_login_lookup_treats_sql_metacharacters_as_literal_values() -> None:
    state = FakeDBState(
        users={
            1: {
                "id": 1,
                "username": "doctor",
                "password_hash": "x",
                "role": "doctor",
                "is_active": 1,
            }
        }
    )
    conn = FakeConnection(state)

    row = await fetch_user_by_username(conn, "' OR 1=1 --")

    assert row is None
    assert state.query_log
    assert "where username = %s" in " ".join(state.query_log[-1].query.split()).lower()
    assert state.query_log[-1].params == ("' OR 1=1 --",)


@pytest.mark.asyncio
async def test_role_lookup_path_keeps_subject_parameterized() -> None:
    state = FakeDBState(
        users={
            7: {
                "id": 7,
                "username": "doctor-user",
                "password_hash": "x",
                "role": "doctor",
                "is_active": 1,
            }
        }
    )
    conn = FakeConnection(state)

    row = await fetch_user_by_id(conn, "7 OR 1=1")

    assert row is None
    assert state.query_log
    assert "where id = %s" in " ".join(state.query_log[-1].query.split()).lower()
    assert state.query_log[-1].params == ("7 OR 1=1",)


@pytest.mark.asyncio
async def test_query_helper_rejects_unsupported_parameter_shape(caplog: pytest.LogCaptureFixture) -> None:
    caplog.set_level(logging.INFO)
    conn = FakeConnection(FakeDBState())

    with pytest.raises(QueryParameterError):
        await query_execute(
            conn,
            statement_id="test.binding.invalid_shape",
            query="SELECT 1",
            params={"invalid-set"},
        )

    assert any(
        r.msg == "db.query.failure"
        and getattr(r, "statement_id", "") == "test.binding.invalid_shape"
        and getattr(r, "reason", "") == "parameter_binding"
        for r in caplog.records
    )


@pytest.mark.asyncio
async def test_query_helper_wraps_driver_timeout_with_sanitized_statement_id(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.INFO)
    conn = FakeConnection(FakeDBState(fail_with=TimeoutError("db timeout")))

    with pytest.raises(RepositoryQueryError):
        await query_execute(
            conn,
            statement_id="auth.fetch_user_by_username",
            query="SELECT id FROM users WHERE username = %s",
            params=("doctor",),
        )

    failure_records = [r for r in caplog.records if r.msg == "db.query.failure"]
    assert any(
        getattr(r, "statement_id", "") == "auth.fetch_user_by_username"
        and getattr(r, "reason", "") == "execution_failed"
        and getattr(r, "error_type", "") == "TimeoutError"
        for r in failure_records
    )
    assert all("SELECT id FROM users" not in r.getMessage() for r in failure_records)
