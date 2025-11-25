import os
import sys
import pathlib
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request, HTTPException, Header

# Ensure package imports work even when run as a script (python backend/main.py)
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend import models  # noqa: F401 - ensure models are registered
from backend.database import Base, SessionLocal, engine
from backend.init_db import ensure_user_upgrade_columns, ensure_big_value_columns, ensure_generator_columns, ensure_map_progress_columns, sync_generator_types
from backend.routes import auth_routes, change_routes, generator_routes, progress_routes, rank_routes, upgrade_routes
from backend.auth_utils import CSRF_COOKIE_NAME, CSRF_HEADER_NAME

app = FastAPI()

_origins_env = os.getenv("FRONTEND_ORIGINS")
if _origins_env:
    if _origins_env.strip() == "*":
        origins = [
            "http://localhost:4173",
            "http://127.0.0.1:4173",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ]
    else:
        origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
else:
    origins = [
        "http://localhost:4173",
        "http://127.0.0.1:4173",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Origin check middleware for state-changing requests (basic CSRF guard)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Authentication endpoints that can bypass CSRF token requirement
AUTH_ENDPOINTS = {"/login", "/signup"}


@app.middleware("http")
async def enforce_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")

    def _allow(url: str | None) -> str | None:
        if not url:
            return None
        parsed = urlparse(url)
        candidate = f"{parsed.scheme}://{parsed.netloc}"
        return candidate if candidate in origins else None

    allowed_origin = _allow(origin) or _allow(referer)

    # Preflight은 통과시킴
    if request.method == "OPTIONS":
        response = await call_next(request)
        if allowed_origin:
            response.headers["Access-Control-Allow-Origin"] = allowed_origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
        return response

    if request.method not in SAFE_METHODS:
        if not allowed_origin:
            return JSONResponse(
                status_code=403,
                content={"detail": "Origin not allowed"},
                headers={"Access-Control-Allow-Origin": origin or "*"}
                if origin
                else None,
            )

        # Skip CSRF check for authentication endpoints where token is set
        if request.url.path not in AUTH_ENDPOINTS:
            csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
            csrf_header = request.headers.get(CSRF_HEADER_NAME)
            if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF token missing or invalid"},
                    headers={"Access-Control-Allow-Origin": allowed_origin, "Access-Control-Allow-Credentials": "true"},
                )

    response = await call_next(request)
    if allowed_origin:
        response.headers["Access-Control-Allow-Origin"] = allowed_origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    return response

# DB setup and seeding
Base.metadata.create_all(bind=engine)
ensure_user_upgrade_columns()
ensure_big_value_columns()
ensure_generator_columns()
ensure_map_progress_columns()
with SessionLocal() as db:
    # 기존 DB에 새로 추가된 발전기 타입이 누락되지 않도록 동기화
    sync_generator_types(db)

# Routers
app.include_router(auth_routes.router)
app.include_router(change_routes.router)
app.include_router(progress_routes.router)
app.include_router(generator_routes.router)
app.include_router(rank_routes.router)
app.include_router(upgrade_routes.router)


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host=host, port=port)
