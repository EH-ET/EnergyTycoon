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

  while data >= DATA_LIMIT:
      data //= 10
      high += 1
      
  return BigValue(data * sign, high)


def from_plain(amount: int) -> BigValue:
  safe = max(0, int(amount or 0))
  return normalize(BigValue(safe * DATA_SCALE, 0))


def to_plain(value: Optional[BigValue]) -> int:
  """
  Convert BigValue to plain integer.
  WARNING: Only use for display or small values (high < 10).
  For large high values, this will be extremely slow or overflow.
  """
  if not value:
    return 0
  value = normalize(value)
  data = value.data
  if data <= 0:
    return 0
  if value.high <= 0:
    return data // DATA_SCALE

  # Safety check: prevent computing huge exponents
  if value.high > 100:
    # For very large numbers, return a capped value
    # This is only for display purposes
    return 999_999_999_999_999  # Return max int for display

  return (data * (10 ** value.high)) // DATA_SCALE


def add_values(left: BigValue, right: BigValue) -> BigValue:
  """Add two BigValues using only data and high (O(1) complexity)"""
  nl = normalize(left)
  nr = normalize(right)

  # Same high - O(1) direct addition
  if nl.high == nr.high:
    return normalize(BigValue(nl.data + nr.data, nl.high))

  # Different high - determine which is larger
  large = nl if nl.high > nr.high else nr
  small = nr if nl.high > nr.high else nl

  diff = large.high - small.high

  # If difference > 2, smaller value is negligible - O(1)
  if diff > 2:
    return BigValue(large.data, large.high)

  # For small differences (1 or 2), shift without exponentiation - O(1)
  # Convert large to small's high level
  if diff == 1:
    # large.data * 10^1 = large.data * 10
    scaled_large_data = large.data * 10
  else:  # diff == 2
    # large.data * 10^2 = large.data * 100
    scaled_large_data = large.data * 100

  return normalize(BigValue(scaled_large_data + small.data, small.high))


def add_plain(value: BigValue, plain: int) -> BigValue:
  """Add a plain integer to BigValue"""
  plain = max(0, int(plain))
  if plain == 0:
    return normalize(value)

  plain_bv = from_plain(plain)
  return add_values(value, plain_bv)


def multiply_plain(value: BigValue, multiplier: int) -> BigValue:
  """Multiply BigValue by a plain integer (O(1) complexity)"""
  if multiplier <= 0:
    return BigValue(0, 0)
  if multiplier == 1:
    return normalize(value)

  nv = normalize(value)
  # Simply multiply data by the multiplier
  result_data = nv.data * multiplier
  return normalize(BigValue(result_data, nv.high))


def multiply_by_float(value: BigValue, multiplier: float) -> BigValue:
  """Multiply BigValue by a float (O(1) complexity)"""
  if multiplier <= 0:
    return BigValue(0, 0)
  if multiplier == 1.0:
    return normalize(value)

  nv = normalize(value)
  # Multiply data by the float multiplier
  result_data = int(nv.data * multiplier)
  return normalize(BigValue(result_data, nv.high))


def divide_by_2(value: BigValue) -> BigValue:
  """Divide BigValue by 2 (O(1) complexity)"""
  nv = normalize(value)
  # Simply divide data by 2
  result_data = nv.data // 2
  return normalize(BigValue(max(1, result_data), nv.high))


def subtract_values(left: BigValue, right: BigValue) -> BigValue:
  """Subtract two BigValues using only data and high (O(1) complexity)"""
  # If left < right, return 0
  if compare(left, right) < 0:
    return BigValue(0, 0)

  nl = normalize(left)
  nr = normalize(right)

  # Same high - O(1) direct subtraction
  if nl.high == nr.high:
    return normalize(BigValue(nl.data - nr.data, nl.high))

  # nl.high > nr.high (we know left >= right from compare above)
  diff = nl.high - nr.high

  # If difference > 2, right is negligible - O(1)
  if diff > 2:
    return BigValue(nl.data, nl.high)

  # For small differences (1 or 2), shift without exponentiation - O(1)
  # Convert nl to nr's high level
  if diff == 1:
    # nl.data * 10^1 = nl.data * 10
    scaled_left_data = nl.data * 10
  else:  # diff == 2
    # nl.data * 10^2 = nl.data * 100
    scaled_left_data = nl.data * 100

  return normalize(BigValue(scaled_left_data - nr.data, nr.high))


def subtract_plain(value: BigValue, plain: int) -> BigValue:
  """Subtract a plain integer from BigValue"""
  plain = max(0, int(plain))
  if plain == 0:
    return normalize(value)

  plain_bv = from_plain(plain)
  return subtract_values(value, plain_bv)


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
