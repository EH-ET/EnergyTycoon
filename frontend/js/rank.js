import { fetchMyRank } from "./apiClient.js";
import { state, syncUserState } from "./state.js";

/**
 * Fetches the authenticated user's rank from the backend and updates local state.
 * Returns the rank payload ({ username, rank, score }) or null when not logged in.
 */
export async function updateRankFromServer() {
  if (!state.currentUser) return null;
  const data = await fetchMyRank(null);
  const nextUser = {
    ...state.currentUser,
    rank: data.rank,
    rank_score: data.score,
  };
  syncUserState(nextUser);
  return data;
}
