import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { postBulkUpgrades, autosaveProgress } from '../utils/apiClient';
import { readStoredPlayTime } from '../utils/playTime';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../utils/tutorialEvents';

export function useGlobalUpgradeQueue() {
  const globalUpgradeQueue = useStore(state => state.globalUpgradeQueue);
  const clearGlobalUpgradeQueue = useStore(state => state.clearGlobalUpgradeQueue);
  const syncUserState = useStore(state => state.syncUserState);
  const isSyncing = useRef(false);

  useEffect(() => {
    const syncPendingUpgrades = async () => {
      const { currentUser } = useStore.getState();
      if (isSyncing.current || globalUpgradeQueue.length === 0 || !currentUser) {
        return;
      }

      isSyncing.current = true;
      const upgradesToSync = [...globalUpgradeQueue];
      clearGlobalUpgradeQueue();

      try {
        const upgradesPayload = upgradesToSync.map(({ upgrade, amount }) => ({
          endpoint: upgrade.endpoint,
          amount: Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 1
        }));

        const result = await postBulkUpgrades(upgradesPayload);

        if (result.user) {
          syncUserState(result.user);
        }

        // This autosave call was in the original UpgradeTab.jsx logic.
        // It seems to ensure the absolute latest state is saved after a bulk action.
        const { toEnergyServerPayload, toMoneyServerPayload } = useStore.getState();
        await autosaveProgress({
          energy_data: toEnergyServerPayload().data,
          energy_high: toEnergyServerPayload().high,
          money_data: toMoneyServerPayload().data,
          money_high: toMoneyServerPayload().high,
          play_time_ms: readStoredPlayTime(),
          supercoin: useStore.getState().currentUser?.supercoin || 0,
        });

        if (currentUser?.tutorial === 8 && upgradesToSync.length > 0) {
          dispatchTutorialEvent(TUTORIAL_EVENTS.BUY_UPGRADE);
        }
      } catch (e) {
        console.error('Global upgrade sync failed:', e);
        // On failure, state will be corrected on next full reload.
        // The localStorage queue will be cleared, so failed optimistic updates are lost.
        // This is a trade-off to prevent repeatedly trying a failed request.
        // A more advanced implementation might re-add failed items to the queue.
      } finally {
        isSyncing.current = false;
      }
    };

    const intervalId = setInterval(syncPendingUpgrades, 60 * 1000);
    window.addEventListener('beforeunload', syncPendingUpgrades);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', syncPendingUpgrades);
      syncPendingUpgrades();
    };
  }, [globalUpgradeQueue, clearGlobalUpgradeQueue, syncUserState]);
}
