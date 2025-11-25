import { useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { generators } from '../utils/data';
import { addPlainValue, valueFromServer, toPlainValue } from '../utils/bigValue';
import { loadProgress, updateGeneratorState } from '../utils/apiClient';
import { getBuildDurationMs, normalizeServerGenerators } from '../utils/generatorHelpers';

const HEAT_COOL_RATE = 1; // per second 자연 냉각량

async function handleExplosion(entry, removePlacedGenerator) {
  if (!entry) return;
  entry.running = false;
  entry.isDeveloping = true;
  entry.heat = 0;
  const meta = entry.genIndex != null && entry.genIndex >= 0 ? generators[entry.genIndex] : null;
  const rebuildMs = entry.baseBuildDurationMs
    || entry.buildDurationMs
    || getBuildDurationMs(meta);
  entry.buildCompleteTs = Date.now() + rebuildMs;

  try {
    await updateGeneratorState(entry.generator_id, { explode: true });
  } catch (err) {
    // Silent fail
  }
}

function applyUpgradeEffects(baseValue, upgrades = {}, { type }) {
  const level = upgrades[type] || 0;
  if (!level) return baseValue;
  const factor = 1 + 0.1 * level;
  return baseValue * factor;
}

function applyHeatReduction(heatRate, upgrades = {}) {
  const lvl = upgrades.heat_reduction || 0;
  if (!lvl) return 0;
  const factor = Math.max(0.1, 1 - 0.1 * lvl);
  return heatRate * factor;
}

export function computeEnergyPerSecond(placedGenerators, currentUser, deltaSeconds = 1) {
  let baseTotal = 0;
  placedGenerators.forEach((pg) => {
    if (!pg || pg.isDeveloping || pg.running === false) return;
    if (pg.genIndex == null || pg.genIndex < 0) return;
    const g = generators[pg.genIndex];
    if (!g) return;
    const upgrades = pg.upgrades || {};
    const productionValue = valueFromServer(
      g["생산량(에너지수)"],
      g["생산량(에너지높이)"],
      g["생산량(에너지)"]
    );
    const base = Math.max(0, toPlainValue(productionValue));
    const produced = applyUpgradeEffects(base, upgrades, { type: "production" });
    baseTotal += produced * deltaSeconds;
  });
  const bonus = currentUser ? Number(currentUser.production_bonus) || 0 : 0;
  const multiplier = 1 + bonus * 0.1;
  return baseTotal * multiplier;
}

export function useEnergyTimer() {
  const currentUser = useStore(state => state.currentUser);
  const userId = currentUser?.user_id;
  const getEnergyValue = useStore(state => state.getEnergyValue);
  const setEnergyValue = useStore(state => state.setEnergyValue);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);
  const removePlacedGenerator = useStore(state => state.removePlacedGenerator);

  useEffect(() => {
    if (!userId) return;

    let lastTick = Date.now();

    const tick = () => {
      const now = Date.now();
      const deltaSeconds = Math.max(0.5, (now - lastTick) / 1000);
      lastTick = now;

      const { placedGenerators } = useStore.getState();
      if (!placedGenerators || placedGenerators.length === 0) return;

      const { currentUser: userFromStore } = useStore.getState();
      const bonus = Number(userFromStore?.production_bonus) || 0;
      const multiplier = 1 + bonus * 0.1;

      let energyGain = 0;
      let buildCompleted = false;
      const updated = placedGenerators.map((pg) => {
        if (!pg) return pg;
        const next = { ...pg };
        const isPaused = next.running === false;
        const coolingRate = isPaused ? HEAT_COOL_RATE : 0;

        // 냉각 처리: 운영 중단 시 초당 1씩 감소
        next.heat = Math.max(0, (next.heat || 0) - coolingRate * deltaSeconds);

        // 건설 완료 처리
        if (next.isDeveloping && next.buildCompleteTs && now >= next.buildCompleteTs) {
          next.isDeveloping = false;
          next.running = true;
          next.heat = 0;
          buildCompleted = true;
        }

        if (next.isDeveloping || isPaused) return next;

        const idx = Number(next.genIndex);
        const meta = Number.isInteger(idx) && idx >= 0 ? generators[idx] : null;
        if (!meta) return next;

        const upgrades = next.upgrades || {};
        const productionValue = valueFromServer(
          meta["생산량(에너지수)"],
          meta["생산량(에너지높이)"],
          meta["생산량(에너지)"]
        );
        const producedPerSec = applyUpgradeEffects(
          Math.max(0, toPlainValue(productionValue)),
          upgrades,
          { type: "production" }
        );
        energyGain += producedPerSec * deltaSeconds;

        let heatRate = typeof next.heatRate === "number" ? next.heatRate : (meta ? Number(meta["발열"]) || 0 : 0);
        heatRate = applyHeatReduction(heatRate, upgrades);
        heatRate += (upgrades.production || 0) * 0.5;
        next.heat = Math.max(0, (next.heat || 0) + heatRate * deltaSeconds);

        const baseTolerance = typeof next.baseTolerance === "number"
          ? next.baseTolerance
          : typeof next.tolerance === "number"
            ? next.tolerance
            : (meta ? Number(meta["내열한계"]) || 0 : 0);
        const toleranceBuff = baseTolerance + (upgrades.tolerance || 0) * 10;
        if (toleranceBuff > 0 && next.heat > toleranceBuff) {
          handleExplosion(next, removePlacedGenerator);
        }

        return next;
      });

      setPlacedGenerators(updated);

      if (energyGain > 0) {
        const totalGain = energyGain * multiplier;
        const nextValue = addPlainValue(getEnergyValue(), totalGain);
        setEnergyValue(nextValue);
      }

      if (buildCompleted && userFromStore?.user_id) {
        const token = getAuthToken();
        if (token) {
          loadProgress(userFromStore.user_id, token)
            .then((res) => {
              const { generatorTypesById } = useStore.getState();
              if (res.generators) {
                const normalized = normalizeServerGenerators(res.generators, generatorTypesById);
                setPlacedGenerators(normalized);
              }
            })
            .catch((err) => {
              console.warn('progress refresh failed', err);
            });
        }
      }
    };

    tick();
    const timer = setInterval(tick, 1000);

    return () => clearInterval(timer);
  }, [userId, setPlacedGenerators, setEnergyValue, getEnergyValue]);
}

export function useEnergyRate() {
  const currentUser = useStore(state => state.currentUser);
  const placedGenerators = useStore(state => state.placedGenerators);

  if (!currentUser) return 0;
  return computeEnergyPerSecond(placedGenerators, currentUser);
}
  // 클라이언트 측 제거(선택적)
  if (typeof removePlacedGenerator === 'function') {
    removePlacedGenerator(entry.generator_id);
  }
