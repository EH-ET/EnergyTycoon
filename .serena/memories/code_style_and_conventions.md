# 코드 스타일 및 컨벤션

## Git 커밋 컨벤션
프로젝트는 명확한 커밋 컨벤션을 따릅니다:

- **feat**: 새로운 기능 추가
- **fix**: 버그 수정
- **docs**: 문서 작성 및 수정
- **style**: 코드 포매팅 및 스타일 변경
- **refactor**: 코드 리팩토링
- **chore**: 기타 변경사항

**중요**: 커밋 자주하기 - 작은 단위로 자주 커밋하는 것을 권장합니다.

### 커밋 메시지 예시
```
feat: 새로운 발전기 타입 추가
fix: 에너지 계산 오류 수정
docs: API 문서 업데이트
style: ESLint 규칙에 맞게 코드 포매팅
refactor: 게임 로직 모듈화
chore: 의존성 버전 업데이트
```

## 프론트엔드 (JavaScript/React)

### ESLint 설정
- **ECMAScript 버전**: 2020
- **환경**: 브라우저
- **React 버전**: 19.2.0

### 규칙
1. **no-unused-vars**: 
   - 사용하지 않는 변수는 에러
   - 단, 대문자로 시작하는 변수는 무시 (`varsIgnorePattern: '^[A-Z_]'`)
   - 이는 상수나 컴포넌트 이름에 대한 예외 처리

2. **React Hooks**:
   - `eslint-plugin-react-hooks` 사용
   - React Hooks 규칙 준수 (의존성 배열 등)

3. **React Refresh**:
   - Fast Refresh를 위한 규칙 적용

### 파일 구조 컨벤션
- **컴포넌트**: PascalCase (예: `App.jsx`, `AlertModal.jsx`)
- **유틸리티**: camelCase (예: `apiClient.js`, `bigValue.js`)
- **스타일**: 컴포넌트명.css (예: `App.css`, `Login.css`)

### import 순서 (권장)
1. React 및 외부 라이브러리
2. 내부 컴포넌트
3. 훅 및 유틸리티
4. 스타일 파일

```javascript
import React from 'react'
import axios from 'axios'

import MyComponent from './components/MyComponent'

import useCustomHook from './hooks/useCustomHook'
import { apiClient } from './utils/apiClient'

import './App.css'
```

## 백엔드 (Python/FastAPI)

### 일반 규칙
현재 명시적인 포매팅 도구(black, autopep8 등)는 설정되어 있지 않지만, 다음 관행을 따르는 것을 권장합니다:

1. **PEP 8** 스타일 가이드 준수
2. **타입 힌트** 사용 (FastAPI Pydantic 스키마와 함께)
3. **독스트링** 작성 (함수/클래스 설명)

### 파일 구조 컨벤션
- **모델**: `models.py` (SQLAlchemy 모델)
- **스키마**: `schemas.py` (Pydantic 스키마)
- **라우트**: `routes/<기능>_routes.py` (예: `auth_routes.py`)
- **유틸리티**: `<기능>_utils.py` 또는 `<기능>_logic.py`

### import 순서 (권장)
1. 표준 라이브러리
2. 외부 라이브러리
3. 로컬 모듈

```python
import os
from datetime import datetime

from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session

from models import User
from database import get_db
```

## 네이밍 컨벤션

### JavaScript/React
- **변수/함수**: camelCase (예: `getUserData`, `isActive`)
- **상수**: UPPER_SNAKE_CASE (예: `API_BASE_URL`, `MAX_RETRIES`)
- **컴포넌트**: PascalCase (예: `UserProfile`, `AlertModal`)
- **훅**: use + PascalCase (예: `useAuth`, `useGameState`)

### Python
- **변수/함수**: snake_case (예: `get_user_data`, `is_active`)
- **클래스**: PascalCase (예: `User`, `Generator`)
- **상수**: UPPER_SNAKE_CASE (예: `API_BASE_URL`, `MAX_RETRIES`)
- **프라이빗**: 앞에 _ (예: `_internal_function`)

## 상태 관리 (Zustand)
- 스토어는 `store/` 디렉토리에 위치
- 스토어 파일명: `<기능>Store.js` (예: `gameStore.js`, `authStore.js`)

## API 엔드포인트 컨벤션
- REST API 스타일 준수
- 프론트엔드에서 `/api` 프리픽스 사용 (Vite 프록시로 백엔드 연결)
- 백엔드는 `/api` 없이 라우트 정의

### 예시
- 프론트엔드: `axios.get('/api/generators')`
- 백엔드: `@router.get('/generators')`
- 실제 요청: `http://localhost:8000/generators`

## 환경 변수
- `.env` 파일 사용 (절대 커밋하지 않음)
- `.env.example` 템플릿 제공 권장
- 민감한 정보는 반드시 환경 변수로 관리
