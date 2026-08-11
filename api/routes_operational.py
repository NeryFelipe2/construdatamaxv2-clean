"""Rotas REST do Ciclo Operacional — ConstruData NS5.

Endpoints:
  POST /api/logs
  GET  /api/nucleos/{nucleo}/logs

  GET  /api/nucleos/{nucleo}/planejamentos-semanais
  POST /api/nucleos/{nucleo}/planejamentos-semanais
  POST /api/nucleos/{nucleo}/planejamentos-semanais/{plan_id}/validar

  GET  /api/nucleos/{nucleo}/desvios
  POST /api/nucleos/{nucleo}/ml/recalcular-desvios

  GET  /api/nucleos/{nucleo}/replanejamentos
  POST /api/nucleos/{nucleo}/replanejamentos/{replanejamento_id}/validar
"""
from __future__ import annotations

import json
from datetime import date, datetime

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import desc
from sqlalchemy.orm import selectinload

from api.operational import (
    fallback_deterministico,
    gerar_desvios_rdo,
    log_operational_event,
    tentar_xgboost,
)
from core.database import get_session
from core.models import (
    DesvioPlanejamento,
    OperationalLog,
    PlanejamentoItem,
    PlanejamentoSemanal,
    PlanejamentoValidacao,
    Replanejamento,
    StatusPlanejamento,
    StatusReplanejamento,
)

router = APIRouter(tags=["operacional"])


def _json_text(value) -> str | None:
    if value in (None, ""):
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, default=str)


# ---------------------------------------------------------------------------
# LOGS
# ---------------------------------------------------------------------------

@router.post("/api/logs")
def api_criar_log(payload: dict):
    """Cria um log operacional."""
    with get_session() as session:
        entry = log_operational_event(
            session,
            subsystem=payload.get("subsystem", "manual"),
            event_type=payload.get("event_type", "log_manual"),
            severity=payload.get("severity", "INFO"),
            status=payload.get("status", "OK"),
            error_message=payload.get("error_message"),
            payload=payload.get("payload"),
            nucleo=payload.get("nucleo"),
        )
        return entry.to_dict()


@router.get("/api/nucleos/{nucleo}/logs")
def api_listar_logs(nucleo: str, limit: int = Query(default=50)):
    """Lista logs operacionais de um nucleo."""
    with get_session() as session:
        logs = (
            session.query(OperationalLog)
            .filter(OperationalLog.nucleo == nucleo)
            .order_by(desc(OperationalLog.criado_em))
            .limit(limit)
            .all()
        )
        return {"items": [l.to_dict() for l in logs]}


# ---------------------------------------------------------------------------
# PLANEJAMENTO SEMANAL
# ---------------------------------------------------------------------------

@router.get("/api/nucleos/{nucleo}/planejamentos-semanais")
def api_listar_planejamentos(nucleo: str, status: str = Query(default="")):
    """Lista planejamentos semanais de um nucleo."""
    with get_session() as session:
        q = (
            session.query(PlanejamentoSemanal)
            .options(
                selectinload(PlanejamentoSemanal.itens),
                selectinload(PlanejamentoSemanal.validacoes),
            )
            .filter(PlanejamentoSemanal.nucleo == nucleo)
        )
        if status:
            q = q.filter(PlanejamentoSemanal.status == status)
        planos = q.order_by(desc(PlanejamentoSemanal.criado_em)).all()
        return {"items": [p.to_dict() for p in planos]}


