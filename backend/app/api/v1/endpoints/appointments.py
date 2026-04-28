from __future__ import annotations

from datetime import datetime, timezone
from itertools import count

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies.auth import AuthenticatedPrincipal
from app.api.dependencies.rbac import require_roles
from app.models.appointment import (
    ALLOWED_STATUS_TRANSITIONS,
    Appointment,
    AppointmentCreate,
    AppointmentUpdate,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])

_id_counter = count(1)
_store: dict[int, Appointment] = {}


@router.post("", response_model=Appointment, status_code=status.HTTP_201_CREATED)
async def create_appointment(
    payload: AppointmentCreate,
    doctor_id: int | None = Query(default=None, gt=0),
) -> Appointment:
    appt_id = next(_id_counter)
    now = datetime.now(timezone.utc)
    record = Appointment(
        id=appt_id,
        patient_id=payload.patient_id,
        doctor_id=doctor_id,
        scheduled_for=payload.scheduled_for,
        status="scheduled",
        version=1,
        updated_at=now,
    )
    _store[appt_id] = record
    return record


@router.get("/doctor-queue", response_model=list[Appointment])
async def get_doctor_queue(
    current_user: AuthenticatedPrincipal = Depends(require_roles("doctor")),
) -> list[Appointment]:
    doctor_id = int(current_user.user_id)
    queue_statuses = {"scheduled", "in-progress"}
    return [
        appt
        for appt in _store.values()
        if appt.doctor_id == doctor_id and appt.status in queue_statuses
    ]


@router.patch("/{appointment_id}", response_model=Appointment)
async def update_appointment(
    appointment_id: int,
    payload: AppointmentUpdate,
) -> Appointment:
    current = _store.get(appointment_id)
    if current is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found")

    if payload.version != current.version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": "version_conflict",
                "message": "Appointment version mismatch",
                "expected_version": current.version,
                "received_version": payload.version,
            },
        )

    allowed = ALLOWED_STATUS_TRANSITIONS.get(current.status, set())
    if payload.status != current.status and payload.status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "invalid_transition",
                "message": f"Cannot transition appointment from '{current.status}' to '{payload.status}'",
                "from_status": current.status,
                "to_status": payload.status,
            },
        )

    updated = current.model_copy(
        update={
            "status": payload.status,
            "version": current.version + 1,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    _store[appointment_id] = updated
    return updated
