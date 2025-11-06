import os
import uuid
import hashlib
import time
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session

# --- DB 설정
dataBase_url = os.getenv("DATABASE_URL", "sqlite:///./energy_tycoon.db")
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

# --- 모델 (table.txt 기준)
class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, default=generate_uuid, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    energy = Column(Integer, default=0, nullable=False)
    money = Column(Integer, default=0, nullable=False)

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


Base.metadata.create_all(bind=engine)

# --- Pydantic 스키마
class UserCreate(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: str
    username: str
    energy: int
    money: int

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


# --- 간단한 토큰 스토어 (실환경에선 JWT 등으로 대체)
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

# --- API 엔드포인트 (api.txt 기준 + 프론트엔드 필요 엔드포인트)
@app.post("/signup", response_model=UserOut)
async def signup(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter_by(username=payload.username).first():
        raise HTTPException(status_code=400, detail="username already exists")
    u = User(username=payload.username, password=hash_pw(payload.password), energy=0, money=0)
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
    # 환율 1:1 기본
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
async def ranks(limit: int = 100, db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.money.desc()).limit(limit).all()
    return {"list": [UserOut.model_validate(u) for u in users]}

# /progress : GET -> 불러오기, POST -> 저장
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
    # map progress 등록 (중복 방지 위해 try/except)
    try:
        mp = MapProgress(user_id=user.user_id, generator_id=g.generator_id)
        db.add(mp)
    except Exception:
        pass
    user.money -= gt.cost
    db.commit()
    return {"ok": True, "generator_id": g.generator_id}

@app.get("/generator_types")
async def generator_types(db: Session = Depends(get_db)):
    types = db.query(GeneratorType).all()
    return {"types": [{"id": t.generator_type_id, "name": t.name, "cost": t.cost, "description": t.description} for t in types]}