# Energy Tycoon 사양서

백엔드 API, 데이터 모델(ERD), 프런트/게임 기능 동작을 코드 기준으로 정리했습니다.

## 인증/세션
- 로그인 성공 시 `access_token`(UUID)을 발급해 메모리 `_token_store`에 `{user_id, expiry(+24h)}`로 저장하며, Authorization 헤더(`Bearer <token>`)로 전달해야 합니다.
- `/refresh`로 만료 시간을 연장할 수 있습니다. 서버 재시작 시 토큰과 시장 상태, sold_energy가 초기화됩니다.

## API 명세 (FastAPI `backend/main.py`)
- Base URL: 백엔드 루트(기본 `http://localhost:8000`). CORS는 환경변수 `FRONTEND_ORIGINS`가 `*`가 아니면 화이트리스트로 제한.
- 공통 모델
  - User: `user_id`, `username`, `energy`, `money`, `production_bonus`, `heat_reduction`, `tolerance_bonus`, `max_generators_bonus`, `demand_bonus`.
  - GeneratorType: `generator_type_id`, `name`, `description`, `cost`. 서버 기동 시 기본값(광합성, 풍력, 지열) 자동 시드.
  - Generator: `generator_id`, `generator_type_id`, `owner_id`, `level`, `x_position`, `world_position`, `isdeveloping`, `heat`.
  - MapProgress: `map_progress_id`, `user_id`, `generator_id` (유저-발전기 유니크).

### 인증/계정
| Method | Path | Auth | Request | Response/로직 |
| --- | --- | --- | --- | --- |
| POST | `/signup` | - | `{"username","password"}` | 중복 username 400, 신규 User 반환. |
| POST | `/login` | - | `{"username","password"}` | 실패 시 401. 성공 시 `{access_token, user}` |
| POST | `/logout` | Token | - | 토큰 스토어에서 제거 후 `{ok: true}` |
| POST | `/refresh` | Token | - | 토큰 만료 +24h, `{access_token}` |

### 자원/시장
| Method | Path | Auth | Request | Response/로직 |
| --- | --- | --- | --- | --- |
| GET | `/generator_types` | - | - | `{types:[{id,name,cost,description}]}` |
| GET | `/market` | Token | - | `{rate, sold_energy}`. `rate = base_rate(1) * (1 - min(0.7, sold_energy/500)) * (1 + demand_bonus*0.05)`, 최소 0.1. |

### 거래
| Method | Path | Auth | Request | Response/로직 |
| --- | --- | --- | --- | --- |
| POST | `/change/energy2money` | Token | `{"user_id","amount"}` | amount>0, 본인 검증. 보유 energy 부족 400. `gained=int(amount*rate)`로 energy 감소, money 증가, MARKET_STATE.sold_energy 누적. `{energy, money, rate, sold_energy}` |
| POST | `/change/money2energy` | Token | `{"user_id","amount"}` | amount>0, 본인 검증. 보유 money 부족 400. money 감소, energy 증가. `{energy, money}` |

### 진행도/발전기
| Method | Path | Auth | Request | Response/로직 |
| --- | --- | --- | --- | --- |
| GET | `/progress` | Token | `?user_id=` | 본인 검증. 보유 Generator 조회. `{generators:[{generator_id,type,generator_type_id,x_position,world_position,level}]}` |
| POST | `/progress` | Token | `{"user_id","generator_type_id","x_position","world_position"}` | 본인 검증. 발전기 타입 없을 시 404, money 부족 400. 금액 차감 후 Generator 저장, MapProgress upsert. `{ok:true, generator:{...}, user:<UserOut>}` |

