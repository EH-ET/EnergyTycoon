import os
import uuid
import hashlib
import time
from typing import Optional, List
import pathlib
import sys

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session

# --- DB 설정 (디렉터리 자동 생성 보장)
def _ensure_sqlite_dir(database_url: str):
    """
    sqlite:///relative/path.db or sqlite:////absolute/path.db
    에서 파일 경로 부분을 추출하여 부모 디렉터리를 생성하고 쓰기 권한을 시도합니다.
    """
    if not database_url:
        return
    if not database_url.startswith("sqlite"):
        return
    # sqlite:///./data/energy_tycoon.db  또는 sqlite:////absolute/path.db
    path_part = database_url.split("sqlite:///", 1)[-1]
    # 만약 앞에 //로 시작하면 절대경로 처리 (sqlite:////abs/path)
    if path_part.startswith("/"):
        db_path = "/" + path_part.lstrip("/")
    else:
        db_path = os.path.join(os.getcwd(), path_part)
    parent = os.path.dirname(db_path) or os.getcwd()
    try:
        os.makedirs(parent, exist_ok=True)
        try:
            os.chmod(parent, 0o777)
        except Exception:
            # 권한 변경 실패해도 진행
            pass
    except Exception as e:
        print(f"경고: 데이터베이스 디렉터리 생성 실패: {parent} -> {e}", file=sys.stderr)

# 환경 변수 읽기
dataBase_url = os.getenv("DATABASE_URL", "sqlite:///./data/energy_tycoon.db")
# 디렉터리 존재 보장
_ensure_sqlite_dir(dataBase_url)

# 이제 엔진 생성
engine = create_engine(dataBase_url, connect_args={"check_same_thread": False} if dataBase_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- 앱과 CORS
app = FastAPI()

_origins_env = os.getenv("FRONTEND_ORIGINS")
if not _origins_env or _origins_env.strip() == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in _origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 유틸
def generate_uuid() -> str:
    return str(uuid.uuid4())

def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

# --- 상수
CASCADE_OPTION = "all, delete-orphan"
ERR_ID_MISMATCH = "아이디가 일치하지 않습니다."
UPGRADE_CONFIG = {
    "production": {"field": "production_bonus", "base_cost": 100, "price_growth": 1.25},
    "heat_reduction": {"field": "heat_reduction", "base_cost": 100, "price_growth": 1.15},
    "tolerance": {"field": "tolerance_bonus", "base_cost": 100, "price_growth": 1.2},
    "max_generators": {"field": "max_generators_bonus", "base_cost": 150, "price_growth": 1.3},
}

# --- 모델
class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    energy = Column(Integer, default=0, nullable=False)
    money = Column(Integer, default=10, nullable=False)
    production_bonus = Column(Integer, default=0, nullable=False)
    heat_reduction = Column(Integer, default=0, nullable=False)
    tolerance_bonus = Column(Integer, default=0, nullable=False)
    max_generators_bonus = Column(Integer, default=0, nullable=False)

    generators = relationship("Generator", back_populates="owner", cascade=CASCADE_OPTION)
    map_progresses = relationship("MapProgress", back_populates="user", cascade="all, delete-orphan")


class GeneratorType(Base):
    __tablename__ = "generator_types"

    generator_type_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=False)
    cost = Column(Integer, nullable=False)

    generators = relationship("Generator", back_populates="generator_type")


class Generator(Base):
    __tablename__ = "generators"

    generator_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    generator_type_id = Column(String, ForeignKey("generator_types.generator_type_id"), nullable=False)
    owner_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    level = Column(Integer, default=1, nullable=False)
    x_position = Column(Integer, nullable=False)
    world_position = Column(Integer, nullable=False)
    isdeveloping = Column(Boolean, default=False, nullable=False)
    heat = Column(Integer, default=0, nullable=False)

    owner = relationship("User", back_populates="generators")
    generator_type = relationship("GeneratorType")
    map_progresses = relationship("MapProgress", back_populates="generator", cascade=CASCADE_OPTION)


class MapProgress(Base):
    __tablename__ = "map_progress"

    map_progress_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), nullable=False)
    generator_id = Column(String, ForeignKey("generators.generator_id"), nullable=False)

    user = relationship("User", back_populates="map_progresses")
    generator = relationship("Generator", back_populates="map_progresses")

    __table_args__ = (UniqueConstraint('user_id', 'generator_id', name='_user_generator_uc'),)


