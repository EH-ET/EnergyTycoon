# 베이스 이미지와 최소 의존성 설치, uvicorn으로 앱 실행
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성(필요시 추가)
RUN apt-get update && apt-get install -y gcc build-essential --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# 파이썬 의존성 복사(빌드시 requirements.txt 필요)
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

# 코드 복사(로컬 마운트할 경우 optional)
COPY . /app

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]