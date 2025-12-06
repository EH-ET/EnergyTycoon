export const DATA_SCALE = 1000;
const DATA_LIMIT = 1_000_000;

// Unit arrays for extended number formatting
const BASE_UNITS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "N"];
const COMMON_UNITS = ["", "U", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "N"];
const HIGH_COMMON_UNITS = ["", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "N"];
const BIG_UNITS = ["", "d", "V", "Tr", "Qav", "Qiv", "Sev", "Spv", "Ocv", "Nv"];
const HUGE_UNITS = ["", "C", "Mi", "Mc", "Na", "Pi", "Fe", "At", "Ze", "Yo", "Xo", "Ve", "Me"];


export function normalizeValue(value = {}) {
  const out = {
    data: Math.max(0, Number(value.data) || 0),
    high: Math.max(0, Number(value.high) || 0),
  };
  while (out.data >= DATA_LIMIT) {
    out.data = Math.floor(out.data / 10);
    out.high += 1;
  }
  if (out.data <= 0) {
    out.data = 0;
    out.high = 0;
  }
  return out;
}

export function fromPlainValue(plain) {
  const safe = Math.max(0, Number(plain) || 0);
  return normalizeValue({ data: safe * DATA_SCALE, high: 0 });
}

export function toPlainValue(value) {
  if (!value || !value.data) return 0;
  const normalized = normalizeValue(value);
  if (normalized.high <= 0) {
    return Math.floor(normalized.data / DATA_SCALE);
  }
  return Math.floor((normalized.data * 10 ** normalized.high) / DATA_SCALE);
}

export function comparePlainValue(value, plain) {
  const normalized = normalizeValue(value);
  const target = fromPlainValue(plain);
  if (normalized.high !== target.high) {
    return normalized.high > target.high ? 1 : -1;
  }
  if (normalized.data !== target.data) {
    return normalized.data > target.data ? 1 : -1;
  }
  return 0;
}

export function addPlainValue(value, plain) {
  // O(1) implementation using addValues
  const plainBV = fromPlainValue(Math.max(0, Number(plain) || 0));
  return addValues(value, plainBV);
}

export function subtractPlainValue(value, plain) {
  // O(1) implementation using subtractValues
  const plainBV = fromPlainValue(Math.max(0, Number(plain) || 0));
  return subtractValues(value, plainBV);
}

export function multiplyByFloat(value, multiplier) {
  // O(1) multiplication by float
  if (multiplier <= 0) return normalizeValue({ data: 0, high: 0 });
  if (multiplier === 1.0) return normalizeValue(value);

  const nv = normalizeValue(value);
  const resultData = Math.floor(nv.data * multiplier);
  return normalizeValue({ data: resultData, high: nv.high });
}

export function multiplyByPlain(value, multiplier) {
  // O(1) multiplication by integer
  if (multiplier <= 0) return normalizeValue({ data: 0, high: 0 });
  if (multiplier === 1) return normalizeValue(value);

  const nv = normalizeValue(value);
  const resultData = nv.data * multiplier;
  return normalizeValue({ data: resultData, high: nv.high });
}

export function divideBy2(value) {
  // O(1) division by 2
  const nv = normalizeValue(value);
  const resultData = Math.floor(nv.data / 2);
  return normalizeValue({ data: Math.max(1, resultData), high: nv.high });
}

export function addValues(a, b) {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  
  if (na.high === nb.high) {
    return normalizeValue({ data: na.data + nb.data, high: na.high });
  }
  
  // Make sure a is the larger one (higher high)
  let large = na, small = nb;
  if (na.high < nb.high) {
    large = nb;
    small = na;
  }
  
  const diff = large.high - small.high;
  if (diff > 6) {
    return cloneValue(large);
  }
  
  // diff is 1 or 2. 
  // e.g. large.high = 5, small.high = 4. diff=1.
  // small.data needs to be divided by 10^diff? No.
  // Value = data * 10^high.
  // large = L * 10^H
  // small = S * 10^(H-d) = (S / 10^d) * 10^H
  // Result = (L + S/10^d) * 10^H
  // But we work with integers.
  // Better: Convert large to lower high? No, data limit.
  // Convert small to match large high? S * 10^(H-d) -> S / 10^d. 
  // This loses precision.
  // Convert large to match small high? L * 10^H = (L * 10^d) * 10^(H-d).
  // Then add S. Then normalize.
  
  const scaledLargeData = large.data * (10 ** diff);
  return normalizeValue({ data: scaledLargeData + small.data, high: small.high });
}

