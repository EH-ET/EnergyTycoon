from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: str
    username: str
    energy: int
    energy_data: int
    energy_high: int
    money: int
    money_data: int
    money_high: int
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
    energy_data: Optional[int] = None
    energy_high: Optional[int] = None


class UpgradeRequest(BaseModel):
    amount: int = Field(1, ge=1)
    energy: Optional[int] = Field(default=None, ge=0)


class ProgressAutoSaveIn(BaseModel):
    energy: Optional[int] = Field(default=None, ge=0)
    energy_data: Optional[int] = None
    energy_high: Optional[int] = None
    money: Optional[int] = Field(default=None, ge=0)
    money_data: Optional[int] = None
    money_high: Optional[int] = None


class GeneratorStateUpdate(BaseModel):
    running: Optional[bool] = None
    heat: Optional[int] = Field(default=None, ge=0)
    explode: Optional[bool] = False


class GeneratorUpgradeRequest(BaseModel):
    upgrade: str
    amount: int = Field(1, ge=1)


class DeleteAccountIn(BaseModel):
    password: str
