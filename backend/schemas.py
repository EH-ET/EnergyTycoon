from typing import Optional, List

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: str
    username: str
    energy_data: int
    energy_high: int
    money_data: int
    money_high: int
    production_bonus: int
    heat_reduction: int
    tolerance_bonus: int
    max_generators_bonus: int
    demand_bonus: int
    play_time_ms: int
    rebirth_count: int
    tutorial: int

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    username: str
    password: str


class ExchangeIn(BaseModel):
    user_id: Optional[str] = None
    amount: int


class ProgressSaveIn(BaseModel):
    user_id: str
    generator_type_id: str
    x_position: int
    world_position: int
    energy_data: Optional[int] = None
    energy_high: Optional[int] = None


class UpgradeRequest(BaseModel):
    amount: int = Field(1, ge=1)
    energy: Optional[int] = Field(default=None, ge=0)


class GeneratorStateUpdate(BaseModel):
    generator_id: Optional[str] = None
    running: Optional[bool] = None
    heat: Optional[int] = Field(default=None, ge=0)
    explode: Optional[bool] = False


class ProgressAutoSaveIn(BaseModel):
    energy_data: Optional[int] = None
    energy_high: Optional[int] = None
    money_data: Optional[int] = None
    money_high: Optional[int] = None
    play_time_ms: Optional[int] = Field(default=None, ge=0)
    generators: Optional[List[GeneratorStateUpdate]] = None


class GeneratorUpgradeRequest(BaseModel):
    upgrade: str
    amount: int = Field(1, ge=1)


class DeleteAccountIn(BaseModel):
    password: str


