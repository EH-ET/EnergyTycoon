# Repository Guidelines

## Project Structure & Module Organization
`backend/` hosts the FastAPI app (routers in `backend/routes`, models/schemas/data access under `backend/models.py`, `schemas.py`, and `database.py`). Static gameplay UI lives in `frontend/`, with vanilla JS modules in `frontend/js/` and sprites in `frontend/generator/`. Shared data artifacts (SQLite db seed, specs, ERD, API docs) stay at the repo root under `data/`, `API 명세/`, and `main_overview_files/`. Keep new analytics or tooling inside `project_analysis_files/` to avoid polluting production code.

## Build, Test, and Development Commands
Run `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` to install backend deps. Start the API locally via `uvicorn backend.main:app --reload`, which auto-seeds generator types. Serve the static frontend with `python3 -m http.server 4173 --directory frontend` or wire it behind `nginx/` when testing auth/CORS. Use `docker-compose up --build` for parity with production (FastAPI + nginx + SQLite volume) before raising PRs.

## Coding Style & Naming Conventions
Python code follows PEP8 with 4-space indentation, type hints on public functions, and explicit `Enum`/`BaseModel` definitions for request/response contracts. Keep route names verb-based (`progress_routes.py`, `upgrade_routes.py`) and ensure schema fields mirror DB columns. Frontend JS modules use camelCase exports and file names that describe the tab or helper they encapsulate (e.g., `generatorTab.js`). Reference shared selectors from `frontend/js/state.js` instead of re-querying DOM nodes.

## Testing Guidelines
Unit tests belong under `backend/tests/` (create the folder if absent) and should use `pytest` plus `httpx.AsyncClient` for route coverage. Mock DB sessions through `backend.dependencies.get_db` overrides and seed data with the fixtures in `backend/init_db.py`. Adopt the pattern `test_<feature>_<behavior>` for function names and keep one assertion path per test case. Run `pytest -q` locally and ensure critical endpoints (auth, generator upgrades, rank syncing) have regression coverage before merging.

## Commit & Pull Request Guidelines
Follow the existing Conventional Commit-lite prefixes seen in the history: `feat`, `fix`, `docs`, `style`, `refactor`, `chore`. Use concise, present-tense subjects (<72 chars). Every PR should include: summary of changes, testing evidence (`pytest`, manual UI steps), linked issue or TODO, and screenshots/GIFs for UI updates. Keep PRs scoped so reviewers can run `docker-compose up` and verify without extra setup.

## Security & Configuration Tips
Never commit `.env` files; rely on `DATABASE_URL`, `FRONTEND_ORIGINS`, `HOST`, and `PORT` env vars. SQLite files under `data/` contain gameplay progress—scrub personal entries before sharing. When adding third-party assets to `frontend/generator/`, confirm license compatibility and document attribution in `SPEC.md`.
