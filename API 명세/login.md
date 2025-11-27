# /login

HTTP Method: POST
Service: 로그인

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Content-Type | application/json | 요청 바디 JSON 형식 |

### **Body**

```json
{
  "username": "string",
  "password": "string"
}
```

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "user": {
    "username": "string",
    "energy": 0,
    "money": 10,
    "production_bonus": 0,
    "heat_reduction": 0,
    "tolerance_bonus": 0,
    "max_generators_bonus": 0,
    "demand_bonus": 0
  },
  "access_token": "string",
  "refresh_token": "string"
}
```

---

### ❌ **Fail**

### 400 Bad Request — 비밀번호 불일치

```json
{
  "detail": "Invalid password"
}
```

### 404 Not Found — username 없음

```json
{
  "detail": "User not found"
}
```

### 422 Validation Error — 잘못된 입력

```json
{
  "detail": "Invalid request data"
}
```
