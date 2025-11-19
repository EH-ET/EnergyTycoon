# /generator_types

HTTP Method: GET
Service: 발전기 종류

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {access_token} | 인증용 토큰 |

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
  "generator_types": [
    {
      "generator_type_id": "string",
      "name": "string",
      "description": "string",
      "cost": 100
    }
  ]
}
```

- DB에 등록된 모든 발전기 타입 리스트 반환

---

### ❌ **Fail**

### 401 Unauthorized — 액세스 토큰 문제

```json
{
  "detail": "Invalid or expired token"
}
```