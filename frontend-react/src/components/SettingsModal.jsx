import { useEffect, useState } from 'react';
import { deleteAccount } from '../utils/apiClient';
import { getAuthToken } from '../store/useStore';

const AUDIO_PREF_KEY = "audio_preferences";
const DEFAULT_PREFS = { music: true, sfx: true };

function loadAudioPrefs() {
  try {
    const stored = localStorage.getItem(AUDIO_PREF_KEY);
    if (!stored) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(stored);
    return {
      music: typeof parsed.music === "boolean" ? parsed.music : true,
      sfx: typeof parsed.sfx === "boolean" ? parsed.sfx : true,
    };
  } catch (err) {
    console.warn("audio preference parse failed", err);
    return { ...DEFAULT_PREFS };
  }
}

function persistAudioPrefs(pref) {
  localStorage.setItem(AUDIO_PREF_KEY, JSON.stringify(pref));
  document.dispatchEvent(new CustomEvent("audio-preferences-changed", { detail: pref }));
}

export default function SettingsModal({ open, onClose }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPrefs(loadAudioPrefs());
    setPassword("");
    setDeleteError("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  const updatePref = (key, value) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    persistAudioPrefs(next);
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    const pwd = password.trim();
    if (!pwd) {
      setDeleteError("비밀번호를 입력해주세요.");
      return;
    }
    const confirmed = window.confirm("정말 탈퇴하시겠습니까? 이 작업은 되돌릴 수 없습니다.");
    if (!confirmed) return;
    try {
      setIsDeleting(true);
      const token = getAuthToken();
      await deleteAccount(pwd, token);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/";
    } catch (err) {
      setDeleteError(err?.message || "계정 삭제에 실패했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={`settings-overlay ${open ? 'active' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="settings-modal">
        <h3>환경 설정</h3>
        <p style={{ marginTop: 0, marginBottom: 12 }}>배경음과 효과음을 상황에 맞게 토글하세요.</p>

        <div className="settings-toggles">
          <div className="settings-toggle">
            <label htmlFor="settings-music">배경음</label>
            <input
              id="settings-music"
              type="checkbox"
              checked={prefs.music}
              onChange={(e) => updatePref("music", e.target.checked)}
            />
          </div>
          <div className="settings-toggle">
            <label htmlFor="settings-sfx">효과음</label>
            <input
              id="settings-sfx"
              type="checkbox"
              checked={prefs.sfx}
              onChange={(e) => updatePref("sfx", e.target.checked)}
            />
          </div>
        </div>

        <div className="settings-actions">
          <button type="button" onClick={onClose}>닫기</button>
        </div>

        <hr style={{ margin: "16px 0", borderColor: "#333" }} />
        <div style={{ display: "grid", gap: "8px" }}>
          <label htmlFor="delete-password" style={{ fontWeight: 600 }}>회원 탈퇴</label>
          <input
            id="delete-password"
            type="password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: "10px", borderRadius: "8px", border: "1px solid #555" }}
          />
          {deleteError && (
            <div style={{ color: "#ff6b6b", fontSize: "13px" }}>{deleteError}</div>
          )}
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            style={{
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #b00020",
              background: isDeleting ? "#4a000f" : "linear-gradient(135deg, #ff4d6d, #b00020)",
              color: "#fff",
              cursor: isDeleting ? "not-allowed" : "pointer",
              fontWeight: 700,
            }}
          >
            {isDeleting ? "탈퇴 처리 중..." : "회원 탈퇴"}
          </button>
        </div>
      </div>
    </div>
  );
}
