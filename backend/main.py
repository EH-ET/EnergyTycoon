import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import sessionmaker, declarative_base, relationship, Session
from pydantic import BaseModel
import uuid
import hashlib
import time

# Database URL from env, default to sqlite file for local development
dataBase_url = os.getenv("DATABASE_URL", "sqlite:///./energy_tycoon.db")
engine = create_engine(dataBase_url, connect_args={"check_same_thread": False} if dataBase_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

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


def generate_uuid():
    return str(uuid.uuid4())

# reuse cascade option string to avoid duplication warnings
CASCADE_OPTION = "all, delete-orphan"

ERR_ID_MISMATCH = "아이디가 일치하지 않습니다."


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


# --- Pydantic schemas
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


class SaveProgressIn(BaseModel):
    user_id: str
    generator_type_id: str
    x_position: int
    world_position: int


# --- simple in-memory token store (replace with real JWT later)
_token_store = {}


def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_default_generator_types(db: Session):
    existing = db.query(GeneratorType).count()
    if existing == 0:
        types = [
            {"name": "Solar Panel", "description": "Produces small energy per second.", "cost": 10},
            {"name": "Wind Turbine", "description": "Medium production.", "cost": 50},
            {"name": "Nuclear Plant", "description": "High production.", "cost": 500},
        ]
        for t in types:
            gt = GeneratorType(name=t["name"], description=t["description"], cost=t["cost"])
            db.add(gt)
        db.commit()


create_default_generator_types(next(get_db()))


@app.post("/signup", response_model=UserOut)
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # simple username uniqueness
    if db.query(User).filter_by(username=user.username).first():
        raise HTTPException(status_code=400, detail="username already exists")
    u = User(username=user.username, password=hash_pw(user.password), energy=0, money=0)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@app.post("/login")
async def login(credentials: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=credentials.username).first()
    if not user or user.password != hash_pw(credentials.password):
        raise HTTPException(status_code=401, detail="유효하지 않는 입력")
    token = str(uuid.uuid4())
    # token expiry 1 day
    _token_store[token] = {"user_id": user.user_id, "expiry": time.time() + 86400}
    return {"access_token": token, "user": UserOut.model_validate(user)}


@app.post("/logout")
async def logout(token: str):
    if token in _token_store:
        del _token_store[token]
    return {"ok": True}


@app.post("/refresh")
async def refresh_token(token: str):
    data = _token_store.get(token)
    if not data:
        raise HTTPException(status_code=401, detail="유효하지 않는 토큰")
    # extend
    data["expiry"] = time.time() + 86400
    return {"access_token": token}


def require_user(token: str, db: Session) -> User:
    data = _token_store.get(token)
    if not data or data.get("expiry", 0) < time.time():
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
    user = db.query(User).filter_by(user_id=data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return user


def get_token_from_header(authorization: Optional[str] = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    if authorization.lower().startswith('bearer '):
        return authorization.split(' ', 1)[1].strip()
    return authorization


def get_user_and_db(token: str = Depends(get_token_from_header), db: Session = Depends(get_db)):
    user = require_user(token, db)
    return user, db, token


@app.post("/change/energy2money")
async def change_energy_to_money(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="유효하지 않는 금액입니다.")
    if user.energy < payload.amount:
        raise HTTPException(status_code=400, detail="충분하지 않는 에너지입니다.")
    # 1 energy = 1 money
    user.energy -= payload.amount
    user.money += payload.amount
    db.commit()
    return {"energy": user.energy, "money": user.money}


@app.post("/change/money2energy")
async def change_money_to_energy(payload: ExchangeIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="유효하지 않는 에너지입니다.")
    if user.money < payload.amount:
        raise HTTPException(status_code=400, detail="충분하지 않는 금액입니다.")
    user.money -= payload.amount
    user.energy += payload.amount
    db.commit()
    return {"energy": user.energy, "money": user.money}


@app.get("/rank")
async def get_rank(db: Session = Depends(get_db)):
    # return top user by money
    u = db.query(User).order_by(User.money.desc()).first()
    if not u:
        return {"rank": []}
    return {"user": UserOut.model_validate(u)}


@app.get("/rank/list")
async def get_rank_list(limit: int = 10, db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.money.desc()).limit(limit).all()
    return {"list": [UserOut.model_validate(u) for u in users]}


@app.post("/saveprogress")
async def save_progress(payload: SaveProgressIn, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != payload.user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    gt = db.query(GeneratorType).filter_by(generator_type_id=payload.generator_type_id).first()
    if not gt:
        raise HTTPException(status_code=404, detail="발전기가 존재하지 않습니다.")
    if user.money < gt.cost:
        raise HTTPException(status_code=400, detail="돈이 부족합니다.")
    # create generator and mapprogress
    g = Generator(generator_type_id=gt.generator_type_id, owner_id=user.user_id, x_position=payload.x_position, world_position=payload.world_position)
    db.add(g)
    db.commit()
    db.refresh(g)
    mp = MapProgress(user_id=user.user_id, generator_id=g.generator_id)
    db.add(mp)
    # deduct cost
    user.money -= gt.cost
    db.commit()
    return {"ok": True, "generator_id": g.generator_id}


@app.get("/loadprogress")
async def load_progress(user_id: str, auth=Depends(get_user_and_db)):
    user, db, _ = auth
    if user.user_id != user_id:
        raise HTTPException(status_code=403, detail=ERR_ID_MISMATCH)
    # load user's generators with type info
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


@app.get('/generator_types')
async def list_generator_types(db: Session = Depends(get_db)):
    types = db.query(GeneratorType).all()
    return {"types": [{"id": t.generator_type_id, "name": t.name, "cost": t.cost, "description": t.description} for t in types]}