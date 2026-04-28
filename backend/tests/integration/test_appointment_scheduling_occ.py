from __future__ import annotations

from datetime import datetime, timezone
import os

from fastapi.testclient import TestClient

os.environ.setdefault("JWT_ACCESS_SECRET", "test-access-secret")
os.environ.setdefault("JWT_REFRESH_SECRET", "test-refresh-secret")
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_USER", "test")
os.environ.setdefault("DB_PASSWORD", "test")
os.environ.setdefault("DB_NAME", "test")

from app.main import create_app


def _client() -> TestClient:
    return TestClient(create_app())


def test_appointment_scheduling_happy_path() -> None:
    with _client() as client:
        create_resp = client.post(
            "/api/v1/appointments",
            json={
                "patient_id": 101,
                "scheduled_for": datetime(2026, 4, 29, 8, 30, tzinfo=timezone.utc).isoformat(),
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        created = create_resp.json()
        assert created["status"] == "scheduled"
        assert created["version"] == 1

        update_resp = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "completed", "version": 1},
        )
        assert update_resp.status_code == 200, update_resp.text
        updated = update_resp.json()
        assert updated["status"] == "completed"
        assert updated["version"] == 2


def test_appointment_update_with_stale_version_returns_409() -> None:
    with _client() as client:
        create_resp = client.post(
            "/api/v1/appointments",
            json={
                "patient_id": 102,
                "scheduled_for": datetime(2026, 4, 29, 10, 0, tzinfo=timezone.utc).isoformat(),
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        created = create_resp.json()

        first_update = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "completed", "version": 1},
        )
        assert first_update.status_code == 200, first_update.text

        stale_update = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "cancelled", "version": 1},
        )
        assert stale_update.status_code == 409, stale_update.text
        body = stale_update.json()
        assert body["detail"]["error"] == "version_conflict"
        assert body["detail"]["expected_version"] == 2
        assert body["detail"]["received_version"] == 1
