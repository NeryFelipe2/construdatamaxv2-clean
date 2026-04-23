from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Query

from api.supabase_client import PROJECT_ID_ALIASES, get_supabase
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "whatsapp_numeros.json"

router = APIRouter(tags=["whatsapp"], prefix="/api/whatsapp")

supabase = get_supabase()


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


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits or None


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
    if not supabase or not project_id:
        return "Projeto atual"
    try:
        res = supabase.table("projetos").select("nome").eq("id", project_id).limit(1).execute()
        if res.data:
            return res.data[0].get("nome") or "Projeto atual"
    except Exception:
        pass
    return "Projeto atual"


def _count_table(table: str, project_id: str | None = None, **filters) -> int:
    if not supabase:
        return 0
    try:
        query = supabase.table(table).select("id")
        if project_id:
            query = query.in_("projeto_id", _related_project_ids(project_id))
        for key, value in filters.items():
            query = query.eq(key, value)
        res = query.limit(1000).execute()
        return len(res.data or [])
    except Exception:
        return 0


def _projects_text() -> str:
    if not supabase:
        return "🏗️ Projetos Ativos\nSupabase nao configurado no backend."
    try:
        res = supabase.table("projetos").select("id,nome,cidade,status").eq("ativo", True).limit(20).execute()
        rows = res.data or []
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
        query = supabase.table("contatos").select("nome,cargo,telefone_whatsapp,alcada,setor").eq("ativo", True)
        if project_id:
            query = query.in_("projeto_id", _related_project_ids(project_id))
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


def _send_evolution_text(telefone: str, mensagem: str) -> str:
    evo_url = (os.environ.get("EVOLUTION_URL") or os.environ.get("EVOLUTION_API_URL") or "").rstrip("/")
    evo_instance = os.environ.get("EVOLUTION_INSTANCE") or os.environ.get("EVOLUTION_DEFAULT_INSTANCE") or "construdata-felipe"
    evo_key = os.environ.get("EVOLUTION_API_KEY") or os.environ.get("AUTHENTICATION_API_KEY") or ""
    if not evo_url:
        return "not_configured"
    try:
        endpoint = f"{evo_url}/message/sendText/{evo_instance}"
        headers = {"apikey": evo_key} if evo_key else {}
        resp = httpx.post(
            endpoint,
            json={"number": _normalize_phone(telefone) or telefone, "text": mensagem},
            headers=headers,
            timeout=12.0,
        )
        return "sent" if resp.status_code < 400 else f"error_{resp.status_code}"
    except Exception as exc:
        return f"error:{exc}"


def _contact_project_for_phone(telefone: str | None) -> tuple[str | None, str | None]:
    phone = _normalize_phone(telefone)
    if not phone or not supabase:
        return None, None
    try:
        res = (
            supabase.table("contatos")
            .select("nome,projeto_id,telefone_whatsapp")
            .eq("telefone_whatsapp", phone)
            .eq("ativo", True)
            .limit(1)
            .execute()
        )
        if res.data:
            contact = res.data[0]
            return _canonical_project_id(contact.get("projeto_id")), contact.get("nome")
    except Exception:
        pass
    return None, None


def _dedupe_numeros(items: list[dict]) -> list[dict]:
    by_phone: dict[str, dict] = {}
    for item in items:
        phone = _normalize_phone(item.get("telefone"))
        if not phone or str(item.get("telefone", "")).startswith("sem-telefone"):
            continue
        item = {**item, "telefone": phone, "projeto_id": _canonical_project_id(item.get("projeto_id"))}
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


@router.get("/numeros")
def listar_numeros(ns_id: int | None = Query(default=None), project_id: str | None = Query(default=None)):
    items = _load(DATA_FILE)
    if supabase:
        try:
            query = supabase.table("contatos").select("id,nome,cargo,telefone_whatsapp,projeto_id,alcada,setor").eq("ativo", True)
            if project_id:
                query = query.in_("projeto_id", _related_project_ids(project_id))
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
    return {"items": items}


