import { useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { autosaveProgress } from '../utils/apiClient';

export function useAutosave() {
  const currentUser = useStore(state => state.currentUser);
  const toEnergyServerPayload = useStore(state => state.toEnergyServerPayload);
  const toMoneyServerPayload = useStore(state => state.toMoneyServerPayload);

  useEffect(() => {
    if (!currentUser) return;

    const save = async () => {
      try {
        const token = getAuthToken();
        const energyPayload = toEnergyServerPayload();
        const moneyPayload = toMoneyServerPayload();

        await autosaveProgress(token, {
          energy: currentUser.energy,
          money: currentUser.money,
          energy_data: energyPayload.data,
          energy_high: energyPayload.high,
          money_data: moneyPayload.data,
          money_high: moneyPayload.high,
        });
      } catch (e) {
        // Silent fail
      }
    };

    // 30초마다 자동 저장
    const timer = setInterval(save, 30000);

    return () => clearInterval(timer);
  }, [currentUser]);
}
