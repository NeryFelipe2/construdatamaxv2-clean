from __future__ import annotations

import json
import os
import re
import time
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Query

from api.operational import log_operational_event, safe_float
from api.supabase_client import (
    PROJETOS_OFICIAIS,
    canonical_project_id as _shared_canonical_project_id,
    get_supabase,
    is_rk_project,
    related_project_ids as _shared_related_project_ids,
    rk_project_ids,
)
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "whatsapp_numeros.json"

router = APIRouter(tags=["whatsapp"], prefix="/api/whatsapp")

supabase = get_supabase()


def _canonical_project_id(project_id: str | None) -> str | None:
    return _shared_canonical_project_id(project_id)


def _related_project_ids(project_id: str | None) -> list[str]:
    return _shared_related_project_ids(project_id)


def _rk_scope_project_ids(project_id: str | None = None) -> list[str]:
    if project_id:
        return _related_project_ids(project_id) if is_rk_project(project_id) else []
    return rk_project_ids(include_aliases=True)


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits or None


def _normalize_destination(value: str | None) -> str | None:
    if not value:
        return None
    raw = str(value).strip()
    if raw.endswith("@g.us") or raw.endswith("@s.whatsapp.net"):
        return raw
    return _normalize_phone(raw)


def _phone_variants(value: str | None) -> list[str]:
    digits = _normalize_phone(value)
    if not digits:
        return []

    variants = [digits]
    if digits.startswith("55"):
        national = digits[2:]
        if len(national) == 11 and national[2] == "9":
            variants.append("55" + national[:2] + national[3:])
        elif len(national) == 10:
            variants.append("55" + national[:2] + "9" + national[2:])

    seen: set[str] = set()
    return [phone for phone in variants if not (phone in seen or seen.add(phone))]


def _menu_text(nome: str | None = None) -> str:
    saudacao = f"Ola {nome}!" if nome else "Ola!"
    return (
        "🤖 ConstruDataMax Gestao 360\n"
        f"{saudacao}\n\n"
        "📊 Opcoes de Comando:\n"
        "1️⃣ Status RDO Hoje\n"
        "2️⃣ Equipe e Contatos\n"
        "3️⃣ Projetos Ativos\n"
        "4️⃣ Dashboard Consolidado\n"
        "5️⃣ Reenviar Cobranca (Alerta Geral)\n"
        "6️⃣ Falar com Inteligencia Artificial\n"
        "7️⃣ Cobrar RDO (Dispara formulario)\n"
        "8️⃣ Meu RDO Diretor (Supervisao)\n"
        "9️⃣ Lembrar Tarefas (Cobra diretores)\n"
        "🔟 Criar Tarefas (Guia de Uso)\n"
        "1️⃣1️⃣ Plano de Custos (Financeiro)\n"
        "1️⃣2️⃣ Tarefas Consorcio (Delega por setor)\n"
        "1️⃣3️⃣ Enviar Tarefa por Pessoa\n"
        "1️⃣4️⃣ Enviar Tarefa a Diretoria\n"
        "1️⃣5️⃣ Enviar Tarefa aos Engenheiros\n"
        "1️⃣6️⃣ Enviar Tarefa por Setor\n\n"
        "▶️ Digite o numero da opcao (ex: 1) ou use os @comandos diretamente.\n"
        "🔗 https://construdatamaxv2-clean.vercel.app\n"
        "Construdata Gestao 360 powered by FCN-Construcoes e Saneamento"
    )


def _project_label(project_id: str | None) -> str:
    if project_id and not is_rk_project(project_id):
        return "Projeto fora do escopo RK"
    if not supabase or not project_id:
        return "Todos os projetos"
    try:
        res = supabase.table("projetos").select("nome").eq("id", project_id).limit(1).execute()
        if res.data:
            return res.data[0].get("nome") or "Projeto atual"
    except Exception:
        pass
    return "Projeto atual"


def _active_projects() -> list[dict]:
    if not supabase:
        return [project for project in PROJETOS_OFICIAIS if is_rk_project(project.get("id"))]
    try:
        res = supabase.table("projetos").select("id,nome,cidade,status").in_("id", rk_project_ids()).limit(100).execute()
        rows = [
            row
            for row in (res.data or [])
            if str(row.get("status") or "ativo").lower() == "ativo" and is_rk_project(row.get("id"))
        ]
    except Exception:
        rows = []

    if not rows:
        rows = [project for project in PROJETOS_OFICIAIS if is_rk_project(project.get("id"))]

    order = {project_id: index for index, project_id in enumerate(rk_project_ids())}
    return sorted(rows, key=lambda row: (order.get(str(row.get("id")), 999), str(row.get("nome") or "")))


def _count_table(table: str, project_id: str | None = None, **filters) -> int:
    if not supabase:
        return 0
    try:
        query = supabase.table(table).select("id")
        if project_id:
            ids = _rk_scope_project_ids(project_id)
            if not ids:
                return 0
            query = query.in_("projeto_id", ids)
        elif table != "projetos":
            query = query.in_("projeto_id", _rk_scope_project_ids())
        for key, value in filters.items():
            query = query.eq(key, value)
        res = query.limit(1000).execute()
        return len(res.data or [])
    except Exception:
        return 0


def _projects_text() -> str:
    rows = _active_projects()
    if not supabase:
        return "🏗️ Projetos Ativos\nSupabase nao configurado no backend."
    try:
        res = supabase.table("projetos").select("id,nome,cidade,status").in_("id", rk_project_ids()).limit(20).execute()
        rows = [
            row
            for row in (res.data or [])
            if str(row.get("status") or "ativo").lower() == "ativo" and is_rk_project(row.get("id"))
        ]
    except Exception:
        rows = []
    if not rows:
        return "🏗️ Projetos Ativos\nNenhum projeto ativo encontrado."
    lines = ["🏗️ Projetos Ativos"]
    for index, row in enumerate(rows, start=1):
        cidade = f" — {row.get('cidade')}" if row.get("cidade") else ""
        lines.append(f"{index}. {row.get('nome')}{cidade}")
    return "\n".join(lines)


