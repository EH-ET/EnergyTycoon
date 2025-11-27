import { toFrontendPath } from "./data.js";

// 전역 상태와 인증/저장 유틸
import { normalizeValue, toPlainValue, comparePlainValue, valueFromServer, valueToServer } from "./bigValue.js";

const STORAGE_KEYS = {
  user: "et_u",
  token: "et_at",
  sessionTs: "et_ss",
  trap: "et_tp",
};

const TRAP_COOKIE_NAME = "abtkn";
// Toggle trap guard; when false, related functions become no-ops
const TRAP_GUARD_ENABLED = true;
const TRAP_GRACE_MS = 10000;
const TRAP_TAMPER_LIMIT = 5;

export const state = {
  contentMode: "generator",
  currentUser: null,
  placedGenerators: [],
  backgroundWidth: 0,
  backgroundHeight: 0,
  generatorTypeMap: {},
  generatorTypeInfoMap: {},
  generatorTypeIdToName: {},
  generatorTypesById: {},
  energyTimer: null,
  autosaveTimer: null,
  userOffsetX: 0,
  exchangeRate: null,
};

export const SESSION_START_KEY = STORAGE_KEYS.sessionTs;

let userChangeHandler = null;
let trapGuardInterval = null;
let trapGuardCooldownUntil = 0;
let fetchGuardInstalled = false;
let trapTamperCount = 0;

export function registerUserChangeHandler(fn) {
  userChangeHandler = fn;
}

export function getStoredUser() {
  const stored = localStorage.getItem(STORAGE_KEYS.user);
  if (!stored) return null;
  try {
    const decoded = atob(stored);
    const parsed = JSON.parse(decoded);
    normalizeDemandBonus(parsed);
    return parsed;
  } catch (err) {
    console.warn("stored user parse failed", err);
    return null;
  }
}

export function persistUser(user) {
  try {
    const toStore = sanitizeUserForStorage(user);
    const encoded = btoa(JSON.stringify(toStore));
    localStorage.setItem(STORAGE_KEYS.user, encoded);
    syncTrapMarker(true);
  } catch (e) {
    console.warn("user persist failed", e);
  }
}

function persistToken(token) {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.token, token);
    }
  } catch (e) {
    console.warn("token persist failed", e);
  }
}

export function syncUserState(user, options = {}) {
  const { persist = true, token } = options;
  state.currentUser = user;
  applyResourceValues(state.currentUser);
  if (persist) {
    persistUser(user);
    if (token) persistToken(token);
  }
  if (userChangeHandler) userChangeHandler(user);
  syncTrapMarker(true);
}

export function getAuthToken() {
  const cookie = document.cookie || "";
  const parts = cookie.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith("ec9db4eab1b820ebb3b5ed98b8ed9994ed9598eb8ba4eb8b88=")) {
      return part.split("=").slice(1).join("=");
    }
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.token);
    if (stored) return stored;
  } catch (e) {
    console.warn("token read failed", e);
  }
  return null;
}

export function getAuthContext() {
  const user = state.currentUser || getStoredUser();
  if (!user) return null;
  state.currentUser = user;
  return { token: getAuthToken(), user };
}

export function ensureSessionStart() {
  let ts = Number(localStorage.getItem(SESSION_START_KEY));
  if (!ts) {
    ts = Date.now();
    localStorage.setItem(SESSION_START_KEY, String(ts));
  }
  return ts;
}

export function setContentMode(mode) {
  state.contentMode = mode;
}

