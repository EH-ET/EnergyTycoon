# Supercoin & Inquiry System - 배포 가이드

## ✅ 완료된 작업

### Backend
1. ✅ `User` 모델에 `supercoin` 컬럼 추가
2. ✅ `Inquiry` 모델 생성 (inquiries 테이블)
3. ✅ 마이그레이션 함수 추가 (`init_db.py`)
4. ✅ Inquiry API 엔드포인트 구현
5. ✅ Supercoin 랭킹 지원 추가

### Frontend
1. ✅ Header에 Supercoin 표시
2. ✅ Footer에 문의하기 버튼 추가
3. ✅ InquiryTab 컴포넌트 생성
4. ✅ AdminPage 페이지 생성
5. ✅ InfoTab에 Supercoin 랭킹 추가

## 🚀 배포 방법

### 1. 코드 커밋 & 푸시
```bash
cd /Users/eunchong/Desktop/프로젝트/EnergyTycoon/energy_tycoon
git add .
git commit -m "feat: Add Supercoin, Inquiry system, and Admin page"
git push origin main
```

### 2. 백엔드 배포 확인
- Render/Railway 등에서 자동으로 재배포됩니다
- 서버 재시작 시 `startup_event()`에서 자동으로 마이그레이션 실행
- 로그를 확인하여 마이그레이션이 성공했는지 체크

### 3. 프론트엔드 배포
- Netlify가 자동으로 새 버전을 빌드/배포합니다
- 빌드 로그 확인

## 🧪 테스트 체크리스트

### Supercoin
- [ ] Header에 슈퍼코인 카운트 표시되는지 확인 (기본값 0)
- [ ] 기존 유저들도 에러 없이 로그인되는지 확인
- [ ] Info 탭에서 슈퍼코인 랭킹(🪙) 버튼 동작 확인

### 문의하기 (Inquiry)
- [ ] Footer에 "문의하기" 버튼 표시 확인
- [ ] 문의 종류 선택 가능 (버그, 취약점, 발전기 제안, 기타)
- [ ] 내용 입력 후 제출 가능
- [ ] 제출 성공 메시지 표시

### Admin Page
- [ ] URL에 `#admin` 추가하여 접근
  - 예: `https://energytycoon.netlify.app/#admin`
- [ ] 문의 목록이 표시되는지 확인
- [ ] 수락 버튼 클릭 시:
  - [ ] 문의가 삭제되는지 확인
  - [ ] 해당 유저의 supercoin이 +1 증가하는지 확인
- [ ] 거절 버튼 클릭 시 문의만 삭제되는지 확인

## 🔍 현재 로그인 에러 해결

현재 500 에러가 발생하는 이유는 **데이터베이스 스키마가 코드와 맞지 않기 때문**입니다.

### 해결 방법:

1. **백엔드 재배포 강제 실행**
   - Render/Railway 대시보드에서 "Manual Deploy" 클릭
   - 또는 Git에 빈 커밋 푸시:
     ```bash
     git commit --allow-empty -m "chore: Force redeploy for schema migration"
     git push origin main
     ```

2. **배포 후 로그 확인**
   - 서버 로그에서 다음과 같은 메시지 확인:
     - `ALTER TABLE users ADD COLUMN supercoin...`
     - `CREATE TABLE inquiries...`

3. **데이터베이스 직접 확인 (선택사항)**
   - PostgreSQL에 직접 연결하여 확인:
     ```sql
     \d users  -- supercoin 컬럼 확인
     \d inquiries  -- inquiries 테이블 확인
     ```

## 📝 API 엔드포인트

### Inquiry
- `POST /inquiries` - 문의 생성
- `GET /inquiries` - 문의 목록 조회 (관리자용)
- `POST /inquiries/{inquiry_id}/accept` - 문의 수락 (유저에게 +1 슈퍼코인)
- `POST /inquiries/{inquiry_id}/reject` - 문의 거절

### Ranking
- `GET /rank?criteria=supercoin` - 슈퍼코인 기준 내 랭킹
- `GET /ranks?criteria=supercoin` - 슈퍼코인 기준 전체 랭킹

## ⚠️ 주의사항

1. **Admin Page 보안**
   - 현재는 로그인한 모든 유저가 접근 가능합니다
   - 추후 관리자 권한 체크 로직 추가 권장

2. **데이터베이스 백업**
   - 마이그레이션 전 데이터베이스 백업 권장
   - Render/Railway에서 자동 백업 설정 확인

3. **로컬 테스트**
   - 배포 전 로컬에서 테스트 권장:
     ```bash
     cd backend
     uvicorn main:app --reload
     ```
   - 프론트엔드:
     ```bash
     cd frontend-react
     npm run dev
     ```

## 🎯 다음 단계 (선택사항)

- [ ] 관리자 권한 시스템 추가
- [ ] 문의 필터링/검색 기능
- [ ] 문의 상태 관리 (pending, approved, rejected)
- [ ] 이메일 알림 시스템
- [ ] Supercoin 사용처 추가 (특별 발전기, 스킨 등)