# 테이블 생성
Base.metadata.create_all(bind=engine)

def _ensure_user_upgrade_columns():
    # SQLite에서는 기존 DB에 컬럼이 없을 수 있으므로, 부족한 컬럼을 추가
    needed = [
        ("production_bonus", "INTEGER NOT NULL DEFAULT 0"),
        ("heat_reduction", "INTEGER NOT NULL DEFAULT 0"),
        ("tolerance_bonus", "INTEGER NOT NULL DEFAULT 0"),
        ("max_generators_bonus", "INTEGER NOT NULL DEFAULT 0"),
        ("money", "INTEGER NOT NULL DEFAULT 10"),
    ]
    with engine.begin() as conn:
        existing = set()
        rows = conn.exec_driver_sql("PRAGMA table_info('users')").fetchall()
        for r in rows:
            # PRAGMA table_info columns: cid, name, type, notnull, dflt_value, pk
            existing.add(r[1])
        for col_name, col_def in needed:
            if col_name not in existing:
                conn.exec_driver_sql(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")

_ensure_user_upgrade_columns()

# --- Pydantic 스키마
class UserCreate(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: str
    username: str
    energy: int
    money: int
    production_bonus: int
    heat_reduction: int
    tolerance_bonus: int
    max_generators_bonus: int

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    username: str
    password: str


class ExchangeIn(BaseModel):
    user_id: str
    amount: int


class ProgressSaveIn(BaseModel):
    user_id: str
    generator_type_id: str
    x_position: int
    world_position: int


# --- 간단한 토큰 스토어
_token_store = {}

# --- DB 의존성
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- 초기 데이터
def create_default_generator_types(db: Session):
    if db.query(GeneratorType).count() == 0:
        default_types = [
            {"name": "광합성", "description": "태양을 이용해 에너지를 생산합니다. 낮에만 작동합니다.", "cost": 5},
            {"name": "풍력", "description": "바람을 이용해 에너지를 생산합니다.", "cost": 20},
            {"name": "지열", "description": "지열을 이용해 안정적으로 전력을 생산합니다.", "cost": 50},
        ]
        for t in default_types:
            db.add(GeneratorType(name=t["name"], description=t["description"], cost=t["cost"]))
        db.commit()


def get_upgrade_meta(key: str):
    meta = UPGRADE_CONFIG.get(key)
    if not meta:
        raise HTTPException(status_code=404, detail="업그레이드 구성이 없습니다.")
    return meta


def calculate_upgrade_cost(user: User, key: str) -> int:
    meta = get_upgrade_meta(key)
    current_level = getattr(user, meta["field"], 0) + 1  # 기본 1레벨
    return int(meta["base_cost"] * (meta["price_growth"] ** current_level))


def apply_upgrade(user: User, db: Session, key: str) -> User:
    meta = get_upgrade_meta(key)
    cost = calculate_upgrade_cost(user, key)
    if user.money < cost:
        raise HTTPException(status_code=400, detail="돈이 부족합니다.")
    user.money -= cost
    setattr(user, meta["field"], getattr(user, meta["field"], 0) + 1)
    db.commit()
    db.refresh(user)
    return user

with SessionLocal() as db:
    create_default_generator_types(db)

# --- 인증 헬퍼
def get_token_from_header(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return authorization

def require_user(token: str, db: Session) -> User:
    data = _token_store.get(token)
    if not data or data.get("expiry", 0) < time.time():
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
    user = db.query(User).filter_by(user_id=data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return user

def get_user_and_db(token: str = Depends(get_token_from_header), db: Session = Depends(get_db)):
    user = require_user(token, db)
    return user, db, token

# --- API 엔드포인트
@app.post("/signup", response_model=UserOut)
async def signup(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(status_code=400, detail="username already exists")
    u = User(username=payload.username, password=hash_pw(payload.password), energy=0, money=10)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@app.post("/login")
async def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload.username).first()
    if not user or user.password != hash_pw(payload.password):
        raise HTTPException(status_code=401, detail="유효하지 않는 입력")
    token = generate_uuid()
    _token_store[token] = {"user_id": user.user_id, "expiry": time.time() + 86400}
    return {"access_token": token, "user": UserOut.model_validate(user)}

@app.post("/logout")
async def logout(token: str = Depends(get_token_from_header)):
    if token in _token_store:
        del _token_store[token]
    return {"ok": True}

@app.post("/refresh")
async def refresh(token: str = Depends(get_token_from_header)):
    data = _token_store.get(token)
    if not data:
        raise HTTPException(status_code=401, detail="유효하지 않는 토큰")
    data["expiry"] = time.time() + 86400
    return {"access_token": token}

@app.post("/change/energy2money")
async def energy2money(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="유효하지 않는 금액입니다.")
    if user.energy < payload.amount:
        raise HTTPException(status_code=400, detail="충분하지 않는 에너지입니다.")
    user.energy -= payload.amount
    user.money += payload.amount
    db.commit()
    return {"energy": user.energy, "money": user.money}

@app.post("/change/money2energy")
async def money2energy(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="유효하지 않는 금액입니다.")
    if user.money < payload.amount:
        raise HTTPException(status_code=400, detail="충분하지 않는 금액입니다.")
    user.money -= payload.amount
    user.energy += payload.amount
    db.commit()
    return {"energy": user.energy, "money": user.money}

@app.get("/rank")
async def rank(db: Session = Depends(get_db)):
    u = db.query(User).order_by(User.money.desc()).first()
    if not u:
        return {"user": None}
    return {"user": UserOut.model_validate(u)}

@app.get("/ranks")
async def ranks(limit: int = 10, db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.money.desc()).limit(limit).all()
    return {"list": [UserOut.model_validate(u) for u in users]}

@app.get("/progress")
async def load_progress(user_id: str, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    gens = db.query(Generator).filter_by(owner_id=user.user_id).all()
    out = []
    for g in gens:
        out.append({
            "generator_id": g.generator_id,
            "type": g.generator_type.name if g.generator_type else None,
            "generator_type_id": g.generator_type_id,
            "x_position": g.x_position,
            "world_position": g.world_position,
            "level": g.level,
        })
    return {"generators": out}

@app.post("/progress")
async def save_progress(payload: ProgressSaveIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    gt = db.query(GeneratorType).filter_by(generator_type_id=payload.generator_type_id).first()
    if not gt:
        raise HTTPException(status_code=404, detail="발전기가 존재하지 않습니다.")
    if user.money < gt.cost:
        raise HTTPException(status_code=400, detail="돈이 부족합니다.")
    g = Generator(generator_type_id=gt.generator_type_id, owner_id=user.user_id, x_position=payload.x_position, world_position=payload.world_position)
    db.add(g)
    db.commit()
    db.refresh(g)
    try:
        mp = MapProgress(user_id=user.user_id, generator_id=g.generator_id)
        db.add(mp)
        db.commit()
    except Exception:
        # 중복 등 예외 무시
        db.rollback()
    user.money -= gt.cost
    db.commit()
    return {
        "ok": True,
        "generator": {
            "generator_id": g.generator_id,
            "generator_type_id": g.generator_type_id,
            "type": gt.name,
            "x_position": g.x_position,
            "world_position": g.world_position,
            "level": g.level,
        },
        "user": UserOut.model_validate(user)
    }

@app.get("/generator_types")
async def generator_types(db: Session = Depends(get_db)):
    types = db.query(GeneratorType).all()
    return {"types": [{"id": t.generator_type_id, "name": t.name, "cost": t.cost, "description": t.description} for t in types]}

@app.post("/upgrade/production")
async def upgrade_production(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "production")
    return UserOut.model_validate(upgraded_user)

@app.post("/upgrade/heat_reduction")
async def upgrade_heat_reduction(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "heat_reduction")
    return UserOut.model_validate(upgraded_user)

@app.post("/upgrade/tolerance")
async def upgrade_tolerance(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "tolerance")
    return UserOut.model_validate(upgraded_user)

@app.post("/upgrade/max_generators")
async def upgrade_max_generators(auth=Depends(get_user_and_db)):
    user, db, _ = auth
    upgraded_user = apply_upgrade(user, db, "max_generators")
    return UserOut.model_validate(upgraded_user)

# --- 서버 실행
if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host=host, port=port)
