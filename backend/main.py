from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from pydantic import BaseModel

dataBase_url = ""
engine = create_engine(dataBase_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI()

origins = [] # netlify 주소

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"],
)

class User(Base):
  __tablename__ = "users"

  id = Column(Integer, primary_key=True, index=True)
  username = Column(String(50), unique=True, index=True, nullable=False)
  password = Column(String(100), nullable=False)

Base.metadata.create_all(bind=engine)

class UserCreate(BaseModel):
  username: str
  password: str

class UserLogin(BaseModel):
  username: str
  password: str

def get_db():
  db = SessionLocal()
  try:
    yield db
  finally:
    db.close()

@app.post("/login")
async def login(user: UserLogin, db: Session = Depends(get_db)):
  db_user = db.query(User).filter(User.username == user.username).first()
  if not db_user:
    return {"success": False, "message": "User not found"}
  if db_user.password != user.password:
    return {"success": False, "message": "Wrong password"}
  return {"success": True, "user_id": db_user.id}

@app.post("/createuser")
async def create_user(user: UserCreate, db: Session = Depends(get_db)):
  db_user = User(username = user.username, password = user.password)
  db.add(db_user)
  db.commit()
  db.refresh(db_user)
  return {"success": True, "user_id": db_user.id}
