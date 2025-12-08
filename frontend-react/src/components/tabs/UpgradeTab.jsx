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
  const [amounts, setAmounts] = useState({});
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const compareMoneyWith = useStore(state => state.compareMoneyWith);

  const getUpgradeLevel = (user, upgrade) => {
    const offset = upgrade.levelDisplayOffset ?? 1;
    const base = user ? Number(user[upgrade.field]) || 0 : 0;
    return base + offset;
  };

  const getUpgradeCost = (user, upgrade) => {
    const baseLevel = user ? Number(user[upgrade.field]) || 0 : 0;
    const exponentLevel = baseLevel + (upgrade.costExponentOffset ?? 1);
    const baseCostPlain = upgrade.baseCost ?? toPlainValue(fromPlainValue(upgrade.baseCost_plain || 0));
    return Math.round(baseCostPlain * Math.pow(upgrade.priceGrowth, exponentLevel));
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

  const maxAmountFor = (upgrade) => {
    if ((upgrade.currency || 'money') === 'money') {
      return Math.max(1, 1 + (currentUser?.upgrade_batch_upgrade || 0));
    }
    return 1; // Rebirth upgrades are single-purchase only
  };

  const handleUpgrade = async (upgrade) => {
    const selectedAmount = Math.max(1, Math.min(maxAmountFor(upgrade), Number(amounts[upgrade.endpoint]) || 1));
    const costValue = getUpgradeCostForAmount(currentUser, upgrade, selectedAmount);

    if ((upgrade.currency || 'money') === 'money' && compareMoneyWith(costValue) < 0) {
      setAlertMessage('돈이 부족합니다.');
      return;
    }
    if ((upgrade.currency || 'money') === 'rebirth' && (currentUser?.rebirth_count ?? 0) < costValue) {
      setAlertMessage('환생이 부족합니다.');
      return;
    }

    try {
      const newUser = await postUpgrade(upgrade.endpoint, getAuthToken(), selectedAmount);
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
    const maxAmount = maxAmountFor(upgrade);
    const selectedAmount = Math.max(1, Math.min(maxAmount, Number(amounts[upgrade.endpoint]) || 1));
    const costValue = getUpgradeCostForAmount(currentUser, upgrade, selectedAmount);
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
          {maxAmount > 1 && (upgrade.currency || 'money') === 'money' && (
            <div className="upgrade-amount">
              <input
                type="number"
                min="1"
                max={maxAmount}
                value={selectedAmount}
                onChange={(e) => {
                  const next = Math.max(1, Math.min(maxAmount, Number(e.target.value) || 1));
                  setAmounts((prev) => ({ ...prev, [upgrade.endpoint]: next }));
                }}
              />
              <span className="amount-hint">최대 {maxAmount}회</span>
            </div>
          )}
          <button
            type="button"
            className="upgrade-card-btn"
            onClick={() => handleUpgrade(upgrade)}
          >
            {((upgrade.currency || 'money') === 'money' && selectedAmount > 1)
              ? `한번에 구매(${selectedAmount}회)`
              : '업그레이드'}
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
