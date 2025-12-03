import { useEffect, useState } from 'react';
import { API_BASE } from '../utils/data';
import { fetchRanks } from '../utils/apiClient';
import { getAuthToken } from '../store/useStore';
import '../Login.css';

const CSRF_COOKIE_NAME = "csrf_token";
const STORAGE_KEYS = {
  user: "et_u",
  sessionTs: "et_ss",
  trap: "et_tp",
};

function getCsrfToken() {
  const cookie = document.cookie || "";
  const entries = cookie.split(";").map((c) => c.trim());
  for (const entry of entries) {
    if (!entry) continue;
    const [k, ...rest] = entry.split("=");
    if (k === CSRF_COOKIE_NAME) return rest.join("=");
  }
  const token = (crypto?.randomUUID?.() || `csrf_${Date.now()}`);
  const d = new Date();
  d.setTime(d.getTime() + 7 * 24 * 60 * 60 * 1000);
  document.cookie = `${CSRF_COOKIE_NAME}=${token}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
  return token;
}

function sanitizeUsername(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[^A-Za-z0-9]/g, "").trim();
}

function sanitizeInput(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[<>"'`]/g, "").trim();
}

function storeUser(user) {
  try {
    const encoded = btoa(JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.user, encoded);
  } catch (e) {
    // Silent fail
  }
}

function storeCsrfFromResponse(response) {
  const headerVal = response?.headers?.get?.("x-csrf-token");
  if (!headerVal) return;
  try {
    localStorage.setItem("et_csrf", headerVal);
  } catch (e) {
    // Silent fail
  }
}

function setSessionStart() {
  if (!localStorage.getItem(STORAGE_KEYS.sessionTs)) {
    localStorage.setItem(STORAGE_KEYS.sessionTs, String(Date.now()));
  }
}

function readTrapCookie() {
  const cookie = document.cookie || "";
  const entries = cookie.split(";").map((c) => c.trim());
  for (const entry of entries) {
    if (!entry) continue;
    const [k, ...rest] = entry.split("=");
    if (k === "abtkn") return rest.join("=");
  }
  return null;
}

function persistTrapMarker() {
  const trap = readTrapCookie();
  if (trap) sessionStorage.setItem(STORAGE_KEYS.trap, trap);
}

function readStoredUsername() {
  const stored = localStorage.getItem(STORAGE_KEYS.user);
  if (!stored) return null;
  try {
    const decoded = atob(stored);
    const parsed = JSON.parse(decoded);
    return parsed?.username || null;
  } catch (_e) {
    return null;
  }
}

