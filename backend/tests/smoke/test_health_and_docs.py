import pytest


@pytest.mark.asyncio
async def test_healthz_and_docs_are_reachable(client):
    health_response = await client.get("/healthz")
    assert health_response.status_code == 200

    health_payload = health_response.json()
    assert health_payload["status"] == "ok"
    assert "ready" in health_payload

    docs_response = await client.get("/docs")
    assert docs_response.status_code == 200
    assert "Swagger UI" in docs_response.text
