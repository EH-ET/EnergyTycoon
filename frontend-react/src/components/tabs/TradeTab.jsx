import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { exchangeEnergy, fetchExchangeRate, autosaveProgress } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue, multiplyByFloat, compareValues, addValues, subtractValues } from '../../utils/bigValue';
import AlertModal from '../AlertModal';
import { readStoredPlayTime } from '../../utils/playTime';

export default function TradeTab() {
  const [percentage, setPercentage] = useState(10); // 1-100%
  const [message, setMessage] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentUser = useStore(state => state.currentUser);
  const exchangeRate = useStore(state => state.exchangeRate);
  const setExchangeRate = useStore(state => state.setExchangeRate);
  const syncUserState = useStore(state => state.syncUserState);
  const getMoneyValue = useStore(state => state.getMoneyValue);
  const getEnergyValue = useStore(state => state.getEnergyValue);

  useEffect(() => {
    loadRate();
    // 60초마다 환율 업데이트
    const timer = setInterval(loadRate, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadRate = async () => {
    if (!currentUser) return;
    try {
      const data = await fetchExchangeRate();
      setExchangeRate(data.rate);
    } catch (e) {
      // Silent fail
    }
  };

  const handleExchange = async () => {
    const currentEnergyValue = getEnergyValue();
    const percentageMultiplier = percentage / 100.0;

    // BigValue 연산을 사용하여 교환할 양 계산
    const exchangeAmountBigValue = multiplyByFloat(currentEnergyValue, percentageMultiplier);
    const zeroBigValue = { data: 0, high: 0 };

    if (compareValues(exchangeAmountBigValue, zeroBigValue) <= 0) {
      setAlertMessage('교환할 에너지가 없습니다');
      return;
    }

    if (!currentUser) {
      setAlertMessage('로그인이 필요합니다.');
      return;
    }

    try {
      setIsLoading(true);
      await loadRate();

      // 교환 전 상태 동기화 (autosave는 여전히 plain value 필요)
      const { toEnergyServerPayload, toMoneyServerPayload } = useStore.getState();
      const currentEnergyPlain = toPlainValue(currentEnergyValue);
      const currentMoney = toPlainValue(getMoneyValue());
      const energyPayload = toEnergyServerPayload();
      const moneyPayload = toMoneyServerPayload();
      const playTimeMs = readStoredPlayTime();

      const saveResult = await autosaveProgress({
        energy_data: energyPayload.data,
        energy_high: energyPayload.high,
        money_data: moneyPayload.data,
        money_high: moneyPayload.high,
        play_time_ms: playTimeMs,
        supercoin: currentUser?.supercoin || 0
      });

      if (saveResult.user) {
        syncUserState(saveResult.user);
      }

      const beforeMoney = getMoneyValue();
      const data = await exchangeEnergy(currentUser.user_id, exchangeAmountBigValue);

      if (data.user) {
        syncUserState(data.user);
      }

      const afterMoney = getMoneyValue();
      const gainedBigValue = subtractValues(afterMoney, beforeMoney);
      
      setExchangeRate(data.rate || exchangeRate);

      const rateText = data.rate ? ` (rate ${data.rate.toFixed(2)})` : '';
      setMessage(`성공: ${formatResourceValue(exchangeAmountBigValue)} 에너지 → ${formatResourceValue(gainedBigValue)} 돈${rateText}`);
    } catch (e) {
      let errorMsg = '교환 실패';
      if (e instanceof Error) {
        const detail = e.response?.data?.detail;
        errorMsg = detail || e.message || errorMsg;
      } else if (typeof e === 'string') {
        errorMsg = e;
      }
      console.error('Exchange error:', e);
      setAlertMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgressiveExchange = (amountBV) => {
    const zeroBV = { data: 0, high: 0 };
    if (compareValues(amountBV, zeroBV) <= 0 || !currentUser) {
      return zeroBV;
    }

    const amount = toPlainValue(amountBV);
    let baseNumerator = 1.0;
    const rebirthCount = currentUser.rebirth_count || 0;
    const exchangeMultLevel = currentUser.exchange_rate_multiplier || 0;

    if (rebirthCount > 0) baseNumerator *= Math.pow(2, rebirthCount);
    if (exchangeMultLevel > 0) baseNumerator *= Math.pow(2, exchangeMultLevel);

    const demandVal = currentUser.demand_bonus || 0;
    const marketBonusFactor = 1.0 / (1.0 + demandVal * 0.05);

    const soldEnergyBV = { data: currentUser.sold_energy_data || 0, high: currentUser.sold_energy_high || 0 };
    const soldEnergyPlain = toPlainValue(soldEnergyBV);
    const midpoint = soldEnergyPlain + amount / 2;

    const logMid = midpoint > 0 ? Math.log(midpoint) / Math.log(3) : 0;
    const growth = 1.0 + Math.floor(Math.max(0, logMid)) * 0.05;
    const avgRate = Math.max(0.0000001, baseNumerator / (growth * marketBonusFactor));
    
    return fromPlainValue(Math.floor(amount * avgRate));
  };

  const currentEnergyValue = getEnergyValue();
  const percentageMultiplier = percentage / 100.0;
  const exchangeAmountBigValue = multiplyByFloat(currentEnergyValue, percentageMultiplier);
  const expectedGainBigValue = calculateProgressiveExchange(exchangeAmountBigValue);

  const canTrade = Boolean(currentUser) && compareValues(exchangeAmountBigValue, {data: 0, high: 0}) > 0 && compareValues(expectedGainBigValue, {data: 0, high: 0}) >= 0;

  const rateText = typeof exchangeRate === 'number' ? formatResourceValue(fromPlainValue(exchangeRate)) : '-';

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
        flexDirection: 'row',
        gap: '16px'
      }}>
        {/* Left Column: Controls */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '14px', color: '#9ba4b5', fontWeight: 600 }}>교환</div>
          
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#7c8aa6' }}>보유 에너지의</span>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#60a5fa' }}>{percentage}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                outline: 'none',
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #1f2a3d ${percentage}%, #1f2a3d 100%)`,
                WebkitAppearance: 'none',
                appearance: 'none'
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleExchange}
            disabled={isLoading || !canTrade}
            style={{
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              background: isLoading || !canTrade ? '#2c3e55' : 'linear-gradient(135deg, #36b5ff 0%, #a4dbff 100%)',
              color: '#fff',
              fontWeight: 700,
              fontSize: '16px',
              cursor: isLoading || !canTrade ? 'not-allowed' : 'pointer',
              marginTop: 'auto'
            }}
          >
            {isLoading ? '교환 중...' : '교환'}
          </button>

          {message && (
            <div style={{ padding: '8px', borderRadius: '8px', background: '#102036', color: '#9ef0b9', fontSize: '12px' }}>
              {message}
            </div>
          )}
        </div>

        {/* Right Column: Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ flex: 1, padding: '12px', background: '#0d1117', borderRadius: '8px', border: '1px solid #1f2a3d', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '11px', color: '#7c8aa6', marginBottom: '4px' }}>현재 환율</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fbbf24' }}>
              1 에너지 → {rateText} 돈
            </div>
          </div>

          <div style={{ flex: 1, padding: '12px', background: '#0d1117', borderRadius: '8px', border: '1px solid #1f2a3d', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '11px', color: '#7c8aa6', marginBottom: '4px' }}>예상 교환</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e8edf5', lineHeight: '1.4' }}>
              {formatResourceValue(exchangeAmountBigValue)} 에너지<br/>
              → {formatResourceValue(expectedGainBigValue)} 돈
            </div>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        borderRadius: '12px',
        padding: '16px',
        background: 'linear-gradient(160deg, #0f1729 0%, #0b1324 100%)',
        border: '1px solid #1f2a3d',
        color: '#e8edf5',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '13px', color: '#7c8aa6', marginBottom: '4px' }}>시장 스냅샷</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>수요 / 공급</div>
          </div>
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '999px',
            background: '#111a2c',
            border: '1px solid #223148',
            fontSize: '11px',
            color: '#9ba4b5',
            width: 'fit-content'
          }}>
            데모 뷰
          </span>
          <div style={{ fontSize: '12px', color: '#7c8aa6', lineHeight: '1.4' }}>
            시장 분위기를 미리 보여주는<br/>데모 그래프입니다.
          </div>
        </div>
        
        <div style={{ flex: 1.2, height: '100%' }}>
          <svg width="100%" height="100%" viewBox="0 0 240 140" preserveAspectRatio="xMidYMid meet" style={{ background: '#0d1117', borderRadius: '10px', padding: '8px' }}>
            <line x1="30" y1="10" x2="30" y2="115" stroke="#243044" strokeWidth="1" />
            <line x1="30" y1="115" x2="230" y2="115" stroke="#243044" strokeWidth="1" />
            <text x="10" y="25" fill="#55627a" fontSize="10">가격</text>
            <text x="190" y="130" fill="#55627a" fontSize="10">수량</text>
            <polyline points={`40,${60 - Math.min(40, (exchangeRate || 50) * 0.3)} 120,${60 + Math.min(40, (exchangeRate || 50) * 0.2)} 220,90`} stroke="#3b82f6" fill="none" strokeWidth="2.5" />
            <polyline points={`40,80 120,${50 + Math.min(40, (exchangeRate || 50) * 0.15)} 220,40`} stroke="#fbbf24" fill="none" strokeWidth="2.5" />
          </svg>
        </div>
      </div>

      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}