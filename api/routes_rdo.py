"""Rotas REST relacionadas ao RDO."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from campo.rdo_engine import RDOEngine

router = APIRouter(tags=["rdo"])
engine = RDOEngine()


@router.get("/api/rdo")
def api_listar_rdo(nucleo: str = Query(default="")):
    return {"items": engine.listar_rdos(nucleo=nucleo)}


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
