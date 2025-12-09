import { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE } from '../utils/data';
import { useStore, getAuthToken } from '../store/useStore';

const DEBOUNCE_MS = 1000;
const SYNC_INTERVAL_MS = 10_000;

// Helper to shallow compare client state snapshots
function isSameState(a, b) {
  if (!a || !b) return false;
  return (
    a.energy?.data === b.energy?.data &&
    a.energy?.high === b.energy?.high &&
    a.money?.data === b.money?.data &&
    a.money?.high === b.money?.high &&
    a.production_bonus === b.production_bonus &&
    a.heat_reduction === b.heat_reduction &&
    a.tolerance_bonus === b.tolerance_bonus &&
    a.demand_bonus === b.demand_bonus
  );
}

export function useGameSync() {
  const [pendingActions, setPendingActions] = useState([]);
  const lastClientStateRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const intervalRef = useRef(null);
  const isSyncingRef = useRef(false);
  const syncErrorRef = useRef(null);

  const getClientState = useCallback(() => {
    const user = useStore.getState().currentUser;
    if (!user) return null;
    return {
      energy: user.energy_value || user.energy_view || { data: 0, high: 0 },
      money: user.money_value || user.money_view || { data: 0, high: 0 },
      production_bonus: user.production_bonus || 0,
      heat_reduction: user.heat_reduction || 0,
      tolerance_bonus: user.tolerance_bonus || 0,
      demand_bonus: user.demand_bonus || 0,
      timestamp: Date.now(),
    };
  }, []);

  const triggerSync = useCallback(async (reason = 'manual') => {
    if (isSyncingRef.current) return;
    const clientState = getClientState();
    if (!clientState) return;

    const hasStateChange = !isSameState(lastClientStateRef.current, clientState);
    if (!hasStateChange && pendingActions.length === 0) return;

    isSyncingRef.current = true;
    syncErrorRef.current = null;

    try {
      const res = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ actions: pendingActions, clientState }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'sync failed');

      useStore.getState().syncUserState(data.user, { persist: true });
      lastClientStateRef.current = clientState;
      setPendingActions([]);
    } catch (err) {
      console.error('Sync error:', err, 'reason:', reason);
      syncErrorRef.current = err;
    } finally {
      isSyncingRef.current = false;
    }
  }, [getClientState, pendingActions]);

  const enqueueAction = useCallback((action) => {
    setPendingActions((prev) => [...prev, { ...action, ts: Date.now() }]);
    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      triggerSync('debounce');
    }, DEBOUNCE_MS);
  }, [triggerSync]);

  useEffect(() => {
    intervalRef.current = setInterval(() => triggerSync('interval'), SYNC_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [triggerSync]);

  useEffect(() => () => {
    clearTimeout(debounceTimerRef.current);
    clearInterval(intervalRef.current);
    if (pendingActions.length) {
      triggerSync('unmount');
    }
  }, [pendingActions, triggerSync]);

  return {
    enqueueAction,
    triggerSync,
    pendingActions,
    syncError: syncErrorRef.current,
  };
}

export default useGameSync;
