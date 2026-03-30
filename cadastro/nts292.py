"""Helpers operacionais para o cadastro NTS 292."""
from __future__ import annotations

from datetime import date
from typing import Any

from cadastro.as_built import consolidar_as_built
from cadastro.base_topografica import extrair_base_topografica
from core.database import geojson_rede

METADADOS_OBRIGATORIOS = ["data_levantamento", "responsavel_tecnico", "crea", "datum", "rn"]


def validar_metadados_nts292(metadados: dict[str, Any]) -> dict[str, Any]:
    """Valida os campos obrigatorios minimos da NTS 292 Rev.3."""
    faltantes = [campo for campo in METADADOS_OBRIGATORIOS if not metadados.get(campo)]
    return {"ok": not faltantes, "faltantes": faltantes}


def pacote_cadastro_nts292(nucleo: str = "", metadados: dict[str, Any] | None = None) -> dict[str, Any]:
    """Gera um pacote serializavel do cadastro tecnico completo."""
    metadados = metadados or {}
    metadados.setdefault("data_levantamento", str(date.today()))
    metadados.setdefault("datum", "SIRGAS 2000")
    metadados.setdefault("projecao", "UTM 23S / EPSG:31983")
    return {
        "metadados": metadados,
        "validacao": validar_metadados_nts292(metadados),
        "geojson": geojson_rede(nucleo=nucleo),
        "as_built": consolidar_as_built(nucleo=nucleo),
        "base_topografica": extrair_base_topografica(),
    }
