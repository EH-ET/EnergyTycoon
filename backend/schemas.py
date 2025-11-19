from typing import Optional

from pydantic import BaseModel, Field


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
    supply_bonus: int

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    username: str
    password: str


class ExchangeIn(BaseModel):
    user_id: Optional[str] = None
    amount: int
    energy: Optional[int] = None


class ProgressSaveIn(BaseModel):
    user_id: str
    generator_type_id: str
    x_position: int
    world_position: int
    energy: Optional[int] = None


class UpgradeRequest(BaseModel):
    amount: int = Field(1, ge=1)
    energy: Optional[int] = Field(default=None, ge=0)
