"""Rotas REST operacionais para o cockpit web NS v5/v9."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Query

from core.config import PROJECT_ROOT
from core.database import cronograma_dados, listar_nucleos
from core.manage_dataset import build_manage_dataset

router = APIRouter(tags=["operacao"])

ANALYTICS_CANDIDATES = (
    PROJECT_ROOT / "analiticos" / "ANALYTICS_SLNR.json",
    PROJECT_ROOT / "analiticos construdata" / "ANALYTICS_SLNR.json",
)


def _network_inputs(nucleo: str = "") -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
    dataset = build_manage_dataset(nucleo=nucleo)
    ox = float(dataset.get("ox") or 0.0)
    oy = float(dataset.get("oy") or 0.0)

    pvs: dict[str, dict[str, Any]] = {}
    for node in dataset.get("nodes", []):
        nome = str(node.get("n") or "").strip()
        if not nome:
            continue
        pvs[nome] = {
            "nome": nome,
            "x": float(node.get("x") or 0.0) + ox,
            "y": float(node.get("y") or 0.0) + oy,
            "ct": float(node.get("ct") or 0.0),
            "cf": float(node.get("cf") or 0.0),
            "prof": float(node.get("p") or 0.0),
            "tipo": node.get("t") or "PV",
        }

    trechos: list[dict[str, Any]] = []
    for edge in dataset.get("edges", []):
        trechos.append(
            {
                "pv_ini": edge.get("a"),
                "pv_fim": edge.get("b"),
                "ext_m": float(edge.get("ext") or 0.0),
                "dn_mm": int(edge.get("dn") or 0),
                "material": edge.get("mat") or "PVC",
                "cf_ini": float(edge.get("z0") or 0.0),
                "cf_fim": float(edge.get("z1") or 0.0),
                "decl_mm": edge.get("decl_pct"),
                "custo": float(edge.get("c") or 0.0),
            }
        )

    return dataset, pvs, trechos


def _read_json_if_exists(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


@router.get("/api/manage/rede")
def api_manage_rede(nucleo: str = Query(default="")):
    return build_manage_dataset(nucleo=nucleo)


@router.get("/api/nucleos")
def api_nucleos():
    nomes = set(listar_nucleos())
    for item in cronograma_dados().get("nucleos", []):
        nome = str(item.get("nome") or "").strip()
        if nome:
            nomes.add(nome)

    items = [{"nome": nome} for nome in sorted(nomes)]
    return {"items": items, "total": len(items)}


@router.get("/api/insights/lean-lps")
def api_insight_lean_lps(nucleo: str = Query(default="")):
    from motor_lean_lps import gerar_relatorio_lean_lps

    dataset, pvs, trechos = _network_inputs(nucleo=nucleo)
    if not trechos:
        return {
            "meta": {"nucleo": nucleo or "TODOS"},
            "infra": dataset.get("meta", {}),
            "takt_metros_dia": 0,
            "cycle_time_dias": 0,
            "throughput_ns_semana": 0,
            "ns_planejadas_semana": 0,
            "ns_bloqueadas_semana": 0,
            "ext_planejada_semana": 0,
            "restricoes_lookahead": 0,
            "alerta_lookahead": "SEM DADOS",
            "valor_agregado_pct": 0,
            "co2_total_ton": 0,
            "custo_ciclo_vida_total": 0,
        }
    relatorio = gerar_relatorio_lean_lps(pvs, trechos, nucleo=nucleo or str(dataset.get("meta", {}).get("nucleo") or "TODOS"))

    takt = relatorio.get("lean", {}).get("takt_time", {})
    value_stream = relatorio.get("lean", {}).get("value_stream", {})
    weekly = relatorio.get("lps", {}).get("weekly_work_plan", {})
    lookahead = relatorio.get("lps", {}).get("lookahead_6sem", {})
    bim_6d = relatorio.get("bim_6d", {})

    return {
        "meta": relatorio.get("meta", {}),
        "infra": dataset.get("meta", {}),
        "takt_metros_dia": takt.get("takt_metros_dia", 0),
        "cycle_time_dias": takt.get("cycle_time_dias", 0),
        "throughput_ns_semana": takt.get("throughput_ns_semana", 0),
        "ns_planejadas_semana": weekly.get("ns_planejadas", 0),
        "ns_bloqueadas_semana": weekly.get("ns_bloqueadas", 0),
        "ext_planejada_semana": weekly.get("ext_planejada", 0),
        "restricoes_lookahead": lookahead.get("total_restricoes", 0),
        "alerta_lookahead": lookahead.get("alerta", "OK"),
        "valor_agregado_pct": value_stream.get("eficiencia_fluxo", 0),
        "co2_total_ton": bim_6d.get("co2_total_ton", 0),
        "custo_ciclo_vida_total": bim_6d.get("custo_ciclo_vida_total", 0),
    }


@router.get("/api/insights/perdas")
def api_insight_perdas(nucleo: str = Query(default="")):
    from motor_perdas import gerar_relatorio_perdas

    dataset, pvs, trechos = _network_inputs(nucleo=nucleo)
    if not trechos:
        return {
            "meta": {"nucleo": nucleo or "TODOS"},
            "infraestrutura": {},
            "uarl_m3_ano": 0,
            "uarl_litros_dia": 0,
            "ili": 0,
            "ili_classificacao": "SEM DADOS",
            "risco_total_ano": 0,
            "risco_por_nivel": {},
            "n_dmas": 0,
            "custo_ineficiencia_ano": 0,
        }
    relatorio = gerar_relatorio_perdas(pvs, trechos, nucleo=nucleo or str(dataset.get("meta", {}).get("nucleo") or "TODOS"))

    risco = relatorio.get("risco", {}).get("resumo", {})
    ili = relatorio.get("ili") or {}
    dmas = relatorio.get("dmas", {})
    projecao = relatorio.get("projecao_economica", {})
    infra = relatorio.get("infraestrutura", {})
    uarl = relatorio.get("uarl", {})

    return {
        "meta": relatorio.get("meta", {}),
        "infraestrutura": infra,
        "uarl_m3_ano": uarl.get("uarl_m3_ano", 0),
        "uarl_litros_dia": uarl.get("uarl_litros_dia", 0),
        "ili": ili.get("ili", 0),
        "ili_classificacao": ili.get("classificacao", "PROJETADO"),
        "risco_total_ano": risco.get("custo_risco_total_ano", 0),
        "risco_por_nivel": risco.get("por_nivel", {}),
        "n_dmas": dmas.get("n_dmas", 0),
        "custo_ineficiencia_ano": projecao.get("custo_total_ineficiencia_ano", 0),
    }


@router.get("/api/analytics/resumo")
def api_analytics_resumo():
    payload = None
    origem = ""
    for candidate in ANALYTICS_CANDIDATES:
        payload = _read_json_if_exists(candidate)
        if payload:
            origem = candidate.as_posix()
            break

    if not payload:
        return {
            "status": "empty",
            "algoritmo": "Indisponivel",
            "r2_test": 0,
            "mae": 0,
            "rmse": 0,
            "n_modelos": 0,
            "n_cenarios": 0,
            "n_nucleos": 0,
            "origem": "",
        }

    modelo = payload.get("modelo", {})
    cenarios = payload.get("cenarios", [])
    resumo_nucleos = payload.get("resumo_nucleos", {})
    melhor_cenario = min(cenarios, key=lambda item: item.get("dias_para_concluir", 10**9)) if cenarios else {}
    top_feature = (payload.get("feature_importance") or [{}])[0]

    return {
        "status": "ok",
        "gerado_em": payload.get("gerado_em"),
        "algoritmo": modelo.get("algoritmo", "Indisponivel"),
        "r2_test": modelo.get("r2_test", 0),
        "mae": modelo.get("mae", 0),
        "rmse": modelo.get("rmse", 0),
        "n_modelos": modelo.get("n_modelos", 0),
        "n_cenarios": len(cenarios),
        "n_nucleos": len(resumo_nucleos),
        "melhor_cenario": melhor_cenario,
        "top_feature": top_feature,
        "origem": origem,
    }
