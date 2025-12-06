import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { getAuthToken } from '../../store/useStore';
import { exchangeEnergy, fetchExchangeRate, autosaveProgress } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue } from '../../utils/bigValue';
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
    // Calculate amount from percentage of current energy
    const currentEnergyValue = getEnergyValue();
    const currentEnergyPlain = toPlainValue(currentEnergyValue);
    const exchangeAmountPlain = Math.floor((currentEnergyPlain * percentage) / 100);
    
    if (exchangeAmountPlain <= 0) {
      setAlertMessage('교환할 에너지가 없습니다');
      return;
    }

    if (!currentUser) {
      setAlertMessage('로그인이 필요합니다.');
      return;
    }

    try {
      setIsLoading(true);

      // 교환 전 현재 에너지/돈을 백엔드에 즉시 동기화
      const { toEnergyServerPayload, toMoneyServerPayload } = useStore.getState();
      const energyPayload = toEnergyServerPayload();
      const moneyPayload = toMoneyServerPayload();
      const currentMoney = toPlainValue(getMoneyValue());
      const playTimeMs = readStoredPlayTime();

      const saveResult = await autosaveProgress(getAuthToken(), {
        energy: currentEnergyPlain,
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
        exchangeAmountPlain,
        currentEnergyPlain
      );

      if (data.user) {
        syncUserState(data.user);
      }

      const gained = toPlainValue(getMoneyValue()) - beforeMoney;
      setExchangeRate(data.rate || exchangeRate);

      const rateText = data.rate ? ` (rate ${data.rate.toFixed(2)})` : '';
      setMessage(`성공: ${formatResourceValue(fromPlainValue(exchangeAmountPlain))} 에너지 → ${formatResourceValue(fromPlainValue(gained))} 돈${rateText}`);
    } catch (e) {
      // Safely handle error objects
      let errorMsg = '교환 실패';
      if (e instanceof Error) {
        errorMsg = e.message || errorMsg;
      } else if (typeof e === 'string') {
        errorMsg = e;
      } else if (e && typeof e === 'object') {
        try {
          errorMsg = e.detail || e.message || JSON.stringify(e);
        } catch {
          errorMsg = '교환 실패 (에러 정보 확인 불가)';
        }
      }
      console.error('Exchange error:', e);
      setAlertMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPlain = (plain) => formatResourceValue(fromPlainValue(Math.max(0, Number(plain) || 0)));

  // Calculate progressive exchange rate (matches backend logic)
  const calculateProgressiveExchange = (amount) => {
    if (amount <= 0 || !currentUser) return 0;

    // 1. Calculate base numerator (rebirth + exchange_rate_multiplier)
    let baseNumerator = 1.0;
    const rebirthCount = currentUser.rebirth_count || 0;
    const exchangeMultLevel = currentUser.exchange_rate_multiplier || 0;

    if (rebirthCount > 0) {
      baseNumerator *= Math.pow(2, rebirthCount);
    }
    if (exchangeMultLevel > 0) {
      baseNumerator *= Math.pow(2, exchangeMultLevel);
    }

    // 2. Market bonus factor (demand_bonus)
    const demandVal = currentUser.demand_bonus || 0;
    const marketBonusFactor = 1.0 / (1.0 + demandVal * 0.05);

    // 3. Calculate midpoint for progressive rate
    // Midpoint = CurrentSold + Amount / 2
    const soldEnergyBV = fromPlainValue(0);
    soldEnergyBV.data = currentUser.sold_energy_data || 0;
    soldEnergyBV.high = currentUser.sold_energy_high || 0;
    const soldEnergyPlain = toPlainValue(soldEnergyBV);
    const midpoint = soldEnergyPlain + amount / 2;

    // 4. Calculate log3(midpoint)
    const LOG3_10 = 2.09590327429;
    let logMid = 0;
    if (midpoint > 0) {
      logMid = Math.log(midpoint) / Math.log(3);
    }
    if (logMid < 0) logMid = 0;

    // 5. Growth = 1 + 0.05 * floor(log3(midpoint))
    const growth = 1.0 + Math.floor(logMid) * 0.05;

    // 6. Average rate
    const avgRate = Math.max(0.0000001, baseNumerator / (growth * marketBonusFactor));

    // 7. Total money = amount * avgRate
    return Math.floor(amount * avgRate);
  };

  // Calculate amount from percentage
  const currentEnergyValue = getEnergyValue();
  const currentEnergyPlain = toPlainValue(currentEnergyValue);
  const exchangeAmountPlain = Math.floor((currentEnergyPlain * percentage) / 100);

  const expectedGain = calculateProgressiveExchange(exchangeAmountPlain);

  const canTrade = Boolean(currentUser) && exchangeAmountPlain > 0 && expectedGain >= 1;

  const rateText = typeof exchangeRate === 'number'
    ? formatResourceValue(fromPlainValue(exchangeRate))
    : '-';

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
        flexDirection: 'row',
        gap: '16px'
      }}>
        {/* Left Column: Controls */}
        <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 타이틀 */}
          <div style={{ fontSize: '14px', color: '#9ba4b5', fontWeight: 600 }}>교환</div>
          
          {/* Range Input */}
          <div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '8px'
            }}>
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

          {/* 교환 버튼 */}
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
          {/* 현재 환율 */}
          <div style={{ 
            flex: 1,
            padding: '12px',
            background: '#0d1117',
            borderRadius: '8px',
            border: '1px solid #1f2a3d',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#7c8aa6', marginBottom: '4px' }}>현재 환율</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#fbbf24' }}>
              1 에너지 → {rateText} 돈
            </div>
          </div>

          {/* 예상 교환 */}
          <div style={{ 
            flex: 1,
            padding: '12px',
            background: '#0d1117',
            borderRadius: '8px',
            border: '1px solid #1f2a3d',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div style={{ fontSize: '11px', color: '#7c8aa6', marginBottom: '4px' }}>예상 교환</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#e8edf5', lineHeight: '1.4' }}>
              {formatPlain(exchangeAmountPlain)} 에너지<br/>
              → {formatPlain(expectedGain)} 돈
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
