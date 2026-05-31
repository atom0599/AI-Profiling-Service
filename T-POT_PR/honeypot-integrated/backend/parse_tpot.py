#!/usr/bin/env python3
"""
parse_tpot.py — T-Pot Elasticsearch 추출 JSON → dataset.csv 변환
사용법: python3 parse_tpot.py
입력:  /mnt/d/honeypot_logs/tpot/tpot_*.json
출력:  /mnt/d/honeypot_logs/tpot/tpot_dataset.csv
"""

import csv
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

TPOT_DIR = Path("/mnt/d/honeypot_logs/tpot")
OUT_FILE = TPOT_DIR / "tpot_dataset.csv"
OUT_RAW  = TPOT_DIR / "tpot_raw.csv"
INGEST_TIME = datetime.now(timezone.utc).isoformat()
PARSER_VERSION = "tpot-1.0"

FIELDS = [
    "event_id", "session_id", "seq_no", "session_seq_no",
    "timestamp", "ingest_time",
    "src_ip", "src_port", "dst_ip", "dst_port", "transport",
    "protocol", "source_honeypot", "event_type", "event_result",
    "username", "password", "login_success", "attempt_no",
    "duration", "login_attempts",
    "http_method", "http_path", "http_query",
    "command",
    "derived_has_wget", "derived_has_curl", "derived_has_reverse_shell",
    "parser_version",
]

def empty():
    return {f: "" for f in FIELDS}

def ts(doc):
    return doc.get("@timestamp", "")

def ip(doc, *keys):
    for k in keys:
        v = doc.get(k, "")
        if v:
            return str(v)
    return ""

def port(doc, *keys):
    for k in keys:
        v = doc.get(k, "")
        if v not in ("", None):
            return str(v)
    return ""

def derive_cmd(cmd):
    cmd = str(cmd).lower()
    has_wget = "1" if "wget" in cmd else "0"
    has_curl = "1" if "curl" in cmd else "0"
    has_rev = "1" if any(
        x in cmd for x in ["bash -i", "/dev/tcp", "nc -e", "mkfifo"]
    ) else "0"
    return has_wget, has_curl, has_rev


def parse_cowrie(docs):
    rows = []
    for doc in docs:
        r = empty()
        eid = doc.get("eventid", "")
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = doc.get("session", "")
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "src_ip")
        r["src_port"] = port(doc, "src_port")
        r["dst_ip"] = ip(doc, "dest_ip", "dst_ip")
        r["dst_port"] = port(doc, "dest_port", "dst_port")
        r["transport"] = "TCP"
        r["protocol"] = "SSH"
        r["source_honeypot"] = "cowrie"
        r["parser_version"] = PARSER_VERSION

        if "login" in eid:
            r["event_type"] = "auth"
            r["username"] = doc.get("username", "")
            r["password"] = doc.get("password", "")
            r["login_success"] = "1" if "success" in eid else "0"
            r["event_result"] = "success" if "success" in eid else "fail"
        elif "command" in eid:
            r["event_type"] = "command"
            r["event_result"] = "executed"
            cmd = doc.get("input", "")
            r["command"] = cmd
            r["derived_has_wget"], r["derived_has_curl"], r["derived_has_reverse_shell"] = derive_cmd(cmd)
        elif "session" in eid:
            r["event_type"] = "session"
            r["event_result"] = "closed"
            r["duration"] = str(doc.get("duration", ""))
        else:
            r["event_type"] = "session"

        rows.append(r)
    return rows


def parse_honeytrap(docs):
    rows = []
    for doc in docs:
        r = empty()
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = doc.get("id", str(uuid.uuid4()))
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "src_ip", "source.ip")
        r["src_port"] = port(doc, "src_port", "source.port")
        r["dst_ip"] = ip(doc, "dest_ip", "destination.ip")
        r["dst_port"] = port(doc, "dest_port", "destination.port")
        proto = str(doc.get("proto", doc.get("transport", "TCP"))).upper()
        r["transport"] = proto
        r["protocol"] = str(doc.get("dest_port", "")).strip() or "UNKNOWN"
        r["source_honeypot"] = "honeytrap"
        r["event_type"] = "session"
        r["event_result"] = "detected"
        r["parser_version"] = PARSER_VERSION
        payload = doc.get("payload", "")
        if payload:
            r["command"] = str(payload)[:500]
        rows.append(r)
    return rows


