# 코드베이스 구조

## 루트 디렉토리 구조
```
/
├── backend/              # FastAPI 백엔드
├── frontend-react/       # React 프론트엔드
├── nginx/                # Nginx 웹 서버 설정
├── terraform/            # 인프라 코드 (IaC)
├── data/                 # 데이터 파일
├── .claude/              # Claude Code 설정
├── .serena/              # Serena 설정
├── .vscode/              # VS Code 설정
├── docker-compose.yml    # Docker Compose 설정
├── Dockerfile            # Docker 이미지 빌드
├── cloudbuild.yaml       # GCP Cloud Build 설정
├── README.md             # 프로젝트 문서
├── energytycoon.txt      # 게임 안내서
├── bigvalueRule.txt      # 큰 숫자 처리 규칙
└── AGENTS.md             # Agent 관련 문서
```

## 프론트엔드 구조 (frontend-react/)
```
frontend-react/
├── src/
│   ├── components/       # React 컴포넌트
│   ├── pages/            # 페이지 컴포넌트
│   ├── hooks/            # 커스텀 React 훅
│   ├── store/            # Zustand 상태 관리 스토어
│   ├── utils/            # 유틸리티 함수
│   ├── assets/           # 정적 자산 (이미지 등)
│   ├── main.jsx          # 엔트리 포인트
│   └── App.jsx           # 메인 앱 컴포넌트
├── public/               # 퍼블릭 정적 파일
│   └── generator/        # 발전기 이미지들
├── dist/                 # 빌드 출력
├── package.json          # 의존성 및 스크립트
├── vite.config.js        # Vite 설정
└── eslint.config.js      # ESLint 설정
```

## 백엔드 구조 (backend/)
```
backend/
├── routes/               # API 라우트
│   ├── auth_routes.py    # 인증 관련 라우트
│   ├── generator_routes.py  # 발전기 관련 라우트
│   ├── upgrade_routes.py    # 업그레이드 관련 라우트
│   ├── sync_routes.py       # 동기화 라우트
│   ├── rank_routes.py       # 랭킹 라우트
│   ├── rebirth_routes.py    # 환생 라우트
│   ├── progress_routes.py   # 진행 상황 라우트
│   ├── change_routes.py     # 변경 사항 라우트
│   ├── inquiry_routes.py    # 조회 라우트
│   ├── special_routes.py    # 특수 기능 라우트
│   └── tutorial_routes.py   # 튜토리얼 라우트
├── main.py               # FastAPI 애플리케이션 엔트리
├── models.py             # SQLAlchemy 모델
├── schemas.py            # Pydantic 스키마
├── database.py           # 데이터베이스 연결
├── auth_utils.py         # 인증 유틸리티
├── game_logic.py         # 게임 로직
├── sync_logic.py         # 동기화 로직
├── bigvalue.py           # 큰 숫자 처리
├── dependencies.py       # FastAPI 의존성
├── init_db.py            # 데이터베이스 초기화
└── requirements.txt      # Python 의존성
```

## 주요 진입점
- 프론트엔드: `frontend-react/src/main.jsx`
- 백엔드: `backend/main.py`