function formatScore(score) {
  if (score == null) return '-';
  if (typeof score === 'number') return score.toLocaleString();
  if (typeof score === 'string') {
    const num = Number(score);
    return Number.isNaN(num) ? score : num.toLocaleString();
  }
  return String(score);
}

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [boardStatus, setBoardStatus] = useState('');
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState('');
  const storedUsername = readStoredUsername();

  const showMessage = (msg, type = 'success') => {
    setMessage(msg);
    setMessageType(type);
  };

  const handleLogin = async () => {
    const cleanUsername = sanitizeUsername(username);
    const cleanPassword = sanitizeInput(password);

    if (!cleanUsername) {
      showMessage('아이디를 입력해주세요.', 'error');
      return;
    }
    if (!cleanPassword) {
      showMessage('비밀번호를 입력해주세요.', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
      });

      const data = await response.json();
      
      if (!response.ok) throw new Error(data.detail || 'login failed');

      storeUser(data.user);
      
      if (data.access_token) {
        import('../store/useStore').then(({ setMemoryToken }) => {
          setMemoryToken(data.access_token);
        });
      }

      storeCsrfFromResponse(response);
      setSessionStart();
      persistTrapMarker();

      if (onLoginSuccess) {
        onLoginSuccess(data.user, data.access_token || null);
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('Login error:', error);
      showMessage(error.message || 'Error', 'error');
    }
  };

  const handleSignup = async () => {
    const cleanUsername = sanitizeUsername(username);
    const cleanPassword = sanitizeInput(password);

    if (!cleanUsername) {
      showMessage('회원가입을 위해 아이디를 입력해주세요.', 'error');
      return;
    }
    if (!cleanPassword) {
      showMessage('회원가입을 위해 비밀번호를 입력해주세요.', 'error');
      return;
    }

    try {
      const signupResponse = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
      });

      const signupData = await signupResponse.json();
      if (!signupResponse.ok) throw new Error(signupData.detail || 'signup failed');

      // Signup also automatically logs in and sets cookies
      // Store only user info (tokens are now in HttpOnly cookies)
      storeUser(signupData.user);
      storeCsrfFromResponse(signupResponse);
      setSessionStart();
      persistTrapMarker();

      if (onLoginSuccess) {
        // Pass null as token since it's in cookies now
        onLoginSuccess(signupData.user, null);
      } else {
        window.location.reload();
      }
    } catch (error) {
      showMessage(error.message || 'Error', 'error');
    }
  };

  useEffect(() => {
    let isMounted = true;
    const loadRanks = async () => {
      setBoardLoading(true);
      setBoardError('');
      try {
        const token = getAuthToken();
        const data = await fetchRanks(token, { limit: 8, offset: 0 });
        if (!isMounted) return;
        const ranks = data?.ranks || [];
        setLeaderboard(ranks);
        if (ranks.length) {
          setBoardStatus(`총 ${data.total}명 중 상위 ${ranks.length}명`);
        } else {
          setBoardStatus('아직 랭킹 데이터가 없어요');
        }
      } catch (error) {
        if (!isMounted) return;
        // 로그인 전이거나 인증 실패 시에는 부드러운 안내로 대체
        setBoardError('');
        setBoardStatus('로그인 후 내 랭킹을 확인할 수 있어요.');
        setLeaderboard([]);
      } finally {
        if (isMounted) setBoardLoading(false);
      }
    };
    loadRanks();
    return () => { isMounted = false; };
  }, []);

  return (
    <div className="login-page">
      <div className="split-layout">
        <section className="panel intro">
          <div className="badge">듀얼 패널</div>
          <h1 className="intro-title">에너지 도시로 돌아오세요</h1>
          <p className="intro-lede">
            밝고 가벼운 톤으로, 랭킹 정보를 곁들인 양면 레이아웃입니다.
          </p>
            <div className="leaderboard">
              <div className="leaderboard-head">
                <span className="badge badge-soft">라이브 랭킹</span>
                <p className="board-status">
                  {boardLoading ? '랭킹 불러오는 중...' : boardStatus || '랭킹을 확인해보세요.'}
              </p>
            </div>
            <div className="leaderboard-list">
              {boardLoading && (
                Array.from({ length: 5 }).map((_, idx) => (
                  <div className="board-row skeleton" key={`skeleton-${idx}`}>
                    <div className="skeleton-bar rank" />
                    <div className="skeleton-bar name" />
                    <div className="skeleton-bar score" />
                  </div>
                ))
              )}
              {!boardLoading && leaderboard.map((item) => {
                const isMe = storedUsername && item.username === storedUsername;
                return (
                  <div className={`board-row ${isMe ? 'me' : ''}`} key={`${item.rank}-${item.username}`}>
                    <div className="board-rank">#{item.rank}</div>
                    <div className="board-name">{item.username}</div>
                    <div className="board-score">{formatScore(item.score)}</div>
                  </div>
                );
              })}
              {!boardLoading && !leaderboard.length && !boardError && (
                <div className="board-empty">랭킹 데이터가 없습니다.</div>
              )}
              {!boardLoading && boardError && (
                <div className="board-error">{boardError}</div>
              )}
              {!boardLoading && !boardError && !storedUsername && (
                <div className="board-note">로그인하면 내 랭킹이 강조돼요.</div>
              )}
            </div>
          </div>
          <div className="footnote">* 메인 페이지의 밝은 카드 톤을 그대로 가져왔어요.</div>
        </section>

        <section className="panel form-panel">
          <div className="form-card">
            <div className="form-head">
              <p className="eyebrow">Sign in</p>
              <h2>로그인하고 성장 재개</h2>
              <p className="sub">간단한 폼과 선명한 버튼으로 빠르게 시작하세요.</p>
            </div>

            <form
              id="loginForm"
              className="login-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleLogin();
              }}
              noValidate
            >
              <label htmlFor="username">아이디</label>
              <input
                type="text"
                id="username"
                placeholder="아이디"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoComplete="username"
              />

              <label htmlFor="password">비밀번호</label>
              <input
                type="password"
                id="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
              />

              <button type="button" id="loginBtn" className="btn primary" onClick={handleLogin}>
                로그인
              </button>
              <button type="button" id="signupBtn" className="btn outline" onClick={handleSignup}>
                회원가입
              </button>
            </form>

            <div
              id="messageBox"
              className={`login-message ${messageType}`}
              aria-live="polite"
            >
              {message}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
