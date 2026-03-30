"""Rotas REST relacionadas a Notas de Servico."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from core.database import detalhe_ns, listar_ns, atualizar_status_ns

router = APIRouter(tags=["ns"])


@router.get("/api/ns")
def api_listar_ns(nucleo: str = Query(default=""), status: str = Query(default="")):
    return {"items": listar_ns(nucleo=nucleo, status=status)}


@router.get("/api/ns/{ns_id}")
def api_detalhe_ns(ns_id: int):
    data = detalhe_ns(ns_id)
    if data is None:
        raise HTTPException(status_code=404, detail="NS nao encontrada")
    return data


@router.patch("/api/ns/{ns_id}/status")
def api_atualizar_status_ns(ns_id: int, payload: dict):
    status = payload.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="Campo 'status' obrigatorio")
    data = atualizar_status_ns(ns_id, status, payload.get("data_referencia"))
    if data is None:
        raise HTTPException(status_code=404, detail="NS nao encontrada")
    return data
