from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

AppointmentStatus = Literal["scheduled", "in-progress", "completed", "cancelled"]

ALLOWED_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "scheduled": {"in-progress", "cancelled"},
    "in-progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


class AppointmentCreate(BaseModel):
    patient_id: int = Field(gt=0)
    scheduled_for: datetime


class AppointmentUpdate(BaseModel):
    status: AppointmentStatus
    version: int = Field(ge=1)


class Appointment(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_id: int
    doctor_id: int | None = None
    scheduled_for: datetime
    status: AppointmentStatus
    version: int
    updated_at: datetime
