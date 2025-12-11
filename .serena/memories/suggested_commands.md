# 추천 명령어

## 프론트엔드 개발 명령어
작업 디렉토리: `frontend-react/`

### 개발
```bash
cd frontend-react
npm run dev          # Vite 개발 서버 실행 (기본 포트: 5173)
```

### 빌드
```bash
cd frontend-react
npm run build        # 프로덕션 빌드 (dist/ 디렉토리에 생성)
npm run preview      # 빌드된 프로덕션 버전 미리보기
```

### 린팅
```bash
cd frontend-react
npm run lint         # ESLint 실행
```

### 의존성 설치
```bash
cd frontend-react
npm install          # package.json의 의존성 설치
```

## 백엔드 개발 명령어
작업 디렉토리: `backend/`

### 개발
```bash
cd backend
uvicorn main:app --reload  # FastAPI 개발 서버 실행 (기본 포트: 8000)
```

### 의존성 설치
```bash
cd backend
pip install -r requirements.txt  # Python 의존성 설치
```

### 데이터베이스
```bash
cd backend
python init_db.py    # 데이터베이스 초기화
```

## Docker 명령어
루트 디렉토리에서 실행

### 전체 시스템 실행
```bash
docker-compose up              # 포그라운드에서 실행
docker-compose up -d           # 백그라운드에서 실행
docker-compose down            # 컨테이너 중지 및 제거
docker-compose logs -f         # 로그 확인
docker-compose restart         # 재시작
```

### 개별 서비스
```bash
docker-compose up backend      # 백엔드만 실행
docker-compose up frontend     # 프론트엔드만 실행
```

### 빌드
```bash
docker-compose build           # 이미지 재빌드
docker-compose build --no-cache  # 캐시 없이 재빌드
```

## Git 명령어

### 상태 확인
```bash
git status           # 현재 상태 확인
git log --oneline    # 커밋 히스토리 확인
git diff             # 변경 사항 확인
```

### 브랜치 관리
```bash
git branch           # 브랜치 목록 확인
git checkout -b <브랜치명>  # 새 브랜치 생성 및 체크아웃
git merge <브랜치명>        # 브랜치 병합
```

### 커밋
```bash
git add .            # 모든 변경 사항 스테이징
git commit -m "<커밋 메시지>"  # 커밋
git push             # 원격 저장소에 푸시
```

## macOS 유틸리티 명령어

### 파일 탐색
```bash
ls -la               # 파일 목록 (숨김 파일 포함)
find . -name "*.js"  # 특정 패턴의 파일 찾기
grep -r "pattern" .  # 텍스트 패턴 검색
```

### 프로세스 관리
```bash
lsof -i :8000        # 특정 포트를 사용하는 프로세스 확인
kill -9 <PID>        # 프로세스 강제 종료
ps aux | grep node   # Node 프로세스 확인
```

### 네트워크
```bash
curl http://localhost:8000/api/health  # API 헬스체크
netstat -an | grep 8000                 # 포트 상태 확인
```

## 테스트 명령어
현재 프로젝트에는 명시적인 테스트 스크립트가 없습니다.
테스트 프레임워크 추가 시 이 섹션을 업데이트하세요.

## 포매팅 명령어
현재 프로젝트에는 자동 포매팅 도구가 설정되어 있지 않습니다.
- 프론트엔드: ESLint만 사용 (자동 수정: `npm run lint -- --fix`)
- 백엔드: 포매팅 도구 미설정 (black, autopep8 등 추가 권장)
