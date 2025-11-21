export const DATA_SCALE = 1000;
const DATA_LIMIT = 1_000_000;
const UNITS = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];

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

export function formatResourceValue(value) {
  const normalized = normalizeValue(value);
  if (normalized.data === 0) return "0";
  const logComponent = Math.log10(normalized.data) - Math.log10(DATA_SCALE) + normalized.high;
  const unitIndex = Math.min(UNITS.length - 1, Math.max(0, Math.floor(logComponent / 3)));
  const unitPower = unitIndex * 3;
  const scaled = 10 ** (logComponent - unitPower);
  const unit = UNITS[unitIndex] ?? `e${normalized.high}`;
  let text;
  if (scaled >= 100) text = scaled.toFixed(0);
  else if (scaled >= 10) text = scaled.toFixed(1);
  else text = scaled.toFixed(2);
  return unit ? `${text}${unit}` : text;
}
