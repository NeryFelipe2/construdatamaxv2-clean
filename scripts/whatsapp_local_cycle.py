from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

import requests


REPO_ROOT = Path(__file__).resolve().parent.parent
BRIDGE_PORT = 8787
BRIDGE_URL = f"http://localhost:{BRIDGE_PORT}"
BRIDGE_LOG_DIR = Path(os.environ.get("TEMP", ".")) / "construdata_local_bridge"
BRIDGE_PID_FILE = BRIDGE_LOG_DIR / "pid.txt"
LOCAL_EVOLUTION = "http://localhost:8080"
SERVICE_ID = "srv-d750kldm5p6s73feojbg"

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        check=check,
        text=True,
        capture_output=True,
    )


def _render_env() -> dict[str, str]:
    cli = (Path.home() / ".render" / "cli.yaml").read_text(encoding="utf-8")
    api_key = re.search(r"^\s+key:\s*(.+)$", cli, re.M).group(1).strip().strip('"')
    host = re.search(r"^\s+host:\s*(.+)$", cli, re.M).group(1).strip().strip('"').rstrip("/")
    if not host.endswith("/v1"):
        host += "/v1"
    items = requests.get(
        f"{host}/services/{SERVICE_ID}/env-vars",
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=30,
    ).json()
    env: dict[str, str] = {}
    for item in items:
        ev = item.get("envVar") or item
        key = ev.get("key")
        value = ev.get("value")
        if key and value is not None:
            env[key] = value
    return env


def _pick_evolution_key(candidates: list[str | None]) -> str:
    for candidate in candidates:
        if not candidate:
            continue
        try:
            response = requests.get(
                f"{LOCAL_EVOLUTION}/instance/connectionState/construdata-felipe",
                headers={"apikey": candidate},
                timeout=8,
            )
            if response.status_code < 400:
                return candidate
        except Exception:
            pass
    raise RuntimeError("Nao consegui descobrir a API key local da Evolution")


def _bridge_env() -> dict[str, str]:
    env = _render_env()
    evo_key = _pick_evolution_key(
        [
            env.get("AUTHENTICATION_API_KEY"),
            env.get("EVOLUTION_API_KEY"),
            "construdata2026",
            "RkEvolution2026!ApiKey",
            "TROQUE_ESTA_API_KEY_EVOLUTION",
        ]
    )
    env.update(
        {
            "WHATSAPP_SEND_ENABLED": "true",
            "WHATSAPP_SELF_TEST_PHONE": "5561981846325",
            "EVOLUTION_URL": LOCAL_EVOLUTION,
            "EVOLUTION_API_URL": LOCAL_EVOLUTION,
            "EVOLUTION_INSTANCE": "construdata-felipe",
            "EVOLUTION_DEFAULT_INSTANCE": "construdata-felipe",
            "AUTHENTICATION_API_KEY": evo_key,
            "EVOLUTION_API_KEY": evo_key,
        }
    )
    return env


def ensure_docker_stack() -> None:
    containers = ["obras-rk-postgres-1", "obras-rk-redis-1", "obras-rk-evolution-1", "obras-rk-n8n-1"]
    _run(["docker", "start", *containers], check=False)
    _run(["docker", "update", "--restart=unless-stopped", "obras-rk-postgres-1", "obras-rk-redis-1"], check=False)
    time.sleep(8)


def start_bridge() -> None:
    BRIDGE_LOG_DIR.mkdir(parents=True, exist_ok=True)
    if BRIDGE_PID_FILE.exists():
        try:
            old_pid = int(BRIDGE_PID_FILE.read_text().strip())
            _run(["taskkill", "/PID", str(old_pid), "/F"], check=False)
        except Exception:
            pass
    env = {**os.environ, **_bridge_env()}
    stdout = open(BRIDGE_LOG_DIR / "stdout.log", "w", encoding="utf-8")
    stderr = open(BRIDGE_LOG_DIR / "stderr.log", "w", encoding="utf-8")
    flags = subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "local_whatsapp_bridge:app", "--host", "0.0.0.0", "--port", str(BRIDGE_PORT)],
        cwd=REPO_ROOT,
        env=env,
        stdout=stdout,
        stderr=stderr,
        creationflags=flags,
    )
    BRIDGE_PID_FILE.write_text(str(proc.pid), encoding="utf-8")
    for _ in range(15):
        try:
            requests.get(f"{BRIDGE_URL}/health", timeout=5).raise_for_status()
            return
        except Exception:
            time.sleep(1)
    raise RuntimeError("Bridge local nao subiu")


def configure_local_webhook() -> None:
    evo_key = _pick_evolution_key(["construdata2026", "RkEvolution2026!ApiKey", "TROQUE_ESTA_API_KEY_EVOLUTION"])
    payload = {
        "webhook": {
            "enabled": True,
            "url": f"http://host.docker.internal:{BRIDGE_PORT}/api/whatsapp/webhook",
            "webhookByEvents": False,
            "webhookBase64": False,
            "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE", "CONNECTION_UPDATE"],
        }
    }
    response = requests.post(
        f"{LOCAL_EVOLUTION}/webhook/set/construdata-felipe",
        headers={"apikey": evo_key},
        json=payload,
        timeout=20,
    )
    response.raise_for_status()


def _webhook_payload(message_text: str, remote_jid: str = "5561981846325@s.whatsapp.net") -> dict:
    payload = {
        "event": "MESSAGES_UPSERT",
        "data": {
            "key": {"remoteJid": remote_jid, "fromMe": True},
            "message": {"conversation": message_text},
        },
    }
    return payload


def _call_webhook(payload: dict) -> dict:
    response = requests.post(f"{BRIDGE_URL}/api/whatsapp/webhook", json=payload, timeout=30)
    response.raise_for_status()
    return response.json()


def local_logic_test() -> dict:
    scenarios = {
        "menu": "#menu",
        "opcao_1": "#1",
        "rdo": "#@rdo 1: 120 2: 110 3: 1500 4: 1700 observacao teste automatizado",
    }
    return {name: _call_webhook(_webhook_payload(message_text)) for name, message_text in scenarios.items()}


def real_group_test() -> dict:
    group_jid = os.environ.get("WHATSAPP_TEST_GROUP_JID", "").strip()
    if not group_jid:
        return {"skipped": True, "reason": "WHATSAPP_TEST_GROUP_JID nao configurado"}
    return _call_webhook(_webhook_payload("#bot menu", remote_jid=group_jid))


def summary() -> dict:
    health = requests.get(f"{BRIDGE_URL}/health", timeout=10).json()
    evo = requests.get(
        f"{LOCAL_EVOLUTION}/instance/connectionState/construdata-felipe",
        headers={"apikey": _pick_evolution_key(['construdata2026', 'RkEvolution2026!ApiKey', 'TROQUE_ESTA_API_KEY_EVOLUTION'])},
        timeout=10,
    ).json()
    return {"bridge": health, "evolution": evo}


def cmd_start() -> None:
    ensure_docker_stack()
    start_bridge()
    configure_local_webhook()
    print(json.dumps({"ok": True, "stage": "started", **summary()}, ensure_ascii=False, indent=2))


def cmd_test() -> None:
    print(
        json.dumps(
            {
                "ok": True,
                "local_logic_test": local_logic_test(),
                "real_group_test": real_group_test(),
                **summary(),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["start", "test", "cycle"])
    args = parser.parse_args()
    if args.command in {"start", "cycle"}:
        cmd_start()
    if args.command in {"test", "cycle"}:
        cmd_test()


if __name__ == "__main__":
    main()
