from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_openapi_exposes_bearer_security_scheme(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 200

    doc = response.json()
    security_schemes = doc["components"]["securitySchemes"]

    assert "BearerAuth" in security_schemes
    bearer = security_schemes["BearerAuth"]
    assert bearer["type"] == "http"
    assert bearer["scheme"] == "bearer"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/probe/admin",
        "/api/v1/probe/reception",
        "/api/v1/probe/doctor",
        "/api/v1/probe/deny-default",
    ],
)
async def test_probe_routes_declare_security_requirement(client, path):
    response = await client.get("/openapi.json")
    assert response.status_code == 200

    doc = response.json()
    operation = doc["paths"][path]["get"]

    assert operation.get("security") == [{"BearerAuth": []}]


@pytest.mark.asyncio
async def test_unprotected_ping_route_has_no_security_requirement(client):
    response = await client.get("/openapi.json")
    assert response.status_code == 200

    doc = response.json()
    ping_operation = doc["paths"]["/api/v1/ping"]["get"]

    assert ping_operation.get("security") is None
