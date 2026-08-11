from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

FRONTEND_DIR = Path(r"C:\Users\felip\Downloads\construdatamaxv2-clean\frontend")
NOVA_DIR = Path(__file__).resolve().parent
API_URL = "http://127.0.0.1:8787"
URL = "http://127.0.0.1:5174/app/gestao-360"


def _url_ok(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=3) as response:
            return response.status < 500
    except Exception:
        return False


def _ensure_api() -> subprocess.Popen | None:
    if _url_ok(f"{API_URL}/health"):
        return None
    log = Path(__file__).with_name("frontend_gui_api.log")
    handle = log.open("a", encoding="utf-8")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.server:app", "--host", "127.0.0.1", "--port", "8787"],
        cwd=str(NOVA_DIR),
        stdout=handle,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    for _ in range(40):
        if _url_ok(f"{API_URL}/health"):
            return proc
        time.sleep(0.5)
    raise RuntimeError(f"API local nao subiu. Ver log: {log}")


def _ensure_frontend() -> subprocess.Popen | None:
    if _url_ok(URL):
        return None
    if not FRONTEND_DIR.exists():
        raise RuntimeError(f"Frontend nao encontrado: {FRONTEND_DIR}")
    npm = "npm.cmd" if os.name == "nt" else "npm"
    log = Path(__file__).with_name("frontend_gui_vite.log")
    handle = log.open("a", encoding="utf-8")
    env = os.environ.copy()
    env["VITE_API_URL"] = API_URL
    env["VITE_ENABLE_DEMO_DATA"] = "false"
    proc = subprocess.Popen(
        [npm, "run", "dev", "--", "--host", "127.0.0.1", "--port", "5174"],
        cwd=str(FRONTEND_DIR),
        env=env,
        stdout=handle,
        stderr=subprocess.STDOUT,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )
    for _ in range(40):
        if _url_ok(URL):
            return proc
        time.sleep(0.5)
    raise RuntimeError(f"Frontend nao subiu. Ver log: {log}")


def main() -> int:
    try:
        import webview
    except Exception as exc:
        print(f"pywebview ausente: {exc}")
        print("Instale com: python -m pip install pywebview")
        return 1

    _ensure_api()
    _ensure_frontend()
    window = webview.create_window(
        "ConstruData HydroNetwork - Frontend Real",
        URL,
        width=1600,
        height=930,
        min_size=(1180, 720),
        resizable=True,
    )
    webview.start(debug=False)
    return 0 if window else 1


if __name__ == "__main__":
    raise SystemExit(main())
