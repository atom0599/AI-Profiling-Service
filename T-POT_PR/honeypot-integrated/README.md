# Honeypot Integrated Platform

다중 허니팟 + ML 분류 + LLM 분석 + 공격 시나리오 자동화를 하나의 통합 대시보드로 묶은 캡스톤 프로젝트.

유저별로 격리된 허니팟 컨테이너 7종을 자동 생성하고, 공격자(Kali) 컨테이너에서 9가지 시나리오를 실행해 로그를 수집한 뒤, Random Forest 모델로 1차 분류하고 고위험 공격만 Ollama LLM으로 2차 분석한다.

---

## 1. 한눈에 보는 시스템 구조

```
                          ┌──────────────────────────────────────────┐
                          │           브라우저 (사용자 / 관리자)            │
                          │     http://localhost:8001                │
                          └───────────────────┬──────────────────────┘
                                              │ HTTP / WebSocket
                                              ▼
              ┌────────────────────────────────────────────────────────────┐
              │   Next.js 15 Frontend  (honeypot-frontend, :8001)         │
              │   - /dashboard  /honeypot  /profiling  /ml  /login        │
              └─────────────┬───────────────────┬──────────────────────────┘
                            │ REST              │ REST
                            ▼                   ▼
   ┌────────────────────────────────┐  ┌────────────────────────────────┐
   │  FastAPI Backend (:8000)        │  │ Spring Boot Profiling (:8090) │
   │  honeypot-backend               │  │ honeypot-profiling             │
   │  - 인증/유저/컨테이너 제어            │◄─┤ - 공격 이력 누적 / 분석 결과 저장   │
   │  - 시나리오 실행 (Kali docker exec)│  │ - PostgreSQL 영속화           │
   │  - 로그 파싱/데이터셋 생성              │  └────────────────┬───────────────┘
   │  - ML 학습 / 분류 (RF)                │                   │
   │  - LLM 호출 (Ollama)                  │                   ▼
   └─────────┬──────┬──────┬──────────────┘     ┌──────────────────────┐
             │      │      │                   │ PostgreSQL 16          │
             │      │      │ Docker SDK         │ honeypot-postgres      │
             │      │      ▼                   └──────────────────────┘
             │      │  ┌──────────────────────────────────────────────┐
             │      │  │ 유저별 허니팟 컨테이너 (hp_{user}_{honeypot})    │
             │      │  │ ┌────────┐ ┌──────────┐ ┌──────────┐         │
             │      │  │ │ cowrie │ │heralding │ │opencanary│  ...   │
             │      │  │ └────────┘ └──────────┘ └──────────┘         │
             │      │  │ snare / dionaea / mailoney / conpot /        │
             │      │  │ tanner   네트워크: hp_net_{user}                │
             │      │  └──────────────────────────────────────────────┘
             │      ▼
             │   ┌─────────────────────┐
             │   │ Kali Attacker       │
             │   │ kali-attacker       │
             │   │ - nmap, hydra,      │
             │   │   sqlmap, nc, curl  │
             │   │ - attack_scenarios/ │
             │   └─────────────────────┘
             ▼
        ┌──────────────────────────┐
        │ Ollama (llama3.1:8b)     │
        │ honeypot-ollama (:11434) │
        └──────────────────────────┘

볼륨 마운트:
  ${HONEYPOT_LOGS_HOST}  ─►  /honeypot_logs   (모든 허니팟 + 백엔드 + Kali 공유)
  honeyforge_db          ─►  /app/data        (백엔드 SQLite + ML 모델)
  profiling_db           ─►  PostgreSQL data
  ollama_data            ─►  Ollama 모델 캐시
```

### 데이터 흐름 (한 사이클)

```
[1] 시나리오 실행
    Frontend ── POST /api/scenarios/{id}/run ──► Backend
    Backend ── docker exec ──► Kali ── 공격 패킷 ──► 허니팟 7종

[2] 로그 수집
    각 허니팟 ── 로그 파일 ──► /honeypot_logs/{user}/{honeypot}/

[3] 데이터셋 생성 (ML 페이지 Step 1)
    Frontend ── POST /api/dataset/generate ──► Backend
    Backend (parse_logs.py)  →  /honeypot_logs/{user}/dataset.csv
    Backend (ml_prepare.py)  →  /honeypot_logs/{user}/dataset_ml.csv

[4] 모델 학습 (ML 페이지 Step 2)
    Frontend ── POST /api/ml/train ──► Backend
    Backend (ml_service.py) RandomForest 학습
    저장: /app/data/ml_models/{binary_model.pkl, multi_model.pkl}

[5] 1차 분류 + 2차 LLM 분석
    Backend ── classify() ──► is_attack/class/MITRE 점수
    MITRE ≥ 70 →  Ollama llama3.1:8b ──► riskScore/severity/summary/solution
                                       ──► Spring Boot 프로파일링 저장
```

