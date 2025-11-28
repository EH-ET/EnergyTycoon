export const DATA_SCALE = 1000;
const DATA_LIMIT = 1_000_000;

// Unit arrays for extended number formatting
const BASE_UNITS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "N"];
const COMMON_UNITS = ["", "U", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "N"];
const HIGH_COMMON_UNITS = ["", "D", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "N"];
const BIG_UNITS = ["", "d", "v", "Tr", "Qav", "Qiv", "Sev", "Spv", "Ocv", "Nv"];
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
  return fromPlainValue(toPlainValue(value) + Math.max(0, Number(plain) || 0));
}

export function subtractPlainValue(value, plain) {
  return fromPlainValue(Math.max(0, toPlainValue(value) - Math.max(0, Number(plain) || 0)));
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
 * Get sub-pattern for offset 0-2999 (used in recursive HUGE units)
 */
function getSubPattern(offset) {
  if (offset < 30) {
    if (offset === 0) return "";
    const commonIndex = Math.ceil(offset / 3);
    return COMMON_UNITS[commonIndex] || "";
  }

  if (offset < 300) {
    const subOffset = offset - 30;
    const bigIndex = Math.floor(subOffset / 30) + 1;
    const commonIndex = Math.floor((subOffset % 30) / 3);
    return (COMMON_UNITS[commonIndex] || "") + (BIG_UNITS[bigIndex] || "");
  }

  // offset 300-2999: HIGH_COMMON + C + pattern
  const subOffset = offset - 300;
  const highCommonIndex = Math.floor(subOffset / 300);
  const withinBlock = subOffset % 300;
  const highCommonUnit = HIGH_COMMON_UNITS[highCommonIndex] || "";

  if (withinBlock < 30) {
    const commonIndex = Math.floor(withinBlock / 3);
    return highCommonUnit + "C" + (COMMON_UNITS[commonIndex] || "");
  } else {
    const subSubOffset = withinBlock - 30;
    const bigIndex = Math.floor(subSubOffset / 30) + 1;
    const commonIndex = Math.floor((subSubOffset % 30) / 3);
    return highCommonUnit + "C" + (COMMON_UNITS[commonIndex] || "") + (BIG_UNITS[bigIndex] || "");
  }
}

/**
 * Get HUGE unit recursively for high >= 3001
 */
function getHugeUnitRecursive(offset) {
  // Find which HUGE unit we're in
  let hugeIndex = 2; // Start from Mi (HUGE_UNITS[2])
  let rangeStart = 0;
  let rangeSize = 27000; // Each HUGE unit covers 3000 * 9

  while (offset >= rangeStart + rangeSize && hugeIndex < HUGE_UNITS.length - 1) {
    rangeStart += rangeSize;
    rangeSize *= 10;
    hugeIndex++;
  }

  const currentOffset = offset - rangeStart;
  const hugeUnit = HUGE_UNITS[hugeIndex] || "";

  // Case 1: First 3000 of any HUGE range - just add subPattern
  if (currentOffset < 3000) {
    return hugeUnit + getSubPattern(currentOffset);
  }

  // Case 2: Mi range (first HUGE) with offset >= 3000
  // Use HIGH_COMMON prefix pattern
  if (hugeIndex === 2) {
    const highCommonIndex = Math.floor(currentOffset / 3000);
    const withinHuge = currentOffset % 3000;

    const highCommonUnit = HIGH_COMMON_UNITS[highCommonIndex] || "";
    return highCommonUnit + hugeUnit + getSubPattern(withinHuge);
  }

  // Case 3: Mc, Na, etc. with offset >= 3000
  // Recursively apply the previous HUGE pattern
  const recursivePattern = getHugeUnitRecursive(currentOffset - 3000);
  return hugeUnit + recursivePattern;
}

/**
 * Get the unit suffix for a given high value
 */
function getUnitForHigh(high) {
  if (high === 0) return "";

  // Range 0-30: BASE_UNITS
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
    const highCommonIndex = Math.floor(offset / 300);
    const withinBlock = offset % 300;
    const highCommonUnit = HIGH_COMMON_UNITS[highCommonIndex] || "";

    if (withinBlock < 30) {
      const commonIndex = Math.floor(withinBlock / 3);
      return highCommonUnit + "C" + (COMMON_UNITS[commonIndex] || "");
    } else {
      const subOffset = withinBlock - 30;
      const bigIndex = Math.floor(subOffset / 30) + 1;
      const commonIndex = Math.floor((subOffset % 30) / 3);
      return highCommonUnit + "C" + (COMMON_UNITS[commonIndex] || "") + (BIG_UNITS[bigIndex] || "");
    }
  }

  // Very large numbers: e notation
  if (high > 3 * Math.pow(10, 14)) {
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
