"""
공격 시나리오 실행 모듈.
kali-attacker 컨테이너를 유저 전용 네트워크에 임시 연결한 뒤
해당 유저의 허니팟 IP를 환경변수로 주입하여 시나리오를 실행한다.
"""
import docker
import threading
import logging
import os
from datetime import datetime
from typing import Optional
from database import SyncSessionLocal, ScenarioRun

logger = logging.getLogger(__name__)

PROFILING_URL           = os.getenv("PROFILING_URL", "http://honeypot-profiling:8080")
INTERNAL_SERVICE_TOKEN  = os.getenv("INTERNAL_SERVICE_TOKEN", "honeypot-internal-token")

SCENARIOS = {
    "01": {"id": "01", "name": "정상 트래픽",     "script": "/attack_scenarios/01_normal_traffic.sh",     "label": "Etc"},
    "02": {"id": "02", "name": "포트 스캔",        "script": "/attack_scenarios/02_port_scan.sh",          "label": "Recon"},
    "03": {"id": "03", "name": "브루트포스",        "script": "/attack_scenarios/03_brute_force.sh",        "label": "Brute Force"},
    "04": {"id": "04", "name": "웹 공격",          "script": "/attack_scenarios/04_web_attacks.sh",        "label": "Intrusion"},
    "05": {"id": "05", "name": "침투 후 명령어",    "script": "/attack_scenarios/05_post_intrusion.sh",     "label": "Intrusion"},
    "06": {"id": "06", "name": "리버스 셸",        "script": "/attack_scenarios/06_reverse_shell.sh",      "label": "Intrusion"},
    "07": {"id": "07", "name": "멀웨어 업로드",     "script": "/attack_scenarios/07_malware_upload.sh",     "label": "Malware"},
    "08": {"id": "08", "name": "크리덴셜 스터핑",  "script": "/attack_scenarios/08_credential_stuffing.sh","label": "Brute Force"},
    "09": {"id": "09", "name": "ICS/SCADA 공격",   "script": "/attack_scenarios/09_ics_attack.sh",         "label": "Recon"},
}

# 유저별 시나리오 상태: { username: { scenario_id: {...} } }
_status: dict[str, dict[str, dict]] = {}
_lock = threading.Lock()

# 유저별 일괄 실행 상태
_batch: dict[str, dict] = {}


def _push_to_profiling(username: str, scenario_id: str, state: str, output: str):
    """ML 1차 분류 → 고위험만 LLM → Spring Boot 전송."""
    if state != "done":
        return
    try:
        import requests
        import ml_service
        info        = SCENARIOS.get(scenario_id, {})
        attack_type = info.get("name", scenario_id)
        payload     = output[:250] if output else ""

        # ML 1차 분류
        ml_result = ml_service.classify(attack_type, payload)
        logger.info(
            f"[ml] {username}/{scenario_id} → is_attack={ml_result['is_attack']} "
            f"class={ml_result['attack_class']} mitre={ml_result['mitre_score']} "
            f"needs_llm={ml_result['needs_llm']} ({ml_result['model_used']})"
        )

        requests.post(
            f"{PROFILING_URL}/api/internal/attack-log",
            json={
                "username":   username,
                "attackType": attack_type,
                "payload":    payload,
                "ipAddress":  "kali-attacker",
                "mlResult":   ml_result,          # Spring Boot에 ML 결과 함께 전송
            },
            headers={"X-Service-Token": INTERNAL_SERVICE_TOKEN},
            timeout=15,
        )
        logger.info(f"[profiling] {username}/{scenario_id} 전송 완료")
    except Exception as e:
        logger.warning(f"[profiling] 전송 실패: {e}")