---

## 2. 폴더 구조

```
honeypot-integrated/
├── docker-compose.yml           # 14개 컨테이너 정의 (+ Spring Boot는 ../profiling-service 참조)
├── .env                         # 실 환경변수 (커밋 금지)
├── .env.example                 # 환경변수 템플릿
├── README.md                    # 본 문서
│
├── backend/                     # FastAPI 백엔드
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                  # FastAPI 라우터 (인증/유저/컨테이너/시나리오/ML)
│   ├── auth.py                  # JWT + bcrypt 인증
│   ├── database.py              # SQLAlchemy: User / ScenarioRun (SQLite)
│   ├── docker_ops.py            # Docker SDK: 유저별 허니팟 생성/삭제/제어
│   ├── scenario_runner.py       # Kali docker exec → 시나리오 실행
│   ├── parse_logs.py            # 7종 허니팟 로그 → dataset.csv (29컬럼)
│   ├── ml_prepare.py            # dataset.csv → dataset_ml.csv (라벨링 + 피처)
│   └── ml_service.py            # RandomForest 학습/추론, MITRE ATT&CK 점수
│
├── frontend/                    # Next.js 15 (App Router, standalone build)
│   ├── Dockerfile               # 멀티스테이지 (deps → builder → runner)
│   ├── package.json
│   ├── next.config.ts
│   └── src/
│       ├── app/
│       │   ├── page.tsx         # 랜딩
│       │   ├── login/, signup/
│       │   ├── dashboard/       # 통계 + 공격 지도 (D3 + world-atlas)
│       │   ├── honeypot/        # 컨테이너 / 시나리오 / 데이터셋 탭
│       │   ├── profiling/       # Spring Boot 프록시 (공격 이력 + LLM 결과)
│       │   └── ml/              # 모델 학습 / 업로드 / 테스트
│       ├── components/
│       │   └── AttackMap.tsx    # 세계지도 공격자 IP 시각화
│       └── lib/
│           └── api-client.ts    # 토큰 + API 래퍼
│
├── honeypots/                   # 7종 허니팟 빌드 컨텍스트
│   ├── cowrie/                  # SSH/Telnet (cfg + userdb 만 마운트, 이미지는 cowrie/cowrie:latest)
│   │   ├── cowrie.cfg
│   │   └── userdb.txt
│   ├── heralding/               # HTTP/MySQL/SMTP 인증 수집 (Dockerfile + heralding.yml)
│   ├── opencanary/              # FTP/RDP/VNC 포트스캔 탐지
│   ├── snare/                   # 웹 공격 (SQLi/XSS/LFI)
│   ├── dionaea/                 # 외부 이미지(dinotools/dionaea) — SMB/멀웨어 캡처
│   ├── mailoney/                # SMTP 허니팟
│   ├── conpot/                  # ICS/SCADA (Modbus/SNMP/S7Comm)
│   └── tanner/                  # SNARE 분석 백엔드 스텁
│
├── kali/                        # 공격자 컨테이너
│   └── Dockerfile               # nmap, hydra, sqlmap, nc, curl, sshpass, smbclient + rockyou
│
├── attack_scenarios/            # 9가지 공격 시나리오 (bash)
│   ├── 01_normal_traffic.sh     #   Etc        — 정상 SSH/HTTP
│   ├── 02_port_scan.sh          #   Recon      — nmap T1046
│   ├── 03_brute_force.sh        #   Brute      — hydra T1110
│   ├── 04_web_attacks.sh        #   Intrusion  — sqlmap T1190
│   ├── 05_post_intrusion.sh     #   Intrusion  — 침투 후 명령어 T1059
│   ├── 06_reverse_shell.sh      #   Intrusion  — bash -i T1203
│   ├── 07_malware_upload.sh     #   Malware    — wget/curl T1105
│   ├── 08_credential_stuffing.sh#   Brute      — MySQL T1110.004
│   ├── 09_ics_attack.sh         #   Recon      — Modbus T1046
│   └── lib/                     # 공통 함수 / 전술별 헬퍼
│
└── scripts/                     # 데이터 파이프라인 / 검증 (Kali 컨테이너에서 실행 가능)
    ├── parse_logs.py            # backend/parse_logs.py 의 원본
    ├── label_data.py            # 룰 기반 라벨링 (ml_prepare.py 에 통합됨)
    ├── feature_engineering.py   # 피처 추출 (ml_prepare.py 에 통합됨)
    ├── pipeline.sh              # 전체 파이프라인 일괄 실행
    └── validate.py              # 스키마 검증
```

