from __future__ import annotations

import os
from datetime import date, datetime
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from api.supabase_client import (
    CANONICAL_PROJECT_IDS,
    PROJECT_ID_ALIASES,
    PROJETOS_OFICIAIS,
    TABLES_CANONICAS,
    get_supabase,
    supabase_config,
    table_status,
)

router = APIRouter(tags=["integracao-total"])


def _items(res: Any) -> list[dict[str, Any]]:
    data = getattr(res, "data", None)
    return data if isinstance(data, list) else []


def _canonical_project_id(project_id: str | None) -> str | None:
    if not project_id:
        return project_id
    return PROJECT_ID_ALIASES.get(str(project_id), str(project_id))


def _related_project_ids(project_id: str | None) -> list[str]:
    canonical = _canonical_project_id(project_id)
    if not canonical:
        return []
    ids = [canonical]
    ids.extend(alias for alias, target in PROJECT_ID_ALIASES.items() if target == canonical)
    if project_id and str(project_id) not in ids:
        ids.append(str(project_id))
    return ids


def _canonical_project_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    official_by_id = {str(p.get("id")): dict(p) for p in PROJETOS_OFICIAIS}
    by_id: dict[str, dict[str, Any]] = {project_id: dict(project) for project_id, project in official_by_id.items()}

    for row in rows:
        row_id = str(row.get("id") or "")
        canonical_id = _canonical_project_id(row_id)
        if not canonical_id:
            continue
        if canonical_id in official_by_id:
            merged = {**official_by_id[canonical_id], **{k: v for k, v in row.items() if v not in (None, "")}}
            merged["id"] = canonical_id
            # Keep the operational names stable even if legacy rows used older labels.
            merged["nome"] = official_by_id[canonical_id].get("nome") or merged.get("nome")
            by_id[canonical_id] = merged
        elif canonical_id not in by_id:
            by_id[canonical_id] = {**row, "id": canonical_id}

    ordered = [by_id[project_id] for project_id in CANONICAL_PROJECT_IDS if project_id in by_id]
    extras = [row for project_id, row in by_id.items() if project_id not in CANONICAL_PROJECT_IDS]
    return ordered + extras


def _dedupe(rows: list[dict[str, Any]], *keys: str) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    result: list[dict[str, Any]] = []
    for row in rows:
        key = tuple(row.get(k) for k in keys) if keys else (row.get("id"),)
        if key in seen:
            continue
        seen.add(key)
        result.append(row)
    return result


def _select(table: str, project_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    client = get_supabase()
    if client is None:
        return []
    query = client.table(table).select("*").limit(limit)
    if project_id:
        ids = _related_project_ids(project_id)
        if table == "rdos":
            id_filter = ",".join(ids)
            query = query.or_(f"projeto_id.in.({id_filter}),project_id.in.({id_filter})")
        elif table != "projetos":
            query = query.in_("projeto_id", ids)
    try:
        rows = _items(query.execute())
        if project_id and table == "rdos":
            ids = set(_related_project_ids(project_id))
            return [
                row
                for row in rows
                if str(row.get("projeto_id") or row.get("project_id") or "") in ids
            ]
        return rows
    except Exception:
        return []


def _project_or_404(project_id: str) -> dict[str, Any]:
    canonical_id = _canonical_project_id(project_id)
    for projeto in _canonical_project_rows(_select("projetos", limit=500)):
        if str(projeto.get("id")) == canonical_id:
            return projeto
    raise HTTPException(status_code=404, detail="Projeto nao encontrado")


def _sum(rows: list[dict[str, Any]], *keys: str) -> float:
    total = 0.0
    for row in rows:
        for key in keys:
            value = row.get(key)
            if value is not None:
                try:
                    total += float(value)
                    break
                except (TypeError, ValueError):
                    pass
    return total


@router.get("/api/health/integrations")
def health_integrations():
    client = get_supabase()
    tables = {table: table_status(client, table) for table in TABLES_CANONICAS}
    ok_tables = sum(1 for status in tables.values() if status.get("ok"))
    status = "connected" if ok_tables == len(TABLES_CANONICAS) else "partial" if ok_tables else "local"
    evolution_url = (os.environ.get("EVOLUTION_URL") or os.environ.get("EVOLUTION_API_URL") or "").rstrip("/")
    evolution_key = os.environ.get("EVOLUTION_API_KEY") or os.environ.get("AUTHENTICATION_API_KEY")
    evolution_instance = os.environ.get("EVOLUTION_INSTANCE") or os.environ.get("EVOLUTION_DEFAULT_INSTANCE") or "construdata-felipe"
    whatsapp_configured = bool(
        evolution_url
    ) and bool(
        evolution_key
    )
    whatsapp_state = "not_configured"
    if whatsapp_configured:
        whatsapp_state = "configured"
        try:
            response = httpx.get(
                f"{evolution_url}/instance/connectionState/{evolution_instance}",
                headers={"apikey": evolution_key},
                timeout=4.0,
            )
            if response.status_code < 400:
                whatsapp_state = response.json().get("instance", {}).get("state") or "configured"
        except Exception:
            whatsapp_state = "configured"
    return {
        "ok": status in {"connected", "partial"},
        "status": status,
        "supabase": supabase_config(),
        "tables": tables,
        "render_api": "connected",
        "whatsapp": whatsapp_state,
        "n8n": "external",
        "checked_at": datetime.utcnow().isoformat(),
    }


@router.get("/api/projetos")
def listar_projetos():
    rows = _select("projetos", limit=500)
    return {"items": _canonical_project_rows(rows), "source": "supabase" if rows else "fallback"}


@router.get("/api/projetos/{project_id}/rdos")
def listar_rdos_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _select("rdos", project_id=project_id, limit=300)}