### 업그레이드
| Method | Path | Auth | Request | Response/로직 |
| --- | --- | --- | --- | --- |
| POST | `/upgrade/production` | Token | - | `cost = base_cost * price_growth^(current_level+1)` (필드별 상수). money 부족 400. 성공 시 해당 보너스 +1, money 차감, User 반환. |
| POST | `/upgrade/heat_reduction` | Token | - | 위와 동일. |
| POST | `/upgrade/tolerance` | Token | - | 위와 동일. |
| POST | `/upgrade/max_generators` | Token | - | 위와 동일. |
| POST | `/upgrade/demand` | Token | - | 위와 동일. 시장 교환비 계산 시 `demand_bonus` 반영. |

### 랭킹
| Method | Path | Auth | Request | Response/로직 |
| --- | --- | --- | --- | --- |
| GET | `/rank` | - | - | money 내림차순 1위 `{user}` 또는 `{"user": null}` |
| GET | `/ranks` | - | `?limit=10` | 상위 N명 `{list:[UserOut...]}` |

## ERD (개념)
```
User (user_id PK)
 ├─< Generator (generator_id PK, owner_id FK -> User.user_id)
 │    └─< MapProgress (map_progress_id PK, generator_id FK)
 └─< MapProgress (user_id FK -> User.user_id, unique(user_id, generator_id))

GeneratorType (generator_type_id PK)
 └─< Generator (generator_type_id FK -> GeneratorType.generator_type_id)
```
- User와 Generator는 1:N, GeneratorType과 Generator는 1:N, MapProgress는 User-Generator 매핑(중복 방지 유니크 제약).
- `MARKET_STATE`(sold_energy, base_rate)와 토큰 저장소는 인메모리 전역 값으로 DB에 영속되지 않습니다.

## 프런트/게임 기능 흐름 (`frontend/`)
- 로그인 페이지(`login.js`): `/login`·`/signup` 호출 후 로컬스토리지에 `access_token`, `user`, `session_start_ts` 저장, `main.html`로 이동.
- 메인 탭 구조(`main.js`): Generator / Trade / Upgrade / Info. DOM 업데이트는 `state.currentUser`를 기준으로 동기화.
- 발전기 배치
  - 탭에서 발전기 카드 드래그 → 메인 영역 드롭(`dropHandlers.js`). 위치 X 좌표와 발전기 타입 ID로 `/progress` 호출해 구매·저장.
  - 성공 시 `state.placedGenerators`에 추가하고 `placeGeneratorVisual`로 화면에 렌더. 비용은 서버 `generator_types`에서 가져온 `cost`를 사용.
  - 에너지 생산량: 매 1초 `computeEnergyPerSecond`로 합산(`generators` 기본 생산량 × (1 + production_bonus·0.1)) 후 `state.currentUser.energy` 증가.
- 거래(`tradeTab.js`): `/market`으로 교환비 조회, 입력 에너지량을 `/change/energy2money`로 판매. 수요 업그레이드 버튼은 `/upgrade/demand` 호출.
- 업그레이드 탭(`upgradeTab.js`): `data.js`의 업그레이드 메타를 사용해 비용/레벨 계산, `/upgrade/{endpoint}` 호출로 서버 반영.
- 정보 탭(`infoTab.js`): 세션 시작 시각(`session_start_ts`) 기준 플레이 타임, 현재 에너지/돈, 임시 등수 표시.
- 기타 UI: 상단 상태바에 에너지/돈/발전기 수 표기(최대 발전기 = `10 + max_generators_bonus*1`). 배치/진행도, 사용자 정보는 로컬스토리지와 백엔드 동기화를 병행합니다.

## 동작/제약 메모
- sqlite 경로는 `DATABASE_URL`로 변경 가능하며, 경로 부모 디렉터리가 없으면 자동 생성(`_ensure_sqlite_dir`).
- 레거시 DB 호환을 위해 서버 실행 시 `users` 테이블에 업그레이드 컬럼이 없으면 `ALTER TABLE`로 추가합니다.
- 시장 가격(`sold_energy`)과 토큰 스토어는 서버 프로세스 메모리 의존 → 재시작 시 리셋됨을 클라이언트 UX에서 고려해야 합니다.
