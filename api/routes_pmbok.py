from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.operational import log_operational_event
from api.pmbok_decision_engine import analyze_batch, analyze_deviation, build_engineer_daily_charge
from api.supabase_client import canonical_project_id, is_rk_project

router = APIRouter(prefix="/api/pmbok", tags=["pmbok"])


def _scoped_rk_payload(payload: dict, *, required: bool = True) -> dict:
    project_id = canonical_project_id(payload.get("projeto_id") or payload.get("project_id"))
    if project_id and not is_rk_project(project_id):
        raise HTTPException(status_code=404, detail="Projeto fora do escopo RK dos agentes")
    if required and not project_id:
        raise HTTPException(status_code=400, detail="projeto_id RK obrigatorio")
    return {**payload, "projeto_id": project_id} if project_id else dict(payload)


def _scoped_rk_items(items: list[dict], fallback_project_id: str | None = None) -> list[dict]:
    scoped: list[dict] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        project_id = canonical_project_id(item.get("projeto_id") or item.get("project_id") or fallback_project_id)
        if is_rk_project(project_id):
            scoped.append({**item, "projeto_id": project_id})
    return scoped


@router.get("/matriz")
def get_pmbok_matrix():
    return {
        "gates": ["monitorar", "acao_corretiva", "controle_integrado_mudanca", "escalar_diretor"],
        "artefatos": [
            "issue_log",
            "risk_register",
            "change_request",
            "change_log",
            "decision_log",
            "lessons_learned_register",
            "work_performance_report",
            "communication_log",
        ],
        "limiares": {
            "media": "desvio >= 10%, custo >= 8%, atraso >= 7%, CPI < 1.0 ou SPI < 0.95",
            "alta": "desvio >= 20%, custo >= 15%, atraso >= 15%, CPI < 0.90 ou SPI < 0.80",
            "critica": "desvio >= 35%, custo >= 25%, atraso >= 30%, CPI < 0.75, SPI < 0.65, seguranca ou legal",
        },
    }


@router.post("/desvios/analisar")
def post_analyze_deviation(payload: dict):
    payload = _scoped_rk_payload(payload)
    result = analyze_deviation(payload)
    log_operational_event(
        subsystem="pmbok_decision_engine",
        severity="warning" if result["severidade"] in {"alta", "critica"} else "info",
        status="open" if result["governanca"]["aprovar_diretor"] else "observed",
        project_id=payload.get("projeto_id"),
        payload=result,
        origem=payload.get("origem", "api_pmbok"),
    )
    return result


@router.post("/desvios/analisar-lote")
def post_analyze_deviation_batch(payload: dict):
    payload = _scoped_rk_payload(payload, required=False)
    items = _scoped_rk_items(payload.get("items") or [], payload.get("projeto_id"))
    if not items:
        raise HTTPException(status_code=404, detail="Nenhum item RK para analisar")
    result = analyze_batch(items)
    log_operational_event(
        subsystem="pmbok_decision_batch",
        severity="warning" if result["resumo"]["criticas"] or result["resumo"]["altas"] else "info",
        status="open",
        project_id=payload.get("projeto_id") or items[0].get("projeto_id"),
        payload=result["resumo"],
        origem=payload.get("origem", "api_pmbok"),
    )
    return result


@router.post("/decisoes/registrar")
def post_register_decision(payload: dict):
    payload = _scoped_rk_payload(payload)
    analysis = analyze_deviation(payload)
    analysis["status_decisao"] = payload.get("status_decisao", "rascunho")
    analysis["decisor"] = payload.get("decisor")
    analysis["decisao_final"] = payload.get("decisao_final")
    log_operational_event(
        subsystem="pmbok_decision_log",
        severity="warning" if analysis["governanca"]["aprovar_diretor"] else "info",
        status=analysis["status_decisao"],
        project_id=payload.get("projeto_id"),
        payload=analysis,
        origem=payload.get("origem", "api_pmbok"),
    )
    return analysis


@router.post("/cobranca/engenheiros")
def post_engineer_daily_charge(payload: dict):
    payload = _scoped_rk_payload(payload, required=False)
    engineers = _scoped_rk_items(payload.get("engenheiros") or [], payload.get("projeto_id"))
    if not engineers:
        raise HTTPException(status_code=404, detail="Nenhum engenheiro RK para cobrar")
    payload = {**payload, "engenheiros": engineers}
    result = build_engineer_daily_charge(payload)
    log_operational_event(
        subsystem="pmbok_engineer_daily_charge",
        severity="warning" if result["resumo"]["escalar"] else "info",
        status="open" if result["resumo"]["cobrar"] or result["resumo"]["escalar"] else "closed",
        project_id=payload.get("projeto_id") or engineers[0].get("projeto_id"),
        payload=result["resumo"],
        origem=payload.get("origem", "api_pmbok"),
    )
    return result
