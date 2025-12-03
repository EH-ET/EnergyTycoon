import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { exchangeEnergy, fetchExchangeRate, autosaveProgress } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue } from '../../utils/bigValue';
import AlertModal from '../AlertModal';
import { readStoredPlayTime } from '../../utils/playTime';

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

      // 교환 전 현재 에너지/돈을 백엔드에 즉시 동기화
      const { toEnergyServerPayload, toMoneyServerPayload, getEnergyValue, getMoneyValue } = useStore.getState();
      const energyPayload = toEnergyServerPayload();
      const moneyPayload = toMoneyServerPayload();
      const currentEnergy = toPlainValue(getEnergyValue());
      const currentMoney = toPlainValue(getMoneyValue());
      const playTimeMs = readStoredPlayTime();

      const saveResult = await autosaveProgress(getAuthToken(), {
        energy: currentEnergy,
        money: currentMoney,
        energy_data: energyPayload.data,
        energy_high: energyPayload.high,
        money_data: moneyPayload.data,
        money_high: moneyPayload.high,
        play_time_ms: playTimeMs,
      });

      // 저장 후 state 업데이트
      if (saveResult.user) {
        syncUserState(saveResult.user);
      }

      const beforeMoney = toPlainValue(getMoneyValue());
      const data = await exchangeEnergy(
        getAuthToken(),
        currentUser.user_id,
        exchangeAmount,
        currentEnergy  // 최신 에너지 값 사용
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
      display: 'flex',
      gap: '12px',
      padding: '12px',
      background: '#0b0e16',
      borderRadius: '12px',
      height: '100%',
      overflow: 'hidden'
    }}>
      <div style={{
        flex: 1.5,
        padding: '16px',
        borderRadius: '12px',
        background: 'linear-gradient(160deg, #0f1729 0%, #0b1324 100%)',
        border: '1px solid #1f2a3d',
        color: '#e8edf5',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#7c8aa6', marginBottom: '4px' }}>현재 환율</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: '#fbbf24' }}>
              1 에너지 → {rateText} 돈
            </div>
          </div>
          <div style={{
            height: '8px',
            width: '100px',
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
              background: 'linear-gradient(90deg, #3b82f6, #fbbf24)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            type="number"
            min="1"
            placeholder="기본 1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid #223148',
              background: '#0d1117',
              color: '#e8edf5',
              fontSize: '16px'
            }}
          />
          <button
            type="button"
            onClick={handleExchange}
            disabled={isLoading || !canTrade}
            style={{
              padding: '12px 24px',
              borderRadius: '10px',
              border: 'none',
              background: isLoading || !canTrade ? '#2c3e55' : 'linear-gradient(135deg, #36b5ff 0%, #a4dbff 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '16px',
              cursor: isLoading || !canTrade ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isLoading ? '교환 중...' : '교환'}
          </button>
        </div>
        
        <div style={{ fontSize: '13px', color: '#7c8aa6' }}>{expectedText}</div>

        {message && (
          <div style={{ padding: '8px', borderRadius: '8px', background: '#102036', color: '#9ef0b9', fontSize: '13px' }}>
            {message}
          </div>
        )}
      </div>

      <div style={{
        flex: 1,
        borderRadius: '12px',
        padding: '16px',
        background: 'linear-gradient(160deg, #0f1729 0%, #0b1324 100%)',
        border: '1px solid #1f2a3d',
        color: '#e8edf5',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#7c8aa6', marginBottom: '4px' }}>시장 스냅샷</div>
            <div style={{ fontSize: '16px', fontWeight: 700 }}>수요 / 공급</div>
          </div>
          <span style={{
            padding: '4px 10px',
            borderRadius: '999px',
            background: '#111a2c',
            border: '1px solid #223148',
            fontSize: '11px',
            color: '#9ba4b5'
          }}>
            데모 뷰
          </span>
        </div>
        <svg width="100%" height="110" viewBox="0 0 240 110" style={{ background: '#0d1117', borderRadius: '10px', padding: '8px' }}>
          <line x1="30" y1="10" x2="30" y2="85" stroke="#243044" strokeWidth="1" />
          <line x1="30" y1="85" x2="230" y2="85" stroke="#243044" strokeWidth="1" />
          <text x="10" y="25" fill="#55627a" fontSize="10">가격</text>
          <text x="190" y="100" fill="#55627a" fontSize="10">수량</text>
          <polyline points={`40,${40 - Math.min(30, (exchangeRate || 50) * 0.3)} 120,${40 + Math.min(30, (exchangeRate || 50) * 0.2)} 220,70`} stroke="#3b82f6" fill="none" strokeWidth="2.5" />
          <polyline points={`40,60 120,${30 + Math.min(30, (exchangeRate || 50) * 0.15)} 220,20`} stroke="#fbbf24" fill="none" strokeWidth="2.5" />
        </svg>
        <div style={{ fontSize: '12px', color: '#7c8aa6' }}>
          시장 분위기를 미리 보여주는 데모 그래프입니다.
        </div>
      </div>

      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
