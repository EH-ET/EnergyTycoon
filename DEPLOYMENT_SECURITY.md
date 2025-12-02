# 배포 환경 보안 설정 가이드

## 🔐 개요

이 문서는 Netlify (프론트엔드), Render (백엔드), Neon (데이터베이스) 배포 환경에서 필요한 보안 설정을 안내합니다.

## 📋 체크리스트

- [x] 비밀번호를 bcrypt로 해싱 (이미 구현됨)
- [x] HttpOnly 쿠키로 토큰 전송 (이미 구현됨)
- [x] CSRF 보호 (이미 구현됨)
- [x] Rate limiting with exponential backoff (업데이트됨)
- [ ] Render 환경 변수 설정
- [ ] HTTPS 강제 확인
- [ ] 프론트엔드 API URL 업데이트

---

## 🖥️ Render (백엔드) 환경 변수 설정

Render 대시보드에서 다음 환경 변수들을 설정하세요:

### 필수 환경 변수

```bash
# 데이터베이스 (Neon에서 제공)
DATABASE_URL=postgresql://user:password@host/database

# JWT 시크릿 (반드시 새로운 랜덤 값으로 설정!)
JWT_SECRET=<512자 이상의 랜덤 문자열>
# 생성 방법: python -c "import secrets; print(secrets.token_hex(256))"

# 프론트엔드 도메인
FRONTEND_ORIGINS=https://your-app.netlify.app
DEPLOY_FRONTEND_URL=https://your-app.netlify.app

# 쿠키 보안 설정
COOKIE_SECURE=true
COOKIE_SAMESITE=none
# COOKIE_DOMAIN=  # 크로스 도메인이면 비워두세요
```

### 선택적 환경 변수 (기본값 있음)

```bash
# Rate Limiting
LOGIN_COOLDOWN_SECONDS=1.0
MAX_BACKOFF_SECONDS=300
IP_MAX_ATTEMPTS=100
IP_WINDOW_SECONDS=60

# 토큰 만료 시간 (초)
ACCESS_TOKEN_TTL=3600      # 1시간
REFRESH_TOKEN_TTL=604800   # 7일

# 쿠키 이름 (보안을 위해 난독화됨, 변경 가능)
ACCESS_COOKIE_NAME=ec9db4eab1b820ebb3b5ed98b8ed9994ed9598eb8ba4eb8b88
REFRESH_COOKIE_NAME=yeCuXMndsYC3kMnAPw__
CSRF_COOKIE_NAME=csrf_token
TRAP_COOKIE_NAME=abtkn
```

---

## 🌐 Netlify (프론트엔드) 설정

### 환경 변수

Netlify 대시보드에서 설정:

```bash
# 백엔드 API URL (Render 도메인)
VITE_API_URL=https://your-backend.onrender.com
```

### Build Settings

```bash
# Build command
npm run build

# Publish directory
dist
```

### Headers 설정

Netlify의 `netlify.toml` 파일에 보안 헤더 추가:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"
```

---

## 🔒 HTTPS/HSTS 설정

### Render

Render는 자동으로 HTTPS를 제공합니다:
- ✅ 자동 SSL 인증서 (Let's Encrypt)
- ✅ HTTP → HTTPS 자동 리다이렉트
- ✅ HSTS 헤더는 애플리케이션에서 설정 (이미 구현됨)

**확인 방법:**
1. Render 대시보드 → Settings → HTTPS 섹션 확인
2. "Redirect HTTP to HTTPS" 옵션이 활성화되어 있는지 확인

### Netlify

Netlify도 자동으로 HTTPS를 제공합니다:
- ✅ 자동 SSL 인증서 (Let's Encrypt)
- ✅ HTTP → HTTPS 자동 리다이렉트

**확인 방법:**
1. Netlify 대시보드 → Domain settings → HTTPS 섹션 확인
2. "Force HTTPS" 옵션 활성화

---

## 🗄️ Neon (데이터베이스) 보안

Neon은 기본적으로 다음 보안 기능을 제공합니다:
- ✅ SSL/TLS 연결 강제
- ✅ IP 화이트리스트 (필요시 설정)
- ✅ 자동 백업

**추가 설정 (선택사항):**
1. Neon 대시보드에서 IP 화이트리스트 설정
2. Render의 Static Outbound IP 추가

---

## 🧪 보안 테스트

배포 후 다음 항목들을 테스트하세요:

### 1. HTTPS 강제
```bash
curl -I http://your-app.netlify.app
# Location: https://your-app.netlify.app 확인

