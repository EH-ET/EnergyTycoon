import { useStore } from '../store/useStore';

export default function GlobalLoadingModal() {
  const isGlobalLoading = useStore(state => state.isGlobalLoading);
  const globalLoadingMessage = useStore(state => state.globalLoadingMessage);

  if (!isGlobalLoading) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #1a1f35 0%, #0f1320 100%)',
        padding: '40px 50px',
        borderRadius: '16px',
        border: '1px solid #2a3548',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        textAlign: 'center',
        minWidth: '320px'
      }}>
        {/* Spinner */}
        <div style={{
          width: '60px',
          height: '60px',
          margin: '0 auto 20px',
          border: '4px solid #1f2a3d',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />

        {/* Message */}
        <div style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#e8edf5',
          marginBottom: '8px'
        }}>
          {globalLoadingMessage || '처리 중...'}
        </div>

        <div style={{
          fontSize: '13px',
          color: '#7c8aa6'
        }}>
          잠시만 기다려주세요
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