def _contacts_text(project_id: str | None) -> str:
    if not supabase:
        return "👥 Equipe e Contatos\nSupabase nao configurado no backend."
    try:
        query = supabase.table("contatos").select("nome,cargo,telefone_whatsapp,projeto_id,alcada,setor").eq("ativo", True)
        if project_id:
            ids = _rk_scope_project_ids(project_id)
            if not ids:
                return "Equipe e Contatos RK\nProjeto fora do escopo RK dos agentes."
            query = query.in_("projeto_id", ids)
        else:
            query = query.in_("projeto_id", _rk_scope_project_ids())
        res = query.limit(30).execute()
        rows = res.data or []
    except Exception:
        rows = []
    if not rows:
        return "👥 Equipe e Contatos\nNenhum contato ativo encontrado para este projeto."
    lines = ["👥 Equipe e Contatos"]
    for row in rows[:20]:
        cargo = row.get("cargo") or row.get("alcada") or row.get("setor") or "Responsavel"
        phone = row.get("telefone_whatsapp") or "sem telefone"
        lines.append(f"• {row.get('nome')} — {cargo} — +{phone}")
    return "\n".join(lines)


def _rdo_status_text(project_id: str | None) -> str:
    today = datetime.utcnow().date().isoformat()
    if not project_id:
        rows = _active_projects()
        lines = [
            "📋 Status RDO Hoje",
            "Projeto: Todos os projetos",
            f"Data: {today}",
            "",
        ]
        total_hoje = 0
        total_geral = 0
        for index, row in enumerate(rows, start=1):
            current_id = str(row.get("id"))
            rdos_hoje = _count_table("rdos", current_id, data=today)
            rdos_total = _count_table("rdos", current_id)
            total_hoje += rdos_hoje
            total_geral += rdos_total
            lines.append(f"{index}. {row.get('nome')}: hoje {rdos_hoje} | total {rdos_total}")
        lines.extend([
            "",
            f"Total geral hoje: {total_hoje}",
            f"Total geral no sistema: {total_geral}",
            "",
            "Para enviar RDO: use @rdo e informe producao, equipe, maquinas, custos, ocorrencias, fotos e localizacao.",
            "Web: https://construdatamaxv2-clean.vercel.app/app/rdo",
        ])
        return "\n".join(lines)

    projeto = _project_label(project_id)
    rdos_hoje = _count_table("rdos", project_id, data=today)
    rdos_total = _count_table("rdos", project_id)
    return (
        f"📋 Status RDO Hoje\n"
        f"Projeto: {projeto}\n"
        f"Data: {today}\n"
        f"RDOs hoje: {rdos_hoje}\n"
        f"Total no projeto: {rdos_total}\n\n"
        "Para enviar RDO: use @rdo e informe producao, equipe, maquinas, custos, ocorrencias, fotos e localizacao.\n"
        "Web: https://construdatamaxv2-clean.vercel.app/app/rdo"
    )


def _dashboard_text(project_id: str | None) -> str:
    if not project_id:
        today = datetime.utcnow().date().isoformat()
        projetos = len(_active_projects())
        frentes = _count_table("frentes")
        rdos_hoje = _count_table("rdos", data=today)
        rdos = _count_table("rdos")
        tarefas = _count_table("tarefas")
        restricoes = _count_table("lps_restricoes", status="aberta")
        return (
            f"📊 Dashboard Consolidado\n"
            f"Projeto: Todos os projetos\n"
            f"Projetos ativos: {projetos}\n"
            f"Frentes: {frentes}\n"
            f"RDOs hoje: {rdos_hoje}\n"
            f"RDOs total: {rdos}\n"
            f"Tarefas: {tarefas}\n"
            f"Restricoes LPS abertas: {restricoes}\n\n"
            "Painel web: https://construdatamaxv2-clean.vercel.app"
        )

    projeto = _project_label(project_id)
    frentes = _count_table("frentes", project_id)
    rdos = _count_table("rdos", project_id)
    tarefas = _count_table("tarefas", project_id)
    restricoes = _count_table("lps_restricoes", project_id, status="aberta")
    return (
        f"📊 Dashboard Consolidado\n"
        f"Projeto: {projeto}\n"
        f"Frentes: {frentes}\n"
        f"RDOs: {rdos}\n"
        f"Tarefas: {tarefas}\n"
        f"Restricoes LPS abertas: {restricoes}\n\n"
        "Painel web: https://construdatamaxv2-clean.vercel.app"
    )


def _planejamento_text(project_id: str | None) -> str:
    if project_id and not is_rk_project(project_id):
        return "Planejamento Semanal\nProjeto fora do escopo RK dos agentes."
    projeto = _project_label(project_id)
    return (
        "ðŸ“… Planejamento Semanal\n"
        f"Projeto: {projeto}\n\n"
        "Engenheiro: lance a programacao semanal por frente/atividade no ConstruData.\n"
        "Diretor: valide o plano antes dele virar oficial.\n"
        "Depois os RDOs serao comparados contra o planejado e o ML gerara desvios/replanejamento.\n\n"
        "Link: https://construdatamaxv2-clean.vercel.app/app/planejamento"
    )


