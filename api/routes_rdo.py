from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from api.supabase_client import get_supabase
from campo.rdo_engine import RDOEngine

router = APIRouter(tags=["rdo"])
engine = RDOEngine()

supabase = get_supabase()


@router.get("/api/rdo")
def api_listar_rdo(nucleo: str = Query(default="")):
    # 1) Origem principal em producao: Supabase canonico
    if supabase:
        try:
            q = supabase.table("rdos").select("*").order("created_at", desc=True)
            if nucleo:
                q = q.eq("nucleo", nucleo)
            project_id = os.environ.get("DEFAULT_PROJECT_ID", "")
            if project_id and not nucleo:
                q = q.eq("projeto_id", project_id)
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

    # 2) Fallback local do engine para ambiente offline
    return {"items": engine.listar_rdos(nucleo=nucleo)}


@router.post("/api/rdo")
def api_criar_rdo(payload: dict):
    if not payload.get("data"):
        raise HTTPException(status_code=400, detail="Campo 'data' obrigatorio")
    if payload.get("projeto_id") and supabase:
        row = dict(payload)
        row.setdefault("origem", "web")
        row.setdefault("status", "recebido")
        try:
            res = supabase.table("rdos").insert(row).execute()
            return (res.data or [row])[0]
        except Exception:
            pass
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
