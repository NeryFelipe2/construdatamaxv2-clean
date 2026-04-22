from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from supabase import create_client

from campo.rdo_engine import RDOEngine

router = APIRouter(tags=["rdo"])
engine = RDOEngine()

SUPABASE_URL = os.environ.get("SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    os.environ.get(
        "SUPABASE_SERVICE_KEY",
        os.environ.get("SUPABASE_ANON_KEY", os.environ.get("VITE_SUPABASE_ANON_KEY", os.environ.get("SUPABASE_KEY", ""))),
    ),
)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY) if (SUPABASE_URL and SUPABASE_KEY) else None


@router.get("/api/rdo")
def api_listar_rdo(nucleo: str = Query(default="")):
    # 1) Origem principal local do engine
    local_items = engine.listar_rdos(nucleo=nucleo)
    if local_items:
        return {"items": local_items}

    # 2) Fallback Supabase: tabela rdos
    if supabase:
        try:
            q = supabase.table("rdos").select("*").order("created_at", desc=True)
            if nucleo:
                q = q.eq("nucleo", nucleo)
            res = q.execute()
            if res.data:
                return {"items": res.data}
        except Exception:
            pass

        # 3) Fallback legado: rk_rdo_diario
        try:
            q = supabase.table("rk_rdo_diario").select("*").order("data_registro", desc=True)
            if nucleo:
                q = q.eq("nucleo", nucleo)
            res = q.execute()
            return {"items": res.data or []}
        except Exception:
            pass

    return {"items": []}


@router.post("/api/rdo")
def api_criar_rdo(payload: dict):
    if not payload.get("data"):
        raise HTTPException(status_code=400, detail="Campo 'data' obrigatorio")
    return engine.criar_rdo_completo(payload)


@router.patch("/api/rdo/{rdo_id}/fechar")
def api_fechar_rdo(rdo_id: int):
    try:
        return engine.fechar_rdo(rdo_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/rdo/{rdo_id}/pdf")
def api_rdo_pdf(rdo_id: int):
    rdo = engine.obter_rdo(rdo_id)
    if not rdo:
        raise HTTPException(status_code=404, detail="RDO nao encontrado")
    pdf_path = rdo.get("pdf_path") or engine.gerar_pdf(rdo_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF nao disponivel")
    path = Path(pdf_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Arquivo PDF nao encontrado")
    return FileResponse(path, media_type="application/pdf", filename=path.name)


@router.get("/api/rdo/{data_ref}")
def api_rdo_do_dia(data_ref: str, nucleo: str = Query(default="")):
    if not nucleo:
        rows = engine.listar_rdos()
        for row in rows:
            if row.get("data") == data_ref:
                return row
        raise HTTPException(status_code=404, detail="RDO nao encontrado para a data informada")
    row = engine.rdo_do_dia(data_ref, nucleo)
    if row is None:
        raise HTTPException(status_code=404, detail="RDO nao encontrado para a data informada")
    return row
