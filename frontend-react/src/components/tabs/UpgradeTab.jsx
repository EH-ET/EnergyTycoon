import { useState } from 'react';
import './UpgradeTab.css';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { upgrades } from '../../utils/data';
import { postUpgrade } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue } from '../../utils/bigValue';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../../utils/tutorialEvents';
import AlertModal from '../AlertModal';

function getUpgradeLevel(user, upgrade) {
  const base = user ? Number(user[upgrade.field]) || 0 : 0;
  return base + 1;
}

function getUpgradeCost(user, upgrade) {
  const level = getUpgradeLevel(user, upgrade);
  const baseCostPlain = upgrade.baseCost ?? toPlainValue(fromPlainValue(upgrade.baseCost_plain || 0));
  return Math.round(baseCostPlain * Math.pow(upgrade.priceGrowth, level));
}

export default function UpgradeTab() {
  const [alertMessage, setAlertMessage] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const compareMoneyWith = useStore(state => state.compareMoneyWith);

  const handleUpgrade = async (upgrade) => {
    const costValue = getUpgradeCost(currentUser, upgrade);

    if (compareMoneyWith(costValue) < 0) {
      setAlertMessage('돈이 부족합니다.');
      return;
    }

    try {
      const newUser = await postUpgrade(upgrade.endpoint, getAuthToken());
      syncUserState(newUser);
      
      // Tutorial: Detect upgrade purchase
      if (currentUser?.tutorial === 8) {
        dispatchTutorialEvent(TUTORIAL_EVENTS.BUY_UPGRADE);
      }
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
    <div className="upgrade-grid">
      {upgrades.map((upgrade, index) => {
        const levelValue = getUpgradeLevel(currentUser, upgrade);
        const costValue = getUpgradeCost(currentUser, upgrade);
        const costValueDisplay = formatResourceValue(fromPlainValue(costValue));

        return (
          <div key={index} className="upgrade-card">
            <div className="upgrade-top">
              <div className="upgrade-pill">Upgrade</div>
              <h3 className="upgrade-title">{upgrade.이름}</h3>
              <p className="upgrade-desc">{upgrade.설명}</p>
            </div>
            <div className="upgrade-bottom">
              <div className="upgrade-stats">
                <div className="upgrade-info">
                  <span className="label">비용</span>
                  <span className="value">{costValueDisplay} 💰</span>
                </div>
                <div className="upgrade-info">
                  <span className="label">현재 레벨</span>
                  <span className="value">Lv. {levelValue}</span>
                </div>
              </div>
              <button
                type="button"
                className="upgrade-card-btn"
                onClick={() => handleUpgrade(upgrade)}
              >
                업그레이드
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
