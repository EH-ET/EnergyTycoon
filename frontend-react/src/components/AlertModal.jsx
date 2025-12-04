import '../AlertModal.css';

export default function AlertModal({ message, onClose, onConfirm }) {
  if (!message) return null;

  return (
    <div className="alert-modal-overlay" onClick={onClose}>
      <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-message">{message}</div>
        {onConfirm ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button className="alert-modal-close" onClick={onConfirm} style={{ background: '#e74c3c' }}>
              확인
            </button>
            <button className="alert-modal-close" onClick={onClose} style={{ background: '#6c757d' }}>
              취소
            </button>
          </div>
        ) : (
          <button className="alert-modal-close" onClick={onClose}>
            확인
          </button>
        )}
      </div>
    </div>
  );
}
