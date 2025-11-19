# Energy Tycoon 코드 빠른 이해 가이드

## 1) 전체 구조와 핵심 로직
- **프론트엔드(`frontend/main.js`)**: 단일 JS가 UI 탭(발전기/거래/업그레이드/정보)을 렌더링하고, 드래그-드롭으로 발전기를 설치하며, 로컬스토리지에 유저/토큰/진행도를 동기화합니다. 서버와 REST로 통신해 발전기 타입, 업그레이드, 시장 가격, 진행도를 처리합니다.
- **백엔드(`backend/main.py`)**: FastAPI로 회원/로그인, 발전기 타입, 업그레이드, 시장 교환, 진행도 저장/조회 API를 제공합니다. sqlite를 기본 저장소로 사용하고, 메모리 토큰 스토어로 인증을 처리합니다.

## 2) 파일/모듈 역할
- `frontend/main.js`: UI 이벤트 연결, 상태 관리(유저·토큰·배치), 탭별 렌더링, 서버 통신(발전기 설치/불러오기, 거래, 업그레이드).
- `backend/main.py`: 데이터 모델 정의, DB 초기화/시드, 인증 토큰 처리, 업그레이드/시장/진행도 엔드포인트 제공.
- 정적 자원: `frontend/` 내 HTML/CSS/이미지, `data/` 및 `energy_tycoon.db`는 sqlite 파일, `nginx/`는 프록시 설정.

## 3) ADT 관점 주요 개체
- **User (백엔드 모델, 프론트 상태)**  
  - 데이터: `user_id`, `username`, `password(해시)`, `energy`, `money`, `production_bonus`, `heat_reduction`, `tolerance_bonus`, `max_generators_bonus`, `supply_bonus`.  
  - 연산: 로그인/로그아웃, 에너지↔돈 교환, 업그레이드 레벨 증가, 진행도 저장 시 비용 차감.
- **GeneratorType (백엔드 모델 + 프론트 메타)**  
  - 데이터: `generator_type_id`, `name`, `description`, `cost`. 프론트의 `generatorTypeMap`/`generatorTypeInfoMap`/`generatorTypeIdToName`로 캐시.  
  - 연산: 초기 시드, 설치 시 비용/ID 조회.
- **Generator (백엔드 모델) & placedGenerators (프론트 배열)**  
  - 데이터: 위치(`x_position`, `world_position`), 종류(`generator_type_id`/`name`), `level`, `heat`, 개발여부. 프론트는 `{ x, name, genIndex }`로 최소 정보만 화면용 보관.  
  - 연산: `/progress` 저장/조회, 프론트에서 시각적 배치/에너지 계산.
- **Upgrade Config (프론트/백엔드 공통 개념)**  
  - 데이터: 필드명, 기본 비용, 성장률.  
  - 연산: 비용 계산(`getUpgradeCost`, `calculate_upgrade_cost`), 업그레이드 적용(`apply_upgrade`).
- **Token Store (백엔드 메모리) & AuthContext (프론트)**  
  - 데이터: `{user_id, expiry}` vs `{token, user}`.  
  - 연산: 발급/갱신/폐기, 요청 시 검증, 프론트에서 요청 헤더 세팅.

## 4) 각 ADT 데이터와 연산 요약
- User:  
  - 데이터: 통화/에너지/보너스 스탯.  
  - 연산: `energy2money`, `money2energy`, 업그레이드 POST들, 진행도 저장 시 비용 차감.
- GeneratorType:  
  - 데이터: 이름·설명·비용·ID.  
  - 연산: 초기 생성, 설치 시 비용 검증, 타입 조회 API.
- Generator/placedGenerators:  
  - 데이터: 위치, 타입, 레벨.  
  - 연산: 저장/조회 API, 프론트 `computeEnergyPerSecond`, `placeGeneratorVisual`.
- Upgrade Config:  
  - 데이터: `field`, `base_cost`, `price_growth`.  
  - 연산: 비용 계산, 필드 값 +1 업데이트.
- Token/AuthContext:  
  - 데이터: 토큰 문자열 + 만료/유저 ID.  
  - 연산: 발급(`login`), 갱신(`refresh`), 검증(`require_user`), 해제(`logout`); 프론트 `getAuthContext`로 요청 준비.

## 5) 실행 흐름 (요약 플로우)
1. 페이지 로드 → `DOMContentLoaded`  
   - 발전기 타입 로드(`loadGeneratorTypes`)  
   - 저장된 유저 로드(`loadUserData`)  
   - 기본 탭 렌더(`renderContent`)  
   - 드롭 핸들러 등록(`initDropHandlers`)  
   - 진행도 불러오기(`hydrateProgress`)
2. 유저 액션  
   - 탭 버튼 클릭 → `contentMode` 변경 → 해당 모드 렌더  
   - 발전기 드래그→드롭: 인증 확인 → 비용 확인 → `/progress` 저장 → 화면에 배치 → 로컬 에너지 타이머 가동  
   - 거래: `/market` 조회 → `/change/energy2money` POST → 상태 저장  
   - 업그레이드: 비용 확인 → `/upgrade/<type>` POST → 상태 저장  
   - 정보: 플레이타임/스탯 표시
3. 백엔드  
   - 토큰 검증 → 요청 유저와 payload 유저 일치 확인 → DB 변경 후 JSON 반환  
   - 업그레이드/교환 시 비용/재화 검증, 시장 상태(`MARKET_STATE`) 갱신

## 6) 주의할 부분
- 토큰 스토어가 메모리 기반이라 서버 재시작 시 로그인 상태가 초기화됩니다.
- sqlite 파일(`data/`, `energy_tycoon.db`)은 버전 관리 대상이 아니므로 덮어쓰지 않도록 주의하세요.
- 프론트 에너지 증가 로직은 클라이언트측 타이머 기반이므로 싱크 맞출 때 서버 값과 차이가 생길 수 있습니다.
- 드롭 설치 시 발전기 타입 메타가 로드되지 않았다면 비용/ID 확인이 실패할 수 있습니다(초기 로드 순서 유지 필요).

## 7) 개선 아이디어
- 토큰을 DB나 Redis로 관리해 서버 재시작에 안전하게 만들기.
- 클라이언트 에너지 계산을 서버 소스오브트루스로 바꾸거나, 주기적 동기화 엔드포인트 추가.
- 진행도/업그레이드에 대한 간단한 통합 테스트(pytest + FastAPI client) 도입.
- 프론트 모듈화: 탭별 파일 분리와 상태 관리(예: 작은 store)로 가독성 향상.
- 업그레이드/발전기 타입 정보를 공통 스키마(JSON)로 유지해 프론트/백엔드 중복 제거.
