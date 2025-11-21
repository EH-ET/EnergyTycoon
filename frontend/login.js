const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const messageBox = document.getElementById('messageBox');
const backendUrl = (() => {
  if (window.backendUrl) return window.backendUrl;
  const { protocol, hostname, port } = window.location || {};
  if (port === "5500") return "http://127.0.0.1:8000";
  if (protocol === "http:" || protocol === "https:") return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  return "http://127.0.0.1:8000";
})();

const STORAGE_KEYS = {
  user: "et_u",
  sessionTs: "et_ss",
  trap: "et_tp",
  access: "et_at",
  refresh: "et_rt",
};

function sanitizeInput(value) {
  if (typeof value !== "string") return "";
  // Remove characters commonly used in XSS payloads while preserving typical credentials
  return value.replace(/[<>"'`]/g, "").trim();
}

function sanitizeUsername(value) {
  if (typeof value !== "string") return "";
  // Allow only ASCII letters and numbers for usernames
  return value.replace(/[^A-Za-z0-9]/g, "").trim();
}

function storeUser(user) {
  try {
    const encoded = btoa(JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.user, encoded);
  } catch (e) {
    console.warn("storeUser failed", e);
  }
}

function setSessionStart() {
  if (!localStorage.getItem(STORAGE_KEYS.sessionTs)) {
    localStorage.setItem(STORAGE_KEYS.sessionTs, String(Date.now()));
  }
}

// Cookie handling disabled
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

function storeTokens({ access_token, refresh_token }) {
  if (access_token) sessionStorage.setItem(STORAGE_KEYS.access, access_token);
  if (refresh_token) sessionStorage.setItem(STORAGE_KEYS.refresh, refresh_token);
}

function showMessage(msg, color = 'green') {
  messageBox.textContent = msg;
  messageBox.style.color = color;
}

loginBtn.addEventListener('click', () => {
  const username = sanitizeUsername(usernameInput.value);
  const password = sanitizeInput(passwordInput.value);

  if (!username) {
    showMessage('아이디를 입력해주세요.', 'red');
    return;
  }
  if (!password) {
    showMessage('비밀번호를 입력해주세요.', 'red');
    return;
  }

  fetch(`${backendUrl}/login`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({username, password})
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'login failed');
      storeTokens(data);
      storeUser(data.user);
      setSessionStart();
      persistTrapMarker();
      window.location.href = "main.html";
    })
    .catch((error) => showMessage(error.message || 'Error', 'red'));
});

signupBtn.addEventListener('click', () => {
  const username = sanitizeUsername(usernameInput.value);
  const password = sanitizeInput(passwordInput.value);

  if (!username) {
    showMessage('회원가입을 위해 아이디를 입력해주세요.', 'red');
    return;
  }
  if (!password) {
    showMessage('회원가입을 위해 비밀번호를 입력해주세요.', 'red');
    return;
  }

  fetch(`${backendUrl}/signup`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    credentials: "include",
    body: JSON.stringify({username, password})
  })
    .then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'signup failed');
      return fetch(`${backendUrl}/login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
        body: JSON.stringify({username, password})
      });
    })
    .then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'login after signup failed');
      storeTokens(data);
      storeUser(data.user);
      setSessionStart();
      persistTrapMarker();
      window.location.href = "main.html";
    })
    .catch((error) => showMessage(error.message || 'Error', 'red'));
});
