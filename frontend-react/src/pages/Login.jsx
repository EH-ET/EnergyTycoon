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
      console.log('🔐 Login attempt:', { username: cleanUsername, url: `${API_BASE}/login` });
      
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": getCsrfToken()
        },
        credentials: "include",
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('📦 Response data:', data);
      
      if (!response.ok) throw new Error(data.detail || 'login failed');

      // Store only user info (tokens are now in HttpOnly cookies)
      storeUser(data.user);
      
      // Fallback: Store token in memory if returned (for cross-domain support)
      if (data.access_token) {
        import('../store/useStore').then(({ setMemoryToken }) => {
          setMemoryToken(data.access_token);
        });
      }

      storeCsrfFromResponse(response);
      setSessionStart();
      persistTrapMarker();

      if (onLoginSuccess) {
        // Pass token if available
        onLoginSuccess(data.user, data.access_token || null);
      } else {
        window.location.reload();
      }
    } catch (error) {
      console.error('❌ Login error:', error);
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
      <div className="login-card">
        <div>
          <h1 className="login-title">Energy Tycoon</h1>
          <p className="login-subtitle">지속 가능한 에너지 제국을 시작하세요.</p>
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
        <div className="login-actions">
          <button className="login-button primary" id="loginBtn" onClick={handleLogin}>로그인</button>
          <button className="login-button secondary" id="signupBtn" onClick={handleSignup}>회원가입</button>
        </div>
        <div
          id="messageBox"
          className={`login-message ${messageType}`}
          aria-live="polite"
        >
          {message}
        </div>
      </div>
    </div>
  );
}
