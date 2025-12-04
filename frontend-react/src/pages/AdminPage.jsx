import { useState, useEffect } from 'react';
import { getAuthToken } from '../store/useStore';
import { fetchInquiries, acceptInquiry, rejectInquiry } from '../utils/apiClient';
import './AdminPage.css';

export default function AdminPage() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const goBack = () => {
    window.location.hash = '';
  };

  const loadInquiries = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        goBack();
        return;
      }
      const data = await fetchInquiries(token);
      setInquiries(data);
    } catch (err) {
      setError(err.message || '문의 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInquiries();
  }, []);

  const handleAccept = async (inquiryId) => {
    if (!confirm('이 문의를 수락하시겠습니까? 유저에게 슈퍼코인 +1이 지급됩니다.')) {
      return;
    }

    try {
      const token = getAuthToken();
      await acceptInquiry(inquiryId, token);
      await loadInquiries();
    } catch (err) {
      alert(err.message || '수락에 실패했습니다.');
    }
  };

  const handleReject = async (inquiryId) => {
    if (!confirm('이 문의를 거절하시겠습니까?')) {
      return;
    }

    try {
      const token = getAuthToken();
      await rejectInquiry(inquiryId, token);
      await loadInquiries();
    } catch (err) {
      alert(err.message || '거절에 실패했습니다.');
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      bug: '버그',
      vulnerability: '취약점',
      proposal: '발전기 제안',
      other: '기타',
    };
    return labels[type] || type;
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <h1>관리자 페이지</h1>
          <button className="back-btn" onClick={goBack}>
            게임으로 돌아가기
          </button>
        </div>
        <div className="admin-loading">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="admin-header">
          <h1>관리자 페이지</h1>
          <button className="back-btn" onClick={goBack}>
            게임으로 돌아가기
          </button>
        </div>
        <div className="admin-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>관리자 페이지 - 문의 관리</h1>
        <button className="back-btn" onClick={goBack}>
          게임으로 돌아가기
        </button>
      </div>

      {inquiries.length === 0 ? (
        <div className="admin-empty">문의가 없습니다.</div>
      ) : (
        <div className="inquiries-list">
          {inquiries.map(inquiry => (
            <div key={inquiry.inquiry_id} className="inquiry-card">
              <div className="inquiry-card-header">
                <div className="inquiry-meta">
                  <span className="inquiry-type-badge">{getTypeLabel(inquiry.type)}</span>
                  <span className="inquiry-user">작성자: {inquiry.username || 'Unknown'}</span>
                  <span className="inquiry-date">{formatDate(inquiry.created_at)}</span>
                </div>
                <div className="inquiry-actions">
                  <button
                    className="accept-btn"
                    onClick={() => handleAccept(inquiry.inquiry_id)}
                  >
                    수락 (+1 🪙)
                  </button>
                  <button
                    className="reject-btn"
                    onClick={() => handleReject(inquiry.inquiry_id)}
                  >
                    거절
                  </button>
                </div>
              </div>
              <div className="inquiry-content">
                {inquiry.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
