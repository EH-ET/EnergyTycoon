import { useState } from 'react';
import { API_BASE } from '../utils/data';
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

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSignup, setIsSignup] = useState(false);

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

  return (
    <div className="login-page">
      <div className="login-left">
        <div className="login-left-content">
          <div className="login-left-icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="login-left-title">Energy Tycoon</h1>
          <p className="login-left-subtitle">
            지속 가능한 에너지 제국을 건설하고<br />
            세계 최고의 에너지 기업가가 되어보세요
          </p>
          <div className="login-left-features">
            <div className="login-feature">
              <svg className="login-feature-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="login-feature-text">다양한 발전기</span>
            </div>
            <div className="login-feature">
              <svg className="login-feature-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span className="login-feature-text">실시간 랭킹</span>
            </div>
            <div className="login-feature">
              <svg className="login-feature-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="login-feature-text">경제 시스템</span>
            </div>
          </div>
        </div>
      </div>
      <div className="login-right">
        {!isSignup ? (
          <div className="login-card">
            <div>
              <h1 className="login-title">로그인</h1>
              <p className="login-subtitle">계정에 로그인하세요.</p>
            </div>
            <input
              className="login-input"
              type="text"
              id="username"
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              autoComplete="username"
            />
            <input
              className="login-input"
              type="password"
              id="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              autoComplete="current-password"
            />
            <button className="login-button primary" onClick={handleLogin}>로그인</button>
            <div
              id="messageBox"
              className={`login-message ${messageType}`}
              aria-live="polite"
            >
              {message}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center', color: '#9ba4b5', fontSize: '14px' }}>
              계정이 없으신가요?{' '}
              <button 
                onClick={() => { setIsSignup(true); setMessage(''); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#3b82f6', 
                  cursor: 'pointer', 
                  textDecoration: 'underline',
                  fontSize: '14px',
                  padding: 0
                }}
              >
                회원가입
              </button>
            </div>
          </div>
        ) : (
          <div className="login-card">
            <div>
              <h1 className="login-title">회원가입</h1>
              <p className="login-subtitle">새 계정을 만드세요.</p>
            </div>
            <input
              className="login-input"
              type="text"
              id="signup-username"
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
              autoComplete="username"
            />
            <input
              className="login-input"
              type="password"
              id="signup-password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
              autoComplete="new-password"
            />
            <button className="login-button primary" onClick={handleSignup}>회원가입</button>
            <div
              id="messageBox"
              className={`login-message ${messageType}`}
              aria-live="polite"
            >
              {message}
            </div>
            <div style={{ marginTop: '16px', textAlign: 'center', color: '#9ba4b5', fontSize: '14px' }}>
              이미 계정이 있으신가요?{' '}
              <button 
                onClick={() => { setIsSignup(false); setMessage(''); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#3b82f6', 
                  cursor: 'pointer', 
                  textDecoration: 'underline',
                  fontSize: '14px',
                  padding: 0
                }}
              >
                로그인
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
