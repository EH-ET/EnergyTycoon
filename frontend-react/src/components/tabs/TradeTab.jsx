import { useState, useEffect, useMemo, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { exchangeEnergy, fetchExchangeRate, exchangeMoneyToProton, fetchProtonRate, autosaveProgress } from '../../utils/apiClient';
import { fromPlainValue, formatResourceValue, toPlainValue, multiplyByFloat, compareValues, addValues, subtractValues, multiplyValues } from '../../utils/bigValue';
import { dispatchTutorialEvent, TUTORIAL_EVENTS } from '../../utils/tutorialEvents';
import AlertModal from '../AlertModal';

export default function TradeTab() {
  const [activeTab, setActiveTab] = useState('money'); 
  const [percentage, setPercentage] = useState(10);
  const [protonPercentage, setProtonPercentage] = useState(10);
  const [message, setMessage] = useState('');
  const [protonMessage, setProtonMessage] = useState('');
  const [alertMessage, setAlertMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProtonLoading, setIsProtonLoading] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);

  // Store & API
  const currentUser = useStore(state => state.currentUser);
  const exchangeRate = useStore(state => state.exchangeRate);
  const setExchangeRate = useStore(state => state.setExchangeRate);
  const syncUserState = useStore(state => state.syncUserState);
  const getMoneyValue = useStore(state => state.getMoneyValue);
  const getEnergyValue = useStore(state => state.getEnergyValue);
  const [protonRate, setProtonRate] = useState({ data: 1, high: 0 });

  useEffect(() => {
    loadRate();
    loadProtonRate();
    const timer = setInterval(() => {
      loadRate();
      loadProtonRate();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadRate = async () => {
    if (!currentUser) return;
    try {
      const data = await fetchExchangeRate();
      const rateBV = data?.rate_data != null ? { data: data.rate_data, high: data.rate_high || 0 } : fromPlainValue(data?.rate || 0);
      setExchangeRate(rateBV);
    } catch (e) {
      if (!exchangeRate || typeof exchangeRate.data !== 'number') {
        setExchangeRate({ data: 50000, high: 0 });
      }
    }
  };

  const loadProtonRate = async () => {
    if (!currentUser) return;
    try {
      const data = await fetchProtonRate();
      const rateBV = data?.rate_data != null ? { data: data.rate_data, high: data.rate_high || 0 } : fromPlainValue(data?.rate || 1);
      setProtonRate(rateBV);
    } catch (e) {
      setProtonRate({ data: 1, high: 0 });
    }
  };

  const handleExchange = async () => {
    const currentEnergyValue = getEnergyValue();
    const percentageMultiplier = percentage / 100.0;
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
      try {
        const { toEnergyServerPayload, toMoneyServerPayload } = useStore.getState();
        const energyPayload = toEnergyServerPayload();
        const moneyPayload = toMoneyServerPayload();
        await autosaveProgress({
          energy_data: energyPayload.data,
          energy_high: energyPayload.high,
          money_data: moneyPayload.data,
          money_high: moneyPayload.high,
          supercoin: currentUser?.supercoin || 0,
        });
      } catch (saveErr) {
        console.warn('Pre-exchange autosave failed, continuing anyway:', saveErr);
      }

      const beforeMoney = getMoneyValue();
      const data = await exchangeEnergy(currentUser.user_id, exchangeAmountBigValue);
      if (data.user) syncUserState(data.user);

      const afterMoney = getMoneyValue();
      const gainedBigValue = subtractValues(afterMoney, beforeMoney);
      const rateBV = data?.rate_data != null ? { data: data.rate_data, high: data.rate_high || 0 } : fromPlainValue(data?.rate || 0);
      setExchangeRate(rateBV);

      const rateText = ` (rate ${formatResourceValue(rateBV)})`;
      setMessage(`성공: ${formatResourceValue(exchangeAmountBigValue)} 에너지 → ${formatResourceValue(gainedBigValue)} 돈${rateText}`);
    } catch (e) {
      let errorMsg = '교환 실패';
      if (e instanceof Error) {
        const detail = e.response?.data?.detail;
        errorMsg = detail || e.message || errorMsg;
      } else if (typeof e === 'string') {
        errorMsg = e;
      }
      setAlertMessage(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProtonExchange = async () => {
    const currentMoneyValue = getMoneyValue();
    const percentageMultiplier = protonPercentage / 100.0;
    const exchangeAmountBigValue = multiplyByFloat(currentMoneyValue, percentageMultiplier);
    const zeroBigValue = { data: 0, high: 0 };

    if (compareValues(exchangeAmountBigValue, zeroBigValue) <= 0) {
      setAlertMessage('교환할 돈이 없습니다');
      return;
    }
    if (!currentUser) {
      setAlertMessage('로그인이 필요합니다.');
      return;
    }

    try {
      setIsProtonLoading(true);
      await loadProtonRate();
      const data = await exchangeMoneyToProton(currentUser.user_id, exchangeAmountBigValue);
      if (data.user) syncUserState(data.user);

      const gained = data?.gained_data != null ? { data: data.gained_data, high: data.gained_high || 0 } : fromPlainValue(0);
      const rateBV = data?.rate_data != null ? { data: data.rate_data, high: data.rate_high || 0 } : fromPlainValue(data?.rate || 1);
      setProtonRate(rateBV);

      const rateText = ` (rate ${formatResourceValue(rateBV)})`;
      setProtonMessage(`성공: ${formatResourceValue(exchangeAmountBigValue)} 돈 → ${formatResourceValue(gained)} 양성자${rateText}`);
    } catch (e) {
      console.error("Proton Exchange Error:", e);
      if (e.response) {
        console.log("Error Response Status:", e.response.status);
        console.log("Error Response Data:", e.response.data);
      }
      let errorMsg = '교환 실패';
      if (e instanceof Error) {
        const detail = e.response?.data?.detail;
        errorMsg = detail || e.message || errorMsg;
      } else if (typeof e === 'string') {
        errorMsg = e;
      }
      setAlertMessage(errorMsg);
    } finally {
      setIsProtonLoading(false);
    }
  };

  const calculateProgressiveExchange = (amountBV) => {
    const zeroBV = { data: 0, high: 0 };
    if (compareValues(amountBV, zeroBV) <= 0 || !currentUser) return zeroBV;

    let baseNumerator = 1.0;
    const rebirthCount = currentUser.rebirth_count || 0;
    const exchangeMultLevel = currentUser.exchange_rate_multiplier || 0;
    if (rebirthCount > 0) baseNumerator *= Math.pow(2, rebirthCount);
    if (exchangeMultLevel > 0) baseNumerator *= Math.pow(2, exchangeMultLevel);

    const demandVal = currentUser.demand_bonus || 0;
    const marketBonusFactor = 1.0 / (1.0 + demandVal * 0.05);
    const soldEnergyBV = { data: currentUser.sold_energy_data || 0, high: currentUser.sold_energy_high || 0 };
    const halfAmountBV = multiplyByFloat(amountBV, 0.5);
    const midpointBV = addValues(soldEnergyBV, halfAmountBV);
    const midpointPlain = toPlainValue(midpointBV);
    const logMid = midpointPlain > 0 ? Math.log(midpointPlain) / Math.log(3) : 0;
    const growth = 1.0 + Math.floor(Math.max(0, logMid)) * 0.05;
    const avgRate = Math.max(0.0000001, baseNumerator / (growth * marketBonusFactor));
    return multiplyByFloat(amountBV, avgRate);
  };

  const currentEnergyValue = getEnergyValue();
  const percentageMultiplier = percentage / 100.0;
  const exchangeAmountBigValue = multiplyByFloat(currentEnergyValue, percentageMultiplier);
  const expectedGainBigValue = calculateProgressiveExchange(exchangeAmountBigValue);

  const currentMoneyValue = getMoneyValue();
  const protonPercentageMultiplier = protonPercentage / 100.0;
  const protonExchangeAmountBigValue = multiplyByFloat(currentMoneyValue, protonPercentageMultiplier);
  const expectedProtonGain = multiplyValues(protonExchangeAmountBigValue, protonRate);

  const canTrade = Boolean(currentUser) && compareValues(exchangeAmountBigValue, {data: 0, high: 0}) > 0 && compareValues(expectedGainBigValue, {data: 0, high: 0}) >= 0;
  const canTradeProton = Boolean(currentUser) && compareValues(protonExchangeAmountBigValue, {data: 0, high: 0}) > 0;

  const rateText = (exchangeRate && typeof exchangeRate.data === 'number') ? formatResourceValue(exchangeRate) : '...';
  const protonRateText = (protonRate && typeof protonRate.data === 'number') ? formatResourceValue(protonRate) : '...';

  const graphPoints = useMemo(() => {
    const rateSafe = toPlainValue(exchangeRate) || 50;
    const demandY1 = 60 - Math.min(40, rateSafe * 0.3);
    const demandY2 = 60 + Math.min(40, rateSafe * 0.2);
    const supplyY2 = 50 + Math.min(40, rateSafe * 0.15);
    return {
      demand: `40,${demandY1} 120,${demandY2} 220,90`,
      supply: `40,80 120,${supplyY2} 220,40`,
    };
  }, [exchangeRate]);

  const scaleGraphPoints = useCallback((pointsStr) => {
    return pointsStr.split(' ').map(pair => {
      const [x, y] = pair.split(',').map(Number);
      const sx = x * 1.5;
      const sy = Math.max(20, Math.min(200, 20 + (y - 10) * 1.4));
      return `${sx},${sy}`;
    }).join(' ');
  }, []);

  // Styles - Compact Design
  const wrapperStyle = {
    display: 'flex',
    flexDirection: 'row',
    width: '100%',
    height: '100%',
    background: '#0b0e16',
    overflow: 'hidden',
    borderRadius: '12px'
  };

  const sidebarStyle = {
    flex: '0 0 140px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px',
    background: '#0f1729',
    borderRight: '1px solid #1f2a3d',
    overflowY: 'auto'
  };

  const btnStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '10px 12px',
    background: isActive ? '#1e293b' : 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: isActive ? '#f1f5f9' : '#64748b',
    fontSize: '13px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    boxShadow: isActive ? 'inset 2px 0 0 0 #3b82f6' : 'none'
  });

  const contentAreaStyle = {
    flex: 1,
    display: 'flex',
    padding: '12px',
    gap: '12px',
    height: '100%',
    overflowY: 'hidden',
    alignItems: 'stretch'
  };

  const cardStyle = {
    background: 'linear-gradient(160deg, #131b2e 0%, #0f172a 100%)',
    border: '1px solid #1f2a3d',
    borderRadius: '12px',
    padding: '12px',
    color: '#e8edf5',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
  };

  const protonCardStyle = {
    ...cardStyle,
    background: 'linear-gradient(160deg, #1a0f29 0%, #130b24 100%)',
    border: '1px solid #3d1f5f',
  };

  return (
    <div style={wrapperStyle}>
      <div style={sidebarStyle}>
        <button style={btnStyle(activeTab === 'money')} onClick={() => setActiveTab('money')}>
           ⚡ 에너지
        </button>
        <button style={btnStyle(activeTab === 'proton')} onClick={() => setActiveTab('proton')}>
           ⚛️ 양성자
        </button>
      </div>

      <div style={contentAreaStyle}>
        {activeTab === 'money' && (
          <>
            {/* Unified Control & Info Card - Side-by-side Layout for Action */}
            <div style={{...cardStyle, flex: '0 0 380px', gap: '8px'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                 <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0'}}>거래소</div>
                 <div style={{ fontSize: '11px', color: '#64748b', background:'#1e293b', padding:'2px 6px', borderRadius:'4px'}}>실시간</div>
              </div>

               {/* Info Section */}
               <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '10px', borderRadius: '8px', border:'1px solid #1e293b', marginBottom:'4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>환율</span>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>
                      1⚡ = {rateText}💰
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '12px', color: '#94a3b8' }}>예상 획득</span>
                     <span style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>
                        {formatResourceValue(expectedGainBigValue)} 💰
                     </span>
                  </div>
               </div>

               {/* Action Section - Row Layout */}
               <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'auto' }}>
                  <div style={{ flex: 1 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>판매비율</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa' }}>{percentage}%</span>
                     </div>
                     <input
                        type="range"
                        min="1"
                        max="100"
                        value={percentage}
                        onChange={(e) => setPercentage(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: '6px',
                          borderRadius: '3px',
                          outline: 'none',
                          background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percentage}%, #1f2a3d ${percentage}%, #1f2a3d 100%)`,
                          WebkitAppearance: 'none',
                          appearance: 'none',
                          cursor: 'pointer'
                        }}
                      />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      handleExchange();
                      dispatchTutorialEvent(TUTORIAL_EVENTS.CLICK_SELL);
                    }}
                    disabled={isLoading || !canTrade}
                    style={{
                      padding: '0 20px',
                      height: '42px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isLoading || !canTrade ? '#2c3e55' : 'linear-gradient(135deg, #36b5ff 0%, #2563eb 100%)',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '14px',
                      cursor: isLoading || !canTrade ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {isLoading ? '...' : '교환'}
                  </button>
               </div>
               {message && (
                 <div style={{ marginTop: '8px', padding: '6px', borderRadius: '4px', background: 'rgba(5, 150, 105, 0.15)', color: '#6ee7b7', fontSize: '11px', border: '1px solid rgba(5, 150, 105, 0.3)' }}>
                   {message}
                 </div>
               )}
            </div>

            {/* Graph Card */}
            <div style={{ flex: 1, ...cardStyle, padding: 0, overflow: 'hidden', minWidth: 0 }}>
              <div style={{ padding: '8px 12px', borderBottom: '1px solid #1f2a3d', background: 'rgba(15, 23, 42, 0.5)' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>시장 동향</div>
              </div>
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight:'100%' }}>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 360 220"
                  preserveAspectRatio="none"
                  onMouseEnter={() => setShowRateModal(true)}
                  style={{ cursor: 'pointer', overflow: 'visible', padding: '12px', maxHeight: '100%' }}
                >
                  <line x1="40" y1="20" x2="40" y2="200" stroke="#334155" strokeWidth="1" />
                  <line x1="40" y1="200" x2="340" y2="200" stroke="#334155" strokeWidth="1" />
                  <polyline points={scaleGraphPoints(graphPoints.demand)} stroke="#3b82f6" fill="none" strokeWidth="3" />
                  <polyline points={scaleGraphPoints(graphPoints.supply)} stroke="#fbbf24" fill="none" strokeWidth="3" />
                </svg>
              </div>
            </div>
          </>
        )}

        {/* PROTON TAB */}
        {activeTab === 'proton' && (
          <div style={{ flex: 1, maxWidth: '500px', margin: '0 auto' }}>
             <div style={{...protonCardStyle, gap:'12px'}}>
                <div style={{ fontSize: '14px', color: '#e9d5ff', fontWeight: 600 }}>양성자 변환소</div>
                
                {/* Info */}
                <div style={{ background: 'rgba(50, 20, 80, 0.4)', padding: '12px', borderRadius: '8px', border:'1px solid #4c1d95' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                     <span style={{ fontSize: '12px', color: '#c084fc' }}>환율</span>
                     <span style={{ fontSize: '13px', fontWeight: 700, color: '#e879f9' }}>
                       1💰 = {protonRateText}⚛️
                     </span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '12px', color: '#c084fc' }}>예상 획득</span>
                     <span style={{ fontSize: '15px', fontWeight: 800, color: '#f3e8ff' }}>
                        {formatResourceValue(expectedProtonGain)} ⚛️
                     </span>
                   </div>
                </div>

                {/* Controls - Row Layout */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: 'auto' }}>
                   <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', color: '#a855f7' }}>비율</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#d8b4fe' }}>{protonPercentage}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={protonPercentage}
                        onChange={(e) => setProtonPercentage(Number(e.target.value))}
                        style={{
                          width: '100%',
                          height: '6px',
                          borderRadius: '3px',
                          outline: 'none',
                          background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${protonPercentage}%, #4c1d95 ${protonPercentage}%, #4c1d95 100%)`,
                          WebkitAppearance: 'none',
                          appearance: 'none',
                          cursor: 'pointer'
                        }}
                      />
                   </div>
                   <button
                    type="button"
                    onClick={handleProtonExchange}
                    disabled={isProtonLoading || !canTradeProton}
                    style={{
                      padding: '0 20px',
                      height: '42px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isProtonLoading || !canTradeProton ? '#4c1d95' : 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)',
                      color: '#fff',
                      fontWeight: 800,
                      fontSize: '14px',
                      cursor: isProtonLoading || !canTradeProton ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 15px rgba(124, 58, 237, 0.4)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                     {isProtonLoading ? '...' : '변환'}
                  </button>
               </div>
               {protonMessage && (
                  <div style={{ marginTop: '10px', padding: '8px', borderRadius: '6px', background: 'rgba(88, 28, 135, 0.5)', color: '#d8b4fe', fontSize: '12px', border: '1px solid #7c3aed' }}>
                    {protonMessage}
                  </div>
                )}
             </div>
          </div>
        )}
      </div>

      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
      
      {showRateModal && activeTab === 'money' && (
        <div
          onClick={() => setShowRateModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
           <div style={{ background: '#0f1729', padding: '16px', borderRadius: '12px', border: '1px solid #334155', maxWidth: '90vw' }}>
              <h3 style={{color:'#fff', marginTop:0, fontSize:'16px'}}>시장 상세</h3>
              <svg width="300" height="200" viewBox="0 0 360 220" style={{background:'#020617', borderRadius:'8px'}}>
                 <line x1="40" y1="20" x2="40" y2="200" stroke="#334155" strokeWidth="1" />
                 <line x1="40" y1="200" x2="340" y2="200" stroke="#334155" strokeWidth="1" />
                 <polyline points={scaleGraphPoints(graphPoints.demand)} stroke="#3b82f6" fill="none" strokeWidth="3" />
                 <polyline points={scaleGraphPoints(graphPoints.supply)} stroke="#fbbf24" fill="none" strokeWidth="3" />
              </svg>
           </div>
        </div>
      )}
    </div>
  );
}
