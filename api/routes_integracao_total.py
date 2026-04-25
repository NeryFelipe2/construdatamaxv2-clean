from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException

from api.operational import (
    action_for_deviation,
    log_operational_event,
    metric_severity,
    normalize_text,
    parse_date,
    safe_float,
    safe_int,
    week_bounds,
)
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


CHILD_INSERT_COLUMNS = {
    "rdo_equipes": {"rdo_id", "tipo", "lider_id", "lider_nome"},
    "rdo_atividades": {"equipe_id", "rua", "servico", "tubo", "metragem", "pecas", "casas", "observacao"},
    "rdo_materiais": {"rdo_id", "descricao", "quantidade", "unidade"},
    "rdo_equipamentos": {"rdo_id", "tipo", "quantidade"},
    "rdo_mao_obra": {"rdo_id", "cargo", "quantidade"},
    "rdo_ocorrencias": {"rdo_id", "tipo", "descricao"},
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
    allowed_columns = CHILD_INSERT_COLUMNS.get(table)
    if allowed_columns:
        rows = [{key: value for key, value in row.items() if key in allowed_columns} for row in rows]
    if table in {"rdo_equipamentos", "rdo_mao_obra"}:
        for row in rows:
            if row.get("quantidade") is not None:
                row["quantidade"] = int(float(row.get("quantidade") or 0))
    try:
        result = client.table(table).insert(rows).execute()
        items = _items(result)
        return {"ok": True, "count": len(items) if items else len(rows), "items": items}
    except Exception as exc:
        return {"ok": False, "count": 0, "items": [], "error": str(exc)}


def _select_child_rows(client: Any, table: str, rdo_id: str, equipe_ids: list[str] | None = None) -> list[dict[str, Any]]:
    try:
        return _items(client.table(table).select("*").eq("rdo_id", rdo_id).execute())
    except Exception:
        if table == "rdo_atividades" and equipe_ids:
            try:
                return _items(client.table(table).select("*").in_("equipe_id", equipe_ids).execute())
            except Exception:
                return []
        return []


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


def _safe_table_insert(client: Any, table: str, row: dict[str, Any]) -> dict[str, Any]:
    try:
        result = client.table(table).insert(row).execute()
        return {"ok": True, "item": _item(result) or row}
    except Exception as exc:
        log_operational_event(
            subsystem="supabase",
            severity="error",
            status="open",
            project_id=row.get("projeto_id"),
            error_message=f"Erro ao inserir em {table}: {exc}",
            payload={"table": table, "row": row},
        )
        return {"ok": False, "error": str(exc), "item": row}


def _safe_table_update(client: Any, table: str, row: dict[str, Any], **eq_filters: Any) -> dict[str, Any]:
    try:
        query = client.table(table).update(row)
        for key, value in eq_filters.items():
            query = query.eq(key, value)
        result = query.execute()
        return {"ok": True, "item": _item(result) or row}
    except Exception as exc:
        log_operational_event(
            subsystem="supabase",
            severity="error",
            status="open",
            project_id=row.get("projeto_id") or eq_filters.get("projeto_id"),
            error_message=f"Erro ao atualizar {table}: {exc}",
            payload={"table": table, "row": row, "filters": eq_filters},
        )
        return {"ok": False, "error": str(exc), "item": row}


def _active_week_plan(client: Any, project_id: str, data_ref: Any = None) -> dict[str, Any] | None:
    day = parse_date(data_ref)
    try:
        rows = _items(
            client.table("planejamentos_semanais")
            .select("*")
            .eq("projeto_id", project_id)
            .lte("semana_inicio", day.isoformat())
            .gte("semana_fim", day.isoformat())
            .in_("status", ["ativo", "aprovado"])
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return rows[0] if rows else None
    except Exception as exc:
        log_operational_event(
            subsystem="planejamento",
            severity="warning",
            status="open",
            project_id=project_id,
            error_message=f"Erro ao buscar planejamento ativo: {exc}",
            payload={"data": day.isoformat()},
        )
        return None


def _plan_items(client: Any, plan_id: str) -> list[dict[str, Any]]:
    try:
        return _items(
            client.table("planejamento_itens")
            .select("*")
            .eq("planejamento_id", plan_id)
            .order("created_at", desc=False)
            .execute()
        )
    except Exception:
        return []


def _rdo_realized_activities(client: Any, rdo_id: str | None, row: dict[str, Any]) -> list[dict[str, Any]]:
    atividades: list[dict[str, Any]] = []
    if rdo_id:
        try:
            atividades.extend(_items(client.table("rdo_atividades").select("*").eq("rdo_id", rdo_id).execute()))
        except Exception:
            pass
    payload = row.get("payload_original") if isinstance(row.get("payload_original"), dict) else {}
    for item in _as_list(payload.get("services")) + _as_list(payload.get("atividades")) + _as_list(row.get("atividades")):
        atividades.append(
            {
                "servico": item.get("servico") or item.get("descricao") or item.get("description") or "Atividade",
                "metragem": safe_float(item.get("metragem") or item.get("quantidade") or item.get("quantity")),
            }
        )
    if not atividades:
        atividades.append(
            {
                "servico": row.get("producao") or row.get("observacoes") or "Producao RDO",
                "metragem": safe_float(row.get("producao_m") or row.get("quantidade_realizada") or row.get("metragem")),
            }
        )
    return atividades


def _match_realized_quantity(item: dict[str, Any], atividades: list[dict[str, Any]], fallback_total: float, only_item: bool) -> float:
    if only_item:
        return fallback_total
    activity_key = normalize_text(item.get("atividade") or item.get("descricao"))
    total = 0.0
    for atividade in atividades:
        servico = normalize_text(atividade.get("servico") or atividade.get("descricao"))
        if activity_key and (activity_key in servico or servico in activity_key):
            total += safe_float(atividade.get("metragem") or atividade.get("quantidade"))
    return total


def _generate_deviations_for_rdo(client: Any, project_id: str, rdo_row: dict[str, Any], normalized_row: dict[str, Any]) -> dict[str, Any]:
    plan = _active_week_plan(client, project_id, rdo_row.get("data") or normalized_row.get("data"))
    if not plan:
        log_operational_event(
            subsystem="planejamento",
            severity="warning",
            status="open",
            project_id=project_id,
            event_id=str(rdo_row.get("id") or ""),
            error_message="RDO recebido sem planejamento semanal ativo para comparacao.",
            payload={"rdo_id": rdo_row.get("id"), "data": rdo_row.get("data") or normalized_row.get("data")},
        )
        return {"ok": False, "reason": "no_active_plan", "items": []}

    items = _plan_items(client, str(plan["id"]))
    if not items:
        return {"ok": False, "reason": "plan_without_items", "items": []}

    atividades = _rdo_realized_activities(client, str(rdo_row.get("id") or ""), normalized_row)
    total_realizado = sum(safe_float(a.get("metragem") or a.get("quantidade")) for a in atividades)
    total_custo_real = safe_float(
        rdo_row.get("custo_total_dia")
        or normalized_row.get("custo_total_dia")
        or safe_float(normalized_row.get("custo_direto")) + safe_float(normalized_row.get("custo_indireto"))
    )
    total_planejado = sum(safe_float(item.get("quantidade_planejada")) for item in items) or 1.0
    inserted: list[dict[str, Any]] = []
    only_item = len(items) == 1

    for item in items:
        planejado = safe_float(item.get("quantidade_planejada"))
        realizado = _match_realized_quantity(item, atividades, total_realizado, only_item)
        previsto = safe_float(item.get("custo_previsto"))
        custo_real = total_custo_real * (planejado / total_planejado) if total_planejado else total_custo_real
        desvio_qtd = realizado - planejado
        desvio_pct = (desvio_qtd / planejado * 100) if planejado else 0.0
        ppc = min(100.0, max(0.0, (realizado / planejado * 100) if planejado else 0.0))
        cpi = (previsto / custo_real) if custo_real > 0 else 1.0
        spi = (realizado / planejado) if planejado else 1.0
        restricoes = item.get("restricoes") if isinstance(item.get("restricoes"), list) else []
        has_blocker = bool(restricoes)
        severity = metric_severity(desvio_pct, cpi, has_blocker)
        row = {
            "projeto_id": project_id,
            "planejamento_id": plan.get("id"),
            "planejamento_item_id": item.get("id"),
            "rdo_id": rdo_row.get("id"),
            "data": str(rdo_row.get("data") or normalized_row.get("data") or date.today().isoformat())[:10],
            "atividade": item.get("atividade") or item.get("descricao") or "Atividade planejada",
            "quantidade_planejada": planejado,
            "quantidade_realizada": realizado,
            "desvio_quantidade": desvio_qtd,
            "desvio_percentual": desvio_pct,
            "custo_previsto": previsto,
            "custo_real": custo_real,
            "cpi": cpi,
            "spi": spi,
            "ppc": ppc,
            "produtividade_prevista": planejado / max(1, safe_int(item.get("equipe_planejada"), 1)),
            "produtividade_real": realizado / max(1, safe_int(normalized_row.get("equipe_number"), 1)),
            "equipe_planejada": safe_int(item.get("equipe_planejada")),
            "equipe_real": safe_int(normalized_row.get("equipe_number")),
            "severidade": severity,
            "acao_recomendada": action_for_deviation(desvio_pct, cpi, has_blocker),
            "payload": {"rdo": rdo_row, "planejamento_item": item, "atividades_realizadas": atividades},
        }
        result = _safe_table_insert(client, "desvios_planejamento", row)
        if result.get("ok"):
            inserted.append(result["item"])

    return {"ok": True, "planejamento_id": plan.get("id"), "count": len(inserted), "items": inserted}


def _deviation_features(rows: list[dict[str, Any]]) -> list[list[float]]:
    return [
        [
            safe_float(row.get("quantidade_planejada")),
            safe_float(row.get("quantidade_realizada")),
            safe_float(row.get("desvio_percentual")),
            safe_float(row.get("custo_previsto")),
            safe_float(row.get("custo_real")),
            safe_float(row.get("cpi"), 1),
            safe_float(row.get("spi"), 1),
            safe_float(row.get("ppc")),
            safe_float(row.get("equipe_planejada")),
            safe_float(row.get("equipe_real")),
        ]
        for row in rows
    ]


def _deterministic_ml(rows: list[dict[str, Any]]) -> dict[str, Any]:
    critical = [row for row in rows if str(row.get("severidade")) in {"critical", "high"}]
    avg_dev = sum(abs(safe_float(row.get("desvio_percentual"))) for row in rows) / max(1, len(rows))
    avg_cpi = sum(safe_float(row.get("cpi"), 1) for row in rows) / max(1, len(rows))
    risk_score = min(100.0, avg_dev + max(0.0, 1 - avg_cpi) * 100 + len(critical) * 5)
    return {
        "fallback_used": True,
        "score": risk_score,
        "resultado": {
            "risco": "alto" if risk_score >= 50 else "medio" if risk_score >= 25 else "baixo",
            "desvios_criticos": len(critical),
            "desvio_medio_abs": avg_dev,
            "cpi_medio": avg_cpi,
            "acoes": sorted({row.get("acao_recomendada") for row in critical if row.get("acao_recomendada")}),
        },
    }


def _run_ml_for_project(client: Any, project_id: str) -> dict[str, Any]:
    rows = _items(
        client.table("desvios_planejamento")
        .select("*")
        .eq("projeto_id", project_id)
        .order("created_at", desc=True)
        .limit(300)
        .execute()
    )
    if not rows:
        return {"ok": False, "reason": "no_deviations"}

    min_samples = safe_int(os.environ.get("ML_MIN_SAMPLES") or 20, 20)
    ml_result = _deterministic_ml(rows)
    model_name = "rules"
    status = "ok"
    error_message = None

    if len(rows) >= min_samples:
        try:
            from xgboost import XGBClassifier

            features = _deviation_features(rows)
            labels = [1 if str(row.get("severidade")) in {"critical", "high"} else 0 for row in rows]
            if len(set(labels)) >= 2:
                model = XGBClassifier(
                    n_estimators=25,
                    max_depth=3,
                    learning_rate=0.15,
                    eval_metric="logloss",
                    random_state=42,
                )
                model.fit(features, labels)
                probabilities = model.predict_proba(features)
                risk_score = float(probabilities[:, 1].mean() * 100)
                ml_result = {
                    "fallback_used": False,
                    "score": risk_score,
                    "resultado": {
                        "risco": "alto" if risk_score >= 50 else "medio" if risk_score >= 25 else "baixo",
                        "desvios_criticos": sum(labels),
                        "feature_importance": model.feature_importances_.tolist(),
                        "amostras": len(rows),
                    },
                }
                model_name = "xgboost"
        except Exception as exc:
            error_message = str(exc)
            status = "fallback"
            log_operational_event(
                subsystem="ml",
                severity="warning",
                status="open",
                project_id=project_id,
                error_message=f"XGBoost indisponivel, usando regras: {exc}",
                payload={"amostras": len(rows)},
            )

    plan_id = rows[0].get("planejamento_id")
    ml_row = {
        "projeto_id": project_id,
        "tipo": "desvio_planejamento",
        "model_name": model_name,
        "model_version": "v1",
        "fallback_used": bool(ml_result.get("fallback_used")),
        "features_count": len(rows),
        "score": safe_float(ml_result.get("score")),
        "resultado": ml_result.get("resultado") or {},
        "status": status,
        "error_message": error_message,
    }
    ml_insert = _safe_table_insert(client, "ml_execucoes", ml_row)
    replan = _create_replan_draft(client, project_id, plan_id, ml_insert.get("item"), rows, ml_result)
    return {"ok": True, "ml": ml_insert.get("item"), "replanejamento": replan, "desvios": rows[:50]}


def _create_replan_draft(
    client: Any,
    project_id: str,
    plan_id: str | None,
    ml_exec: dict[str, Any] | None,
    desvios: list[dict[str, Any]],
    ml_result: dict[str, Any],
) -> dict[str, Any]:
    critical = [row for row in desvios if str(row.get("severidade")) in {"critical", "high"}]
    sugestoes = []
    for row in critical[:20]:
        payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
        planejamento_item = payload.get("planejamento_item") if isinstance(payload.get("planejamento_item"), dict) else {}
        planejado = safe_float(row.get("quantidade_planejada"))
        realizado = safe_float(row.get("quantidade_realizada"))
        equipe_planejada = safe_int(row.get("equipe_planejada"))
        equipe_real = safe_int(row.get("equipe_real"))
        sugestoes.append(
            {
                "atividade": row.get("atividade"),
                "severidade": row.get("severidade"),
                "acao": row.get("acao_recomendada"),
                "desvio_percentual": row.get("desvio_percentual"),
                "cpi": row.get("cpi"),
                "spi": row.get("spi"),
                "unidade": planejamento_item.get("unidade") or "m",
                "quantidade_replanejada": max(0.0, planejado - realizado),
                "equipe_recomendada": max(equipe_planejada, equipe_real + 1 if realizado < planejado else equipe_real),
                "custo_revisado": max(safe_float(row.get("custo_previsto")), safe_float(row.get("custo_real"))),
            }
        )
    if not sugestoes:
        sugestoes = [{"atividade": "Plano semanal", "severidade": "low", "acao": "Manter plano e monitorar proximo RDO."}]
    row = {
        "projeto_id": project_id,
        "planejamento_origem_id": plan_id,
        "ml_execucao_id": (ml_exec or {}).get("id"),
        "status": "rascunho",
        "motivo": "Replanejamento automatico por desvio planejado x realizado.",
        "sugestoes": sugestoes,
        "metricas": ml_result.get("resultado") or {},
        "payload": {"ml": ml_exec, "desvios_analisados": len(desvios)},
    }
    return _safe_table_insert(client, "replanejamentos", row)


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


@router.post("/api/logs", status_code=201)
def criar_log_operacional(payload: dict[str, Any]):
    result = log_operational_event(
        subsystem=payload.get("subsystem") or "api",
        severity=payload.get("severity") or "info",
        status=payload.get("status") or "open",
        project_id=_canonical_project_id(payload.get("project_id") or payload.get("projeto_id")),
        telefone=payload.get("telefone"),
        request_id=payload.get("request_id"),
        event_id=payload.get("event_id"),
        error_message=payload.get("error_message") or payload.get("message"),
        payload=payload.get("payload") if isinstance(payload.get("payload"), dict) else payload,
        origem=payload.get("origem") or "api",
    )
    return result


@router.get("/api/projetos/{project_id}/logs")
def listar_logs_operacionais(project_id: str, limit: int = 100, severity: str | None = None, subsystem: str | None = None):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        query = (
            client.table("operational_logs")
            .select("*")
            .eq("projeto_id", project_id)
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 500)))
        )
        if severity:
            query = query.eq("severity", severity)
        if subsystem:
            query = query.eq("subsystem", subsystem)
        return {"items": _items(query.execute()), "status": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao listar logs operacionais: {exc}") from exc


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
        equipes = _select_child_rows(client, "rdo_equipes", rdo_id)
        equipe_ids = [str(item.get("id")) for item in equipes if item.get("id")]
        return {
            "rdo": row,
            "children": {
                "equipes": equipes,
                "atividades": _select_child_rows(client, "rdo_atividades", rdo_id, equipe_ids),
                "materiais": _select_child_rows(client, "rdo_materiais", rdo_id),
                "equipamentos": _select_child_rows(client, "rdo_equipamentos", rdo_id),
                "mao_obra": _select_child_rows(client, "rdo_mao_obra", rdo_id),
                "ocorrencias": _select_child_rows(client, "rdo_ocorrencias", rdo_id),
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
        deviation_result = {"ok": False, "reason": "not_attempted"}
        if created_row.get("id"):
            deviation_result = _generate_deviations_for_rdo(client, project_id, created_row, row)
        event = {
            "projeto_id": project_id,
            "tipo": "rdo_created",
            "payload": {
                "rdo_id": created_row.get("id"),
                "data": created_row.get("data"),
                "origem": row.get("origem"),
                "status": created_row.get("status"),
                "child_persistence": child_persistence,
                "deviation_result": deviation_result,
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
            "deviation_result": deviation_result,
        }
    except Exception as exc:
        log_operational_event(
            subsystem="rdo",
            severity="error",
            status="open",
            project_id=project_id,
            error_message=f"Erro ao gravar RDO: {exc}",
            payload={"payload": payload},
        )
        raise HTTPException(status_code=500, detail=f"Erro ao gravar RDO: {exc}") from exc


@router.get("/api/projetos/{project_id}/planejamentos-semanais")
def listar_planejamentos_semanais(project_id: str, limit: int = 100):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        plans = _items(
            client.table("planejamentos_semanais")
            .select("*")
            .eq("projeto_id", project_id)
            .order("semana_inicio", desc=True)
            .limit(max(1, min(limit, 300)))
            .execute()
        )
        plan_ids = [str(plan.get("id")) for plan in plans if plan.get("id")]
        itens: list[dict[str, Any]] = []
        if plan_ids:
            itens = _items(client.table("planejamento_itens").select("*").in_("planejamento_id", plan_ids).execute())
        items_by_plan: dict[str, list[dict[str, Any]]] = {}
        for item in itens:
            items_by_plan.setdefault(str(item.get("planejamento_id")), []).append(item)
        for plan in plans:
            plan["itens"] = items_by_plan.get(str(plan.get("id")), [])
        return {"items": plans, "status": "connected"}
    except Exception as exc:
        log_operational_event(
            subsystem="planejamento",
            severity="error",
            status="open",
            project_id=project_id,
            error_message=f"Erro ao listar planejamentos semanais: {exc}",
        )
        raise HTTPException(status_code=500, detail=f"Erro ao listar planejamentos semanais: {exc}") from exc


@router.post("/api/projetos/{project_id}/planejamentos-semanais", status_code=201)
def criar_planejamento_semanal(project_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")

    semana_inicio, semana_fim = week_bounds(payload.get("semana_inicio") or payload.get("data") or date.today().isoformat())
    plan_row = {
        "projeto_id": project_id,
        "semana_inicio": semana_inicio,
        "semana_fim": payload.get("semana_fim") or semana_fim,
        "engenheiro_nome": payload.get("engenheiro_nome") or payload.get("engenheiro") or payload.get("responsavel"),
        "engenheiro_telefone": payload.get("engenheiro_telefone") or payload.get("telefone"),
        "status": payload.get("status") or "rascunho",
        "origem": payload.get("origem") or "web",
        "versao": safe_int(payload.get("versao"), 1),
        "payload": payload,
    }
    try:
        created = client.table("planejamentos_semanais").insert(plan_row).execute()
        plan = _item(created) or plan_row
        plan_id = str(plan.get("id"))
        item_rows = []
        for item in _as_list(payload.get("itens") or payload.get("atividades")):
            item_rows.append(
                {
                    "planejamento_id": plan_id,
                    "projeto_id": project_id,
                    "frente_id": item.get("frente_id"),
                    "atividade": item.get("atividade") or item.get("titulo") or item.get("descricao") or "Atividade semanal",
                    "descricao": item.get("descricao") or item.get("observacao"),
                    "unidade": item.get("unidade") or "m",
                    "quantidade_planejada": safe_float(
                        item.get("quantidade_planejada")
                        or item.get("meta_quantidade")
                        or item.get("meta")
                        or item.get("quantidade")
                    ),
                    "equipe_planejada": safe_int(item.get("equipe_planejada") or item.get("equipe")),
                    "custo_previsto": safe_float(item.get("custo_previsto") or item.get("custo")),
                    "data_inicio": item.get("data_inicio") or semana_inicio,
                    "data_fim": item.get("data_fim") or plan_row["semana_fim"],
                    "restricoes": item.get("restricoes") if isinstance(item.get("restricoes"), list) else [],
                    "status": item.get("status") or "planejado",
                    "payload": item,
                }
            )
        persisted_items = []
        if item_rows:
            persisted_items = _items(client.table("planejamento_itens").insert(item_rows).execute())
        log_operational_event(
            subsystem="planejamento",
            severity="info",
            status="resolved",
            project_id=project_id,
            payload={"planejamento_id": plan_id, "itens": len(persisted_items)},
            origem=plan_row["origem"],
        )
        return {**plan, "itens": persisted_items}
    except Exception as exc:
        log_operational_event(
            subsystem="planejamento",
            severity="error",
            status="open",
            project_id=project_id,
            error_message=f"Erro ao criar planejamento semanal: {exc}",
            payload=payload,
        )
        raise HTTPException(status_code=500, detail=f"Erro ao criar planejamento semanal: {exc}") from exc


@router.post("/api/projetos/{project_id}/planejamentos-semanais/{plan_id}/validar")
def validar_planejamento_semanal(project_id: str, plan_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    decisao = str(payload.get("decisao") or payload.get("status") or "aprovado").lower()
    aprovado = decisao in {"aprovado", "aprovar", "ativo", "validado"}
    new_status = "ativo" if aprovado else "rejeitado"
    try:
        if aprovado:
            current = _item(client.table("planejamentos_semanais").select("*").eq("id", plan_id).eq("projeto_id", project_id).execute())
            if current:
                client.table("planejamentos_semanais").update({"status": "substituido"}).eq("projeto_id", project_id).eq("semana_inicio", current.get("semana_inicio")).eq("status", "ativo").execute()
        updated = (
            client.table("planejamentos_semanais")
            .update({"status": new_status, "updated_at": datetime.utcnow().isoformat()})
            .eq("id", plan_id)
            .eq("projeto_id", project_id)
            .execute()
        )
        validation_row = {
            "planejamento_id": plan_id,
            "projeto_id": project_id,
            "diretor_nome": payload.get("diretor_nome") or payload.get("diretor") or "Diretor",
            "diretor_telefone": payload.get("diretor_telefone") or payload.get("telefone"),
            "decisao": new_status,
            "observacao": payload.get("observacao"),
            "payload": payload,
        }
        validation = _safe_table_insert(client, "planejamento_validacoes", validation_row)
        log_operational_event(
            subsystem="planejamento",
            severity="info",
            status="resolved",
            project_id=project_id,
            payload={"planejamento_id": plan_id, "decisao": new_status},
        )
        return {"planejamento": _item(updated), "validacao": validation.get("item"), "status": new_status}
    except Exception as exc:
        log_operational_event(
            subsystem="planejamento",
            severity="error",
            status="open",
            project_id=project_id,
            error_message=f"Erro ao validar planejamento: {exc}",
            payload={"plan_id": plan_id, **payload},
        )
        raise HTTPException(status_code=500, detail=f"Erro ao validar planejamento: {exc}") from exc


@router.get("/api/projetos/{project_id}/desvios")
def listar_desvios_planejamento(project_id: str, limit: int = 200):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        rows = _items(
            client.table("desvios_planejamento")
            .select("*")
            .eq("projeto_id", project_id)
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 500)))
            .execute()
        )
        return {"items": rows, "status": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao listar desvios: {exc}") from exc


@router.post("/api/projetos/{project_id}/ml/recalcular-desvios")
def recalcular_desvios_ml(project_id: str):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        result = _run_ml_for_project(client, project_id)
        log_operational_event(
            subsystem="ml",
            severity="info" if result.get("ok") else "warning",
            status="resolved" if result.get("ok") else "open",
            project_id=project_id,
            payload=result,
        )
        return result
    except Exception as exc:
        log_operational_event(
            subsystem="ml",
            severity="error",
            status="open",
            project_id=project_id,
            error_message=f"Erro ao recalcular desvios: {exc}",
        )
        raise HTTPException(status_code=500, detail=f"Erro ao recalcular desvios: {exc}") from exc


@router.get("/api/projetos/{project_id}/replanejamentos")
def listar_replanejamentos(project_id: str, limit: int = 100):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    try:
        rows = _items(
            client.table("replanejamentos")
            .select("*")
            .eq("projeto_id", project_id)
            .order("created_at", desc=True)
            .limit(max(1, min(limit, 300)))
            .execute()
        )
        return {"items": rows, "status": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Erro ao listar replanejamentos: {exc}") from exc


@router.post("/api/projetos/{project_id}/replanejamentos/{replanejamento_id}/validar")
def validar_replanejamento(project_id: str, replanejamento_id: str, payload: dict[str, Any]):
    project_id = _canonical_project_id(project_id) or project_id
    _project_or_404(project_id)
    client = get_supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase nao configurado")
    decisao = str(payload.get("decisao") or payload.get("status") or "aprovado").lower()
    status = "aprovado" if decisao in {"aprovado", "aprovar", "validado"} else "rejeitado"
    current = _item(
        client.table("replanejamentos")
        .select("*")
        .eq("id", replanejamento_id)
        .eq("projeto_id", project_id)
        .limit(1)
        .execute()
    )
    if current is None:
        raise HTTPException(status_code=404, detail="Replanejamento nao encontrado")
    row = {
        "status": status,
        "validado_por": payload.get("diretor_nome") or payload.get("diretor") or "Diretor",
        "validado_em": datetime.utcnow().isoformat(),
        "payload": payload,
        "updated_at": datetime.utcnow().isoformat(),
    }
    result = _safe_table_update(client, "replanejamentos", row, id=replanejamento_id, projeto_id=project_id)
    applied_plan = None
    if status == "aprovado" and payload.get("aplicar"):
        semana_inicio, semana_fim = week_bounds(
            payload.get("semana_inicio") or (date.today() + timedelta(days=7)).isoformat()
        )
        client.table("planejamentos_semanais").update({"status": "substituido"}).eq("projeto_id", project_id).eq("semana_inicio", semana_inicio).eq("status", "ativo").execute()
        plan_payload = {"replanejamento_id": replanejamento_id, "fonte": "ml", "replanejamento": current}
        plan_row = {
            "projeto_id": project_id,
            "semana_inicio": semana_inicio,
            "semana_fim": payload.get("semana_fim") or semana_fim,
            "engenheiro_nome": payload.get("engenheiro_nome") or "Replanejamento ML",
            "engenheiro_telefone": payload.get("engenheiro_telefone"),
            "status": "ativo",
            "origem": "ml",
            "versao": safe_int(payload.get("versao"), 1),
            "payload": plan_payload,
        }
        plan_created = client.table("planejamentos_semanais").insert(plan_row).execute()
        applied_plan = _item(plan_created) or plan_row
        sugestoes = current.get("sugestoes") if isinstance(current.get("sugestoes"), list) else []
        item_rows = []
        for item in sugestoes:
            if not isinstance(item, dict):
                continue
            item_rows.append(
                {
                    "planejamento_id": applied_plan.get("id"),
                    "projeto_id": project_id,
                    "atividade": item.get("atividade") or "Atividade replanejada",
                    "descricao": item.get("acao"),
                    "unidade": item.get("unidade") or "m",
                    "quantidade_planejada": safe_float(item.get("quantidade_replanejada")),
                    "equipe_planejada": safe_int(item.get("equipe_recomendada")),
                    "custo_previsto": safe_float(item.get("custo_revisado")),
                    "data_inicio": semana_inicio,
                    "data_fim": plan_row["semana_fim"],
                    "restricoes": [],
                    "status": "replanejado",
                    "payload": item,
                }
            )
        if item_rows:
            applied_plan["itens"] = _items(client.table("planejamento_itens").insert(item_rows).execute())
        _safe_table_update(client, "replanejamentos", {"status": "aplicado", "updated_at": datetime.utcnow().isoformat()}, id=replanejamento_id, projeto_id=project_id)
    log_operational_event(
        subsystem="planejamento",
        severity="info",
        status="resolved",
        project_id=project_id,
        payload={"replanejamento_id": replanejamento_id, "decisao": status, "applied_plan": applied_plan},
    )
    return {"ok": bool(result.get("ok")), "item": result.get("item"), "status": "aplicado" if applied_plan else status, "applied_plan": applied_plan}


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
    planejamentos = _select("planejamentos_semanais", project_id=project_id, limit=50)
    desvios = _select("desvios_planejamento", project_id=project_id, limit=200)
    logs = _select("operational_logs", project_id=project_id, limit=100)
    replanejamentos = _select("replanejamentos", project_id=project_id, limit=50)
    active_plan = next((p for p in planejamentos if str(p.get("status")).lower() in {"ativo", "aprovado"}), None)
    critical_deviations = [d for d in desvios if str(d.get("severidade")).lower() in {"critical", "high"}]
    ppc_medio = sum(safe_float(d.get("ppc")) for d in desvios) / max(1, len(desvios))
    spi_medio = sum(safe_float(d.get("spi"), 1) for d in desvios) / max(1, len(desvios))
    cpi_medio = sum(safe_float(d.get("cpi"), 1) for d in desvios) / max(1, len(desvios))
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
            "planejamento_ativo": bool(active_plan),
            "desvios_total": len(desvios),
            "desvios_criticos": len(critical_deviations),
            "logs_abertos": len([log for log in logs if str(log.get("status", "open")).lower() == "open"]),
            "replanejamentos_rascunho": len([r for r in replanejamentos if str(r.get("status")).lower() == "rascunho"]),
            "ppc_medio": ppc_medio,
            "spi_medio": spi_medio,
            "cpi_medio": cpi_medio,
        },
        "frentes": frentes,
        "contatos": _dedupe(contatos, "telefone_whatsapp", "nome")[:100],
        "rdos": rdos[:20],
        "tarefas": tarefas[:30],
        "restricoes": restricoes[:30],
        "planejamento": active_plan,
        "desvios": desvios[:30],
        "logs": logs[:30],
        "replanejamentos": replanejamentos[:20],
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
        "logs": payload.get("logs", []),
        "desvios": payload.get("desvios", []),
        "replanejamentos": payload.get("replanejamentos", []),
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
        "planejamento_operacional": {
            "ativo": payload.get("planejamento"),
            "desvios": payload.get("desvios", []),
            "replanejamentos": payload.get("replanejamentos", []),
            "metricas": {
                "ppc_medio": payload["kpis"].get("ppc_medio", 0),
                "spi_medio": payload["kpis"].get("spi_medio", 1),
                "cpi_medio": payload["kpis"].get("cpi_medio", 1),
                "desvios_criticos": payload["kpis"].get("desvios_criticos", 0),
            },
        },
        "integracoes": {
            "rdo": "Conectado" if payload["rdos"] else "Parcial",
            "tarefas": "Conectado" if payload["tarefas"] else "Parcial",
            "lps": "Conectado" if payload["restricoes"] else "Parcial",
            "financeiro": "Conectado" if financeiro["lancamentos"] or financeiro["trechos"] else "Parcial",
            "planejamento_ml": "Conectado" if payload.get("planejamento") or payload.get("desvios") else "Parcial",
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
