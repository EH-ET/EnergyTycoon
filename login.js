const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const messageBox = document.getElementById('messageBox');

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

  // 로그인 백엔드
  window.location.href = 'main.html';
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

  // 회원가입 백엔드
});