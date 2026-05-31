"""
ML 분류 서비스
- 이진분류: 정상(0) / 악성(1)
- 다중분류: Etc / Recon / Brute Force / Intrusion / Malware
- MITRE ATT&CK 점수 → 임계값 이상만 LLM 2차 분석
"""

import os
import re
import json
import logging
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import joblib
import numpy as np

logger = logging.getLogger(__name__)

MODEL_DIR = Path(os.getenv("DB_DIR", "/app/data")) / "ml_models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)

BINARY_PATH  = MODEL_DIR / "binary_model.pkl"
MULTI_PATH   = MODEL_DIR / "multi_model.pkl"
ENCODER_PATH = MODEL_DIR / "encoders.json"
METRICS_PATH = MODEL_DIR / "metrics.json"

LLM_THRESHOLD = int(os.getenv("ML_LLM_THRESHOLD", "70"))

# MITRE ATT&CK 점수 (시나리오명 기준)
MITRE_SCORES: dict[str, int] = {
    "정상 트래픽":     0,
    "포트 스캔":      32,   # T1046
    "브루트포스":     65,   # T1110
    "웹 공격":        78,   # T1190
    "침투 후 명령어":  85,   # T1059
    "리버스 셸":      95,   # T1203
    "멀웨어 업로드":   92,   # T1105
    "크리덴셜 스터핑": 72,   # T1110.004
    "ICS/SCADA 공격": 76,   # T1046
}

# 시나리오명 → 다중분류 레이블 (rule-based fallback)
RULE_CLASS: dict[str, str] = {
    "정상 트래픽":     "Etc",
    "포트 스캔":      "Recon",
    "브루트포스":     "Brute Force",
    "웹 공격":        "Intrusion",
    "침투 후 명령어":  "Intrusion",
    "리버스 셸":      "Intrusion",
    "멀웨어 업로드":   "Malware",
    "크리덴셜 스터핑": "Brute Force",
    "ICS/SCADA 공격": "Recon",
}

# 피처 순서 (feature_engineering.py 출력과 동일하게)
FEATURE_COLS = [
    "hour", "is_night", "day_of_week",
    "dst_port", "protocol", "source_honeypot", "event_type",
    "login_success", "duration", "login_attempts",
    "cmd_length", "special_char_cnt", "pipe_count",
    "has_wget", "has_curl", "has_reverse_shell",
]

# 시나리오명 → 인코딩 기본값 (인코더 없을 때 사용)
_SCENARIO_PROTO = {
    "정상 트래픽": "SSH", "포트 스캔": "PORTSCAN", "브루트포스": "SSH",
    "웹 공격": "HTTP", "침투 후 명령어": "SSH", "리버스 셸": "SSH",
    "멀웨어 업로드": "FTP", "크리덴셜 스터핑": "SSH", "ICS/SCADA 공격": "MODBUS",
}
_SCENARIO_HONEYPOT = {
    "정상 트래픽": "heralding", "포트 스캔": "opencanary", "브루트포스": "cowrie",
    "웹 공격": "snare", "침투 후 명령어": "cowrie", "리버스 셸": "cowrie",
    "멀웨어 업로드": "dionaea", "크리덴셜 스터핑": "heralding", "ICS/SCADA 공격": "conpot",
}
_SCENARIO_EVENT = {
    "정상 트래픽": "auth", "포트 스캔": "scan", "브루트포스": "auth",
    "웹 공격": "session", "침투 후 명령어": "command", "리버스 셸": "command",
    "멀웨어 업로드": "session", "크리덴셜 스터핑": "auth", "ICS/SCADA 공격": "scan",
}
_SCENARIO_PORT = {
    "정상 트래픽": 22, "포트 스캔": 0, "브루트포스": 22,
    "웹 공격": 80, "침투 후 명령어": 22, "리버스 셸": 22,
    "멀웨어 업로드": 21, "크리덴셜 스터핑": 3306, "ICS/SCADA 공격": 502,
}

_SPECIAL_RE = re.compile(r'[|;&><$`\\]')

_binary_model = None
_multi_model  = None
_encoders: dict = {}
_metrics: dict  = {}
_lock = threading.Lock()
_training = False
_train_log: list[str] = []


def _log(msg: str):
    _train_log.append(f"[{datetime.utcnow().strftime('%H:%M:%S')}] {msg}")
    logger.info(f"[ml] {msg}")


def _encode(enc_map: dict, val: str) -> int:
    return enc_map.get(val, 0)


