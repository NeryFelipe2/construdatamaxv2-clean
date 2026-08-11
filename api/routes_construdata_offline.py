"""Rotas locais do ConstruData offline."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core.construdata_offline import (
    build_project_report,
    create_contact,
    create_project,
    create_entity,
    dashboard_counts,
    export_project_report,
    get_project,
    list_contacts,
    list_entity,
    list_projects,
    offline_health,
    project_snapshot,
    set_entity_status,
)

router = APIRouter(prefix="/api/offline", tags=["construdata-offline"])


@router.get("/health")
def api_offline_health():
    return offline_health()


@router.get("/projetos")
def api_offline_projetos():
    return {"items": [p.to_row() for p in list_projects()]}


@router.post("/projetos")
def api_offline_projeto_create(payload: dict):
    return {"ok": True, "id": create_project(payload)}


@router.get("/contatos")
def api_offline_contatos():
    return {"items": [c.to_row() for c in list_contacts()]}


@router.post("/contatos")
def api_offline_contato_create(payload: dict):
    return {"ok": True, "id": create_contact(payload)}


@router.get("/projetos/{project_id}/dashboard")
def api_offline_dashboard(project_id: str):
    project = get_project(project_id=project_id)
    return {"project": project.to_row(), "counts": dashboard_counts(project.id)}


@router.get("/projetos/{project_id}/snapshot")
def api_offline_snapshot(project_id: str):
    return project_snapshot(project_id)


@router.get("/projetos/{project_id}/relatorio360")
def api_offline_relatorio(project_id: str):
    project = get_project(project_id=project_id)
    return {"project": project.to_row(), "markdown": build_project_report(project.id)}


@router.post("/projetos/{project_id}/relatorio360/export")
def api_offline_relatorio_export(project_id: str):
    project = get_project(project_id=project_id)
    return {"ok": True, "path": export_project_report(project.id)}


@router.get("/projetos/{project_id}/{entity}")
def api_offline_entity_list(project_id: str, entity: str):
    try:
        project = get_project(project_id=project_id)
        return {"items": [row.to_row() for row in list_entity(entity, project.id)]}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Entidade desconhecida: {entity}") from exc


@router.post("/projetos/{project_id}/{entity}")
def api_offline_entity_create(project_id: str, entity: str, payload: dict):
    try:
        project = get_project(project_id=project_id)
        row_id = create_entity(entity, project.id, payload)
        return {"ok": True, "id": row_id}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Entidade desconhecida: {entity}") from exc


@router.patch("/{entity}/{row_id}/status")
def api_offline_entity_status(entity: str, row_id: int, payload: dict):
    try:
        set_entity_status(entity, row_id, payload.get("status", "CONCLUIDO"))
        return {"ok": True}
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"Entidade desconhecida: {entity}") from exc
