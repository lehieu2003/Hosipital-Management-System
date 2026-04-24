from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AccessTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime


class MeResponse(BaseModel):
    user_id: int
    username: str
    role: str


class UserAuthRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: int
    username: str
    password_hash: str
    role: str
    is_active: int = 1


class RefreshSessionRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token_jti: str
    user_id: int
    expires_at: datetime
    revoked_at: datetime | None = None
    replaced_by_jti: str | None = None
