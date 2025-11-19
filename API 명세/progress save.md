# /progress

HTTP Method: POST
Service: 저장하기

## Request

### **Headers**

| Key | Value |
| --- | --- |
| Authorization | Bearer {{access_token}} |

### **Body**

```json
{
  "generator_type_id": "string",
  "x_position": 0,
  "world_position": 0
}
```

※ `generator_type_id`에 해당하는 Generator 생성 후 MapProgress에 기록

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "generator_id": "string",
  "generator_type_id": "string",
  "level": 1,
  "x_position": 0,
  "world_position": 0,
  "isdeveloping": false,
  "heat": 0
}
```

- 생성된 Generator 정보 반환
- MapProgress도 내부적으로 자동 저장됨

---

### ❌ **Fail**

### 400 Bad Request — 동일 위치에 이미 Generator 존재

```json
{
  "detail": "Generator already exists in this position"
}
```

### 404 Not Found — generator_type_id 없음

```json
{
  "detail": "Generator type not found"
}
```

### 401 Unauthorized — 토큰 문제

```json
{
  "detail": "Invalid or expired token"
}
```

### 422 Validation Error — 잘못된 body

```json
{
  "detail": "Invalid request data"
}
```