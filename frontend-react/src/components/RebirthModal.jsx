import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { performRebirth } from '../utils/apiClient';
import { formatResourceValue, fromPlainValue, multiplyByPlain, powerOf, multiplyValues, addValues, compareValues } from '../utils/bigValue';

// 환생 공식 (RebirthTab과 동일)
const BASE_REBIRTH_COST = 15_000_000; // 15M

function calculateRebirthCost(rebirthCount) {
  const baseCost = fromPlainValue(BASE_REBIRTH_COST);
  const multiplier = powerOf(fromPlainValue(8), rebirthCount);
  return multiplyValues(baseCost, multiplier); // BigValue 간 곱셈
}

function calculateRebirthMultiplier(rebirthCount) {
  return powerOf(fromPlainValue(2), rebirthCount);
}

function calculateRebirthStartMoney(level) {
  const base = fromPlainValue(10);
  const multiplier = powerOf(fromPlainValue(10), level);
  return multiplyValues(base, multiplier); // BigValue 간 곱셈
}

export default function RebirthModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);

  const handleRebirth = async (count = 1) => {
    if (!currentUser || loading) return;
    
    setLoading(true);
    setError('');

    try {
      const data = await performRebirth(count);

      if (data.user) {
        syncUserState(data.user);
        setPlacedGenerators([]);
      }
      
      onClose();
      alert(data.message || '환생에 성공했습니다!');
    } catch (err) {
      setError(err.message || '환생에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !currentUser) return null;

  // 프론트엔드에서 환생 정보 계산
  const rebirthCount = currentUser.rebirth_count || 0;
  const maxChain = Math.max(1, 1 + (currentUser.rebirth_chain_upgrade || 0));
  const rebirthStartMoneyLevel = currentUser.rebirth_start_money_upgrade || 0;

  const getMaxAffordableRebirths = useMemo(() => {
    const money = useStore.getState().getMoneyValue();
    const currentRebirthCount = currentUser.rebirth_count || 0;
    const maxChain = Math.max(1, 1 + (currentUser.rebirth_chain_upgrade || 0));

    for (let count = maxChain; count > 0; count--) {
        let totalCost = fromPlainValue(0);
        for (let i = 0; i < count; i++) {
            totalCost = addValues(totalCost, calculateRebirthCost(currentRebirthCount + i));
        }
        if (compareValues(money, totalCost) >= 0) {
            return { affordableCount: count, cost: totalCost };
        }
    }
    return { affordableCount: 0, cost: fromPlainValue(0) };
  }, [currentUser]);

  const { affordableCount, cost: affordableCost } = getMaxAffordableRebirths;

  const nextCost = calculateRebirthCost(rebirthCount);
  const currentMultiplier = calculateRebirthMultiplier(rebirthCount);
  const nextMultiplier = calculateRebirthMultiplier(rebirthCount + 1);
  const startMoney = calculateRebirthStartMoney(rebirthStartMoneyLevel);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
    >
      <div
        className="rebirth-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a1a',
          color: '#f1f1f1',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: '24px', fontWeight: '700' }}>🔮 환생</h2>
        
        {error && (
          <div style={{
            background: '#dc2626',
            color: '#fff',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '24px' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong>현재 환생 횟수:</strong> {rebirthCount}회
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>현재 배수:</strong> {formatResourceValue(currentMultiplier)}x
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>다음 배수:</strong> {formatResourceValue(nextMultiplier)}x
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong>환생 비용:</strong> {formatResourceValue(nextCost)}
          </div>
          {affordableCount > 1 && (
            <div style={{ marginBottom: '12px' }}>
              <strong>연속 환생({affordableCount}회) 비용:</strong> {formatResourceValue(affordableCost)}
            </div>
          )}
          <div style={{ marginBottom: '12px' }}>
            <strong>환생 후 시작 자금:</strong> {formatResourceValue(startMoney)}
          </div>

          <div style={{
            background: '#2a2a2a',
            padding: '16px',
            borderRadius: '8px',
            marginTop: '16px',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.9 }}>
              ⚠️ 환생 시 다음이 초기화됩니다:
            </p>
            <ul style={{ margin: '0', paddingLeft: '20px', fontSize: '14px' }}>
              <li>모든 발전기</li>
              <li>모든 업그레이드</li>
              <li>에너지 (0으로 초기화)</li>
              <li>돈 (업그레이드 적용된 시작 자금으로 초기화)</li>
            </ul>
            <p style={{ margin: '12px 0 0', fontSize: '14px', color: '#4ade80' }}>
              ✨ 생산량 및 환율이 영구적으로 {formatResourceValue(nextMultiplier)}배 증가합니다!
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #444',
              background: '#2a2a2a',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            취소
          </button>
          <button
            onClick={() => handleRebirth(1)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #7c3aed',
              background: '#7c3aed',
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            {loading ? '환생 중...' : '환생하기'}
          </button>
          {affordableCount > 1 && (
            <button
              onClick={() => handleRebirth(affordableCount)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #0ea5e9',
                background: '#0ea5e9',
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '600',
                minWidth: '200px',
              }}
            >
              {loading ? '환생 중...' : `연속 환생(${affordableCount}회)`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
