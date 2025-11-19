# /upgrade/heat_reduction

HTTP Method: POST
Service: 발열 감소

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {access_token} | 토큰 내부 user_id 사용 |

### **Body**

```json
{
  "amount": 1
}
```

- `amount`: 감소량 업그레이드 수치 (예: +1, +3)
- 서버 로직에서 필요한 비용만큼 money 차감 후 적용

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "heat_reduction": 2,
  "money": 7
}
```

예시 의미:

- 기존 `heat_reduction` 1 → 2
- 업그레이드 비용 차감 후 `money`: 10 → 7

---

### ❌ **Fail**

### 400 Bad Request — 돈 부족

```json
{
  "detail": "Not enough money"
}
```

### 404 Not Found — 유저 없음

```json
{
  "detail": "User not found"
}
```

### 401 Unauthorized — 토큰 만료 또는 잘못된 토큰

```json
{
  "detail": "Invalid or expired token"
}
```

### 422 Validation Error — 잘못된 요청 형식

```json
{
  "detail": "Invalid request data"
}
```