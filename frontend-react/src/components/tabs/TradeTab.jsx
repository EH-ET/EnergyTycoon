import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { exchangeEnergy, fetchExchangeRate } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue } from '../../utils/bigValue';
import AlertModal from '../AlertModal';

export default function TradeTab() {
  const [amount, setAmount] = useState(1);
  const [message, setMessage] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = useStore(state => state.currentUser);
  const exchangeRate = useStore(state => state.exchangeRate);
  const setExchangeRate = useStore(state => state.setExchangeRate);
  const syncUserState = useStore(state => state.syncUserState);
  const getMoneyValue = useStore(state => state.getMoneyValue);

  useEffect(() => {
    loadRate();
    const timer = setInterval(loadRate, 5000);
    return () => clearInterval(timer);
  }, []);

  const loadRate = async () => {
    if (!currentUser) return;
    try {
      const data = await fetchExchangeRate(getAuthToken());
      setExchangeRate(data.rate);
    } catch (e) {
      // Silent fail
    }
  };

  const handleExchange = async () => {
    const exchangeAmount = Number(amount) || 1;
    if (exchangeAmount <= 0) {
      setAlertMessage('1 이상 입력하세요');
      return;
    }

    if (!currentUser) {
      setAlertMessage('로그인이 필요합니다.');
      return;
    }

    try {
      setIsLoading(true);
      const beforeMoney = toPlainValue(getMoneyValue());
      const data = await exchangeEnergy(
        getAuthToken(),
        currentUser.user_id,
        exchangeAmount,
        currentUser.energy
      );

      if (data.user) {
        syncUserState(data.user);
      }

      const gained = toPlainValue(getMoneyValue()) - beforeMoney;
      setExchangeRate(data.rate || exchangeRate);

      const rateText = data.rate ? ` (rate ${data.rate.toFixed(2)})` : '';
      setMessage(`성공: ${exchangeAmount} 에너지 → ${formatResourceValue(fromPlainValue(gained))} 돈${rateText}`);
    } catch (e) {
      setAlertMessage(e.message || e);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPlain = (plain) => formatResourceValue(fromPlainValue(Math.max(0, Number(plain) || 0)));

  const rateValue = typeof exchangeRate === 'number' ? exchangeRate : null;
  const expectedGain = rateValue != null && rateValue > 0
    ? Math.max(1, Math.floor(Number(amount || 0) * rateValue))
    : 0;
  const canTrade = Boolean(currentUser) && Number(amount) > 0 && expectedGain >= 1;

  const rateText = typeof exchangeRate === 'number' ? exchangeRate.toFixed(2) : '-';
  const expectedText = `${formatPlain(amount)} 에너지 → ${formatPlain(expectedGain)} 돈`;

  const meterFill = useMemo(() => {
    const normalized = Math.max(0, Math.min(1, (exchangeRate || 0) / 100));
    return `${normalized * 100}%`;
  }, [exchangeRate]);

  const chartPoints = useMemo(() => {
    const rate = typeof exchangeRate === 'number' ? exchangeRate : 50;
    const demandY = 170 - Math.min(140, rate * 1.4);
    const supplyY = 30 + Math.min(140, rate * 0.8);
    return {
      demand: `40,${demandY} 120,${demandY + 40} 220,190`,
      supply: `40,150 120,${supplyY} 220,30`,
    };
  }, [exchangeRate]);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: '10px',
      padding: '10px 12px',
      background: '#0b0e16',
      borderRadius: '12px',
      border: '1px solid #14213a',
      boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
      minHeight: 0,
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '12px 14px',
        borderRadius: '12px',
        background: 'linear-gradient(160deg, #0f1729 0%, #0b1324 100%)',
        border: '1px solid #1f2a3d',
        color: '#e8edf5',
        display: 'grid',
        gap: '10px'
      }}>
        <div>
          <div style={{ fontSize: '13px', color: '#7c8aa6' }}>현재 환율</div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#f1c40f' }}>
            1 에너지 → {rateText} 돈
          </div>
          <div style={{
            marginTop: '8px',
            height: '10px',
            background: '#111a2c',
            borderRadius: '999px',
            border: '1px solid #1f2a3d',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: meterFill,
              background: 'linear-gradient(90deg, #1f6feb, #22d3ee)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: '#9ba4b5' }}>팔 에너지</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'center' }}>
            <input
              type="number"
              min="1"
              placeholder="기본 1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '10px',
                border: '1px solid #223148',
                background: '#0d1117',
                color: '#e8edf5',
                fontSize: '15px'
              }}
            />
            <button
              type="button"
              onClick={handleExchange}
              disabled={isLoading || !canTrade}
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                border: 'none',
                background: isLoading || !canTrade ? '#2c3e55' : 'linear-gradient(135deg, #1f6feb, #22d3ee)',
                color: '#0b0e16',
                fontWeight: 800,
                cursor: isLoading || !canTrade ? 'not-allowed' : 'pointer',
                boxShadow: isLoading || !canTrade ? 'none' : '0 10px 24px rgba(34, 211, 238, 0.25)',
                minWidth: '140px'
              }}
            >
              {isLoading ? '교환 중...' : '교환'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#7c8aa6' }}>{expectedText}</div>
        </div>

        {message && (
          <div style={{ padding: '10px', borderRadius: '10px', background: '#102036', color: '#9ef0b9', fontSize: '13px' }}>
            {message}
          </div>
        )}
      </div>

      <div style={{
        borderRadius: '12px',
        padding: '12px 14px',
        background: 'linear-gradient(160deg, #0f1729 0%, #0b1324 100%)',
        border: '1px solid #1f2a3d',
        color: '#e8edf5',
        display: 'grid',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#7c8aa6' }}>시장 스냅샷</div>
            <div style={{ fontSize: '18px', fontWeight: 800 }}>수요 / 공급</div>
          </div>
          <span style={{
            padding: '4px 8px',
            borderRadius: '999px',
            background: '#111a2c',
            border: '1px solid #223148',
            fontSize: '12px',
            color: '#9ba4b5'
          }}>
            데모 뷰
          </span>
        </div>
        <svg width="100%" height="160" viewBox="0 0 240 160" style={{ background: '#0d1117', borderRadius: '10px' }}>
          <line x1="30" y1="10" x2="30" y2="130" stroke="#243044" strokeWidth="1" />
          <line x1="30" y1="130" x2="230" y2="130" stroke="#243044" strokeWidth="1" />
          <text x="10" y="20" fill="#55627a" fontSize="11">가격</text>
          <text x="190" y="150" fill="#55627a" fontSize="11">수량</text>
          <polyline points={chartPoints.demand} stroke="#1f6feb" fill="none" strokeWidth="3" />
          <polyline points={chartPoints.supply} stroke="#22d3ee" fill="none" strokeWidth="3" />
          <circle cx="120" cy={chartPoints.demand.split(' ')[1]?.split(',')[1] || 100} r="4" fill="#1f6feb" />
          <circle cx="160" cy={chartPoints.supply.split(' ')[1]?.split(',')[1] || 80} r="4" fill="#22d3ee" />
        </svg>
        <div style={{ fontSize: '12px', color: '#7c8aa6' }}>
          시장 분위기를 미리 보여주는 데모 그래프입니다. 실제 거래 시 최신 환율이 적용됩니다.
        </div>
      </div>

      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
