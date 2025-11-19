# /refresh/access

HTTP Method: POST
Service: 접근 토근 재발급

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {refresh_token} | 유효한 refresh_token 필요 |

### **Body**

없음

```json
{}
```

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "access_token": "string"
}
```

---

### ❌ **Fail**

### 401 Unauthorized — Refresh Token 만료 또는 위조

```json
{
  "detail": "Invalid or expired refresh token"
}
```

### 403 Forbidden — 토큰 타입이 refresh가 아님

```json
{
  "detail": "Invalid token type"
}
```