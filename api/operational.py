"""Helper centralizado do Ciclo Operacional — ConstruData NS5.

Funcoes:
  - log_operational_event()     → grava log no SQLite
  - gerar_desvios_rdo()         → compara RDO vs planejamento ativo
  - calcular_metricas_desvio()  → SPI, CPI, PPC
  - classificar_severidade()    → regra de severidade
  - fallback_deterministico()   → score por desvio → replanejamento rascunho
  - tentar_xgboost()            → XGBoost se disponivel, senao fallback
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime
from typing import Any, Optional

from sqlalchemy.orm import Session

from core.models import (
    DesvioPlanejamento,
    MLExecucao,
    OperationalLog,
    PlanejamentoItem,
    PlanejamentoSemanal,
    PlanejamentoValidacao,
    RDO,
    Replanejamento,
    SeveridadeDesvio,
    StatusPlanejamento,
    StatusReplanejamento,
)

logger = logging.getLogger("operational")


# ---------------------------------------------------------------------------
# 1. Log Operacional
# ---------------------------------------------------------------------------

def log_operational_event(
    session: Session,
    subsystem: str,
    event_type: str,
    severity: str = "INFO",
    status: str = "OK",
    error_message: str | None = None,
    payload: dict | None = None,
    project_id: str | None = None,
    telefone: str | None = None,
    nucleo: str | None = None,
) -> OperationalLog:
    """Grava um evento operacional no banco."""
    log_entry = OperationalLog(
        subsystem=subsystem,
        event_type=event_type,
        severity=severity,
        status=status,
        error_message=error_message,
        payload=json.dumps(payload, ensure_ascii=False, default=str) if payload else None,
        project_id=project_id,
        telefone=telefone,
        nucleo=nucleo,
    )
    session.add(log_entry)
    session.flush()
    logger.info("[%s] %s → %s (%s)", subsystem, event_type, status, severity)
    return log_entry


# ---------------------------------------------------------------------------
# 2. Metricas de Desvio
# ---------------------------------------------------------------------------

def calcular_metricas_desvio(
    meta: float | None,
    realizado: float | None,
    custo_previsto: float | None = None,
    custo_real: float | None = None,
) -> dict:
    """Calcula SPI, CPI, PPC e desvios percentuais."""
    meta = meta or 0.0
    realizado = realizado or 0.0
    custo_previsto = custo_previsto or 0.0
    custo_real = custo_real or 0.0

    desvio_qty = realizado - meta
    desvio_pct = ((realizado - meta) / meta * 100) if meta != 0 else 0.0

    # SPI = realizado / meta  (> 1 = adiantado)
    spi = (realizado / meta) if meta != 0 else 1.0

    # CPI = custo previsto / custo real  (> 1 = abaixo do orcamento)
    cpi = (custo_previsto / custo_real) if custo_real != 0 else 1.0

    # PPC = Percent Plan Complete
    ppc = min((realizado / meta * 100), 100.0) if meta > 0 else 0.0

    # Desvio de custo
    desvio_custo = custo_real - custo_previsto

    return {
        "desvio_quantidade": round(desvio_qty, 4),
        "desvio_percentual": round(desvio_pct, 2),
        "desvio_custo": round(desvio_custo, 2),
        "spi": round(spi, 4),
        "cpi": round(cpi, 4),
        "ppc": round(ppc, 2),
    }


def classificar_severidade(desvio_pct: float, desvio_custo_pct: float = 0.0) -> SeveridadeDesvio:
    """Classifica a severidade do desvio.

    Regra:
      |desvio| > 50% ou |custo| > 50%  → CRITICA
      |desvio| > 30% ou |custo| > 30%  → ALTA
      |desvio| > 15% ou |custo| > 15%  → MEDIA
      Senao                            → BAIXA
    """
    abs_d = abs(desvio_pct)
    abs_c = abs(desvio_custo_pct)
    worst = max(abs_d, abs_c)

    if worst > 50:
        return SeveridadeDesvio.CRITICA
    elif worst > 30:
        return SeveridadeDesvio.ALTA
    elif worst > 15:
        return SeveridadeDesvio.MEDIA
    return SeveridadeDesvio.BAIXA


def _acao_recomendada(severidade: SeveridadeDesvio, desvio_pct: float) -> str:
    """Gera texto de acao recomendada baseado na severidade."""
    if severidade == SeveridadeDesvio.CRITICA:
        if desvio_pct < 0:
            return "ACAO URGENTE: Atividade muito abaixo da meta. Realocar equipe e revisar restricoes imediatamente."
        return "ATENCAO: Atividade superou meta em mais de 50%. Verificar se houve erro de medicao."
    elif severidade == SeveridadeDesvio.ALTA:
        if desvio_pct < 0:
            return "Atividade com atraso significativo. Avaliar aumento de equipe ou resequenciamento."
        return "Meta superada significativamente. Confirmar dados e ajustar proximo planejamento."
    elif severidade == SeveridadeDesvio.MEDIA:
        return "Desvio moderado detectado. Monitorar nos proximos RDOs."
    return "Desvio dentro do aceitavel. Nenhuma acao necessaria."


def _norm_text(value: Any) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _realizado_do_item(item: PlanejamentoItem, rdo: RDO | None, total_rdo: float, only_item: bool) -> float:
    if not rdo:
        return 0.0
    apontamentos = list(rdo.apontamentos or [])
    if only_item:
        return round(sum(a.quantidade or 0 for a in apontamentos), 4)
    atividade = _norm_text(item.atividade)
    total = 0.0
    for apontamento in apontamentos:
        servico = _norm_text(apontamento.servico)
        if atividade and (atividade in servico or servico in atividade):
            total += apontamento.quantidade or 0
    if total == 0.0 and len(apontamentos) == 1:
        total = apontamentos[0].quantidade or 0
    return round(total, 4)


# ---------------------------------------------------------------------------
# 3. Geracao de Desvios a partir de RDO
# ---------------------------------------------------------------------------

def gerar_desvios_rdo(
    session: Session,
    rdo_id: int,
    nucleo: str,
    rdo_data: date | None = None,
) -> list[dict]:
    """Compara itens do RDO com o planejamento ativo do nucleo na semana.

    Retorna lista de desvios gerados.
    """
    hoje = rdo_data or date.today()

    # Buscar planejamento ativo para o nucleo que cobre a data do RDO
    plano = (
        session.query(PlanejamentoSemanal)
        .filter(
            PlanejamentoSemanal.nucleo == nucleo,
            PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
            PlanejamentoSemanal.semana_inicio <= hoje,
            PlanejamentoSemanal.semana_fim >= hoje,
        )
        .first()
    )
    if not plano:
        logger.info("Nenhum planejamento ativo para nucleo=%s na data=%s", nucleo, hoje)
        return []

    rdo = session.get(RDO, rdo_id)
    total_realizado_rdo = sum(a.quantidade or 0 for a in (rdo.apontamentos if rdo else []))
    custo_real_rdo = sum(a.custo_total or 0 for a in (rdo.apontamentos if rdo else []))
    only_item = len(plano.itens or []) == 1

    desvios_gerados = []
    for item in plano.itens:
        meta = item.meta_quantidade or 0.0
        realizado = _realizado_do_item(item, rdo, total_realizado_rdo, only_item)
        custo_real_item = custo_real_rdo if only_item else 0.0

        metricas = calcular_metricas_desvio(meta, realizado, item.custo_previsto, custo_real_item)
        desvio_custo_pct = (
            ((custo_real_item - (item.custo_previsto or 0.0)) / (item.custo_previsto or 1.0) * 100)
            if item.custo_previsto
            else 0.0
        )
        severidade = classificar_severidade(metricas["desvio_percentual"], desvio_custo_pct)

        desvio = DesvioPlanejamento(
            planejamento_id=plano.id,
            rdo_id=rdo_id,
            item_id=item.id,
            atividade=item.atividade,
            meta=meta,
            realizado=realizado,
            desvio_quantidade=metricas["desvio_quantidade"],
            desvio_percentual=metricas["desvio_percentual"],
            desvio_custo=metricas["desvio_custo"],
            severidade=severidade,
            spi=metricas["spi"],
            cpi=metricas["cpi"],
            ppc=metricas["ppc"],
            acao_recomendada=_acao_recomendada(severidade, metricas["desvio_percentual"]),
        )
        session.add(desvio)
        desvios_gerados.append(desvio)

    session.flush()

    # Log do evento
    log_operational_event(
        session,
        subsystem="desvios",
        event_type="desvios_gerados_rdo",
        nucleo=nucleo,
        payload={"rdo_id": rdo_id, "n_desvios": len(desvios_gerados), "plano_id": plano.id},
    )

    return [d.to_dict() for d in desvios_gerados]


# ---------------------------------------------------------------------------
# 4. ML / Fallback Deterministico
# ---------------------------------------------------------------------------

def fallback_deterministico(session: Session, nucleo: str) -> dict:
    """Analisa desvios ativos e gera replanejamento rascunho via regras.

    Score por desvio:
      CRITICA=4, ALTA=3, MEDIA=2, BAIXA=1
      Total > 10 → replanejamento urgente
    """
    # Buscar plano ativo
    plano = (
        session.query(PlanejamentoSemanal)
        .filter(
            PlanejamentoSemanal.nucleo == nucleo,
            PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
        )
        .first()
    )
    if not plano:
        return {"ok": False, "erro": "Nenhum planejamento ativo para o nucleo"}

    desvios = plano.desvios or []
    if not desvios:
        return {"ok": False, "erro": "Nenhum desvio encontrado para analisar"}

    peso = {
        SeveridadeDesvio.CRITICA: 4,
        SeveridadeDesvio.ALTA: 3,
        SeveridadeDesvio.MEDIA: 2,
        SeveridadeDesvio.BAIXA: 1,
    }

    score_total = 0
    sugestoes = []
    for d in desvios:
        sev = d.severidade if isinstance(d.severidade, SeveridadeDesvio) else SeveridadeDesvio(d.severidade)
        p = peso.get(sev, 1)
        score_total += p
        if p >= 3:
            sugestoes.append({
                "item_id": d.item_id,
                "atividade": d.atividade,
                "desvio_pct": d.desvio_percentual,
                "severidade": sev.value,
                "sugestao": d.acao_recomendada or "Revisar atividade",
            })

    confianca = min(len(desvios) / 10.0, 1.0)

    # Gravar execucao ML
    ml_exec = MLExecucao(
        nucleo=nucleo,
        tipo="fallback",
        resultado_json=json.dumps({
            "score_total": score_total,
            "n_desvios": len(desvios),
            "sugestoes": sugestoes,
        }, ensure_ascii=False, default=str),
        n_desvios=len(desvios),
        confianca=round(confianca, 2),
    )
    session.add(ml_exec)
    session.flush()

    # Gerar replanejamento rascunho se score alto
    replan = None
    if score_total >= 6 or any(s.get("severidade") == "CRITICA" for s in sugestoes):
        replan = Replanejamento(
            nucleo=nucleo,
            ml_execucao_id=ml_exec.id,
            status=StatusReplanejamento.RASCUNHO,
            sugestoes_json=json.dumps(sugestoes, ensure_ascii=False, default=str),
        )
        session.add(replan)
        session.flush()

    log_operational_event(
        session,
        subsystem="ml",
        event_type="fallback_executado",
        nucleo=nucleo,
        payload={
            "ml_execucao_id": ml_exec.id,
            "score_total": score_total,
            "replanejamento_id": replan.id if replan else None,
        },
    )

    return {
        "ok": True,
        "tipo": "fallback",
        "ml_execucao": ml_exec.to_dict(),
        "score_total": score_total,
        "sugestoes": sugestoes,
        "replanejamento": replan.to_dict() if replan else None,
    }


def tentar_xgboost(session: Session, nucleo: str) -> dict:
    """Tenta usar XGBoost para analise de desvios. Se nao disponivel, usa fallback."""
    try:
        import xgboost as xgb  # noqa: F401
        # TODO: Implementar modelo XGBoost treinado com historico de desvios
        # Por enquanto, cai no fallback
        logger.info("XGBoost disponivel mas modelo nao treinado — usando fallback")
    except ImportError:
        logger.info("XGBoost nao instalado — usando fallback deterministico")

    return fallback_deterministico(session, nucleo)


def aplicar_replanejamento(
    session: Session,
    replanejamento_id: int,
    diretor: str = "Diretoria",
    observacao: str | None = None,
) -> dict:
    """Aprova/aplica rascunho de replanejamento e cria novo plano oficial."""
    replan = session.get(Replanejamento, replanejamento_id)
    if not replan:
        return {"ok": False, "erro": "Replanejamento nao encontrado"}

    plano = (
        session.query(PlanejamentoSemanal)
        .filter(
            PlanejamentoSemanal.nucleo == replan.nucleo,
            PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
        )
        .order_by(PlanejamentoSemanal.criado_em.desc())
        .first()
    )
    if not plano:
        return {"ok": False, "erro": "Nenhum planejamento ativo para aplicar"}

    try:
        sugestoes = json.loads(replan.sugestoes_json or "[]")
    except Exception:
        sugestoes = []

    desvios_por_item = {}
    for desvio in plano.desvios or []:
        if desvio.item_id:
            desvios_por_item[desvio.item_id] = desvio

    novo = PlanejamentoSemanal(
        nucleo=plano.nucleo,
        semana_inicio=plano.semana_inicio,
        semana_fim=plano.semana_fim,
        engenheiro=plano.engenheiro,
        responsavel=plano.responsavel,
        status=StatusPlanejamento.ATIVO,
        observacao=observacao or f"Plano oficial gerado pelo replanejamento #{replan.id}",
    )
    session.add(novo)
    session.flush()

    for item in plano.itens or []:
        desvio = desvios_por_item.get(item.id)
        meta = float(item.meta_quantidade or 0)
        if desvio and (desvio.desvio_quantidade or 0) < 0:
            meta = round(meta + abs(float(desvio.desvio_quantidade or 0)), 4)
        session.add(PlanejamentoItem(
            planejamento_id=novo.id,
            atividade=item.atividade,
            meta_quantidade=meta,
            unidade=item.unidade,
            equipe_prevista=item.equipe_prevista,
            custo_previsto=item.custo_previsto,
            data_inicio=item.data_inicio,
            data_fim=item.data_fim,
            restricoes=item.restricoes,
        ))

    plano.status = StatusPlanejamento.SUBSTITUIDO
    replan.status = StatusReplanejamento.APLICADO
    replan.diretor = diretor
    replan.observacao = observacao or replan.observacao
    session.add(PlanejamentoValidacao(
        planejamento_id=novo.id,
        aprovado=True,
        diretor=diretor,
        observacao=f"Aplicado a partir do replanejamento #{replan.id}",
    ))
    log_operational_event(
        session,
        subsystem="replanejamento",
        event_type="replanejamento_aplicado",
        nucleo=replan.nucleo,
        payload={
            "replanejamento_id": replan.id,
            "plano_anterior_id": plano.id,
            "novo_plano_id": novo.id,
            "sugestoes": sugestoes,
        },
    )
    session.flush()
    return {"ok": True, "replanejamento": replan.to_dict(), "plano_anterior": plano.to_dict(), "novo_plano": novo.to_dict()}