def _desvios_text(project_id: str | None) -> str:
    if not supabase:
        return "ðŸ“‰ Desvios Planejado x Realizado\nSupabase nao configurado no backend."
    if project_id and not is_rk_project(project_id):
        return "Desvios Planejado x Realizado\nProjeto fora do escopo RK dos agentes."
    projeto = _project_label(project_id)
    try:
        query = supabase.table("desvios_planejamento").select("*").order("created_at", desc=True).limit(20)
        if project_id:
            query = query.in_("projeto_id", _rk_scope_project_ids(project_id))
        else:
            query = query.in_("projeto_id", _rk_scope_project_ids())
        rows = query.execute().data or []
    except Exception as exc:
        log_operational_event(
            subsystem="whatsapp",
            severity="error",
            status="open",
            project_id=project_id,
            error_message=f"Erro ao consultar desvios via WhatsApp: {exc}",
        )
        rows = []
    if not rows:
        return (
            "ðŸ“‰ Desvios Planejado x Realizado\n"
            f"Projeto: {projeto}\n"
            "Nenhum desvio registrado ainda. Lance/valide planejamento semanal e depois envie RDOs."
        )
    criticos = [r for r in rows if str(r.get("severidade")).lower() in {"critical", "high"}]
    desvio_medio = sum(abs(safe_float(r.get("desvio_percentual"))) for r in rows) / max(1, len(rows))
    lines = [
        "ðŸ“‰ Desvios Planejado x Realizado",
        f"Projeto: {projeto}",
        f"Registros recentes: {len(rows)} | Criticos/altos: {len(criticos)} | Desvio medio: {desvio_medio:.1f}%",
        "",
    ]
    for row in rows[:5]:
        lines.append(
            f"- {row.get('atividade')}: {safe_float(row.get('desvio_percentual')):.1f}% | "
            f"{row.get('severidade')} | {row.get('acao_recomendada') or 'monitorar'}"
        )
    lines.append("\nWeb: https://construdatamaxv2-clean.vercel.app")
    return "\n".join(lines)


def _log_delivery_if_needed(delivery: str, *, telefone: str | None, project_id: str | None, tipo: str, mensagem: str) -> None:
    if delivery in {"sent", "disabled", "not_configured"} or str(delivery).startswith("sent_retry"):
        return
    log_operational_event(
        subsystem="evolution",
        severity="error" if str(delivery).startswith("error") else "warning",
        status="open",
        project_id=project_id,
        telefone=telefone,
        error_message=f"Falha no envio WhatsApp: {delivery}",
        payload={"tipo": tipo, "mensagem_preview": mensagem[:500], "delivery": delivery},
    )


def _command_text(option: str, project_id: str | None, nome: str | None = None) -> str:
    commands = {
        "1": lambda: _rdo_status_text(project_id),
        "2": lambda: _contacts_text(project_id),
        "3": _projects_text,
        "4": lambda: _dashboard_text(project_id),
        "5": lambda: (
            "🚨 Reenviar Cobranca\n"
            "Use @cobrarrdo <nome> ou @lembrar <nome> para disparo individual.\n"
            "Evito envio em massa automatico pelo numero 5 para nao vazar tarefas entre projetos."
        ),
        "6": lambda: (
            "🤖 Inteligencia Artificial ConstruData\n"
            "Envie sua pergunta em texto. Para RDO, use @rdo. Para tarefas, use @tarefa."
        ),
        "7": lambda: (
            "📋 Cobrar RDO\n"
            "Engenheiro deve preencher: producao, equipe, maquinas, equipamentos, locacoes, mao de obra, materiais, "
            "custos diretos/indiretos, ocorrencias, paralisacoes, fotos e localizacao.\n"
            "Link: https://construdatamaxv2-clean.vercel.app/app/rdo"
        ),
        "8": lambda: (
            "📋 MEU RDO DIRETOR — Supervisao\n\n"
            "Responda os topicos do dia no formato:\n"
            "1: frentes visitadas | 2: decisoes tomadas | 3: riscos/alertas | 4: proximo marco | 5: observacoes"
        ),
        "9": lambda: (
            "⏰ LEMBRAR TAREFAS\n\n"
            "Use: @lembrar <nome>\n"
            "Nomes principais: renato, luiz, fabrizzio, felipe, mateus, igor, icaro, joao."
        ),
        "10": lambda: (
            "🧾 CRIAR TAREFAS\n\n"
            "Use: @tarefa <nome> <descricao>\n"
            "Ex: @tarefa mateus enviar RDO de Osasco com custos do dia"
        ),
        "11": lambda: (
            "💰 Plano de Custos\n"
            "Informe custos do dia no RDO: maquinas, mao de obra, locacoes, materiais, diretos e indiretos."
        ),
        "12": lambda: (
            "🏭 TAREFA POR SETOR (Consorcio)\n\n"
            "Use: @tarefaconsorcio <setor> <descricao>\n"
            "Setores: planejamento, producao, sala, todos.\n"
            "Fabrizzio sempre recebe copia."
        ),
        "13": lambda: "👤 Enviar Tarefa por Pessoa\nUse: @tarefa <nome> <descricao>",
        "14": lambda: "🏛️ Enviar Tarefa a Diretoria\nUse: @tarefadiretoria <descricao>",
        "15": lambda: "👷 Enviar Tarefa aos Engenheiros\nUse: @tarefaengenheiros <descricao>",
        "16": lambda: "🏗️ Enviar Tarefa por Setor\nUse: @tarefasetor <setor> <descricao>",
    }
    return commands.get(option, lambda: _menu_text(nome))()


