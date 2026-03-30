"""Dataset real para o viewer 3D/5D do /manage."""
from __future__ import annotations

import math
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.database import get_session
from core.models import NS, StatusNS
from motor_custo import custo_trecho

PV_COST_DEFAULT = 3686.0
PI_COST_DEFAULT = 1412.0


def _num(value: Any, default: float = 0.0) -> float:
    if value in (None, "", "-"):
        return default
    try:
        return float(value)
    except Exception:
        try:
            return float(str(value).replace(",", "."))
        except Exception:
            return default


def _finite(value: Any) -> bool:
    try:
        return math.isfinite(float(value))
    except Exception:
        return False


def _best_pv(current: dict[str, Any] | None, candidate: dict[str, Any]) -> dict[str, Any]:
    if current is None:
        return candidate

    def score(item: dict[str, Any]) -> int:
        points = 0
        for key in ("x", "y", "ct", "cf", "prof"):
            if _finite(item.get(key)):
                points += 1
        if item.get("tipo"):
            points += 1
        if item.get("material"):
            points += 1
        return points

    return candidate if score(candidate) > score(current) else current


def _node_type(nome: str, tipo: Any) -> str:
    raw_tipo = str(tipo or "").strip().upper()
    raw_nome = str(nome or "").strip().upper()
    if raw_tipo.startswith("PV") or raw_nome.startswith("PV"):
        return "PV"
    return "PI"


def _manning_n(material: Any) -> float:
    raw = str(material or "").strip().upper()
    if "PEAD" in raw or "PE80" in raw or "PE100" in raw:
        return 0.011
    if "FERRO" in raw or "FFD" in raw:
        return 0.012
    return 0.013


def _declive_m_m(ext_m: float, cf_ini: float, cf_fim: float, decl_mm: float | None) -> float:
    if ext_m > 0 and _finite(cf_ini) and _finite(cf_fim):
        slope = abs(cf_ini - cf_fim) / ext_m
        if slope > 0:
            return slope

    if decl_mm is not None and decl_mm > 0:
        if decl_mm <= 1:
            return decl_mm
        if decl_mm <= 100:
            return decl_mm / 100.0
        return decl_mm / 1000.0

    return 0.002


def _velocidade_manning(dn_mm: int, ext_m: float, cf_ini: float, cf_fim: float, decl_mm: float | None, material: Any) -> float:
    diametro_m = max(dn_mm, 0) / 1000.0
    if diametro_m <= 0:
        return 0.0

    slope = max(_declive_m_m(ext_m, cf_ini, cf_fim, decl_mm), 0.0001)
    n = _manning_n(material)
    raio_hidraulico = diametro_m / 4.0
    velocidade = (1.0 / n) * (raio_hidraulico ** (2.0 / 3.0)) * math.sqrt(slope)
    return round(max(0.0, min(velocidade, 8.5)), 2)


def _fase_ns(ns_obj: NS, ordem: int, total: int) -> int:
    if ns_obj.status == StatusNS.MEDIDA:
        return 12
    if ns_obj.status == StatusNS.CONCLUIDA:
        return 11
    if ns_obj.status == StatusNS.EM_EXECUCAO:
        return 6 + ((max(ordem, 1) - 1) % 4)
    if ns_obj.status == StatusNS.BLOQUEADA:
        return 2
    if total <= 1:
        return 1
    return max(1, min(5, 1 + int((max(ordem, 1) - 1) * 5 / max(total, 1))))


def _custos_trecho(tr_dict: dict[str, Any], pvs_index: dict[str, dict[str, Any]]) -> tuple[float, float, float, float, float]:
    detalhado = custo_trecho(tr_dict, pvs_index)
    itens = detalhado.get("itens", [])

    custo_tubo = sum(_num(item.get("valor"), 0.0) for item in itens if str(item.get("codigo", "")).startswith("TUB-"))
    custo_esc = sum(_num(item.get("valor"), 0.0) for item in itens if item.get("codigo") == "ESC-001")
    custo_reat = sum(_num(item.get("valor"), 0.0) for item in itens if item.get("codigo") == "REA-001")
    custo_total = _num(detalhado.get("total"), custo_tubo + custo_esc + custo_reat)
    custo_rep = max(custo_total - custo_tubo - custo_esc - custo_reat, 0.0)
    return (
        round(custo_tubo, 2),
        round(custo_esc, 2),
        round(custo_reat, 2),
        round(custo_rep, 2),
        round(custo_total, 2),
    )