> **Spring Boot 프로파일링 서비스**는 별도 리포(`../profiling-service`)에 있으며, `docker-compose.yml`이 `build.context: ../profiling-service/honeypot` 으로 참조한다.

---

## 3. 컨테이너 명세 (14종)

| 컨테이너 | 역할 | 포트(host:container) | 네트워크 |
|---|---|---|---|
| `honeypot-postgres` | Spring Boot DB | 내부 5432 | app-net |
| `honeypot-profiling` | 공격 이력 + 분석 결과 (Spring Boot) | **8090**:8080 | app-net |
| `honeypot-backend` | FastAPI + ML + 시나리오 오케스트레이션 | **8000**:8000 | app-net |
| `honeypot-ollama` | LLM 엔진 | **11434**:11434 | app-net |
| `honeypot-model-pull` | llama3.1:8b 자동 다운로드 (one-shot) | — | — |
| `honeypot-frontend` | Next.js 15 대시보드 | **8001**:8001 | app-net |
| `cowrie` | SSH/Telnet 허니팟 (전역, 시연용) | 2222, 2223 | honeypot-net |
| `heralding` | HTTP/MySQL 인증 수집 | 8880, 33306 | honeypot-net |
| `opencanary` | FTP/RDP/VNC 탐지 | 2121, 33389, 55900 | honeypot-net |
| `tanner` | SNARE 백엔드 스텁 | 내부 | honeypot-net |
| `snare` | 웹 공격 허니팟 | 8080 | honeypot-net |
| `dionaea` | SMB/MSSQL 멀웨어 | 4445, 4421, 14433 | honeypot-net |
| `mailoney` | SMTP 허니팟 | 2525 | honeypot-net |
| `conpot` | ICS/SCADA | 10102, 5502, 16100/udp | honeypot-net |
| `kali-attacker` | 공격 시나리오 실행기 | — | honeypot-net |
| `hp_{user}_{honeypot}` × 7 | **유저 가입 시 자동 생성**되는 전용 허니팟 세트 | 동적 | hp_net_{user} |

### 네트워크
- `app-net` (bridge): 백엔드/프론트/DB/LLM/프로파일링 — 서비스 간 통신
- `honeypot-net` (bridge, 172.30.0.0/24): 전역 허니팟 + Kali — 시연용
- `hp_net_{user}` (bridge): 유저 가입 시 동적 생성 — 본인 허니팟 격리

---

## 4. 주요 파일 기능

### Backend (FastAPI)

| 파일 | 핵심 책임 |
|---|---|
| `main.py` | 모든 REST 엔드포인트 (~830 라인). 인증/유저/컨테이너/시나리오/데이터셋/ML/LLM `/analyze` |
| `auth.py` | JWT 발급(HS256, 24h) + bcrypt 비밀번호 해싱. `get_current_user` 의존성 |
| `database.py` | SQLite (`/app/data/dashboard.db`). 비동기 + 동기 세션 병용 (스레드 작업용) |
| `docker_ops.py` | Docker SDK 래퍼. `create_user_honeypots`, `remove_user_honeypots`, `control_container`, `get_container_logs` |
| `scenario_runner.py` | Kali에 `docker exec`. 유저 IP를 환경변수로 주입 → 시나리오 실행 → ML 분류 → Spring Boot 프로파일링 전송 |
| `parse_logs.py` | 7종 허니팟 로그 → 통합 `dataset.csv` (29컬럼). UUID, session_id, MITRE 5-tuple 등 |
| `ml_prepare.py` | `dataset.csv` → `dataset_ml.csv`. 룰 기반 라벨링(Etc/Recon/Brute Force/Intrusion/Malware) + 피처 인코딩 |
| `ml_service.py` | RandomForest 이진/다중 분류기. 학습/저장/로드/추론 + MITRE 점수 + LLM 임계값 |