def _send_evolution_text(destino: str, mensagem: str) -> str:
    enabled = os.environ.get("WHATSAPP_SEND_ENABLED", "false").strip().lower()
    if enabled not in {"1", "true", "yes", "on"}:
        return "disabled"

    evo_url = (
        os.environ.get("EVOLUTION_URL")
        or os.environ.get("EVOLUTION_API_URL")
        or "https://construdata-evolution.onrender.com"
    ).strip().rstrip("/")
    evo_instance = (
        os.environ.get("EVOLUTION_INSTANCE")
        or os.environ.get("EVOLUTION_DEFAULT_INSTANCE")
        or "construdata-felipe"
    ).strip() or "construdata-felipe"
    evo_key = (os.environ.get("EVOLUTION_API_KEY") or os.environ.get("AUTHENTICATION_API_KEY") or "").strip()
    if not evo_url:
        return "not_configured"

    try:
        attempts = max(1, int(os.environ.get("EVOLUTION_SEND_RETRIES") or 2))
    except ValueError:
        attempts = 2
    try:
        timeout_seconds = float(os.environ.get("EVOLUTION_SEND_TIMEOUT_SECONDS") or 30)
    except ValueError:
        timeout_seconds = 30.0
    try:
        retry_delay = max(0.0, float(os.environ.get("EVOLUTION_SEND_RETRY_DELAY_SECONDS") or 5))
    except ValueError:
        retry_delay = 5.0

    endpoint = f"{evo_url}/message/sendText/{evo_instance}"
    headers = {"apikey": evo_key} if evo_key else {}
    target = _normalize_destination(destino) or destino
    last_error = ""
    for attempt in range(1, attempts + 1):
        try:
            state_response = httpx.get(
                f"{evo_url}/instance/connectionState/{evo_instance}",
                headers=headers,
                timeout=min(timeout_seconds, 15.0),
            )
            if state_response.status_code >= 400:
                last_error = f"instance_error_{state_response.status_code}"
            else:
                state = (state_response.json().get("instance") or {}).get("state")
                if state and str(state).lower() not in {"open", "connected"}:
                    last_error = f"not_connected_{state}"
                else:
                    resp = httpx.post(
                        endpoint,
                        json={"number": target, "text": mensagem},
                        headers=headers,
                        timeout=timeout_seconds,
                    )
                    if resp.status_code < 400:
                        return "sent" if attempt == 1 else f"sent_retry_{attempt}"
                    last_error = f"error_{resp.status_code}"
        except Exception as exc:
            last_error = f"error:{exc}"

        if attempt < attempts and retry_delay:
            time.sleep(retry_delay)

    return last_error or "error:unknown"


def _contact_project_for_phone(telefone: str | None) -> tuple[str | None, str | None, str | None]:
    phones = _phone_variants(telefone)
    if not phones or not supabase:
        return None, None, None
    try:
        res = (
            supabase.table("contatos")
            .select("nome,projeto_id,telefone_whatsapp,cargo,alcada,setor")
            .in_("telefone_whatsapp", phones)
            .in_("projeto_id", _rk_scope_project_ids())
            .eq("ativo", True)
            .limit(50)
            .execute()
        )
        if res.data:
            project_ids = {
                _canonical_project_id(contact.get("projeto_id"))
                for contact in res.data
                if contact.get("projeto_id")
            }
            director_scope = any(
                re.search(
                    r"diretor|diretoria|gerente",
                    " ".join(str(contact.get(field) or "") for field in ("cargo", "alcada", "setor")),
                    flags=re.IGNORECASE,
                )
                for contact in res.data
            )
            first = res.data[0]
            registered_phone = _normalize_phone(first.get("telefone_whatsapp"))
            if len(project_ids) > 1 or director_scope:
                return None, first.get("nome"), registered_phone
            return (_canonical_project_id(first.get("projeto_id")), first.get("nome"), registered_phone)

        projects = (
            supabase.table("projetos")
            .select("id,responsavel_nome,responsavel_telefone")
            .in_("responsavel_telefone", phones)
            .eq("ativo", True)
            .limit(50)
            .execute()
        )
        if projects.data:
            project_ids = {
                _canonical_project_id(project.get("id"))
                for project in projects.data
                if project.get("id")
            }
            first = projects.data[0]
            if len(project_ids) > 1:
                return None, first.get("responsavel_nome"), _normalize_phone(first.get("responsavel_telefone"))
            return (
                _canonical_project_id(first.get("id")),
                first.get("responsavel_nome"),
                _normalize_phone(first.get("responsavel_telefone")),
            )
    except Exception:
        pass
    return None, None, None


def _dedupe_numeros(items: list[dict]) -> list[dict]:
    by_phone: dict[str, dict] = {}
    for item in items:
        phone = _normalize_phone(item.get("telefone"))
        if not phone or str(item.get("telefone", "")).startswith("sem-telefone"):
            continue
        item = {**item, "telefone": phone, "projeto_id": _canonical_project_id(item.get("projeto_id"))}
        if not is_rk_project(item.get("projeto_id")):
            continue
        existing = by_phone.get(phone)
        if not existing or len(str(item.get("funcao") or "")) > len(str(existing.get("funcao") or "")):
            by_phone[phone] = item
    return list(by_phone.values())


def _load(path: Path) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


_CAMPOS = {
    "1": "producao_prevista",
    "2": "producao_real",
    "3": "custo_previsto",
    "4": "custo_real",
    "5": "custo_previsto_fixo",
    "6": "custo_previsto_variavel",
    "7": "custo_real_fixo",
    "8": "custo_real_variavel",
}

_MISSING_COLUMN_RE = re.compile(r"Could not find the '([^']+)' column")


def parse_rdo_whatsapp(texto: str) -> dict:
    resultado: dict = {}
    for m in re.finditer(r"(\d+)\s*:\s*([^\s]+)", texto):
        chave = _CAMPOS.get(m.group(1))
        if not chave:
            continue
        valor = m.group(2).strip()
        clean_valor = re.sub(r"[^\d.,-]", "", valor).replace(",", ".")
        try:
            resultado[chave] = float(clean_valor)
        except ValueError:
            resultado[chave] = valor
    return resultado


