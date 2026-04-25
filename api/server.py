"""Servidor FastAPI da plataforma construdatamaxv2 — UNIFIED V5 ENGINE."""
from __future__ import annotations

import sys
from pathlib import Path
import tempfile

# Garante que o repo root está no sys.path para imports dos motores
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.middleware.wsgi import WSGIMiddleware

# ─── Original Routers (9) ────────────────────────────────────────────────────
from api.routes_cadastro import router as cadastro_router
from api.routes_campo import router as campo_router
from api.routes_ns import router as ns_router
from api.routes_operacao import router as operacao_router
from api.routes_processamento import router as processamento_router
from api.routes_rdo import router as rdo_router
from api.routes_whatsapp import router as whatsapp_router
from api.routes_integracao_total import router as integracao_total_router
from api.routes_notificacoes import router as notificacoes_router
from api.routes_motores import router as motores_router

# ─── NEW V5 Engine Routers (4) ──────────────────────────────────────────────
from api.routes_engine_v5 import router as engine_v5_router
from api.routes_geradores import router as geradores_router
from api.routes_analytics import router as analytics_router
from api.routes_leitores import router as leitores_router

# ─── Agent Chat Router ─────────────────────────────────────────────────────
from api.routes_agent import router as agent_router

from core.config import HTML_DIR, PLATFORM_DISPLAY_NAME, PLATFORM_NAME
from core.database import bootstrap_database

app = FastAPI(
    title=f"{PLATFORM_DISPLAY_NAME} API — Unified V5 Engine",
    version="3.0.0",
    description="ConstruData HydroNetwork — Plataforma unificada com 13 routers, 25 motores, 27 geradores.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ─── Register Original Routers ──────────────────────────────────────────────
app.include_router(ns_router)
app.include_router(rdo_router)
app.include_router(campo_router)
app.include_router(cadastro_router)
app.include_router(processamento_router)
app.include_router(operacao_router)
app.include_router(whatsapp_router)
app.include_router(integracao_total_router)
app.include_router(notificacoes_router)
app.include_router(motores_router)

# ─── Register V5 Engine Routers ─────────────────────────────────────────────
app.include_router(engine_v5_router)
app.include_router(geradores_router)
app.include_router(analytics_router)
app.include_router(leitores_router)
app.include_router(agent_router)

# Mount ConstruPlan Flask Offline Backend (Brutal Injection)
try:
    import sys
    sys.path.append(str(Path(__file__).parent))
    from construplan_flask_backend import app as flask_app
    app.mount("/api_flask", WSGIMiddleware(flask_app))
except Exception as exc:
    import logging
    logging.error(f"Failed to mount Flask Construplan Backend: {exc}")


@app.on_event("startup")
def on_startup():
    bootstrap_database(force_import=False)


@app.get("/")
def raiz():
    return RedirectResponse("/rdo", status_code=307)


@app.get("/health")
def health():
    motores_path = REPO_ROOT / "motores"
    geradores_path = REPO_ROOT / "geradores"
    return {
        "ok": True,
        "app": PLATFORM_NAME,
        "display_name": PLATFORM_DISPLAY_NAME,
        "version": "3.0.0",
        "engine": "Unified V5",
        "routers": 14,
        "motores": len(list(motores_path.glob("*.py"))) - 1 if motores_path.exists() else 0,
        "geradores": len(list(geradores_path.glob("gerar_*.py"))) if geradores_path.exists() else 0,
    }


def _servir_html(nome_arquivo: str) -> FileResponse:
    caminho = Path(HTML_DIR) / nome_arquivo
    if not caminho.exists():
        raise HTTPException(status_code=404, detail=f"HTML nao encontrado: {nome_arquivo}")
    return FileResponse(caminho, media_type="text/html; charset=utf-8")


def _manage_snapshot_atual() -> Path | None:
    pasta = Path(tempfile.gettempdir()) / "construdata_manage"
    if not pasta.exists():
        return None
    snapshots = sorted(
        pasta.glob("manage_atual_*.html"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return snapshots[0] if snapshots else None


@app.get("/rdo")
def tela_rdo():
    return _servir_html("construdata_rdo.html")


@app.get("/manage")
def tela_manage():
    snapshot = _manage_snapshot_atual()
    if snapshot and snapshot.exists():
        return FileResponse(snapshot, media_type="text/html; charset=utf-8")
    return _servir_html("construdata_manage.html")


@app.get("/controle")
def tela_controle():
    return _servir_html("construdata_controle.html")


@app.get("/campo")
def tela_campo():
    return _servir_html("construdata_campo.html")


@app.get("/perdas")
def tela_perdas():
    return _servir_html("construdata_perdas.html")


@app.get("/editor")
def tela_editor():
    return _servir_html("construdata_editor.html")


@app.get("/arquitetura-bim")
def tela_arquitetura_bim():
    return _servir_html("ARQUITETURA_BIM_5D.html")


@app.get("/fluxograma-bim")
def tela_fluxograma_bim():
    return _servir_html("FLUXOGRAMA_BIM_5D.html")