### Frontend (Next.js 15)

| 페이지 | 기능 |
|---|---|
| `/` | 랜딩 (인라인 CSS) |
| `/login`, `/signup` | JWT 발급 → localStorage |
| `/dashboard` | 통계 차트 + 공격자 IP 세계지도 (D3 + world-atlas TopoJSON) |
| `/honeypot` | 4탭: 🍯 컨테이너 / ⚡ 시나리오 / 📋 히스토리 / 📦 데이터셋 |
| `/profiling` | Spring Boot에 저장된 공격 이력 + LLM 분석 결과 표시 |
| `/ml` | 4탭: 📊 상태 / 🎓 모델 학습 / 📤 업로드 / 🧪 테스트 |

### 허니팟 7종 입출력

| 허니팟 | 프로토콜 / 포트 | 출력 로그 |
|---|---|---|
| **cowrie** | SSH 22, Telnet 23 | `/tmp/cowrie_logs/cowrie.json` |
| **heralding** | HTTP, MySQL, SMTP, ... | `/var/log/heralding/auth.csv`, `session.csv` |
| **opencanary** | FTP 21, RDP 3389, VNC 5900 | `/var/log/opencanary/opencanary.log` (JSON lines) |
| **snare** | HTTP 8080 (Tanner 연동) | `/opt/snare/snare.log`, `snare.err` |
| **dionaea** | SMB 445, MSSQL 1433, FTP 21 | `/opt/dionaea/var/log/dionaea/dionaea.log` |
| **mailoney** | SMTP 25 | `/var/log/mailoney/mailoney.json` |
| **conpot** | Modbus 502, SNMP 161, S7Comm 102 | `/var/log/conpot/conpot.json` |

---

## 5. 환경 변수 (`.env`)

```bash
# ── 호스트 경로 ──────────────────────────────────────────────────────────────
# WSL/Linux: /mnt/d/...   PowerShell 직접: D:/...
PROJECT_HOST=/mnt/d/joljak33-main/honeypot-integrated
HONEYPOT_LOGS_HOST=/mnt/d/honeypot_logs

# ── 보안 (운영 시 반드시 변경) ────────────────────────────────────────────────
SECRET_KEY=<32바이트 이상 랜덤 문자열>

# ── PostgreSQL (Spring Boot 전용) ────────────────────────────────────────────
POSTGRES_DB=honeypot_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<강한 비밀번호>
INTERNAL_SERVICE_TOKEN=<백엔드 ↔ Spring Boot 공유 토큰>

# ── 허니팟 네트워크 (172.30.0.0/24 권장) ─────────────────────────────────────
SUBNET=172.30.0.0/24
COWRIE_IP=172.30.0.10
HERALDING_IP=172.30.0.11
OPENCANARY_IP=172.30.0.12
SNARE_IP=172.30.0.13
DIONAEA_IP=172.30.0.14
MAILONEY_IP=172.30.0.15
CONPOT_IP=172.30.0.16
TANNER_IP=172.30.0.17
KALI_IP=172.30.0.20
```

---

## 6. 빠른 시작

### 사전 준비
- Docker Desktop 24+ (Windows는 WSL2 백엔드 권장)
- 16GB RAM 이상 (Ollama llama3.1:8b ~6GB)
- 디스크 30GB 이상 여유

### 설치 → 실행

```bash
# 1) 클론
git clone https://github.com/Donghyun0918/honeypot-integrated.git
cd honeypot-integrated

# 2) Spring Boot 프로파일링 서비스도 같은 부모 디렉토리로
cd ..
git clone <PROFILING_SERVICE_REPO> profiling-service
cd honeypot-integrated

# 3) 환경변수
cp .env.example .env
# .env 의 PROJECT_HOST / HONEYPOT_LOGS_HOST / SECRET_KEY / POSTGRES_PASSWORD 수정

# 4) 로그 디렉토리
mkdir -p /mnt/d/honeypot_logs/{cowrie,heralding,opencanary,snare,dionaea,mailoney,conpot}
# Windows PowerShell:
#   New-Item -ItemType Directory -Force D:/honeypot_logs/{cowrie,heralding,opencanary,snare,dionaea,mailoney,conpot}

# 5) 빌드 & 실행
docker compose up -d --build

# 6) 모델 다운로드 대기 (최초 1회)
docker compose logs -f model-pull   # "success" 까지 기다리기
```

