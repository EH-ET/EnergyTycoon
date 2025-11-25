import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { readStoredPlayTime, parseServerPlayTime, persistPlayTime } from '../utils/playTime';

const TICK_MS = 1000;

export function usePlayTime() {
  const currentUser = useStore(state => state.currentUser);
  const playRef = useRef(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!currentUser) return;

    const base = Math.max(readStoredPlayTime(), parseServerPlayTime(currentUser));
    playRef.current = base;
    lastTickRef.current = Date.now();
    persistPlayTime(base);

    const tick = () => {
      const now = Date.now();
      const delta = Math.max(0, now - lastTickRef.current);
      lastTickRef.current = now;
      playRef.current += delta;
      persistPlayTime(playRef.current);
    };

    tick();
    const timer = setInterval(tick, TICK_MS);

    return () => {
      const now = Date.now();
      const delta = Math.max(0, now - lastTickRef.current);
      playRef.current += delta;
      persistPlayTime(playRef.current);
      clearInterval(timer);
    };
  }, [currentUser?.user_id]);
}
