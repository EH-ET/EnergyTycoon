// 전역 상태와 인증/저장 유틸
export const state = {
  contentMode: "generator",
  currentUser: null,
  placedGenerators: [],
  generatorTypeMap: {},
  generatorTypeInfoMap: {},
  generatorTypeIdToName: {},
  generatorTypesById: {},
  energyTimer: null,
};

export const SESSION_START_KEY = "session_start_ts";

let userChangeHandler = null;

export function registerUserChangeHandler(fn) {
  userChangeHandler = fn;
}

export function getStoredUser() {
  const stored = localStorage.getItem("user");
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch (err) {
    console.warn("stored user parse failed", err);
    return null;
  }
}

export function persistUser(user) {
  state.currentUser = user;
  localStorage.setItem("user", JSON.stringify(user));
}

export function syncUserState(user) {
  persistUser(user);
  if (userChangeHandler) userChangeHandler(user);
}

export function getAuthToken() {
  return localStorage.getItem("access_token");
}

export function getAuthContext() {
  const token = getAuthToken();
  const user = state.currentUser || getStoredUser();
  if (!token || !user) return null;
  state.currentUser = user;
  return { token, user };
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
