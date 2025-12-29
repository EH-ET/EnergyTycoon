import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { autosaveProgress } from '../utils/apiClient';
import { readStoredPlayTime } from '../utils/playTime';
import { computeEnergyPerSecond } from '../utils/rateCalculations';
import { normalizeValue } from '../utils/bigValue';

export function useAutosave() {
  const lastSavedRef = useRef(null);

  useEffect(() => {
    const save = async () => {
      // Get current state directly from store (avoid dependency issues)
      const {
        currentUser,
        placedGenerators,
        toEnergyServerPayload,
        toMoneyServerPayload,
        isAutosaveLocked,
        setSaveStatus,
        upgradeQueue,
        globalUpgradeQueue,
        clearUpgradeQueue,
        clearGlobalUpgradeQueue,
      } = useStore.getState();

      if (!currentUser) {
        return;
      }

      if (isAutosaveLocked) {
        return;
      }

      try {
        const energyPayload = toEnergyServerPayload();
        const moneyPayload = toMoneyServerPayload();
        const playTimeMs = readStoredPlayTime();

        // Collect generator states (only valid ones with IDs)
        const generators = placedGenerators
          .filter(g => {
            if (!g) return false;
            const id = g.generator_id || g.id;
            return typeof id === 'string' && id.length > 0;
          })
          .map(g => {
            const heat = typeof g.heat === 'number' && isFinite(g.heat) 
              ? Math.floor(Math.max(0, g.heat)) 
              : 0;
            return {
              generator_id: g.generator_id || g.id,
              heat,
              running: g.running !== false,
            };
          });

        // Compute total production per second on client for validation
        const productionBV = computeEnergyPerSecond(placedGenerators, currentUser, 1);
        const productionNormalized = normalizeValue(productionBV);

        const payload = {
          energy_data: energyPayload.data,
          energy_high: energyPayload.high,
          money_data: moneyPayload.data,
          money_high: moneyPayload.high,
          production_data: productionNormalized.data,
          production_high: productionNormalized.high,
          play_time_ms: Math.floor(playTimeMs || 0),
          generators: generators.length > 0 ? generators : undefined,
          generator_upgrades: upgradeQueue.length > 0 ? upgradeQueue : undefined,
          global_upgrades: globalUpgradeQueue.length > 0 ? globalUpgradeQueue : undefined,
        };

        const hasPendingUpgrades = upgradeQueue.length > 0 || globalUpgradeQueue.length > 0;
        const payloadStr = JSON.stringify(payload);
        if (lastSavedRef.current === payloadStr && !hasPendingUpgrades) {
          return; // No changes, skip save
        }
        
        await autosaveProgress(payload);
        lastSavedRef.current = payloadStr;
        
        // Clear queues on successful save
        if (hasPendingUpgrades) {
          clearUpgradeQueue();
          clearGlobalUpgradeQueue();
        }

        setSaveStatus('success');
      } catch (e) {
        console.error('Autosave failed:', e);
        useStore.getState().setSaveStatus('error');
      }
    };

    // 1분마다 자동 저장
    const timer = setInterval(save, 60000);

    return () => {
      clearInterval(timer);
    };
  }, []); // Empty dependency array - only run once on mount
}
