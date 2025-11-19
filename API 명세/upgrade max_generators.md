# /upgrade/max_generators

HTTP Method: POST
Service: 최대 발전기 수 증가

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

- `amount`: 증가시키려는 최대 발전기 수 보너스 값
- 증가에 필요한 비용은 서버에서 money 차감 후 처리

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "user_id": "string",
  "max_generators_bonus": 6,
  "money": 2
}
```

예시 설명:

- 기존 max_generators_bonus: 5 → 6
- 업그레이드 비용 차감 후 money: 10 → 2

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

### 401 Unauthorized — 토큰 문제

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