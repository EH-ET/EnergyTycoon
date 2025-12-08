import { useState } from 'react';
import './SpecialTab.css';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { API_BASE } from '../../utils/data';
import { autosaveProgress } from '../../utils/apiClient';
import { readStoredPlayTime } from '../../utils/playTime';
import AlertModal from '../AlertModal';

// Special upgrade configurations
const specialUpgrades = [
  {
    이름: '건설 시간 감소',
    설명: '발전기 건설 시간을 10%씩 감소시킵니다.',
    endpoint: 'build_speed',
    field: 'build_speed_reduction',
    maxLevel: 9,
    getBonus: (level) => `${level * 10}%`,
  },
  {
    이름: '에너지 배수',
    설명: '에너지 생산량에 추가 보너스를 적용합니다.',
    endpoint: 'energy_mult',
    field: 'energy_multiplier',
    maxLevel: null, // No max level
    getBonus: (level) => `${Math.pow(2, level)}배`,
  },
  {
    이름: '환율 배수',
    설명: '에너지당 돈 가치에 추가 보너스를 적용합니다.',
    endpoint: 'exchange_mult',
    field: 'exchange_rate_multiplier',
    maxLevel: null, // No max level
    getBonus: (level) => `${Math.pow(2, level)}배`,
  },
];

function getUpgradeLevel(user, upgrade) {
  return user ? Number(user[upgrade.field]) || 0 : 0;
}

async function postSpecialUpgrade(endpoint, token) {
  const res = await fetch(`${API_BASE}/special/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || '업그레이드 실패');
  }

  return res.json();
}

export default function SpecialTab() {
  const [alertMessage, setAlertMessage] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);

  const handleUpgrade = async (upgrade) => {
    const currentLevel = getUpgradeLevel(currentUser, upgrade);

    // Check max level
    if (upgrade.maxLevel !== null && currentLevel >= upgrade.maxLevel) {
      setAlertMessage('최대 레벨에 도달했습니다.');
      return;
    }

    // Check supercoin
    if (currentUser.supercoin < 1) {
      setAlertMessage('슈퍼코인이 부족합니다.');
      return;
    }

    try {
      // Save latest values before special upgrade (especially supercoin)
      const { toEnergyServerPayload, toMoneyServerPayload } = useStore.getState();
      const energyPayload = toEnergyServerPayload();
      const moneyPayload = toMoneyServerPayload();
      const playTimeMs = readStoredPlayTime();

      await autosaveProgress(getAuthToken(), {
        energy_data: energyPayload.data,
        energy_high: energyPayload.high,
        money_data: moneyPayload.data,
        money_high: moneyPayload.high,
        play_time_ms: playTimeMs,
        supercoin: currentUser?.supercoin || 0,
      });

      const newUser = await postSpecialUpgrade(upgrade.endpoint, getAuthToken());
      syncUserState(newUser);
    } catch (e) {
      setAlertMessage(e.message);
    }
  };

  if (!currentUser) {
    return (
      <div style={{ padding: '12px', color: '#f00' }}>
        로그인 필요
      </div>
    );
  }

  return (
    <div className="special-grid">
      {specialUpgrades.map((upgrade, index) => {
        const levelValue = getUpgradeLevel(currentUser, upgrade);
        const bonusDisplay = upgrade.getBonus(levelValue);
        const isMaxLevel = upgrade.maxLevel !== null && levelValue >= upgrade.maxLevel;

        return (
          <div key={index} className="special-card">
            <div className="special-top">
              <div className="special-pill">Special</div>
              <h3 className="special-title">{upgrade.이름}</h3>
              <p className="special-desc">{upgrade.설명}</p>
            </div>
            <div className="special-bottom">
              <div className="special-stats">
                <div className="special-info">
                  <span className="label">비용</span>
                  <span className="value">1 🪙</span>
                </div>
                <div className="special-info">
                  <span className="label">현재 레벨</span>
                  <span className="value">
                    Lv. {levelValue}
                    {upgrade.maxLevel !== null && ` / ${upgrade.maxLevel}`}
                  </span>
                </div>
                <div className="special-info">
                  <span className="label">현재 보너스</span>
                  <span className="value">{bonusDisplay}</span>
                </div>
              </div>
              <button
                type="button"
                className="special-card-btn"
                onClick={() => handleUpgrade(upgrade)}
                disabled={isMaxLevel}
              >
                {isMaxLevel ? '최대 레벨' : '업그레이드'}
              </button>
            </div>
          </div>
        );
      })}
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
