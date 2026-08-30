from __future__ import annotations

import math
import uuid
from datetime import datetime
from typing import Any


PMBOK_AREAS = {
    "escopo": "scope",
    "prazo": "schedule",
    "cronograma": "schedule",
    "custo": "cost",
    "financeiro": "cost",
    "qualidade": "quality",
    "recurso": "resource",
    "equipe": "resource",
    "comunicacao": "communication",
    "risco": "risk",
    "suprimento": "procurement",
    "contrato": "procurement",
    "stakeholder": "stakeholder",
    "integracao": "integration",
    "seguranca": "quality",
}

ARTIFACTS_BY_CLASS = {
    "desvio": ["issue_log", "work_performance_report", "decision_log"],
    "risco": ["risk_register", "risk_report", "decision_log"],
    "mudanca": ["change_request", "change_log", "decision_log"],
    "bloqueio": ["issue_log", "escalation_log", "decision_log"],
    "aprendizado": ["lessons_learned_register"],
}


def _float(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        number = float(str(value).replace(",", "."))
        return number if math.isfinite(number) else default
    except (TypeError, ValueError):
        return default


def _bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in {"1", "true", "sim", "yes", "y", "s"}


def _norm(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _percent_delta(realizado: float, planejado: float) -> float:
    if planejado == 0:
        return 0.0
    return ((realizado - planejado) / abs(planejado)) * 100.0


def classify_pmbok_area(payload: dict[str, Any]) -> str:
    text = " ".join(
        _norm(payload.get(k))
        for k in ("tipo", "categoria", "descricao", "causa", "impacto")
    )
    for key, area in PMBOK_AREAS.items():
        if key in text:
            return area
    if payload.get("custo_real") or payload.get("custo_planejado"):
        return "cost"
    if payload.get("prazo_planejado_dias") or payload.get("atraso_dias"):
        return "schedule"
    return "integration"


def classify_event(payload: dict[str, Any], area: str) -> str:
    text = " ".join(_norm(payload.get(k)) for k in ("tipo", "descricao", "causa", "impacto"))
    if any(term in text for term in ("mudanca", "alteracao de escopo", "baseline", "novo prazo", "aditivo")):
        return "mudanca"
    if any(term in text for term in ("risco", "probabilidade", "ameaca", "oportunidade")):
        return "risco"
    if _bool(payload.get("bloqueio")) or any(term in text for term in ("bloqueio", "impedimento", "paralisacao")):
        return "bloqueio"
    if area in {"scope", "schedule", "cost", "quality", "resource", "procurement"}:
        return "desvio"
    return "desvio"


def calculate_metrics(payload: dict[str, Any]) -> dict[str, Any]:
    planejado = _float(payload.get("planejado"))
    realizado = _float(payload.get("realizado"))
    custo_planejado = _float(payload.get("custo_planejado"))
    custo_real = _float(payload.get("custo_real"))
    valor_agregado = _float(payload.get("valor_agregado"), realizado)
    atraso_dias = _float(payload.get("atraso_dias"))
    prazo_planejado_dias = _float(payload.get("prazo_planejado_dias"))

    desvio_producao_pct = _percent_delta(realizado, planejado)
    desvio_custo_pct = _percent_delta(custo_real, custo_planejado) if custo_planejado else 0.0
    spi = (realizado / planejado) if planejado else 1.0
    cpi = (valor_agregado / custo_real) if custo_real else 1.0
    atraso_pct = (atraso_dias / prazo_planejado_dias * 100.0) if prazo_planejado_dias else 0.0

    return {
        "planejado": planejado,
        "realizado": realizado,
        "desvio_producao_pct": round(desvio_producao_pct, 2),
        "custo_planejado": custo_planejado,
        "custo_real": custo_real,
        "desvio_custo_pct": round(desvio_custo_pct, 2),
        "spi": round(spi, 3),
        "cpi": round(cpi, 3),
        "atraso_dias": atraso_dias,
        "atraso_pct": round(atraso_pct, 2),
    }


def severity_for(payload: dict[str, Any], metrics: dict[str, Any], event_class: str) -> str:
    if _bool(payload.get("seguranca")) or _bool(payload.get("legal")):
        return "critica"
    if event_class == "mudanca":
        return "alta"
    if event_class == "bloqueio":
        return "alta"

    desvio_prod = abs(_float(metrics.get("desvio_producao_pct")))
    desvio_custo = _float(metrics.get("desvio_custo_pct"))
    atraso_pct = _float(metrics.get("atraso_pct"))
    cpi = _float(metrics.get("cpi"), 1.0)
    spi = _float(metrics.get("spi"), 1.0)

    if desvio_prod >= 35 or desvio_custo >= 25 or atraso_pct >= 30 or cpi < 0.75 or spi < 0.65:
        return "critica"
    if desvio_prod >= 20 or desvio_custo >= 15 or atraso_pct >= 15 or cpi < 0.9 or spi < 0.8:
        return "alta"
    if desvio_prod >= 10 or desvio_custo >= 8 or atraso_pct >= 7 or cpi < 1.0 or spi < 0.95:
        return "media"
    return "baixa"


def governance_for(area: str, event_class: str, severity: str) -> dict[str, Any]:
    needs_director = severity in {"alta", "critica"} or event_class == "mudanca"
    needs_change_control = event_class == "mudanca" or (
        area in {"scope", "schedule", "cost"} and severity in {"alta", "critica"}
    )
    if severity == "critica":
        gate = "escalar_diretor"
    elif needs_change_control:
        gate = "controle_integrado_mudanca"
    elif severity == "alta":
        gate = "acao_corretiva"
    else:
        gate = "monitorar"

    return {
        "gate": gate,
        "aprovar_diretor": needs_director,
        "controle_integrado_mudanca": needs_change_control,
        "replanejamento_rascunho": severity in {"alta", "critica"} or event_class in {"mudanca", "bloqueio"},
    }


def recommended_actions(area: str, event_class: str, severity: str, metrics: dict[str, Any]) -> list[str]:
    actions: list[str] = []
    if event_class == "mudanca":
        actions.append("Abrir solicitacao de mudanca com impacto em escopo, prazo, custo e qualidade.")
        actions.append("Submeter ao diretor antes de alterar baseline oficial.")
    elif event_class == "risco":
        actions.append("Registrar no risk register com causa, probabilidade, impacto e dono.")
        actions.append("Definir resposta: mitigar, transferir, aceitar ou explorar.")
    elif event_class == "bloqueio":
        actions.append("Registrar issue e remover impedimento antes de manter atividade no plano semanal.")
        actions.append("Escalar responsavel se o bloqueio afetar prazo, custo ou seguranca.")
    else:
        actions.append("Registrar desvio no issue log e comparar planejado x realizado.")

    if area == "schedule" or _float(metrics.get("spi"), 1.0) < 0.95:
        actions.append("Gerar acao corretiva de cronograma e replanejamento em rascunho.")
    if area == "cost" or _float(metrics.get("cpi"), 1.0) < 1.0:
        actions.append("Revisar custo direto, indireto, locacoes, mao de obra e produtividade.")
    if area == "quality":
        actions.append("Vincular evidencia/FVS e bloquear medicao se faltar lastro tecnico.")
    if area == "procurement":
        actions.append("Cobrar suprimento/contrato e registrar impacto por falta de material/equipamento.")
    if severity in {"alta", "critica"}:
        actions.append("Levar para decisao do diretor com opcoes, impacto e recomendacao objetiva.")
    if not actions:
        actions.append("Manter monitoramento no proximo RDO.")
    return actions


def analyze_deviation(payload: dict[str, Any]) -> dict[str, Any]:
    area = classify_pmbok_area(payload)
    event_class = classify_event(payload, area)
    metrics = calculate_metrics(payload)
    severity = severity_for(payload, metrics, event_class)
    governance = governance_for(area, event_class, severity)
    artifacts = ARTIFACTS_BY_CLASS.get(event_class, ARTIFACTS_BY_CLASS["desvio"])
    actions = recommended_actions(area, event_class, severity, metrics)

    decision = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.utcnow().isoformat(),
        "projeto_id": payload.get("projeto_id"),
        "obra": payload.get("obra"),
        "origem": payload.get("origem", "manual"),
        "responsavel": payload.get("responsavel"),
        "pmbok_area": area,
        "classe": event_class,
        "severidade": severity,
        "metricas": metrics,
        "governanca": governance,
        "artefatos_pmbok": artifacts,
        "acoes_recomendadas": actions,
        "decisao_recomendada": {
            "tipo": governance["gate"],
            "titulo": build_decision_title(area, event_class, severity),
            "precisa_aprovacao": governance["aprovar_diretor"],
            "pode_alterar_baseline": governance["controle_integrado_mudanca"],
        },
        "registro": build_register_row(payload, area, event_class, severity, metrics, actions),
    }
    return decision


def build_decision_title(area: str, event_class: str, severity: str) -> str:
    label = {
        "scope": "escopo",
        "schedule": "prazo",
        "cost": "custo",
        "quality": "qualidade",
        "resource": "recursos",
        "communication": "comunicacao",
        "risk": "risco",
        "procurement": "suprimentos",
        "stakeholder": "stakeholders",
        "integration": "integracao",
    }.get(area, area)
    return f"{event_class} de {label} com severidade {severity}"


def build_register_row(
    payload: dict[str, Any],
    area: str,
    event_class: str,
    severity: str,
    metrics: dict[str, Any],
    actions: list[str],
) -> dict[str, Any]:
    return {
        "data": payload.get("data") or datetime.utcnow().date().isoformat(),
        "obra": payload.get("obra"),
        "local": payload.get("local"),
        "responsavel": payload.get("responsavel"),
        "descricao": payload.get("descricao"),
        "causa": payload.get("causa"),
        "impacto": payload.get("impacto"),
        "area_pmbok": area,
        "classe": event_class,
        "severidade": severity,
        "metricas": metrics,
        "acao_imediata": actions[0] if actions else "Monitorar",
        "status": "aberto",
    }


def analyze_batch(items: list[dict[str, Any]]) -> dict[str, Any]:
    analyses = [analyze_deviation(item) for item in items]
    summary = {
        "total": len(analyses),
        "criticas": sum(1 for item in analyses if item["severidade"] == "critica"),
        "altas": sum(1 for item in analyses if item["severidade"] == "alta"),
        "mudancas": sum(1 for item in analyses if item["classe"] == "mudanca"),
        "aprovacao_diretor": sum(1 for item in analyses if item["governanca"]["aprovar_diretor"]),
    }
    return {"resumo": summary, "items": analyses}


def build_engineer_daily_charge(payload: dict[str, Any]) -> dict[str, Any]:
    """Generate the daily accountability package for each engineer."""
    data_ref = payload.get("data") or datetime.utcnow().date().isoformat()
    engineers = payload.get("engenheiros") or []
    items = [build_engineer_charge_item(data_ref, item) for item in engineers]
    summary = {
        "data": data_ref,
        "total_engenheiros": len(items),
        "em_dia": sum(1 for item in items if item["status"] == "em_dia"),
        "cobrar": sum(1 for item in items if item["status"] == "cobrar"),
        "escalar": sum(1 for item in items if item["status"] == "escalar"),
    }
    return {
        "resumo": summary,
        "ritmo_diario": [
            {"hora": "07:30", "acao": "cobrar planejamento do dia, equipe, material e restricoes"},
            {"hora": "12:00", "acao": "checar bloqueios, seguranca, suprimentos e mudanca de frente"},
            {"hora": "17:30", "acao": "cobrar RDO, producao, custos, fotos, desvios e plano de amanha"},
            {"hora": "18:30", "acao": "escalar pendencias criticas para diretor"},
        ],
        "items": items,
    }


def build_engineer_charge_item(data_ref: str, engineer: dict[str, Any]) -> dict[str, Any]:
    nome = engineer.get("nome") or engineer.get("responsavel") or "Engenheiro"
    obra = engineer.get("obra") or "obra nao informada"
    pendencias: list[str] = []

    if not _bool(engineer.get("rdo_entregue")):
        pendencias.append("RDO diario nao entregue")
    if not _bool(engineer.get("planejamento_entregue")):
        pendencias.append("Planejamento do dia/semana nao entregue")
    if _float(engineer.get("desvios_abertos")) > 0 and not _bool(engineer.get("plano_acao_desvios")):
        pendencias.append("Desvios abertos sem plano de acao")
    if _float(engineer.get("fotos_pendentes")) > 0:
        pendencias.append("Fotos/evidencias pendentes")
    if _float(engineer.get("custos_pendentes")) > 0:
        pendencias.append("Custos do dia pendentes")
    if _float(engineer.get("medicao_pendente")) > 0:
        pendencias.append("Medicao/producao nao medida pendente")
    if _float(engineer.get("tarefas_vencidas")) > 0:
        pendencias.append("Tarefas LPS vencidas")

    reincidencias = int(_float(engineer.get("reincidencias")))
    criticidade = engineer_charge_severity(pendencias, reincidencias, engineer)
    status = "em_dia" if not pendencias else ("escalar" if criticidade in {"alta", "critica"} else "cobrar")
    mensagem = build_engineer_message(data_ref, nome, obra, pendencias, criticidade, engineer)

    return {
        "data": data_ref,
        "projeto_id": engineer.get("projeto_id") or engineer.get("project_id"),
        "engenheiro": nome,
        "obra": obra,
        "status": status,
        "criticidade": criticidade,
        "pendencias": pendencias,
        "reincidencias": reincidencias,
        "artefatos_pmbok": ["communication_log", "issue_log", "work_performance_report"],
        "escalar_para_diretor": status == "escalar",
        "mensagem_whatsapp": mensagem,
        "acao_sistema": {
            "criar_tarefa_lps": bool(pendencias),
            "registrar_log": True,
            "bloquear_fechamento_dia": status == "escalar",
        },
    }


def engineer_charge_severity(pendencias: list[str], reincidencias: int, engineer: dict[str, Any]) -> str:
    if not pendencias:
        return "baixa"
    if _bool(engineer.get("seguranca")) or _bool(engineer.get("impacto_diretor")):
        return "critica"
    if reincidencias >= 2 or len(pendencias) >= 4:
        return "alta"
    if len(pendencias) >= 2:
        return "media"
    return "baixa"


def build_engineer_message(
    data_ref: str,
    nome: str,
    obra: str,
    pendencias: list[str],
    criticidade: str,
    engineer: dict[str, Any],
) -> str:
    if not pendencias:
        return (
            f"{nome}, obra {obra} em dia em {data_ref}. "
            "Manter rotina: producao, fotos, custos, desvios e plano de amanha ate o fechamento."
        )
    linhas = "\n".join(f"- {item}" for item in pendencias)
    prazo = engineer.get("prazo_resposta") or ("18:30" if criticidade in {"alta", "critica"} else "17:30")
    return (
        f"{nome}, precisamos fechar a rotina PMBOK/ConstruData da obra {obra} em {data_ref}.\n"
        f"Pendencias:\n{linhas}\n"
        f"Por favor envie ate {prazo}: RDO, producao realizada, fotos, custos, desvios e plano de recuperacao quando houver.\n"
        "Sem isso o sistema mantem a pendencia aberta no issue log e pode escalar para validacao do diretor."
    )
