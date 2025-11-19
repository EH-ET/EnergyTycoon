# /ranks

HTTP Method: GET
Service: 랭크목록 조회

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {access_token} | 인증용 토큰 |

### **Query Params**

| Key | Type | Description |
| --- | --- | --- |
| limit | int | 가져올 랭킹 수 (기본값 예: 100) |
| offset | int | 페이지네이션 시작 위치 (기본값 예: 0) |

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "total": 1000,
  "limit": 50,
  "offset": 0,
  "ranks": [
    {
      "username": "string",
      "rank": 1,
      "score": 20000
    },
    {
      "username": "string",
      "rank": 2,
      "score": 19950
    }
  ]
}
```

- `total`: 전체 랭킹 가능한 유저 수
- `limit`: 요청된 개수
- `offset`: 페이지 시작
- `ranks`: 유저 별 랭킹 정보 리스트

---

### ❌ **Fail**

### 401 Unauthorized — 토큰 없음/만료

```json
{
  "detail": "Invalid or expired token"
}
```

### 422 Validation Error — limit/offset 값 이상

```json
{
  "detail": "Invalid query parameters"
}
```