"""Fachada local para o frontend React do ConstruData."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.operational import aplicar_replanejamento, gerar_desvios_rdo, tentar_xgboost
from campo.rdo_engine import RDOEngine
from campo.texto_operacional import aplicar_operacional, aplicar_texto_operacional, parse_texto_operacional, payload_frontend_para_operacional
from core.construdata_offline import (
    CDMContato,
    ENTITY_MODELS,
    PROJECT_NUCLEO_GROUPS,
    create_contact,
    create_entity,
    create_project,
    get_project,
    list_contacts,
    list_entity,
    list_projects,
    nucleos_do_projeto,
)
from core.database import get_session
from core.models import (
    DesvioPlanejamento,
    MLExecucao,
    NS,
    OperationalLog,
    PlanejamentoItem,
    PlanejamentoSemanal,
    PlanejamentoValidacao,
    RDO,
    Replanejamento,
    StatusPlanejamento,
)
from financeiro.controle_fluxo_texto import aplicar_texto_controle_fluxo, fluxo_projetado

router = APIRouter(tags=["frontend-local"])
engine = RDOEngine()


def _val(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return getattr(value, "value", value)


def _dict(row: Any) -> dict[str, Any]:
    if hasattr(row, "to_dict") and row.__class__.__name__ in {"RDO", "NS", "PlanejamentoSemanal", "DesvioPlanejamento", "OperationalLog", "MLExecucao", "Replanejamento"}:
        return row.to_dict()
    return {col.name: _val(getattr(row, col.name)) for col in row.__table__.columns}


def _financeiro_lancamento(row: Any) -> dict[str, Any]:
    data = _dict(row)
    valor_raw = float(data.get("valor") or 0)
    txt = f"{data.get('categoria') or ''} {data.get('descricao') or ''}".lower()
    receita = valor_raw > 0 and any(x in txt for x in ("receita", "recebimento", "medicao", "medição", "faturamento", "vendas"))
    data["valor_original"] = valor_raw
    data["valor"] = abs(valor_raw)
    data["tipo"] = "RECEITA" if receita else "DESPESA"
    return data


def _dt(value: Any) -> date:
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value or date.today().isoformat())[:10])


def _desativar_planos_concorrentes(session: Any, plano: PlanejamentoSemanal) -> None:
    rows = session.execute(
        select(PlanejamentoSemanal).where(
            PlanejamentoSemanal.nucleo == plano.nucleo,
            PlanejamentoSemanal.id != plano.id,
            PlanejamentoSemanal.status == StatusPlanejamento.ATIVO,
            PlanejamentoSemanal.semana_inicio <= plano.semana_fim,
            PlanejamentoSemanal.semana_fim >= plano.semana_inicio,
        )
    ).scalars().all()
    for row in rows:
        row.status = StatusPlanejamento.SUBSTITUIDO


def _project_record(project: Any, rdos: list[RDO] | None = None) -> dict[str, Any]:
    datas = [r.data for r in (rdos or []) if r.data]
    return {
        "id": project.id,
        "nome": project.nome,
        "contrato": project.contrato,
        "cidade": project.cidade,
        "cliente": "ConstruData",
        "tipo": project.tipo,
        "status": project.status,
        "data_inicio": min(datas).isoformat() if datas else None,
        "data_fim": max(datas).isoformat() if datas else None,
        "orcamento_total": 0,
        "responsavel_nome": project.responsavel,
        "responsavel_telefone": None,
        "nucleo": project.nucleo,
        "nucleos": nucleos_do_projeto(project),
    }


def _frontend_projects() -> list[Any]:
    filhos_tatui = set(PROJECT_NUCLEO_GROUPS["TATUI"][1:])
    rows = [p for p in list_projects() if p.nucleo not in filhos_tatui and not str(p.id).startswith("icaro-")]
    prioridade = {"TATUI": 0, "RK_SUB": 1}
    return sorted(rows, key=lambda p: (prioridade.get(p.nucleo, 50), p.nome))


def _base(project_id: str) -> tuple[Any, list[str], dict[str, Any]]:
    project = get_project(project_id=project_id)
    nucleos = nucleos_do_projeto(project)
    with get_session() as session:
        rdos = session.execute(
            select(RDO)
            .options(selectinload(RDO.apontamentos), selectinload(RDO.equipe), selectinload(RDO.ocorrencias), selectinload(RDO.fotos))
            .where(RDO.nucleo.in_(nucleos))
            .order_by(RDO.data.desc(), RDO.id.desc())
        ).scalars().all()
        nss = session.execute(select(NS).where(NS.nucleo.in_(nucleos))).scalars().all()
        planos = session.execute(
            select(PlanejamentoSemanal)
            .options(selectinload(PlanejamentoSemanal.itens), selectinload(PlanejamentoSemanal.validacoes))
            .where(PlanejamentoSemanal.nucleo.in_(nucleos))
            .order_by(PlanejamentoSemanal.criado_em.desc())
        ).scalars().all()
        desvios = session.execute(
            select(DesvioPlanejamento)
            .join(PlanejamentoSemanal)
            .where(PlanejamentoSemanal.nucleo.in_(nucleos))
            .order_by(DesvioPlanejamento.criado_em.desc())
        ).scalars().all()
        logs = session.execute(
            select(OperationalLog)
            .where((OperationalLog.nucleo.in_(nucleos)) | (OperationalLog.project_id == project.id))
            .order_by(OperationalLog.criado_em.desc())
        ).scalars().all()
        replans = session.execute(
            select(Replanejamento)
            .where(Replanejamento.nucleo.in_(nucleos))
            .order_by(Replanejamento.criado_em.desc())
        ).scalars().all()

        frentes = []
        for nucleo in nucleos:
            rdos_n = [r for r in rdos if r.nucleo == nucleo]
            nss_n = [n for n in nss if n.nucleo == nucleo]
            metros = sum((a.quantidade or 0) for r in rdos_n for a in r.apontamentos if (a.unidade or "").lower() in {"m", "metro", "metros"})
            frentes.append({
                "id": nucleo,
                "nome": nucleo.replace("_", " ").title(),
                "nucleo": nucleo,
                "status": "ATIVA" if rdos_n or nss_n else "SEM_DADOS",
                "rdos_total": len(rdos_n),
                "ns_total": len(nss_n),
                "extensao_total_m": round(metros or sum(n.ext_m or 0 for n in nss_n), 2),
                "data_inicio": min([r.data for r in rdos_n]).isoformat() if rdos_n else None,
                "data_fim": max([r.data for r in rdos_n]).isoformat() if rdos_n else None,
            })

    tarefas = [_dict(r) for r in list_entity("tarefas", project.id)]
    restricoes = [_dict(r) for r in list_entity("lps", project.id)]
    contatos = [_dict(c) for c in list_contacts()]
    custos = [_dict(c) for c in list_entity("custos", project.id)]
    ppc = [d.ppc for d in desvios if d.ppc is not None]
    spi = [d.spi for d in desvios if d.spi is not None]
    cpi = [d.cpi for d in desvios if d.cpi is not None]
    hoje = date.today()
    payload = {
        "projeto": _project_record(project, rdos),
        "kpis": {
            "frentes": len([f for f in frentes if f["rdos_total"] or f["ns_total"]]),
            "rdos_total": len(rdos),
            "rdos_hoje": len([r for r in rdos if r.data == hoje]),
            "tarefas_pendentes": len([t for t in tarefas if t.get("status") not in {"CONCLUIDA", "FECHADA"}]),
            "contatos": len(contatos),
            "restricoes_abertas": len([r for r in restricoes if r.get("status") not in {"RESOLVIDA", "FECHADA"}]),
            "custo_total_dia": round(sum(r.total_custo or 0 for r in rdos if r.data == hoje), 2),
            "planejamento_ativo": any(_val(p.status) == "ATIVO" for p in planos),
            "desvios_total": len(desvios),
            "desvios_criticos": len([d for d in desvios if _val(d.severidade) in {"ALTA", "CRITICA"}]),
            "logs_abertos": len([l for l in logs if str(l.status).upper() in {"OPEN", "ABERTO", "ERRO", "ERROR"}]),
            "replanejamentos_rascunho": len([r for r in replans if _val(r.status) == "RASCUNHO"]),
            "ppc_medio": round(sum(ppc) / len(ppc), 2) if ppc else 0,
            "spi_medio": round(sum(spi) / len(spi), 2) if spi else 0,
            "cpi_medio": round(sum(cpi) / len(cpi), 2) if cpi else 0,
        },
        "frentes": frentes,
        "contatos": contatos,
        "rdos": [_dict(r) for r in rdos],
        "tarefas": tarefas,
        "restricoes": restricoes,
        "planejamento": _dict(planos[0]) if planos else None,
        "desvios": [_dict(d) for d in desvios],
        "logs": [_dict(l) for l in logs],
        "replanejamentos": [_dict(r) for r in replans],
        "custos_lista": custos,
        "status": "local",
    }
    return project, nucleos, payload


@router.get("/api/health/integrations")
def api_frontend_integrations():
    return {"sqlite": "connected", "rdo": "connected", "frontend": "local"}


@router.get("/api/projetos")
def api_frontend_projetos():
    return {"items": [_project_record(p) for p in _frontend_projects()], "source": "sqlite-local"}


@router.post("/api/projetos")
def api_frontend_criar_projeto(payload: dict):
    project_id = create_project(payload)
    return _project_record(get_project(project_id=project_id))


@router.get("/api/projetos/{project_id}/dashboard")
def api_frontend_dashboard(project_id: str):
    return _base(project_id)[2]


@router.get("/api/projetos/{project_id}/gestao360")
def api_frontend_gestao360(project_id: str):
    _, _, payload = _base(project_id)
    payload["custos"] = {
        "diario": payload["kpis"]["custo_total_dia"],
        "rdos": round(sum((r.get("total_custo") or 0) for r in payload["rdos"]), 2),
        "lancamentos": round(sum((c.get("valor") or 0) for c in payload.pop("custos_lista", [])), 2),
        "despesas_total": 0,
        "receitas_total": 0,
    }
    payload["planejamento_operacional"] = payload.get("planejamento") or {}
    payload["integracoes"] = {"sqlite": "connected", "rdo": "connected", "ml": "local"}
    return payload


@router.get("/api/projetos/{project_id}/torre")
def api_frontend_torre(project_id: str):
    _, _, payload = _base(project_id)
    return {
        "projeto": payload["projeto"],
        "frentes": payload["frentes"],
        "riscos": payload["desvios"],
        "restricoes": payload["restricoes"],
        "logs": payload["logs"],
        "desvios": payload["desvios"],
        "replanejamentos": payload["replanejamentos"],
        "kpis": payload["kpis"],
        "status": payload["status"],
    }


@router.get("/api/projetos/{project_id}/rdos")
def api_frontend_rdos(project_id: str):
    return {"items": _base(project_id)[2]["rdos"]}


@router.post("/api/projetos/{project_id}/rdos")
def api_frontend_criar_rdo(project_id: str, payload: dict):
    project = get_project(project_id=project_id)
    if payload.get("texto") or payload.get("mensagem"):
        return aplicar_texto_operacional(project.id, str(payload.get("texto") or payload.get("mensagem") or ""))
    data = dict(payload)
    data["nucleo"] = data.get("nucleo") or project.nucleo
    return aplicar_operacional(project.id, payload_frontend_para_operacional(project, data))


@router.post("/api/projetos/{project_id}/preencher-texto")
def api_frontend_preencher_texto(project_id: str, payload: dict):
    texto = str(payload.get("texto") or payload.get("mensagem") or "")
    if not texto.strip():
        raise HTTPException(status_code=400, detail="Texto obrigatorio")
    return aplicar_texto_operacional(project_id, texto)


@router.get("/api/projetos/{project_id}/tarefas")
def api_frontend_tarefas(project_id: str):
    return {"items": [_dict(r) for r in list_entity("tarefas", project_id)]}


@router.post("/api/projetos/{project_id}/tarefas")
def api_frontend_criar_tarefa(project_id: str, payload: dict):
    return {"ok": True, "id": create_entity("tarefas", project_id, payload)}


@router.get("/api/projetos/{project_id}/contatos")
def api_frontend_contatos(project_id: str):
    return {"items": [_dict(c) for c in list_contacts()]}


@router.post("/api/projetos/{project_id}/contatos")
def api_frontend_criar_contato(project_id: str, payload: dict):
    data = dict(payload)
    data["projeto_id"] = data.get("projeto_id") or project_id
    return {"ok": True, "id": create_contact(data)}


@router.patch("/api/projetos/{project_id}/contatos/{contato_id}")
def api_frontend_atualizar_contato(project_id: str, contato_id: int, payload: dict):
    with get_session() as session:
        row = session.get(CDMContato, contato_id)
        if not row:
            raise HTTPException(status_code=404, detail="Contato nao encontrado")
        for key, value in payload.items():
            if hasattr(row, key):
                setattr(row, key, value)
        session.flush()
        return _dict(row)


@router.delete("/api/projetos/{project_id}/contatos/{contato_id}")
def api_frontend_remover_contato(project_id: str, contato_id: int):
    with get_session() as session:
        row = session.get(CDMContato, contato_id)
        if not row:
            raise HTTPException(status_code=404, detail="Contato nao encontrado")
        session.delete(row)
        return {"ok": True}


@router.get("/api/projetos/{project_id}/lps-restricoes")
def api_frontend_lps(project_id: str):
    return {"items": [_dict(r) for r in list_entity("lps", project_id)]}


@router.post("/api/projetos/{project_id}/lps-restricoes")
def api_frontend_criar_lps(project_id: str, payload: dict):
    return {"ok": True, "id": create_entity("lps", project_id, payload)}


def _patch_entity(entity: str, row_id: int, payload: dict) -> dict[str, Any]:
    model = ENTITY_MODELS[entity]
    with get_session() as session:
        row = session.get(model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="Registro nao encontrado")
        for key, value in payload.items():
            if hasattr(row, key):
                if key in {"prazo", "data", "data_alvo"}:
                    value = _dt(value)
                setattr(row, key, value)
        session.flush()
        return _dict(row)


def _delete_entity(entity: str, row_id: int) -> dict[str, bool]:
    model = ENTITY_MODELS[entity]
    with get_session() as session:
        row = session.get(model, row_id)
        if not row:
            raise HTTPException(status_code=404, detail="Registro nao encontrado")
        session.delete(row)
        return {"ok": True}


@router.patch("/api/projetos/{project_id}/lps-restricoes/{restricao_id}")
def api_frontend_atualizar_lps(project_id: str, restricao_id: int, payload: dict):
    return _patch_entity("lps", restricao_id, payload)


@router.delete("/api/projetos/{project_id}/lps-restricoes/{restricao_id}")
def api_frontend_remover_lps(project_id: str, restricao_id: int):
    return _delete_entity("lps", restricao_id)


@router.get("/api/projetos/{project_id}/financeiro")
def api_frontend_financeiro(project_id: str):
    _, nucleos, _ = _base(project_id)
    with get_session() as session:
        trechos = session.execute(select(NS).where(NS.nucleo.in_(nucleos))).scalars().all()
    lancamentos = [_financeiro_lancamento(c) for c in list_entity("custos", project_id)]
    despesas = sum((l.get("valor") or 0) for l in lancamentos if l.get("tipo") == "DESPESA")
    receitas = sum((l.get("valor") or 0) for l in lancamentos if l.get("tipo") == "RECEITA")
    fluxo = fluxo_projetado(project_id)
    return {"projeto": _base(project_id)[2]["projeto"], "lancamentos": lancamentos, "trechos": [_dict(t) for t in trechos], "fluxo_projetado": fluxo, "resumo": {"receitas": receitas, "despesas": despesas, "trechos_total": len(trechos), **fluxo["resumo"]}, "status": "local"}


@router.get("/api/projetos/{project_id}/controle-fluxo")
def api_frontend_controle_fluxo(project_id: str):
    return {"ok": True, "fluxo": fluxo_projetado(project_id), "status": "local"}


@router.post("/api/projetos/{project_id}/controle-fluxo/preencher-texto")
def api_frontend_controle_fluxo_texto(project_id: str, payload: dict):
    texto = str(payload.get("texto") or payload.get("mensagem") or "")
    if not texto.strip():
        raise HTTPException(status_code=400, detail="Texto obrigatorio")
    return aplicar_texto_controle_fluxo(project_id, texto)


@router.get("/api/projetos/{project_id}/whatsapp/logs")
def api_frontend_whatsapp_logs(project_id: str):
    return {"items": [_dict(r) for r in list_entity("whatsapp", project_id)], "status": "local"}


@router.get("/api/projetos/{project_id}/whatsapp/agendamentos")
def api_frontend_whatsapp_agendamentos(project_id: str):
    return {"items": [], "status": "local"}


@router.post("/api/projetos/{project_id}/whatsapp/agendamentos")
def api_frontend_criar_whatsapp_agendamento(project_id: str, payload: dict):
    now = datetime.now().isoformat(timespec="seconds")
    return {"id": f"local-{now}", "created_at": now, "ativo": True, "totalEnviados": 0, **payload}


@router.patch("/api/projetos/{project_id}/whatsapp/agendamentos/{agendamento_id}")
def api_frontend_atualizar_whatsapp_agendamento(project_id: str, agendamento_id: str, payload: dict):
    return {"id": agendamento_id, **payload}


@router.delete("/api/projetos/{project_id}/whatsapp/agendamentos/{agendamento_id}")
def api_frontend_remover_whatsapp_agendamento(project_id: str, agendamento_id: str):
    return {"ok": True}


@router.get("/api/projetos/{project_id}/logs")
def api_frontend_logs(project_id: str):
    return {"items": _base(project_id)[2]["logs"], "status": "local"}


@router.get("/api/projetos/{project_id}/planejamentos-semanais")
def api_frontend_planejamentos(project_id: str):
    _, _, payload = _base(project_id)
    items = [payload["planejamento"]] if payload.get("planejamento") else []
    return {"items": items, "status": "local"}


@router.post("/api/projetos/{project_id}/planejamentos-semanais")
def api_frontend_criar_planejamento(project_id: str, payload: dict):
    project = get_project(project_id=project_id)
    with get_session() as session:
        plano = PlanejamentoSemanal(
            nucleo=payload.get("nucleo") or project.nucleo,
            semana_inicio=_dt(payload.get("semana_inicio")),
            semana_fim=_dt(payload.get("semana_fim")),
            engenheiro=payload.get("engenheiro") or project.responsavel,
            responsavel=payload.get("responsavel") or project.responsavel,
            status=StatusPlanejamento.RASCUNHO,
            observacao=payload.get("observacao") or "Criado pelo frontend local",
        )
        session.add(plano)
        session.flush()
        itens = list(payload.get("itens") or payload.get("items") or [])
        if payload.get("atividade"):
            itens.append(payload)
        for item in itens:
            session.add(PlanejamentoItem(
                planejamento_id=plano.id,
                atividade=item.get("atividade") or item.get("servico") or "Atividade planejada",
                meta_quantidade=item.get("meta_quantidade") or item.get("quantidade") or item.get("meta") or 0,
                unidade=item.get("unidade") or "m",
                equipe_prevista=item.get("equipe_prevista") or 0,
                custo_previsto=item.get("custo_previsto") or item.get("custo_total") or 0,
                data_inicio=_dt(item.get("data_inicio") or plano.semana_inicio),
                data_fim=_dt(item.get("data_fim") or plano.semana_fim),
                restricoes=item.get("restricoes") or "[]",
            ))
        session.flush()
        return _dict(plano)


@router.post("/api/projetos/{project_id}/planejamentos-semanais/preencher-texto")
def api_frontend_planejamento_texto(project_id: str, payload: dict):
    texto = str(payload.get("texto") or payload.get("mensagem") or "")
    if not texto.strip():
        raise HTTPException(status_code=400, detail="Texto obrigatorio")
    project = get_project(project_id=project_id)
    parsed = parse_texto_operacional(texto, project)
    data_ref = _dt(parsed["data"])
    semana_inicio = _dt(payload.get("semana_inicio")) if payload.get("semana_inicio") else data_ref - timedelta(days=data_ref.weekday())
    semana_fim = _dt(payload.get("semana_fim")) if payload.get("semana_fim") else semana_inicio + timedelta(days=6)
    itens = parsed.get("planejamento") or parsed.get("producao") or []
    with get_session() as session:
        plano = PlanejamentoSemanal(
            nucleo=parsed["nucleo"],
            semana_inicio=semana_inicio,
            semana_fim=semana_fim,
            engenheiro=parsed["responsavel"],
            responsavel=parsed["responsavel"],
            status=StatusPlanejamento.RASCUNHO,
            observacao="Planejamento semanal colado por texto; aguardando validacao do diretor",
        )
        session.add(plano)
        session.flush()
        for item in itens:
            session.add(PlanejamentoItem(
                planejamento_id=plano.id,
                atividade=item.get("servico") or "Atividade planejada",
                meta_quantidade=item.get("quantidade") or 0,
                unidade=item.get("unidade") or "m",
                equipe_prevista=0,
                custo_previsto=item.get("custo_total") or 0,
                data_inicio=semana_inicio,
                data_fim=semana_fim,
                restricoes="[]",
            ))
        session.flush()
        return {"ok": True, "planejamento": _dict(plano), "parsed": parsed}


@router.post("/api/projetos/{project_id}/planejamentos-semanais/{plan_id}/validar")
def api_frontend_validar_planejamento(project_id: str, plan_id: int, payload: dict):
    with get_session() as session:
        plano = session.get(PlanejamentoSemanal, plan_id)
        if not plano:
            raise HTTPException(status_code=404, detail="Planejamento nao encontrado")
        aprovado = bool(payload.get("aprovado", True))
        session.add(PlanejamentoValidacao(planejamento_id=plano.id, aprovado=aprovado, diretor=payload.get("diretor") or "Diretoria", observacao=payload.get("observacao") or "Validado no frontend local"))
        if aprovado:
            _desativar_planos_concorrentes(session, plano)
        plano.status = StatusPlanejamento.ATIVO if aprovado else StatusPlanejamento.ENCERRADO
        session.flush()
        return _dict(plano)


@router.get("/api/projetos/{project_id}/desvios")
def api_frontend_desvios(project_id: str):
    return {"items": _base(project_id)[2]["desvios"], "status": "local"}


@router.post("/api/projetos/{project_id}/ml/recalcular-desvios")
def api_frontend_ml(project_id: str):
    project = get_project(project_id=project_id)
    resultados = []
    with get_session() as session:
        for nucleo in nucleos_do_projeto(project):
            resultados.append(tentar_xgboost(session, nucleo))
    return {"ok": True, "nucleos": nucleos_do_projeto(project), "resultados": resultados}


@router.get("/api/projetos/{project_id}/replanejamentos")
def api_frontend_replanejamentos(project_id: str):
    return {"items": _base(project_id)[2]["replanejamentos"], "status": "local"}


@router.post("/api/projetos/{project_id}/replanejamentos/{replanejamento_id}/validar")
def api_frontend_validar_replanejamento(project_id: str, replanejamento_id: int, payload: dict):
    with get_session() as session:
        row = session.get(Replanejamento, replanejamento_id)
        if not row:
            raise HTTPException(status_code=404, detail="Replanejamento nao encontrado")
        acao = str(payload.get("acao") or "aprovar").lower()
        if acao in {"aplicar", "aprovar_aplicar"} or payload.get("aplicar") is True:
            return aplicar_replanejamento(session, replanejamento_id, payload.get("diretor") or "Diretoria", payload.get("observacao"))
        row.status = "APROVADO" if acao != "rejeitar" else "REJEITADO"
        row.diretor = payload.get("diretor") or row.diretor
        row.observacao = payload.get("observacao") or row.observacao
        session.flush()
        return _dict(row)


@router.post("/api/projetos/{project_id}/replanejamentos/{replanejamento_id}/aplicar")
def api_frontend_aplicar_replanejamento(project_id: str, replanejamento_id: int, payload: dict):
    with get_session() as session:
        result = aplicar_replanejamento(session, replanejamento_id, payload.get("diretor") or "Diretoria", payload.get("observacao"))
        if not result.get("ok"):
            raise HTTPException(status_code=400, detail=result.get("erro") or "Falha ao aplicar replanejamento")
        return result


@router.get("/api/projetos/{project_id}/ciclo-operacional")
def api_frontend_ciclo_operacional(project_id: str):
    project, nucleos, payload = _base(project_id)
    with get_session() as session:
        mls = session.execute(
            select(MLExecucao)
            .where(MLExecucao.nucleo.in_(nucleos))
            .order_by(MLExecucao.criado_em.desc())
        ).scalars().all()
    plano = payload.get("planejamento")
    rdos = payload.get("rdos") or []
    desvios = payload.get("desvios") or []
    replans = payload.get("replanejamentos") or []
    steps = [
        {"ordem": 1, "nome": "Planejamento semanal do engenheiro", "status": "OK" if plano else "PENDENTE", "detalhe": plano.get("status") if plano else "Sem plano"},
        {"ordem": 2, "nome": "Validacao do diretor", "status": "OK" if plano and plano.get("validacoes") else "PENDENTE", "detalhe": f"{len(plano.get('validacoes') or [])} validacoes" if plano else "Aguardando plano"},
        {"ordem": 3, "nome": "RDO diario", "status": "OK" if rdos else "PENDENTE", "detalhe": f"{len(rdos)} RDOs"},
        {"ordem": 4, "nome": "Comparacao planejado x realizado", "status": "OK" if desvios else "PENDENTE", "detalhe": f"{len(desvios)} desvios"},
        {"ordem": 5, "nome": "Desvios automaticos", "status": "OK" if desvios else "PENDENTE", "detalhe": f"{payload['kpis']['desvios_criticos']} criticos"},
        {"ordem": 6, "nome": "ML/fallback deterministico", "status": "OK" if mls else "PENDENTE", "detalhe": mls[0].tipo if mls else "Aguardando desvios"},
        {"ordem": 7, "nome": "Replanejamento em rascunho", "status": "OK" if any(r.get("status") == "RASCUNHO" for r in replans) else "PENDENTE", "detalhe": f"{len(replans)} replanejamentos"},
        {"ordem": 8, "nome": "Validacao/aplicacao pelo diretor", "status": "OK" if any(r.get("status") in {"APROVADO", "APLICADO"} for r in replans) else "PENDENTE", "detalhe": "Diretor decide aplicar ou rejeitar"},
        {"ordem": 9, "nome": "Novo plano oficial", "status": "OK" if any(r.get("status") == "APLICADO" for r in replans) else "PENDENTE", "detalhe": "Plano substituido quando aplicado"},
    ]
    return {"ok": True, "projeto": payload["projeto"], "nucleos": nucleos, "kpis": payload["kpis"], "steps": steps, "planejamento": plano, "desvios": desvios[:20], "ml": [_dict(m) for m in mls[:5]], "replanejamentos": replans[:20]}


@router.get("/api/nucleos")
def api_frontend_nucleos():
    items = [{"nome": p.nucleo, "projeto": p.nome, "nucleos": nucleos_do_projeto(p)} for p in _frontend_projects()]
    return {"items": items, "total": len(items)}
