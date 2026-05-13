# Repository Guidelines

## Project Structure & Module Organization
This repository is currently centered on the FastAPI backend in `backend/`. Application code lives in `backend/app`, split by concern: `api/` for routes and dependencies, `core/` for config, security, and database access, `models/` for Pydantic types, and `repositories/` for SQL-backed data access. SQL migrations and seed scripts live in `backend/sql`. Tests live in `backend/tests` and are grouped by scope: `unit`, `smoke`, `integration`, and `contract`.

## Build, Test, and Development Commands
Run commands from the repository root unless noted.

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -e .[dev]
uvicorn app.main:app --reload
pytest
pytest tests/smoke/test_health_and_docs.py -q
pytest tests/integration/test_auth_flow.py -q
```

`pip install -e .[dev]` installs the app plus test dependencies. `uvicorn app.main:app --reload` starts the local API. Use targeted `pytest` commands for fast iteration, then run the full suite before opening a PR.

## Coding Style & Naming Conventions
Follow existing Python conventions: 4-space indentation, explicit type hints, `snake_case` for functions and modules, `PascalCase` for Pydantic models and settings classes, and short, structured log event names such as `auth.login.success`. Keep route handlers thin and push SQL access into `repositories/`. No formatter or linter is currently wired in `pyproject.toml`, so keep changes PEP 8-aligned and consistent with nearby files.

## Testing Guidelines
Use `pytest` with `pytest-asyncio` for async coverage. Name test files `test_<behavior>.py` and place them in the narrowest matching suite (`unit`, `smoke`, `integration`, or `contract`). Prefer focused assertions around auth, RBAC, startup behavior, and SQL parameterization, which are already treated as critical paths in this repo.

## Commit & Pull Request Guidelines
Recent history follows concise, imperative subjects with prefixes such as `feat:`, `test:`, `chore:`, and `add`. Keep commits scoped to one change. PRs should include a short problem statement, a summary of the behavioral change, the exact verification commands you ran, and sample request/response output or screenshots when an endpoint contract or docs output changes.

## Configuration & Security Tips
Copy `backend/.env.example` when bootstrapping local config. Never commit real secrets or populated `.env` files. For local test runs, prefer `DB_REQUIRE_ON_STARTUP=false` unless you are intentionally validating database startup behavior.
