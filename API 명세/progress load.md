# /progress

HTTP Method: GET
Service: 불러오기

### **Headers**

| Key | Value |
| --- | --- |
| Authorization | Bearer {{access_token}} |

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "user_id": "string",
  "generators": [
    {
      "generator_id": "string",
      "generator_type_id": "string",
      "level": 1,
      "x_position": 0,
      "world_position": 0,
      "isdeveloping": false,
      "heat": 0
    }
  ]
}
```

- 해당 유저가 **MapProgress + Generator** 조인으로 보유 중인 발전기 목록을 반환
- 필요한 정보만 보내는 형태로 작성

---

### ❌ **Fail**

### 404 Not Found — 유저 없음

```json
{
  "detail": "User not found"
}
```

### 401 Unauthorized — 토큰 만료/불일치

```json
{
  "detail": "Invalid or expired token"
}
```

### 422 Validation Error — user_id 누락 등

```json
{
  "detail": "Invalid request data"
}
```