curl -I http://your-backend.onrender.com
# Location: https://your-backend.onrender.com 확인
```

### 2. Security Headers 확인
```bash
curl -I https://your-backend.onrender.com
# Strict-Transport-Security 헤더 확인
# X-Frame-Options: DENY 확인
# X-Content-Type-Options: nosniff 확인
```

### 3. Rate Limiting 테스트
```bash
# 여러 번 연속으로 잘못된 비밀번호로 로그인 시도
# Exponential backoff가 작동하는지 확인
```

### 4. CSRF 보호 확인
```bash
# CSRF 토큰 없이 POST 요청
# 403 Forbidden 응답 확인
```

### 5. Cookie 설정 확인
브라우저 개발자 도구 → Application → Cookies에서:
- ✅ HttpOnly 플래그 설정
- ✅ Secure 플래그 설정 (HTTPS)
- ✅ SameSite=None (크로스 도메인)

---

## ⚠️ 주의사항

### JWT_SECRET 생성하기

**절대로 기본값을 사용하지 마세요!** 

새로운 JWT secret 생성:
```bash
python -c "import secrets; print(secrets.token_hex(256))"
```

### 토큰 저장 위치

- ✅ **백엔드**: HttpOnly 쿠키에 저장 (JavaScript에서 접근 불가)
- ❌ **프론트엔드**: localStorage나 sessionStorage에 저장 금지 (XSS 취약점)

### CORS 설정

프로덕션에서는 정확한 도메인만 허용:
```python
# ❌ 나쁜 예
FRONTEND_ORIGINS=*

# ✅ 좋은 예
FRONTEND_ORIGINS=https://your-app.netlify.app
```

---

## 🔄 업데이트 필요 사항

### 프론트엔드 코드 수정

API 요청 시 쿠키를 포함하도록 설정:

```javascript
// fetch 사용 시
fetch('https://your-backend.onrender.com/api/endpoint', {
  method: 'POST',
  credentials: 'include',  // 중요!
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken(),  // CSRF 토큰 포함
  },
  body: JSON.stringify(data),
});

// axios 사용 시
axios.defaults.withCredentials = true;
```

### localStorage에서 토큰 제거

기존에 localStorage에 저장하던 토큰 코드를 모두 제거:

```javascript
// ❌ 제거해야 할 코드
localStorage.setItem('access_token', token);
localStorage.setItem('refresh_token', token);

// ✅ 쿠키는 백엔드에서 자동으로 설정됨
// 프론트엔드에서 토큰을 직접 저장할 필요 없음
```

---

## 📊 보안 등급

현재 보안 수준: **B+** → **A-** (개선 후)

### 개선 사항:
- ✅ Exponential backoff 추가
- ✅ HttpOnly 쿠키로 토큰 관리
- ✅ CSRF 보호 강화
- ✅ Security headers 추가
- ✅ Rate limiting 개선

### 추가 개선 가능 항목 (Advanced):
- [ ] Redis를 사용한 토큰 저장소 (현재는 메모리 기반)
- [ ] WAF (Web Application Firewall) 설정
- [ ] DDoS 보호 (Cloudflare 등)
- [ ] 2FA (Two-Factor Authentication)
- [ ] 감사 로깅 (Audit Logging)

---

## 🆘 문제 해결

### CORS 에러가 발생하는 경우

1. `FRONTEND_ORIGINS` 환경 변수 확인
2. `COOKIE_SAMESITE=none` 설정 확인
3. `COOKIE_SECURE=true` 설정 확인
4. 프론트엔드에서 `credentials: 'include'` 설정 확인

### 쿠키가 설정되지 않는 경우

1. HTTPS 사용 확인
2. `COOKIE_SECURE=true` 설정 확인
3. 브라우저의 쿠키 정책 확인 (Safari는 SameSite=None 제한 있음)
4. 도메인 설정 확인 (`COOKIE_DOMAIN` 비우기 또는 정확히 설정)

### Rate limiting이 작동하지 않는 경우

1. 환경 변수 확인
2. 서버 재시작
3. 로그 확인

---

## 📚 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Render Security Best Practices](https://render.com/docs/security)
- [Netlify Security](https://docs.netlify.com/security/)
