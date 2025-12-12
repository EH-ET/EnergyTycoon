import { useEffect, useRef } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { autosaveProgress } from '../utils/apiClient';
import { readStoredPlayTime } from '../utils/playTime';
import { computeEnergyPerSecond } from './useEnergyTimer';
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
        setSaveStatus
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
          // supercoin은 서버에서만 관리하므로 autosave에 포함하지 않음
          generators: generators.length > 0 ? generators : undefined,
        };

        // Skip if data hasn't changed (compare with last saved)
        const payloadStr = JSON.stringify(payload);
        if (lastSavedRef.current === payloadStr) {
          return; // No changes, skip save
        }

        await autosaveProgress(payload);
        lastSavedRef.current = payloadStr;
        setSaveStatus('success');
      } catch (e) {
        console.error('Autosave failed:', e);
        useStore.getState().setSaveStatus('error');
      }
    };

    // 2분마다 자동 저장 (트래픽 75% 감소)
    const timer = setInterval(save, 120000);

    return () => {
      clearInterval(timer);
    };
  }, []); // Empty dependency array - only run once on mount
}