@router.post("/api/nucleos/{nucleo}/planejamentos-semanais")
def api_criar_planejamento(nucleo: str, payload: dict):
    """Cria um novo planejamento semanal (status=RASCUNHO)."""
    if not payload.get("semana_inicio") or not payload.get("semana_fim"):
        raise HTTPException(status_code=400, detail="Campos semana_inicio e semana_fim obrigatorios")

    with get_session() as session:
        plano = PlanejamentoSemanal(
            nucleo=nucleo,
            semana_inicio=date.fromisoformat(payload["semana_inicio"]),
            semana_fim=date.fromisoformat(payload["semana_fim"]),
            engenheiro=payload.get("engenheiro"),
            responsavel=payload.get("responsavel"),
            status=StatusPlanejamento.RASCUNHO,
            observacao=payload.get("observacao"),
        )
        session.add(plano)
        session.flush()

        # Adicionar itens
        for item_data in payload.get("itens", []):
            item = PlanejamentoItem(
                planejamento_id=plano.id,
                atividade=item_data.get("atividade", ""),
                meta_quantidade=item_data.get("meta_quantidade"),
                unidade=item_data.get("unidade"),
                equipe_prevista=item_data.get("equipe_prevista"),
                custo_previsto=item_data.get("custo_previsto"),
                data_inicio=date.fromisoformat(item_data["data_inicio"]) if item_data.get("data_inicio") else None,
                data_fim=date.fromisoformat(item_data["data_fim"]) if item_data.get("data_fim") else None,
                restricoes=_json_text(item_data.get("restricoes")),
            )
            session.add(item)

        session.flush()

        log_operational_event(
            session,
            subsystem="planejamento",
            event_type="planejamento_criado",
            nucleo=nucleo,
            payload={"plano_id": plano.id},
        )

        # Recarregar com itens
        session.refresh(plano)
        return plano.to_dict()


@router.post("/api/nucleos/{nucleo}/planejamentos-semanais/{plan_id}/validar")
def api_validar_planejamento(nucleo: str, plan_id: int, payload: dict):
    """Valida (aprova/rejeita) um planejamento. Se aprovado, ativa-o e desativa anteriores."""
    with get_session() as session:
        plano = session.query(PlanejamentoSemanal).filter_by(id=plan_id, nucleo=nucleo).first()
        if not plano:
            raise HTTPException(status_code=404, detail="Planejamento nao encontrado")

        aprovado = payload.get("aprovado", False)

        # Registrar validacao
        validacao = PlanejamentoValidacao(
            planejamento_id=plano.id,
            aprovado=aprovado,
            diretor=payload.get("diretor"),
            observacao=payload.get("observacao"),
        )
        session.add(validacao)

        if aprovado:
            # Desativar planos ativos anteriores do mesmo nucleo
            planos_ativos = (
                session.query(PlanejamentoSemanal)
                .filter(
                    PlanejamentoSemanal.nucleo == nucleo,
                    PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
                    PlanejamentoSemanal.id != plano.id,
                )
                .all()
            )
            for p in planos_ativos:
                p.status = StatusPlanejamento.SUBSTITUIDO

            plano.status = StatusPlanejamento.ATIVO
        else:
            plano.status = StatusPlanejamento.RASCUNHO

        session.flush()

        log_operational_event(
            session,
            subsystem="planejamento",
            event_type="planejamento_validado",
            nucleo=nucleo,
            payload={"plano_id": plano.id, "aprovado": aprovado},
        )

        return {"ok": True, "status": plano.status.value if hasattr(plano.status, 'value') else plano.status, "aprovado": aprovado}


# ---------------------------------------------------------------------------
# DESVIOS
# ---------------------------------------------------------------------------

@router.get("/api/nucleos/{nucleo}/desvios")
def api_listar_desvios(nucleo: str, limit: int = Query(default=100)):
    """Lista desvios de planejamento de um nucleo."""
    with get_session() as session:
        desvios = (
            session.query(DesvioPlanejamento)
            .join(PlanejamentoSemanal)
            .filter(PlanejamentoSemanal.nucleo == nucleo)
            .order_by(desc(DesvioPlanejamento.criado_em))
            .limit(limit)
            .all()
        )
        return {"items": [d.to_dict() for d in desvios]}


# ---------------------------------------------------------------------------
# ML / RECALCULAR DESVIOS
# ---------------------------------------------------------------------------

