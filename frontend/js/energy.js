// 에너지 생산량 계산 및 타이머
import { generators } from "./data.js";
import { state, syncUserState } from "./state.js";

export function computeEnergyPerSecond() {
  let total = 0;
  state.placedGenerators.forEach((pg) => {
    if (pg.genIndex != null && pg.genIndex >= 0) {
      const g = generators[pg.genIndex];
      const base = g ? Number(g["생산량(에너지)"]) || 0 : 0;
      total += base;
    }
  });
  const bonus = state.currentUser ? Number(state.currentUser.production_bonus) || 0 : 0;
  const multiplier = 1 + bonus * 0.1;
  return total * multiplier;
}

export function startEnergyTimer() {
  if (state.energyTimer) clearInterval(state.energyTimer);
  state.energyTimer = setInterval(() => {
    if (!state.currentUser) return;
    const delta = computeEnergyPerSecond();
    if (delta <= 0) return;
    state.currentUser.energy = Math.round((Number(state.currentUser.energy) || 0) + delta);
    syncUserState(state.currentUser);
  }, 1000);
}
