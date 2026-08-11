"""Rotas REST relacionadas ao campo e dashboards."""
from __future__ import annotations

from fastapi import APIRouter, Query

from campo.rdo_engine import RDOEngine
from campo.webhook_server import processar_webhook_whatsapp
from core.construdata_offline import nucleos_do_projeto
from core.database import cronograma_dados, curva_s_dados, dashboard_metricas, listar_fotos_ns

router = APIRouter(tags=["campo"])
engine = RDOEngine()


@router.post("/webhook/whatsapp")
def api_webhook_whatsapp(payload: dict):
    return processar_webhook_whatsapp(payload)


@router.get("/api/dashboard")
def api_dashboard(nucleo: str = Query(default="")):
    nucleos = nucleos_do_projeto(nucleo) if nucleo else []
    if len(nucleos) > 1:
        rows = [dashboard_metricas(nucleo=item) for item in nucleos]
        base = dict(rows[0])
        base["nucleo"] = nucleo
        for key in ("n_total", "n_planejadas", "n_execucao", "n_concluidas", "n_medidas", "extensao_total_m", "extensao_exec_m", "valor_liberado", "rdos", "custo_rdo_total", "dias_medidos"):
            base[key] = sum((row.get(key) or 0) for row in rows)
        base["pct_fisico"] = round(base["extensao_exec_m"] / base["extensao_total_m"] * 100, 1) if base["extensao_total_m"] else 0.0
        base["m_por_dia"] = round(base["extensao_exec_m"] / max(base["dias_medidos"], 1), 2) if base["dias_medidos"] else 0.0
        return base
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
