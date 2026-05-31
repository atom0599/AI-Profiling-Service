# Contributing & GitHub 배포 가이드

## 푸시 전 체크리스트

**커밋 전 반드시 확인**:
- [ ] `.env` 가 커밋 대상에 포함되지 않았는지 (`.gitignore` 로 제외됨)
- [ ] `backend/data/` (SQLite + 모델 .pkl) 비포함
- [ ] `honeypot_logs/` (개인정보·시연 데이터 가능) 비포함
- [ ] `frontend/.next/`, `frontend/node_modules/`, `__pycache__/` 비포함
- [ ] `*.csv`, `*.pkl` 등 데이터셋/모델 산출물 비포함
- [ ] `SECRET_KEY`, `POSTGRES_PASSWORD`, `INTERNAL_SERVICE_TOKEN` 가 커밋된 파일에 평문으로 남아있지 않은지
- [ ] `backend/main.py:51` 의 `SEED_USERS` 비밀번호가 운영용으로 적절한지 (시연용 기본값 그대로 두려면 README 에 경고 명시)

## 깃 초기화 + 푸시

```bash
cd honeypot-integrated

# 워킹트리 점검
git init
git status                       # 추적 대상 확인

# 커밋
git add .
git commit -m "Initial commit: honeypot integrated platform"

# 원격 추가 + 푸시
git branch -M main
git remote add origin https://github.com/Donghyun0918/honeypot-integrated.git
git push -u origin main
```

## Spring Boot 프로파일링 서비스

`docker-compose.yml` 이 `../profiling-service/honeypot` 을 참조하므로, 동일한 부모 디렉토리에 별도 리포로 클론되어야 한다:

```
parent/
├── honeypot-integrated/      # 본 리포
└── profiling-service/        # Spring Boot (별도 리포)
    └── honeypot/
        ├── Dockerfile
        ├── build.gradle
        └── src/
```

본 리포에 Spring Boot 까지 통합하려면 `docker-compose.yml` 의 `profiling.build.context` 를 상대 경로로 옮기거나 서브모듈 사용을 고려.

## 코드 스타일

- **Python**: PEP8, 타입 힌트 권장. 비동기 라우터는 `async def`, 블로킹 작업(스레드/Docker SDK)은 `run_in_executor` 또는 `threading.Thread(daemon=True)`
- **TypeScript**: Next.js 15 App Router, 클라이언트 컴포넌트는 `"use client"` 명시. 토큰은 `getToken()` 으로 일관되게 접근
- **Bash 시나리오**: `set -e`, 모든 IP/포트는 환경변수로 주입 — 절대 하드코딩 금지

## PR 가이드

1. 기능 단위로 브랜치 분리 (`feat/...`, `fix/...`, `docs/...`)
2. 백엔드 변경 시 `docker compose build backend && docker compose up -d backend` 로 동작 검증
3. 프론트 변경 시 동일하게 `docker compose build frontend`
4. 데이터셋/ML 코드 변경 시 `dataset.csv` 1세트라도 생성해 회귀 테스트
