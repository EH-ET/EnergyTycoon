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
    rebirth_chain_upgrade: int = 0
    upgrade_batch_upgrade: int = 0
    rebirth_start_money_upgrade: int = 0
    tutorial: int
    supercoin: int = 0
    build_speed_reduction: int = 0
    energy_multiplier: int = 0
    exchange_rate_multiplier: int = 0
    sold_energy_data: int = 0
    sold_energy_high: int = 0

    model_config = {"from_attributes": True}


class LoginIn(BaseModel):
    username: str
    password: str


class ExchangeIn(BaseModel):
    user_id: Optional[str] = None
    amount_data: int
    amount_high: int


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


class RebirthRequest(BaseModel):
    count: int = Field(1, ge=1)


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
    production_data: Optional[int] = None
    production_high: Optional[int] = None
    play_time_ms: Optional[int] = Field(default=None, ge=0)
    supercoin: Optional[int] = Field(default=None, ge=0)
    generators: Optional[List[GeneratorStateUpdate]] = None


class GeneratorUpgradeRequest(BaseModel):
    upgrade: str
    amount: int = Field(1, ge=1)


class DeleteAccountIn(BaseModel):
    password: str


class InquiryCreate(BaseModel):
    type: str
    content: str


class InquiryOut(BaseModel):
    inquiry_id: str
    user_id: str
    username: Optional[str] = None  # To display username in admin page
    type: str
    content: str
    created_at: int

    model_config = {"from_attributes": True}
