import { useState } from 'react';
import './UpgradeTab.css';
import { useStore } from '../../store/useStore';
import { upgrades, rebirthUpgrades, sparkleUpgrades } from '../../utils/data';
import { fromPlainValue, formatResourceValue, toPlainValue, multiplyValues, powerOf, addValues, compareValues, subtractValues } from '../../utils/bigValue';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../../utils/tutorialEvents';
import AlertModal from '../AlertModal';

export default function UpgradeTab() {
  const [alertMessage, setAlertMessage] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const compareMoneyWith = useStore(state => state.compareMoneyWith);
  const compareElectronicSparkleWith = useStore(state => state.compareElectronicSparkleWith);
  const addGlobalUpgradeToQueue = useStore(state => state.addGlobalUpgradeToQueue);

  const getUpgradeBatchLimit = (user) => {
    const level = Number(user?.upgrade_batch_upgrade) || 0;
    return Math.max(1, 1 + level);
  };

  const getUpgradeLevel = (user, upgrade) => {
    const offset = upgrade.levelDisplayOffset ?? 1;
    const base = user ? Number(user[upgrade.field]) || 0 : 0;
    return base + offset;
  };

  const powerOfBigValue = (base, exp) => {
    let res = fromPlainValue(1);
    for (let i = 0; i < exp; i++) {
      res = multiplyValues(res, base);
    }
    return res;
  };

  const getPolynomialUpgradeCostForAmount = (user, upgrade, amount) => {
    const baseLevel = user ? Number(user[upgrade.field]) || 0 : 0;
    const baseCost = typeof upgrade.baseCost_plain === 'object' 
      ? upgrade.baseCost_plain 
      : fromPlainValue(upgrade.baseCost_plain || 0);
    const exponent = upgrade.costExponent || 1;
    
    let totalCost = fromPlainValue(0);

    for (let i = 0; i < amount; i++) {
      const levelToBuy = baseLevel + i + 1;
      const levelToBuyBV = fromPlainValue(levelToBuy);
      const levelPowered = powerOfBigValue(levelToBuyBV, exponent);
      const costForLevel = multiplyValues(baseCost, levelPowered);
      totalCost = addValues(totalCost, costForLevel);
    }
    return totalCost;
  };

  const getUpgradeCostForAmount = (user, upgrade, amount) => {
    if (upgrade.costModel === 'polynomial') {
      if (upgrade.currency === 'rebirth') {
        const baseLevel = user ? Number(user[upgrade.field]) || 0 : 0;
        const baseCost = upgrade.baseCost_plain || 0;
        const exponent = upgrade.costExponent || 1;
        let totalCost = 0;
        for (let i = 0; i < amount; i++) {
          const levelToBuy = baseLevel + i + 1;
          totalCost += baseCost * Math.pow(levelToBuy, exponent);
        }
        return Math.round(totalCost);
      }
      return getPolynomialUpgradeCostForAmount(user, upgrade, amount);
    }

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
    if (currency === 'sparkle') {
      const costBV = typeof cost === 'number' ? fromPlainValue(cost) : cost;
      return `${formatResourceValue(costBV)} 🔥`;
    }
    const costBV = typeof cost === 'number' ? fromPlainValue(cost) : cost;
    return `${formatResourceValue(costBV)} 💰`;
  };

  const getMaxAffordableAmount = (upgrade) => {
    if ((upgrade.currency || 'money') !== 'money') return 1;
    const batchLimit = getUpgradeBatchLimit(currentUser);
    let low = 1;
    let high = batchLimit;
    let maxAffordable = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (mid === 0) {
        break;
      }
      const costValue = getUpgradeCostForAmount(currentUser, upgrade, mid);
      
      let canAfford = false;
      if (upgrade.costModel === 'polynomial') {
        canAfford = compareValues(useStore.getState().getMoneyValue(), costValue) >= 0;
      } else {
        canAfford = compareMoneyWith(costValue) >= 0;
      }

      if (canAfford) {
        maxAffordable = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return Math.max(1, maxAffordable);
  };

  const handleUpgrade = async (upgrade, mode = 'max') => {
    const isMoneyUpgrade = (upgrade.currency || 'money') === 'money';
    const batchLimit = isMoneyUpgrade ? getUpgradeBatchLimit(currentUser) : 1;
    const targetAmount = (() => {
      if (!isMoneyUpgrade) return 1;
      if (mode === 'single') return 1;
      return getMaxAffordableAmount(upgrade);
    })();

    const rawAmount = Math.min(Math.max(1, targetAmount), batchLimit);
    const actualAmount = Number.isFinite(rawAmount) && rawAmount > 0 ? Math.floor(rawAmount) : 1;

    const costValue = getUpgradeCostForAmount(currentUser, upgrade, actualAmount);

    if ((upgrade.currency || 'money') === 'money') {
      if (upgrade.costModel === 'polynomial') {
        if (compareValues(useStore.getState().getMoneyValue(), costValue) < 0) {
          setAlertMessage('돈이 부족합니다.');
          return;
        }
      } else if (compareMoneyWith(costValue) < 0) {
        setAlertMessage('돈이 부족합니다.');
        return;
      }
    } else if (upgrade.currency === 'rebirth') {
      if ((currentUser?.rebirth_count ?? 0) < costValue) {
        setAlertMessage('환생이 부족합니다.');
        return;
      }
    } else if (upgrade.currency === 'sparkle') {
      if (compareValues(useStore.getState().getElectronicSparkleValue(), costValue) < 0) {
        setAlertMessage('스파클이 부족합니다.');
        return;
      }
    }

    // 1. Queue에 업그레이드 추가
    addGlobalUpgradeToQueue({ upgrade, amount: actualAmount });

    // 2. 즉시 로컬 상태 업데이트 (프론트엔드에서 실시간 반영)
    if ((upgrade.currency || 'money') === 'money') {
      const { getMoneyValue, setMoneyValue } = useStore.getState();
      if (upgrade.costModel === 'polynomial') {
        setMoneyValue(subtractValues(getMoneyValue(), costValue));
      } else {
        const { subtractFromMoney } = useStore.getState();
        subtractFromMoney(costValue);
      }
    } else if (upgrade.currency === 'sparkle') {
        const { getElectronicSparkleValue, setElectronicSparkleValue } = useStore.getState();
        setElectronicSparkleValue(subtractValues(getElectronicSparkleValue(), costValue));
    }


    // 최신 사용자 상태를 가져와서 안전하게 덮어쓰기
    const baseUser = useStore.getState().currentUser || currentUser || {};
    const updatedUser = { ...baseUser };

    if (upgrade.currency === 'rebirth') {
      updatedUser.rebirth_count = (updatedUser.rebirth_count || 0) - costValue;
    }

    // 업그레이드 레벨 증가
    if (upgrade.field) {
      updatedUser[upgrade.field] = (updatedUser[upgrade.field] || 0) + actualAmount;
    }

    // 로컬 상태 업데이트 (persist: false로 서버 동기화는 나중에)
    syncUserState(updatedUser, { persist: false });

    // Tutorial 이벤트 - 전체 생산량 증가 구매 시
    if (upgrade.field === 'production_bonus') {
      dispatchTutorialEvent(TUTORIAL_EVENTS.BUY_PRODUCTION_UPGRADE);
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
    const singleCost = getUpgradeCostForAmount(currentUser, upgrade, 1);
    const singleCostDisplay = formatCost(singleCost, upgrade.currency);

    const isMoneyUpgrade = (upgrade.currency || 'money') === 'money';
    const batchLimit = isMoneyUpgrade ? getUpgradeBatchLimit(currentUser) : 1;

    // Calculate max affordable amount for display purposes (similar to handleUpgrade)
    const maxAffordableAmountDisplay = isMoneyUpgrade ? getMaxAffordableAmount(upgrade) : 1;
    const maxCostForDisplay = getUpgradeCostForAmount(currentUser, upgrade, maxAffordableAmountDisplay);
    const maxCostDisplay = formatCost(maxCostForDisplay, upgrade.currency);


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
              <span className="label">다음 비용</span>
              <span className="value">{singleCostDisplay}</span>
            </div>
            {maxAffordableAmountDisplay > 1 && (
              <div className="upgrade-info">
                <span className="label">최대 구매 비용</span>
                <span className="value">{maxCostDisplay}</span>
              </div>
            )}
            {isMoneyUpgrade && (
              <div className="upgrade-info">
                <span className="label">일괄 구매 한도</span>
                <span className="value">{batchLimit}회</span>
              </div>
            )}
            <div className="upgrade-info">
              <span className="label">현재 레벨</span>
              <span className="value">Lv. {levelValue}</span>
            </div>
          </div>
          <div className="upgrade-actions">
            <button
              type="button"
              className="upgrade-card-btn secondary"
              onClick={() => handleUpgrade(upgrade, 'single')}
            >
              1회 업그레이드
            </button>
            {isMoneyUpgrade && (
              <button
                type="button"
                className="upgrade-card-btn"
                onClick={() => handleUpgrade(upgrade, 'max')}
              >
                {maxAffordableAmountDisplay > 1
                  ? `가능한 최대 (${maxAffordableAmountDisplay}회)`
                  : '가능한 최대'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const combined = [
    ...upgrades.map((u) => ({ ...u, pill: 'Upgrade' })),
    ...sparkleUpgrades.map((u) => ({ ...u, pill: 'Sparkle' })),
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