def _save_history(username: str, scenario_id: str, state: str, finished_at: datetime, output: str):
    """시나리오 실행 결과를 DB에 저장 (동기 세션, 스레드에서 호출)."""
    try:
        info = SCENARIOS.get(scenario_id, {})
        started_iso = _status.get(username, {}).get(scenario_id, {}).get("started_at")
        started_dt  = datetime.fromisoformat(started_iso) if started_iso else None

        with SyncSessionLocal() as session:
            run = ScenarioRun(
                username      = username,
                scenario_id   = scenario_id,
                scenario_name = info.get("name", scenario_id),
                label         = info.get("label", ""),
                state         = state,
                started_at    = started_dt,
                finished_at   = finished_at,
                output        = output[:4000],   # 최대 4KB
            )
            session.add(run)
            session.commit()
    except Exception as e:
        logger.warning(f"[history] DB 저장 실패: {e}")


def _init_user_status(username: str):
    if username not in _status:
        _status[username] = {
            sid: {
                "id": sid,
                "name": info["name"],
                "label": info["label"],
                "state": "idle",
                "started_at": None,
                "finished_at": None,
                "output": "",
            }
            for sid, info in SCENARIOS.items()
        }


def get_user_status(username: str) -> list[dict]:
    with _lock:
        _init_user_status(username)
        return list(_status[username].values())


def get_all_users_status() -> dict[str, list[dict]]:
    with _lock:
        return {u: list(s.values()) for u, s in _status.items()}


def get_scenario_status(username: str, scenario_id: str) -> Optional[dict]:
    with _lock:
        _init_user_status(username)
        return _status[username].get(scenario_id)


def _get_container_ip(client, container_name: str, network: str) -> Optional[str]:
    """컨테이너의 특정 네트워크 IP 조회."""
    try:
        c = client.containers.get(container_name)
        nets = c.attrs["NetworkSettings"]["Networks"]
        if network in nets:
            return nets[network]["IPAddress"]
        # 네트워크명 부분 매칭 시도
        for net_name, net_info in nets.items():
            if network in net_name or net_name in network:
                return net_info["IPAddress"]
    except Exception:
        pass
    return None


def _get_user_honeypot_ips(client, username: str) -> dict:
    """유저 허니팟 컨테이너 IP 목록 조회."""
    from docker_ops import container_name, network_name
    net = network_name(username)
    mapping = {
        "COWRIE_IP":    container_name(username, "cowrie"),
        "HERALDING_IP": container_name(username, "heralding"),
        "OPENCANARY_IP":container_name(username, "opencanary"),
        "SNARE_IP":     container_name(username, "snare"),
        "DIONAEA_IP":   container_name(username, "dionaea"),
        "MAILONEY_IP":  container_name(username, "mailoney"),
        "CONPOT_IP":    container_name(username, "conpot"),
        "TANNER_IP":    container_name(username, "tanner"),
    }
    env = {}
    for env_key, cname in mapping.items():
        ip = _get_container_ip(client, cname, net)
        if ip:
            env[env_key] = ip
    return env


