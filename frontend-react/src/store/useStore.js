import { create } from 'zustand';
import { normalizeValue, valueFromServer, toPlainValue, comparePlainValue, valueToServer, compareValues, subtractPlainValue } from '../utils/bigValue.js';

const STORAGE_KEYS = {
  user: "et_u",
  sessionTs: "et_ss",
  trap: "et_tp",
  exchangeRate: "et_er",
};

const TRAP_COOKIE_NAME = "abtkn";
const TRAP_GUARD_ENABLED = true;
const TRAP_GRACE_MS = 10000;
const TRAP_TAMPER_LIMIT = 5;

let trapGuardInterval = null;
let trapGuardCooldownUntil = 0;
let fetchGuardInstalled = false;
let trapTamperCount = 0;

export const useStore = create((set, get) => ({
  // 상태
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
  exchangeRate: loadExchangeRate(),
  saveStatus: null, // { status: 'success' | 'error', timestamp: number }
  isGlobalLoading: false, // Global loading state for token refresh / server wake-up
  globalLoadingMessage: '', // Message to show during loading
  isAutosaveLocked: false, // Autosave lock

  // Actions
  lockAutosave: () => set({ isAutosaveLocked: true }),
  unlockAutosave: () => set({ isAutosaveLocked: false }),
  setSaveStatus: (status) => set({ saveStatus: { status, timestamp: Date.now() } }),
  setContentMode: (mode) => set({ contentMode: mode }),
  setGlobalLoading: (isLoading, message = '') => set({ isGlobalLoading: isLoading, globalLoadingMessage: message }),

  logout: () => {
    clearClientSession();
    set({
      currentUser: null,
      placedGenerators: [],
      userOffsetX: 0,
    });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  setPlacedGenerators: (generators) => set({ placedGenerators: generators }),

  addPlacedGenerator: (generator) => set((state) => ({
    placedGenerators: [...state.placedGenerators, generator]
  })),

  updatePlacedGenerator: (id, updater) => set((state) => {
    let found = false;
    const nextList = state.placedGenerators.map((g) => {
      const match = g?.generator_id === id || g?.id === id;
      if (!match) return g;
      found = true;
      const base = g || {};
      const patch = typeof updater === 'function' ? updater(base) : updater;
      return { ...base, ...(patch || {}) };
    });
    if (!found) return {};
    return { placedGenerators: nextList };
  }),

  removePlacedGenerator: (id) => set((state) => ({
    placedGenerators: state.placedGenerators.filter(g => g.generator_id !== id && g.id !== id)
  })),

  setExchangeRate: (rate) => {
    persistExchangeRate(rate);
    set({ exchangeRate: rate });
  },

  setUserOffsetX: (offset) => set({ userOffsetX: offset }),

  setGeneratorTypes: (typeMap, typeInfoMap, idToName, typesById) => set({
    generatorTypeMap: typeMap,
    generatorTypeInfoMap: typeInfoMap,
    generatorTypeIdToName: idToName,
    generatorTypesById: typesById,
  }),

  setEnergyTimer: (timer) => set({ energyTimer: timer }),

  setAutosaveTimer: (timer) => set({ autosaveTimer: timer }),

  setBackgroundSize: (width, height) => set({
    backgroundWidth: Math.max(0, Number(width) || 0),
    backgroundHeight: Math.max(0, Number(height) || 0),
  }),

  // User 관련 함수들
  syncUserState: (user, options = {}) => {
    const { persist = true } = options;
    applyResourceValues(user);

    if (persist) {
      persistUser(user);
      // Tokens are now managed via HttpOnly cookies, not localStorage
    }

    set({ currentUser: user });
    syncTrapMarker(true);
  },

  getMoneyValue: () => {
    const user = get().currentUser;
    if (!user) return normalizeValue();
    if (!user.money_value) {
      user.money_value = valueFromServer(user.money_data, user.money_high);
    }
    return user.money_value;
  },

  getEnergyValue: () => {
    const user = get().currentUser;
    if (!user) return normalizeValue();
    if (!user.energy_value) {
      user.energy_value = valueFromServer(user.energy_data, user.energy_high);
    }
    return user.energy_value;
  },

  compareMoneyWith: (amount) => {
    return comparePlainValue(get().getMoneyValue(), amount);
  },

  compareMoneyWithBigValue: (bigValueToCompare) => {
    const moneyBV = get().getMoneyValue();
    return compareValues(moneyBV, bigValueToCompare);
  },

  compareEnergyWith: (amount) => {
    return comparePlainValue(get().getEnergyValue(), amount);
  },

  setMoneyValue: (value) => {
    const user = get().currentUser;
    if (!user) return;
    const normalized = normalizeValue(value);
    user.money_value = normalized;
    user.money_view = normalized;
    user.money_data = normalized.data;
    user.money_high = normalized.high;
    set({ currentUser: { ...user } });
  },

  subtractFromMoney: (plainAmount) => {
    const user = get().currentUser;
    if (!user) return;
    const currentMoney = get().getMoneyValue();
    const newMoney = subtractPlainValue(currentMoney, plainAmount);
    get().setMoneyValue(newMoney);
  },

  setEnergyValue: (value) => {
    const user = get().currentUser;
    if (!user) return;
    const normalized = normalizeValue(value);
    user.energy_value = normalized;
    user.energy_view = normalized;
    user.energy_data = normalized.data;
    user.energy_high = normalized.high;
    set({ currentUser: { ...user } });
  },

  toMoneyServerPayload: () => {
    return valueToServer(get().getMoneyValue());
  },

  toEnergyServerPayload: () => {
    return valueToServer(get().getEnergyValue());
  },
}));

// Helper functions
function getStoredUser() {
  const stored = localStorage.getItem(STORAGE_KEYS.user);
  if (!stored) return null;
  try {
    const decoded = atob(stored);
    const parsed = JSON.parse(decoded);
    normalizeDemandBonus(parsed);
    return parsed;
  } catch (err) {
    return null;
  }
}

function persistUser(user) {
  try {
    const toStore = sanitizeUserForStorage(user);
    const encoded = btoa(JSON.stringify(toStore));
    localStorage.setItem(STORAGE_KEYS.user, encoded);
    syncTrapMarker(true);
  } catch (e) {
    // Silent fail
  }
}

// Tokens are no longer stored in localStorage
// They are managed via HttpOnly cookies from the backend

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
  const energyValue = valueFromServer(user.energy_data, user.energy_high);
  user.energy_value = energyValue;
  user.energy_view = energyValue;
  user.energy_data = energyValue.data;
  user.energy_high = energyValue.high;

  const moneyValue = valueFromServer(user.money_data, user.money_high);
  user.money_value = moneyValue;
  user.money_view = moneyValue;
  user.money_data = moneyValue.data;
  user.money_high = moneyValue.high;
}

