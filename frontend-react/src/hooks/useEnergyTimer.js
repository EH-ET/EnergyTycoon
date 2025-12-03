import { useEffect, useRef } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { generators } from '../utils/data';
import { addPlainValue, valueFromServer, toPlainValue } from '../utils/bigValue';
import { loadProgress, updateGeneratorState, autosaveProgress } from '../utils/apiClient';
import { getBuildDurationMs, normalizeServerGenerators } from '../utils/generatorHelpers';
import { readStoredPlayTime } from '../utils/playTime';

const HEAT_COOL_RATE = 1; // per second 자연 냉각량
const ENERGY_SAVE_DELAY = 500; // 에너지 변경 후 0.5초 후 저장

async function handleExplosion(entry, removePlacedGenerator, token, updatePlacedGenerator) {
  if (!entry) return;
  const meta = entry.genIndex != null && entry.genIndex >= 0 ? generators[entry.genIndex] : null;
  const rebuildMs = entry.baseBuildDurationMs
    || entry.buildDurationMs
    || getBuildDurationMs(meta);

  try {
    const res = await updateGeneratorState(entry.generator_id, { explode: true }, token);

    // Update generator with response from server
    if (res.generator && updatePlacedGenerator) {
      updatePlacedGenerator(entry.generator_id, (prev) => ({
        ...prev,
        running: res.generator.running !== false,
        isDeveloping: Boolean(res.generator.isdeveloping),
        heat: typeof res.generator.heat === 'number' ? res.generator.heat : 0,
        buildCompleteTs: res.generator.build_complete_ts ? res.generator.build_complete_ts * 1000 : Date.now() + rebuildMs,
        // Preserve baseCost for skip cost calculation
        baseCost: prev.baseCost || res.generator.cost || entry.baseCost,
      }));
    }
  } catch (err) {
    // Fallback to local update if server fails
    entry.running = false;
    entry.isDeveloping = true;
    entry.heat = 0;
    entry.buildCompleteTs = Date.now() + rebuildMs;
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
  if (!lvl) return heatRate;
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
  const rebirthCount = currentUser ? Number(currentUser.rebirth_count) || 0 : 0;
  
  let multiplier = 1 + bonus * 0.1;
  
  // Apply rebirth multiplier: 2^n
  if (rebirthCount > 0) {
    multiplier *= Math.pow(2, rebirthCount);
  }
  
  return baseTotal * multiplier;
}

export function useEnergyTimer() {
  const currentUser = useStore(state => state.currentUser);
  const userId = currentUser?.user_id;
  const getEnergyValue = useStore(state => state.getEnergyValue);
  const setEnergyValue = useStore(state => state.setEnergyValue);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);
  const removePlacedGenerator = useStore(state => state.removePlacedGenerator);
  const updatePlacedGenerator = useStore(state => state.updatePlacedGenerator);
  const toEnergyServerPayload = useStore(state => state.toEnergyServerPayload);

  const energySaveTimerRef = useRef(null);
  const lastSavedEnergyRef = useRef(null);

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
      const rebirthCount = Number(userFromStore?.rebirth_count) || 0;
      const userHeatReduction = Number(userFromStore?.heat_reduction) || 0;
      const userToleranceBonus = Number(userFromStore?.tolerance_bonus) || 0;
      
      let multiplier = 1 + bonus * 0.1;
      
      // Apply rebirth multiplier: 2^n
      if (rebirthCount > 0) {
        multiplier *= Math.pow(2, rebirthCount);
      }

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
        let meta = Number.isInteger(idx) && idx >= 0 ? generators[idx] : null;
        if (!meta) {
          const byId = Number(next.generator_type_id);
          if (Number.isInteger(byId) && byId >= 0 && byId < generators.length) {
            meta = generators[byId];
          } else if (next.name) {
            meta = generators.find((g) => g?.이름 === next.name);
          }
        }
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
        const userHeatMultiplier = Math.max(0.1, 1 - 0.1 * userHeatReduction);
        heatRate *= userHeatMultiplier;
        heatRate += (upgrades.production || 0) * 0.5;
        next.heat = Math.max(0, (next.heat || 0) + heatRate * deltaSeconds);

        const baseTolerance = typeof next.baseTolerance === "number"
          ? next.baseTolerance
          : typeof next.tolerance === "number"
            ? next.tolerance
            : (meta ? Number(meta["내열한계"]) || 0 : 0);
        const toleranceBuff = baseTolerance + (upgrades.tolerance || 0) * 10 + userToleranceBonus * 10;
        if (toleranceBuff > 0 && next.heat > toleranceBuff) {
          handleExplosion(next, removePlacedGenerator, getAuthToken(), updatePlacedGenerator);
        }

        return next;
      });

      setPlacedGenerators(updated);

      if (energyGain > 0) {
        const totalGain = energyGain * multiplier;
        const nextValue = addPlainValue(getEnergyValue(), totalGain);
        setEnergyValue(nextValue);

        // 에너지 변경 시 0.5초 debounce로 백엔드 저장
        if (energySaveTimerRef.current) {
          clearTimeout(energySaveTimerRef.current);
        }
        energySaveTimerRef.current = setTimeout(async () => {
          try {
            const token = getAuthToken();
            const energyPayload = toEnergyServerPayload();
            const currentEnergy = toPlainValue(getEnergyValue());
            const playTimeMs = readStoredPlayTime();

            // 이미 저장된 값과 다를 때만 저장
            if (lastSavedEnergyRef.current !== currentEnergy) {
              await autosaveProgress(token, {
                energy: currentEnergy,
                energy_data: energyPayload.data,
                energy_high: energyPayload.high,
                play_time_ms: playTimeMs,
              });
              lastSavedEnergyRef.current = currentEnergy;
            }
          } catch (e) {
            // Silent fail
          }
        }, ENERGY_SAVE_DELAY);
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

    return () => {
      clearInterval(timer);
      if (energySaveTimerRef.current) {
        clearTimeout(energySaveTimerRef.current);
      }
    };
  }, [userId, setPlacedGenerators, setEnergyValue, getEnergyValue, toEnergyServerPayload, updatePlacedGenerator, removePlacedGenerator]);
}

export function useEnergyRate() {
  const currentUser = useStore(state => state.currentUser);
  const placedGenerators = useStore(state => state.placedGenerators);

  if (!currentUser) return 0;
  return computeEnergyPerSecond(placedGenerators, currentUser);
}
