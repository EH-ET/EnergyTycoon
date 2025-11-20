// 전역 상태와 인증/저장 유틸
const STORAGE_KEYS = {
  user: "et_u",
  sessionTs: "et_ss",
  trap: "et_tp",
};

const TRAP_COOKIE_NAME = "abtkn";

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
}

export function getAuthToken() {
  return null;
}

export function getAuthContext() {
  const user = state.currentUser || getStoredUser();
  if (!user) return null;
  state.currentUser = user;
  return { token: null, user };
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
  localStorage.removeItem(SESSION_START_KEY);
  sessionStorage.removeItem(STORAGE_KEYS.trap);
  // Legacy token cleanup
  localStorage.removeItem("access_token");
  sessionStorage.removeItem("access_token");
}

function trapCookieValue() {
  return readCookie(TRAP_COOKIE_NAME);
}

function trapMismatchDetected() {
  clearClientSession();
  window.location.href = "index.html";
}

function syncTrapMarker(force = false) {
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
    trapMismatchDetected();
  }
}

function markTrapGuardCooldown(ms = 4000) {
  trapGuardCooldownUntil = Date.now() + ms;
}

export function initTrapGuard() {
  syncTrapMarker();
  if (trapGuardInterval) return;
  trapGuardInterval = window.setInterval(() => syncTrapMarker(), 5000);
}

export function installTrapFetchGuard() {
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
