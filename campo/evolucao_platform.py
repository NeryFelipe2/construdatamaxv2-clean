"""Evolucao 360: camada tipo Palantir sobre os dados operacionais."""
from __future__ import annotations

import json
from datetime import date, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.operational import fallback_deterministico, log_operational_event, tentar_xgboost
from core.database import dashboard_metricas, get_session
from core.models import (
    DesvioPlanejamento,
    MLExecucao,
    NS,
    OperationalLog,
    PlanejamentoSemanal,
    RDO,
    RDOMedicaoFonte,
    RDOQualidadeSinal,
    Replanejamento,
    SeveridadeDesvio,
    StatusPlanejamento,
)


def _enum_value(value: Any) -> str:
    return getattr(value, "value", value) or ""


def _json_loads(value: str | None, fallback: Any) -> Any:
    if not value:
        return fallback
    try:
        return json.loads(value)
    except Exception:
        return fallback


def _rdo_stmt(nucleo: str = ""):
    stmt = select(RDO).where(RDO.deleted_at.is_(None)).order_by(RDO.data.desc(), RDO.id.desc())
    if nucleo:
        stmt = stmt.where(RDO.nucleo == nucleo)
    return stmt


def _desvios_stmt(nucleo: str = ""):
    stmt = select(DesvioPlanejamento).order_by(DesvioPlanejamento.criado_em.desc())
    if nucleo:
        stmt = stmt.join(PlanejamentoSemanal).where(PlanejamentoSemanal.nucleo == nucleo)
    return stmt


def _last(items: list[Any], count: int) -> list[Any]:
    return items[:count] if items else []


def _score_status(score: float) -> str:
    if score >= 80:
        return "operacional"
    if score >= 55:
        return "em consolidacao"
    if score >= 30:
        return "parcial"
    return "sem base suficiente"


def _module(nome: str, palantir: str, explicacao: str, objetivo: str, memoria: str, status: str, score: float, dados: dict | None = None) -> dict:
    return {
        "evolucao": nome,
        "palantir_equivalente": palantir,
        "explicacao": explicacao,
        "objetivo": objetivo,
        "memoria_calculo": memoria,
        "status": status,
        "score": round(score, 1),
        "dados": dados or {},
    }


def _predicao(session: Session, nucleo: str = "") -> dict:
    rdos = session.execute(_rdo_stmt(nucleo)).scalars().all()
    desvios = session.execute(_desvios_stmt(nucleo)).scalars().all()
    hoje = date.today()
    janela = hoje - timedelta(days=30)
    recentes = [r for r in rdos if r.data and r.data >= janela]
    qtd_rdos = len(recentes)
    producao = sum(sum(a.quantidade or 0 for a in r.apontamentos) for r in recentes)
    custo = sum(r.total_custo or 0 for r in recentes)
    media_producao = producao / qtd_rdos if qtd_rdos else 0.0
    media_custo = custo / qtd_rdos if qtd_rdos else 0.0
    criticos = [d for d in desvios[:50] if _enum_value(d.severidade) in {"CRITICA", "ALTA"}]
    qualidade_aberta = session.execute(select(func.count(RDOQualidadeSinal.id)).where(RDOQualidadeSinal.status == "aberto")).scalar() or 0

    risco = 15
    risco += min(len(criticos) * 8, 45)
    risco += 15 if media_producao == 0 and qtd_rdos else 0
    risco += min(int(qualidade_aberta) * 2, 20)
    risco = min(risco, 95)
    tendencia = "estavel"
    if risco >= 70:
        tendencia = "risco alto"
    elif risco >= 45:
        tendencia = "atencao"
    elif media_producao > 0:
        tendencia = "controle operacional"

    return {
        "janela_dias": 30,
        "rdos": qtd_rdos,
        "producao_media_dia": round(media_producao, 3),
        "custo_medio_dia": round(media_custo, 2),
        "desvios_alta_critica": len(criticos),
        "qualidade_aberta": int(qualidade_aberta),
        "risco_percentual": risco,
        "tendencia": tendencia,
        "recomendacao": _decisao_texto(risco, len(criticos), qtd_rdos),
    }


def _decisao_texto(risco: int, desvios_fortes: int, rdos_30d: int) -> str:
    if rdos_30d == 0:
        return "Exigir alimentacao de RDO e planejamento antes de concluir predicao."
    if risco >= 70:
        return "Gerar replanejamento, validar com diretor e cobrar causa-raiz dos desvios fortes."
    if desvios_fortes:
        return "Manter plano oficial, mas criar plano de acao para desvios ALTA/CRITICA."
    return "Manter execucao e acompanhar produtividade nos proximos RDOs."


