import { useEffect, useRef } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { generators } from '../utils/data';
import { valueFromServer, addValues, multiplyByFloat, normalizeValue, fromPlainValue, powerOf } from '../utils/bigValue';
import { loadProgress, awardSupercoin } from '../utils/apiClient';
import { getBuildDurationMs, normalizeServerGenerators } from '../utils/generatorHelpers';
import { readStoredPlayTime } from '../utils/playTime';

const HEAT_COOL_RATE = 1; // per second 자연 냉각량
// ENERGY_SAVE_DELAY removed - useAutosave handles all saving every 30 seconds

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

function applyUpgradeEffects(baseValue, upgrades = {}, { type }) {
  // Now works with BigValue - returns BigValue
  const level = upgrades[type] || 0;
  if (!level) return baseValue;
  const factor = 1 + 0.1 * level;
  return multiplyByFloat(baseValue, factor);
}

function applyHeatReduction(heatRate, upgrades = {}) {
  const lvl = upgrades.heat_reduction || 0;
  if (!lvl) return heatRate;
  // 발열 감소: 10% 감소 per level (곱연산 적용: 0.9^level)
  const factor = Math.pow(0.9, lvl);
  return heatRate * factor;
}

export function computeEnergyPerSecond(placedGenerators, currentUser, deltaSeconds = 1) {
  // Returns BigValue for energy per second
  let baseTotalBV = normalizeValue({ data: 0, high: 0 });
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
    // Apply upgrade effects (returns BigValue)
    const producedBV = applyUpgradeEffects(productionValue, upgrades, { type: "production" });
    // Multiply by deltaSeconds
    const producedThisPeriod = multiplyByFloat(producedBV, deltaSeconds);
    baseTotalBV = addValues(baseTotalBV, producedThisPeriod);
  });
  const bonus = currentUser ? Number(currentUser.production_bonus) || 0 : 0;
  const rebirthCount = currentUser ? Number(currentUser.rebirth_count) || 0 : 0;
  const energyMultiplier = currentUser ? Number(currentUser.energy_multiplier) || 0 : 0;

  let multiplier = 1 + bonus * 0.1;

  // Apply rebirth multiplier: 2^n
  if (rebirthCount > 0) {
    multiplier *= Math.pow(2, rebirthCount);
  }

  // Apply energy multiplier from special upgrades: 2^n
  if (energyMultiplier > 0) {
    multiplier *= Math.pow(2, energyMultiplier);
  }

  // Return BigValue with multiplier applied
  return multiplyByFloat(baseTotalBV, multiplier);
}

