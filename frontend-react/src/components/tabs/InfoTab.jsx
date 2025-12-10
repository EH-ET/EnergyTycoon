import { useState, useEffect } from 'react';
import { useStore, getAuthToken, ensureSessionStart } from '../../store/useStore';
import { formatResourceValue, fromPlainValue, compareValues, valueFromServer } from '../../utils/bigValue';
import { fetchRanks } from '../../utils/apiClient';
import { fetchMyRank } from '../../utils/apiClient';
import { formatPlayTime, readStoredPlayTime, parseServerPlayTime, PLAY_TIME_EVENT } from '../../utils/playTime';

export default function InfoTab() {
  const currentUser = useStore(state => state.currentUser);
  const [playTime, setPlayTime] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState('랭킹을 불러오는 중...');
  const [myRank, setMyRank] = useState(null);
  const [rankCriteria, setRankCriteria] = useState('money'); // money, energy, playtime, rebirth

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

    const loadRank = async () => {
      try {
        const data = await fetchMyRank(rankCriteria);
        setMyRank(data);
      } catch (e) {
        console.error('rank load failed', e);
      }
    };

    const loadLeaderboard = async () => {
      try {
        const data = await fetchRanks({ limit: 100, offset: 0, criteria: rankCriteria });
        let ranks = data.ranks || [];

        if (rankCriteria === 'money' || rankCriteria === 'energy') {
          ranks.sort((a, b) => {
            const valA = a.score || { data: 0, high: 0 };
            const valB = b.score || { data: 0, high: 0 };
            return compareValues(valB, valA); // Descending sort
          });
        }

        setLeaderboard(ranks);
        if (ranks.length) {
          setLeaderboardStatus(`총 ${data.total}명 중 상위 ${ranks.length}명`);
        } else {
          setLeaderboardStatus('랭킹 데이터가 없습니다.');
        }
      } catch (e) {
        console.error('leaderboard load failed', e);
        setLeaderboardStatus('랭킹을 불러오지 못했습니다.');
      }
    };

    const loadAllRankingData = () => {
      loadRank();
      loadLeaderboard();
    };

    // 초기 로드
    loadAllRankingData();

    // 5분마다 랭킹 정보 갱신
    const intervalId = setInterval(loadAllRankingData, 5 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, [currentUser?.user_id, rankCriteria]);

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

  const rankText = typeof (myRank?.rank ?? currentUser.rank) === 'number'
    ? `${myRank?.rank ?? currentUser.rank}위`
    : '-';

  let scoreText = '-';
  const rawScore = myRank?.score ?? currentUser.rank_score;
  
  if (typeof rawScore === 'number') {
    if (rankCriteria === 'playtime') {
      scoreText = formatPlayTime(rawScore);
    } else if (rankCriteria === 'rebirth') {
      scoreText = `${rawScore}회`;
    } else if (rankCriteria === 'supercoin') {
      scoreText = `${rawScore}개`;
    } else {
      scoreText = formatResourceValue(fromPlainValue(rawScore));
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
          <div><strong>등수:</strong> {rankText}</div>
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
            {[
              { key: 'money', label: '💰' },
              { key: 'energy', label: '⚡' },
              { key: 'playtime', label: '⏱️' },
              { key: 'rebirth', label: '🔮' },
              { key: 'supercoin', label: '🪙' }
            ].map(({ key, label }) => (
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
                title={key === 'money' ? '돈' : key === 'energy' ? '에너지' : key === 'playtime' ? '플레이타임' : key === 'rebirth' ? '환생' : '슈퍼코인'}
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
                } else if (rankCriteria === 'rebirth') {
                  // Show rebirth count as number
                  score = `${entry.score || 0}회`;
                } else if (rankCriteria === 'supercoin') {
                  // Show supercoin count
                  score = `${entry.score || 0}개`;
                } else {
                  // Money or Energy - use BigValue formatting
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
