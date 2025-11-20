import { autosaveProgress } from "./apiClient.js";
import { state, syncUserState } from "./state.js";

const AUTOSAVE_INTERVAL_MS = 60 * 1000;

async function performAutosave() {
  if (!state.currentUser) return;
  try {
    const payload = {
      energy: typeof state.currentUser.energy === "number" ? state.currentUser.energy : 0,
      money: typeof state.currentUser.money === "number" ? state.currentUser.money : 0,
    };
    const data = await autosaveProgress(null, payload);
    if (data.user) {
      syncUserState(data.user);
    }
  } catch (err) {
    console.warn("autosave failed", err);
  }
}

export function startAutosaveTimer() {
  if (state.autosaveTimer) clearInterval(state.autosaveTimer);
  performAutosave();
  state.autosaveTimer = setInterval(performAutosave, AUTOSAVE_INTERVAL_MS);
}

export function stopAutosaveTimer() {
  if (state.autosaveTimer) {
    clearInterval(state.autosaveTimer);
    state.autosaveTimer = null;
  }
}