export function useEnergyTimer() {
  const currentUser = useStore(state => state.currentUser);
  const userId = currentUser?.user_id;
  const getEnergyValue = useStore(state => state.getEnergyValue);
  const setEnergyValue = useStore(state => state.setEnergyValue);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);
  const removePlacedGenerator = useStore(state => state.removePlacedGenerator);
  const updatePlacedGenerator = useStore(state => state.updatePlacedGenerator);

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
      const energyMultiplier = Number(userFromStore?.energy_multiplier) || 0;
      const userHeatReduction = Number(userFromStore?.heat_reduction) || 0;
      const userToleranceBonus = Number(userFromStore?.tolerance_bonus) || 0;
      const sparkleChanceUpgrade = Number(userFromStore?.sparkle_chance_upgrade) || 0;
      const sparkleAmountUpgrade = Number(userFromStore?.sparkle_amount_upgrade) || 0;
      const rebirthSparkleBonus = Number(userFromStore?.rebirth_sparkle_bonus_upgrade) || 0;
      const moneySparkleBonus = Number(userFromStore?.money_sparkle_bonus_upgrade) || 0;
      
      let multiplier = 1 + bonus * 0.1;
      
      // Apply rebirth multiplier: 2^n
      if (rebirthCount > 0) {
        multiplier *= Math.pow(2, rebirthCount);
      }
      
      // Apply energy multiplier from special upgrades: 2^n
      if (energyMultiplier > 0) {
        multiplier *= Math.pow(2, energyMultiplier);
      }

      let energyGainBV = normalizeValue({ data: 0, high: 0 }); // BigValue for total energy gain
      let sparkleGainBV = normalizeValue({ data: 0, high: 0 }); // BigValue for total sparkle gain
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

        // Sparkle Generation
        const baseSparkleChance = 0.01;
        const finalSparkleChance = baseSparkleChance + (sparkleChanceUpgrade * 0.001);
        if (Math.random() < finalSparkleChance) {
          let sparkleAmountBV = fromPlainValue(next.level || 1);

          if (sparkleAmountUpgrade > 0) {
            const power = Math.pow(2, sparkleAmountUpgrade);
            sparkleAmountBV = powerOf(sparkleAmountBV, power);
          }
          
          let multiplier = 1.0;
          if (rebirthSparkleBonus > 0) {
            multiplier *= Math.pow(2, rebirthSparkleBonus);
          }
          if (moneySparkleBonus > 0) {
            multiplier *= Math.pow(1.5, moneySparkleBonus);
          }

          if (multiplier > 1.0) {
            sparkleAmountBV = multiplyByFloat(sparkleAmountBV, multiplier);
          }
          
          sparkleGainBV = addValues(sparkleGainBV, sparkleAmountBV);
        }

        const upgrades = next.upgrades || {};
        const productionValue = valueFromServer(
          meta["생산량(에너지수)"],
          meta["생산량(에너지높이)"],
          meta["생산량(에너지)"]
        );
        // Apply upgrade effects to production (returns BigValue)
        const producedBV = applyUpgradeEffects(
          productionValue,
          upgrades,
          { type: "production" }
        );
        // Multiply by deltaSeconds
        const producedThisTick = multiplyByFloat(producedBV, deltaSeconds);
        energyGainBV = addValues(energyGainBV, producedThisTick);

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

      if (sparkleGainBV.data > 0 || sparkleGainBV.high > 0) {
        const { getElectronicSparkleValue, setElectronicSparkleValue } = useStore.getState();
        const currentSparkles = getElectronicSparkleValue();
        const newSparkles = addValues(currentSparkles, sparkleGainBV);
        setElectronicSparkleValue(newSparkles);
      }

      // Check if there's any energy gain (compare with zero)
      if (energyGainBV.data > 0 || energyGainBV.high > 0) {
        // Apply multiplier to energy gain (BigValue operation)
        const totalGainBV = multiplyByFloat(energyGainBV, multiplier);
        const nextValue = addValues(getEnergyValue(), totalGainBV);
        setEnergyValue(nextValue);

        // Supercoin chance: (running generators / 1,000,000) per second
        const runningCount = placedGenerators.filter(pg => pg && !pg.isDeveloping && pg.running !== false).length;
        if (runningCount > 0) {
          const chance = runningCount / 1_000_000;
          if (Math.random() < chance) {
            // Award 1 supercoin via server API (async IIFE)
            (async () => {
              try {
                const result = await awardSupercoin();
                const { syncUserState } = useStore.getState();
                syncUserState({ supercoin: result.supercoin });
                
                // Show notification
                console.log(`🪙 Supercoin acquired! Total: ${result.supercoin}`);
              } catch (err) {
                console.error('Failed to award supercoin:', err);
              }
            })();
          }
        }

        // Note: Energy saving is now handled by useAutosave hook (every 30 seconds)
        // Removed redundant debounced save to reduce server traffic
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

export function useEnergyRate() {
  const currentUser = useStore(state => state.currentUser);
  const placedGenerators = useStore(state => state.placedGenerators);

  if (!currentUser) return normalizeValue();
  return computeEnergyPerSecond(placedGenerators, currentUser);
}

export function computeSparklePerSecond(placedGenerators, currentUser) {
  let totalSparkleRateBV = normalizeValue({ data: 0, high: 0 });

  if (!currentUser) return totalSparkleRateBV;

  const { 
    sparkle_chance_upgrade = 0, 
    sparkle_amount_upgrade = 0, 
    rebirth_sparkle_bonus_upgrade = 0, 
    money_sparkle_bonus_upgrade = 0 
  } = currentUser;

  const baseSparkleChance = 0.01;
  const finalSparkleChance = baseSparkleChance + (sparkle_chance_upgrade * 0.001);

  placedGenerators.forEach((pg) => {
    if (!pg || pg.isDeveloping || pg.running === false) return;
    
    let levelBV = fromPlainValue(pg.level || 1);
    
    if (sparkle_amount_upgrade > 0) {
      const power = Math.pow(2, sparkle_amount_upgrade); // This will always be an integer exponent
      levelBV = powerOf(levelBV, power);
    }
    
    let multiplier = 1.0;
    if (rebirth_sparkle_bonus_upgrade > 0) {
        multiplier *= Math.pow(2, rebirth_sparkle_bonus_upgrade);
    }
    if (money_sparkle_bonus_upgrade > 0) {
        multiplier *= Math.pow(1.5, money_sparkle_bonus_upgrade);
    }

    let amountPerTickBV = multiplyByFloat(levelBV, multiplier);
    
    // Now, multiply by the chance
    const expectedSparklesBV = multiplyByFloat(amountPerTickBV, finalSparkleChance);
    
    totalSparkleRateBV = addValues(totalSparkleRateBV, expectedSparklesBV);
  });

  return totalSparkleRateBV;
}

export function useSparkleRate() {
  const currentUser = useStore(state => state.currentUser);
  const placedGenerators = useStore(state => state.placedGenerators);

  if (!currentUser) return normalizeValue();
  return computeSparklePerSecond(placedGenerators, currentUser);
}
