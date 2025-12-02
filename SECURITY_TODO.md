# Security TODO

## ✅ 완료된 항목

- [x] Store passwords with salted bcrypt hashes and migrate legacy hashes automatically (`backend/auth_utils.py`, `backend/routes/auth_routes.py`).
- [x] Move access/refresh tokens out of response bodies - now only set in `HttpOnly`, `SameSite=none` cookies (`backend/routes/auth_routes.py`).
- [x] Add rate limiting with exponential backoff to authentication endpoints to prevent brute-force attacks (`backend/routes/auth_routes.py`).
- [x] Add CSRF/Origin checks on state-changing routes with anti-CSRF token (`backend/main.py`, already implemented).
- [x] Configure nginx with HTTPS redirect, HSTS, and security headers (`nginx/default.conf`).

## ⏳ 배포 시 필요한 작업

- [ ] **Render 환경 변수 설정**: `JWT_SECRET`, `FRONTEND_ORIGINS`, `COOKIE_SECURE=true` 등 설정 (상세 내용: `DEPLOYMENT_SECURITY.md` 참조).
- [ ] **Netlify 환경 변수 설정**: `VITE_API_URL`을 Render 백엔드 URL로 설정.
- [x] **프론트엔드 코드 수정**: localStorage에서 토큰 저장 코드 제거 완료 (`frontend-react/src/pages/Login.jsx`, `frontend-react/src/store/useStore.js`).
- [ ] **프론트엔드 배포**: 변경된 코드를 Netlify에 배포.
- [ ] **백엔드 배포**: 변경된 코드를 Render에 배포.
- [ ] **HTTPS 강제 확인**: Render와 Netlify에서 "Force HTTPS" 옵션 활성화 확인.
- [ ] **보안 테스트**: HTTPS, Security headers, Rate limiting, CSRF 보호 테스트 수행.

## 🚀 향후 개선 가능 항목 (Advanced)

- [ ] Replace the in-memory token store with Redis or a database-backed store for persistence and audit logging (`backend/auth_utils.py`).
- [ ] Add 2FA (Two-Factor Authentication) for enhanced account security.
- [ ] Implement audit logging for security events (failed logins, token refresh, etc.).
- [ ] Consider WAF (Web Application Firewall) or DDoS protection (e.g., Cloudflare).
- [ ] Add security monitoring and alerting (e.g., Sentry).

## 📖 참고 문서

자세한 배포 및 보안 설정은 `DEPLOYMENT_SECURITY.md`를 참조하세요.
