import { useState } from 'react';
import './UpgradeTab.css';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { upgrades, rebirthUpgrades } from '../../utils/data';
import { postUpgrade } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue } from '../../utils/bigValue';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../../utils/tutorialEvents';
import AlertModal from '../AlertModal';

export default function UpgradeTab() {
  const [alertMessage, setAlertMessage] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const compareMoneyWith = useStore(state => state.compareMoneyWith);

  const getUpgradeLevel = (user, upgrade) => {
    const offset = upgrade.levelDisplayOffset ?? 1;
    const base = user ? Number(user[upgrade.field]) || 0 : 0;
    return base + offset;
  };

  const getUpgradeCostForAmount = (user, upgrade, amount) => {
    const baseLevel = user ? Number(user[upgrade.field]) || 0 : 0;
    const costOffset = upgrade.costExponentOffset ?? 1;
    const baseCostPlain = upgrade.baseCost ?? toPlainValue(fromPlainValue(upgrade.baseCost_plain || 0));
    if (amount <= 0) return 0;
    const growth = upgrade.priceGrowth || 1;
    if (Math.abs(growth - 1) < 1e-9) {
      return Math.round(baseCostPlain * amount);
    }
    const startExp = baseLevel + costOffset;
    const ratioPower = Math.pow(growth, amount);
    const total = baseCostPlain * Math.pow(growth, startExp) * ((ratioPower - 1) / (growth - 1));
    return Math.round(total);
  };

  const formatCost = (cost, currency) => {
    if (currency === 'rebirth') {
      return `${cost.toLocaleString('ko-KR')} 환생`;
    }
    return `${formatResourceValue(fromPlainValue(cost))} 💰`;
  };

  const handleUpgrade = async (upgrade) => {
    let actualAmount = 1; // Default to 1 for rebirth or if money calculation fails

    if ((upgrade.currency || 'money') === 'money') {
      let low = 1;
      let high = Number.MAX_SAFE_INTEGER; // Use a very large number as upper bound
      let maxAffordable = 0;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const costValue = getUpgradeCostForAmount(currentUser, upgrade, mid);
        
        // Check if costValue is a valid BigValue representation
        // compareMoneyWith expects a plain number for cost, so we need to convert BigValue cost to plain
        // However, getUpgradeCostForAmount already returns a plain number.
        // So, we can directly compare the plain cost with user's money.
        if (compareMoneyWith(costValue) >= 0) { // If affordable
          maxAffordable = mid;
          low = mid + 1;
        } else { // Not affordable
          high = mid - 1;
        }
      }
      actualAmount = Math.max(1, maxAffordable); // Ensure at least 1
    } else {
      // For rebirth upgrades, it's always 1
      actualAmount = 1;
    }

    const costValue = getUpgradeCostForAmount(currentUser, upgrade, actualAmount);

    if ((upgrade.currency || 'money') === 'money' && compareMoneyWith(costValue) < 0) {
      setAlertMessage('돈이 부족합니다.');
      return;
    }
    if ((upgrade.currency || 'money') === 'rebirth' && (currentUser?.rebirth_count ?? 0) < costValue) {
      setAlertMessage('환생이 부족합니다.');
      return;
    }

    try {
      const newUser = await postUpgrade(upgrade.endpoint, getAuthToken(), actualAmount);
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
    const costValue = getUpgradeCostForAmount(currentUser, upgrade, 1); // Display cost for 1 level
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
            최대 업그레이드
          </button>
        </div>
      </div>
    );
  };

  const combined = [
    ...upgrades.map((u) => ({ ...u, pill: 'Upgrade' })),
    ...rebirthUpgrades.map((u) => ({ ...u, pill: 'Rebirth' })),
  ];

  return (
    <div className="upgrade-tab-wrapper">
      <div className="upgrade-grid">
        {combined.map((upgrade, index) => renderCard(upgrade, index, upgrade.pill))}
      </div>

      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
