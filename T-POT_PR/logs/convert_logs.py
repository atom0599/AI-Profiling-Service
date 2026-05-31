"""
T-Pot honeypot raw log → CSV converter

각 허니팟 로그 (JSONL / CSV / 커스텀 포맷) 를 읽어
logs/csv/<honeypot>.csv 로 변환한다.
.gz 로테이션 파일도 자동 포함.
"""

import csv
import gzip
import io
import json
import os
import re
import sys
from pathlib import Path

import pandas as pd

LOGS_DIR = Path(__file__).parent
CSV_DIR  = LOGS_DIR / "csv"
CSV_DIR.mkdir(exist_ok=True)


# ── helpers ──────────────────────────────────────────────────────────────────

def open_log(path: Path):
    """파일 또는 .gz 파일을 텍스트 스트림으로 열기"""
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, "r", encoding="utf-8", errors="replace")


def iter_jsonl(files):
    """여러 JSONL 파일을 순서대로 파싱해 dict 를 yield"""
    for f in files:
        with open_log(f) as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue


def jsonl_to_df(files) -> pd.DataFrame:
    """JSONL 파일 목록 → 중첩 구조 flatten DataFrame"""
    records = list(iter_jsonl(files))
    if not records:
        return pd.DataFrame()
    return pd.json_normalize(records, sep=".")


def write_csv(df: pd.DataFrame, name: str):
    out = CSV_DIR / f"{name}.csv"
    df.to_csv(out, index=False)
    print(f"  ✓  {out.name}  ({len(df):,} rows, {out.stat().st_size // 1024} KB)")


# ── per-honeypot converters ───────────────────────────────────────────────────

def convert_jsonl_simple(honeypot: str, pattern: str):
    """파일명 glob 패턴으로 JSONL 파일 모아 변환"""
    base = LOGS_DIR / honeypot / "log"
    files = sorted(base.glob(pattern))
    if not files:
        print(f"  ✗  {honeypot}: 파일 없음 ({pattern})")
        return
    df = jsonl_to_df(files)
    if df.empty:
        print(f"  ✗  {honeypot}: 빈 데이터")
        return
    write_csv(df, honeypot)


def convert_heralding():
    """이미 CSV 형식 — gz 포함 단순 concat"""
    base = LOGS_DIR / "heralding" / "log"
    files = sorted(base.glob("auth.csv*"))
    frames = []
    for f in files:
        with open_log(f) as fh:
            content = fh.read()
        try:
            frames.append(pd.read_csv(io.StringIO(content)))
        except Exception:
            continue
    if not frames:
        print("  ✗  heralding: 파일 없음")
        return
    df = pd.concat(frames, ignore_index=True).drop_duplicates()
    write_csv(df, "heralding")


def convert_honeytrap():
    """
    커스텀 포맷:
    [2026-05-05 03:12:55:723137 GMT] tcp 185.247.137.248:59841 -> 172.31.17.79:8888 hash1 hash2 (N bytes)
    """
    pattern = re.compile(
        r"\[(?P<timestamp>[^\]]+)\]\s+"
        r"(?P<proto>\S+)\s+"
        r"(?P<src_ip>[^:]+):(?P<src_port>\d+)\s+->\s+"
        r"(?P<dst_ip>[^:]+):(?P<dst_port>\d+)\s+"
        r"(?P<hash1>\S+)\s+(?P<hash2>\S+)\s+\((?P<bytes>\d+) bytes\)"
    )
    base = LOGS_DIR / "honeytrap" / "log"
    rows = []
    for f in sorted(base.glob("attacker.log*")):
        with open_log(f) as fh:
            for line in fh:
                m = pattern.search(line)
                if m:
                    rows.append(m.groupdict())
    if not rows:
        print("  ✗  honeytrap: 파싱 결과 없음")
        return
    write_csv(pd.DataFrame(rows), "honeytrap")


def convert_ciscoasa():
    """시작 메시지 + 이벤트 혼재 — 이벤트 행만 추출"""
    base = LOGS_DIR / "ciscoasa" / "log"
    rows = []
    # 이벤트 행 패턴: Feb 20 2014 00:00:04: %ASA-6-302020: ...
    event_re = re.compile(
        r"(?P<raw_time>\S+ \d+ \d+ \d+:\d+:\d+):\s+%ASA-(?P<severity>\d+)-(?P<msg_id>\d+):\s+(?P<message>.+)"
    )
    for f in sorted(base.glob("ciscoasa.log*")):
        with open_log(f) as fh:
            for line in fh:
                m = event_re.search(line)
                if m:
                    rows.append(m.groupdict())
    if not rows:
        print("  ✗  ciscoasa: 이벤트 행 없음")
        return
    write_csv(pd.DataFrame(rows), "ciscoasa")


def convert_sentrypeer():
    """JSON — sip_message 컬럼은 길어서 제거"""
    base = LOGS_DIR / "sentrypeer" / "log"
    files = [f for f in sorted(base.glob("sentrypeer*.json*"))
             if not f.suffix in {".pem", ".db"}]
    df = jsonl_to_df(files)
    if df.empty:
        print("  ✗  sentrypeer: 빈 데이터")
        return
    if "sip_message" in df.columns:
        df = df.drop(columns=["sip_message"])
    write_csv(df, "sentrypeer")


# ── main ──────────────────────────────────────────────────────────────────────

CONVERTERS = {
    "cowrie":        lambda: convert_jsonl_simple("cowrie",        "cowrie.json*"),
    "adbhoney":      lambda: convert_jsonl_simple("adbhoney",      "adbhoney.json*"),
    "dionaea":       lambda: convert_jsonl_simple("dionaea",       "dionaea.json*"),
    "suricata":      lambda: convert_jsonl_simple("suricata",      "eve.json*"),
    "conpot":        lambda: convert_jsonl_simple("conpot",        "*.json*"),
    "elasticpot":    lambda: convert_jsonl_simple("elasticpot",    "elasticpot.json*"),
    "p0f":           lambda: convert_jsonl_simple("p0f",           "p0f.json*"),
    "fatt":          lambda: convert_jsonl_simple("fatt",          "fatt.log*"),
    "mailoney":      lambda: convert_jsonl_simple("mailoney",      "commands.log*"),
    "miniprint":     lambda: convert_jsonl_simple("miniprint",     "miniprint.json*"),
    "h0neytr4p":     lambda: convert_jsonl_simple("h0neytr4p",     "log.json*"),
    "honeyaml":      lambda: convert_jsonl_simple("honeyaml",      "honeyaml.log*"),
    "ipphoney":      lambda: convert_jsonl_simple("ipphoney",      "ipphoney.json*"),
    "redishoneypot": lambda: convert_jsonl_simple("redishoneypot", "redishoneypot.log*"),
    "tanner":        lambda: convert_jsonl_simple("tanner",        "tanner_report.json*"),
    "heralding":     convert_heralding,
    "honeytrap":     convert_honeytrap,
    "ciscoasa":      convert_ciscoasa,
    "sentrypeer":    convert_sentrypeer,
}


if __name__ == "__main__":
    targets = sys.argv[1:] or list(CONVERTERS.keys())
    print(f"변환 대상: {len(targets)}개 허니팟 → {CSV_DIR}\n")
    for name in targets:
        if name not in CONVERTERS:
            print(f"  ?  {name}: 알 수 없는 허니팟")
            continue
        print(f"[{name}]")
        try:
            CONVERTERS[name]()
        except Exception as e:
            print(f"  ✗  오류: {e}")
    print("\n완료")
