// 전역 상태와 인증/저장 유틸
const STORAGE_KEYS = {
  user: "et_u",
  sessionTs: "et_ss",
  trap: "et_tp",
  access: "et_at",
  refresh: "et_rt",
};

const TRAP_COOKIE_NAME = "abtkn";
// Toggle trap guard; when false, related functions become no-ops
const TRAP_GUARD_ENABLED = true;
const TRAP_COOKIE_AGE_DAYS = 7;

export const state = {
  contentMode: "generator",
  currentUser: null,
  placedGenerators: [],
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

export function registerUserChangeHandler(fn) {
  userChangeHandler = fn;
}

export function getStoredUser() {
  const stored = localStorage.getItem(STORAGE_KEYS.user);
  if (!stored) return null;
  try {
    const decoded = atob(stored);
    return JSON.parse(decoded);
  } catch (err) {
    console.warn("stored user parse failed", err);
    return null;
  }
}

export function persistUser(user) {
  try {
    const encoded = btoa(JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.user, encoded);
    syncTrapMarker(true);
  } catch (e) {
    console.warn("user persist failed", e);
  }
}

export function syncUserState(user, options = {}) {
  const { persist = true } = options;
  state.currentUser = user;
  if (persist) persistUser(user);
  if (userChangeHandler) userChangeHandler(user);
  syncTrapMarker(true);
}

export function getAuthToken() {
  return sessionStorage.getItem(STORAGE_KEYS.access) || localStorage.getItem(STORAGE_KEYS.access);
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

function writeCookie(name, value, days = TRAP_COOKIE_AGE_DAYS) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
}

function clearClientSession() {
  state.currentUser = null;
  state.placedGenerators = [];
  state.userOffsetX = 0;
  state.exchangeRate = null;
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(SESSION_START_KEY);
  sessionStorage.removeItem(STORAGE_KEYS.trap);
  sessionStorage.removeItem(STORAGE_KEYS.access);
  sessionStorage.removeItem(STORAGE_KEYS.refresh);
  // Legacy token cleanup
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
}

function trapCookieValue() {
  if (!TRAP_GUARD_ENABLED) return null;
  return readCookie(TRAP_COOKIE_NAME);
}

function ensureTrapPresence() {
  if (!TRAP_GUARD_ENABLED) return;
  let current = trapCookieValue();
  let stored = sessionStorage.getItem(STORAGE_KEYS.trap);
  if (!current && stored) {
    writeCookie(TRAP_COOKIE_NAME, stored);
    current = stored;
  } else if (current && !stored) {
    sessionStorage.setItem(STORAGE_KEYS.trap, current);
    stored = current;
  }
  if (!current && !stored) {
    const fallback = (globalThis.crypto?.randomUUID?.() || `tp_${Date.now()}`);
    writeCookie(TRAP_COOKIE_NAME, fallback);
    sessionStorage.setItem(STORAGE_KEYS.trap, fallback);
  }
}

function trapMismatchDetected() {
  if (!TRAP_GUARD_ENABLED) return;
  // Auto-heal instead of redirect to avoid refresh loops
  ensureTrapPresence();
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
    // Auto-heal mismatches instead of forcing navigation to prevent refresh loops
    sessionStorage.setItem(STORAGE_KEYS.trap, current);
  }
}

function markTrapGuardCooldown(ms = 4000) {
  if (!TRAP_GUARD_ENABLED) return;
  trapGuardCooldownUntil = Date.now() + ms;
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
