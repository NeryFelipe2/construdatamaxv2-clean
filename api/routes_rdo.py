"""Rotas REST relacionadas ao RDO."""
from __future__ import annotations

import base64
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from api.operational import gerar_desvios_rdo, log_operational_event
from campo.rdo_automatico import criar_rdo_automatico
from campo.rdo_engine import DEFAULT_ORGANIZATION_ID, RDOEngine
from campo.rdo_integracoes import gerar_fontes_medicao, gerar_sinais_qualidade, resumo_relatorio360_rdo
from core.construdata_offline import nucleos_do_projeto
from core.database import get_session
from core.models import RDO

router = APIRouter(tags=["rdo"])
engine = RDOEngine()


def _safe_upload_name(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in "-_." else "_" for ch in str(name or "rdo_upload"))
    return cleaned[-160:] or "rdo_upload"


def _normalizar_payload_rdo(payload: dict) -> dict:
    normalized = dict(payload)
    normalized["organization_id"] = normalized.get("organization_id") or DEFAULT_ORGANIZATION_ID

    clima = normalized.get("clima")
    if isinstance(clima, str):
        normalized["clima"] = {"manha": clima, "tarde": clima}
    elif not isinstance(clima, dict):
        normalized["clima"] = {"manha": "", "tarde": ""}

    if normalized.get("apontamentos") and not normalized.get("servicos"):
        normalized["servicos"] = {
            "manual": [
                {
                    "ns_id": item.get("ns_id") or "manual",
                    "servico": item.get("servico") or item.get("descricao") or "Servico",
                    "quantidade": item.get("quantidade") or item.get("qtd") or 0,
                    "unidade": item.get("unidade") or "m",
                    "dn_mm": item.get("dn_mm") or 0,
                }
                for item in normalized.get("apontamentos", [])
                if isinstance(item, dict)
            ]
        }

    return normalized


@router.get("/api/rdo")
def api_listar_rdo(nucleo: str = Query(default=""), organization_id: str = Query(default=DEFAULT_ORGANIZATION_ID), status: str = Query(default="")):
    nucleos = nucleos_do_projeto(nucleo) if nucleo else []
    if len(nucleos) > 1:
        with get_session() as session:
            stmt = (
                select(RDO)
                .options(
                    selectinload(RDO.apontamentos),
                    selectinload(RDO.equipe),
                    selectinload(RDO.ocorrencias),
                    selectinload(RDO.fotos),
                    selectinload(RDO.evidencias),
                )
                .where(RDO.nucleo.in_(nucleos), RDO.deleted_at.is_(None))
                .order_by(RDO.data.desc(), RDO.id.desc())
            )
            if organization_id:
                stmt = stmt.where(RDO.organization_id == organization_id)
            rows = session.execute(stmt).scalars().all()
            items = [row.to_dict() for row in rows]
            if status:
                items = [item for item in items if item.get("status_revisao") == status]
            return {"items": items}
    items = engine.listar_rdos(nucleo=nucleo, organization_id=organization_id)
    if status:
        items = [item for item in items if item.get("status_revisao") == status]
    return {"items": items}


@router.post("/api/rdo")
def api_criar_rdo(payload: dict):
    if not payload.get("data"):
        raise HTTPException(status_code=400, detail="Campo 'data' obrigatorio")
    payload = _normalizar_payload_rdo(payload)
    rdo = engine.criar_rdo_completo(payload)
    nucleo = rdo.get("nucleo") or payload.get("nucleo") or "REDE"
    try:
        with get_session() as session:
            desvios = gerar_desvios_rdo(session, int(rdo["id"]), nucleo)
            rdo["desvios_planejamento"] = desvios
    except Exception as exc:
        with get_session() as session:
            log_operational_event(
                session,
                subsystem="rdo",
                event_type="erro_gerar_desvios",
                severity="ERROR",
                status="OPEN",
                nucleo=nucleo,
                error_message=str(exc),
                payload={"rdo_id": rdo.get("id")},
            )
        rdo["desvios_planejamento"] = []
        rdo["desvios_error"] = str(exc)
    return rdo


@router.post("/api/rdo/automatico/upload")
def api_rdo_automatico_upload(payload: dict):
    content_b64 = str(payload.get("content_base64") or "")
    if "," in content_b64 and content_b64.lower().startswith("data:"):
        content_b64 = content_b64.split(",", 1)[1]
    texto = str(payload.get("texto") or "")
    try:
        data = base64.b64decode(content_b64, validate=False) if content_b64 else texto.encode("utf-8")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Arquivo base64 invalido: {exc}") from exc
    if not data:
        raise HTTPException(status_code=400, detail="Arquivo/texto vazio")

    base = Path(engine.out_base) / "_RDO_EVIDENCIAS" / datetime.now().strftime("%Y%m%d")
    base.mkdir(parents=True, exist_ok=True)
    nome_original = payload.get("nome_arquivo") or ("rdo_texto.txt" if texto else "rdo_upload.bin")
    nome = f"{datetime.now().strftime('%H%M%S')}_{uuid4().hex[:8]}_{_safe_upload_name(nome_original)}"
    destino = base / nome
    destino.write_bytes(data)

    metadata = {
        "organization_id": payload.get("organization_id") or DEFAULT_ORGANIZATION_ID,
        "project_id": payload.get("project_id") or "",
        "nucleo": payload.get("nucleo") or "",
        "responsavel": payload.get("responsavel") or "",
        "usuario": payload.get("usuario") or "",
        "texto": texto,
        "local": payload.get("local") or "",
        "empreiteira": payload.get("empreiteira") or "",
        "encarregado": payload.get("encarregado") or "",
        "ordem_servico": payload.get("ordem_servico") or "",
        "assinatura_presente": bool(payload.get("assinatura_presente")),
        "nome_arquivo": nome_original,
        "mime_type": payload.get("mime_type") or "",
    }
    try:
        resultado = criar_rdo_automatico(str(destino), metadata, engine=engine)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Falha no RDO automatico: {exc}") from exc

    with get_session() as session:
        rdo = resultado.get("rdo") or {}
        log_operational_event(
            session,
            subsystem="rdo",
            event_type="rdo_automatico_upload",
            severity="INFO",
            status="OK",
            project_id=metadata["project_id"],
            nucleo=rdo.get("nucleo") or metadata["nucleo"],
            payload={"rdo_id": rdo.get("id"), "arquivo": str(destino), "pendencias": resultado.get("resultado_extracao", {}).get("pendencias", [])},
        )
    return resultado


