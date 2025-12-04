import { useState } from 'react';
import { useStore, getAuthToken } from '../../store/useStore';
import { createInquiry } from '../../utils/apiClient';
import './InquiryTab.css';

const INQUIRY_TYPES = [
  { value: 'bug', label: '버그' },
  { value: 'vulnerability', label: '취약점' },
  { value: 'proposal', label: '발전기 제안' },
  { value: 'other', label: '기타' },
];

export default function InquiryTab() {
  const [selectedType, setSelectedType] = useState('bug');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const showAlert = useStore(state => state.showAlert);

  const handleSubmit = async () => {
    if (!content.trim()) {
      showAlert('문의 내용을 입력해주세요.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const token = getAuthToken();
      await createInquiry(selectedType, content, token);
      
      setMessage({ type: 'success', text: '문의가 제출되었습니다. 검토 후 슈퍼코인을 지급해드립니다!' });
      setContent('');
      setSelectedType('bug');
    } catch (error) {
      setMessage({ type: 'error', text: error.message || '문의 제출에 실패했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="inquiry-tab">
      <h2 className="inquiry-title">문의하기</h2>
      <p className="inquiry-description">
        버그 제보, 취약점 발견, 발전기 제안 등을 해주시면 검토 후 슈퍼코인을 지급해드립니다!
      </p>

      <div className="inquiry-form">
        <div className="inquiry-form-row">
          <label className="inquiry-label">문의 종류</label>
          <div className="inquiry-type-selector">
            {INQUIRY_TYPES.map(type => (
              <button
                key={type.value}
                className={`inquiry-type-btn ${selectedType === type.value ? 'active' : ''}`}
                onClick={() => setSelectedType(type.value)}
                disabled={submitting}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="inquiry-form-row">
          <label className="inquiry-label">문의 내용</label>
          <textarea
            className="inquiry-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="자세히 설명해주세요..."
            rows={8}
            disabled={submitting}
          />
        </div>

        <div className="inquiry-form-row">
          <button
            className="inquiry-submit-btn"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '제출 중...' : '제출하기'}
          </button>
        </div>

        {message && (
          <div className={`inquiry-message ${message.type}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