def parse_dionaea(docs):
    rows = []
    for doc in docs:
        r = empty()
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = doc.get("connection", str(uuid.uuid4()))
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "src_ip", "remote_host")
        r["src_port"] = port(doc, "src_port", "remote_port")
        r["dst_ip"] = ip(doc, "dst_ip", "local_host")
        r["dst_port"] = port(doc, "dst_port", "local_port")
        r["transport"] = "TCP"
        conn_type = str(doc.get("connection_type", "")).upper()
        r["protocol"] = conn_type or "SMB"
        r["source_honeypot"] = "dionaea"
        r["event_type"] = "session"
        r["event_result"] = "detected"
        r["parser_version"] = PARSER_VERSION
        malware = doc.get("sha512", doc.get("md5", ""))
        if malware:
            r["event_type"] = "malware"
            r["command"] = malware
        rows.append(r)
    return rows


def parse_tanner(docs):
    rows = []
    for doc in docs:
        r = empty()
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = doc.get("sess_uuid", str(uuid.uuid4()))
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "peer.ip", "src_ip")
        r["src_port"] = port(doc, "peer.port", "src_port")
        r["dst_port"] = "80"
        r["transport"] = "TCP"
        r["protocol"] = "HTTP"
        r["source_honeypot"] = "snare"
        r["event_type"] = "session"
        r["event_result"] = "detected"
        r["parser_version"] = PARSER_VERSION
        path = doc.get("path", "")
        r["http_path"] = path
        r["http_method"] = str(doc.get("method", "GET")).upper()
        rows.append(r)
    return rows


def parse_conpot(docs):
    rows = []
    for doc in docs:
        r = empty()
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = doc.get("session_id", str(uuid.uuid4()))
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "src_ip", "remote")
        r["src_port"] = port(doc, "src_port")
        r["dst_ip"] = ip(doc, "dst_ip")
        r["dst_port"] = port(doc, "dst_port")
        r["transport"] = "TCP"
        r["protocol"] = str(doc.get("slave_id", "MODBUS")).upper() or "MODBUS"
        r["source_honeypot"] = "conpot"
        r["event_type"] = "session"
        r["event_result"] = "detected"
        r["parser_version"] = PARSER_VERSION
        rows.append(r)
    return rows


def parse_mailoney(docs):
    rows = []
    for doc in docs:
        r = empty()
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = str(uuid.uuid4())
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "src_ip")
        r["src_port"] = port(doc, "src_port")
        r["dst_port"] = "25"
        r["transport"] = "TCP"
        r["protocol"] = "SMTP"
        r["source_honeypot"] = "mailoney"
        r["event_type"] = "auth"
        r["username"] = doc.get("username", "")
        r["password"] = doc.get("password", "")
        r["login_success"] = "0"
        r["event_result"] = "fail"
        r["parser_version"] = PARSER_VERSION
        rows.append(r)
    return rows


def parse_sentrypeer(docs):
    rows = []
    for doc in docs:
        r = empty()
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = str(uuid.uuid4())
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "source_ip", "src_ip")
        r["dst_port"] = "5060"
        r["transport"] = "UDP"
        r["protocol"] = "SIP"
        r["source_honeypot"] = "sentrypeer"
        r["event_type"] = "session"
        r["event_result"] = "detected"
        r["parser_version"] = PARSER_VERSION
        rows.append(r)
    return rows


def parse_generic(docs, honeypot_name, protocol="UNKNOWN", dst_port=""):
    rows = []
    for doc in docs:
        r = empty()
        r["event_id"] = str(uuid.uuid4())
        r["session_id"] = str(uuid.uuid4())
        r["timestamp"] = ts(doc)
        r["ingest_time"] = INGEST_TIME
        r["src_ip"] = ip(doc, "src_ip", "source_ip", "remote_ip")
        r["src_port"] = port(doc, "src_port", "source_port")
        r["dst_ip"] = ip(doc, "dst_ip", "dest_ip")
        r["dst_port"] = port(doc, "dst_port", "dest_port") or dst_port
        r["transport"] = "TCP"
        r["protocol"] = protocol
        r["source_honeypot"] = honeypot_name
        r["event_type"] = "session"
        r["event_result"] = "detected"
        r["parser_version"] = PARSER_VERSION
        rows.append(r)
    return rows


