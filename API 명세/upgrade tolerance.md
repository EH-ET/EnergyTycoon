# /upgrade/tolerance

HTTP Method: POST
Service: 내열한계 증가

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

- `amount`: 증가시키고 싶은 내열 한계(= tolerance_bonus) 상승 수치
- 비용은 서버 로직에서 차감

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "user_id": "string",
  "tolerance_bonus": 4,
  "money": 3
}
```

예시 의미:

- 기존 tolerance_bonus: 3 → 4
- 비용 차감 후 money: 10 → 3

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

### 401 Unauthorized

```json
{
  "detail": "Invalid or expired token"
}
```

### 422 Validation Error

```json
{
  "detail": "Invalid request data"
}
```