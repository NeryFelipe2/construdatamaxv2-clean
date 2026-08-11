"""Camada web ns-v5 para expor os motores do NOVA NS V5 ao ConstruDataWeb."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import selectinload

from core.construdata_offline import (
    dashboard_counts,
    get_project,
    list_entity,
    list_projects,
    nucleos_do_projeto,
)
from core.database import criar_banco, get_session
from core.models import (
    DesvioPlanejamento,
    MLExecucao,
    NS,
    OperationalLog,
    PlanejamentoSemanal,
    RDO,
    Replanejamento,
)

NS_V5_MODULES = [
    {"key": "processar_ns", "title": "Processar / Nota de Servico", "api": ["/api/ns", "/api/ns/{id}"], "status": "api"},
    {"key": "mapa_gis", "title": "Mapa / GIS", "api": ["/api/projetos/{id}/torre", "/api/ns"], "status": "api"},
    {"key": "rede", "title": "Rede", "api": ["/api/ns"], "status": "api"},
    {"key": "hidraulica", "title": "Hidraulica", "api": ["/api/ns"], "status": "contrato"},
    {"key": "trechos", "title": "Trechos", "api": ["/api/ns"], "status": "api"},
    {"key": "custos_medicao", "title": "Custos 5D / Medicao", "api": ["/api/projetos/{id}/financeiro", "/api/rdo/{id}/medicao-fontes"], "status": "api"},
    {"key": "bim_ifc", "title": "BIM / IFC", "api": ["/api/ns-v5/projects/{id}/snapshot"], "status": "contrato"},
    {"key": "lean_lps", "title": "Lean / LPS", "api": ["/api/projetos/{id}/lps-restricoes"], "status": "api"},
    {"key": "perdas", "title": "Perdas", "api": ["/api/bi/analytics"], "status": "api"},
    {"key": "ia_analytics", "title": "IA / Analytics / XGBoost", "api": ["/api/evolucao", "/api/projetos/{id}/ml/recalcular-desvios"], "status": "api"},
    {"key": "nucleos_projetos", "title": "Nucleos / Projetos", "api": ["/api/projetos", "/api/nucleos"], "status": "api"},
    {"key": "logs_auditoria", "title": "Log / Auditoria", "api": ["/api/projetos/{id}/logs"], "status": "api"},
    {"key": "torre_controle", "title": "Torre Controle", "api": ["/api/projetos/{id}/torre"], "status": "api"},
    {"key": "gestao_relatorio_bi", "title": "Gestao 360 / Relatorio 360 / BI", "api": ["/api/projetos/{id}/gestao360", "/api/bi/analytics"], "status": "api"},
]

DATA_CONTRACTS = {
    "projeto_nucleo": ["id", "nome", "nucleo", "cidade", "tipo", "contrato", "responsavel", "status"],
    "ns_pv_trecho": ["id", "numero", "nucleo", "status", "rede", "extensao_m", "pvs", "trechos"],
    "rdo": ["id", "data", "numero", "nucleo", "responsavel", "origem", "status_revisao", "apontamentos", "equipe", "ocorrencias", "fotos", "evidencias"],
    "planejamento": ["id", "nucleo", "semana_inicio", "semana_fim", "status", "itens", "validacoes"],
    "desvio_replanejamento": ["atividade", "meta", "realizado", "ppc", "severidade", "acao_recomendada", "status"],
    "custo_medicao_fluxo": ["categoria", "descricao", "valor", "data", "origem", "medicao_fontes"],
    "bi_analytics": ["rdos", "producao", "custos", "desvios", "predicao", "export_pdf", "export_excel"],
}


def _public(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if hasattr(value, "value"):
        return value.value
    return value


def _row_dict(row: Any) -> dict[str, Any]:
    if row is None:
        return {}
    if hasattr(row, "to_dict"):
        return row.to_dict()
    if hasattr(row, "__table__"):
        return {col.name: _public(getattr(row, col.name)) for col in row.__table__.columns}
    return dict(row)


def _project_dict(project: Any) -> dict[str, Any]:
    return {
        "id": project.id,
        "nome": project.nome,
        "nucleo": project.nucleo,
        "cidade": project.cidade,
        "tipo": project.tipo,
        "contrato": project.contrato,
        "responsavel": project.responsavel,
        "status": project.status,
    }


def listar_modulos_ns_v5() -> dict[str, Any]:
    return {"items": NS_V5_MODULES, "total": len(NS_V5_MODULES)}


def contratos_ns_v5() -> dict[str, Any]:
    return {"contracts": DATA_CONTRACTS, "version": "ns-v5-web-1"}


def listar_projetos_ns_v5() -> dict[str, Any]:
    return {"items": [_project_dict(p) for p in list_projects()]}


def snapshot_ns_v5(project_id: str) -> dict[str, Any]:
    criar_banco()
    project = get_project(project_id=project_id)
    nucleos = nucleos_do_projeto(project)
    counts = dashboard_counts(project.id)
    custos = [_row_dict(c) for c in list_entity("custos", project.id)]
    tarefas = [_row_dict(t) for t in list_entity("tarefas", project.id)]
    lps = [_row_dict(r) for r in list_entity("lps", project.id)]
    with get_session() as session:
        rdos = session.execute(
            select(RDO)
            .options(selectinload(RDO.apontamentos), selectinload(RDO.equipe), selectinload(RDO.ocorrencias), selectinload(RDO.fotos), selectinload(RDO.evidencias))
            .where(RDO.nucleo.in_(nucleos), RDO.deleted_at.is_(None))
            .order_by(RDO.data.desc(), RDO.id.desc())
            .limit(80)
        ).scalars().all()
        ns = session.execute(select(NS).where(NS.nucleo.in_(nucleos)).order_by(NS.id.desc()).limit(80)).scalars().all()
        planos = session.execute(
            select(PlanejamentoSemanal)
            .options(selectinload(PlanejamentoSemanal.itens), selectinload(PlanejamentoSemanal.validacoes))
            .where(PlanejamentoSemanal.nucleo.in_(nucleos))
            .order_by(PlanejamentoSemanal.criado_em.desc())
            .limit(20)
        ).scalars().all()
        desvios = session.execute(
            select(DesvioPlanejamento)
            .join(PlanejamentoSemanal)
            .where(PlanejamentoSemanal.nucleo.in_(nucleos))
            .order_by(DesvioPlanejamento.criado_em.desc())
            .limit(60)
        ).scalars().all()
        replans = session.execute(select(Replanejamento).where(Replanejamento.nucleo.in_(nucleos)).order_by(Replanejamento.criado_em.desc()).limit(30)).scalars().all()
        logs = session.execute(select(OperationalLog).where(OperationalLog.nucleo.in_(nucleos)).order_by(OperationalLog.criado_em.desc()).limit(30)).scalars().all()
        ml = session.execute(select(MLExecucao).where(MLExecucao.nucleo.in_(nucleos)).order_by(MLExecucao.criado_em.desc()).limit(10)).scalars().all()
    rdo_dicts = [_row_dict(r) for r in rdos]
    desvio_dicts = [_row_dict(d) for d in desvios]
    ppcs = [d.get("ppc") for d in desvio_dicts if d.get("ppc") is not None]
    kpis = {
        "rdos_total": len(rdo_dicts),
        "ns_total": len(ns),
        "planejamentos_total": len(planos),
        "desvios_total": len(desvio_dicts),
        "desvios_criticos": len([d for d in desvio_dicts if str(d.get("severidade", "")).upper() in {"ALTA", "CRITICA", "CRÍTICA"}]),
        "replanejamentos_total": len(replans),
        "ppc_medio": round(sum(ppcs) / len(ppcs), 2) if ppcs else 0,
        "custo_total": round(sum(float(c.get("valor") or 0) for c in custos), 2),
        **counts,
    }
    return {
        "ok": True,
        "version": "ns-v5-web-1",
        "projeto": _project_dict(project),
        "nucleos": nucleos,
        "modules": NS_V5_MODULES,
        "contracts": DATA_CONTRACTS,
        "kpis": kpis,
        "rdos": rdo_dicts[:40],
        "ns": [_row_dict(row) for row in ns[:40]],
        "planejamentos": [_row_dict(row) for row in planos[:10]],
        "desvios": desvio_dicts[:30],
        "replanejamentos": [_row_dict(row) for row in replans[:20]],
        "logs": [_row_dict(row) for row in logs[:20]],
        "ml": [_row_dict(row) for row in ml[:10]],
        "custos": custos[:30],
        "tarefas": tarefas[:30],
        "lps": lps[:30],
    }


def module_payload(project_id: str, module_key: str) -> dict[str, Any]:
    snap = snapshot_ns_v5(project_id)
    module = next((m for m in NS_V5_MODULES if m["key"] == module_key), None)
    if not module:
        raise KeyError(module_key)
    data_map = {
        "processar_ns": snap["ns"],
        "mapa_gis": {"projeto": snap["projeto"], "nucleos": snap["nucleos"], "ns": snap["ns"][:12], "rdos": snap["rdos"][:12]},
        "rede": snap["ns"],
        "hidraulica": snap["ns"],
        "trechos": snap["ns"],
        "custos_medicao": {"custos": snap["custos"], "rdos": snap["rdos"]},
        "bim_ifc": {"ns": snap["ns"], "status": "contrato_web"},
        "lean_lps": snap["lps"],
        "perdas": {"bi_endpoint": "/api/bi/analytics", "desvios": snap["desvios"]},
        "ia_analytics": {"ml": snap["ml"], "desvios": snap["desvios"]},
        "nucleos_projetos": {"projeto": snap["projeto"], "nucleos": snap["nucleos"]},
        "logs_auditoria": snap["logs"],
        "torre_controle": {"kpis": snap["kpis"], "rdos": snap["rdos"], "desvios": snap["desvios"]},
        "gestao_relatorio_bi": {"kpis": snap["kpis"], "bi_endpoint": "/api/bi/analytics"},
    }
    return {"module": module, "project": snap["projeto"], "items": data_map.get(module_key, [])}
