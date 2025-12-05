import os
import sys
import pathlib
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

PROJECT_ROOT = pathlib.Path(__file__).resolve().parent.parent

# Load .env file
load_dotenv(PROJECT_ROOT / ".env")


def _ensure_sqlite_dir(database_url: str):
    """
    Ensure parent directory for sqlite DB exists and is writable enough.
    """
    if not database_url or not database_url.startswith("sqlite"):
        return
    path_part = database_url.split("sqlite:///", 1)[-1]
    if path_part.startswith("/"):
        db_path = "/" + path_part.lstrip("/")
    else:
        db_path = PROJECT_ROOT.joinpath(path_part).resolve()
    parent = os.path.dirname(db_path) or os.getcwd()
    try:
        os.makedirs(parent, exist_ok=True)
    except Exception as e:
        print(f"경고: 데이터베이스 디렉터리 생성 실패: {parent} -> {e}", file=sys.stderr)


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/energy_tycoon.db")
_ensure_sqlite_dir(DATABASE_URL)

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_size=20,              # Increased from default 5
    max_overflow=40,           # Increased from default 10
    pool_timeout=60,           # Increased from default 30 seconds
    pool_recycle=3600,         # Recycle connections after 1 hour
    pool_pre_ping=True,        # Check connection health before using
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
