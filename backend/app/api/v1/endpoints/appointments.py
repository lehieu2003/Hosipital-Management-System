from __future__ import annotations

from datetime import datetime, timezone
from itertools import count
from typing import Literal

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/appointments", tags=["appointments"])

_statuses = {"scheduled", "completed", "cancelled"}
_id_counter = count(1)
_store: dict[int, "Appointment"] = {}


class AppointmentCreate(BaseModel):
    patient_id: int = Field(gt=0)
    scheduled_for: datetime


class AppointmentUpdate(BaseModel):
    status: Literal["scheduled", "completed", "cancelled"]
    version: int = Field(ge=1)


class Appointment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    scheduled_for: datetime
    status: str
    version: int
    updated_at: datetime


@router.post("", response_model=Appointment, status_code=status.HTTP_201_CREATED)
async def create_appointment(payload: AppointmentCreate) -> Appointment:
    appt_id = next(_id_counter)
    now = datetime.now(timezone.utc)
    record = Appointment(
        id=appt_id,
        patient_id=payload.patient_id,
        scheduled_for=payload.scheduled_for,
        status="scheduled",
        version=1,
        updated_at=now,
    )
    _store[appt_id] = record
    return record


@router.patch("/{appointment_id}", response_model=Appointment)
async def update_appointment(appointment_id: int, payload: AppointmentUpdate) -> Appointment:
    if payload.status not in _statuses:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status")

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

    updated = current.model_copy(
        update={
            "status": payload.status,
            "version": current.version + 1,
            "updated_at": datetime.now(UTC),
        }
    )
    _store[appointment_id] = updated
    return updated
