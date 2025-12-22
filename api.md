# EnergyTycoon API 명세서

이 문서는 EnergyTycoon 게임의 백엔드 API를 설명합니다.

## 공통 사항

-   **Base URL**: 서버의 주소에 따라 달라집니다.
-   **인증**: 대부분의 엔드포인트는 인증이 필요하며, 브라우저의 Cookie 저장소를 사용하여 자동으로 처리됩니다. (HTTPOnly JWT 방식)
-   **CSRF 보호**: `POST`, `PUT`, `DELETE` 등 상태를 변경하는 요청에는 `X-CSRF-Token` 헤더가 필요합니다. 이 토큰은 `/csrf-token` 엔드포인트를 통해 얻을 수 있습니다.
-   **BigValue**: 게임 내의 큰 숫자(돈, 에너지 등)는 `data` (BigInt)와 `high` (Int) 두 부분으로 나뉘어 처리됩니다. 실제 값은 `data * (10 ** high)` 입니다.

---

## 1. 인증 (Auth)

사용자 계정 생성, 로그인, 로그아웃, 토큰 관리 등 인증 관련 API입니다.

### **POST `/signup`**

-   **설명**: 새로운 사용자 계정을 생성합니다.
-   **Request Body**:
    ```json
    {
      "username": "new_user",
      "password": "Password123"
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
      "user": {
        "user_id": "a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6",
        "username": "new_user",
        "energy_data": 0,
        "energy_high": 0,
        "money_data": 10000,
        "money_high": 0,
        "production_bonus": 0,
        "heat_reduction": 0,
        "tolerance_bonus": 0,
        "max_generators_bonus": 0,
        "demand_bonus": 0,
        "play_time_ms": 0,
        "rebirth_count": 0,
        "rebirth_chain_upgrade": 0,
        "upgrade_batch_upgrade": 0,
        "rebirth_start_money_upgrade": 0,
        "tutorial": 1,
        "supercoin": 0,
        "build_speed_reduction": 0,
        "energy_multiplier": 0,
        "exchange_rate_multiplier": 0,
        "sold_energy_data": 0,
        "sold_energy_high": 0
      }
    }
    ```

### **POST `/login`**

-   **설명**: 사용자 로그인을 처리하고 세션을 시작합니다.
-   **Request Body**:
    ```json
    {
      "username": "existing_user",
      "password": "Password123"
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
      "user": {
        "user_id": "k1l2m3n4-o5p6-q7r8-s9t0-u1v2w3x4y5z6",
        "username": "existing_user",
        "energy_data": 12345,
        "energy_high": 3,
        "money_data": 54321,
        "money_high": 6,
        // ... other user fields
      }
    }
    ```

### **GET `/csrf-token`**

-   **설명**: 상태 변경 요청에 필요한 CSRF 토큰을 발급받습니다.
-   **Request Headers**:
    - 인증 쿠키가 필요합니다.
-   **Response (200 OK)**:
    ```json
    {
      "csrf_token": "Unique-CSRF-Token-Value",
      "detail": "CSRF token issued"
    }
    ```

### **POST `/logout`**

-   **설명**: 사용자를 로그아웃시키고 관련 토큰을 무효화합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Response (200 OK)**:
    ```json
    {
      "detail": "Logout successful"
    }
    ```

### **POST `/refresh/access`**

-   **설명**: Refresh Token을 사용하여 만료된 Access Token을 갱신합니다. `refresh_token` 쿠키를 통해 자동으로 인증됩니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Response (200 OK)**:
    - 새로운 `access_token`과 `refresh_token`이 쿠키에 설정됩니다.
    ```json
    {
      "detail": "access token refreshed"
    }
    ```

### **POST `/refresh/refresh`**

-   **설명**: Refresh Token을 사용하여 Access Token과 Refresh Token을 모두 갱신합니다. 보안 강화를 위해 사용될 수 있습니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Response (200 OK)**:
    - 새로운 `access_token`과 `refresh_token`이 쿠키에 설정됩니다.
    ```json
    {
      "detail": "token pair refreshed"
    }
    ```

### **POST `/delete_account`**

