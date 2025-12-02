import { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { fetchRebirthInfo, performRebirth } from '../../utils/apiClient';
import { getAuthToken } from '../../store/useStore';
import { valueFromServer, toPlainValue} from '../../utils/bigValue';
import './RebirthTab.css';

export default function RebirthTab() {
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);
  
  const [rebirthInfo, setRebirthInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performing, setPerforming] = useState(false);

  useEffect(() => {
    loadRebirthInfo();
  }, []);

  const loadRebirthInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();
      const data = await fetchRebirthInfo(token);
      setRebirthInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRebirth = async () => {
    if (!rebirthInfo) return;
    
    const costValue = valueFromServer(
      rebirthInfo.next_cost_data,
      rebirthInfo.next_cost_high,
      null
    );
    const costPlain = toPlainValue(costValue);
    
    const confirmMessage = 
      `환생하시겠습니까?\n\n` +
      `비용: ${costPlain.toLocaleString()} 돈\n` +
      `새 배율: ${rebirthInfo.next_multiplier}x\n\n` +
      `⚠️ 모든 발전기와 업그레이드가 초기화됩니다!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setPerforming(true);
      const token = getAuthToken();
      const result = await performRebirth(token);
      
      // Update user and clear generators
      if (result.user) {
        syncUserState(result.user);
      }
      setPlacedGenerators([]);
      
      // Reload rebirth info
      await loadRebirthInfo();
      
      alert(result.message || '환생 성공!');
    } catch (err) {
      alert(err.message || '환생에 실패했습니다');
    } finally {
      setPerforming(false);
    }
  };

  if (loading) {
    return <div className="rebirth-tab">로딩 중...</div>;
  }

  if (error) {
    return (
      <div className="rebirth-tab">
        <p className="error">오류: {error}</p>
        <button onClick={loadRebirthInfo}>다시 시도</button>
      </div>
    );
  }

  if (!rebirthInfo) {
    return <div className="rebirth-tab">데이터를 불러올 수 없습니다</div>;
  }

  const costValue = valueFromServer(
    rebirthInfo.next_cost_data,
    rebirthInfo.next_cost_high,
    null
  );
  const costPlain = toPlainValue(costValue);
  
  const moneyValue = currentUser?.money_value || 
    valueFromServer(currentUser?.money_data, currentUser?.money_high, currentUser?.money);
  const moneyPlain = toPlainValue(moneyValue);
  
  const canAfford = moneyPlain >= costPlain;

  return (
    <div className="rebirth-tab">
      <h2>🌟 환생 (Rebirth)</h2>
      
      <div className="rebirth-info">
        <div className="info-row">
          <span className="label">현재 환생 횟수:</span>
          <span className="value">{rebirthInfo.rebirth_count}</span>
        </div>
        
        <div className="info-row">
          <span className="label">현재 배율:</span>
          <span className="value multiplier">{rebirthInfo.current_multiplier}x</span>
        </div>
        
        <div className="info-row">
          <span className="label">다음 환생 비용:</span>
          <span className={`value ${canAfford ? 'can-afford' : 'cannot-afford'}`}>
            {costPlain.toLocaleString()} 돈
          </span>
        </div>
        
        <div className="info-row">
          <span className="label">다음 배율:</span>
          <span className="value multiplier">{rebirthInfo.next_multiplier}x</span>
        </div>
        
        <div className="info-row">
          <span className="label">현재 돈:</span>
          <span className="value">{moneyPlain.toLocaleString()}</span>
        </div>
      </div>

      <div className="rebirth-description">
        <h3>환생 효과</h3>
        <ul>
          <li>✨ 에너지 생산량 배율: 2^n</li>
          <li>💰 환율 배율: 2^n</li>
          <li>⚠️ 모든 발전기 삭제</li>
          <li>⚠️ 에너지 0으로 초기화</li>
          <li>⚠️ 모든 업그레이드 초기화</li>
        </ul>
      </div>

      <button 
        className="rebirth-button"
        onClick={handleRebirth}
        disabled={!canAfford || performing}
      >
        {performing ? '환생 중...' : canAfford ? '환생하기' : '돈이 부족합니다'}
      </button>
    </div>
  );
}
