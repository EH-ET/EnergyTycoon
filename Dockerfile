# 베이스 이미지와 최소 의존성 설치, uvicorn으로 앱 실행
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc build-essential libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

# 복사 및 의존성 설치
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# 애플리케이션 복사
COPY . /app

# 데이터 디렉토리(컨테이너 내부) 생성 및 권한
RUN mkdir -p /app/data && chmod 777 /app/data

ENV DATABASE_URL="sqlite:///./data/energy_tycoon.db"
ENV FRONTEND_ORIGINS="*"
EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]