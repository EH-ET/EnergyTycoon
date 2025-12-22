import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { formatResourceValue, fromPlainValue, compareValues, valueFromServer } from '../../utils/bigValue';
import { fetchAllRanks, fetchMyRanks } from '../../utils/apiClient';
import { formatPlayTime, readStoredPlayTime, parseServerPlayTime, PLAY_TIME_EVENT } from '../../utils/playTime';

// Persist ranking data across component unmounts so we don't refetch on every tab re-entry
const rankCache = {
  lastFetchTime: 0,   // timestamp for the single fetch
  leaderboard: {},     // { criteria: [] }
  myRank: {},          // { criteria: {...} }
};

export default function InfoTab() {
  const currentUser = useStore(state => state.currentUser);
  const [playTime, setPlayTime] = useState(0);
  const [rankCriteria, setRankCriteria] = useState('money'); // money, energy, playtime, rebirth
  const [, forceRender] = useState(0); // force re-render when cache updates
  const [leaderboardStatus, setLeaderboardStatus] = useState('랭킹을 불러오는 중...');

  // 현재 기준의 캐시된 데이터
  const leaderboard = rankCache.leaderboard[rankCriteria] || [];
  const myRank = rankCache.myRank[rankCriteria] || null;

  const setMyRankCache = (allRanks) => {
    rankCache.myRank = allRanks;
    forceRender(v => v + 1);
  };

  const setLeaderboardCache = (allLeaderboards) => {
    rankCache.leaderboard = {};
    for (const criteria in allLeaderboards) {
      rankCache.leaderboard[criteria] = allLeaderboards[criteria].ranks || [];
    }
    forceRender(v => v + 1);
  };

  useEffect(() => {
    if (!currentUser) return;

    const base = Math.max(readStoredPlayTime(), parseServerPlayTime(currentUser));
    setPlayTime(base);

    const handleUpdate = (event) => {
      if (typeof event.detail === 'number') {
        setPlayTime(event.detail);
      } else {
        const stored = readStoredPlayTime();
        const fromServer = parseServerPlayTime(currentUser);
        setPlayTime(Math.max(stored, fromServer));
      }
    };

    document.addEventListener(PLAY_TIME_EVENT, handleUpdate);
    return () => document.removeEventListener(PLAY_TIME_EVENT, handleUpdate);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const loadAllRankingData = async () => {
      const now = Date.now();
      const timeSinceLastFetch = now - rankCache.lastFetchTime;
      const FIVE_MINUTES = 5 * 60 * 1000;

      if (timeSinceLastFetch < FIVE_MINUTES && rankCache.lastFetchTime > 0) {
        return;
      }
      
      setLeaderboardStatus('랭킹을 불러오는 중...');
      rankCache.lastFetchTime = now;

      try {
        const [myRanksData, leaderboardData] = await Promise.all([
          fetchMyRanks(),
          fetchAllRanks({ limit: 100, offset: 0 })
        ]);
        
        setMyRankCache(myRanksData);
        setLeaderboardCache(leaderboardData);

        const currentLeaderboard = leaderboardData[rankCriteria]?.ranks || [];
        if (currentLeaderboard.length) {
          setLeaderboardStatus(`총 ${leaderboardData[rankCriteria].total}명 중 상위 ${currentLeaderboard.length}명`);
        } else {
          setLeaderboardStatus('랭킹 데이터가 없습니다.');
        }

      } catch (e) {
        console.error('ranking data load failed', e);
        setLeaderboardStatus('랭킹을 불러오지 못했습니다.');
      }
    };

    loadAllRankingData();
    const intervalId = setInterval(loadAllRankingData, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [currentUser?.user_id]);
  
  useEffect(() => {
    const currentLeaderboard = rankCache.leaderboard[rankCriteria] || [];
    const total = rankCache.leaderboard[rankCriteria]?.total || 0;
    if (currentLeaderboard.length) {
      setLeaderboardStatus(`총 ${total}명 중 상위 ${currentLeaderboard.length}명`);
    } else if (rankCache.lastFetchTime > 0) {
      setLeaderboardStatus('랭킹 데이터가 없습니다.');
    }
  }, [rankCriteria]);

  if (!currentUser) {
    return (
      <div style={{ padding: '20px', color: '#fff' }}>
        로그인 후 확인하세요.
      </div>
    );
  }

  const formattedEnergy = currentUser.energy_view
    ? formatResourceValue(currentUser.energy_view)
    : currentUser.energy ?? 0;

  const formattedMoney = currentUser.money_view
    ? formatResourceValue(currentUser.money_view)
    : currentUser.money ?? 0;

  const rankText = typeof (myRank?.rank) === 'number' ? `${myRank.rank}위` : '-';

  let scoreText = '-';
  const rawScore = myRank?.score;
  
  if (rawScore) {
      if (rankCriteria === 'playtime') {
        scoreText = formatPlayTime(rawScore);
      } else if (rankCriteria === 'rebirth' || rankCriteria === 'supercoin') {
        scoreText = `${rawScore}개`;
      } else { // money, energy, sparkle
        scoreText = formatResourceValue(rawScore);
      }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1.5fr',
      gap: '12px',
      padding: '12px',
      color: '#cecece',
      background: '#0e0e0e',
      borderRadius: '8px',
      width: '100%',
      height: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }}>
      {/* 왼쪽: 사용자 정보 */}
      <div style={{
        padding: '16px',
        background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
        borderRadius: '12px',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>내 정보</h3>
        <div style={{ fontSize: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div><strong>이름:</strong> {currentUser.username}</div>
          <div><strong>플레이시간:</strong> {formatPlayTime(playTime)}</div>
          <div><strong>환생 횟수:</strong> {currentUser.rebirth_count || 0}회</div>
          <div><strong>총 에너지:</strong> {formattedEnergy}</div>
          <div><strong>총 돈:</strong> {formattedMoney}</div>
          <div><strong>등수 ({rankCriteria}):</strong> {rankText}</div>
          {scoreText !== '-' && <div><strong>점수:</strong> {scoreText}</div>}
        </div>
      </div>

      {/* 오른쪽: 랭킹 리스트 */}
      <div style={{
        padding: '16px',
        border: '2px solid #1e40af',
        borderRadius: '12px',
        background: '#141414',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, fontSize: '16px', color: '#3b82f6', fontWeight: 700 }}>🏆 랭킹</h4>
          <div style={{ display: 'flex', gap: '4px' }}>
            {[{
              key: 'money',
              label: '💰'
            }, {
              key: 'sparkle',
              label: '🔥'
            }, {
              key: 'energy',
              label: '⚡'
            }, {
              key: 'playtime',
              label: '⏱️'
            }, {
              key: 'rebirth',
              label: '🔮'
            }, {
              key: 'supercoin',
              label: '🪙'
            }].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRankCriteria(key)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: rankCriteria === key ? '2px solid #3b82f6' : '1px solid #555',
                  background: rankCriteria === key ? '#1e40af' : '#222',
                  color: rankCriteria === key ? '#fff' : '#aaa',
                  cursor: 'pointer',
                  fontWeight: rankCriteria === key ? 700 : 400,
                }}
                title={key === 'money' ? '돈' : key === 'sparkle' ? '스파클' : key === 'energy' ? '에너지' : key === 'playtime' ? '플레이타임' : key === 'rebirth' ? '환생' : '슈퍼코인'}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <span style={{ fontSize: '12px', color: '#bdbdbd', marginBottom: '8px' }}>{leaderboardStatus}</span>
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          overflowX: 'hidden',
          paddingRight: '8px'
        }}>
          <ol style={{ margin: 0, paddingLeft: '20px', color: '#dedede', fontSize: '13px' }}>
            {leaderboard.length === 0 ? (
              <li>표시할 랭커가 없습니다.</li>
            ) : (
              leaderboard.map((entry) => {
                const you = currentUser.username === entry.username;
                let score;
                if (rankCriteria === 'playtime') {
                  // Format playtime as time
                  score = formatPlayTime(entry.score || 0);
                } else if (rankCriteria === 'rebirth' || rankCriteria === 'supercoin') {
                  // Show rebirth/supercoin count as number
                  score = `${entry.score || 0}회`;
                } else {
                  // Money, Energy, Sparkle - use BigValue formatting
                  score = entry.score ? formatResourceValue(entry.score) : '-';
                }
                return (
                  <li
                    key={entry.rank}
                    style={{
                      padding: '4px 0',
                      color: you ? '#fbbf24' : '#dedede',
                      fontWeight: you ? 700 : 400
                    }}
                  >
                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>{entry.rank}위</span> {entry.username} - {score}{rankCriteria === 'rebirth' || rankCriteria === 'supercoin' || rankCriteria === 'playtime' ? '' : '점'}{you ? ' (나)' : ''}
                  </li>
                );
              })
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