export function subtractValues(a, b) {
  // Assumes a >= b. If a < b returns 0.
  if (compareValues(a, b) < 0) return normalizeValue({ data: 0, high: 0 });
  
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  
  if (na.high === nb.high) {
    return normalizeValue({ data: na.data - nb.data, high: na.high });
  }
  
  const diff = na.high - nb.high;
  if (diff > 2) {
    // b is negligible
    return cloneValue(na);
  }
  
  // na.high > nb.high.
  // Convert na to nb's level
  const scaledA = na.data * (10 ** diff);
  return normalizeValue({ data: scaledA - nb.data, high: nb.high });
}

export function compareValues(a, b) {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  if (na.high !== nb.high) return na.high > nb.high ? 1 : -1;
  if (na.data !== nb.data) return na.data > nb.data ? 1 : -1;
  return 0;
}

export function getLog3Value(value) {
  const n = normalizeValue(value);
  if (n.data <= 0 && n.high <= 0) return 0;
  
  // Real value = data / 1000 * 10^high
  // log3(Real) = log3(data/1000) + high * log3(10)
  const realData = Math.max(1, n.data) / 1000.0;
  const LOG3_10 = 2.09590327429;
  const logVal = (Math.log(realData) / Math.log(3)) + (n.high * LOG3_10);
  return Math.max(0, logVal);
}

export function valueToServer(value) {
  const normalized = normalizeValue(value);
  return { data: normalized.data, high: normalized.high };
}

export function valueFromServer(data, high, fallbackPlain) {
  if (data == null && high == null) {
    if (fallbackPlain == null) return normalizeValue();
    return fromPlainValue(fallbackPlain);
  }
  return normalizeValue({ data, high });
}

export function cloneValue(value) {
  if (!value) return normalizeValue();
  return normalizeValue({ data: value.data, high: value.high });
}

/**
 * Get common+big unit combination for index 0-99
 */
function getCommonBigUnit(index) {
  if (index <= 0) return "";
  if (index <= 9) return COMMON_UNITS[index] || "";

  const adjusted = index - 10;
  const bigIndex = Math.floor(adjusted / 10) + 1;
  const commonIndex = adjusted % 10;
  return (COMMON_UNITS[commonIndex] || "") + (BIG_UNITS[bigIndex] || "");
}

/**
 * Get sub-pattern for offset 0-2999 (used in recursive HUGE units)
 */
function getPrefix(index) {
  if (index < 0) return "";
  if (index <= 8) return HIGH_COMMON_UNITS[index] || "";

  if (index <= 98) {
    const adjusted = index - 9;
    const bigIndex = Math.floor(adjusted / 10) + 1;
    const commonIndex = adjusted % 10;
    return (COMMON_UNITS[commonIndex] || "") + (BIG_UNITS[bigIndex] || "");
  }

  // index >= 99: C range (recursive)
  // Structure matches 301-3000 pattern: prefix + "C" + modifier
  const cOffset = index - 99;
  const cQuotient = Math.floor(cOffset / 100);
  const cRemainder = cOffset % 100;

  const prefix = getPrefix(cQuotient);
  const modifier = getCommonBigUnit(cRemainder);

  return prefix + "C" + modifier;
}

function getSuffixUnit(high) {
  if (high <= 0) return "";
  if (high <= 30) {
    const unitIndex = Math.ceil(high / 3);
    // Suffix logic: 1->"", 2->U, 3->D ... matches COMMON_UNITS[unitIndex-1]
    return COMMON_UNITS[unitIndex - 1] || "";
  }
  return getUnitForHigh(high);
}

