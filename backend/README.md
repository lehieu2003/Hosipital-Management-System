# Backend

## S01 Verification Commands

Run these commands from the repository root (`D:/Hosipital Management System`) as the deterministic S01 verification gate:

```bash
pytest backend/tests/integration/test_sql_parameterization.py -q
pytest backend/tests/smoke/test_health_and_docs.py \
  backend/tests/integration/test_auth_flow.py \
  backend/tests/integration/test_rbac_guards.py \
  backend/tests/integration/test_sql_parameterization.py \
  backend/tests/contract/test_openapi_security.py -q
```

These checks validate:
- SQL parameterization regressions for auth/RBAC repository lookups.
- JWT auth flow + refresh rotation behavior.
- RBAC deny/allow guard behavior and OpenAPI bearer contract.
