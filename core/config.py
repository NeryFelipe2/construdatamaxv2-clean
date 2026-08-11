"""Configuracao central da plataforma construdatamaxv2."""
from __future__ import annotations

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PLATFORM_NAME = os.environ.get("PLATFORM_NAME", "construdatamaxv2")
PLATFORM_DISPLAY_NAME = os.environ.get("PLATFORM_DISPLAY_NAME", "ConstruDataMaxV2")
SAIDA_ROOT = PROJECT_ROOT / "SAIDA_HYDRONETWORK"
DB_DIR = SAIDA_ROOT / "db"
FOTOS_DIR = SAIDA_ROOT / "campo" / "fotos"
HTML_DIR = PROJECT_ROOT / "html"
CRONOGRAMA_DIR = PROJECT_ROOT / "cronograma"
CONTRATO_PADRAO = "11481051"
BDI_PADRAO = 1.25
CRS_PROJETO = "EPSG:31983"
CRS_WEB = "EPSG:4326"
API_HOST = os.environ.get("CONSTRUDATA_API_HOST", "127.0.0.1")
API_PORT = int(os.environ.get("CONSTRUDATA_API_PORT", "8787"))
API_BASE_URL = os.environ.get("CONSTRUDATA_API_BASE_URL", f"http://{API_HOST}:{API_PORT}")
DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{(DB_DIR / 'construdata.db').as_posix()}")
CONSOLIDADO_NS_PATH = Path(
    os.environ.get("CONSTRUDATA_CONSOLIDADO_NS", str(PROJECT_ROOT / "CONSOLIDADO_NOTAS_SERVICO.json"))
)


def ensure_runtime_dirs() -> None:
    """Cria diretorios usados em runtime."""
    for directory in (SAIDA_ROOT, DB_DIR, FOTOS_DIR):
        directory.mkdir(parents=True, exist_ok=True)
