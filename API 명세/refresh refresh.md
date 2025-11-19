# /refresh/refresh

HTTP Method: POST
Service: 재발급 토큰 재발급

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {refresh_token} | 기존 refresh_token 필요 |

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
  "access_token": "string",
  "refresh_token": "string"
}
```

- access_token 새로 발급
- refresh_token도 새로 갱신

---

### ❌ **Fail**

### 401 Unauthorized — Refresh Token 만료 또는 위조

```json
{
  "detail": "Invalid or expired refresh token"
}
```

### 403 Forbidden — Refresh Token 아님

```json
{
  "detail": "Invalid token type"
}
```