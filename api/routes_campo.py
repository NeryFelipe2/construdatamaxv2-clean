"""Rotas REST relacionadas ao campo e dashboards."""
from __future__ import annotations

from fastapi import APIRouter, Query

from campo.rdo_engine import RDOEngine
from campo.webhook_server import processar_webhook_whatsapp
from core.database import cronograma_dados, curva_s_dados, dashboard_metricas, listar_fotos_ns

router = APIRouter(tags=["campo"])
engine = RDOEngine()


@router.post("/webhook/whatsapp")
def api_webhook_whatsapp(payload: dict):
    return processar_webhook_whatsapp(payload)


@router.get("/api/dashboard")
def api_dashboard(nucleo: str = Query(default="")):
    return dashboard_metricas(nucleo=nucleo)


@router.get("/api/fotos/{ns_id}")
def api_fotos_ns(ns_id: int):
    return {"items": listar_fotos_ns(ns_id)}


@router.get("/api/curva-s")
def api_curva_s(nucleo: str = Query(default="")):
    return curva_s_dados(nucleo=nucleo)


@router.get("/api/cronograma")
def api_cronograma(nucleo: str = Query(default="")):
    return cronograma_dados(nucleo=nucleo)