@router.patch("/api/rdo/{rdo_id}/fechar")
def api_fechar_rdo(rdo_id: int):
    try:
        return engine.finalizar_rdo(rdo_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/rdo/{rdo_id}/pdf")
def api_rdo_pdf(rdo_id: int):
    rdo = engine.obter_rdo(rdo_id)
    if not rdo:
        raise HTTPException(status_code=404, detail="RDO nao encontrado")
    pdf_path = rdo.get("pdf_path") or engine.gerar_pdf(rdo_id)
    if not pdf_path:
        raise HTTPException(status_code=404, detail="PDF nao disponivel")
    path = Path(pdf_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Arquivo PDF nao encontrado")
    return FileResponse(path, media_type="application/pdf", filename=path.name)


@router.get("/api/rdo/{rdo_id}/evidencias")
def api_rdo_evidencias(rdo_id: int):
    if not engine.obter_rdo(rdo_id):
        raise HTTPException(status_code=404, detail="RDO nao encontrado")
    return {"items": engine.listar_evidencias(rdo_id)}


@router.patch("/api/rdo/{rdo_id}/revisar")
def api_rdo_revisar(rdo_id: int, payload: dict):
    try:
        rdo = engine.revisar_rdo(rdo_id, payload)
        with get_session() as session:
            log_operational_event(session, "rdo", "rdo_revisado", nucleo=rdo.get("nucleo"), project_id=rdo.get("project_id"), payload={"rdo_id": rdo_id})
        return rdo
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/rdo/{rdo_id}/finalizar")
def api_rdo_finalizar(rdo_id: int):
    try:
        rdo = engine.finalizar_rdo(rdo_id)
        with get_session() as session:
            log_operational_event(session, "rdo", "rdo_finalizado", nucleo=rdo.get("nucleo"), project_id=rdo.get("project_id"), payload={"rdo_id": rdo_id})
        return rdo
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/api/rdo/{rdo_id}/rejeitar")
def api_rdo_rejeitar(rdo_id: int, payload: dict | None = None):
    payload = payload or {}
    try:
        rdo = engine.rejeitar_rdo(rdo_id, payload.get("motivo") or "")
        with get_session() as session:
            log_operational_event(session, "rdo", "rdo_rejeitado", severity="WARN", nucleo=rdo.get("nucleo"), project_id=rdo.get("project_id"), payload={"rdo_id": rdo_id, "motivo": payload.get("motivo")})
        return rdo
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/rdo/{rdo_id}/medicao-fontes")
def api_rdo_medicao_fontes(rdo_id: int):
    with get_session() as session:
        if not session.get(RDO, rdo_id):
            raise HTTPException(status_code=404, detail="RDO nao encontrado")
        return {"items": gerar_fontes_medicao(session, rdo_id)}


@router.get("/api/relatorio360/rdo/{rdo_id}")
def api_relatorio360_rdo(rdo_id: int):
    with get_session() as session:
        if not session.get(RDO, rdo_id):
            raise HTTPException(status_code=404, detail="RDO nao encontrado")
        gerar_fontes_medicao(session, rdo_id)
        gerar_sinais_qualidade(session, rdo_id)
        return resumo_relatorio360_rdo(session, rdo_id)


@router.delete("/api/rdo/{rdo_id}")
def api_rdo_excluir_logicamente(rdo_id: int):
    try:
        rdo = engine.excluir_logicamente(rdo_id)
        with get_session() as session:
            log_operational_event(session, "rdo", "rdo_soft_delete", severity="WARN", nucleo=rdo.get("nucleo"), project_id=rdo.get("project_id"), payload={"rdo_id": rdo_id})
        return rdo
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/api/rdo/{data_ref}")
def api_rdo_do_dia(data_ref: str, nucleo: str = Query(default=""), organization_id: str = Query(default=DEFAULT_ORGANIZATION_ID)):
    if not nucleo:
        rows = engine.listar_rdos(organization_id=organization_id)
        for row in rows:
            if row.get("data") == data_ref:
                return row
        raise HTTPException(status_code=404, detail="RDO nao encontrado para a data informada")
    row = engine.rdo_do_dia(data_ref, nucleo, organization_id=organization_id)
    if row is None:
        raise HTTPException(status_code=404, detail="RDO nao encontrado para a data informada")
    return row
