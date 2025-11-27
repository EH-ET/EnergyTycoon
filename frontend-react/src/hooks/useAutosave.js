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

    // 10초마다 자동 저장 (에너지 증가를 빠르게 반영)
    const timer = setInterval(save, 10000);

    return () => clearInterval(timer);
  }, [currentUser]);
}
