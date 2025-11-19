# /change/energy2money

HTTP Method: POST
Service: 에너지를 돈으로 변환

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {access_token} | 사용자 인증용 토큰 |

### **Body**

```json
{
  "amount": 0
}
```

- `amount`: 감소시킬 에너지 양 (해당 양만큼 에너지가 줄어들고, 정해진 비율만큼 돈이 증가)

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "energy": 50,
  "money": 20
}
```

- 변환 후 갱신된 유저 상태 반환

---

### ❌ **Fail**

### 400 Bad Request — 에너지가 부족한 경우

```json
{
  "detail": "Not enough energy"
}
```

### 404 Not Found — 존재하지 않는 사용자

```json
{
  "detail": "User not found"
}
```

### 401 Unauthorized — 인증 실패

```json
{
  "detail": "Invalid or expired token"
}
```

### 422 Validation Error — 잘못된 데이터

```json
{
  "detail": "Invalid request data"
}
```