def extract_features(attack_type: str, payload: str, ts: Optional[datetime] = None) -> list:
    """공격 로그 → 피처 벡터 (FEATURE_COLS 순서)."""
    now = ts or datetime.utcnow()
    payload = payload or ""

    hour        = now.hour
    is_night    = 1 if hour >= 22 or hour < 6 else 0
    dow         = now.weekday()
    dst_port    = _SCENARIO_PORT.get(attack_type, 0)

    with _lock:
        enc = _encoders
    proto_map   = enc.get("protocol", {})
    hp_map      = enc.get("source_honeypot", {})
    ev_map      = enc.get("event_type", {})

    protocol       = _encode(proto_map,  _SCENARIO_PROTO.get(attack_type, ""))
    source_hp      = _encode(hp_map,     _SCENARIO_HONEYPOT.get(attack_type, ""))
    event_type     = _encode(ev_map,     _SCENARIO_EVENT.get(attack_type, ""))

    cmd_length       = len(payload)
    special_char_cnt = len(_SPECIAL_RE.findall(payload))
    pipe_count       = payload.count("|")
    has_wget         = int("wget"   in payload.lower())
    has_curl         = int("curl"   in payload.lower())
    has_revshell     = int(any(k in payload.lower() for k in ["bash -i", "/dev/tcp", "nc -e", "mkfifo", "ncat"]))
    login_attempts   = payload.lower().count("attempt") + payload.lower().count("login")

    return [
        hour, is_night, dow,
        dst_port, protocol, source_hp, event_type,
        0, 0.0, login_attempts,
        cmd_length, special_char_cnt, pipe_count,
        has_wget, has_curl, has_revshell,
    ]


def classify(attack_type: str, payload: str) -> dict:
    """1차 ML 분류 → MITRE 점수 → LLM 필요 여부 반환."""
    feats = extract_features(attack_type, payload)
    X = np.array([feats])

    with _lock:
        b_model = _binary_model
        m_model = _multi_model

    # 이진분류
    is_attack = 1
    binary_conf = 100.0
    model_used = "rule"
    if b_model is not None:
        try:
            is_attack   = int(b_model.predict(X)[0])
            binary_conf = round(float(b_model.predict_proba(X)[0][is_attack]) * 100, 1)
            model_used  = "ml"
        except Exception as e:
            logger.warning(f"[ml] binary classify error: {e}")

    # 다중분류
    attack_class = RULE_CLASS.get(attack_type, "Etc")
    multi_conf   = 100.0
    if m_model is not None:
        try:
            attack_class = str(m_model.predict(X)[0])
            multi_conf   = round(float(max(m_model.predict_proba(X)[0])) * 100, 1)
        except Exception as e:
            logger.warning(f"[ml] multi classify error: {e}")

    # MITRE 점수 (악성일 때만)
    mitre_score = MITRE_SCORES.get(attack_type, 50) if is_attack else 0

    return {
        "is_attack":        is_attack,
        "binary_conf":      binary_conf,
        "attack_class":     attack_class,
        "multi_conf":       multi_conf,
        "mitre_score":      mitre_score,
        "needs_llm":        is_attack == 1 and mitre_score >= LLM_THRESHOLD,
        "model_used":       model_used,
    }


def load_models() -> bool:
    """저장된 모델 파일 로드."""
    global _binary_model, _multi_model, _encoders, _metrics
    loaded = False
    try:
        if ENCODER_PATH.exists():
            with open(ENCODER_PATH, encoding="utf-8") as f:
                enc = json.load(f)
            with _lock:
                _encoders = enc
        if BINARY_PATH.exists():
            with _lock:
                _binary_model = joblib.load(BINARY_PATH)
            _log(f"binary_model 로드 완료: {BINARY_PATH}")
            loaded = True
        if MULTI_PATH.exists():
            with _lock:
                _multi_model = joblib.load(MULTI_PATH)
            _log(f"multi_model 로드 완료: {MULTI_PATH}")
            loaded = True
        if METRICS_PATH.exists():
            with open(METRICS_PATH, encoding="utf-8") as f:
                with _lock:
                    _metrics = json.load(f)
    except Exception as e:
        logger.error(f"[ml] 모델 로드 실패: {e}")
    return loaded


def save_uploaded_model(model_type: str, data: bytes) -> bool:
    """업로드된 .pkl 파일 저장 및 로드."""
    global _binary_model, _multi_model
    path = BINARY_PATH if model_type == "binary" else MULTI_PATH
    try:
        path.write_bytes(data)
        model = joblib.load(path)
        with _lock:
            if model_type == "binary":
                _binary_model = model
            else:
                _multi_model = model
        _log(f"{model_type} 모델 업로드 및 로드 완료")
        return True
    except Exception as e:
        logger.error(f"[ml] 모델 업로드 실패: {e}")
        return False


