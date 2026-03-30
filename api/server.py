"""Servidor FastAPI da plataforma construdatamaxv2."""
from __future__ import annotations

from pathlib import Path
import tempfile

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

from api.routes_cadastro import router as cadastro_router
from api.routes_campo import router as campo_router
from api.routes_ns import router as ns_router
from api.routes_rdo import router as rdo_router
from core.config import HTML_DIR, PLATFORM_DISPLAY_NAME, PLATFORM_NAME
from core.database import bootstrap_database

app = FastAPI(title=f"{PLATFORM_DISPLAY_NAME} API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ns_router)
app.include_router(rdo_router)
app.include_router(campo_router)
app.include_router(cadastro_router)


@app.on_event("startup")
def on_startup():
    bootstrap_database(force_import=False)


@app.get("/")
def raiz():
    return RedirectResponse("/rdo", status_code=307)


@app.get("/health")
def health():
    return {"ok": True, "app": PLATFORM_NAME, "display_name": PLATFORM_DISPLAY_NAME}


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
