"""Rotas REST relacionadas ao cadastro tecnico."""
from __future__ import annotations

from fastapi import APIRouter, Query

from core.database import geojson_rede

router = APIRouter(tags=["cadastro"])


@router.get("/api/cadastro/geojson")
def api_cadastro_geojson(nucleo: str = Query(default="")):
    return geojson_rede(nucleo=nucleo)
