import '../AlertModal.css';

export default function AlertModal({ message, onClose }) {
  if (!message) return null;

  return (
    <div className="alert-modal-overlay" onClick={onClose}>
      <div className="alert-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="alert-modal-message">{message}</div>
        <button className="alert-modal-close" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
}