### 접속

| URL | 용도 |
|---|---|
| http://localhost:8001 | 프론트엔드 (메인) |
| http://localhost:8000/docs | FastAPI Swagger |
| http://localhost:8090/api/health | Spring Boot 헬스체크 |
| http://localhost:11434 | Ollama API |

### 시드 계정
| ID | PW | 권한 |
|---|---|---|
| `admin` | `admin123` | 관리자 |
| `user1` | `user1234` | 일반 (가입 시 컨테이너 자동 생성) |

> 운영 시 `backend/main.py:51` `SEED_USERS` 의 비밀번호를 반드시 교체할 것.

---

## 7. 실사용 흐름 (3분 데모)

1. **로그인** — `admin` / `admin123` 로 http://localhost:8001/login
2. **🍯 허니팟 페이지 → ⚡ 시나리오 탭**
   - "전체 실행" 클릭 → 9개 시나리오가 순차로 Kali에서 동작
   - 각 시나리오는 본인의 `hp_admin_{honeypot}` 컨테이너만 공격
3. **📦 데이터셋 탭** → "📊 데이터셋 생성"
   - `dataset.csv` 생성 (수천~수만 행)
4. **🤖 ML 페이지 → 모델 학습 탭**
   - **Step 1**: ⚙️ 데이터셋 생성 & 준비 — `dataset_ml.csv` 자동 생성
   - **Step 2**: 🎓 학습 시작 — RandomForest 이진/다중 분류기 학습 (수초)
5. **📋 공격 이력 페이지** — Spring Boot에 누적된 공격 + LLM 분석 결과 확인

---

## 8. 핵심 API 엔드포인트

전체 목록은 http://localhost:8000/docs 참고.

### 인증
- `POST /api/auth/register` — 가입(자동으로 본인 허니팟 7종 생성)
- `POST /api/auth/login` — JWT 발급 (form-urlencoded)

### 컨테이너 / 시나리오
- `GET  /api/containers` — 본인 허니팟 상태
- `POST /api/containers/{name}/{start|stop|restart}` — 제어
- `WS   /ws/logs/{name}?token=...` — 실시간 로그 스트리밍
- `GET  /api/scenarios` — 시나리오 목록 + 상태
- `POST /api/scenarios/run-all` — 9개 시나리오 일괄 실행
- `POST /api/scenarios/{id}/run` — 단일 실행

### 데이터셋 / ML
- `POST /api/dataset/generate` — `parse_logs.py` 실행 (백엔드 컨테이너 내부)
- `GET  /api/dataset/download?filename=dataset.csv` — JWT 헤더 필요
- `GET  /api/ml/prepare/run` — 라벨링 + 피처 엔지니어링 (동기, 결과 즉시 반환)
- `POST /api/ml/train` — 백그라운드 학습 (RandomForest)
- `GET  /api/ml/status` — 모델 상태 + 학습 로그
- `POST /api/ml/upload/{binary|multi}` — `.pkl` 파일 업로드
- `POST /api/ml/classify` — 추론

### 관리자 전용
- `GET  /api/admin/containers` — 전체 유저 컨테이너
- `GET  /api/admin/stats` — 유저별 데이터셋 + 시나리오 집계
- `DELETE /api/users/{id}` — 비활성화 (컨테이너 삭제)
- `POST /api/users/{id}/activate` — 재활성화 (컨테이너 재생성)

### Spring Boot 연동
- `POST /analyze` — Spring Boot AnalysisService가 호출. Ollama로 LLM 분석 후 JSON 반환

---

## 9. 데이터셋 스키마

### dataset.csv (parse_logs.py 출력, 29컬럼)
```
event_id, session_id, seq_no, session_seq_no,
timestamp, ingest_time,
src_ip, src_port, dst_ip, dst_port, transport,
protocol, source_honeypot,
event_type, event_result,
username, password, login_success, login_attempts,
command, file_url, file_hash,
url_path, http_method, user_agent,
duration,
has_wget, has_curl, has_reverse_shell
```

### dataset_ml.csv (ml_prepare.py 출력, 18컬럼 — ML 학습용)
```
시간 피처:    hour, is_night, day_of_week
네트워크:     dst_port, protocol(인코딩), source_honeypot(인코딩), event_type(인코딩)
세션:        login_success, duration, login_attempts
커맨드:      cmd_length, special_char_cnt, pipe_count
파생:        has_wget, has_curl, has_reverse_shell
정답:        is_attack (0/1), label (Etc/Recon/Brute Force/Intrusion/Malware)
```

