const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const messageBox = document.getElementById('messageBox');
const backendUrl = window.backendUrl || "http://localhost:8000"; // 변경: 실제 backend URL 또는 환경에서 주입

function showMessage(msg, color = 'green') {
  messageBox.textContent = msg;
  messageBox.style.color = color;
}

loginBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username) {
    showMessage('아이디를 입력해주세요.', 'red');
    return;
  }
  if (!password) {
    showMessage('비밀번호를 입력해주세요.', 'red');
    return;
  }

  const object = {
    body: JSON.stringify({username, password}),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    }
  };

  // 로그인 백엔드
    fetch(`${backendUrl}/login`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username, password})
    })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'login failed');
      // backend returns { access_token, user }
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = "main.html";
    }).catch(error => showMessage(error.message || 'Error', 'red'))
});

signupBtn.addEventListener('click', () => {
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username) {
    showMessage('회원가입을 위해 아이디를 입력해주세요.', 'red');
    return;
  }
  if (!password) {
    showMessage('회원가입을 위해 비밀번호를 입력해주세요.', 'red');
    return;
  }

  const object = {
    body: JSON.stringify({username, password}),
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    }
  };

  // 회원가입 백엔드
    fetch(`${backendUrl}/signup`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({username, password})
    })
    .then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'signup failed');
      // after signup, auto-login: set a trivial token by re-calling login endpoint
      return fetch(`${backendUrl}/login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
      })
    })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'login after signup failed');
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = "main.html";
    })
    .catch(error => showMessage(error.message || 'Error', 'red'))
});