// 에너지 생산량 계산 및 타이머 (서버 저장은 progress 저장 시 함께 처리)
import { generators } from "./data.js";
import { state, syncUserState, getEnergyValue, setEnergyValue } from "./state.js";
import { updateEnergyRateUI } from "./ui.js";
import { addPlainValue } from "./bigValue.js";
import { updateGeneratorState } from "./apiClient.js";
import { syncEntryBuildState } from "./generatorHelpers.js";

const HEAT_COOL_RATE = 1; // per second 자연 냉각량

async function handleExplosion(entry) {
  if (!entry) return;
  entry.running = false;
  entry.isDeveloping = true;
  entry.heat = 0;
  const rebuildMs = entry.buildDurationMs || Math.max(1000, 2 ** (entry.level || 1) * 1000);
  entry.buildCompleteTs = Date.now() + rebuildMs;
  syncEntryBuildState(entry, {
    isdeveloping: true,
    build_complete_ts: Math.ceil((entry.buildCompleteTs || Date.now()) / 1000),
    running: false,
    heat: 0,
    level: entry.level,
    cost: entry.baseCost,
  });
  try {
    await updateGeneratorState(entry.generator_id, { explode: true });
  } catch (err) {
    console.warn("failed to sync explosion state", err);
  }
}

export function computeEnergyPerSecond(deltaSeconds = 1) {
  let baseTotal = 0;
  state.placedGenerators.forEach((pg) => {
    if (!pg) return;
    // Cool down even while idle/building
    pg.heat = Math.max(0, (pg.heat || 0) - HEAT_COOL_RATE * deltaSeconds);
    if (pg.isDeveloping) return;
    if (pg.running === false) return;
    if (pg.genIndex != null && pg.genIndex >= 0) {
      const g = generators[pg.genIndex];
      const base = g ? Number(g["생산량(에너지)"]) || 0 : 0;
      baseTotal += base;
      const heatRate = typeof pg.heatRate === "number" ? pg.heatRate : (g ? Number(g["발열"]) || 0 : 0);
      pg.heat = Math.max(0, (pg.heat || 0) + heatRate * deltaSeconds);
      const tolerance = typeof pg.tolerance === "number" ? pg.tolerance : (g ? Number(g["내열한계"]) || 0 : 0);
      if (tolerance > 0 && pg.heat > tolerance) {
        handleExplosion(pg);
      }
    }
  });
  const bonus = state.currentUser ? Number(state.currentUser.production_bonus) || 0 : 0;
  const multiplier = 1 + bonus * 0.1;
  return baseTotal * multiplier;
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
