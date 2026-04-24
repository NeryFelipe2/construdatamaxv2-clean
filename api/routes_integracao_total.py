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
        elif table in {"lancamentos_financeiros", "trechos_custo"}:
            query = query.in_("project_id", ids)
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


def _item(res: Any) -> dict[str, Any] | None:
    items = _items(res)
    return items[0] if items else None


def _as_list(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    return []


def _normalize_rdo_clima(value: Any) -> str | None:
    normalized = str(value or "").strip().lower()
    aliases = {
        "good": "bom",
        "cloudy": "nublado",
        "rain": "chuva",
        "storm": "tempestade",
        "bom": "bom",
        "nublado": "nublado",
        "chuva": "chuva",
        "tempestade": "tempestade",
    }
    return aliases.get(normalized)


RDO_INSERT_COLUMNS = {
    "id",
    "projeto_id",
    "project_id",
    "frente_id",
    "data",
    "engenheiro",
    "apontador",
    "clima",
    "turno",
    "producao",
    "producao_m",
    "equipe",
    "equipe_number",
    "maquinas",
    "equipamentos",
    "locacoes",
    "mao_obra",
    "materiais",
    "custo_direto",
    "custo_indireto",
    "custo_total_dia",
    "ocorrencias",
    "paralisacoes",
    "observacoes",
    "fotos",
    "latitude",
    "longitude",
    "lps_id",
    "restricoes",
    "origem",
    "status",
    "payload_original",
    "created_at",
    "updated_at",
}


def _stringify_summary(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, dict):
                parts.append(
                    str(
                        item.get("descricao")
                        or item.get("description")
                        or item.get("nome")
                        or item.get("name")
                        or item
                    )
                )
            elif item not in (None, ""):
                parts.append(str(item))
        return "; ".join(parts)
    if isinstance(value, dict):
        return str(value.get("descricao") or value.get("description") or value.get("nome") or value.get("name") or value)
    return "" if value is None else str(value)


def _normalize_rdo_row(payload: dict[str, Any], project_id: str) -> dict[str, Any]:
    row = dict(payload)
    row["projeto_id"] = project_id
    row.setdefault("project_id", project_id)
    row.setdefault("data", date.today().isoformat())
    row.setdefault("origem", "web")
    row.setdefault("status", "recebido")
    row.setdefault("engenheiro", row.get("responsavel") or row.get("responsavel_nome") or row.get("apontador"))
    row.setdefault("apontador", row.get("responsavel") or row.get("responsavel_nome") or row.get("engenheiro"))
    if row.get("custos_diretos") is not None and row.get("custo_direto") is None:
        row["custo_direto"] = row.get("custos_diretos")
    if row.get("custos_indiretos") is not None and row.get("custo_indireto") is None:
        row["custo_indireto"] = row.get("custos_indiretos")
    localizacao = row.get("localizacao")
    if isinstance(localizacao, dict):
        row.setdefault("latitude", localizacao.get("lat") or localizacao.get("latitude"))
        row.setdefault("longitude", localizacao.get("lng") or localizacao.get("lon") or localizacao.get("longitude"))
    for list_field in ("maquinas", "equipamentos", "locacoes", "mao_obra", "materiais", "restricoes"):
        value = row.get(list_field)
        row[list_field] = value if isinstance(value, list) else []
    if "equipe" in row and isinstance(row.get("equipe"), list):
        row["equipe_lista"] = row["equipe"]
        row["equipe"] = _stringify_summary(row["equipe"])
    if "ocorrencias" in row and isinstance(row.get("ocorrencias"), list):
        row["ocorrencias_lista"] = row["ocorrencias"]
        row["ocorrencias"] = _stringify_summary(row["ocorrencias"])
    fotos = row.get("fotos")
    row["fotos"] = fotos if isinstance(fotos, list) else []
    payload_original = row.get("payload_original")
    row["payload_original"] = payload_original if isinstance(payload_original, dict) else {}
    row["payload_original"].setdefault("raw", payload)
    clima = _normalize_rdo_clima(row.get("clima"))
    if clima:
        row["clima"] = clima
    else:
        row.pop("clima", None)
    return row


def _rdo_insert_row(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key in RDO_INSERT_COLUMNS}


def _safe_insert_many(client: Any, table: str, rows: list[dict[str, Any]]) -> dict[str, Any]:
    if not rows:
        return {"ok": True, "count": 0, "items": []}
    try:
        result = client.table(table).insert(rows).execute()
        items = _items(result)
        return {"ok": True, "count": len(items) if items else len(rows), "items": items}
    except Exception as exc:
        return {"ok": False, "count": 0, "items": [], "error": str(exc)}


def _persist_rdo_children(client: Any, rdo_id: str, row: dict[str, Any]) -> dict[str, Any]:
    apontador = row.get("apontador") or row.get("engenheiro") or "Responsavel"
    payload_original = row.get("payload_original") if isinstance(row.get("payload_original"), dict) else {}
    services = _as_list(payload_original.get("services"))
    trechos = _as_list(payload_original.get("trechos"))
    atividades = _as_list(row.get("atividades"))
    equipe_lista = _as_list(row.get("equipe_lista"))
    maquinas = _as_list(row.get("maquinas"))
    equipamentos = _as_list(row.get("equipamentos"))
    locacoes = _as_list(row.get("locacoes"))
    mao_obra = _as_list(row.get("mao_obra"))
    materiais = _as_list(row.get("materiais"))
    ocorrencias_lista = _as_list(row.get("ocorrencias_lista"))

    equipe_rows: list[dict[str, Any]] = []
    for item in equipe_lista:
        quantidade = int(float(item.get("quantidade") or item.get("qtd") or 1))
        equipe_rows.append(
            {
                "rdo_id": rdo_id,
                "tipo": item.get("funcao") or item.get("cargo") or item.get("tipo") or "equipe",
                "lider_nome": apontador,
                "quantidade": quantidade,
                "metadata": item,
            }
        )
    for item in mao_obra:
        quantidade = int(float(item.get("quantidade") or 0))
        if quantidade <= 0:
            continue
        equipe_rows.append(
            {
                "rdo_id": rdo_id,
                "tipo": item.get("tipo") or item.get("cargo") or "equipe",
                "lider_nome": apontador,
                "quantidade": quantidade,
                "metadata": item,
            }
        )
    if not equipe_rows and row.get("equipe_number"):
        equipe_rows.append(
            {
                "rdo_id": rdo_id,
                "tipo": "equipe_principal",
                "lider_nome": apontador,
                "quantidade": int(float(row.get("equipe_number") or 0)),
                "metadata": {"equipe": row.get("equipe")},
            }
        )

    equipes_result = _safe_insert_many(client, "rdo_equipes", equipe_rows)
    equipe_id = None
    if equipes_result.get("items"):
        equipe_id = equipes_result["items"][0].get("id")

    atividade_rows: list[dict[str, Any]] = []
    for service in services:
        atividade_rows.append(
            {
                "rdo_id": rdo_id,
                "equipe_id": equipe_id,
                "servico": service.get("description") or service.get("descricao") or "Servico",
                "metragem": float(service.get("quantity") or 0) if str(service.get("unit") or "").lower() == "m" else 0,
                "observacao": f"{service.get('quantity', 0)} {service.get('unit') or 'un'}",
            }
        )
    for trecho in trechos:
        atividade_rows.append(
            {
                "rdo_id": rdo_id,
                "equipe_id": equipe_id,
                "rua": trecho.get("trechoCode") or "",
                "servico": trecho.get("trechoDescription") or "Trecho executado",
                "metragem": float(trecho.get("executedMeters") or 0),
                "observacao": trecho.get("status") or "",
            }
        )
    for atividade in atividades:
        quantidade = float(atividade.get("quantidade") or atividade.get("quantity") or atividade.get("metragem") or 0)
        unidade = atividade.get("unidade") or atividade.get("unit") or "un"
        atividade_rows.append(
            {
                "rdo_id": rdo_id,
                "equipe_id": equipe_id,
                "rua": atividade.get("rua") or atividade.get("local") or "",
                "servico": atividade.get("servico") or atividade.get("descricao") or atividade.get("description") or "Atividade",
                "metragem": quantidade if str(unidade).lower() in {"m", "metro", "metros"} else 0,
                "observacao": f"{quantidade:g} {unidade}".strip(),
            }
        )

    material_rows = [
        {
            "rdo_id": rdo_id,
            "descricao": item.get("descricao") or item.get("description") or item.get("nome") or "Material",
            "quantidade": float(item.get("quantidade") or item.get("quantity") or 0),
            "unidade": item.get("unidade") or item.get("unit") or "un",
            "custo": float(
                item.get("custo")
                or item.get("costBRL")
                or (
                    float(item.get("quantidade") or item.get("quantity") or 0)
                    * float(item.get("custo_unitario") or item.get("unitCostBRL") or 0)
                )
                or 0
            ),
        }
        for item in materiais
    ]

    equipamento_rows = [
        {
            "rdo_id": rdo_id,
            "tipo": "maquina",
            "descricao": item.get("nome") or item.get("description") or "Maquina",
            "quantidade": float(item.get("quantidade") or item.get("quantity") or 0),
            "horas": float(item.get("horas") or item.get("hours") or 0),
            "custo": float(
                item.get("custo")
                or item.get("custoBRL")
                or item.get("costBRL")
                or (
                    float(item.get("quantidade") or item.get("quantity") or 0)
                    * float(item.get("horas") or item.get("hours") or 0)
                    * float(item.get("custo_hora") or item.get("hourCostBRL") or 0)
                )
                or 0
            ),
        }
        for item in maquinas
    ] + [
        {
            "rdo_id": rdo_id,
            "tipo": "equipamento",
            "descricao": item.get("nome") or item.get("description") or "Equipamento",
            "quantidade": float(item.get("quantidade") or item.get("quantity") or 0),
            "horas": float(item.get("horas") or item.get("hours") or 0),
            "custo": float(
                item.get("custo")
                or item.get("custoBRL")
                or item.get("costBRL")
                or (
                    float(item.get("quantidade") or item.get("quantity") or 0)
                    * float(item.get("horas") or item.get("hours") or 0)
                    * float(item.get("custo_hora") or item.get("hourCostBRL") or 0)
                )
                or 0
            ),
        }
        for item in equipamentos
    ] + [
        {
            "rdo_id": rdo_id,
            "tipo": "locacao",
            "descricao": item.get("nome") or item.get("description") or "Locacao",
            "quantidade": float(item.get("quantidade") or item.get("quantity") or 1),
            "horas": float(item.get("horas") or item.get("hours") or 0),
            "custo": float(
                item.get("custo")
                or item.get("custoBRL")
                or item.get("costBRL")
                or (
                    float(item.get("quantidade") or item.get("quantity") or 1)
                    * float(item.get("horas") or item.get("hours") or 0)
                    * float(item.get("custo_hora") or item.get("hourCostBRL") or 0)
                )
                or 0
            ),
        }
        for item in locacoes
    ]

    mao_obra_rows = [
        {
            "rdo_id": rdo_id,
            "cargo": item.get("cargo") or item.get("funcao") or item.get("tipo") or "Equipe",
            "quantidade": float(item.get("quantidade") or 0),
            "horas": float(item.get("horas") or item.get("hours") or 0),
            "custo": float(
                item.get("custo")
                or item.get("costBRL")
                or (
                    float(item.get("quantidade") or 0)
                    * float(item.get("horas") or item.get("hours") or 0)
                    * float(item.get("custo_hora") or item.get("hourCostBRL") or 0)
                )
                or 0
            ),
        }
        for item in mao_obra
    ]

    ocorrencia_rows: list[dict[str, Any]] = []
    for item in ocorrencias_lista:
        ocorrencia_rows.append(
            {
                "rdo_id": rdo_id,
                "tipo": item.get("tipo") or "ocorrencia",
                "descricao": item.get("descricao") or item.get("description") or "Ocorrencia",
                "paralisa_obra": bool(item.get("paralisa_obra") or item.get("paralisacao")),
            }
        )
    if row.get("ocorrencias") and not ocorrencias_lista:
        ocorrencia_rows.append(
            {
                "rdo_id": rdo_id,
                "tipo": "ocorrencia",
                "descricao": row.get("ocorrencias"),
                "paralisa_obra": False,
            }
        )
    if row.get("paralisacoes"):
        ocorrencia_rows.append(
            {
                "rdo_id": rdo_id,
                "tipo": "paralisacao",
                "descricao": row.get("paralisacoes"),
                "paralisa_obra": True,
            }
        )

    return {
        "equipes": equipes_result,
        "atividades": _safe_insert_many(client, "rdo_atividades", atividade_rows),
        "materiais": _safe_insert_many(client, "rdo_materiais", material_rows),
        "equipamentos": _safe_insert_many(client, "rdo_equipamentos", equipamento_rows),
        "mao_obra": _safe_insert_many(client, "rdo_mao_obra", mao_obra_rows),
        "ocorrencias": _safe_insert_many(client, "rdo_ocorrencias", ocorrencia_rows),
    }


def _normalize_whatsapp_schedule_payload(payload: dict[str, Any]) -> dict[str, Any]:
    destinatarios = payload.get("destinatarios")
    if not isinstance(destinatarios, list):
        destinatarios = []
    clean_destinatarios: list[dict[str, Any]] = []
    for item in destinatarios:
        if isinstance(item, dict):
            clean_destinatarios.append(
                {
                    "nome": item.get("nome") or item.get("name") or "Contato",
                    "telefone": item.get("telefone") or item.get("phone") or "",
                    "contato_id": item.get("contato_id") or item.get("id"),
                }
            )
        elif isinstance(item, str):
            clean_destinatarios.append({"nome": item, "telefone": "", "contato_id": None})
    return {
        "templateId": payload.get("templateId") or payload.get("template_id") or "custom",
        "templateNome": payload.get("templateNome") or payload.get("template_nome") or payload.get("nome") or "Fluxo WhatsApp",
        "mensagem": payload.get("mensagem") or payload.get("message") or "",
        "frequencia": payload.get("frequencia") or payload.get("frequency") or "diario",
        "horario": payload.get("horario") or payload.get("time") or "07:00",
        "destinatarios": clean_destinatarios,
        "ativo": bool(payload.get("ativo", True)),
        "origem": payload.get("origem") or "api",
        "totalEnviados": int(payload.get("totalEnviados") or payload.get("total_enviados") or 0),
        "ultimaExecucao": payload.get("ultimaExecucao") or payload.get("ultima_execucao"),
    }


def _schedule_from_event(row: dict[str, Any]) -> dict[str, Any]:
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    schedule = _normalize_whatsapp_schedule_payload(payload)
    status = str(row.get("status") or "").strip().lower()
    schedule["id"] = row.get("id")
    schedule["projeto_id"] = row.get("projeto_id")
    schedule["workflow_id"] = row.get("workflow_id")
    schedule["execution_id"] = row.get("execution_id")
    schedule["created_at"] = row.get("created_at")
    schedule["updated_status"] = row.get("status")
    schedule["ativo"] = status not in {"cancelado", "pausado", "inactive", "deleted"} and bool(schedule.get("ativo", True))
    return schedule


def _whatsapp_log_item(row: dict[str, Any]) -> dict[str, Any]:
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    return {
        "id": row.get("id"),
        "telefone": row.get("telefone") or payload.get("telefone") or "",
        "nome": row.get("nome") or payload.get("nome") or "Contato",
        "direction": row.get("direction") or "outbound",
        "tipo": row.get("tipo") or payload.get("tipo") or "mensagem",
        "mensagem": row.get("mensagem") or payload.get("mensagem") or "",
        "status": row.get("status") or "recebido",
        "created_at": row.get("created_at"),
        "payload": payload,
    }


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


@router.post("/api/projetos", status_code=201)
def criar_projeto(payload: dict[str, Any]):
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    row.setdefault("nome", row.get("titulo") or "Projeto sem nome")
    row.setdefault("contrato", row.get("codigo") or "")
    row.setdefault("cidade", "")
    row.setdefault("cliente", "ConstruData")
    row.setdefault("tipo", "esgoto")
    row.setdefault("data_inicio", date.today().isoformat())
    row.setdefault("data_fim", None)
    row.setdefault("orcamento_total", 0)
    row.setdefault("status", "ativo")
    row.setdefault("responsavel_nome", row.get("responsavel_nome") or row.get("responsavel") or "")
    row.setdefault("responsavel_telefone", row.get("responsavel_telefone") or "")
    try:
        created = client.table("projetos").insert(row).execute()
        data = _items(created)
        if not data:
            return row
        canonical = _canonical_project_rows(data)
        return canonical[0] if canonical else data[0]
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gravar projeto: {exc}") from exc


@router.get("/api/projetos/{project_id}/rdos")
def listar_rdos_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _select("rdos", project_id=project_id, limit=300)}


