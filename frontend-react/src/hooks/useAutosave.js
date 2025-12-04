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

        // Collect generator states
        const generators = placedGenerators.map(g => ({
          generator_id: g.generator_id || g.id,
          heat: g.heat,
          running: g.running,
        }));

        await autosaveProgress(token, {
          energy_data: energyPayload.data,
          energy_high: energyPayload.high,
          money_data: moneyPayload.data,
          money_high: moneyPayload.high,
          play_time_ms: Math.floor(playTimeMs || 0),
          generators,
        });
      } catch (e) {
        // Silent fail
      }
    };

    // 30초마다 자동 저장
    const timer = setInterval(save, 30000);

    return () => clearInterval(timer);
  }, [currentUser, placedGenerators, toEnergyServerPayload, toMoneyServerPayload]);
}
