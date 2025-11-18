# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: FastAPI app (`main.py`) with SQLAlchemy models and sqlite defaults; `requirements.txt` keeps server deps.
- `frontend/`: Static HTML/CSS/JS for login and main UI; served via NGINX in the Dockerfile.
- `data/` and `energy_tycoon.db`: sqlite storage; avoid overwriting shared data in version control.
- `nginx/`: Reverse-proxy config used by the frontend container.
- `docker-compose.yml`: Orchestrates frontend (port 80) and backend (exposed 8000) services.

## Build, Test, and Development Commands
- Python env (once): `python -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt`.
- Run backend locally: `uvicorn main:app --reload --host 0.0.0.0 --port 8000 --app-dir backend`.
- Quick static preview: `python -m http.server 8080 --directory frontend` or open `frontend/index.html` in a browser.
- Full stack with containers: `docker-compose up --build` (uses `backend/Dockerfile` and `frontend/Dockerfile` with `nginx/default.conf`).

## Coding Style & Naming Conventions
- Python: PEP 8, 4-space indents, `snake_case` for functions/vars, `PascalCase` for ORM models and Pydantic schemas, constants upper snake.
- JavaScript: `camelCase` for functions/vars; keep DOM IDs/classes descriptive; avoid global leakage.
- Keep request/response schemas aligned with FastAPI models; add docstrings when behavior is non-obvious.

## Testing Guidelines
- No automated test suite yet; prefer adding `pytest` with FastAPI test client. Name files `tests/test_<feature>.py`.
- For manual checks, hit key routes (auth, generator creation, progress save) with a fresh sqlite db; verify CORS via `FRONTEND_ORIGINS`.
- Include seed data steps in PRs if tests rely on fixtures instead of the bundled `energy_tycoon.db`.

## Commit & Pull Request Guidelines
- Commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`; keep commits small and focused.
- PRs should describe scope, validation steps (commands/endpoints exercised), and any DB or config changes. Attach screenshots/GIFs for UI-visible updates.
- Link related issues when available; request review once linting/manual checks are noted in the description.

## Security & Configuration Tips
- Set `DATABASE_URL` for custom sqlite paths; `_ensure_sqlite_dir` will create parent directories—avoid pointing at unwritable locations.
- Use `FRONTEND_ORIGINS` to restrict CORS in deployments; default `*` is development-only.
- Do not commit new credentials or locally generated sqlite files; prefer sample data scripts under `data/` when needed.
