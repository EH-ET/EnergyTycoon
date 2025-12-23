import { useEffect, useRef } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { generators } from '../utils/data';
import { addValues, multiplyByFloat } from '../utils/bigValue';
import { loadProgress, awardSupercoin } from '../utils/apiClient';
import { getBuildDurationMs, normalizeServerGenerators } from '../utils/generatorHelpers';

const HEAT_COOL_RATE = 1; // per second 자연 냉각량

function handleExplosion(entry) {
  if (!entry) return null;
  const meta = entry.genIndex != null && entry.genIndex >= 0 ? generators[entry.genIndex] : null;
  const rebuildMs = entry.baseBuildDurationMs
    || entry.buildDurationMs
    || getBuildDurationMs(meta);

  return {
    ...entry,
    running: false,
    isDeveloping: true,
    heat: 0,
    buildCompleteTs: Date.now() + rebuildMs,
  };
}

function applyHeatReduction(heatRate, upgrades = {}) {
  const lvl = upgrades.heat_reduction || 0;
  if (!lvl) return heatRate;
  // 발열 감소: 10% 감소 per level (곱연산 적용: 0.9^level)
  const factor = Math.pow(0.9, lvl);
  return heatRate * factor;
}

export function useEnergyTimer() {
  const currentUser = useStore(state => state.currentUser);
  const placedGenerators = useStore(state => state.placedGenerators);
  const userId = currentUser?.user_id;
  const getEnergyValue = useStore(state => state.getEnergyValue);
  const setEnergyValue = useStore(state => state.setEnergyValue);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);
  const removePlacedGenerator = useStore(state => state.removePlacedGenerator);
  const updatePlacedGenerator = useStore(state => state.updatePlacedGenerator);
  const recalculateRates = useStore(state => state.recalculateRates);

  useEffect(() => {
    recalculateRates();
  }, [currentUser, placedGenerators, recalculateRates]);

  useEffect(() => {
    if (!userId) return;

    let lastTick = Date.now();

    const tick = () => {
      const now = Date.now();
      const deltaSeconds = Math.max(0.5, (now - lastTick) / 1000);
      lastTick = now;

      const { 
        placedGenerators, 
        currentUser: userFromStore,
        energyRate,
        sparkleRate,
        getElectronicSparkleValue,
        setElectronicSparkleValue
      } = useStore.getState();

      if (!placedGenerators || placedGenerators.length === 0) return;

      const userHeatReduction = Number(userFromStore?.heat_reduction) || 0;
      const userToleranceBonus = Number(userFromStore?.tolerance_bonus) || 0;
      
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

        const baseHeatRate = typeof next.heatRate === "number" ? next.heatRate : (meta ? Number(meta["발열"]) || 0 : 0);
        const productionHeat = (upgrades.production || 0) * 0.5;
        let heatRate = baseHeatRate + productionHeat;

        heatRate = applyHeatReduction(heatRate, upgrades);
        const userHeatMultiplier = Math.max(0.1, 1 - 0.1 * userHeatReduction);
        heatRate *= userHeatMultiplier;
        next.heat = Math.max(0, (next.heat || 0) + heatRate * deltaSeconds);

        const baseTolerance = typeof next.baseTolerance === "number"
          ? next.baseTolerance
          : typeof next.tolerance === "number"
            ? next.tolerance
            : (meta ? Number(meta["내열한계"]) || 0 : 0);
        const toleranceBuff = baseTolerance + (upgrades.tolerance || 0) * 10 + userToleranceBonus * 10;
        if (toleranceBuff > 0 && next.heat > toleranceBuff) {
          return handleExplosion(next);
        }

        return next;
      });

      setPlacedGenerators(updated);

      if (sparkleRate && (sparkleRate.data > 0 || sparkleRate.high > 0)) {
        const currentSparkles = getElectronicSparkleValue();
        const sparkleGainThisTick = multiplyByFloat(sparkleRate, deltaSeconds);
        const newSparkles = addValues(currentSparkles, sparkleGainThisTick);
        setElectronicSparkleValue(newSparkles);
      }

      if (energyRate && (energyRate.data > 0 || energyRate.high > 0)) {
        const energyGainThisTick = multiplyByFloat(energyRate, deltaSeconds);
        const nextValue = addValues(getEnergyValue(), energyGainThisTick);
        setEnergyValue(nextValue);

        const runningCount = placedGenerators.filter(pg => pg && !pg.isDeveloping && pg.running !== false).length;
        if (runningCount > 0) {
          const chance = runningCount / 1_000_000;
          if (Math.random() < chance) {
            (async () => {
              try {
                const result = await awardSupercoin();
                const { syncUserState } = useStore.getState();
                syncUserState({ supercoin: result.supercoin });
                console.log(`🪙 Supercoin acquired! Total: ${result.supercoin}`);
              } catch (err) {
                console.error('Failed to award supercoin:', err);
              }
            })();
          }
        }
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
    };
  }, [userId, setPlacedGenerators, setEnergyValue, getEnergyValue, updatePlacedGenerator, removePlacedGenerator]);
}
