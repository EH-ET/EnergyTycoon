import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!open) return;
    setPrefs(loadAudioPrefs());
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
      </div>
    </div>
  );
}
