# 중요 사항 및 주의점

## 개발 환경 특이사항

### macOS (Darwin) 환경
이 프로젝트는 macOS 환경에서 개발되고 있습니다.
- 파일 시스템 대소문자 구분 주의
- `.DS_Store` 파일은 자동 생성되므로 .gitignore에 포함됨
- 일부 Linux 명령어와 동작이 다를 수 있음

### 현재 Git 브랜치
- 작업 브랜치: `eunchong-dev-clean`
- Main 브랜치는 별도로 설정되어 있지 않음 (확인 필요)

## 게임 로직 관련 주의사항

### 큰 숫자 처리 (BigValue)
프로젝트에는 `bigvalue.py`와 `bigvalueRule.txt` 파일이 있습니다.
- 게임에서 매우 큰 숫자를 처리하기 위한 로직
- 에너지/돈이 매우 커질 수 있으므로 특별한 처리 필요
- 관련 코드 수정 시 `bigvalueRule.txt` 참조

### 발전기 데이터
23종의 발전기가 있으며, 각각 고유한 속성을 가집니다:
- 에너지 생산량
- 에너지 효율
- 내열 한계
- 유지비
- 설치 비용
- 설치 면적
- 개발 진행 상태 (O/X)

현재 11개 발전기만 개발 완료 ("O" 표시)

### 환율 시스템
복잡한 환율 공식을 사용합니다:
```
rate = 1 / (base_cost × growth × bonus)
growth = 1 + 0.05 × floor(log_3(total_sold_energy))
bonus = max(0.5, 1 − 0.05 × demand_bonus_level)
```

코드 수정 시 이 공식을 깨뜨리지 않도록 주의!

### 환생 시스템
```
생산량 배율: ×2^n
돈 가치(환율): ×2^n
환생 비용: 1T × 10^n
```

지수적으로 증가하는 시스템이므로 오버플로우 주의

## 보안 관련

### 인증 시스템
- JWT 토큰 사용 (PyJWT)
- bcrypt를 사용한 비밀번호 해싱
- 세션 쿠키: Trap/CSRF 쿠키로 세션 변조 방지

### 환경 변수
`.env` 파일에 중요한 정보가 포함되어 있습니다:
- 절대 Git에 커밋하지 말 것!
- 데이터베이스 접속 정보
- JWT 시크릿 키
- 기타 민감한 설정

## 데이터베이스

### PostgreSQL (Neon)
- ORM: SQLAlchemy 2.0+
- 마이그레이션 스크립트: `backend/migrate_to_neon.py`
- 초기화 스크립트: `backend/init_db.py`

### 데이터 무결성
- 자동 저장: 30초마다 서버에 저장
- 게임 로직에서 데이터 손실 방지 메커니즘 존재

## API 통신

### 프록시 설정
Vite 개발 서버는 `/api`로 시작하는 요청을 백엔드(8000 포트)로 프록시합니다.

```javascript
// vite.config.js
proxy: {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, '')
  }
}
```

### 프론트엔드에서 API 호출
```javascript
// 올바른 방법
axios.get('/api/generators')  // → http://localhost:8000/generators

// 잘못된 방법
axios.get('http://localhost:8000/generators')  // CORS 에러 발생 가능
```

## Docker 관련

### 포트 매핑
- 프론트엔드: 80 (Nginx)
- 백엔드: 8000 (내부에서만 노출)

### 볼륨 마운트
```yaml
volumes:
  - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
```

Nginx 설정은 읽기 전용으로 마운트됨

## 성능 최적화

### 프론트엔드
- Vite는 HMR(Hot Module Replacement) 지원
- 프로덕션 빌드 시 자동 최적화 (코드 스플리팅, 압축 등)

### 백엔드
- FastAPI는 비동기 처리 지원
- 대량의 게임 데이터 처리 시 성능 고려 필요

## 알려진 이슈 및 제한사항

### 테스트 부재
현재 자동화된 테스트가 없습니다.
- 단위 테스트 추가 권장
- 통합 테스트 추가 권장

### 포매팅 도구
프론트엔드는 ESLint만 사용하며, 자동 포매팅 도구(Prettier)가 없습니다.
백엔드도 포매팅 도구(black, autopep8)가 설정되어 있지 않습니다.

### CI/CD
Google Cloud Build 설정 파일(`cloudbuild.yaml`)은 있지만,
자동화된 테스트/린팅 파이프라인은 완전히 설정되어 있지 않을 수 있습니다.

## 디버깅 팁

### 프론트엔드
- React DevTools 사용
- Zustand DevTools 추가 고려
- 브라우저 콘솔 활용

### 백엔드
- FastAPI 자동 문서: `http://localhost:8000/docs`
- Uvicorn 로그 확인
- SQLAlchemy 쿼리 로그 활성화 가능

### Docker
```bash
docker-compose logs -f backend   # 백엔드 로그
docker-compose logs -f frontend  # 프론트엔드 로그
docker-compose exec backend bash # 백엔드 컨테이너 접속
```

## 추가 문서 참조
- `energytycoon.txt`: 게임 안내서 (게임 메커니즘 상세 설명)
- `bigvalueRule.txt`: 큰 숫자 처리 규칙
- `AGENTS.md`: Agent 관련 문서 (AI/자동화 관련)
- `README.md`: 프로젝트 기본 정보 (발전기 목록 등)
