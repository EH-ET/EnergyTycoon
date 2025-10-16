const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const messageBox = document.getElementById('messageBox');
const backendUrl = "";

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
  fetch(`${backendUrl}/login`, object)
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      window.location.href = "main.html";
    }else {
      alert("로그인 실패!");
    }
  }).catch(error => console.log("Error: ", error))
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
  fetch(`${backendUrl}/createuser`, object)
  .then(response => {response.json()})
  .then(data => {
    if (data.success) {
      window.location.href = "main.html";
    }else {
      alert("회원가입 오류!");
    }
  }).catch(error => console.log("Error: ", error))
});