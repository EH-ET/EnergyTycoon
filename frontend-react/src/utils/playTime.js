const PLAY_TIME_KEY = 'et_play_total';
const EVENT_NAME = 'et-playtime-updated';

export function formatPlayTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}일 ${hours}시간 ${minutes}분 ${seconds}초`;
}

export function readStoredPlayTime() {
  const stored = localStorage.getItem(PLAY_TIME_KEY);
  const num = Number(stored);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function persistPlayTime(value) {
  try {
    const safe = Math.max(0, Math.floor(value));
    localStorage.setItem(PLAY_TIME_KEY, String(safe));
    document.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: safe }));
  } catch (e) {
    // Silent fail
  }
}

export function parseServerPlayTime(user) {
  if (!user) return 0;
  const candidates = [
    user.play_time_ms,
    user.play_time,
    user.playtime,
    user.total_play_time,
  ];
  for (const c of candidates) {
    const num = Number(c);
    if (!Number.isFinite(num) || num < 0) continue;
    // Server always stores in milliseconds, so just return the value
    return num;
  }
  return 0;
}

export const PLAY_TIME_EVENT = EVENT_NAME;