def _insert_resilient(table: str, row: dict, required_keys: list[str] | None = None) -> dict:
    if not supabase:
        return {"ok": False, "error": "supabase_not_configured", "row": row, "removed": []}

    pending = {k: v for k, v in row.items() if v is not None}
    required = set(required_keys or [])
    removed: list[str] = []

    while pending:
        try:
            result = supabase.table(table).insert(pending).execute()
            return {"ok": True, "data": result.data or [], "row": pending, "removed": removed}
        except Exception as exc:
            message = str(exc)
            match = _MISSING_COLUMN_RE.search(message)
            if not match:
                return {"ok": False, "error": message, "row": pending, "removed": removed}

            column = match.group(1)
            if column in required or column not in pending:
                return {"ok": False, "error": message, "row": pending, "removed": removed}

            pending.pop(column, None)
            removed.append(column)

    return {"ok": False, "error": "empty_row_after_schema_filter", "row": pending, "removed": removed}


def _log_whatsapp(direction: str, payload: dict, telefone: str | None = None, mensagem: str | None = None, projeto_id: str | None = None):
    if not supabase:
        return
    try:
        supabase.table("whatsapp_logs").insert({
            "projeto_id": projeto_id,
            "telefone": telefone,
            "direction": direction,
            "tipo": payload.get("tipo") or payload.get("event") or "message",
            "mensagem": mensagem,
            "payload": payload,
            "status": payload.get("status") or "recebido",
        }).execute()
    except Exception:
        pass


def _texto_payload(payload: dict) -> tuple[str, str | None]:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    key = data.get("key") if isinstance(data.get("key"), dict) else {}
    msg = data.get("message") if isinstance(data.get("message"), dict) else {}
    text = (
        payload.get("mensagem")
        or payload.get("message")
        or msg.get("conversation")
        or (msg.get("extendedTextMessage") or {}).get("text")
        or ""
    )
    telefone = payload.get("telefone") or payload.get("from") or key.get("remoteJid")
    return str(text or "").strip(), str(telefone) if telefone else None


def _is_from_me(payload: dict) -> bool:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    key = data.get("key") if isinstance(data.get("key"), dict) else {}
    return bool(payload.get("fromMe") or data.get("fromMe") or key.get("fromMe"))


def _remote_phone(payload: dict) -> str | None:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    key = data.get("key") if isinstance(data.get("key"), dict) else {}
    return _normalize_phone(key.get("remoteJid") or payload.get("from") or payload.get("telefone"))


def _remote_jid(payload: dict) -> str | None:
    data = payload.get("data") if isinstance(payload.get("data"), dict) else {}
    key = data.get("key") if isinstance(data.get("key"), dict) else {}
    jid = key.get("remoteJid") or payload.get("from") or payload.get("telefone")
    return str(jid) if jid else None


def _is_safe_self_test_command(texto: str) -> bool:
    lowered = str(texto or "").strip().lower()
    if lowered in {"menu", "oi", "olá", "ola"}:
        return True
    if re.fullmatch(r"0?([1-9]|1[0-6])", lowered):
        return True
    if lowered.startswith("@"):
        return True
    return lowered.startswith("construdata teste")


def _extract_self_test_command(payload: dict, texto: str) -> str | None:
    if not _is_from_me(payload):
        return None

    stripped = str(texto or "").strip()
    lowered = stripped.lower()
    remote_jid = _remote_jid(payload) or ""
    if remote_jid.endswith("@g.us"):
        return None

    if lowered == "construdata teste":
        return "menu"

    if lowered.startswith("construdata teste "):
        command = stripped[len("construdata teste ") :].strip()
        return command or "menu"

    if stripped.startswith("#"):
        command = stripped[1:].strip()
        return command or None

    if _is_safe_self_test_command(stripped):
        return stripped

    return None


@router.get("/numeros")
def listar_numeros(
    ns_id: int | None = Query(default=None),
    project_id: str | None = Query(default=None),
    scope: str = Query(default="rk"),
    modo: str | None = Query(default=None),
):
    scope = scope if isinstance(scope, str) else "rk"
    modo = modo if isinstance(modo, str) else None
    effective_scope = (modo or scope or "rk").strip().lower()
    if effective_scope not in {"rk", "obras_rk", "rk_only"}:
        effective_scope = "rk"
    if project_id and not is_rk_project(project_id):
        return {"items": [], "scope": effective_scope, "blocked_project_id": _canonical_project_id(project_id)}
    items = _load(DATA_FILE)
    if supabase:
        try:
            query = supabase.table("contatos").select("id,nome,cargo,telefone_whatsapp,projeto_id,alcada,setor").eq("ativo", True)
            if project_id:
                query = query.in_("projeto_id", _rk_scope_project_ids(project_id))
            else:
                query = query.in_("projeto_id", _rk_scope_project_ids())
            res = query.execute()
            supa_items = [
                {
                    "id": c.get("id"),
                    "ns_id": 1,
                    "telefone": c.get("telefone_whatsapp"),
                    "nome": c.get("nome"),
                    "funcao": c.get("cargo") or c.get("alcada") or "responsavel",
                    "setor": c.get("setor"),
                    "projeto_id": c.get("projeto_id"),
                }
                for c in (res.data or [])
            ]
            if supa_items:
                items = supa_items
        except Exception:
            pass
    items = _dedupe_numeros(items)
    if ns_id is not None:
        items = [x for x in items if x.get("ns_id") == ns_id]
    return {"items": items, "scope": effective_scope, "project_ids": rk_project_ids()}


