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
function getPrefix(index) {
  if (index < 0) return "";
  if (index <= 8) return HIGH_COMMON_UNITS[index] || "";
  
  const adjusted = index - 9;
  const bigIndex = Math.floor(adjusted / 10) + 1;
  const commonIndex = adjusted % 10;
  return (COMMON_UNITS[commonIndex] || "") + (BIG_UNITS[bigIndex] || "");
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
  let hugeIndex = 2; // Mi
  let rangeSize = 3000;
  
  // Find correct HUGE unit range
  while (offset >= rangeSize * 1000) {
    rangeSize *= 1000;
    hugeIndex++;
  }
  
  const hugeUnit = HUGE_UNITS[hugeIndex] || "";
  
  const quotient = Math.floor(offset / rangeSize);
  const remainder = offset % rangeSize;
  
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
  if (high > 300000000000000) {
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

/**
 * Reverse-engineer high value from unit string
 * This is the inverse of getUnitForHigh()
 * @param {string} unit - Unit string (e.g., "K", "M", "B", "Ud", "TC", etc.)
 * @param {number} depth - Recursion depth (internal use only)
 * @returns {number} - Corresponding high value
 */
export function getHighFromUnit(unit, depth = 0) {
  // Prevent infinite recursion
  if (depth > 20) {
    return 0;
  }
  
  if (!unit || unit === '') return 0;
  
  const trimmed = unit.trim().toUpperCase();
  if (!trimmed) return 0;
  
  // Check BASE_UNITS first (most common: "", K, M, B, T, Qa, Qi, Sx, Sp, Oc, N)
  // Range 1-30 (each unit = 3 steps in high)
  const baseIndex = BASE_UNITS.findIndex(u => u.toUpperCase() === trimmed);
  if (baseIndex > 0) {
    return baseIndex * 3;
  }
  
  // Check for COMMON + BIG pattern (range 31-300)
  // Examples: "Ud", "Dd", "Td", "UV", "DV", etc.
  for (let bigIdx = 1; bigIdx < BIG_UNITS.length; bigIdx++) {
    const bigUnit = BIG_UNITS[bigIdx].toUpperCase();
    if (trimmed.endsWith(bigUnit) && trimmed.length > bigUnit.length) {
      const commonPart = trimmed.slice(0, -bigUnit.length);
      const commonIdx = COMMON_UNITS.findIndex(u => u.toUpperCase() === commonPart);
      if (commonIdx >= 0) {
        return 31 + (bigIdx - 1) * 30 + commonIdx * 3;
      }
    }
  }
  
  // Check for prefix + C + suffix pattern (range 301-3000)
  // Examples: "C", "UC", "DC", "TC", "UdC", "DdC", etc.
  const cIndex = trimmed.indexOf('C');
  if (cIndex >= 0) {
    const prefix = trimmed.slice(0, cIndex);
    const suffix = trimmed.slice(cIndex + 1);
    
    // Get prefix value (0-8 for HIGH_COMMON, or compound for COMMON+BIG)
    let prefixValue = 0;
    if (prefix) {
      // Try HIGH_COMMON first
      const highCommonIdx = HIGH_COMMON_UNITS.findIndex(u => u.toUpperCase() === prefix);
      if (highCommonIdx > 0) {
        prefixValue = highCommonIdx;
      } else {
        // Try COMMON + BIG pattern
        let found = false;
        for (let bigIdx = 1; bigIdx < BIG_UNITS.length; bigIdx++) {
          const bigUnit = BIG_UNITS[bigIdx].toUpperCase();
          if (prefix.endsWith(bigUnit) && prefix.length > bigUnit.length) {
            const commonPart = prefix.slice(0, -bigUnit.length);
            const commonIdx = COMMON_UNITS.findIndex(u => u.toUpperCase() === commonPart);
            if (commonIdx >= 0) {
              prefixValue = 9 + (bigIdx - 1) * 10 + commonIdx;
              found = true;
              break;
            }
          }
        }
        // If prefix doesn't match any pattern, this is not a valid C unit
        if (!found && prefix.length > 0) {
          return 0;
        }
      }
    }
    
    // Get suffix value
    let suffixValue = 0;
    if (suffix) {
      // Recursively get high from suffix (with depth limit)
      suffixValue = getHighFromUnit(suffix, depth + 1);
      // If suffix is invalid, the whole unit is invalid
      if (suffixValue === 0 && suffix.length > 0) {
        return 0;
      }
    }
    
    return 301 + prefixValue * 300 + suffixValue - 1;
  }
  
  // Check for HUGE patterns (range > 3000)
  // Examples: "Mi", "Mc", "Na", "UMi", "DMi", "UdMi", etc.
  for (let hugeIdx = 2; hugeIdx < HUGE_UNITS.length; hugeIdx++) {
    const hugeUnit = HUGE_UNITS[hugeIdx].toUpperCase();
    const hugeIndex = trimmed.indexOf(hugeUnit);
    
    if (hugeIndex >= 0) {
      const prefix = trimmed.slice(0, hugeIndex);
      const suffix = trimmed.slice(hugeIndex + hugeUnit.length);
      
      // Calculate range size for this HUGE unit
      let rangeSize = 3000;
      for (let i = 2; i < hugeIdx; i++) {
        rangeSize *= 1000;
      }
      
      // Get prefix value (quotient)
      let prefixValue = 0;
      if (prefix) {
        // Try to parse prefix as a unit (with depth limit)
        const prefixHigh = getHighFromUnit(prefix, depth + 1);
        // If prefix is invalid, skip this HUGE unit
        if (prefixHigh === 0 && prefix.length > 0) {
          continue;
        }
        // Convert high to quotient (rough approximation)
        prefixValue = Math.floor(prefixHigh / 3);
      }
      
      // Get suffix value (remainder)
      let suffixValue = 0;
      if (suffix) {
        suffixValue = getHighFromUnit(suffix, depth + 1);
        // If suffix is invalid, skip this HUGE unit
        if (suffixValue === 0 && suffix.length > 0) {
          continue;
        }
        suffixValue = suffixValue - 1;
      }
      
      return 3001 + prefixValue * rangeSize + suffixValue;
    }
  }
  
  // If nothing matches, return 0 (invalid unit)
  return 0;
}

/**
 * Parse user input string to BigValue format (prevents overflow)
 * Supports formats like: "123", "1.5K", "2M", "3.14B", etc.
 * @param {string|number} input - User input string or number
 * @returns {{data: number, high: number}} - BigValue format
 */
export function parseUserInput(input) {
  if (!input) {
    return normalizeValue({ data: 0, high: 0 });
  }

  // If it's already a number, convert to BigValue
  if (typeof input === 'number') {
    return fromPlainValue(Math.max(0, Math.floor(input)));
  }

  const trimmed = String(input).trim().toUpperCase();
  if (!trimmed) {
    return normalizeValue({ data: 0, high: 0 });
  }

  // Extract number and unit
  const match = trimmed.match(/^([\d.]+)([A-Z]*)$/);
  if (!match) {
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0) {
      return normalizeValue({ data: 0, high: 0 });
    }
    return fromPlainValue(Math.floor(num));
  }

  const [, numStr, unit] = match;
  const baseNum = parseFloat(numStr);
  if (isNaN(baseNum) || baseNum < 0) {
    return normalizeValue({ data: 0, high: 0 });
  }

  // Use reverse-engineered high value from unit
  const highValue = getHighFromUnit(unit);
  
  // Convert baseNum to data value
  // data is stored as value * DATA_SCALE (1000)
  // So if user enters "1.5K", that's 1500 plain value
  // = 1500 * 1000 data with high 0
  // But with K unit, high should be 3
  // So we need: 1.5 * 1000 (DATA_SCALE) with high 3
  const dataValue = Math.floor(baseNum * DATA_SCALE);
  
  return normalizeValue({ data: dataValue, high: highValue });
}

/**
 * Parse user input and convert to plain value (for backward compatibility)
 * WARNING: May overflow for very large numbers. Use parseUserInput() for BigValue.
 * @param {string|number} input - User input
 * @returns {number} - Plain value (may overflow)
 */
export function parseUserInputToPlain(input) {
  const bigValue = parseUserInput(input);
  return toPlainValue(bigValue);
}