@router.post("/api/projetos/{project_id}/rdos", status_code=201)
def criar_rdo_projeto(project_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    row["projeto_id"] = project_id
    row.setdefault("project_id", project_id)
    row.setdefault("data", date.today().isoformat())
    row.setdefault("origem", "web")
    row.setdefault("status", "recebido")
    try:
        created = client.table("rdos").insert(row).execute()
        event = {"projeto_id": project_id, "tipo": "rdo_created", "payload": row, "origem": row.get("origem")}
        try:
            client.table("workflow_events").insert(event).execute()
        except Exception:
            pass
        data = _items(created)
        return data[0] if data else row
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gravar RDO: {exc}") from exc


@router.get("/api/projetos/{project_id}/tarefas")
def listar_tarefas_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _select("tarefas", project_id=project_id, limit=300)}


@router.post("/api/projetos/{project_id}/tarefas", status_code=201)
def criar_tarefa_projeto(project_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    row["projeto_id"] = project_id
    row.setdefault("project_id", project_id)
    row.setdefault("titulo", row.get("descricao") or row.get("task") or "Tarefa sem titulo")
    row.setdefault("descricao", row.get("titulo") or row.get("task") or "Tarefa sem descricao")
    row.setdefault("status", "pendente")
    row.setdefault("prioridade", "normal")
    row.setdefault("origem", "api")
    row.setdefault("responsavel_nome", row.get("responsavel") or row.get("responsavel_nome") or "Responsavel")
    row.setdefault("responsavel", row.get("responsavel_nome"))
    row.setdefault("responsavel_telefone", row.get("responsavel_phone") or row.get("responsavel_telefone") or "sem-telefone")
    row.setdefault("responsavel_phone", row.get("responsavel_telefone"))
    row.setdefault("delegante_nome", row.get("delegante") or row.get("delegante_nome") or "ConstruData")
    row.setdefault("delegante", row.get("delegante_nome"))
    row.setdefault("delegante_phone", row.get("delegante_telefone") or row.get("delegante_phone") or "sistema")
    try:
        created = client.table("tarefas").insert(row).execute()
        data = _items(created)
        return data[0] if data else row
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gravar tarefa: {exc}") from exc


@router.post("/api/projetos/{project_id}/lps-restricoes", status_code=201)
def criar_lps_restricao(project_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    row["projeto_id"] = project_id
    row.setdefault("descricao", row.get("titulo") or row.get("restricao") or "Restricao sem descricao")
    row.setdefault("status", "aberto")
    row.setdefault("origem", "api")
    try:
        created = client.table("lps_restricoes").insert(row).execute()
        data = _items(created)
        return data[0] if data else row
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gravar restricao LPS: {exc}") from exc


@router.get("/api/projetos/{project_id}/contatos")
def listar_contatos_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _dedupe(_select("contatos", project_id=project_id, limit=300), "telefone_whatsapp", "nome")}


@router.get("/api/projetos/{project_id}/dashboard")
def dashboard_projeto(project_id: str):
    projeto = _project_or_404(project_id)
    frentes = _select("frentes", project_id=project_id)
    rdos = _select("rdos", project_id=project_id)
    tarefas = _select("tarefas", project_id=project_id)
    contatos = _select("contatos", project_id=project_id)
    restricoes = _select("lps_restricoes", project_id=project_id)
    custo_total = _sum(rdos, "custo_total_dia", "daily_cost_brl", "total_custo")
    return {
        "projeto": projeto,
        "kpis": {
            "frentes": len(frentes),
            "rdos_total": len(rdos),
            "rdos_hoje": len([r for r in rdos if str(r.get("data", "")).startswith(date.today().isoformat())]),
            "tarefas_pendentes": len([t for t in tarefas if str(t.get("status", "pendente")).lower() not in {"concluida", "concluido", "done"}]),
            "contatos": len(contatos),
            "restricoes_abertas": len([r for r in restricoes if str(r.get("status", "aberto")).lower() != "resolvido"]),
            "custo_total_dia": custo_total,
        },
        "frentes": frentes,
        "rdos": rdos[:20],
        "tarefas": tarefas[:30],
        "restricoes": restricoes[:30],
        "status": "connected" if get_supabase() else "local",
    }


@router.get("/api/projetos/{project_id}/torre")
def torre_projeto(project_id: str):
    payload = dashboard_projeto(project_id)
    return {
        "projeto": payload["projeto"],
        "frentes": payload["frentes"],
        "riscos": _select("punch_list_items", project_id=project_id),
        "restricoes": payload["restricoes"],
        "kpis": payload["kpis"],
        "status": payload["status"],
    }


@router.get("/api/projetos/{project_id}/gestao360")
def gestao360_projeto(project_id: str):
    payload = dashboard_projeto(project_id)
    return {
        **payload,
        "custos": {
            "diario": payload["kpis"]["custo_total_dia"],
            "rdos": len(payload["rdos"]),
        },
        "integracoes": {
            "rdo": "Conectado" if payload["rdos"] else "Parcial",
            "tarefas": "Conectado" if payload["tarefas"] else "Parcial",
            "lps": "Conectado" if payload["restricoes"] else "Parcial",
        },
    }