function readCookie(name) {
  const cookie = document.cookie || "";
  const entries = cookie.split(";").map((c) => c.trim());
  for (const entry of entries) {
    if (!entry) continue;
    const [k, ...rest] = entry.split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

function clearClientSession() {
  state.currentUser = null;
  state.placedGenerators = [];
  state.userOffsetX = 0;
  state.exchangeRate = null;
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(SESSION_START_KEY);
  sessionStorage.removeItem(STORAGE_KEYS.trap);
  // Legacy token cleanup
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
}

function trapCookieValue() {
  if (!TRAP_GUARD_ENABLED) return null;
  return readCookie(TRAP_COOKIE_NAME);
}

function sanitizeUserForStorage(user) {
  if (!user) return user;
  const clone = { ...user };
  delete clone.energy_view;
  delete clone.money_view;
  delete clone.energy_value;
  delete clone.money_value;
  return clone;
}

function normalizeDemandBonus(user) {
  if (!user) return;
  if (user.demand_bonus == null && user.supply_bonus != null) {
    user.demand_bonus = user.supply_bonus;
  }
}

function applyResourceValues(user) {
  if (!user) return;
  normalizeDemandBonus(user);
  const energyValue = valueFromServer(user.energy_data, user.energy_high, user.energy);
  user.energy_value = energyValue;
  user.energy_view = energyValue;
  user.energy_data = energyValue.data;
  user.energy_high = energyValue.high;
  user.energy = toPlainValue(energyValue);
  const moneyValue = valueFromServer(user.money_data, user.money_high, user.money);
  user.money_value = moneyValue;
  user.money_view = moneyValue;
  user.money_data = moneyValue.data;
  user.money_high = moneyValue.high;
  user.money = toPlainValue(moneyValue);
}

function ensureTrapPresence() {
  if (!TRAP_GUARD_ENABLED) return;
  const current = trapCookieValue();
  if (current) {
    sessionStorage.setItem(STORAGE_KEYS.trap, current);
  } else {
    sessionStorage.removeItem(STORAGE_KEYS.trap);
  }
}

function trapMismatchDetected(current) {
  if (!TRAP_GUARD_ENABLED) return;
  trapTamperCount += 1;
  if (trapTamperCount < TRAP_TAMPER_LIMIT) {
    console.warn("Trap token mismatch auto-healed", { count: trapTamperCount });
    if (current) sessionStorage.setItem(STORAGE_KEYS.trap, current);
    return;
  }
  clearClientSession();
  window.location.href = toFrontendPath("index.html");
}

function syncTrapMarker(force = false) {
  if (!TRAP_GUARD_ENABLED) return;
  ensureTrapPresence();
  const current = trapCookieValue();
  const stored = sessionStorage.getItem(STORAGE_KEYS.trap);
  if (force) {
    if (current) {
      sessionStorage.setItem(STORAGE_KEYS.trap, current);
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.trap);
    }
    return;
  }
  if (!stored) {
    if (current) sessionStorage.setItem(STORAGE_KEYS.trap, current);
    return;
  }
  if (!current) {
    sessionStorage.removeItem(STORAGE_KEYS.trap);
    return;
  }
  if (stored !== current) {
    if (Date.now() <= trapGuardCooldownUntil) {
      sessionStorage.setItem(STORAGE_KEYS.trap, current);
      return;
    }
    trapMismatchDetected(current);
  } else {
    trapTamperCount = 0;
  }
}

export function touchTrapMarker() {
  if (!TRAP_GUARD_ENABLED) return;
  trapTamperCount = 0;
  syncTrapMarker(true);
}

function markTrapGuardCooldown(ms = TRAP_GRACE_MS) {
  if (!TRAP_GUARD_ENABLED) return;
  trapGuardCooldownUntil = Date.now() + ms;
}

export function beginTrapGuardGracePeriod(ms = TRAP_GRACE_MS) {
  markTrapGuardCooldown(ms);
  touchTrapMarker();
}

export function getMoneyValue(user = state.currentUser) {
  if (!user) return normalizeValue();
  if (!user.money_value) {
    user.money_value = valueFromServer(user.money_data, user.money_high, user.money);
  }
  return user.money_value;
}

export function getEnergyValue(user = state.currentUser) {
  if (!user) return normalizeValue();
  if (!user.energy_value) {
    user.energy_value = valueFromServer(user.energy_data, user.energy_high, user.energy);
  }
  return user.energy_value;
}

export function compareMoneyWith(amount) {
  return comparePlainValue(getMoneyValue(), amount);
}

export function compareEnergyWith(amount) {
  return comparePlainValue(getEnergyValue(), amount);
}

export function setMoneyValue(value) {
  if (!state.currentUser) return;
  const normalized = normalizeValue(value);
  state.currentUser.money_value = normalized;
  state.currentUser.money_view = normalized;
  state.currentUser.money_data = normalized.data;
  state.currentUser.money_high = normalized.high;
  state.currentUser.money = toPlainValue(normalized);
}

export function setEnergyValue(value) {
  if (!state.currentUser) return;
  const normalized = normalizeValue(value);
  state.currentUser.energy_value = normalized;
  state.currentUser.energy_view = normalized;
  state.currentUser.energy_data = normalized.data;
  state.currentUser.energy_high = normalized.high;
  state.currentUser.energy = toPlainValue(normalized);
}

export function toMoneyServerPayload() {
  return valueToServer(getMoneyValue());
}

export function toEnergyServerPayload() {
  return valueToServer(getEnergyValue());
}

export function initTrapGuard() {
  if (!TRAP_GUARD_ENABLED) return;
  syncTrapMarker();
  if (trapGuardInterval) return;
  trapGuardInterval = window.setInterval(() => syncTrapMarker(), 5000);
}

export function installTrapFetchGuard() {
  if (!TRAP_GUARD_ENABLED) return;
  if (fetchGuardInstalled || typeof window.fetch !== "function") return;
  fetchGuardInstalled = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (...args) => {
    markTrapGuardCooldown();
    return originalFetch(...args)
      .then((res) => {
        syncTrapMarker();
        return res;
      })
      .catch((err) => {
        syncTrapMarker();
        throw err;
      });
  };
}
