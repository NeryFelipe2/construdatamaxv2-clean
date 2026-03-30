"""Montagem do cadastro as-built a partir do banco da plataforma."""
from __future__ import annotations

from typing import Any

from core.database import detalhe_ns, listar_ns
from cadastro.signos import simbolo_por_elemento


def construir_as_built(ns_id: int) -> dict[str, Any] | None:
    """Retorna um pacote as-built enriquecido para uma NS."""
    data = detalhe_ns(ns_id)
    if data is None:
        return None
    for pv in data.get("pvs", []):
        pv["signo"] = simbolo_por_elemento(pv.get("tipo"), pv.get("is_agua", False))
    data["as_built"] = {
        "ct_ini_real": data.get("ct_ini_real"),
        "cf_ini_real": data.get("cf_ini_real"),
        "ct_fim_real": data.get("ct_fim_real"),
        "cf_fim_real": data.get("cf_fim_real"),
        "cadastro_ok": data.get("cadastro_ok"),
        "fotos": data.get("fotos", []),
    }
    return data


def consolidar_as_built(nucleo: str = "") -> dict[str, Any]:
    """Retorna todas as NS como pacote consolidado de as-built."""
    items = []
    for row in listar_ns(nucleo=nucleo):
        detalhado = construir_as_built(int(row["id"]))
        if detalhado:
            items.append(detalhado)
    return {"items": items, "n_total": len(items)}
