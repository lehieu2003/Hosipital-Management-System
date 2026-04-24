from __future__ import annotations

from functools import lru_cache

from pydantic import Field, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = Field(default="Hospital Management System API", validation_alias="APP_NAME")
    api_v1_prefix: str = Field(default="/api/v1", validation_alias="API_V1_PREFIX")

    jwt_access_secret: str = Field(..., validation_alias="JWT_ACCESS_SECRET")
    jwt_refresh_secret: str = Field(..., validation_alias="JWT_REFRESH_SECRET")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_access_ttl_minutes: int = Field(default=15, ge=1, validation_alias="JWT_ACCESS_TTL_MINUTES")
    jwt_refresh_ttl_days: int = Field(default=7, ge=1, validation_alias="JWT_REFRESH_TTL_DAYS")
    jwt_issuer: str = Field(default="hospital-backend", validation_alias="JWT_ISSUER")
    jwt_access_audience: str = Field(default="hospital-api", validation_alias="JWT_ACCESS_AUDIENCE")

    refresh_cookie_name: str = Field(default="refresh_token", validation_alias="REFRESH_COOKIE_NAME")
    refresh_cookie_secure: bool = Field(default=False, validation_alias="REFRESH_COOKIE_SECURE")
    refresh_cookie_samesite: str = Field(default="lax", validation_alias="REFRESH_COOKIE_SAMESITE")
    refresh_cookie_domain: str | None = Field(default=None, validation_alias="REFRESH_COOKIE_DOMAIN")
    refresh_cookie_path: str = Field(default="/api/v1/auth", validation_alias="REFRESH_COOKIE_PATH")
    refresh_cookie_httponly: bool = Field(default=True, validation_alias="REFRESH_COOKIE_HTTPONLY")

    db_host: str = Field(..., validation_alias="DB_HOST")
    db_port: int = Field(default=3306, ge=1, le=65535, validation_alias="DB_PORT")
    db_user: str = Field(..., validation_alias="DB_USER")
    db_password: str = Field(..., validation_alias="DB_PASSWORD")
    db_name: str = Field(..., validation_alias="DB_NAME")

    db_pool_min_size: int = Field(default=1, ge=1, validation_alias="DB_POOL_MIN_SIZE")
    db_pool_max_size: int = Field(default=10, ge=1, validation_alias="DB_POOL_MAX_SIZE")
    db_pool_connect_timeout_seconds: int = Field(
        default=5,
        ge=1,
        le=60,
        validation_alias="DB_POOL_CONNECT_TIMEOUT_SECONDS",
    )

    db_require_on_startup: bool = Field(default=True, validation_alias="DB_REQUIRE_ON_STARTUP")

    @model_validator(mode="after")
    def validate_pool_bounds(self) -> "Settings":
        if self.db_pool_min_size > self.db_pool_max_size:
            raise ValueError("DB_POOL_MIN_SIZE must be <= DB_POOL_MAX_SIZE")

        if self.refresh_cookie_samesite.lower() not in {"lax", "strict", "none"}:
            raise ValueError("REFRESH_COOKIE_SAMESITE must be one of: lax, strict, none")

        return self


def load_settings() -> Settings:
    return Settings()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    try:
        return load_settings()
    except ValidationError:
        raise
