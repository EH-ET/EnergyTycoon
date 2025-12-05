from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

DATA_SCALE = 1000
DATA_LIMIT = 1_000_000


@dataclass
class BigValue:
  data: int
  high: int


def normalize(value: Optional[BigValue]) -> BigValue:
  if not value:
    return BigValue(0, 0)
  data = int(value.data or 0)
  high = int(value.high or 0)
  
  if data == 0:
      return BigValue(0, 0)
  
  # data가 음수일 경우 부호 처리
  sign = 1
  if data < 0:
      sign = -1
      data = -data

  if data < DATA_LIMIT:
      return BigValue(data * sign, high)

  # 대수적 방법으로 오버헤드 없이 high 계산
  import math
  # data의 자릿수 근사: log10
  try:
      exponent_diff = int(math.log10(data)) - 5 
  except ValueError:
       # data가 0 이하인 경우 등 안전장치
       exponent_diff = 0

  if exponent_diff > 0:
      high += exponent_diff
      data //= (10 ** exponent_diff)
      
  while data >= DATA_LIMIT:
      data //= 10
      high += 1
      
  return BigValue(data * sign, high)


def from_plain(amount: int) -> BigValue:
  safe = max(0, int(amount or 0))
  return normalize(BigValue(safe * DATA_SCALE, 0))


def to_plain(value: Optional[BigValue]) -> int:
  if not value:
    return 0
  value = normalize(value)
  data = value.data
  if data <= 0:
    return 0
  if value.high <= 0:
    return data // DATA_SCALE
  return (data * (10 ** value.high)) // DATA_SCALE


def add_values(left: BigValue, right: BigValue) -> BigValue:
  return from_plain(to_plain(left) + to_plain(right))


def add_plain(value: BigValue, plain: int) -> BigValue:
  return from_plain(to_plain(value) + max(0, plain))


def subtract_values(left: BigValue, right: BigValue) -> BigValue:
  result = to_plain(left) - to_plain(right)
  return from_plain(max(0, result))


def subtract_plain(value: BigValue, plain: int) -> BigValue:
  return from_plain(max(0, to_plain(value) - max(0, plain)))


def compare(left: BigValue, right: BigValue) -> int:
  l = normalize(left)
  r = normalize(right)
  if l.high != r.high:
    return 1 if l.high > r.high else -1
  if l.data != r.data:
    return 1 if l.data > r.data else -1
  return 0


def compare_plain(value: BigValue, plain: int) -> int:
  return compare(value, from_plain(plain))


def to_payload(value: BigValue) -> dict[str, int]:
  normalized = normalize(value)
  return {"data": normalized.data, "high": normalized.high}


def from_payload(data: Optional[int], high: Optional[int], fallback_plain: Optional[int] = None) -> Optional[BigValue]:
  if data is None and high is None:
    if fallback_plain is None:
      return None
    return from_plain(fallback_plain)
  return normalize(BigValue(int(data or 0), int(high or 0)))


def get_user_money_value(user) -> BigValue:
  return normalize(BigValue(getattr(user, "money_data", 0) or 0, getattr(user, "money_high", 0) or 0))


def get_user_energy_value(user) -> BigValue:
  return normalize(BigValue(getattr(user, "energy_data", 0) or 0, getattr(user, "energy_high", 0) or 0))


def set_user_money_value(user, value: BigValue):
  normalized = normalize(value)
  user.money_data = normalized.data
  user.money_high = normalized.high


def set_user_energy_value(user, value: BigValue):
  normalized = normalize(value)
  user.energy_data = normalized.data
  user.energy_high = normalized.high


def get_user_sold_energy_value(user) -> BigValue:
  return normalize(BigValue(getattr(user, "sold_energy_data", 0) or 0, getattr(user, "sold_energy_high", 0) or 0))


def set_user_sold_energy_value(user, value: BigValue):
  normalized = normalize(value)
  user.sold_energy_data = normalized.data
  user.sold_energy_high = normalized.high


def ensure_user_big_values(user, db=None):
  changed = False
  if getattr(user, "money_data", None) is None or getattr(user, "money_high", None) is None:
    user.money_data = 0
    user.money_high = 0
    changed = True
  
  if getattr(user, "energy_data", None) is None or getattr(user, "energy_high", None) is None:
    user.energy_data = 0
    user.energy_high = 0
    changed = True
    
  if getattr(user, "sold_energy_data", None) is None or getattr(user, "sold_energy_high", None) is None:
    user.sold_energy_data = 0
    user.sold_energy_high = 0
    changed = True
    
  if changed and db is not None:
    db.add(user)
    db.commit()
