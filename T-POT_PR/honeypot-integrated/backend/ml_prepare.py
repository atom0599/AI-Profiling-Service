"""
데이터셋 전처리 파이프라인 (백엔드 내장 버전)
scripts/label_data.py + scripts/feature_engineering.py 로직을 합친 것.

입력:  /honeypot_logs/{username}/dataset.csv
출력:  /honeypot_logs/{username}/dataset_ml.csv
       /honeypot_logs/{username}/dataset_ml_encoders.json  (ml_service 인코더용)
"""

import csv
import json
import re
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

SPECIAL_RE = re.compile(r'[|;&><$`\\]')
WEB_ATTACK_RE = re.compile(
    r"(?i)("
    r"union\s+select|select\s+.+from|or\s+1\s*=\s*1|and\s+1\s*=\s*1"
    r"|<script|javascript:|onerror=|onload="
    r"|\.\./|\.\.\\|etc/passwd|/proc/"
    r"|cmd=|exec=|system\(|passthru\(|eval\("
    r"|wget\s|curl\s|nc\s|bash\s+-[ci]"
    r"|phpinfo\(\)|base64_decode"
    r")"
)

ALL_LABELS = ["Etc", "Recon", "Brute Force", "Intrusion", "Malware"]

OUT_FIELDS = [
    "hour", "is_night", "day_of_week",
    "dst_port", "protocol", "source_honeypot", "event_type",
    "login_success", "duration", "login_attempts",
    "cmd_length", "special_char_cnt", "pipe_count",
    "has_wget", "has_curl", "has_reverse_shell",
    "is_attack", "label",
]


# ── 타임스탬프 ──────────────────────────────────────────────────────────────

def _parse_ts(ts_str: str):
    if not ts_str:
        return None
    for fmt in [
        "%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S",
    ]:
        try:
            dt = datetime.strptime(ts_str, fmt)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except ValueError:
            pass
    try:
        dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except ValueError:
        return None


# ── Rule-based 레이블 ───────────────────────────────────────────────────────

def _rule_label(row: dict) -> str:
    def intval(k):
        try:
            return int(row.get(k, 0) or 0)
        except (ValueError, TypeError):
            return 0

    proto   = str(row.get("protocol", "")).upper()
    src_hp  = str(row.get("source_honeypot", ""))
    ev_type = str(row.get("event_type", ""))

    if intval("has_reverse_shell") or intval("derived_has_reverse_shell"):
        return "Intrusion"
    if ev_type == "command" and (intval("has_wget") or intval("has_curl") or
                                  intval("derived_has_wget") or intval("derived_has_curl")):
        return "Malware"
    if ev_type == "scan" or proto == "PORTSCAN":
        return "Recon"
    if src_hp == "conpot":
        return "Recon"
    if proto == "SMTP":
        return "Brute Force"
    if intval("login_attempts") >= 10:
        return "Brute Force"
    if src_hp == "snare":
        cmd = row.get("command", "") or ""
        if WEB_ATTACK_RE.search(cmd):
            return "Intrusion"
    return "Etc"


def _is_attack(label: str) -> int:
    return 0 if label == "Etc" else 1


# ── 인코더 ─────────────────────────────────────────────────────────────────

def _build_encoder(values) -> dict:
    unique = sorted(set(v for v in values if v))
    return {v: i for i, v in enumerate(unique)}


def _encode(enc: dict, val: str) -> int:
    return enc.get(val, 0)


# ── 메인 파이프라인 ─────────────────────────────────────────────────────────

