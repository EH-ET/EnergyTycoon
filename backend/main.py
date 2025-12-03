import os
import sys
import pathlib
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request, HTTPException, Header
from fastapi.responses import JSONResponse

# Ensure package imports work even when run as a script (python backend/main.py)
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend import models  # noqa: F401 - ensure models are registered
from backend.database import Base, SessionLocal, engine
from backend.init_db import ensure_user_upgrade_columns, ensure_big_value_columns, ensure_generator_columns, ensure_map_progress_columns, ensure_play_time_column, sync_generator_types, ensure_generator_type_columns
from backend.routes import auth_routes, change_routes, generator_routes, progress_routes, rank_routes, upgrade_routes, rebirth_routes, tutorial_routes
from backend.auth_utils import CSRF_COOKIE_NAME, CSRF_HEADER_NAME

app = FastAPI()

_deploy_frontend = os.getenv("DEPLOY_FRONTEND_URL", "https://energytycoon.netlify.app").rstrip("/")
# Allow preview/stage Netlify domains by default (overridable via FRONTEND_ORIGIN_REGEX)
_default_origin_regex = r"^https://.*\\.netlify\\.app$"
_local_origins = [
    # "http://localhost:4173",
    # "http://127.0.0.1:4173",
    # "http://localhost:5173",
    # "http://127.0.0.1:5173",
    # "http://localhost:5500",
    # "http://127.0.0.1:5500",
    # "http://localhost:8000",
    # "http://127.0.0.1:8000",
    _deploy_frontend,
]

def _dedup(seq):
    seen = set()
    out = []
    for item in seq:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out

_default_origins = _dedup(_local_origins)

_origins_env = os.getenv("FRONTEND_ORIGINS")
if _origins_env:
    if _origins_env.strip() == "*":
        origins = _default_origins
    else:
        parsed = [o.strip() for o in _origins_env.split(",") if o.strip()]
        origins = _dedup(_default_origins + parsed)
else:
    origins = _default_origins

_origin_regex = None
_origin_regex_env = os.getenv("FRONTEND_ORIGIN_REGEX")
import re

if _origin_regex_env:
    try:
        _origin_regex = re.compile(_origin_regex_env)
    except re.error:
        _origin_regex = None
if _origin_regex is None:
    try:
        _origin_regex = re.compile(_default_origin_regex)
    except re.error:
        _origin_regex = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=_origin_regex.pattern if _origin_regex else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Origin check middleware for state-changing requests (basic CSRF guard)
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
# Authentication endpoints that can bypass CSRF token requirement
AUTH_ENDPOINTS = {"/login", "/signup"}


def _is_origin_allowed(origin: str) -> bool:
    """Check if origin is in the allowed list or matches the regex pattern."""
    if not origin:
        return False
    if origin in origins:
        return True
    if _origin_regex and _origin_regex.match(origin):
        return True
    return False


@app.middleware("http")
async def enforce_origin(request: Request, call_next):
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    
    # Extract origin from referer if origin header is not present
    referer_origin = None
    if referer:
        parsed = urlparse(referer)
        referer_origin = f"{parsed.scheme}://{parsed.netloc}"
    
    # Determine the actual origin to validate
    request_origin = origin or referer_origin
    
    # Debug logging
    import sys
    # print(f"🔍 CORS Debug - Origin: {origin}, Referer: {referer}, Request Origin: {request_origin}", file=sys.stderr)
    
    # Validate origin against whitelist for CSRF protection
    # Note: We don't set CORS headers here anymore, CORSMiddleware handles that.
    # We just check if the origin is allowed for security purposes.
    is_allowed = False
    if request_origin and _is_origin_allowed(request_origin):
        is_allowed = True
    
    # CSRF protection for state-changing requests
    if request.method not in SAFE_METHODS:
        # Skip CSRF check for authentication endpoints
        if request.url.path not in AUTH_ENDPOINTS:
            # If origin is not allowed, block state-changing requests
            if not is_allowed:
                 return JSONResponse(
                    status_code=403,
                    content={"detail": "Origin not allowed for state-changing request"}
                )

            csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
            csrf_header = request.headers.get(CSRF_HEADER_NAME)
            
            # Require at least one of cookie or header to be present
            if not csrf_cookie and not csrf_header:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF token missing"}
                )
            
            # If both are present, they should match
            if csrf_cookie and csrf_header and csrf_cookie != csrf_header:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF token mismatch"}
                )

    response = await call_next(request)
    
    # We rely on CORSMiddleware for Access-Control headers
    # But we ensure CSRF header is exposed
    if is_allowed:
        response.headers.setdefault("Access-Control-Expose-Headers", CSRF_HEADER_NAME)
        
    return response

@app.on_event("startup")
async def startup_event():
    # DB setup and seeding (moved to startup to avoid blocking import/health checks)
    Base.metadata.create_all(bind=engine)
    ensure_user_upgrade_columns()
    ensure_big_value_columns()
    ensure_generator_columns()
    ensure_map_progress_columns()
    ensure_generator_type_columns()
    ensure_play_time_column()
    with SessionLocal() as db:
        sync_generator_types(db)


# Routers
app.include_router(auth_routes.router)
app.include_router(change_routes.router)
app.include_router(progress_routes.router)
app.include_router(generator_routes.router)
app.include_router(rank_routes.router)
app.include_router(upgrade_routes.router)
app.include_router(rebirth_routes.router)
app.include_router(tutorial_routes.router, prefix="/api/tutorial", tags=["tutorial"])


@app.get("/")
def root():
    return {"status": "ok"}


@app.head("/")
def root_head():
    return JSONResponse(status_code=200, content=None)
