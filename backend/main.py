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
from backend.init_db import create_default_generator_types, ensure_user_upgrade_columns, ensure_big_value_columns
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


@app.middleware("http")
async def enforce_origin(request: Request, call_next):
    if request.method not in SAFE_METHODS:
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")
        def _allow(url: str | None) -> bool:
            if not url:
                return False
            parsed = urlparse(url)
            candidate = f"{parsed.scheme}://{parsed.netloc}"
            return candidate in origins

        if not (_allow(origin) or _allow(referer)):
            raise HTTPException(status_code=403, detail="Origin not allowed")
        csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(CSRF_HEADER_NAME)
        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid")
    return await call_next(request)

# DB setup and seeding
Base.metadata.create_all(bind=engine)
ensure_user_upgrade_columns()
ensure_big_value_columns()
with SessionLocal() as db:
    create_default_generator_types(db)

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