def prepare(log_root: str, username: str) -> dict:
    """
    dataset.csv → label → feature_engineer → dataset_ml.csv

    Returns dict with keys: ok, n_rows, n_attack, n_normal, out_path, error
    """
    base = Path(log_root) / username
    in_path  = base / "dataset.csv"
    out_path = base / "dataset_ml.csv"
    enc_path = base / "dataset_ml_encoders.json"

    # 전역 dataset.csv도 탐색
    if not in_path.exists():
        in_path  = Path(log_root) / "dataset.csv"
        out_path = Path(log_root) / "dataset_ml.csv"
        enc_path = Path(log_root) / "dataset_ml_encoders.json"

    if not in_path.exists():
        return {"ok": False, "error": f"dataset.csv 없음: {base}/dataset.csv"}

    try:
        with open(in_path, encoding="utf-8") as f:
            raw = list(csv.DictReader(f))
    except Exception as e:
        return {"ok": False, "error": f"dataset.csv 읽기 실패: {e}"}

    if not raw:
        return {"ok": False, "error": "dataset.csv가 비어 있습니다."}

    logger.info(f"[prepare] {username}: {len(raw)}행 로드")

    # 인코더
    protocol_enc = _build_encoder(r.get("protocol", "") for r in raw)
    honeypot_enc = _build_encoder(r.get("source_honeypot", "") for r in raw)
    event_enc    = _build_encoder(r.get("event_type", "") for r in raw)

    out_rows = []
    for row in raw:
        # 시간 피처
        ts_str = row.get("timestamp", "")
        dt = _parse_ts(ts_str)
        if dt:
            hour = dt.hour
            is_night = 1 if (hour >= 22 or hour < 6) else 0
            dow = dt.weekday()
        else:
            hour = is_night = dow = 0

        # 커맨드 피처
        cmd = row.get("command", "") or ""
        cmd_length       = len(cmd)
        special_char_cnt = len(SPECIAL_RE.findall(cmd))
        pipe_count       = cmd.count("|")

        # 수치형
        try: dst_port       = int(row.get("dst_port") or 0)
        except: dst_port = 0
        try: login_success  = int(row.get("login_success") or 0)
        except: login_success = 0
        try: login_attempts = int(row.get("login_attempts") or 0)
        except: login_attempts = 0
        try: duration       = float(row.get("duration") or 0.0)
        except: duration = 0.0

        # 파생 피처 (parse_logs에서 derived_ 접두어로 저장될 수 있음)
        has_wget     = int(row.get("has_wget") or row.get("derived_has_wget") or 0)
        has_curl     = int(row.get("has_curl") or row.get("derived_has_curl") or 0)
        has_revshell = int(row.get("has_reverse_shell") or row.get("derived_has_reverse_shell") or 0)

        label = row.get("label") or _rule_label(row)
        is_atk = _is_attack(label)

        out_rows.append({
            "hour":             hour,
            "is_night":         is_night,
            "day_of_week":      dow,
            "dst_port":         dst_port,
            "protocol":         _encode(protocol_enc, row.get("protocol", "")),
            "source_honeypot":  _encode(honeypot_enc, row.get("source_honeypot", "")),
            "event_type":       _encode(event_enc,    row.get("event_type", "")),
            "login_success":    login_success,
            "duration":         duration,
            "login_attempts":   login_attempts,
            "cmd_length":       cmd_length,
            "special_char_cnt": special_char_cnt,
            "pipe_count":       pipe_count,
            "has_wget":         has_wget,
            "has_curl":         has_curl,
            "has_reverse_shell": has_revshell,
            "is_attack":        is_atk,
            "label":            label,
        })

    # CSV 출력
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        writer.writeheader()
        writer.writerows(out_rows)

    # 인코더 저장 (ml_service가 읽는 경로 = ml_models/encoders.json 는 학습 시 자동 저장)
    enc_data = {
        "protocol":        protocol_enc,
        "source_honeypot": honeypot_enc,
        "event_type":      event_enc,
    }
    with open(enc_path, "w", encoding="utf-8") as f:
        json.dump(enc_data, f, ensure_ascii=False, indent=2)

    n_attack = sum(1 for r in out_rows if r["is_attack"] == 1)
    n_normal = len(out_rows) - n_attack

    label_counts = {}
    for r in out_rows:
        label_counts[r["label"]] = label_counts.get(r["label"], 0) + 1

    logger.info(f"[prepare] {username}: dataset_ml.csv {len(out_rows)}행 생성 (공격={n_attack}, 정상={n_normal})")

    return {
        "ok":           True,
        "n_rows":       len(out_rows),
        "n_attack":     n_attack,
        "n_normal":     n_normal,
        "label_counts": label_counts,
        "out_path":     str(out_path),
    }
