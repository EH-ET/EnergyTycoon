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
    <div className="inquiry-tab" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', overflow: 'auto' }}>
      <h2 className="inquiry-title" style={{ marginBottom: '8px' }}>문의하기</h2>
      <p className="inquiry-description" style={{ marginBottom: '16px' }}>
        버그 제보, 취약점 발견, 발전기 제안 등을 해주시면 검토 후 슈퍼코인을 지급해드립니다!
      </p>

      <div className="inquiry-content-wrapper" style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar: Types */}
        <div className="inquiry-sidebar" style={{ width: '180px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label className="inquiry-label" style={{ marginBottom: '4px' }}>문의 종류</label>
          {INQUIRY_TYPES.map(type => (
            <button
              key={type.value}
              className={`inquiry-type-btn ${selectedType === type.value ? 'active' : ''}`}
              onClick={() => setSelectedType(type.value)}
              disabled={submitting}
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid #333',
                background: selectedType === type.value ? '#3b82f6' : '#1f2937',
                color: selectedType === type.value ? '#fff' : '#9ca3af',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Right Main: Input & Submit */}
        <div className="inquiry-main-form" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <label className="inquiry-label" style={{ marginBottom: '8px' }}>문의 내용</label>
            <textarea
              className="inquiry-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="자세히 설명해주세요..."
              disabled={submitting}
              style={{
                flex: 1,
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #374151',
                background: '#111827',
                color: '#f3f4f6',
                resize: 'none',
                fontSize: '14px',
                lineHeight: '1.5',
                minHeight: '200px'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', paddingBottom: '16px' }}>
            {message && (
              <span className={`inquiry-message ${message.type}`} style={{ fontSize: '14px', color: message.type === 'success' ? '#4ade80' : '#f87171' }}>
                {message.text}
              </span>
            )}
            <button
              className="inquiry-submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: submitting ? '#4b5563' : '#2563eb',
                color: '#fff',
                fontWeight: 'bold',
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? '제출 중...' : '제출하기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
