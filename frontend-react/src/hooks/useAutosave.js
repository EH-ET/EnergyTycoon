import { useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { autosaveProgress } from '../utils/apiClient';
import { readStoredPlayTime } from '../utils/playTime';

export function useAutosave() {
  const currentUser = useStore(state => state.currentUser);
  const toEnergyServerPayload = useStore(state => state.toEnergyServerPayload);
  const toMoneyServerPayload = useStore(state => state.toMoneyServerPayload);
  const placedGenerators = useStore(state => state.placedGenerators);

  useEffect(() => {
    if (!currentUser) return;

    const save = async () => {
      try {
        const token = getAuthToken();
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

        await autosaveProgress(token, {
          energy_data: energyPayload.data,
          energy_high: energyPayload.high,
          money_data: moneyPayload.data,
          money_high: moneyPayload.high,
          play_time_ms: Math.floor(playTimeMs || 0),
          generators: generators.length > 0 ? generators : undefined,
        });
      } catch (e) {
        console.error('Autosave failed:', e);
        // Silent fail
      }
    };

    // 30초마다 자동 저장
    const timer = setInterval(save, 30000);

    return () => clearInterval(timer);
  }, [currentUser, placedGenerators, toEnergyServerPayload, toMoneyServerPayload]);
}
