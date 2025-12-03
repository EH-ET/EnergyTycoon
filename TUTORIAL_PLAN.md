# Tutorial System Implementation Plan

## 목표
신규 사용자를 위한 11단계 인터랙티브 튜토리얼 시스템 구축

## 데이터베이스 변경사항

### Backend - User Model
**파일**: `backend/models.py`
- `tutorial` 컬럼 추가 (Integer, default=1)
- 0 = 튜토리얼 완료 또는 건너뛰기
- 1-11 = 현재 튜토리얼 단계

### Backend - Migration
**파일**: `backend/init_db.py`
- `ensure_tutorial_column()` 함수 추가
- PostgreSQL과 SQLite 모두 지원

### Backend - API
**파일**: `backend/routes/tutorial_routes.py` (새로 생성)
- `PUT /api/tutorial/progress` - 튜토리얼 진행도 업데이트
- `POST /api/tutorial/skip` - 튜토리얼 건너뛰기

## Frontend 구현

### 1. Tutorial Store
**파일**: `frontend-react/src/store/useTutorialStore.js` (새로 생성)
- 현재 튜토리얼 단계 관리
- 튜토리얼 진행/건너뛰기 함수
- 백엔드와 동기화

### 2. Tutorial Overlay Component
**파일**: `frontend-react/src/components/TutorialOverlay.jsx` (새로 생성)
- 반투명 오버레이로 특정 요소 하이라이트
- 설명 텍스트 표시
- "다음" 및 "건너뛰기" 버튼
- 각 단계별 위치 지정

### 3. Tutorial Steps Configuration
**파일**: `frontend-react/src/utils/tutorialSteps.js` (새로 생성)
- 각 단계의 내용, 위치, 조건 정의

### 4. 기존 컴포넌트 통합
각 컴포넌트에 tutorial step 체크 로직 추가:

#### Main.jsx
- Step 1: 스크롤 가능 영역 하이라이트

#### Footer.jsx & GeneratorTab.jsx  
- Step 2: 첫 번째 발전기 구매 유도

#### Header.jsx
- Step 3: Header 전체 소개
- Step 4: 생산량 hover 유도
- Step 5: 환율 hover 유도
- Step 6: 프로필 클릭 유도

#### TradeTab.jsx
- Step 7: 거래소 설명

#### UpgradeTab.jsx
- Step 8: 전역 업그레이드 구매 유도
- Step 10: 발전기 업그레이드 유도

#### GeneratorModal.jsx
- Step 9: 설치된 발전기 클릭 시 모달 설명

#### InfoTab.jsx
- Step 11: Info 탭 설명

## 튜토리얼 플로우

```
신규 가입 (tutorial=1)
  ↓
Step 1: Main 스크롤 설명
  ↓
Step 2: 발전기 구매
  ↓
Step 3: Header 소개
  ↓
Step 4: 생산량 확인
  ↓
Step 5: 환율 확인
  ↓
Step 6: 설정 메뉴
  ↓
Step 7: 거래소 사용
  ↓
Step 8: 전역 업그레이드
  ↓
Step 9: 발전기 모달
  ↓
Step 10: 발전기 업그레이드
  ↓
Step 11: Info 탭
  ↓
완료 (tutorial=0)
```

## UI/UX 고려사항

- 오버레이는 z-index 9999로 최상단 배치
- 하이라이트된 요소는 클릭 가능하게 (pointer-events)
- 나머지는 작동 못하게 반투명 요소로 막기
- 부드러운 페이드 인/아웃 애니메이션
- 모바일 반응형 지원
- 다크 테마와 조화로운 디자인 (파란색 계열)

## 보안 및 데이터 무결성

- 튜토리얼 진행도는 서버에 저장
- 클라이언트 요청은 백엔드에서 검증
- JWT 토큰으로 인증된 사용자만 업데이트 가능

## 배포 계획

1. Backend 변경사항 먼저 배포 (하위 호환성 유지)
2. Frontend 튜토리얼 컴포넌트 배포
3. 기존 사용자는 tutorial=0으로 설정 (마이그레이션)
4. 신규 사용자만 tutorial=1로 시작