@router.post("/numeros", status_code=201)
def registrar_numero(payload: dict):
    for campo in ("ns_id", "telefone", "nome", "funcao"):
        if campo not in payload:
            raise HTTPException(status_code=400, detail=f"Campo '{campo}' obrigatorio")
    items = _load(DATA_FILE)
    novo = {
        "id": str(uuid.uuid4()),
        "ns_id": payload["ns_id"],
        "telefone": payload["telefone"],
        "nome": payload["nome"],
        "funcao": payload["funcao"],
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
def disparar_rdo(ns_id: int):
    numeros = [x for x in _load(DATA_FILE) if x.get("ns_id") == ns_id]
    if not numeros and supabase:
        try:
            res = supabase.table("contatos").select("nome,telefone_whatsapp").eq("ativo", True).execute()
            numeros = [{"telefone": c.get("telefone_whatsapp"), "nome": c.get("nome")} for c in (res.data or [])]
        except Exception:
            numeros = []
    if not numeros:
        raise HTTPException(status_code=404, detail="Nenhum numero cadastrado para este NS")
    enviados = [{"telefone": n.get("telefone"), "nome": n.get("nome"), "status": "enfileirado"} for n in numeros]
    return {"ns_id": ns_id, "enviados": enviados}


@router.get("/rdos")
def listar_rdos_whatsapp(ns_id: int | None = Query(default=None)):
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase nao configurado no Render.")
    try:
        query = supabase.table("rdos").select("*").order("created_at", desc=True)
        if ns_id:
            query = query.eq("ns_id", ns_id)
        res = query.execute()
        if res.data:
            return {"items": res.data}
    except Exception:
        pass

    query = supabase.table("rk_rdo_diario").select("*").order("data_registro", desc=True)
    if ns_id:
        query = query.eq("ns_id", ns_id)
    res = query.execute()
    return {"items": res.data or []}


@router.post("/send")
def enviar_mensagem(payload: dict):
    telefone = payload.get("telefone")
    mensagem = payload.get("mensagem")
    ns_id = payload.get("ns_id")
    if not telefone or not mensagem:
        raise HTTPException(status_code=400, detail="Campos 'telefone' e 'mensagem' obrigatorios")

    campos_rdo = parse_rdo_whatsapp(mensagem)
    _log_whatsapp("out", payload, telefone=telefone, mensagem=mensagem, projeto_id=payload.get("projeto_id"))

    if campos_rdo and supabase:
        novo_registro = {
            "telefone": telefone,
            "ns_id": ns_id,
            "texto_original": mensagem,
            "data_registro": datetime.utcnow().date().isoformat(),
        }
        novo_registro.update(campos_rdo)
        try:
            supabase.table("rk_rdo_diario").insert(novo_registro).execute()
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Erro ao salvar no Supabase: {exc}") from exc

    delivery = _send_evolution_text(telefone, mensagem)

    return {"ok": True, "telefone": telefone, "campos_rdo_inseridos": campos_rdo or None, "banco": "Supabase", "delivery": delivery}


@router.post("/webhook")
def receber_webhook(payload: dict):
    if _is_from_me(payload):
        return {"ok": True, "ignored": "from_me"}

    texto, telefone = _texto_payload(payload)
    telefone = _normalize_phone(telefone)
    contact_project_id, contact_name = _contact_project_for_phone(telefone)
    projeto_id = _canonical_project_id(payload.get("projeto_id") or contact_project_id or os.environ.get("DEFAULT_PROJECT_ID"))
    _log_whatsapp("in", payload, telefone=telefone, mensagem=texto, projeto_id=projeto_id)
    texto_normalizado = texto.lower().strip()

    if texto_normalizado in {"menu", "oi", "olá", "ola"}:
        resposta = "menu"
        mensagem = _menu_text(payload.get("nome") or contact_name)
        delivery = _send_evolution_text(telefone or "", mensagem) if telefone else "not_configured"
        _log_whatsapp("out", {"tipo": "menu", "status": delivery}, telefone=telefone, mensagem=mensagem, projeto_id=projeto_id)
        return {"ok": True, "route": resposta, "reply": mensagem, "delivery": delivery}

    option_match = re.fullmatch(r"0?([1-9]|1[0-6])", texto_normalizado)
    if option_match:
        option = option_match.group(1)
        mensagem = _command_text(option, projeto_id, payload.get("nome") or contact_name)
        delivery = _send_evolution_text(telefone or "", mensagem) if telefone else "not_configured"
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
        try:
            supabase.table("rdos").insert(row).execute()
            confirmacao = "OK, RDO recebido e registrado no ConstruData."
            delivery = _send_evolution_text(telefone or "", confirmacao) if telefone else "not_configured"
            _log_whatsapp("out", {"tipo": "confirmacao_rdo", "status": delivery}, telefone=telefone, mensagem=confirmacao, projeto_id=projeto_id)
            return {"ok": True, "route": "rdo", "reply": confirmacao, "delivery": delivery}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Erro ao gravar RDO WhatsApp: {exc}") from exc

    fallback = "Recebi sua mensagem. Digite menu para ver as opcoes ou use @rdo / @tarefa."
    delivery = _send_evolution_text(telefone or "", fallback) if telefone else "not_configured"
    _log_whatsapp("out", {"tipo": "fallback", "status": delivery}, telefone=telefone, mensagem=fallback, projeto_id=projeto_id)
    return {"ok": True, "route": resposta, "reply": fallback, "delivery": delivery}


@router.post("/workflow_dispatch")
def disparar_etapa_fluxograma(payload: dict):
    telefone = payload.get("assignee_telefone")
    task = payload.get("task")
    responsavel = payload.get("responsavel")
    if not telefone or not task:
        raise HTTPException(status_code=400, detail="assignee_telefone e task obrigatorios")

    mensagem = (
        f"*NOVA TAREFA DESIGNADA*\n\n"
        f"Ola {responsavel},\n"
        f"Voce tem uma nova tarefa pendente no Fluxograma de Gestao de Obra:\n\n"
        f"Tarefa: {task}\n"
        f"Etapa: {payload.get('step_id')}\n\n"
        f"Responda 'OK' quando concluir."
    )
    try:
        httpx.post("http://localhost:8090/api/send", json={"number": telefone, "text": mensagem}, timeout=5.0)
    except Exception:
        pass
    return {"ok": True, "disparado": True, "telefone": telefone, "preview": mensagem}