def build_manage_dataset(nucleo: str = "") -> dict[str, Any]:
    with get_session() as session:
        stmt = select(NS).options(selectinload(NS.pvs), selectinload(NS.trechos)).order_by(NS.seq, NS.id)
        if nucleo:
            stmt = stmt.where(NS.nucleo == nucleo)
        ns_rows = session.execute(stmt).scalars().all()

    global_pvs: dict[str, dict[str, Any]] = {}
    for ns_obj in ns_rows:
        for pv in ns_obj.pvs:
            item = {
                "nome": pv.nome,
                "x": pv.x,
                "y": pv.y,
                "ct": pv.ct,
                "cf": pv.cf,
                "prof": pv.prof,
                "tipo": pv.tipo,
                "material": pv.material,
                "ns_id": pv.ns_id,
                "nucleo": ns_obj.nucleo,
            }
            global_pvs[pv.nome] = _best_pv(global_pvs.get(pv.nome), item)

    coords = [
        (_num(item.get("x"), math.nan), _num(item.get("y"), math.nan))
        for item in global_pvs.values()
        if _finite(item.get("x")) and _finite(item.get("y"))
    ]

    if not coords:
        return {
            "nodes": [],
            "edges": [],
            "ox": 0.0,
            "oy": 0.0,
            "ext": 0.0,
            "meta": {
                "nucleo": nucleo or "TODOS",
                "ns_total": len(ns_rows),
                "origem": "banco real",
                "contrato": "CT 11481051",
            },
        }

    ox = math.floor(min(x for x, _ in coords))
    oy = math.floor(min(y for _, y in coords))

    nodes: list[dict[str, Any]] = []
    for nome, pv in sorted(global_pvs.items()):
        x = _num(pv.get("x"), math.nan)
        y = _num(pv.get("y"), math.nan)
        if not (_finite(x) and _finite(y)):
            continue

        ct = _num(pv.get("ct"), 0.0)
        cf = _num(pv.get("cf"), ct)
        prof = _num(pv.get("prof"), max(ct - cf, 0.0))
        tipo = _node_type(nome, pv.get("tipo"))
        custo = PV_COST_DEFAULT if tipo == "PV" else PI_COST_DEFAULT

        nodes.append(
            {
                "n": str(nome),
                "x": round(x - ox, 2),
                "y": round(y - oy, 2),
                "ct": round(ct, 3),
                "cf": round(cf, 3),
                "p": round(prof, 2),
                "t": tipo,
                "c": round(custo, 2),
            }
        )

    edges: list[dict[str, Any]] = []
    total_ns = len(ns_rows)
    for ordem, ns_obj in enumerate(ns_rows, start=1):
        for trecho in ns_obj.trechos:
            pv_ini = str(trecho.pv_ini or ns_obj.pv_ini or "")
            pv_fim = str(trecho.pv_fim or ns_obj.pv_fim or "")
            pvi = global_pvs.get(pv_ini) or {}
            pvf = global_pvs.get(pv_fim) or {}

            x0 = _num(pvi.get("x"), math.nan)
            y0 = _num(pvi.get("y"), math.nan)
            x1 = _num(pvf.get("x"), math.nan)
            y1 = _num(pvf.get("y"), math.nan)
            if not all(_finite(value) for value in (x0, y0, x1, y1)):
                continue

            dn_mm = int(round(_num(trecho.dn_mm, _num(ns_obj.dn_mm, 200.0)))) or 200
            material = trecho.material or ns_obj.material or pvi.get("material") or pvf.get("material") or "PVC"
            ext_m = round(_num(trecho.ext_m, math.hypot(x1 - x0, y1 - y0)), 2)
            cf_ini = _num(trecho.cf_ini, _num(pvi.get("cf"), _num(pvi.get("ct"), 0.0)))
            cf_fim = _num(trecho.cf_fim, _num(pvf.get("cf"), _num(pvf.get("ct"), 0.0)))
            decl_mm = _num(trecho.decl_mm, math.nan)
            decl_m_m = _declive_m_m(ext_m, cf_ini, cf_fim, None if math.isnan(decl_mm) else decl_mm)
            vel_ms = _velocidade_manning(dn_mm, ext_m, cf_ini, cf_fim, None if math.isnan(decl_mm) else decl_mm, material)

            tr_dict = {
                "pv_ini": pv_ini,
                "pv_fim": pv_fim,
                "ext_m": ext_m,
                "dn_mm": dn_mm,
                "material": material,
                "ct_ini": _num(trecho.ct_ini, _num(pvi.get("ct"), 0.0)),
                "cf_ini": cf_ini,
                "ct_fim": _num(trecho.ct_fim, _num(pvf.get("ct"), 0.0)),
                "cf_fim": cf_fim,
                "decl_mm": None if math.isnan(decl_mm) else decl_mm,
                "tipo": "esgoto",
            }
            custo_tubo, custo_esc, custo_reat, custo_rep, custo_total = _custos_trecho(tr_dict, global_pvs)

            edges.append(
                {
                    "a": pv_ini,
                    "b": pv_fim,
                    "codigo": f"NS_{ns_obj.seq:03d}" if ns_obj.seq else None,
                    "status": ns_obj.status.value if ns_obj.status else "PLANEJADA",
                    "dn": dn_mm,
                    "x0": round(x0 - ox, 2),
                    "y0": round(y0 - oy, 2),
                    "z0": round(cf_ini, 3),
                    "x1": round(x1 - ox, 2),
                    "y1": round(y1 - oy, 2),
                    "z1": round(cf_fim, 3),
                    "ext": ext_m,
                    "mat": str(material),
                    "v": vel_ms,
                    "decl_pct": round(decl_m_m * 100.0, 3),
                    "ct": custo_tubo,
                    "ce": custo_esc,
                    "cr": custo_reat,
                    "cp": custo_rep,
                    "c": custo_total,
                    "ph": _fase_ns(ns_obj, ordem, total_ns),
                }
            )

    return {
        "nodes": nodes,
        "edges": edges,
        "ox": float(ox),
        "oy": float(oy),
        "ext": round(sum(edge["ext"] for edge in edges), 2),
        "meta": {
            "nucleo": nucleo or "TODOS",
            "ns_total": len(ns_rows),
            "trechos": len(edges),
            "pontos": len(nodes),
            "origem": "banco real",
            "contrato": "CT 11481051",
        },
    }