@router.get("/api/projetos/{project_id}/rdos/{rdo_id}")
def detalhar_rdo_projeto(project_id: str, rdo_id: str):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        rdo = (
            client.table("rdos")
            .select("*")
            .eq("id", rdo_id)
            .eq("projeto_id", project_id)
            .limit(1)
            .execute()
        )
        row = _item(rdo)
        if row is None:
            raise HTTPException(status_code=404, detail="RDO nao encontrado")
        return {
            "rdo": row,
            "children": {
                "equipes": _items(client.table("rdo_equipes").select("*").eq("rdo_id", rdo_id).execute()),
                "atividades": _items(client.table("rdo_atividades").select("*").eq("rdo_id", rdo_id).execute()),
                "materiais": _items(client.table("rdo_materiais").select("*").eq("rdo_id", rdo_id).execute()),
                "equipamentos": _items(client.table("rdo_equipamentos").select("*").eq("rdo_id", rdo_id).execute()),
                "mao_obra": _items(client.table("rdo_mao_obra").select("*").eq("rdo_id", rdo_id).execute()),
                "ocorrencias": _items(client.table("rdo_ocorrencias").select("*").eq("rdo_id", rdo_id).execute()),
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao detalhar RDO: {exc}") from exc


@router.post("/api/projetos/{project_id}/rdos", status_code=201)
def criar_rdo_projeto(project_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = _normalize_rdo_row(payload, project_id)
    insert_row = _rdo_insert_row(row)
    try:
        created = client.table("rdos").insert(insert_row).execute()
        data = _items(created)
        created_row = data[0] if data else insert_row
        child_persistence = None
        if created_row.get("id"):
            child_persistence = _persist_rdo_children(client, str(created_row["id"]), row)
        event = {
            "projeto_id": project_id,
            "tipo": "rdo_created",
            "payload": {
                "rdo_id": created_row.get("id"),
                "data": created_row.get("data"),
                "origem": row.get("origem"),
                "status": created_row.get("status"),
                "child_persistence": child_persistence,
            },
            "origem": row.get("origem"),
        }
        try:
            client.table("workflow_events").insert(event).execute()
        except Exception:
            pass
        if created_row.get("id") and row.get("lps_id"):
            try:
                client.table("lps_restricoes").update({"rdo_id": created_row["id"]}).eq("id", row["lps_id"]).execute()
            except Exception:
                pass
        return {
            **created_row,
            "child_persistence": child_persistence or {},
        }
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


@router.get("/api/projetos/{project_id}/lps-restricoes")
def listar_lps_restricoes_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _select("lps_restricoes", project_id=project_id, limit=300)}


@router.get("/api/projetos/{project_id}/contatos")
def listar_contatos_projeto(project_id: str):
    _project_or_404(project_id)
    return {"items": _dedupe(_select("contatos", project_id=project_id, limit=300), "telefone_whatsapp", "nome")}


@router.post("/api/projetos/{project_id}/contatos", status_code=201)
def criar_contato_projeto(project_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    row["projeto_id"] = project_id
    row.setdefault("nome", row.get("responsavel") or "Contato sem nome")
    row.setdefault("cargo", row.get("papel") or "Responsavel")
    row.setdefault("telefone_whatsapp", row.get("telefone") or row.get("telefone_whatsapp") or "sem-telefone")
    row.setdefault("frente_id", None)
    row.setdefault("ativo", True)
    row.setdefault("foto_url", None)
    try:
        created = client.table("contatos").insert(row).execute()
        data = _items(created)
        return data[0] if data else row
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao gravar contato: {exc}") from exc


@router.patch("/api/projetos/{project_id}/contatos/{contato_id}")
def atualizar_contato_projeto(project_id: str, contato_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    if "telefone" in row and "telefone_whatsapp" not in row:
        row["telefone_whatsapp"] = row.pop("telefone")
    try:
        updated = (
            client.table("contatos")
            .update(row)
            .eq("id", contato_id)
            .eq("projeto_id", project_id)
            .execute()
        )
        data = _items(updated)
        return data[0] if data else {"id": contato_id, "projeto_id": project_id, **row}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar contato: {exc}") from exc


@router.delete("/api/projetos/{project_id}/contatos/{contato_id}")
def remover_contato_projeto(project_id: str, contato_id: str):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        client.table("contatos").delete().eq("id", contato_id).eq("projeto_id", project_id).execute()
        return {"ok": True, "id": contato_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao remover contato: {exc}") from exc


@router.get("/api/projetos/{project_id}/whatsapp/logs")
def listar_whatsapp_logs_projeto(project_id: str, limit: int = 100):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        rows = _items(
            client.table("whatsapp_logs")
            .select("*")
            .eq("projeto_id", project_id)
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 500)))
            .execute()
        )
        return {
            "items": [_whatsapp_log_item(row) for row in rows],
            "status": "connected",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar logs de WhatsApp: {exc}") from exc


@router.get("/api/projetos/{project_id}/whatsapp/agendamentos")
def listar_whatsapp_agendamentos_projeto(project_id: str, limit: int = 100):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        rows = _items(
            client.table("workflow_events")
            .select("*")
            .eq("projeto_id", project_id)
            .eq("tipo", "whatsapp_schedule")
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 300)))
            .execute()
        )
        return {
            "items": [_schedule_from_event(row) for row in rows],
            "status": "connected",
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao carregar agendamentos de WhatsApp: {exc}") from exc


@router.post("/api/projetos/{project_id}/whatsapp/agendamentos", status_code=201)
def criar_whatsapp_agendamento_projeto(project_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    schedule_payload = _normalize_whatsapp_schedule_payload(payload)
    status = "ativo" if schedule_payload.get("ativo", True) else "pausado"
    row = {
        "projeto_id": project_id,
        "tipo": "whatsapp_schedule",
        "origem": schedule_payload.get("origem") or "api",
        "status": status,
        "payload": schedule_payload,
    }
    try:
        created = client.table("workflow_events").insert(row).execute()
        item = _item(created)
        return _schedule_from_event(item or row)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao criar agendamento de WhatsApp: {exc}") from exc


@router.patch("/api/projetos/{project_id}/whatsapp/agendamentos/{agendamento_id}")
def atualizar_whatsapp_agendamento_projeto(project_id: str, agendamento_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        current = _item(
            client.table("workflow_events")
            .select("*")
            .eq("id", agendamento_id)
            .eq("projeto_id", project_id)
            .eq("tipo", "whatsapp_schedule")
            .limit(1)
            .execute()
        )
        if current is None:
            raise HTTPException(status_code=404, detail="Agendamento nao encontrado")
        current_payload = current.get("payload") if isinstance(current.get("payload"), dict) else {}
        merged_payload = _normalize_whatsapp_schedule_payload({**current_payload, **payload})
        status = "ativo" if merged_payload.get("ativo", True) else "pausado"
        updated = (
            client.table("workflow_events")
            .update({"payload": merged_payload, "status": status})
            .eq("id", agendamento_id)
            .eq("projeto_id", project_id)
            .execute()
        )
        item = _item(updated)
        return _schedule_from_event(item or {**current, "payload": merged_payload, "status": status})
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar agendamento de WhatsApp: {exc}") from exc


@router.delete("/api/projetos/{project_id}/whatsapp/agendamentos/{agendamento_id}")
def remover_whatsapp_agendamento_projeto(project_id: str, agendamento_id: str):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        current = _item(
            client.table("workflow_events")
            .select("*")
            .eq("id", agendamento_id)
            .eq("projeto_id", project_id)
            .eq("tipo", "whatsapp_schedule")
            .limit(1)
            .execute()
        )
        if current is None:
            raise HTTPException(status_code=404, detail="Agendamento nao encontrado")
        current_payload = current.get("payload") if isinstance(current.get("payload"), dict) else {}
        current_payload["ativo"] = False
        updated = (
            client.table("workflow_events")
            .update({"payload": current_payload, "status": "cancelado"})
            .eq("id", agendamento_id)
            .eq("projeto_id", project_id)
            .execute()
        )
        item = _item(updated)
        return {"ok": True, "item": _schedule_from_event(item or {**current, "payload": current_payload, "status": "cancelado"})}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao remover agendamento de WhatsApp: {exc}") from exc


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
        "contatos": _dedupe(contatos, "telefone_whatsapp", "nome")[:100],
        "rdos": rdos[:20],
        "tarefas": tarefas[:30],
        "restricoes": restricoes[:30],
        "status": "connected" if get_supabase() else "local",
    }


@router.get("/api/projetos/{project_id}/financeiro")
def financeiro_projeto(project_id: str):
    projeto = _project_or_404(project_id)
    lancamentos = _select("lancamentos_financeiros", project_id=project_id, limit=500)
    trechos = _select("trechos_custo", project_id=project_id, limit=500)
    despesas = [
        row for row in lancamentos
        if str(row.get("tipo", "")).strip().upper() in {"DESPESA", "CUSTO", "SAIDA"}
    ]
    receitas = [
        row for row in lancamentos
        if str(row.get("tipo", "")).strip().upper() in {"RECEITA", "ENTRADA"}
    ]
    return {
        "projeto": projeto,
        "lancamentos": lancamentos,
        "trechos": trechos,
        "resumo": {
            "receitas": _sum(receitas, "valor"),
            "despesas": _sum(despesas, "valor"),
            "trechos_total": _sum(trechos, "custo_total", "valor_total"),
        },
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
    financeiro = financeiro_projeto(project_id)
    return {
        **payload,
        "custos": {
            "diario": payload["kpis"]["custo_total_dia"],
            "rdos": len(payload["rdos"]),
            "lancamentos": len(financeiro["lancamentos"]),
            "despesas_total": financeiro["resumo"]["despesas"],
            "receitas_total": financeiro["resumo"]["receitas"],
        },
        "integracoes": {
            "rdo": "Conectado" if payload["rdos"] else "Parcial",
            "tarefas": "Conectado" if payload["tarefas"] else "Parcial",
            "lps": "Conectado" if payload["restricoes"] else "Parcial",
            "financeiro": "Conectado" if financeiro["lancamentos"] or financeiro["trechos"] else "Parcial",
        },
    }


@router.patch("/api/projetos/{project_id}/lps-restricoes/{restricao_id}")
def atualizar_lps_restricao(project_id: str, restricao_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    row = dict(payload)
    try:
        updated = (
            client.table("lps_restricoes")
            .update(row)
            .eq("id", restricao_id)
            .eq("projeto_id", project_id)
            .execute()
        )
        data = _items(updated)
        return data[0] if data else {"id": restricao_id, "projeto_id": project_id, **row}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar restricao LPS: {exc}") from exc


@router.delete("/api/projetos/{project_id}/lps-restricoes/{restricao_id}")
def remover_lps_restricao(project_id: str, restricao_id: str):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        client.table("lps_restricoes").delete().eq("id", restricao_id).eq("projeto_id", project_id).execute()
        return {"ok": True, "id": restricao_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao remover restricao LPS: {exc}") from exc