/**
 * Get HUGE unit recursively for high >= 3001
 * Input offset is (high - 3001)
 */
function getHugeUnitRecursive(offset) {
  let hugeIndex = 2; // Mi (HUGE_UNITS[2])
  let totalRangeSize = 0; // Cumulative size of previous ranges
  let currentRangeSize = 3000 * 999; // Mi range size: 2,997,000

  // Find correct HUGE unit range
  while (offset >= totalRangeSize + currentRangeSize) {
    totalRangeSize += currentRangeSize;
    currentRangeSize *= 1000;
    hugeIndex++;
  }

  const hugeUnit = HUGE_UNITS[hugeIndex] || "";

  // Adjust offset to be relative to current range
  const relativeOffset = offset - totalRangeSize;

  // Each HUGE range has 999 blocks of fixed size 3000 * 1000^(hugeIndex-2)
  // Mi (hugeIndex=2): blocks of 3000
  // Mc (hugeIndex=3): blocks of 3,000,000
  // Na (hugeIndex=4): blocks of 3,000,000,000
  const quotientBlockSize = 3000 * Math.pow(1000, hugeIndex - 2);

  const quotient = Math.floor(relativeOffset / quotientBlockSize);
  const remainder = relativeOffset % quotientBlockSize;

  const prefix = getPrefix(quotient);
  // Remainder is 0-based offset, convert to 1-based high for suffix
  const suffix = getSuffixUnit(remainder + 1);

  return prefix + hugeUnit + suffix;
}

/**
 * Get the unit suffix for a given high value
 */
function getUnitForHigh(high) {
  if (high === 0) return "";

  // Range 1-30: BASE_UNITS
  if (high <= 30) {
    const unitIndex = Math.ceil(high / 3);
    return BASE_UNITS[unitIndex] || "";
  }

  // Range 31-300: COMMON + BIG
  if (high <= 300) {
    const offset = high - 31;
    const bigIndex = Math.floor(offset / 30) + 1;
    const commonIndex = Math.floor((offset % 30) / 3);
    return (COMMON_UNITS[commonIndex] || "") + (BIG_UNITS[bigIndex] || "");
  }

  // Range 301-3000: HIGH_COMMON + C + COMMON + BIG
  if (high <= 3000) {
    const offset = high - 301;
    const quotient = Math.floor(offset / 300);
    const remainder = offset % 300;
    
    const prefix = getPrefix(quotient);
    // For C range, suffix logic is same as getSuffixUnit but we are manually constructing it
    // remainder 0-299. 
    // 0-29 -> "" (COMMON[0])
    // 30-59 -> U (COMMON[1])
    // ...
    // Actually, we can reuse getSuffixUnit here too!
    // remainder is 0-based offset from C start.
    // C start is high=301.
    // remainder=0 -> high=1 equivalent for suffix -> ""
    const suffix = getSuffixUnit(remainder + 1);
    
    return prefix + "C" + suffix;
  }

  // Very large numbers: e notation
  if (high > 300_000_000_000_000_000_000_000_000_000) {
    return `e${high}`;
  }

  // Range > 3000: Recursive HUGE patterns
  return getHugeUnitRecursive(high - 3001);
}

export function formatResourceValue(value) {
  const normalized = normalizeValue(value);
  if (normalized.data === 0) return "0";

  const high = normalized.high;
  const data = normalized.data;

  // Calculate position within 3-step cycle (0, 1, 2)
  const posInCycle = high % 3;

  // Calculate the scaled number based on position
  let scaled = data / DATA_SCALE;
  if (posInCycle === 1) scaled /= 100;  // X.XX format (1.23)
  if (posInCycle === 2) scaled /= 10;   // XX.X format (12.3)

  // Get the appropriate unit
  const unit = getUnitForHigh(high);

  // Format the number with appropriate decimal places
  let text;
  if (scaled >= 100) text = scaled.toFixed(0);
  else if (scaled >= 10) text = scaled.toFixed(1);
  else text = scaled.toFixed(2);

  return unit ? `${text}${unit}` : text;
}