def _ontologia(session: Session, nucleo: str = "") -> dict:
    filters = [RDO.deleted_at.is_(None)]
    if nucleo:
        filters.append(RDO.nucleo == nucleo)
    rdos = session.execute(select(func.count(RDO.id)).where(*filters)).scalar() or 0
    ns_filter = [NS.nucleo == nucleo] if nucleo else []
    ns_count = session.execute(select(func.count(NS.id)).where(*ns_filter)).scalar() or 0
    planos_q = select(func.count(PlanejamentoSemanal.id))
    if nucleo:
        planos_q = planos_q.where(PlanejamentoSemanal.nucleo == nucleo)
    planos = session.execute(planos_q).scalar() or 0
    desvios = len(session.execute(_desvios_stmt(nucleo)).scalars().all())
    ml_q = select(func.count(MLExecucao.id))
    replan_q = select(func.count(Replanejamento.id))
    if nucleo:
        ml_q = ml_q.where(MLExecucao.nucleo == nucleo)
        replan_q = replan_q.where(Replanejamento.nucleo == nucleo)
    return {
        "nodes": [
            {"tipo": "obra_nucleo", "qtd": 1 if nucleo else "multi"},
            {"tipo": "nota_servico", "qtd": int(ns_count)},
            {"tipo": "rdo", "qtd": int(rdos)},
            {"tipo": "planejamento", "qtd": int(planos)},
            {"tipo": "desvio", "qtd": int(desvios)},
            {"tipo": "ml_execucao", "qtd": int(session.execute(ml_q).scalar() or 0)},
            {"tipo": "replanejamento", "qtd": int(session.execute(replan_q).scalar() or 0)},
        ],
        "edges": [
            "planejamento -> rdo",
            "rdo -> desvio",
            "desvio -> ml_execucao",
            "ml_execucao -> replanejamento",
            "rdo -> medicao",
            "rdo -> qualidade",
            "evidencia -> auditoria",
        ],
    }


