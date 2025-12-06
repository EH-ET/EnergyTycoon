#!/usr/bin/env python3
"""Test BigValue operations to ensure no to_plain() freezing with large high values."""

import time
from backend.bigvalue import (
    BigValue,
    normalize,
    divide_by_2,
    multiply_plain,
    multiply_by_float,
    add_values,
    subtract_values,
    compare,
    from_plain,
)


def test_divide_by_2():
    """Test divide_by_2 with 신성 엔진 발전기 cost (high=1234000)"""
    print("\n1. Testing divide_by_2 (demolish cost)...")
    cost = BigValue(100000, 1234000)

    start = time.time()
    result = divide_by_2(cost)
    elapsed = (time.time() - start) * 1000

    print(f"   Input: BigValue(100000, 1234000)")
    print(f"   Result: BigValue({result.data}, {result.high})")
    print(f"   Expected: BigValue(50000, 1234000)")
    print(f"   Time: {elapsed:.3f}ms")

    assert result.data == 50000, f"Expected data=50000, got {result.data}"
    assert result.high == 1234000, f"Expected high=1234000, got {result.high}"
    assert elapsed < 10, f"Too slow: {elapsed}ms"
    print("   ✓ PASSED")


def test_multiply_by_float():
    """Test multiply_by_float for upgrade costs"""
    print("\n2. Testing multiply_by_float (upgrade cost calculation)...")
    cost = BigValue(100000, 1234000)
    multiplier = 1.25 ** 5  # price_growth ** level

    start = time.time()
    result = multiply_by_float(cost, multiplier)
    elapsed = (time.time() - start) * 1000

    print(f"   Input: BigValue(100000, 1234000) * {multiplier:.2f}")
    print(f"   Result: BigValue({result.data}, {result.high})")
    print(f"   Time: {elapsed:.3f}ms")

    assert elapsed < 10, f"Too slow: {elapsed}ms"
    print("   ✓ PASSED")


def test_add_values():
    """Test add_values for summing upgrade costs"""
    print("\n3. Testing add_values (summing upgrade costs)...")
    cost1 = BigValue(100000, 1234000)
    cost2 = BigValue(200000, 1234000)

    start = time.time()
    result = add_values(cost1, cost2)
    elapsed = (time.time() - start) * 1000

    print(f"   Input: BigValue(100000, 1234000) + BigValue(200000, 1234000)")
    print(f"   Result: BigValue({result.data}, {result.high})")
    print(f"   Expected: BigValue(300000, 1234000)")
    print(f"   Time: {elapsed:.3f}ms")

    assert result.data == 300000, f"Expected data=300000, got {result.data}"
    assert result.high == 1234000, f"Expected high=1234000, got {result.high}"
    assert elapsed < 10, f"Too slow: {elapsed}ms"
    print("   ✓ PASSED")


def test_compare_for_validation():
    """Test compare for autosave validation"""
    print("\n4. Testing compare (autosave validation)...")
    energy = BigValue(500000, 1234000)
    max_allowed = BigValue(600000, 1234000)

    start = time.time()
    result = compare(energy, max_allowed)
    elapsed = (time.time() - start) * 1000

    print(f"   Input: compare(BigValue(500000, 1234000), BigValue(600000, 1234000))")
    print(f"   Result: {result}")
    print(f"   Expected: -1 (less than)")
    print(f"   Time: {elapsed:.3f}ms")

    assert result == -1, f"Expected -1, got {result}"
    assert elapsed < 10, f"Too slow: {elapsed}ms"
    print("   ✓ PASSED")


def test_subtract_values():
    """Test subtract_values for deducting costs"""
    print("\n5. Testing subtract_values (deducting cost)...")
    money = BigValue(500000, 1234000)
    cost = BigValue(100000, 1234000)

    start = time.time()
    result = subtract_values(money, cost)
    elapsed = (time.time() - start) * 1000

    print(f"   Input: BigValue(500000, 1234000) - BigValue(100000, 1234000)")
    print(f"   Result: BigValue({result.data}, {result.high})")
    print(f"   Expected: BigValue(400000, 1234000)")
    print(f"   Time: {elapsed:.3f}ms")

    assert result.data == 400000, f"Expected data=400000, got {result.data}"
    assert result.high == 1234000, f"Expected high=1234000, got {result.high}"
    assert elapsed < 10, f"Too slow: {elapsed}ms"
    print("   ✓ PASSED")


def test_skip_build_proportional_cost():
    """Test multiply_by_float for skip build proportional cost"""
    print("\n6. Testing multiply_by_float (skip build proportional cost)...")
    full_cost = BigValue(100000, 1234000)
    proportion = 0.5  # 50% of build time remaining

    start = time.time()
    result = multiply_by_float(full_cost, proportion)
    elapsed = (time.time() - start) * 1000

    print(f"   Input: BigValue(100000, 1234000) * {proportion}")
    print(f"   Result: BigValue({result.data}, {result.high})")
    print(f"   Expected: BigValue(50000, 1234000)")
    print(f"   Time: {elapsed:.3f}ms")

    assert result.data == 50000, f"Expected data=50000, got {result.data}"
    assert result.high == 1234000, f"Expected high=1234000, got {result.high}"
    assert elapsed < 10, f"Too slow: {elapsed}ms"
    print("   ✓ PASSED")


def test_multiple_operations():
    """Test multiple operations in sequence (simulating upgrade cost calculation)"""
    print("\n7. Testing multiple operations (upgrade cost for 10 levels)...")
    base_cost = BigValue(100000, 1234000)
    total_cost = BigValue(0, 0)

    start = time.time()
    for level in range(1, 11):
        multiplier = 1.0 * (1.25 ** level)
        level_cost = multiply_by_float(base_cost, multiplier)
        total_cost = add_values(total_cost, level_cost)
    elapsed = (time.time() - start) * 1000

    print(f"   Calculated upgrade cost for 10 levels")
    print(f"   Result: BigValue({total_cost.data}, {total_cost.high})")
    print(f"   Time: {elapsed:.3f}ms")

    assert elapsed < 50, f"Too slow: {elapsed}ms"
    print("   ✓ PASSED")


if __name__ == "__main__":
    print("=" * 60)
    print("Testing BigValue Operations with 신성 엔진 발전기 (high=1234000)")
    print("=" * 60)

    test_divide_by_2()
    test_multiply_by_float()
    test_add_values()
    test_compare_for_validation()
    test_subtract_values()
    test_skip_build_proportional_cost()
    test_multiple_operations()

    print("\n" + "=" * 60)
    print("All tests PASSED! ✓")
    print("Server will NOT freeze with 신성 엔진 발전기")
    print("=" * 60)
