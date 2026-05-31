#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Honeypot Integrated Platform — 초기 설치 헬퍼 (Linux / WSL / macOS)
#   - .env 파일 생성 (템플릿 복사)
#   - 로그 디렉토리 생성
#   - SECRET_KEY 자동 생성
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "▸ Honeypot Integrated 초기 설정"
echo "  PROJECT: $ROOT_DIR"
echo

# ─── .env 생성 ───────────────────────────────────────────────────────────────
if [[ -f .env ]]; then
  echo "  .env 가 이미 존재합니다. 건너뜀."
else
  cp .env.example .env
  if command -v openssl &>/dev/null; then
    SECRET_KEY="$(openssl rand -hex 32)"
    sed -i.bak "s|^SECRET_KEY=.*|SECRET_KEY=${SECRET_KEY}|" .env && rm -f .env.bak
    echo "  .env 생성 + SECRET_KEY 자동 발급"
  else
    echo "  .env 생성 (SECRET_KEY는 직접 수정하세요)"
  fi
  echo "  ⚠  PROJECT_HOST / HONEYPOT_LOGS_HOST 경로가 본인 환경과 맞는지 확인"
fi

# ─── 로그 디렉토리 ───────────────────────────────────────────────────────────
LOG_HOST="$(grep '^HONEYPOT_LOGS_HOST=' .env | cut -d= -f2)"
if [[ -n "$LOG_HOST" ]]; then
  echo "  로그 디렉토리 생성: $LOG_HOST"
  for hp in cowrie heralding opencanary snare dionaea mailoney conpot; do
    mkdir -p "$LOG_HOST/$hp"
  done
  chmod -R 777 "$LOG_HOST" 2>/dev/null || true
fi

cat <<EOF

✓ 초기 설정 완료

다음 단계:
  1) .env 의 PROJECT_HOST / HONEYPOT_LOGS_HOST / POSTGRES_PASSWORD 검토
  2) ../profiling-service 가 클론되어 있는지 확인 (Spring Boot 서비스)
  3) docker compose up -d --build
  4) 첫 실행 시 Ollama 모델 다운로드 대기:
       docker compose logs -f model-pull

접속:
  Frontend       http://localhost:8001
  FastAPI docs   http://localhost:8000/docs
  Profiling      http://localhost:8090/api/health
EOF
