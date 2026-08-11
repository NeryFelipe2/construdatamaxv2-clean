"""Rotas do BI Analytics operacional."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse

from analytics_operacional.bi_dashboard import (
    exportar_bi_excel,
    exportar_bi_pdf,
    montar_bi_payload,
)

router = APIRouter(tags=["bi-analytics"])


@router.get("/api/bi/analytics")
def api_bi_analytics():
    return montar_bi_payload(False)


@router.post("/api/bi/analytics/recalcular")
def api_bi_analytics_recalcular():
    return montar_bi_payload(True)


@router.get("/api/bi/analytics/export/pdf")
def api_bi_analytics_pdf():
    path = exportar_bi_pdf(montar_bi_payload(False))
    return FileResponse(path, media_type="application/pdf", filename=path.name)


@router.get("/api/bi/analytics/export/excel")
def api_bi_analytics_excel():
    path = exportar_bi_excel(montar_bi_payload(False))
    return FileResponse(path, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename=path.name)