@router.post("/numeros", status_code=201)
def registrar_numero(payload: dict):
    for campo in ("ns_id", "telefone", "nome", "funcao", "projeto_id"):
        if campo not in payload:
            raise HTTPException(status_code=400, detail=f"Campo '{campo}' obrigatorio")
    project_id = _canonical_project_id(payload.get("projeto_id") or payload.get("project_id"))
    if not is_rk_project(project_id):
        raise HTTPException(status_code=400, detail="Projeto fora do escopo RK dos agentes")
    if supabase:
        try:
            row = {
                "projeto_id": project_id,
                "nome": payload["nome"],
                "telefone_whatsapp": _normalize_phone(payload["telefone"]),
                "cargo": payload["funcao"],
                "alcada": payload.get("alcada") or payload["funcao"],
                "setor": payload.get("setor") or "obra",
                "ativo": True,
                "recebe_cobranca": True,
                "recebe_info": True,
            }
            created = supabase.table("contatos").insert(row).execute()
            item = (created.data or [row])[0]
            return {
                "id": item.get("id"),
                "ns_id": payload["ns_id"],
                "telefone": item.get("telefone_whatsapp"),
                "nome": item.get("nome"),
                "funcao": item.get("cargo") or item.get("alcada"),
                "projeto_id": item.get("projeto_id"),
            }
        except Exception:
            pass
    items = _load(DATA_FILE)
    novo = {
        "id": str(uuid.uuid4()),
        "ns_id": payload["ns_id"],
        "telefone": payload["telefone"],
        "nome": payload["nome"],
        "funcao": payload["funcao"],
        "projeto_id": project_id,
        "criado_em": datetime.utcnow().isoformat(),
    }
    items.append(novo)
    _save(DATA_FILE, items)
    return novo


@router.delete("/numeros/{numero_id}", status_code=204)
def remover_numero(numero_id: str):
    items = _load(DATA_FILE)
    restantes = [x for x in items if x.get("id") != numero_id]
    if len(restantes) == len(items):
        raise HTTPException(status_code=404, detail="Numero nao encontrado")
    _save(DATA_FILE, restantes)


@router.post("/disparar/{ns_id}")
def disparar_rdo(
    ns_id: int,
    project_id: str | None = Query(default=None),
    dry_run: bool = Query(default=True),
):
    project_id = project_id if isinstance(project_id, str) else None
    dry_run = dry_run if isinstance(dry_run, bool) else True
    if project_id and not is_rk_project(project_id):
        raise HTTPException(status_code=404, detail="Projeto fora do escopo RK dos agentes")
    allowed_ids = set(_rk_scope_project_ids(project_id))
    numeros = [
        x
        for x in _load(DATA_FILE)
        if x.get("ns_id") == ns_id and _canonical_project_id(x.get("projeto_id")) in allowed_ids
    ]
    if not numeros and supabase:
        try:
            res = (
                supabase.table("contatos")
                .select("nome,telefone_whatsapp,projeto_id")
                .eq("ativo", True)
                .in_("projeto_id", list(allowed_ids))
                .execute()
            )
            numeros = [
                {
                    "telefone": c.get("telefone_whatsapp"),
                    "nome": c.get("nome"),
                    "projeto_id": c.get("projeto_id"),
                    "ns_id": ns_id,
                }
                for c in (res.data or [])
            ]
        except Exception:
            numeros = []
    numeros = _dedupe_numeros(numeros)
    if not numeros:
        raise HTTPException(status_code=404, detail="Nenhum numero cadastrado para este NS")
    enviados = [
        {
            "telefone": n.get("telefone"),
            "nome": n.get("nome"),
            "projeto_id": n.get("projeto_id"),
            "status": "dry_run" if dry_run else "enfileirado",
        }
        for n in numeros
    ]
    return {"ns_id": ns_id, "scope": "rk", "dry_run": dry_run, "enviados": enviados}


