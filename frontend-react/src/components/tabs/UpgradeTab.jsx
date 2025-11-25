import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { upgrades } from '../../utils/data';
import { postUpgrade } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue } from '../../utils/bigValue';
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
    <div
      className="upgrade-grid"
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: '10px',
        padding: '10px',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollBehavior: 'smooth',
        alignItems: 'stretch'
      }}
    >
      {upgrades.map((upgrade, index) => {
        const levelValue = getUpgradeLevel(currentUser, upgrade);
        const costValue = getUpgradeCost(currentUser, upgrade);
        const costValueDisplay = formatResourceValue(fromPlainValue(costValue));

        return (
          <div
            key={index}
            style={{
              border: '1px solid #ccc',
              padding: '10px',
              textAlign: 'center',
              background: '#f9f9f9',
              borderRadius: '5px',
              minWidth: '220px',
              flex: '0 0 240px'
            }}
          >
            <h3 style={{ marginTop: 0 }}>{upgrade.이름}</h3>
            <p style={{ fontSize: '14px' }}>{upgrade.설명}</p>
            <p style={{ fontWeight: 'bold' }}>비용: {costValueDisplay} 돈</p>
            <p>현재 레벨: {levelValue}</p>
            <button
              type="button"
              onClick={() => handleUpgrade(upgrade)}
              style={{ padding: '8px 12px', cursor: 'pointer' }}
            >
              업그레이드
            </button>
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