def train_from_dataset(dataset_ml_path: str) -> dict:
    """dataset_ml.csv로 이진/다중 모델 학습."""
    global _binary_model, _multi_model, _encoders, _metrics, _training, _train_log
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import accuracy_score, classification_report

    _train_log = []
    _training  = True

    try:
        _log("dataset_ml.csv 로드 중...")
        df = pd.read_csv(dataset_ml_path)
        _log(f"데이터 로드 완료: {len(df)}행")

        if "is_attack" not in df.columns:
            raise ValueError("is_attack 컬럼이 없습니다. label_data.py를 먼저 실행하세요.")

        # 인코더 저장 (피처 컬럼에서 카테고리 역추적은 feature_engineering.py에서 이미 처리됨)
        if ENCODER_PATH.exists():
            with open(ENCODER_PATH, encoding="utf-8") as f:
                enc = json.load(f)
            with _lock:
                _encoders = enc
            _log("인코더 로드 완료")

        available = [c for c in FEATURE_COLS if c in df.columns]
        missing   = [c for c in FEATURE_COLS if c not in df.columns]
        if missing:
            _log(f"누락 컬럼 (0으로 채움): {missing}")
            for c in missing:
                df[c] = 0

        X = df[FEATURE_COLS].fillna(0).values
        y_binary = df["is_attack"].values
        _log(f"피처: {len(available)}/{len(FEATURE_COLS)} 사용  |  공격:{y_binary.sum()}  정상:{(y_binary==0).sum()}")

        # ── 이진분류 ──────────────────────────────────────────────────────
        _log("이진분류 모델 학습 중...")
        X_tr, X_te, y_tr, y_te = train_test_split(X, y_binary, test_size=0.2, random_state=42, stratify=y_binary)
        clf_b = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
        clf_b.fit(X_tr, y_tr)
        b_acc = round(accuracy_score(y_te, clf_b.predict(X_te)) * 100, 1)
        _log(f"이진분류 정확도: {b_acc}%")

        # ── 다중분류 ──────────────────────────────────────────────────────
        multi_acc = None
        clf_m = None
        if "label" in df.columns:
            _log("다중분류 모델 학습 중...")
            y_multi = df["label"].values
            Xm_tr, Xm_te, ym_tr, ym_te = train_test_split(X, y_multi, test_size=0.2, random_state=42, stratify=y_multi)
            clf_m = RandomForestClassifier(n_estimators=100, class_weight="balanced", random_state=42, n_jobs=-1)
            clf_m.fit(Xm_tr, ym_tr)
            multi_acc = round(accuracy_score(ym_te, clf_m.predict(Xm_te)) * 100, 1)
            _log(f"다중분류 정확도: {multi_acc}%")
        else:
            _log("label 컬럼 없음 — 다중분류 학습 생략")

        # ── 저장 ─────────────────────────────────────────────────────────
        joblib.dump(clf_b, BINARY_PATH)
        with _lock:
            _binary_model = clf_b
        if clf_m is not None:
            joblib.dump(clf_m, MULTI_PATH)
            with _lock:
                _multi_model = clf_m

        metrics = {
            "binary_acc":    b_acc,
            "multi_acc":     multi_acc,
            "trained_at":    datetime.utcnow().isoformat(),
            "n_samples":     len(df),
            "n_features":    len(FEATURE_COLS),
            "binary_report": classification_report(y_te, clf_b.predict(X_te), output_dict=True),
        }
        if clf_m is not None:
            metrics["multi_report"] = classification_report(ym_te, clf_m.predict(Xm_te), output_dict=True)

        with open(METRICS_PATH, "w", encoding="utf-8") as f:
            json.dump(metrics, f, ensure_ascii=False, indent=2)
        with _lock:
            _metrics = metrics

        _log("모델 저장 완료 ✓")
        return {"ok": True, "binary_acc": b_acc, "multi_acc": multi_acc, "n_samples": len(df)}

    except Exception as e:
        _log(f"학습 실패: {e}")
        logger.error(f"[ml] train error: {e}", exc_info=True)
        return {"ok": False, "error": str(e)}
    finally:
        _training = False


def get_status() -> dict:
    with _lock:
        b = _binary_model is not None
        m = _multi_model  is not None
        mt = dict(_metrics)
    return {
        "binary_loaded": b,
        "multi_loaded":  m,
        "training":      _training,
        "metrics":       mt,
        "llm_threshold": LLM_THRESHOLD,
        "train_log":     list(_train_log[-30:]),
    }
