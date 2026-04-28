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
            "/api/v1/appointments?doctor_id=3",
            json={
                "patient_id": 101,
                "scheduled_for": datetime(2026, 4, 29, 8, 30, tzinfo=timezone.utc).isoformat(),
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        created = create_resp.json()
        assert created["status"] == "scheduled"
        assert created["version"] == 1

        progress_resp = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "in-progress", "version": 1},
        )
        assert progress_resp.status_code == 200, progress_resp.text
        progressed = progress_resp.json()
        assert progressed["status"] == "in-progress"
        assert progressed["version"] == 2

        complete_resp = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "completed", "version": 2},
        )
        assert complete_resp.status_code == 200, complete_resp.text
        completed = complete_resp.json()
        assert completed["status"] == "completed"
        assert completed["version"] == 3


def test_appointment_update_with_stale_version_returns_409() -> None:
    with _client() as client:
        create_resp = client.post(
            "/api/v1/appointments?doctor_id=3",
            json={
                "patient_id": 102,
                "scheduled_for": datetime(2026, 4, 29, 10, 0, tzinfo=timezone.utc).isoformat(),
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        created = create_resp.json()

        first_update = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "in-progress", "version": 1},
        )
        assert first_update.status_code == 200, first_update.text

        stale_update = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "completed", "version": 1},
        )
        assert stale_update.status_code == 409, stale_update.text
        body = stale_update.json()
        assert body["detail"]["error"] == "version_conflict"
        assert body["detail"]["expected_version"] == 2
        assert body["detail"]["received_version"] == 1


def test_invalid_lifecycle_transition_rejected() -> None:
    with _client() as client:
        create_resp = client.post(
            "/api/v1/appointments?doctor_id=3",
            json={
                "patient_id": 103,
                "scheduled_for": datetime(2026, 4, 29, 11, 0, tzinfo=timezone.utc).isoformat(),
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        created = create_resp.json()

        invalid_resp = client.patch(
            f"/api/v1/appointments/{created['id']}",
            json={"status": "completed", "version": 1},
        )
        assert invalid_resp.status_code == 422, invalid_resp.text
        body = invalid_resp.json()
        assert body["detail"]["error"] == "invalid_transition"
        assert body["detail"]["from_status"] == "scheduled"
        assert body["detail"]["to_status"] == "completed"


def test_doctor_queue_filters_by_doctor_and_active_status() -> None:
    from app.api.v1.endpoints import appointments as appointments_module

    appointments_module._store.clear()

    with _client() as client:
        a1 = client.post(
            "/api/v1/appointments?doctor_id=3",
            json={
                "patient_id": 201,
                "scheduled_for": datetime(2026, 4, 29, 12, 0, tzinfo=timezone.utc).isoformat(),
            },
        ).json()
        a2 = client.post(
            "/api/v1/appointments?doctor_id=3",
            json={
                "patient_id": 202,
                "scheduled_for": datetime(2026, 4, 29, 12, 30, tzinfo=timezone.utc).isoformat(),
            },
        ).json()
        a3 = client.post(
            "/api/v1/appointments?doctor_id=9",
            json={
                "patient_id": 203,
                "scheduled_for": datetime(2026, 4, 29, 13, 0, tzinfo=timezone.utc).isoformat(),
            },
        ).json()

        client.patch(f"/api/v1/appointments/{a2['id']}", json={"status": "in-progress", "version": 1})
        client.patch(f"/api/v1/appointments/{a3['id']}", json={"status": "cancelled", "version": 1})

        token_resp = client.post(
            "/api/v1/auth/login",
            json={"username": "doctor", "password": "doctor123"},
        )
        assert token_resp.status_code == 200, token_resp.text
        token = token_resp.json()["access_token"]

        queue_resp = client.get(
            "/api/v1/appointments/doctor-queue",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert queue_resp.status_code == 200, queue_resp.text
        queue = queue_resp.json()
        queue_ids = {row["id"] for row in queue}
        assert a1["id"] in queue_ids
        assert a2["id"] in queue_ids
        assert a3["id"] not in queue_ids
