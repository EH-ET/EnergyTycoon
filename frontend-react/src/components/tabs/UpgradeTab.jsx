import { useState } from 'react';
import './UpgradeTab.css';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { upgrades, rebirthUpgrades } from '../../utils/data';
import { postUpgrade } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue } from '../../utils/bigValue';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../../utils/tutorialEvents';
import AlertModal from '../AlertModal';

function getUpgradeLevel(user, upgrade) {
  const offset = upgrade.levelDisplayOffset ?? 1;
  const base = user ? Number(user[upgrade.field]) || 0 : 0;
  return base + offset;
}

function getUpgradeCost(user, upgrade) {
  const baseLevel = user ? Number(user[upgrade.field]) || 0 : 0;
  const exponentLevel = baseLevel + (upgrade.costExponentOffset ?? 1);
  const baseCostPlain = upgrade.baseCost ?? toPlainValue(fromPlainValue(upgrade.baseCost_plain || 0));
  return Math.round(baseCostPlain * Math.pow(upgrade.priceGrowth, exponentLevel));
}

function formatCost(cost, currency) {
  if (currency === 'rebirth') {
    return `${cost.toLocaleString('ko-KR')} 환생`;
  }
  return `${formatResourceValue(fromPlainValue(cost))} 💰`;
}

export default function UpgradeTab() {
  const [alertMessage, setAlertMessage] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const compareMoneyWith = useStore(state => state.compareMoneyWith);

  const handleUpgrade = async (upgrade) => {
    const costValue = getUpgradeCost(currentUser, upgrade);

    if ((upgrade.currency || 'money') === 'money' && compareMoneyWith(costValue) < 0) {
      setAlertMessage('돈이 부족합니다.');
      return;
    }
    if ((upgrade.currency || 'money') === 'rebirth' && (currentUser?.rebirth_count ?? 0) < costValue) {
      setAlertMessage('환생이 부족합니다.');
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

  const renderCard = (upgrade, index, pillLabel = 'Upgrade') => {
    const levelValue = getUpgradeLevel(currentUser, upgrade);
    const costValue = getUpgradeCost(currentUser, upgrade);
    const costValueDisplay = formatCost(costValue, upgrade.currency);

    return (
      <div key={`${pillLabel}-${index}`} className="upgrade-card">
        <div className="upgrade-top">
          <div className="upgrade-pill">{pillLabel}</div>
          <h3 className="upgrade-title">{upgrade.이름}</h3>
          <p className="upgrade-desc">{upgrade.설명}</p>
        </div>
        <div className="upgrade-bottom">
          <div className="upgrade-stats">
            <div className="upgrade-info">
              <span className="label">비용</span>
              <span className="value">{costValueDisplay}</span>
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
  };

  return (
    <div className="upgrade-tab-wrapper">
      <section className="upgrade-section">
        <h3 className="upgrade-section-title">돈 업그레이드</h3>
        <div className="upgrade-grid">
          {upgrades.map((upgrade, index) => renderCard(upgrade, index, 'Upgrade'))}
        </div>
      </section>

      <section className="upgrade-section">
        <h3 className="upgrade-section-title">환생 업그레이드</h3>
        <div className="upgrade-grid">
          {rebirthUpgrades.map((upgrade, index) => renderCard(upgrade, index, 'Rebirth'))}
        </div>
      </section>

      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
