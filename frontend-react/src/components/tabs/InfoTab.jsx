import { useState, useEffect, useRef } from 'react';
import { useStore, getAuthToken, ensureSessionStart } from '../../store/useStore';
import { formatResourceValue } from '../../utils/bigValue';
import { fetchRanks } from '../../utils/apiClient';
import { fetchMyRank } from '../../utils/apiClient';

const PLAY_TIME_KEY = 'et_play_total';

function formatPlayTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}

export default function InfoTab() {
  const currentUser = useStore(state => state.currentUser);
  const [playTime, setPlayTime] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardStatus, setLeaderboardStatus] = useState('랭킹을 불러오는 중...');
  const [myRank, setMyRank] = useState(null);
  const totalPlayRef = useRef(0);
  const lastTickRef = useRef(0);

  useEffect(() => {
    if (!currentUser) return;

    totalPlayRef.current = Math.max(0, Number(localStorage.getItem(PLAY_TIME_KEY)) || 0);
    lastTickRef.current = Date.now();

    const updatePlayTime = () => {
      const current = Date.now();
      const delta = Math.max(0, current - lastTickRef.current);
      lastTickRef.current = current;
      totalPlayRef.current += delta;
      setPlayTime(totalPlayRef.current);
      localStorage.setItem(PLAY_TIME_KEY, String(totalPlayRef.current));
    };

    updatePlayTime();
    const timer = setInterval(updatePlayTime, 1000);

    return () => {
      clearInterval(timer);
      const current = Date.now();
      const delta = Math.max(0, current - lastTickRef.current);
      totalPlayRef.current += delta;
      localStorage.setItem(PLAY_TIME_KEY, String(totalPlayRef.current));
    };
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const loadRank = async () => {
      try {
        const data = await fetchMyRank(getAuthToken());
        setMyRank(data);
      } catch (e) {
        console.error('rank load failed', e);
      }
    };

    const loadLeaderboard = async () => {
      try {
        const data = await fetchRanks(getAuthToken(), { limit: 100, offset: 0 });
        const ranks = data.ranks || [];
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

    loadRank();
    loadLeaderboard();
  }, [currentUser]);

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

  const scoreText = typeof (myRank?.score ?? currentUser.rank_score) === 'number'
    ? (myRank?.score ?? currentUser.rank_score).toLocaleString('ko-KR')
    : '-';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      maxHeight: 'none',
      overflowY: 'visible',
      padding: '12px',
      paddingRight: '16px',
      paddingBottom: '48px',
      color: '#cecece',
      background: '#0e0e0e',
      borderRadius: '8px',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <p>이름: {currentUser.username}</p>
      <p>플레이시간: {formatPlayTime(playTime)}</p>
      <p>얻은 총 에너지량: {formattedEnergy}</p>
      <p>얻은 총 돈: {formattedMoney}</p>
      <p>등수: {rankText}{scoreText !== '-' ? ` (점수 ${scoreText})` : ''}</p>

      <div style={{
        marginTop: '18px',
        marginBottom: '30px',
        padding: '12px',
        border: '1px solid #3c3c3c',
        borderRadius: '8px',
        background: '#141414',
        paddingRight: '16px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '16px', color: '#f0f0f0' }}>상위 랭커</h4>
        <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#bdbdbd' }}>{leaderboardStatus}</p>
        <ol style={{ margin: 0, paddingLeft: '20px', color: '#dedede' }}>
          {leaderboard.length === 0 ? (
            <li>표시할 랭커가 없습니다.</li>
          ) : (
            leaderboard.map((entry) => {
              const you = currentUser.username === entry.username ? ' (나)' : '';
              const score = typeof entry.score === 'number' ? entry.score.toLocaleString('ko-KR') : '-';
              return (
                <li key={entry.rank}>
                  {entry.rank}위 {entry.username} - {score}점{you}
                </li>
              );
            })
          )}
        </ol>
      </div>
    </div>
  );
}
