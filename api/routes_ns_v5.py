"""Rotas da camada ns-v5 para o ConstruDataWeb."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.operational import tentar_xgboost
from campo.ns_v5_web import (
    contratos_ns_v5,
    listar_modulos_ns_v5,
    listar_projetos_ns_v5,
    module_payload,
    snapshot_ns_v5,
)
from campo.texto_operacional import aplicar_texto_operacional
from core.construdata_offline import get_project, nucleos_do_projeto
from core.database import get_session

router = APIRouter(prefix="/api/ns-v5", tags=["ns-v5-web"])


@router.get("/modules")
def api_ns_v5_modules():
    return listar_modulos_ns_v5()


@router.get("/contracts")
def api_ns_v5_contracts():
    return contratos_ns_v5()


@router.get("/projects")
def api_ns_v5_projects():
    return listar_projetos_ns_v5()


@router.get("/projects/{project_id}/snapshot")
def api_ns_v5_snapshot(project_id: str):
    try:
        return snapshot_ns_v5(project_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/projects/{project_id}/modules/{module_key}")
def api_ns_v5_module(project_id: str, module_key: str):
    try:
        return module_payload(project_id, module_key)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Modulo desconhecido: {module_key}") from exc


@router.post("/projects/{project_id}/rdo/preencher-texto")
def api_ns_v5_rdo_texto(project_id: str, payload: dict):
    texto = str(payload.get("texto") or payload.get("mensagem") or "")
    if not texto.strip():
        raise HTTPException(status_code=400, detail="Texto obrigatorio")
    return aplicar_texto_operacional(project_id, texto)


@router.post("/projects/{project_id}/ml/recalcular")
def api_ns_v5_ml(project_id: str):
    project = get_project(project_id=project_id)
    resultados = []
    with get_session() as session:
        for nucleo in nucleos_do_projeto(project):
            resultados.append(tentar_xgboost(session, nucleo))
    return {"ok": True, "project_id": project_id, "nucleos": nucleos_do_projeto(project), "resultados": resultados}