def _run_in_thread(scenario_id: str, username: str):
    script = SCENARIOS[scenario_id]["script"]
    net_name_str = f"hp_net_{username}"

    with _lock:
        _status[username][scenario_id].update({
            "state": "running",
            "started_at": datetime.utcnow().isoformat(),
            "output": "",
            "finished_at": None,
        })

    logger.info(f"[scenario] {username}/{scenario_id} 시작")
    client = docker.from_env()
    kali = None
    network_connected = False

    try:
        kali = client.containers.get("kali-attacker")

        # kali가 꺼져 있으면 자동 시작
        if kali.status != "running":
            kali.start()
            kali.reload()
            logger.info(f"[scenario] kali-attacker 자동 시작")

        # kali를 유저 네트워크에 연결
        try:
            net = client.networks.get(net_name_str)
            net.connect(kali)
            network_connected = True
            logger.info(f"[scenario] kali → {net_name_str} 연결")
        except docker.errors.APIError as e:
            if "already exists" not in str(e):
                raise

        # 유저 허니팟 IP 수집
        env_vars = _get_user_honeypot_ips(client, username)
        logger.info(f"[scenario] {username} 허니팟 IP: {env_vars}")

        # 시나리오 실행
        exit_code, output = kali.exec_run(
            cmd=["bash", script],
            stdout=True,
            stderr=True,
            stream=False,
            environment=env_vars,
        )
        decoded = output.decode("utf-8", errors="replace") if output else ""

        final_state = "done" if exit_code == 0 else "failed"
        finished_at = datetime.utcnow()
        with _lock:
            _status[username][scenario_id].update({
                "state": final_state,
                "finished_at": finished_at.isoformat(),
                "output": decoded,
            })
        _save_history(username, scenario_id, final_state, finished_at, decoded)
        _push_to_profiling(username, scenario_id, final_state, decoded)
        logger.info(f"[scenario] {username}/{scenario_id} 완료 (exit={exit_code})")

    except docker.errors.NotFound:
        finished_at = datetime.utcnow()
        msg = "kali-attacker 컨테이너를 찾을 수 없습니다."
        with _lock:
            _status[username][scenario_id].update({
                "state": "failed",
                "finished_at": finished_at.isoformat(),
                "output": msg,
            })
        _save_history(username, scenario_id, "failed", finished_at, msg)
        logger.error(f"[scenario] kali-attacker 없음")

    except Exception as e:
        finished_at = datetime.utcnow()
        msg = str(e)
        with _lock:
            _status[username][scenario_id].update({
                "state": "failed",
                "finished_at": finished_at.isoformat(),
                "output": msg,
            })
        _save_history(username, scenario_id, "failed", finished_at, msg)
        logger.error(f"[scenario] {username}/{scenario_id} 실패: {e}")

    finally:
        # kali를 유저 네트워크에서 해제
        if network_connected and kali:
            try:
                net = client.networks.get(net_name_str)
                net.disconnect(kali)
                logger.info(f"[scenario] kali ← {net_name_str} 해제")
            except Exception as e:
                logger.warning(f"[scenario] 네트워크 해제 실패: {e}")


def run_scenario(scenario_id: str, username: str) -> dict:
    """시나리오를 백그라운드 스레드에서 실행."""
    if scenario_id not in SCENARIOS:
        return {"error": "존재하지 않는 시나리오입니다."}

    with _lock:
        _init_user_status(username)
        if _status[username][scenario_id]["state"] == "running":
            return {"error": "이미 실행 중입니다."}

    t = threading.Thread(target=_run_in_thread, args=(scenario_id, username), daemon=True)
    t.start()
    return {"started": scenario_id, "username": username}


def _run_all_sequential_thread(username: str, ids: list):
    """시나리오를 순서대로 하나씩 실행하는 배치 스레드."""
    _batch[username] = {
        "running": True,
        "cancel": False,
        "current": None,
        "done": [],
        "failed": [],
        "ids": ids,
    }
    logger.info(f"[batch] {username} 일괄 실행 시작: {ids}")
    for sid in ids:
        if _batch[username].get("cancel"):
            logger.info(f"[batch] {username} 취소됨")
            break
        _batch[username]["current"] = sid
        _run_in_thread(sid, username)  # 완료될 때까지 블로킹
        state = _status.get(username, {}).get(sid, {}).get("state", "failed")
        if state == "done":
            _batch[username]["done"].append(sid)
        else:
            _batch[username]["failed"].append(sid)
        logger.info(f"[batch] {username}/{sid} → {state}")
    _batch[username]["running"] = False
    _batch[username]["current"] = None
    logger.info(f"[batch] {username} 일괄 실행 완료")


def run_all_sequential(username: str, ids: list | None = None) -> dict:
    """선택한 시나리오를 순차적으로 실행."""
    if ids is None:
        ids = sorted(SCENARIOS.keys())
    with _lock:
        _init_user_status(username)
        if _batch.get(username, {}).get("running"):
            return {"error": "이미 일괄 실행 중입니다."}
    t = threading.Thread(target=_run_all_sequential_thread, args=(username, ids), daemon=True)
    t.start()
    return {"started": True, "total": len(ids)}


def get_batch_status(username: str) -> dict:
    return _batch.get(username, {
        "running": False, "cancel": False,
        "current": None, "done": [], "failed": [], "ids": [],
    })


def cancel_batch(username: str) -> dict:
    if username in _batch and _batch[username].get("running"):
        _batch[username]["cancel"] = True
        return {"cancelled": True}
    return {"cancelled": False}
