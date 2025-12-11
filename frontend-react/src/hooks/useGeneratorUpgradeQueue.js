import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { bulkUpgradeGenerators } from '../utils/apiClient';

export function useGeneratorUpgradeQueue() {
  const upgradeQueue = useStore(state => state.upgradeQueue);
  const clearUpgradeQueue = useStore(state => state.clearUpgradeQueue);
  const syncUserState = useStore(state => state.syncUserState);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);

  const isSyncing = useRef(false);

  useEffect(() => {
    const syncPendingUpgrades = async () => {
      if (isSyncing.current || upgradeQueue.length === 0) {
        return;
      }

      isSyncing.current = true;
      const upgradesToSync = [...upgradeQueue];
      clearUpgradeQueue();

      try {
        const result = await bulkUpgradeGenerators(upgradesToSync);

        if (result.user) {
          syncUserState(result.user);
        }
        if (result.generators) {
          const { placedGenerators } = useStore.getState();
          const serverGensMap = new Map(result.generators.map(g => [g.generator_id, g]));
          
          const updatedGenerators = placedGenerators.map(localGen => {
            const serverGen = serverGensMap.get(localGen.generator_id);
            if (serverGen) {
                // Merge server data into local data, preserving client-side properties
                return { ...localGen, ...serverGen };
            }
            return localGen;
          });
          setPlacedGenerators(updatedGenerators);
        }
      } catch (e) {
        console.error('Generator upgrade sync failed:', e);
        // In case of failure, the optimistic updates will be corrected on the next full page load or sync.
        // For now, we log the error. The server is the source of truth, and a full sync will fix discrepancies.
      } finally {
        isSyncing.current = false;
      }
    };

    const intervalId = setInterval(syncPendingUpgrades, 60 * 1000);

    // Optional: Also trigger sync when window loses focus (user switches tabs)
    window.addEventListener('beforeunload', syncPendingUpgrades);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', syncPendingUpgrades);
      // Attempt to sync any remaining items when the component unmounts
      syncPendingUpgrades();
    };
  }, [upgradeQueue, clearUpgradeQueue, syncUserState, setPlacedGenerators]);
}
