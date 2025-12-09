import { useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { fetchMyRank } from '../utils/apiClient';

export function useRankUpdate() {
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);

  useEffect(() => {
    if (!currentUser) return;

    const updateRank = async () => {
      try {
        const data = await fetchMyRank('money');
        const nextUser = {
          ...currentUser,
          rank: data.rank,
          rank_score: data.score,
        };
        syncUserState(nextUser, { persist: false });
      } catch (e) {
        // Silent fail - 401 errors or other issues will be handled elsewhere
      }
    };

    // 초기 업데이트
    updateRank();

    // 5분마다 랭킹 업데이트
    const timer = setInterval(updateRank, 5 * 60 * 1000);

    return () => clearInterval(timer);
  }, [currentUser?.user_id]);
}