@router.post("/api/nucleos/{nucleo}/ml/recalcular-desvios")
def api_recalcular_desvios(nucleo: str, payload: dict = {}):
    """Executa analise ML (ou fallback) sobre desvios do nucleo."""
    with get_session() as session:
        resultado = tentar_xgboost(session, nucleo)
        return resultado


# ---------------------------------------------------------------------------
# REPLANEJAMENTOS
# ---------------------------------------------------------------------------

@router.get("/api/nucleos/{nucleo}/replanejamentos")
def api_listar_replanejamentos(nucleo: str):
    """Lista replanejamentos de um nucleo."""
    with get_session() as session:
        replans = (
            session.query(Replanejamento)
            .filter(Replanejamento.nucleo == nucleo)
            .order_by(desc(Replanejamento.criado_em))
            .all()
        )
        return {"items": [r.to_dict() for r in replans]}


@router.post("/api/nucleos/{nucleo}/replanejamentos/{replanejamento_id}/validar")
def api_validar_replanejamento(nucleo: str, replanejamento_id: int, payload: dict):
    """Aprova ou rejeita um replanejamento. Se aprovado, pode aplicar como novo plano."""
    with get_session() as session:
        replan = session.query(Replanejamento).filter_by(id=replanejamento_id, nucleo=nucleo).first()
        if not replan:
            raise HTTPException(status_code=404, detail="Replanejamento nao encontrado")

        acao = payload.get("acao", "aprovar")  # aprovar | rejeitar | aplicar
        diretor = payload.get("diretor")
        observacao = payload.get("observacao")

        if acao == "rejeitar":
            replan.status = StatusReplanejamento.REJEITADO
            replan.diretor = diretor
            replan.observacao = observacao
        elif acao == "aprovar":
            replan.status = StatusReplanejamento.APROVADO
            replan.diretor = diretor
            replan.observacao = observacao
        elif acao == "aplicar":
            if replan.status != StatusReplanejamento.APROVADO:
                raise HTTPException(status_code=400, detail="Replanejamento precisa estar aprovado antes de aplicar")

            replan.status = StatusReplanejamento.APLICADO

            # Criar novo planejamento a partir das sugestoes
            sugestoes = json.loads(replan.sugestoes_json) if replan.sugestoes_json else []
            hoje = date.today()
            from datetime import timedelta
            novo_plano = PlanejamentoSemanal(
                nucleo=nucleo,
                semana_inicio=hoje,
                semana_fim=hoje + timedelta(days=6),
                engenheiro="Gerado por ML/Replanejamento",
                status=StatusPlanejamento.RASCUNHO,
                observacao=f"Gerado a partir do replanejamento #{replanejamento_id}",
            )
            session.add(novo_plano)
            session.flush()

            for sug in sugestoes:
                item = PlanejamentoItem(
                    planejamento_id=novo_plano.id,
                    atividade=sug.get("atividade", sug.get("sugestao", "")),
                    meta_quantidade=None,
                    restricoes=_json_text(sug.get("sugestao")),
                )
                session.add(item)

            session.flush()

            log_operational_event(
                session,
                subsystem="replanejamento",
                event_type="replanejamento_aplicado",
                nucleo=nucleo,
                payload={"replanejamento_id": replan.id, "novo_plano_id": novo_plano.id},
            )

            return {
                "ok": True,
                "status": "APLICADO",
                "novo_plano": novo_plano.to_dict(),
            }
        else:
            raise HTTPException(status_code=400, detail=f"Acao invalida: {acao}")

        session.flush()

        log_operational_event(
            session,
            subsystem="replanejamento",
            event_type=f"replanejamento_{acao}",
            nucleo=nucleo,
            payload={"replanejamento_id": replan.id},
        )

        return {"ok": True, "status": replan.status.value if hasattr(replan.status, 'value') else replan.status}
