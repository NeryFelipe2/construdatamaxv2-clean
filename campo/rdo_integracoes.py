"""Integracoes derivadas do RDO: medicao, qualidade, gestao e relatorio 360."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from core.models import RDO, RDOMedicaoFonte, RDOQualidadeSinal


def gerar_fontes_medicao(session: Session, rdo_id: int) -> list[dict]:
    existentes = session.execute(
        select(RDOMedicaoFonte).where(RDOMedicaoFonte.rdo_id == rdo_id)
    ).scalars().all()
    if existentes:
        return [item.to_dict() for item in existentes]

    rdo = session.get(RDO, rdo_id)
    if not rdo:
        return []

    evidencia_id = rdo.evidencias[0].id if rdo.evidencias else None
    fontes: list[RDOMedicaoFonte] = []
    for apont in rdo.apontamentos:
        fonte = RDOMedicaoFonte(
            rdo_id=rdo.id,
            apontamento_id=apont.id,
            organization_id=rdo.organization_id,
            project_id=rdo.project_id,
            nucleo=rdo.nucleo,
            trecho=rdo.local or (f"NS {apont.ns_id}" if apont.ns_id else "manual"),
            servico=apont.servico,
            data=rdo.data,
            quantidade=apont.quantidade,
            unidade=apont.unidade,
            responsavel=rdo.responsavel,
            empreiteira=rdo.empreiteira,
            evidencia_id=evidencia_id,
            origem="rdo",
            status="pendente_conferencia",
        )
        session.add(fonte)
        fontes.append(fonte)
    session.flush()
    return [item.to_dict() for item in fontes]


def gerar_sinais_qualidade(session: Session, rdo_id: int) -> list[dict]:
    existentes = session.execute(
        select(RDOQualidadeSinal).where(RDOQualidadeSinal.rdo_id == rdo_id)
    ).scalars().all()
    if existentes:
        return [item.to_dict() for item in existentes]

    rdo = session.get(RDO, rdo_id)
    if not rdo:
        return []

    tem_evidencia = bool(rdo.evidencias or rdo.fotos)
    tokens_foto = ("assentamento", "recomposicao", "recomposição", "pv", "pi", "teste", "escavacao", "escavação")
    tokens_fvs = ("teste", "estanqueidade", "recomposicao", "recomposição", "assentamento")
    sinais: list[RDOQualidadeSinal] = []

    for apont in rdo.apontamentos:
        servico = (apont.servico or "").lower()
        exige_evidencia = any(token in servico for token in tokens_foto)
        exige_fvs = any(token in servico for token in tokens_fvs)
        if exige_evidencia and not tem_evidencia:
            sinal = RDOQualidadeSinal(
                rdo_id=rdo.id,
                apontamento_id=apont.id,
                organization_id=rdo.organization_id,
                severidade="ALTA",
                tipo="SEM_EVIDENCIA_MINIMA",
                descricao=f"Servico '{apont.servico}' sem foto/documento vinculado ao RDO.",
                exige_fvs=exige_fvs,
                evidencia_ok=False,
                status="aberto",
            )
            session.add(sinal)
            sinais.append(sinal)
        elif exige_fvs:
            sinal = RDOQualidadeSinal(
                rdo_id=rdo.id,
                apontamento_id=apont.id,
                organization_id=rdo.organization_id,
                severidade="MEDIA",
                tipo="FVS_PENDENTE_CONFERENCIA",
                descricao=f"Servico '{apont.servico}' deve ser conferido contra FVS/checklist tecnico.",
                exige_fvs=True,
                evidencia_ok=tem_evidencia,
                status="aberto",
            )
            session.add(sinal)
            sinais.append(sinal)

    session.flush()
    return [item.to_dict() for item in sinais]


def resumo_gestao360_rdo(session: Session, rdo_id: int) -> dict:
    rdo = session.get(RDO, rdo_id)
    if not rdo:
        return {}

    producao_por_servico: dict[str, float] = {}
    for apont in rdo.apontamentos:
        chave = apont.servico or "Servico"
        producao_por_servico[chave] = round(producao_por_servico.get(chave, 0.0) + float(apont.quantidade or 0), 3)

    return {
        "rdo_id": rdo.id,
        "data": str(rdo.data),
        "organization_id": rdo.organization_id,
        "project_id": rdo.project_id,
        "nucleo": rdo.nucleo,
        "empreiteira": rdo.empreiteira,
        "encarregado": rdo.encarregado,
        "producao_por_servico": producao_por_servico,
        "equipe_total": sum(item.quantidade or 0 for item in rdo.equipe),
        "custo_total": rdo.total_custo or 0,
        "frente_sem_evolucao": not bool(rdo.apontamentos),
        "alertas": len(rdo.qualidade_sinais),
    }


def resumo_relatorio360_rdo(session: Session, rdo_id: int) -> dict:
    rdo = session.get(RDO, rdo_id)
    if not rdo:
        return {}

    return {
        "rdo": rdo.to_dict(),
        "producao": [item.to_dict() for item in rdo.apontamentos],
        "equipe": [item.to_dict() for item in rdo.equipe],
        "ocorrencias": [item.to_dict() for item in rdo.ocorrencias],
        "fotos": [item.to_dict() for item in rdo.fotos],
        "evidencias": [item.to_dict() for item in rdo.evidencias],
        "medicao_fontes": [item.to_dict() for item in rdo.medicao_fontes],
        "pendencias_qualidade": [item.to_dict() for item in rdo.qualidade_sinais],
        "gestao360": resumo_gestao360_rdo(session, rdo_id),
    }