function persistExchangeRate(rate) {
  try {
    if (typeof rate === "number" && Number.isFinite(rate)) {
      localStorage.setItem(STORAGE_KEYS.exchangeRate, String(rate));
    }
  } catch (e) {
    // Silent fail
  }
}

function loadExchangeRate() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.exchangeRate);
    if (stored == null) return null;
    const num = Number(stored);
    return Number.isFinite(num) ? num : null;
  } catch (e) {
    return null;
  }
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

function trapCookieValue() {
  if (!TRAP_GUARD_ENABLED) return null;
  return readCookie(TRAP_COOKIE_NAME);
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
    if (current) sessionStorage.setItem(STORAGE_KEYS.trap, current);
    return;
  }
  clearClientSession();
  window.location.href = "/";
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

function clearClientSession() {
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.sessionTs);
  localStorage.removeItem(STORAGE_KEYS.exchangeRate);
  sessionStorage.removeItem(STORAGE_KEYS.trap);
  // Remove any legacy token storage (tokens are now in HttpOnly cookies)
  localStorage.removeItem("et_at");
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
}

// In-memory token storage (fallback if cookies fail)
let memoryToken = null;

export function setMemoryToken(token) {
  memoryToken = token;
}

export function getAuthToken() {
  // 1. Try to use memory token first (if set via login response)
  if (memoryToken) return memoryToken;

  // 2. Try to read from cookie (if not HttpOnly, though it should be)
  const cookie = document.cookie || "";
  const parts = cookie.split(";").map((c) => c.trim());
  for (const part of parts) {
    if (part.startsWith("ec9db4eab1b820ebb3b5ed98b8ed9994ed9598eb8ba4eb8b88=")) {
      return part.split("=").slice(1).join("=");
    }
  }
  
  return null;
}

export function ensureSessionStart() {
  let ts = Number(localStorage.getItem(STORAGE_KEYS.sessionTs));
  if (!ts) {
    ts = Date.now();
    localStorage.setItem(STORAGE_KEYS.sessionTs, String(ts));
  }
  return ts;
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
    trapGuardCooldownUntil = Date.now() + TRAP_GRACE_MS;
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

export function loadUserData() {
  const stored = getStoredUser();
  if (!stored) return null;
  return stored;
}

export { getStoredUser };
