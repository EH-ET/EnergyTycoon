# /logout

HTTP Method: POST
Service: 로그아웃

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {refresh_token} | 현재 로그인된 사용자의 재발급 토큰 |

### **Body**

요청 바디 없음

```json
{}
```

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "detail": "Logout successful"
}
```

---

### ❌ **Fail**

### 401 Unauthorized — 유효하지 않은 토큰

```json
{
  "detail": "Invalid or expired token"
}
```

### 403 Forbidden — 이미 로그아웃된 토큰(서버에서 블랙리스트 처리 시)

```json
{
  "detail": "Token already invalidated"
}
```