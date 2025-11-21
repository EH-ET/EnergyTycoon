// 에너지 생산량 계산 및 타이머 (서버 저장은 progress 저장 시 함께 처리)
import { generators } from "./data.js";
import { state, syncUserState, getEnergyValue, setEnergyValue } from "./state.js";
import { updateEnergyRateUI } from "./ui.js";
import { addPlainValue } from "./bigValue.js";

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
  const tick = () => {
    if (!state.currentUser) {
      updateEnergyRateUI(0);
      return;
    }
    const delta = computeEnergyPerSecond();
    updateEnergyRateUI(delta);
    if (delta <= 0) return;
    const nextValue = addPlainValue(getEnergyValue(), delta);
    setEnergyValue(nextValue);
    syncUserState(state.currentUser, { persist: false });
  };
  tick();
  state.energyTimer = setInterval(tick, 1000);
}
