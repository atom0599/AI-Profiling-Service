# 아키텍처 변화: 기존 vs T-Pot 연동 확장

## 1. 한눈에 보는 차이

| 항목 | 기존 구조 | T-Pot 연동 확장 |
|------|-----------|----------------|
| 허니팟 수 | 7개 (로컬 Docker) | 30개+ (T-Pot HIVE) |
| 공격 트래픽 | 내부망 시뮬레이션 (Kali) | 실제 인터넷 공격자 |
| 데이터 규모 | 수천~수만 행 (시뮬레이션) | 수십만 행/일 (실제) |
| 인프라 | 단일 로컬 Docker Compose | AWS EC2 + 로컬 플랫폼 분리 |
| LLM 역할 | 로그 분석 보조 | 허니팟 자체 + 로그 분석 이중 활용 |
| 오픈소스 기여 | 독립 프로젝트 | T-Pot PR 기여 가능 |

---

## 2. 기존 구조

```
로컬 머신 (Docker Compose)
│
├── Kali Linux 컨테이너 ──────────────────────────────────┐
│   └── 공격 시나리오 스크립트 (.sh)                       │ 시뮬레이션
│                                                         │ 공격 트래픽
├── 허니팟 컨테이너 (7개) ←─────────────────────────────────┘
│   ├── Cowrie       (SSH/Telnet)       172.30.0.10
│   ├── Heralding    (다중 프로토콜)    172.30.0.11
│   ├── OpenCanary   (네트워크 서비스)  172.30.0.12
│   ├── SNARE/Tanner (웹)              172.30.0.13
│   ├── Dionaea      (SMB/멀웨어)      172.30.0.14
│   ├── Mailoney     (SMTP)            172.30.0.15
│   └── Conpot       (ICS/SCADA)       172.30.0.16
│
├── FastAPI Backend (:8000)
│   ├── parse_logs.py      → dataset.csv (로그 파싱)
│   ├── ml_train.py        → *.pkl (모델 학습)
│   ├── ml_predict.py      → 공격 분류
│   └── ollama_analyze.py  → LLM 분석 리포트
│
├── Ollama (gemma3)
│   └── 공격 로그 자연어 분석
│
├── Spring Boot Profiling (:8090)
│   └── 공격자 행동 프로파일링
│
└── Next.js Frontend (:8001)
    ├── 허니팟 대시보드
    ├── ML 학습/예측 UI
    └── LLM 분석 리포트 뷰
```

**한계점**:
- Kali 시뮬레이션 트래픽은 패턴이 단조롭고 실제 공격과 다름
- 7개 허니팟만 커버 → 수집 가능한 공격 유형 제한
- 로컬 환경이라 24시간 운영 부담
- ML 모델 학습 데이터 다양성 부족

---

## 3. T-Pot 연동 확장 구조

```
인터넷 (실제 공격자)
│
▼
AWS EC2 t3a.xlarge (T-Pot HIVE 24.04)
│
├── 허니팟 30개+ (실제 인터넷 노출)
│   ├── Cowrie / Heralding / Conpot / Mailoney
│   ├── SNARE / Dionaea / OpenCanary
│   ├── Log4Pot / Honeytrap / Glutton
│   ├── ADBHoney / CitrixHoneypot
│   ├── Beelzebub (LLM SSH) / Galah (LLM HTTP)  ← LLM 허니팟
│   └── ... 20개+
│
├── Elasticsearch + Logstash + Kibana
│   ├── 로그 실시간 수집/저장
│   └── :64297 (Kibana Web UI)
│
└── 로그 파일 (/data/tpot/log/)
    ├── cowrie/
    ├── heralding/
    ├── conpot/
    └── ...
         │
         │  SSH scp / API 연동
         ▼
로컬 Honeypot Integrated Platform
│
├── FastAPI Backend (:8000)
│   ├── parse_logs.py      → dataset.csv
│   ├── ml_train.py        → *.pkl
│   ├── ml_predict.py      → 공격 분류
│   └── ollama_analyze.py  → LLM 분석 리포트  ← 실데이터 기반
│
├── Ollama (gemma3)
│   └── 실제 공격 의도/패턴 자연어 분석
│
├── Spring Boot Profiling (:8090)
│   └── 실제 공격자 행동 프로파일링
│
└── Next.js Frontend (:8001)
    ├── T-Pot 연동 현황 대시보드
    ├── ML 학습/예측 UI (실데이터 기반)
    └── LLM 분석 리포트 뷰
```

---

## 4. 핵심 차이점 상세

### 4-1. 데이터 수집 방식

