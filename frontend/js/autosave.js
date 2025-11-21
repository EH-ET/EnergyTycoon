import { autosaveProgress } from "./apiClient.js";
import { state, syncUserState, getAuthToken, touchTrapMarker } from "./state.js";

// Autosave will debounce after changes instead of fixed interval spam
const AUTOSAVE_INTERVAL_MS = 60 * 1000;
const AUTOSAVE_GUARD_ENABLED = true;
const MIN_IDLE_MS = 15 * 1000;

let pendingAutosave = null;
let lastSavedEnergy = null;
let lastSavedMoney = null;

function hasMeaningfulChange() {
  if (!state.currentUser) return false;
  const e = typeof state.currentUser.energy === "number" ? state.currentUser.energy : 0;
  const m = typeof state.currentUser.money === "number" ? state.currentUser.money : 0;
  if (lastSavedEnergy === null || lastSavedMoney === null) return true;
  return e !== lastSavedEnergy || m !== lastSavedMoney;
}

async function performAutosave() {
  if (!AUTOSAVE_GUARD_ENABLED) return;
  if (!state.currentUser) return;
  const token = getAuthToken();
  if (!token) return;
  if (!hasMeaningfulChange()) return;
  try {
    const payload = {
      energy: typeof state.currentUser.energy === "number" ? state.currentUser.energy : 0,
      money: typeof state.currentUser.money === "number" ? state.currentUser.money : 0,
    };
    touchTrapMarker();
    const data = await autosaveProgress(token, payload);
    touchTrapMarker();
    if (data.user) {
      syncUserState(data.user);
      lastSavedEnergy = data.user.energy;
      lastSavedMoney = data.user.money;
    } else {
      lastSavedEnergy = payload.energy;
      lastSavedMoney = payload.money;
    }
  } catch (err) {
    console.warn("autosave failed", err);
  }
}

function debounceAutosave() {
  if (!AUTOSAVE_GUARD_ENABLED) return;
  if (pendingAutosave) {
    clearTimeout(pendingAutosave);
    pendingAutosave = null;
  }
  pendingAutosave = window.setTimeout(() => {
    pendingAutosave = null;
    performAutosave();
  }, MIN_IDLE_MS);
}

export function notifyUserStateChanged() {
  debounceAutosave();
}

export function startAutosaveTimer() {
  if (!AUTOSAVE_GUARD_ENABLED) return;
  if (state.autosaveTimer) clearInterval(state.autosaveTimer);
  // Do not autosave immediately on load; wait for first change or interval
  state.autosaveTimer = setInterval(performAutosave, AUTOSAVE_INTERVAL_MS);
}

export function stopAutosaveTimer() {
  if (state.autosaveTimer) {
    clearInterval(state.autosaveTimer);
    state.autosaveTimer = null;
  }
  if (pendingAutosave) {
    clearTimeout(pendingAutosave);
    pendingAutosave = null;
  }
}
