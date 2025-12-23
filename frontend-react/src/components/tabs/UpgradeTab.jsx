import { useState } from 'react';
import './UpgradeTab.css';
import { useStore } from '../../store/useStore';
import { upgrades, rebirthUpgrades, sparkleUpgrades, protonUpgrades } from '../../utils/data';
import { fromPlainValue, formatResourceValue, toPlainValue, multiplyValues, powerOf, addValues, compareValues, subtractValues } from '../../utils/bigValue';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../../utils/tutorialEvents';
import AlertModal from '../AlertModal';

export default function UpgradeTab() {
  const [selectedCategory, setSelectedCategory] = useState('money');
  const [alertMessage, setAlertMessage] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const compareMoneyWith = useStore(state => state.compareMoneyWith);
  const compareElectronicSparkleWith = useStore(state => state.compareElectronicSparkleWith);
  const addGlobalUpgradeToQueue = useStore(state => state.addGlobalUpgradeToQueue);
  const recalculateRates = useStore(state => state.recalculateRates);

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
      // Rebirth upgrade logic unified to use BigValue
      return getPolynomialUpgradeCostForAmount(user, upgrade, amount);
    }

    if (upgrade.costModel === 'linear_exponential' || upgrade.costModel === 'exponential') {
       // Proton/Complex logic - handled by server usually but here we approximate/calculate for display
       // For simple exponential: base * (mult ^ level)
       // For linear_exponential: base * (mult ^ level) * level? (Refer to backend)
       // Let's implement basics or fallback.
       // Actually backend has complex BigValue logic. For display we might need simplified or BigValue port.
       // Current upgrades:
       // Proton Demand: exponential (1M * 1M^lv)
       // Proton Energy: linear_exponential (1M * 1M^lv * lv?) -> Check backend logic.
       // Backend: cost = base * (multiplier ^ level). Linear_exp: cost * level?
       
       // Simplification: We assume 'polynomial' covers standard money upgrades.
       // For Proton upgrades with 'exponential', let's use BigValue power.
       
       const baseLevel = user ? Number(user[upgrade.field]) || 0 : 0;
       let totalCost = fromPlainValue(0);
       
       // Fallback for exponential logic if needed, but 'data.js' defines them.
       // If data.js defines 'costModel' as 'exponential', handle it.
       if (upgrade.costModel === 'exponential') {
         const base = upgrade.baseCost_plain;
         const mult = upgrade.multiplier_base;
         for (let i = 0; i < amount; i++) {
            const lvl = baseLevel + i;
            // cost = base * (mult ^ lvl)
            const p = powerOf(mult, lvl);
            const cost = multiplyValues(base, p);
            totalCost = addValues(totalCost, cost);
         }
         return totalCost;
       }
       if (upgrade.costModel === 'linear_exponential') {
         // Backend logic: cost = base * mult * (lvl + 1)
         const base = upgrade.baseCost_plain;
         const mult = upgrade.multiplier_base;
         for (let i = 0; i < amount; i++) {
            const lvl = baseLevel + i;
            const lvlMultiplier = fromPlainValue(lvl + 1);
            const baseMult = multiplyValues(base, mult);
            const term = multiplyValues(baseMult, lvlMultiplier);
            totalCost = addValues(totalCost, term);
         }
         return totalCost;
       }
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
      return `${cost.toLocaleString('ko-KR')} 🔮`;
    }
    if (currency === 'sparkle') {
      const costBV = typeof cost === 'number' ? fromPlainValue(cost) : cost;
      return `${formatResourceValue(costBV)} 🔥`;
    }
    if (currency === 'proton') {
       const costBV = typeof cost === 'number' ? fromPlainValue(cost) : cost;
       return `${formatResourceValue(costBV)} ⚛️`;
    }
    const costBV = typeof cost === 'number' ? fromPlainValue(cost) : cost;
    return `${formatResourceValue(costBV)} 💰`;
  };

  const getMaxAffordableAmount = (upgrade) => {
    // Limited MAX logic - expensive to calculate for high amounts
    // For now return 1 for complex types
    if (upgrade.costModel === 'exponential' || upgrade.costModel === 'linear_exponential') return 1;

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

    // Resource check
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
      const currentRebirth = fromPlainValue(currentUser?.rebirth_count ?? 0);
      if (compareValues(currentRebirth, costValue) < 0) {
        setAlertMessage('환생 포인트가 부족합니다.');
        return;
      }
    } else if (upgrade.currency === 'sparkle') {
      if (compareValues(useStore.getState().getElectronicSparkleValue(), costValue) < 0) {
        setAlertMessage('전자 스파클이 부족합니다.');
        return;
      }
    } else if (upgrade.currency === 'proton') {
       // Proton check
       const { proton_value, proton_data, proton_high } = useStore.getState().currentUser || {};
       const currentProton = proton_value || { data: proton_data || 0, high: proton_high || 0 };
       if (compareValues(currentProton, costValue) < 0) {
         setAlertMessage('양성자가 부족합니다.');
         return;
       }
    }

    // 1. Queue에 업그레이드 추가
    addGlobalUpgradeToQueue({ upgrade, amount: actualAmount });

    // 2. 즉시 로컬 상태 업데이트 (Simulated)
    if ((upgrade.currency || 'money') === 'money') {
      const { getMoneyValue, setMoneyValue, subtractFromMoney } = useStore.getState();
      if (upgrade.costModel === 'polynomial') {
        setMoneyValue(subtractValues(getMoneyValue(), costValue));
      } else {
        subtractFromMoney(costValue);
      }
    } else if (upgrade.currency === 'sparkle') {
        const { getElectronicSparkleValue, setElectronicSparkleValue } = useStore.getState();
        setElectronicSparkleValue(subtractValues(getElectronicSparkleValue(), costValue));
    } else if (upgrade.currency === 'proton') {
        // Proton deduct logic
        // We assume we have setProtonValue logic or similar. useStore might not have setProtonValue exposed yet directly like setMoneyValue
        // But we can manually update currentUser
        const { currentUser } = useStore.getState();
        const currentProton = currentUser.proton_value || { data: currentUser.proton_data, high: currentUser.proton_high };
        const newProton = subtractValues(currentProton, costValue);
        currentUser.proton_value = newProton;
        currentUser.proton_view = newProton;
        currentUser.proton_data = newProton.data;
        currentUser.proton_high = newProton.high;
        useStore.setState({ currentUser: { ...currentUser } });
    }

    // 최신 사용자 상태를 가져와서 안전하게 덮어쓰기
    const baseUser = useStore.getState().currentUser || currentUser || {};
    const updatedUser = { ...baseUser };

    if (upgrade.currency === 'rebirth') {
      const currentRebirth = fromPlainValue(updatedUser.rebirth_count || 0);
      const newRebirth = subtractValues(currentRebirth, costValue);
      updatedUser.rebirth_count = toPlainValue(newRebirth);
    }

    // 업그레이드 레벨 증가
    if (upgrade.field) {
      updatedUser[upgrade.field] = (updatedUser[upgrade.field] || 0) + actualAmount;
    }

    // 로컬 상태 업데이트 (persist: false로 서버 동기화는 나중에)
    syncUserState(updatedUser, { persist: false });
    recalculateRates();

    // Tutorial 이벤트
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

  const combined = [
    ...upgrades.map((u) => ({ ...u, pill: 'Upgrade', category: 'money' })),
    ...sparkleUpgrades.map((u) => ({ ...u, pill: 'Sparkle', category: 'sparkle' })),
    ...rebirthUpgrades.map((u) => ({ ...u, pill: 'Rebirth', category: 'rebirth' })),
    ...protonUpgrades.map((u) => ({ ...u, pill: 'Proton', category: 'proton' })),
  ];

  const filteredUpgrades = combined.filter(u => u.category === selectedCategory);

  const renderCard = (upgrade, index) => {
    const levelValue = getUpgradeLevel(currentUser, upgrade);
    const singleCost = getUpgradeCostForAmount(currentUser, upgrade, 1);
    const singleCostDisplay = formatCost(singleCost, upgrade.currency);

    const isMoneyUpgrade = (upgrade.currency || 'money') === 'money';
    const batchLimit = isMoneyUpgrade ? getUpgradeBatchLimit(currentUser) : 1;

    // Calculate max affordable amount
    const maxAffordableAmountDisplay = isMoneyUpgrade ? getMaxAffordableAmount(upgrade) : 1;
    const maxCostForDisplay = getUpgradeCostForAmount(currentUser, upgrade, maxAffordableAmountDisplay);
    const maxCostDisplay = formatCost(maxCostForDisplay, upgrade.currency);

    return (
      <div key={`${upgrade.category}-${index}`} className="upgrade-card" data-category={upgrade.category}>
        <div className="upgrade-top">
          <div className="upgrade-header-left">
             <span className={`upgrade-pill ${upgrade.category}`}>{upgrade.pill}</span>
             <h3 className="upgrade-title">{upgrade.이름}</h3>
          </div>
        </div>
        
        <p className="upgrade-desc">{upgrade.설명}</p>

        <div className="upgrade-bottom">
          <div className="upgrade-stats">
            <div className="upgrade-info">
              <span className="label">비용</span>
              <span className="value">{singleCostDisplay}</span>
            </div>
            {maxAffordableAmountDisplay > 1 && (
              <div className="upgrade-info">
                <span className="label">최대({maxAffordableAmountDisplay}회)</span>
                <span className="value">{maxCostDisplay}</span>
              </div>
            )}
            <div className="upgrade-info">
               <span className="label">현재 레벨</span>
               <span className="value">Lv.{levelValue}</span>
            </div>
          </div>
          <div className="upgrade-actions">
            <button
              type="button"
              className="upgrade-card-btn secondary"
              onClick={() => handleUpgrade(upgrade, 'single')}
            >
              1회 구매
            </button>
            {isMoneyUpgrade && maxAffordableAmountDisplay > 1 && (
              <button
                type="button"
                className="upgrade-card-btn"
                onClick={() => handleUpgrade(upgrade, 'max')}
              >
                모두 구매
              </button>
            )}
            {!isMoneyUpgrade && (
               /* Non-money upgrades don't usually have Max Buy, but if they did we'd add it here */
               null
            )}
          </div>
        </div>
      </div>
    );
  };

  const categories = [
    { id: 'money', label: '기본 업그레이드', icon: '💰' },
    { id: 'sparkle', label: '스파클 업그레이드', icon: '🔥' },
    { id: 'proton', label: '양성자 업그레이드', icon: '⚛️' },
    { id: 'rebirth', label: '환생 업그레이드', icon: '🔮' },
  ];

  return (
    <div className="upgrade-tab-wrapper">
      <div className="upgrade-sidebar">
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`upgrade-category-btn ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            <span className="upgrade-category-icon">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      <div className="upgrade-content">
        <div className="upgrade-grid">
           {filteredUpgrades.length > 0 ? (
             filteredUpgrades.map((upgrade, index) => renderCard(upgrade, index))
           ) : (
             <div style={{ padding: '20px', color: '#64748b' }}>표시할 업그레이드가 없습니다.</div>
           )}
        </div>
      </div>

      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
