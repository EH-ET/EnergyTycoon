# /upgrade/production

HTTP Method: POST
Service: 전체 생산량 증가

## Request

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

- `amount`: 올릴 생산량 증가 수치 (예: +1, +5)
- 비용이 존재한다면 서버 로직에서 money 차감 후 업그레이드 적용

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "production_bonus": 3,
  "money": 5
}
```

예시 의미:

- 기존 `production_bonus` 2 → 3
- 업그레이드 비용 차감 후 `money`: 10 → 5

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

### 401 Unauthorized — 토큰 만료/위조

```json
{
  "detail": "Invalid or expired token"
}
```

### 422 Validation Error — 잘못된 요청 데이터

```json
{
  "detail": "Invalid request data"
}
```