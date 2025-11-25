# Security TODO
- [x] Store passwords with salted bcrypt hashes and migrate legacy hashes automatically (`backend/auth_utils.py`, `backend/routes/auth_routes.py`).
- [ ] Move access/refresh tokens out of `localStorage` and into `HttpOnly`, `SameSite=strict` cookies; update login/signup flows to read tokens from cookies (`frontend/login.js`, `backend/routes/auth_routes.py`).
- [ ] Enforce HTTPS/HSTS at the edge (e.g., nginx) and reject insecure origins before serving login endpoints (`nginx`, deployment pipeline).
- [ ] Add rate limiting / exponential backoff to authentication endpoints to slow brute-force attacks (`backend/routes/auth_routes.py`).
- [ ] Replace the in-memory token store with signed JWTs or a persistent database/redis-backed store to survive restarts and support audit logging (`backend/auth_utils.py`).
- [ ] Add CSRF/Origin checks on state-changing routes so that browser-based requests require an anti-CSRF token or same-origin policy (`backend/routes/*`, `frontend/js/apiClient.js`).
- [ ] Define `FRONTEND_ORIGINS` with the GCP HTTPS domain (e.g., `https://energytycoon.example.com`) and keep local dev ports (`http://localhost:5500` etc.) only for development.
- [ ] In GCP/nginx, redirect HTTP→HTTPS and set `Strict-Transport-Security` to enforce TLS for browsers.