| | 기존 | 확장 |
|--|------|------|
| 공격 소스 | Kali (스크립트 자동화) | 전 세계 실제 공격자 |
| 데이터 다양성 | 낮음 (정해진 시나리오) | 높음 (예측 불가 공격) |
| 수집 허니팟 | 7개 | 30개+ |
| 운영 환경 | 로컬 내부망 | AWS 공인 IP 노출 |
| 로그 볼륨 | 수만 행 | 수십만~수백만 행/주 |

### 4-2. LLM 활용 방식

**기존**: 로그 → LLM 분석 (사후 분석만)

**확장**: 두 단계 LLM 활용
1. **T-Pot 내 LLM 허니팟** (Beelzebub/Galah)
   - 공격자와 실시간 대화하며 더 많은 정보 수집
   - 공격 TTPs(전술/기술/절차) 심층 파악
2. **플랫폼 내 Ollama 분석**
   - 수집된 대화 로그까지 포함한 종합 분석
   - 공격 캠페인 단위 패턴 리포트 생성

### 4-3. ML 모델 품질

| | 기존 | 확장 |
|--|------|------|
| 학습 데이터 | 시뮬레이션 13,653행 | 실제 공격 수십만 행+ |
| 클래스 불균형 | Recon 편중 | 다양한 공격 유형 균형 |
| 모델 정확도 | 시뮬레이션 한계 | 실세계 일반화 가능 |
| 신규 공격 패턴 | 반영 어려움 | 지속 업데이트 가능 |

### 4-4. 인프라 분리

```
기존: 단일 머신
  로컬 PC ─── 모든 것 (허니팟 + 분석 + UI)

확장: 역할 분리
  AWS EC2    ─── 허니팟 + 로그 수집 (T-Pot)
  로컬 PC    ─── 분석 + ML + UI (Integrated Platform)
```

---

## 5. T-Pot PR 기여 계획

T-Pot은 오픈소스 (Apache 2.0, Telekom Security 운영)
- GitHub: https://github.com/telekom-security/tpotce

### 기여 가능 영역

| 기여 항목 | 내용 | 난이도 |
|-----------|------|--------|
| ML 분류 컨테이너 | 공격 자동 분류 사이드카 추가 | 중 |
| LLM 분석 컨테이너 | Ollama 기반 공격 의도 분석 | 중~고 |
| 한국어 Kibana 대시보드 | `.ndjson` 형태로 기여 | 하 |
| 통합 파서 개선 | parse_logs.py upstream 반영 | 하~중 |

### 기여 순서 (권장)

```
1단계: T-Pot으로 실제 데이터 수집 (1~2주)
   ↓
2단계: ML 모델 성능 개선 (실데이터 기반 재학습)
   ↓
3단계: LLM 분석 모듈 독립 컨테이너로 분리
   ↓
4단계: T-Pot GitHub Issue에 제안 → 피드백
   ↓
5단계: PR 작성 (영어 문서화 포함)
```

---

## 6. 로그 연동 방법 (T-Pot → 로컬 플랫폼)

### 방법 A: SCP 주기적 수집 (단기)
```bash
# 로컬에서 실행 (cron 등록 권장)
scp -i ~/tpot-key.pem -P 64295 \
  ubuntu@54.144.217.205:/data/tpot/log/... \
  /mnt/d/honeypot_logs/
```

### 방법 B: T-Pot Elasticsearch API (중기)
```python
# T-Pot Elasticsearch에서 직접 쿼리
GET https://54.144.217.205:64298/logstash-*/_search
```

### 방법 C: 실시간 Logstash 포워딩 (장기/PR 기여)
```yaml
# T-Pot docker-compose에 forwarder 추가
logstash-forwarder:
  output:
    - type: http
      url: http://<로컬플랫폼>/api/logs/ingest
```

---

## 7. 파일 구조 변화

### 기존
```
honeypot-integrated/
├── backend/
│   ├── parse_logs.py        # 7개 허니팟 파서
│   ├── ml_train.py
│   └── main.py
├── frontend/
├── honeypots/               # 로컬 허니팟 설정
│   ├── cowrie/
│   ├── heralding/
│   └── ...
└── docker-compose.yml       # 단일 compose
```

### 확장 후 (예정)
```
honeypot-integrated/
├── backend/
│   ├── parse_logs.py        # T-Pot 로그 포맷 추가
│   ├── ml_train.py
│   ├── tpot_sync.py         # T-Pot 로그 수집 스크립트 (신규)
│   └── main.py
├── frontend/
├── honeypots/               # 로컬 허니팟 (개발/테스트용 유지)
├── tpot/                    # T-Pot 연동 설정 (신규)
│   ├── logstash-forwarder/
│   └── kibana-dashboards/   # 한국어 대시보드 (.ndjson)
└── docker-compose.yml
```
