# /rank

HTTP Method: GET
Service: 랭크 단일 조회

## Request

### **Headers**

| Key | Value | Description |
| --- | --- | --- |
| Authorization | Bearer {access_token} | 사용자 인증용 액세스 토큰 |

---

## **Response**

### ✅ **Success (200 OK)**

```json
{
  "username": "string",
  "rank": 12,
  "score": 13450
}
```

- `rank`: 전체 유저 중 해당 유저의 순위
- `score`: 랭킹 기준 점수(예: 보유 자원, 생산량 등 서버 로직에 따라 결정)

---

### ❌ **Fail**

### 404 Not Found — 존재하지 않는 유저

```json
{
  "detail": "User not found"
}
```

### 401 Unauthorized — 토큰 없음/만료

```json
{
  "detail": "Invalid or expired token"
}
```