# 작업 완료 시 체크리스트

## 코드 작성 후 필수 확인 사항

### 1. 코드 품질 확인

#### 프론트엔드
```bash
cd frontend-react
npm run lint              # ESLint 검사
npm run build             # 빌드 에러 확인
```

- ESLint 에러/경고가 없는지 확인
- 빌드가 성공적으로 완료되는지 확인
- 사용하지 않는 import/변수 제거

#### 백엔드
```bash
cd backend
# 현재 명시적인 린팅 도구가 없으므로 수동 확인 권장
python -m py_compile main.py  # 구문 에러 확인
```

- Python 구문 에러가 없는지 확인
- import 에러가 없는지 확인
- 타입 힌트가 올바른지 확인

### 2. 로컬 테스트

#### 개발 서버 실행 확인
```bash
# 백엔드 실행
cd backend
uvicorn main:app --reload

# 프론트엔드 실행 (새 터미널)
cd frontend-react
npm run dev
```

- 백엔드가 정상적으로 시작되는지 확인 (포트: 8000)
- 프론트엔드가 정상적으로 시작되는지 확인 (포트: 5173)
- API 연결이 정상적으로 작동하는지 확인

#### Docker 환경 테스트 (선택사항)
```bash
docker-compose up --build
```

- 컨테이너가 정상적으로 빌드되는지 확인
- 서비스 간 통신이 정상적으로 작동하는지 확인

### 3. 기능 테스트

#### 브라우저 확인
- 변경한 기능이 예상대로 작동하는지 확인
- 콘솔 에러가 없는지 확인 (F12 개발자 도구)
- 네트워크 요청이 성공하는지 확인 (Network 탭)

#### API 테스트 (백엔드 변경 시)
```bash
# FastAPI 자동 문서 확인
# http://localhost:8000/docs

# curl로 엔드포인트 테스트
curl http://localhost:8000/api/<endpoint>
```

### 4. Git 커밋 전 확인

#### 변경 사항 검토
```bash
git status                # 변경된 파일 확인
git diff                  # 변경 내용 확인
git diff --staged         # 스테이징된 변경 내용 확인
```

#### 불필요한 파일 제외
- `node_modules/` (이미 .gitignore에 포함)
- `dist/` (빌드 결과물)
- `__pycache__/` (Python 캐시)
- `.env` (환경 변수)
- `.DS_Store` (macOS 메타데이터)
- 개발 중 생성된 임시 파일

#### 커밋 메시지 작성
```bash
git add .
git commit -m "feat: 새로운 기능 설명"
```

- [커밋 컨벤션](code_style_and_conventions.md#git-커밋-컨벤션) 준수
- 명확하고 간결한 메시지 작성
- 한글 또는 영어 사용 (프로젝트 일관성 유지)

### 5. 코드 리뷰 준비 (선택사항)

- 변경 사항을 명확히 설명할 수 있어야 함
- 왜 이런 방식으로 구현했는지 근거를 가지고 있어야 함
- 대안을 고려했는지 생각해보기

### 6. 문서 업데이트 (필요시)

- README.md 업데이트 (새로운 기능, API 변경 등)
- 게임 안내서 업데이트 (energytycoon.txt)
- API 주석/독스트링 추가

## 배포 전 추가 확인사항

### 프로덕션 빌드
```bash
cd frontend-react
npm run build
npm run preview          # 빌드 결과 미리보기
```

### 환경 변수 확인
- 프로덕션 환경 변수가 올바르게 설정되었는지 확인
- API 엔드포인트가 프로덕션 주소를 가리키는지 확인

### 보안 검토
- 비밀번호/토큰이 코드에 하드코딩되지 않았는지 확인
- CORS 설정이 올바른지 확인
- 인증/권한 검증이 적절히 되는지 확인

## 자동화 권장사항

현재 프로젝트에는 자동 테스트나 CI/CD가 완전히 설정되어 있지 않습니다.
다음을 추가하는 것을 권장합니다:

1. **프론트엔드**:
   - Vitest 또는 Jest를 사용한 단위 테스트
   - React Testing Library를 사용한 컴포넌트 테스트
   - Prettier를 사용한 자동 포매팅

2. **백엔드**:
   - pytest를 사용한 단위 테스트
   - black 또는 autopep8를 사용한 자동 포매팅
   - mypy를 사용한 타입 체킹

3. **CI/CD**:
   - GitHub Actions 또는 GitLab CI를 사용한 자동 테스트
   - 린팅 자동 실행
   - 자동 배포 파이프라인

4. **Pre-commit hooks**:
   - husky를 사용한 커밋 전 자동 검사
   - lint-staged를 사용한 스테이징된 파일만 검사
