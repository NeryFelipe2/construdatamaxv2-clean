from __future__ import annotations

from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException

from api.supabase_client import PROJETOS_OFICIAIS, TABLES_CANONICAS, get_supabase, supabase_config, table_status

router = APIRouter(tags=["integracao-total"])


def _items(res: Any) -> list[dict[str, Any]]:
    data = getattr(res, "data", None)
    return data if isinstance(data, list) else []


def _select(table: str, project_id: str | None = None, limit: int = 200) -> list[dict[str, Any]]:
    client = get_supabase()
    if client is None:
        return []
    query = client.table(table).select("*").limit(limit)
    if project_id:
        query = query.eq("projeto_id", project_id)
    try:
        return _items(query.execute())
    except Exception:
        return []


def _project_or_404(project_id: str) -> dict[str, Any]:
    for projeto in _select("projetos", limit=500) or PROJETOS_OFICIAIS:
        if str(projeto.get("id")) == project_id:
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
    return {
        "ok": status in {"connected", "partial"},
        "status": status,
        "supabase": supabase_config(),
        "tables": tables,
        "render_api": "connected",
        "whatsapp": "configured" if client else "partial",
        "n8n": "external",
        "checked_at": datetime.utcnow().isoformat(),
    }


@router.get("/api/projetos")
def listar_projetos():
    rows = _select("projetos", limit=500)
    return {"items": rows or PROJETOS_OFICIAIS, "source": "supabase" if rows else "fallback"}


@router.get("/api/projetos/{project_id}/rdos")
def listar_rdos_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _select("rdos", project_id=project_id, limit=300)}


@router.post("/api/projetos/{project_id}/rdos", status_code=201)
def criar_rdo_projeto(project_id: str, payload: dict[str, Any]):
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    row["projeto_id"] = project_id
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


@router.get("/api/projetos/{project_id}/contatos")
def listar_contatos_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _select("contatos", project_id=project_id, limit=300)}


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

