import { useState, useEffect } from 'react';
import { useStore, getAuthToken } from '../store/useStore';
import { getRebirthInfo, performRebirth } from '../utils/apiClient';
import { formatResourceValue } from '../utils/bigValue';

export default function RebirthModal({ open, onClose }) {
  const [rebirthInfo, setRebirthInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const currentUser = useStore(state => state.currentUser);
  const syncUserState = useStore(state => state.syncUserState);
  const setPlacedGenerators = useStore(state => state.setPlacedGenerators);

  useEffect(() => {
    if (!open || !currentUser) return;
    
    const fetchInfo = async () => {
      try {
        const token = getAuthToken();
        const data = await getRebirthInfo(token);
        setRebirthInfo(data);
      } catch (err) {
        setError('환생 정보를 불러오지 못했습니다.');
      }
    };
    
    fetchInfo();
  }, [open, currentUser]);

  const handleRebirth = async () => {
    if (!currentUser || loading) return;
    
    setLoading(true);
    setError('');
    
    try {
      const token = getAuthToken();
      const data = await performRebirth(token);
      
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

  if (!open) return null;

  const nextCost = rebirthInfo ? { data: rebirthInfo.next_cost_data, high: rebirthInfo.next_cost_high } : null;

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
        
        {rebirthInfo && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '12px' }}>
              <strong>현재 환생 횟수:</strong> {rebirthInfo.rebirth_count}회
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>현재 배수:</strong> {rebirthInfo.current_multiplier}x
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>다음 배수:</strong> {rebirthInfo.next_multiplier}x
            </div>
            <div style={{ marginBottom: '12px' }}>
              <strong>환생 비용:</strong> {nextCost ? formatResourceValue(nextCost) : '로딩 중...'}
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
                <li>돈 (10으로 초기화)</li>
              </ul>
              <p style={{ margin: '12px 0 0', fontSize: '14px', color: '#4ade80' }}>
                ✨ 생산량 및 환율이 영구적으로 {rebirthInfo.next_multiplier}배 증가합니다!
              </p>
            </div>
          </div>
        )}
        
        <div style={{ display: 'flex', gap: '12px' }}>
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
            onClick={handleRebirth}
            disabled={loading || !rebirthInfo}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid #7c3aed',
              background: '#7c3aed',
              color: '#fff',
              cursor: loading || !rebirthInfo ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
            }}
          >
            {loading ? '환생 중...' : '환생하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