def resumo_evolucao(nucleo: str = "") -> dict:
    with get_session() as session:
        metricas = dashboard_metricas(nucleo)
        rdos = session.execute(_rdo_stmt(nucleo)).scalars().all()
        desvios = session.execute(_desvios_stmt(nucleo)).scalars().all()
        plano_ativo = session.execute(
            select(PlanejamentoSemanal).where(
                PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
                *( [PlanejamentoSemanal.nucleo == nucleo] if nucleo else [] ),
            )
        ).scalars().first()
        medicao_count = session.execute(select(func.count(RDOMedicaoFonte.id))).scalar() or 0
        qualidade_count = session.execute(select(func.count(RDOQualidadeSinal.id)).where(RDOQualidadeSinal.status == "aberto")).scalar() or 0
        logs_count = session.execute(select(func.count(OperationalLog.id))).scalar() or 0
        ml_last = session.execute(
            select(MLExecucao).where(*( [MLExecucao.nucleo == nucleo] if nucleo else [] )).order_by(MLExecucao.criado_em.desc())
        ).scalars().first()
        replan_last = session.execute(
            select(Replanejamento).where(*( [Replanejamento.nucleo == nucleo] if nucleo else [] )).order_by(Replanejamento.criado_em.desc())
        ).scalars().first()
        pred = _predicao(session, nucleo)
        ontologia = _ontologia(session, nucleo)

        desvios_fortes = [d for d in desvios if _enum_value(d.severidade) in {"ALTA", "CRITICA"}]
        rdo_score = 90 if rdos else 20
        plano_score = 90 if plano_ativo else (45 if metricas.get("n_total") else 25)
        desvio_score = 85 if desvios else 35
        ml_score = 85 if ml_last else 45
        replan_score = 85 if replan_last else (60 if not desvios_fortes else 40)

        modules = [
            _module("Analise por machine learning", "Inteligencia sobre dados integrados", "Consolida RDO, planejamento, desvios e custos para gerar leitura operacional.", "Detectar padroes de produtividade, atraso e risco.", "MLExecucao + DesvioPlanejamento + RDO", _score_status(ml_score), ml_score, {"ultima_execucao": ml_last.to_dict() if ml_last else None}),
            _module("Decisao pos analise por machine learning", "Decisao assistida e auditavel", "Classifica severidade e recomenda acao com base nos desvios.", "Apoiar diretor e engenharia na decisao de manter plano ou corrigir rota.", "SPI, CPI, PPC, severidade e operational_log", _score_status(desvio_score), desvio_score, {"desvios": len(desvios), "fortes": len(desvios_fortes)}),
            _module("Predicao pos decisao", "Cenario operacional preditivo", "Calcula tendencia de risco com producao, custo, desvios e qualidade.", "Antecipar impacto de prazo, custo e produtividade.", "RDO 30 dias + desvios + qualidade", _score_status(75 if rdos else 30), 75 if rdos else 30, pred),
            _module("Replanejamento baseado em producao da machine learning", "Workflow de replanejamento", "Gera rascunho a partir de ML/fallback e aguarda validacao.", "Transformar desvio em novo plano oficial validado.", "Replanejamento + MLExecucao + PlanejamentoSemanal", _score_status(replan_score), replan_score, {"ultimo_replanejamento": replan_last.to_dict() if replan_last else None}),
            _module("RDO automatico e digital", "Captura de campo com evidencia preservada", "RDO digital ou automatico alimenta os demais modulos.", "Registrar uma vez e distribuir para gestao, medicao e qualidade.", "rdo + rdo_evidencia + rdo_extracao", _score_status(rdo_score), rdo_score, {"rdos": len(rdos)}),
            _module("Planejamento semanal", "Plano operacional rastreavel", "Transforma plano do engenheiro em entidade com meta, periodo e status.", "Dar referencia oficial para comparar planejado x realizado.", "PlanejamentoSemanal + PlanejamentoItem", _score_status(plano_score), plano_score, {"plano_ativo": plano_ativo.to_dict() if plano_ativo else None}),
            _module("Comparacao planejado x realizado", "Ontologia entre plano e execucao", "Cruza RDO e planejamento para criar desvios objetivos.", "Mostrar cumprimento, atraso, excesso ou custo fora da meta.", "gerar_desvios_rdo + DesvioPlanejamento", _score_status(desvio_score), desvio_score, {"desvios": _last([d.to_dict() for d in desvios], 10)}),
            _module("Desvios automaticos", "Alertas acionaveis", "Classifica evento operacional e transforma em sinal decisorio.", "Sair do modo reativo e agir antes da reuniao.", "calcular_metricas_desvio + classificar_severidade", _score_status(desvio_score), desvio_score),
            _module("Relatorio 360 / BI", "Visao executiva rastreavel", "Consolida producao, custo, qualidade e evidencias em leitura de BI.", "Dar uma tela unica para diretoria.", "dashboard_metricas + relatorio360", _score_status(80 if rdos else 35), 80 if rdos else 35, metricas),
            _module("Medicao rastreavel", "Fonte vinculada ao evento de campo", "Finalizacao de RDO vira fonte de medicao conferivel.", "Reduzir divergencia entre campo, medicao e financeiro.", "rdo_medicao_fonte", _score_status(80 if medicao_count else 35), 80 if medicao_count else 35, {"fontes_medicao": int(medicao_count)}),
            _module("Qualidade e evidencias", "Controle tecnico antes da consolidacao", "Gera pendencia quando falta evidencia ou FVS/checklist.", "Evitar medicao sem lastro tecnico.", "rdo_qualidade_sinal + rdo_foto + rdo_evidencia", _score_status(75 if rdos else 30), 75 if rdos else 30, {"pendencias_abertas": int(qualidade_count)}),
            _module("Fluxo financeiro projetado", "Projecao de caixa operacional", "Usa custo real, medicao e producao para leitura financeira.", "Antecipar caixa, margem e recebimento.", "RDO.total_custo + medicao + planilhas financeiras", _score_status(70 if metricas.get("custo_rdo_total") else 30), 70 if metricas.get("custo_rdo_total") else 30, {"custo_rdo_total": metricas.get("custo_rdo_total")}),
            _module("Auditoria e memoria operacional", "Historico de origem e decisao", "Mantem log de alteracoes, decisao, upload, erro e validacao.", "Permitir rastrear origem, responsavel e motivo.", "OperationalLog + deleted_at + evidencias", _score_status(80 if logs_count else 30), 80 if logs_count else 30, {"logs": int(logs_count)}),
            _module("XGBoost / fallback deterministico", "Modelo com contingencia explicavel", "Usa XGBoost quando houver modelo; caso contrario, fallback auditavel.", "Manter predicao funcionando sem depender cegamente de IA.", "tentar_xgboost + fallback_deterministico", _score_status(ml_score), ml_score, {"ultima_ml": ml_last.to_dict() if ml_last else None}),
        ]

        score_geral = round(sum(item["score"] for item in modules) / max(len(modules), 1), 1)
        return {
            "ok": True,
            "nucleo": nucleo or "TODOS",
            "score_geral": score_geral,
            "status_geral": _score_status(score_geral),
            "decisao_recomendada": pred["recomendacao"],
            "predicao": pred,
            "ontologia": ontologia,
            "modulos": modules,
        }


def executar_ciclo_evolucao(nucleo: str) -> dict:
    if not nucleo:
        return {"ok": False, "erro": "nucleo obrigatorio"}
    with get_session() as session:
        resultado = tentar_xgboost(session, nucleo)
        if not resultado.get("ok"):
            resultado = fallback_deterministico(session, nucleo)
        log_operational_event(
            session,
            subsystem="evolucao360",
            event_type="ciclo_evolucao_executado",
            nucleo=nucleo,
            payload=resultado,
        )
    resumo = resumo_evolucao(nucleo)
    return {"ok": True, "resultado_ml": resultado, "resumo": resumo}