@router.get("/rdos")
def listar_rdos_whatsapp(ns_id: int | None = Query(default=None)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase nao configurado no Render.")
    try:
        query = supabase.table("rdos").select("*").order("created_at", desc=True)
        query = query.in_("projeto_id", _rk_scope_project_ids())
        if ns_id:
            query = query.eq("ns_id", ns_id)
        res = query.execute()
        if res.data:
            return {"items": res.data}
    except Exception:
        pass

    try:
        query = supabase.table("rk_rdo_diario").select("*").order("data_registro", desc=True)
        query = query.in_("projeto_id", _rk_scope_project_ids())
        if ns_id:
            query = query.eq("ns_id", ns_id)
        res = query.execute()
        return {"items": res.data or []}
    except Exception:
        return {"items": []}


@router.post("/send")
def enviar_mensagem(payload: dict):
    telefone = payload.get("telefone")
    mensagem = payload.get("mensagem")
    ns_id = payload.get("ns_id")
    if not telefone or not mensagem:
        raise HTTPException(status_code=400, detail="Campos 'telefone' e 'mensagem' obrigatorios")

    contact_project_id, contact_name, registered_phone = _contact_project_for_phone(telefone)
    projeto_id = _canonical_project_id(payload.get("projeto_id") or payload.get("project_id") or contact_project_id)
    payload = {**payload, "projeto_id": projeto_id, "escopo": "rk"}
    if not is_rk_project(projeto_id):
        _log_whatsapp(
            "out",
            {**payload, "status": "blocked_non_rk"},
            telefone=telefone,
            mensagem=mensagem,
            projeto_id=projeto_id,
        )
        return {
            "ok": True,
            "telefone": telefone,
            "delivery": "blocked_non_rk",
            "reason": "Projeto fora do escopo RK dos agentes",
        }
    if not supabase:
        return {
            "ok": True,
            "telefone": telefone,
            "projeto_id": projeto_id,
            "delivery": "blocked_contacts_unavailable",
            "reason": "Supabase/contatos indisponivel para validar escopo RK",
        }
    if supabase and not registered_phone:
        _log_whatsapp(
            "out",
            {**payload, "status": "blocked_unregistered_phone"},
            telefone=telefone,
            mensagem=mensagem,
            projeto_id=projeto_id,
        )
        return {
            "ok": True,
            "telefone": telefone,
            "delivery": "blocked_unregistered_phone",
            "reason": "Telefone nao esta em contatos ativos RK",
        }

    campos_rdo = parse_rdo_whatsapp(mensagem)
    _log_whatsapp("out", payload, telefone=registered_phone or telefone, mensagem=mensagem, projeto_id=projeto_id)

    if campos_rdo and supabase:
        novo_registro = {
            "projeto_id": projeto_id,
            "telefone": telefone,
            "ns_id": ns_id,
            "texto_original": mensagem,
            "data_registro": datetime.utcnow().date().isoformat(),
        }
        novo_registro.update(campos_rdo)
        insert_result = _insert_resilient("rk_rdo_diario", novo_registro)
        if not insert_result.get("ok"):
            raise HTTPException(status_code=500, detail=f"Erro ao salvar no Supabase: {insert_result.get('error')}") from None

    delivery = _send_evolution_text(registered_phone or telefone, mensagem)

    return {
        "ok": True,
        "telefone": registered_phone or telefone,
        "nome": contact_name,
        "projeto_id": projeto_id,
        "campos_rdo_inseridos": campos_rdo or None,
        "banco": "Supabase",
        "delivery": delivery,
    }


@router.post("/webhook")
def receber_webhook(payload: dict):
    texto, destino_raw = _texto_payload(payload)
    destino_resposta = _remote_jid(payload) or destino_raw
    self_test_command = _extract_self_test_command(payload, texto)
    if _is_from_me(payload) and not self_test_command:
        return {"ok": True, "ignored": "from_me"}
    is_self_test_command = bool(self_test_command)
    if self_test_command:
        texto = self_test_command
    telefone = _normalize_phone(destino_raw)
    destino_grupo = bool(destino_resposta and str(destino_resposta).endswith("@g.us"))
    if destino_grupo:
        _log_whatsapp("in", payload, telefone=telefone, mensagem=texto, projeto_id=None)
        return {"ok": True, "ignored": "group_message", "delivery": "blocked"}

    contact_project_id, contact_name, registered_phone = _contact_project_for_phone(telefone)
    projeto_id = _canonical_project_id(payload.get("projeto_id") or contact_project_id)
    _log_whatsapp("in", payload, telefone=telefone, mensagem=texto, projeto_id=projeto_id)

    if projeto_id and not is_rk_project(projeto_id):
        return {
            "ok": True,
            "ignored": "non_rk_project",
            "projeto_id": projeto_id,
            "delivery": "blocked",
        }

    if telefone and not registered_phone and not destino_grupo and not is_self_test_command:
        return {
            "ok": True,
            "ignored": "unregistered_phone",
            "telefone": telefone,
            "delivery": "blocked",
        }

    texto_normalizado = texto.lower().strip()

    if texto_normalizado in {"menu", "oi", "olá", "ola"}:
        resposta = "menu"
        mensagem = _menu_text(payload.get("nome") or contact_name)
        delivery = _send_evolution_text(destino_resposta or telefone or "", mensagem) if (destino_resposta or telefone) else "not_configured"
        _log_delivery_if_needed(delivery, telefone=telefone, project_id=projeto_id, tipo="menu", mensagem=mensagem)
        _log_whatsapp("out", {"tipo": "menu", "status": delivery}, telefone=telefone, mensagem=mensagem, projeto_id=projeto_id)
        return {"ok": True, "route": resposta, "reply": mensagem, "delivery": delivery}

    if "@planejamento" in texto_normalizado or "#planejamento" in texto_normalizado:
        mensagem = _planejamento_text(projeto_id)
        delivery = _send_evolution_text(destino_resposta or telefone or "", mensagem) if (destino_resposta or telefone) else "not_configured"
        _log_delivery_if_needed(delivery, telefone=telefone, project_id=projeto_id, tipo="planejamento", mensagem=mensagem)
        _log_whatsapp("out", {"tipo": "planejamento", "status": delivery}, telefone=telefone, mensagem=mensagem, projeto_id=projeto_id)
        return {"ok": True, "route": "planejamento", "reply": mensagem, "delivery": delivery}

    if "@desvios" in texto_normalizado or "#desvios" in texto_normalizado:
        mensagem = _desvios_text(projeto_id)
        delivery = _send_evolution_text(destino_resposta or telefone or "", mensagem) if (destino_resposta or telefone) else "not_configured"
        _log_delivery_if_needed(delivery, telefone=telefone, project_id=projeto_id, tipo="desvios", mensagem=mensagem)
        _log_whatsapp("out", {"tipo": "desvios", "status": delivery}, telefone=telefone, mensagem=mensagem, projeto_id=projeto_id)
        return {"ok": True, "route": "desvios", "reply": mensagem, "delivery": delivery}

    option_match = re.fullmatch(r"0?([1-9]|1[0-6])", texto_normalizado)
    if option_match:
        option = option_match.group(1)
        mensagem = _command_text(option, projeto_id, payload.get("nome") or contact_name)
        delivery = _send_evolution_text(destino_resposta or telefone or "", mensagem) if (destino_resposta or telefone) else "not_configured"
        _log_delivery_if_needed(delivery, telefone=telefone, project_id=projeto_id, tipo=f"menu_option_{option}", mensagem=mensagem)
        _log_whatsapp("out", {"tipo": f"menu_option_{option}", "status": delivery}, telefone=telefone, mensagem=mensagem, projeto_id=projeto_id)
        return {"ok": True, "route": f"menu_option_{option}", "reply": mensagem, "delivery": delivery}

    if "@rdo" in texto_normalizado:
        resposta = "rdo"
    else:
        resposta = "registrado"

    campos_rdo = parse_rdo_whatsapp(texto)
    if supabase and (campos_rdo or "@rdo" in texto_normalizado):
        row = {
            "projeto_id": projeto_id,
            "data": datetime.utcnow().date().isoformat(),
            "apontador": payload.get("nome") or telefone,
            "observacoes": texto,
            "origem": "whatsapp",
            "status": "recebido",
            "payload_original": payload,
        }
        row.update(campos_rdo)
        rdos_insert = _insert_resilient("rdos", row, required_keys=["projeto_id", "data", "status"])
        rk_insert = {"ok": False, "error": "not_attempted", "removed": []}
        if campos_rdo:
            rk_row = {
                "projeto_id": projeto_id,
                "telefone": telefone,
                "texto_original": texto,
                "data_registro": datetime.utcnow().date().isoformat(),
            }
            rk_row.update(campos_rdo)
            rk_insert = _insert_resilient("rk_rdo_diario", rk_row)

        if not rdos_insert.get("ok") and not rk_insert.get("ok"):
            detail = rdos_insert.get("error") or rk_insert.get("error") or "erro_desconhecido"
            log_operational_event(
                subsystem="rdo",
                severity="error",
                status="open",
                project_id=projeto_id,
                telefone=telefone,
                error_message=f"Erro ao gravar RDO WhatsApp: {detail}",
                payload={"rdos": rdos_insert, "rk_rdo_diario": rk_insert, "texto": texto},
            )
            raise HTTPException(status_code=500, detail=f"Erro ao gravar RDO WhatsApp: {detail}")

        deviation_result = {"ok": False, "reason": "not_attempted"}
        if rdos_insert.get("ok") and rdos_insert.get("data") and projeto_id:
            try:
                from api.routes_integracao_total import _generate_deviations_for_rdo

                deviation_result = _generate_deviations_for_rdo(supabase, projeto_id, rdos_insert["data"][0], row)
            except Exception as exc:
                deviation_result = {"ok": False, "error": str(exc)}
                log_operational_event(
                    subsystem="planejamento",
                    severity="warning",
                    status="open",
                    project_id=projeto_id,
                    telefone=telefone,
                    error_message=f"Erro ao gerar desvios do RDO WhatsApp: {exc}",
                    payload={"rdo": rdos_insert.get("data"), "texto": texto},
                )

        confirmacao = "OK, RDO recebido e registrado no ConstruData."
        delivery = _send_evolution_text(destino_resposta or telefone or "", confirmacao) if (destino_resposta or telefone) else "not_configured"
        _log_delivery_if_needed(delivery, telefone=telefone, project_id=projeto_id, tipo="confirmacao_rdo", mensagem=confirmacao)
        _log_whatsapp("out", {"tipo": "confirmacao_rdo", "status": delivery}, telefone=telefone, mensagem=confirmacao, projeto_id=projeto_id)
        return {
            "ok": True,
            "route": "rdo",
            "reply": confirmacao,
            "delivery": delivery,
            "persisted": {
                "rdos": bool(rdos_insert.get("ok")),
                "rk_rdo_diario": bool(rk_insert.get("ok")),
                "removed_columns": {
                    "rdos": rdos_insert.get("removed", []),
                    "rk_rdo_diario": rk_insert.get("removed", []),
                },
                "deviation_result": deviation_result,
            },
        }

    return {
        "ok": True,
        "route": "ignored_not_command",
        "reply": None,
        "delivery": "blocked",
    }


@router.post("/workflow_dispatch")
def disparar_etapa_fluxograma(payload: dict):
    telefone = payload.get("assignee_telefone")
    task = payload.get("task")
    responsavel = payload.get("responsavel")
    if not telefone or not task:
        raise HTTPException(status_code=400, detail="assignee_telefone e task obrigatorios")
    contact_project_id, _, registered_phone = _contact_project_for_phone(telefone)
    projeto_id = _canonical_project_id(payload.get("projeto_id") or payload.get("project_id") or contact_project_id)
    if not is_rk_project(projeto_id):
        return {"ok": True, "disparado": False, "delivery": "blocked_non_rk", "projeto_id": projeto_id}
    if not supabase:
        return {"ok": True, "disparado": False, "delivery": "blocked_contacts_unavailable", "projeto_id": projeto_id}
    if supabase and not registered_phone:
        return {"ok": True, "disparado": False, "delivery": "blocked_unregistered_phone", "projeto_id": projeto_id}

    mensagem = (
        f"*NOVA TAREFA DESIGNADA*\n\n"
        f"Ola {responsavel},\n"
        f"Voce tem uma nova tarefa pendente no Fluxograma de Gestao de Obra:\n\n"
        f"Tarefa: {task}\n"
        f"Etapa: {payload.get('step_id')}\n\n"
        f"Responda 'OK' quando concluir."
    )
    delivery = _send_evolution_text(registered_phone or telefone, mensagem)
    _log_delivery_if_needed(delivery, telefone=registered_phone or telefone, project_id=projeto_id, tipo="workflow_dispatch", mensagem=mensagem)
    _log_whatsapp(
        "out",
        {**payload, "tipo": "workflow_dispatch", "status": delivery, "escopo": "rk"},
        telefone=registered_phone or telefone,
        mensagem=mensagem,
        projeto_id=projeto_id,
    )
    return {"ok": True, "disparado": delivery == "sent", "telefone": registered_phone or telefone, "projeto_id": projeto_id, "delivery": delivery, "preview": mensagem}
