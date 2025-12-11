import { useEffect, useRef } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { autosaveProgress } from '../utils/apiClient';
import { readStoredPlayTime } from '../utils/playTime';
import { computeEnergyPerSecond } from './useEnergyTimer';
import { normalizeValue } from '../utils/bigValue';

export function useAutosave() {
  const currentUser = useStore(state => state.currentUser);
  const toEnergyServerPayload = useStore(state => state.toEnergyServerPayload);
  const toMoneyServerPayload = useStore(state => state.toMoneyServerPayload);
  const placedGenerators = useStore(state => state.placedGenerators);
  const lastSavedRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;

    const save = async () => {
      if (useStore.getState().isAutosaveLocked) {
        console.log("Autosave is locked, skipping.");
        return;
      }

      try {
        const energyPayload = toEnergyServerPayload();
        const moneyPayload = toMoneyServerPayload();
        const playTimeMs = readStoredPlayTime();

        // Collect generator states (only valid ones with IDs)
        const generators = placedGenerators
          .filter(g => g && (g.generator_id || g.id))
          .map(g => ({
            generator_id: g.generator_id || g.id,
            heat: typeof g.heat === 'number' ? g.heat : 0,
            running: g.running !== false,
          }));

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
          supercoin: currentUser?.supercoin || 0,
          generators: generators.length > 0 ? generators : undefined,
        };

        // Skip if data hasn't changed (compare with last saved)
        const payloadStr = JSON.stringify(payload);
        if (lastSavedRef.current === payloadStr) {
          console.log("Autosave skipped: no changes detected");
          return; // No changes, skip save
        }

        console.log("Autosave executing...", { energy: energyPayload, money: moneyPayload });
        await autosaveProgress(payload);
        lastSavedRef.current = payloadStr;
        useStore.getState().setSaveStatus('success');
        console.log("Autosave successful");
      } catch (e) {
        console.error('Autosave failed:', e);
        useStore.getState().setSaveStatus('error');
      }
    };

    // 2분마다 자동 저장 (트래픽 75% 감소)
    const timer = setInterval(save, 120000);

    return () => clearInterval(timer);
  }, [currentUser, placedGenerators, toEnergyServerPayload, toMoneyServerPayload]);
}