-   **설명**: 현재 로그인된 사용자의 계정을 영구적으로 삭제합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "password": "YourCurrentPassword"
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
      "detail": "Account deleted"
    }
    ```

---

## 2. 재화 교환 (Change)

### **POST `/change/energy2money`**

-   **설명**: 에너지를 돈으로 환전합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "amount_data": 1000,
      "amount_high": 3
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
        "energy_data": 2345,
        "energy_high": 3,
        "money_data": 64321,
        "money_high": 6,
        "rate": 0.045,
        "rate_data": 45,
        "rate_high": 0,
        "gained_data": 10000,
        "gained_high": 6,
        "user": { /* ...updated user object... */ }
    }
    ```

### **GET `/change/rate`**

-   **설명**: 현재 시장 환율(에너지 1개당 돈)을 조회합니다.
-   **Response (200 OK)**:
    ```json
    {
      "rate": 0.05,
      "rate_data": 50,
      "rate_high": 0
    }
    ```

---

## 3. 발전기 정보 (Generator)

### **GET `/generator_types`**

-   **설명**: 게임에 존재하는 모든 발전기의 종류와 기본 정보를 조회합니다.
-   **Response (200 OK)**:
    ```json
    {
      "types": [
        {
          "id": "gen_type_id_1",
          "name": "풍력 발전기",
          "cost_data": 100,
          "cost_high": 0,
          "description": "바람의 힘으로 에너지를 생산합니다.",
          "index": 0,
          "energy_data": 10,
          "energy_high": 0,
          "install_seconds": 2
        }
        // ... other generator types
      ],
      "generator_types": [ /* ... 동일한 내용, 호환성을 위해 중복 제공 ... */ ]
    }
    ```
---

## 4. 게임 진행 (Progress)

### **GET `/progress`**

-   **설명**: 현재 로그인된 사용자의 모든 게임 진행 상황을 불러옵니다.
-   **Response (200 OK)**:
    ```json
    {
      "user_id": "your-user-id",
      "generators": [
        {
          "generator_id": "gen-instance-id-1",
          "generator_type_id": "gen_type_id_1",
          "type": "풍력 발전기",
          "cost_data": 100,
          "cost_high": 0,
          "x_position": 1,
          "world_position": 0,
          "level": 5,
          "isdeveloping": false,
          "build_complete_ts": null,
          "heat": 25,
          "running": true,
          "upgrades": {
            "production": 3,
            "heat_reduction": 1,
            "tolerance": 2
          }
        }
      ],
      "user": { /* ...current user object... */ }
    }
    ```

### **POST `/progress`**

-   **설명**: 새로운 발전기를 구매하고 건설을 시작합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "user_id": "your-user-id",
      "generator_type_id": "gen_type_id_1",
      "x_position": 2,
      "world_position": 0
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
      "ok": true,
      "generator": { /* ...new generator object... */ },
      "user": { /* ...updated user object... */ }
    }
    ```

### **DELETE `/progress/{generator_id}`**

-   **설명**: 특정 발전기를 철거합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Response (200 OK)**:
    ```json
    {
        "user": { /* ...updated user object... */ },
        "demolished": {
            "generator_id": "gen-instance-id-to-delete",
            "cost_data": 50,
            "cost_high": 0
        }
    }
    ```

### **POST `/progress/{generator_id}/upgrade`**

-   **설명**: 특정 발전기의 개별 성능을 업그레이드합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "upgrade": "production",
      "amount": 10
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
        "user": { /* ...updated user object... */ },
        "generator": { /* ...updated generator object... */ },
        "cost_data": 1234,
        "cost_high": 2
    }
    ```
---

## 5. 글로벌 업그레이드 (Upgrade)

### **POST `/upgrade/production`**

-   **설명**: '전체 생산량 보너스' 글로벌 업그레이드를 수행합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "amount": 5
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
        "user_id": "your-user-id",
        "username": "your-username",
        "production_bonus": 15, /* 10 -> 15 */
        /* ...other user fields... */
    }
    ```

### **POST `/upgrade/bulk`**

-   **설명**: 여러 글로벌 업그레이드를 한 번의 요청으로 일괄 적용합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "upgrades": [
        { "endpoint": "production", "amount": 10 },
        { "endpoint": "heat_reduction", "amount": 5 }
      ]
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
        "user": { /* ...updated user object... */ },
        "results": [
            { "index": 0, "endpoint": "production", "amount": 10, "status": "applied" },
            { "index": 1, "endpoint": "heat_reduction", "amount": 5, "status": "applied" }
        ],
        "partial_failure": false
    }
    ```

