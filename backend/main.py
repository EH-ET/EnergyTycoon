import os
import sys
import pathlib

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure package imports work even when run as a script (python backend/main.py)
ROOT_DIR = pathlib.Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))

from backend import models  # noqa: F401 - ensure models are registered
from backend.database import Base, SessionLocal, engine
from backend.init_db import create_default_generator_types, ensure_user_upgrade_columns
from backend.routes import auth_routes, change_routes, generator_routes, progress_routes, rank_routes, upgrade_routes

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

# DB setup and seeding
Base.metadata.create_all(bind=engine)
ensure_user_upgrade_columns()
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
