# TODO List for EnergyTycoon Frontend Fixes

## Completed ✅
1. ✅ BigValue 단위 적용 함수 수정 (`getHugeUnitRecursive`) - `bigvalueRule.txt` 규칙에 맞게 재구현
2. ✅ Info 탭에 환생 횟수 표시 추가
3. ✅ Info 탭 돈 BigValue 적용 - 이미 적용되어 있음
4. ✅ 에너지 생산량 BigValue 적용 - Header에 적용 완료
5. ✅ 프로필 모달창 등수 표시 개선 - 로딩 상태 추가
6. ✅ 환생 500 에러 수정 - getattr 사용하여 안전한 속성 접근

## 참고사항
- BigValue 변환 시 `formatResourceValue({ data: value * 1000, high: 0 })`  형태 사용
- `energyRate`는 초당 plain value이므로 DATA_SCALE(1000)을 곱하여 data로 변환
- Info 탭의 랭킹 리스트는 limit=100으로 상위 100명까지 표시

## 테스트 필요
1. BigValue 단위 표시 테스트 (특히 high > 3000인 경우)
2. 환생 기능 테스트 (비용 계산, 리셋, 멀티플라이어 적용)
3. 프로필 모달에서 랭킹 정보 로딩 확인
4. 대량의 에너지 생산 시 표시 확인

## 배포 전 체크리스트
- [ ] 프론트엔드 빌드 확인
- [ ] 백엔드 DB 마이그레이션 실행 확인 (rebirth_count 컬럼 추가)
- [ ] 환생 API 엔드포인트 작동 확인
- [ ] BigValue 포맷팅 다양한 케이스 테스트