PARSERS = {
    "tpot_cowrie.json":        (parse_cowrie,    {}),
    "tpot_honeytrap.json":     (parse_honeytrap, {}),
    "tpot_dionaea.json":       (parse_dionaea,   {}),
    "tpot_tanner.json":        (parse_tanner,    {}),
    "tpot_conpot.json":        (parse_conpot,    {}),
    "tpot_mailoney.json":      (parse_mailoney,  {}),
    "tpot_sentrypeer.json":    (parse_sentrypeer,{}),
    "tpot_adbhoney.json":      (parse_generic,   {"honeypot_name":"adbhoney","protocol":"ADB","dst_port":"5555"}),
    "tpot_redishoneypot.json": (parse_generic,   {"honeypot_name":"redishoneypot","protocol":"REDIS","dst_port":"6379"}),
    "tpot_elasticpot.json":    (parse_generic,   {"honeypot_name":"elasticpot","protocol":"HTTP","dst_port":"9200"}),
    "tpot_h0neytr4p.json":     (parse_generic,   {"honeypot_name":"h0neytr4p","protocol":"HTTP","dst_port":"80"}),
    "tpot_miniprint.json":     (parse_generic,   {"honeypot_name":"miniprint","protocol":"IPP","dst_port":"631"}),
    "tpot_ciscoasa.json":      (parse_generic,   {"honeypot_name":"ciscoasa","protocol":"SSL","dst_port":"443"}),
    "tpot_honeyaml.json":      (parse_generic,   {"honeypot_name":"honeyaml","protocol":"UNKNOWN","dst_port":""}),
    "tpot_ipphoney.json":      (parse_generic,   {"honeypot_name":"ipphoney","protocol":"IPP","dst_port":"631"}),
    "tpot_heralding.json":     (parse_generic,   {"honeypot_name":"heralding","protocol":"MULTI","dst_port":""}),
}


def flatten(doc, prefix=""):
    """중첩 dict를 flat key로 변환 (a.b.c 형식)"""
    items = {}
    for k, v in doc.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(flatten(v, key))
        else:
            items[key] = v
    return items


def main():
    all_rows = []
    all_raw = []
    seq = 0

    for filename, (parser_fn, kwargs) in PARSERS.items():
        fpath = TPOT_DIR / filename
        if not fpath.exists():
            print(f"[!] 없음: {filename}")
            continue
        with open(fpath, encoding="utf-8") as f:
            docs = json.load(f)

        # ── 스키마 매핑 CSV ──────────────────────────
        if kwargs:
            rows = parser_fn(docs, **kwargs)
        else:
            rows = parser_fn(docs)
        for i, r in enumerate(rows, 1):
            seq += 1
            r["seq_no"] = str(seq)
            r["session_seq_no"] = str(i)
        all_rows.extend(rows)

        # ── Raw CSV (원본 필드 그대로) ────────────────
        honeypot_name = filename.replace("tpot_", "").replace(".json", "")
        for doc in docs:
            flat = flatten(doc)
            flat["_honeypot"] = honeypot_name
            all_raw.append(flat)

        print(f"[+] {filename}: {len(rows)}행")

    # ── 스키마 CSV 저장 ──────────────────────────────
    with open(OUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)
    print(f"\n[스키마 CSV] {OUT_FILE}  ({len(all_rows):,}행)")

    # ── Raw CSV 저장 ─────────────────────────────────
    all_keys = ["_honeypot"]
    seen = set(all_keys)
    for row in all_raw:
        for k in row:
            if k not in seen:
                all_keys.append(k)
                seen.add(k)
    with open(OUT_RAW, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=all_keys, extrasaction="ignore")
        writer.writeheader()
        for row in all_raw:
            writer.writerow({k: row.get(k, "") for k in all_keys})
    print(f"[Raw CSV]    {OUT_RAW}  ({len(all_raw):,}행)")


if __name__ == "__main__":
    main()
