from typing import Optional, List

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    user_id: str
    username: str
    energy_data: Optional[int] = 0
    energy_high: Optional[int] = 0
    money_data: Optional[int] = 0
    money_high: Optional[int] = 0
    electronic_sparkle_data: Optional[int] = 0
    electronic_sparkle_high: Optional[int] = 0
    production_bonus: Optional[int] = 0
    heat_reduction: Optional[int] = 0
    tolerance_bonus: Optional[int] = 0
    max_generators_bonus: Optional[int] = 0
    demand_bonus: Optional[int] = 0
    play_time_ms: Optional[int] = 0
    rebirth_count: Optional[int] = 0
    rebirth_chain_upgrade: Optional[int] = 0
    upgrade_batch_upgrade: Optional[int] = 0
    rebirth_start_money_upgrade: Optional[int] = 0
    sparkle_chance_upgrade: Optional[int] = 0
    sparkle_amount_upgrade: Optional[int] = 0
    sparkle_energy_multiplier_upgrade: Optional[int] = 0
    rebirth_sparkle_bonus_upgrade: Optional[int] = 0
    money_sparkle_bonus_upgrade: Optional[int] = 0
    sparkle_rebirth_chain_upgrade: Optional[int] = 0
    tutorial: Optional[int] = 0
    supercoin: Optional[int] = 0
    build_speed_reduction: Optional[int] = 0
    energy_multiplier: Optional[int] = 0
    exchange_rate_multiplier: Optional[int] = 0
    sold_energy_data: Optional[int] = 0
    sold_energy_high: Optional[int] = 0
    
    proton_data: Optional[int] = 0
    proton_high: Optional[int] = 0
    proton_gain_money_upgrade: Optional[int] = 0
    proton_gain_rebirth_upgrade: Optional[int] = 0
    proton_demand_increase_upgrade: Optional[int] = 0
    proton_energy_gain_upgrade: Optional[int] = 0
    proton_sparkle_gain_upgrade: Optional[int] = 0
    proton_gain_special_upgrade: Optional[int] = 0
    sparkle_gain_special_upgrade: Optional[int] = 0

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


class BulkUpgradeItem(BaseModel):
    endpoint: str
    amount: int = Field(1, ge=1)


class BulkUpgradeRequest(BaseModel):
    upgrades: list[BulkUpgradeItem]


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


class BulkGeneratorUpgradeItem(BaseModel):
    generator_id: str
    key: str  # 'production', 'heat_reduction', 'tolerance'
    amount: int = Field(1, ge=1)


class BulkGeneratorUpgradeRequest(BaseModel):
    upgrades: List[BulkGeneratorUpgradeItem]


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
