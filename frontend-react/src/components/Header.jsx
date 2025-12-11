import { useEffect, useRef, useState } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { formatResourceValue } from '../utils/bigValue';
import { useEnergyRate } from '../hooks/useEnergyTimer';
import { fetchExchangeRate, fetchMyRank } from '../utils/apiClient';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../utils/tutorialEvents';
import SettingsModal from './SettingsModal';
import RebirthModal from './RebirthModal';

// Cache profile rank fetches across component mounts (5-minute TTL)
const profileRankCache = {
  timestamp: 0,
  data: null,
};

export default function Header() {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMoneyModal, setShowMoneyModal] = useState(false);
  const [showEnergyModal, setShowEnergyModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRebirthModal, setShowRebirthModal] = useState(false);
  const [isRankLoading, setIsRankLoading] = useState(false);

  const currentUser = useStore(state => state.currentUser);
  const placedGenerators = useStore(state => state.placedGenerators);
  const exchangeRate = useStore(state => state.exchangeRate);
  const setExchangeRate = useStore(state => state.setExchangeRate);
  const energyRate = useEnergyRate();
  const syncUserState = useStore(state => state.syncUserState);
  const profileRef = useRef(null);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  const handleProfileClick = (e) => {
    e.stopPropagation();
    setShowProfileModal(!showProfileModal);
    
    // Tutorial: Detect profile click
    if (currentUser?.tutorial === 6) {
      dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_PROFILE);
    }
  };

  const handleOpenSettings = (event) => {
    event.stopPropagation();
    setShowProfileModal(false);
    setShowSettingsModal(true);
  };

  const refreshRank = async () => {
    const current = useStore.getState().currentUser;

    if (!current?.user_id) {
      return;
    }

    const now = Date.now();
    const FIVE_MINUTES = 5 * 60 * 1000;

    // Use cached rank if within TTL
    if (profileRankCache.data && now - profileRankCache.timestamp < FIVE_MINUTES) {
      const cached = profileRankCache.data;
      const latestUser = useStore.getState().currentUser;
      if (latestUser) {
        syncUserState({
          ...latestUser,
          rank: cached.rank,
          rank_score: cached.score,
        }, { persist: false });
      }
      return;
    }

    setIsRankLoading(true);
    try {
      const data = await fetchMyRank('money');
      profileRankCache.data = data;
      profileRankCache.timestamp = Date.now();

      const latestUser = useStore.getState().currentUser;
      if (latestUser) {
        syncUserState({
          ...latestUser,
          rank: data.rank,
          rank_score: data.score,
        }, { persist: false });
      }
    } finally {
      setIsRankLoading(false);
    }
  };

  const ensureExchangeRate = async () => {
    if (typeof exchangeRate === 'number' && Number.isFinite(exchangeRate)) return;
    try {
      const data = await fetchExchangeRate(getAuthToken());
      if (data?.rate != null) {
        setExchangeRate(data.rate);
      }
    } catch (e) {
      // Silent fail
    }
  };

  useEffect(() => {
    if (!showProfileModal) return;

    refreshRank();

    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfileModal(false);
      }
    };

    const handleEsc = (event) => {
      if (event.key === 'Escape') setShowProfileModal(false);
    };

    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showProfileModal]);

  const generatorCount = placedGenerators.length;
  const maxGenerators = 10 + (currentUser?.max_generators_bonus || 0);

  useEffect(() => {
    ensureExchangeRate();
  }, [currentUser?.user_id]);

  const saveStatus = useStore(state => state.saveStatus);
  const [timeSinceLastSave, setTimeSinceLastSave] = useState('');

  useEffect(() => {
    const updateTimeSince = () => {
      if (!saveStatus?.timestamp) {
        setTimeSinceLastSave('');
        return;
      }

      const now = Date.now();
      const diff = Math.floor((now - saveStatus.timestamp) / 1000); // seconds

      if (diff < 60) {
        setTimeSinceLastSave(`${diff}초 전`);
      } else {
        const minutes = Math.floor(diff / 60);
        setTimeSinceLastSave(`${minutes}분 전`);
      }
    };

    updateTimeSince();
    const timer = setInterval(updateTimeSince, 1000); // Update every second
    return () => clearInterval(timer);
  }, [saveStatus]);

  return (
    <header className="header">
      <div className="header-left">
        <div
          ref={profileRef}
          className={`profile ${showProfileModal ? 'profile-open' : ''}`}
          style={{ position: 'relative' }}
        >
          <button
            className="profile-trigger"
            type="button"
            aria-label="프로필 메뉴 열기"
            onClick={handleProfileClick}
            style={{ cursor: 'pointer' }}
          />
          {showProfileModal && (
            <div
              className={`profile-modal modal ${showProfileModal ? 'is-open' : ''}`}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '8px',
                zIndex: 1000,
                background: '#0c0c0c',
                color: '#f1f1f1',
                border: '1px solid #2a2a2a',
                borderRadius: '10px',
                padding: '12px',
                minWidth: '200px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.35)'
              }}
            >
              <p className="modal-line profile-name" style={{ margin: '0 0 8px' }}>
                <strong style={{ color: '#fff' }}>이름:</strong> {currentUser?.username || 'NONE'}
              </p>
              <p className="modal-line profile-rank" style={{ margin: '0 0 12px' }}>
                <strong style={{ color: '#fff' }}>랭킹:</strong> {
                  isRankLoading 
                    ? '로딩 중...' 
                    : (typeof currentUser?.rank === 'number' ? `${currentUser.rank}위` : '-')
                }
              </p>
              <div className="modal-actions" style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="modal-button settings-open-btn"
                  type="button"
                  style={{ flex: 1, color: '#fff', borderColor: '#444' }}
                  onClick={handleOpenSettings}
                >
                  설정
                </button>
                <button
                  className="modal-button logout-btn"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowProfileModal(false);
                    handleLogout();
                  }}
                  style={{ flex: 1, color: '#fff', borderColor: '#444' }}
                >
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
        {timeSinceLastSave && (
          <span style={{
            marginLeft: '16px',
            fontSize: '12px',
            fontWeight: '500',
            padding: '4px 10px',
            borderRadius: '8px',
            background: 'rgba(128, 128, 128, 0.15)',
            color: '#999',
            border: '1px solid rgba(128, 128, 128, 0.2)',
            transition: 'all 0.3s ease'
          }}>
            저장: {timeSinceLastSave}
          </span>
        )}
      </div>
      <div className="header-right">
        <button
          type="button"
          className="rebirth-trigger"
          onClick={() => setShowRebirthModal(true)}
        >
          <span className="rebirth-icon">🔮</span>
          <span className="rebirth-label">환생</span>
        </button>
        <div className="stat-card">
          <div className="stat-icon generator-icon"></div>
          <div className="stat-info">
            <div className="stat-label">발전기</div>
            <div className="stat-value generator-count">{generatorCount}/{maxGenerators}</div>
          </div>
        </div>
        <div className="stat-card">
          <div
            className="stat-icon money-icon"
            onMouseEnter={() => {
              setShowMoneyModal(true);
              ensureExchangeRate();
              // Tutorial: Detect money hover
              if (currentUser?.tutorial === 5) {
                dispatchTutorialEvent(TUTORIAL_EVENTS.HOVER_MONEY);
              }
            }}
            onMouseLeave={() => setShowMoneyModal(false)}
          >
            <div className={`money-modal modal ${showMoneyModal ? 'is-visible' : ''}`}>
              <p><strong>교환 비율</strong></p>
              <p>에너지 1 → 돈 <span className="money-rate">
                {typeof exchangeRate === 'number' && Number.isFinite(exchangeRate)
                  ? formatResourceValue({ data: (exchangeRate || 0) * 1000, high: 0 })
                  : '0'}
              </span></p>
            </div>
          </div>
          <div className="stat-info">
            <div className="stat-label">돈</div>
            <div className="stat-value money-value">
              {currentUser?.money_view ? formatResourceValue(currentUser.money_view) : '0'}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div
            className="stat-icon energy-icon"
            onMouseEnter={() => {
              setShowEnergyModal(true);
              // Tutorial: Detect energy hover
              if (currentUser?.tutorial === 4) {
                dispatchTutorialEvent(TUTORIAL_EVENTS.HOVER_ENERGY);
              }
            }}
            onMouseLeave={() => setShowEnergyModal(false)}
          >
            <div className={`energy-modal modal ${showEnergyModal ? 'is-visible' : ''}`}>
              <p><strong>초당 에너지 생산량</strong></p>
              <p><span className="energy-rate">
                {energyRate ? formatResourceValue(energyRate) : '0'}
              </span>/초</p>
            </div>
          </div>
          <div className="stat-info">
            <div className="stat-label">에너지</div>
            <div className="stat-value energy-value">
              {currentUser?.energy_view ? formatResourceValue(currentUser.energy_view) : '0'}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ 
            background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)',
            fontSize: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🪙
          </div>
          <div className="stat-info">
            <div className="stat-label">슈퍼코인</div>
            <div className="stat-value supercoin-value">
              {currentUser?.supercoin || 0}
            </div>
          </div>
        </div>
      </div>
      <SettingsModal
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
      <RebirthModal
        open={showRebirthModal}
        onClose={() => setShowRebirthModal(false)}
      />
    </header>
  );
}