### 라벨링 룰 (`ml_prepare.py:_rule_label`)
1. `has_reverse_shell` → **Intrusion**
2. `event_type=command` + (`has_wget` or `has_curl`) → **Malware**
3. `event_type=scan` or `protocol=PORTSCAN` → **Recon**
4. `source_honeypot=conpot` → **Recon**
5. `protocol=SMTP` → **Brute Force**
6. `login_attempts ≥ 10` → **Brute Force**
7. `source_honeypot=snare` + 웹공격 정규식 매치 → **Intrusion**
8. 나머지 → **Etc**

### MITRE ATT&CK 점수 (LLM 임계값 70)
| 시나리오 | 점수 | 기법 |
|---|---|---|
| 정상 트래픽 | 0 | — |
| 포트 스캔 | 32 | T1046 |
| 브루트포스 | 65 | T1110 |
| 크리덴셜 스터핑 | 72 | T1110.004 |
| ICS/SCADA 공격 | 76 | T1046 |
| 웹 공격 | 78 | T1190 |
| 침투 후 명령어 | 85 | T1059 |
| 멀웨어 업로드 | 92 | T1105 |
| 리버스 셸 | 95 | T1203 |

---

## 10. 트러블슈팅

### "Failed to fetch" / "ERR_CONNECTION_REFUSED"
원인: 일부 환경에서 `localhost`가 IPv6 `::1`로 해석되지만 Docker는 IPv4 `0.0.0.0`만 listen.
해결: 프론트의 fetch URL을 `http://127.0.0.1:8000` 으로 사용 (이미 적용됨).

### Cowrie `Permission denied: /tmp/cowrie_logs/cowrie.json` (Windows 바인드 마운트)
원인: cowrie는 UID 999, 호스트 마운트는 root 소유.
해결: `docker_ops.py`의 cowrie 컨테이너 정의에서 `user: "root"` 추가 (이미 적용됨).

### 데이터셋 생성 시 exit code 255
원인: `parse_logs.py`가 정상 완료해도 일부 환경에서 비정상 종료 코드 반환.
해결: `parse_logs.py` 끝에 `sys.exit(0)` 명시 + 백엔드는 CSV 파일 존재로 판단.

### Ollama 모델 다운로드 실패
```bash
docker exec honeypot-ollama ollama pull llama3.1:8b
```

### 컨테이너가 호스트 경로의 로그를 못 보는 경우
원인: Docker Desktop on Windows는 `D:/...` (직접) 와 `/mnt/d/...` (WSL2) 가 다른 9P/virtiofs 채널로 라우팅됨. 컨테이너마다 일관된 형식을 사용해야 한다.
해결: 모든 `.env`의 경로를 같은 형식으로 통일 (`/mnt/d/...` 권장).

---

## 11. 개발 워크플로

### 백엔드 코드 수정 후 재빌드
```bash
docker compose build backend && docker compose up -d backend
```

### 프론트엔드 수정 후 재빌드
```bash
docker compose build frontend && docker compose up -d frontend
```

### 로그 확인
```bash
docker compose logs -f backend frontend
docker logs honeypot-backend --tail 100
```

### 모델 파일 호스트로 추출
```bash
docker cp honeypot-backend:/app/data/ml_models/binary_model.pkl ./
docker cp honeypot-backend:/app/data/ml_models/multi_model.pkl ./
```

### DB 초기화
```bash
docker compose down -v   # 모든 볼륨 삭제 (주의: 시드 계정/이력 사라짐)
docker compose up -d --build
```

---

## 12. 라이선스 / 크레딧

- Cowrie © Michel Oosterhof (BSD)
- Heralding, OpenCanary, SNARE/Tanner, Dionaea, Mailoney, Conpot — 각 원작자 소유
- Ollama © Ollama Inc.
- 본 프로젝트는 캡스톤 디자인 과제용 학습 목적이며, 외부 노출되는 환경에서 운영하기 전 반드시 SECRET_KEY/암호/시드계정/Cowrie hostkey 등을 교체할 것.

---

## 13. 작성자 / 컨택

- 캡스톤 디자인 33팀
- 이슈/PR은 GitHub로
