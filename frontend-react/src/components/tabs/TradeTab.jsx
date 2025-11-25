import { useState, useEffect } from 'react';
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

  const expectedGain = typeof exchangeRate === 'number'
    ? Math.max(1, Math.floor(amount * exchangeRate))
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px' }}>
      <div style={{ padding: '12px', border: '1px solid #444', background: '#0f0f0f', color: '#eaeaea', borderRadius: '8px' }}>
        <div style={{ marginBottom: '8px' }}>
          최근 환율: {typeof exchangeRate === 'number' ? `1 에너지 → ${exchangeRate.toFixed(2)} 돈` : '거래 시 표시됩니다.'}
        </div>

        <input
          type="number"
          min="1"
          placeholder="팔 에너지 (기본 1)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: '100%', marginBottom: '8px' }}
        />

        <button
          type="button"
          onClick={handleExchange}
          disabled={isLoading}
          style={{ width: '100%', padding: '10px', cursor: 'pointer' }}
        >
          에너지 → 돈 교환
        </button>

        {message && (
          <div style={{ marginTop: '8px', fontSize: '13px', color: '#a8ff8e' }}>
            {message}
          </div>
        )}

        <div style={{ marginTop: '8px', fontSize: '13px', color: '#ccc' }}>
          <div>1 에너지당 {typeof exchangeRate === 'number' ? exchangeRate.toFixed(2) : '-'} 원</div>
          <div>{formatPlain(amount)} 에너지 → {formatPlain(expectedGain)} 돈 예상</div>
        </div>
      </div>

      <div style={{ border: '1px solid #444', borderRadius: '8px', padding: '8px', background: '#0a0a0a' }}>
        <svg width="100%" height="240" viewBox="0 0 240 240" style={{ background: '#111' }}>
          <line x1="30" y1="10" x2="30" y2="210" stroke="#666" strokeWidth="1" />
          <line x1="30" y1="210" x2="230" y2="210" stroke="#666" strokeWidth="1" />
          <text x="10" y="20" fill="#888" fontSize="12">가격</text>
          <text x="200" y="230" fill="#888" fontSize="12">수량</text>
          <polyline points="40,40 220,200" stroke="#4caf50" fill="none" strokeWidth="2" />
          <polyline points="40,200 200,40" stroke="#f44336" fill="none" strokeWidth="2" />
          <text x="60" y="55" fill="#4caf50" fontSize="12">수요</text>
          <text x="140" y="60" fill="#f44336" fontSize="12">공급</text>
        </svg>
      </div>
      <AlertModal
        message={alertMessage}
        onClose={() => setAlertMessage('')}
      />
    </div>
  );
}