---

## 6. 환생 (Rebirth)

### **GET `/rebirth/info`**

-   **설명**: 현재 환생 상태와 다음 환생에 필요한 비용, 예상 보상 등의 정보를 조회합니다.
-   **Response (200 OK)**:
    ```json
    {
        "user": { /* ...user object... */ },
        "rebirth_count": 2,
        "next_cost_data": 960000000,
        "next_cost_high": 0,
        "current_multiplier": 4,
        "next_multiplier": 8,
        "max_chain": 1,
        "chain_cost_data": 960000000,
        "chain_cost_high": 0,
        "start_money_data": 10,
        "start_money_high": 0,
        "upgrade_batch_limit": 1
    }
    ```

### **POST `/rebirth`**

-   **설명**: 환생을 실행합니다. 모든 발전기와 업그레이드가 초기화되며, 영구적인 생산량 배율을 얻습니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "count": 1
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
        "user": { /* ...updated user object after rebirth... */ },
        "message": "Rebirth successful! New multiplier: 8x (x1)"
    }
    ```

---

## 7. 랭킹 (Rank)

### **GET `/rank?criteria=money`**

-   **설명**: 특정 기준에 따른 현재 사용자의 순위를 조회합니다.
-   **Response (200 OK)**:
    ```json
    {
      "username": "your-username",
      "rank": 42,
      "score": {
          "data": 54321,
          "high": 6,
          "displayValue": "54321e6"
      },
      "criteria": "money"
    }
    ```

### **GET `/ranks?limit=5&criteria=rebirth`**

-   **설명**: 특정 기준에 따른 전체 순위 목록(리더보드)을 조회합니다.
-   **Response (200 OK)**:
    ```json
    {
        "total": 1234,
        "limit": 5,
        "offset": 0,
        "criteria": "rebirth",
        "ranks": [
            { "username": "Player1", "rank": 1, "score": 15 },
            { "username": "Player2", "rank": 2, "score": 12 },
            { "username": "Player3", "rank": 3, "score": 12 },
            { "username": "Player4", "rank": 4, "score": 10 },
            { "username": "Player5", "rank": 5, "score": 9 }
        ]
    }
    ```

---

## 8. 특별 업그레이드 (Special)

### **POST `/special/build_speed`**

-   **설명**: 슈퍼코인을 사용하여 '건설 속도 감소' 특별 업그레이드를 수행합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Response (200 OK)**:
    ```json
    {
        "user_id": "your-user-id",
        "username": "your-username",
        "supercoin": 4, /* 5 -> 4 */
        "build_speed_reduction": 1, /* 0 -> 1 */
        /* ...other user fields... */
    }
    ```
---

## 9. 동기화 (Sync)

### **POST `/sync`**

-   **설명**: 클라이언트에서 발생한 액션을 서버에 전송하여 상태를 동기화합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
        "actions": [
            { "type": "upgrade", "payload": { "key": "production" }, "ts": 1678886400000 }
        ],
        "clientState": {
            "energy": { "data": 100, "high": 3 },
            "money": { "data": 5000, "high": 2 },
            "production_bonus": 11,
            "timestamp": 1678886401000
        }
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
        "user_id": "your-user-id",
        "username": "your-username",
        "production_bonus": 11,
        /* ...other updated fields... */
    }
    ```

---
## 10. 문의 및 제보 (Inquiry)

### **POST `/inquiries`**

-   **설명**: 버그, 제안 등 문의사항을 서버에 제출합니다.
-   **Request Headers**:
    - `X-CSRF-Token: <Your-CSRF-Token>`
-   **Request Body**:
    ```json
    {
      "type": "bug",
      "content": "발전기를 철거해도 돈이 줄어들지 않는 버그가 있습니다."
    }
    ```
-   **Response (200 OK)**:
    ```json
    {
        "inquiry_id": "inquiry-id-123",
        "user_id": "your-user-id",
        "username": "your-username",
        "type": "bug",
        "content": "발전기를 철거해도 돈이 줄어들지 않는 버그가 있습니다.",
        "created_at": 1678886400000
    }
    ```