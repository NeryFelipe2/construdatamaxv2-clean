from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Query

from api.supabase_client import get_supabase
REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "whatsapp_numeros.json"

router = APIRouter(tags=["whatsapp"], prefix="/api/whatsapp")

supabase = get_supabase()


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


@router.get("/numeros")
def listar_numeros(ns_id: int | None = Query(default=None), project_id: str | None = Query(default=None)):
    items = _load(DATA_FILE)
    if supabase:
        try:
            query = supabase.table("contatos").select("id,nome,cargo,telefone_whatsapp,projeto_id,alcada,setor").eq("ativo", True)
            if project_id:
                query = query.eq("projeto_id", project_id)
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

    delivery = "not_configured"
    evo_url = (os.environ.get("EVOLUTION_URL") or os.environ.get("EVOLUTION_API_URL") or "").rstrip("/")
    evo_instance = os.environ.get("EVOLUTION_INSTANCE") or os.environ.get("EVOLUTION_DEFAULT_INSTANCE") or "construdata-felipe"
    evo_key = os.environ.get("EVOLUTION_API_KEY") or os.environ.get("AUTHENTICATION_API_KEY") or ""
    if evo_url:
        try:
            endpoint = f"{evo_url}/message/sendText/{evo_instance}"
            headers = {"apikey": evo_key} if evo_key else {}
            resp = httpx.post(
                endpoint,
                json={"number": telefone, "text": mensagem},
                headers=headers,
                timeout=12.0,
            )
            delivery = "sent" if resp.status_code < 400 else f"error_{resp.status_code}"
        except Exception as exc:
            delivery = f"error:{exc}"

    return {"ok": True, "telefone": telefone, "campos_rdo_inseridos": campos_rdo or None, "banco": "Supabase", "delivery": delivery}


@router.post("/webhook")
def receber_webhook(payload: dict):
    texto, telefone = _texto_payload(payload)
    projeto_id = payload.get("projeto_id") or os.environ.get("DEFAULT_PROJECT_ID")
    _log_whatsapp("in", payload, telefone=telefone, mensagem=texto, projeto_id=projeto_id)

    if texto.lower() in {"menu", "oi", "olá", "ola"}:
        resposta = "menu"
    elif "@rdo" in texto.lower() or texto.strip().startswith(("1", "7", "8")):
        resposta = "rdo"
    else:
        resposta = "registrado"

    campos_rdo = parse_rdo_whatsapp(texto)
    if supabase and (campos_rdo or "@rdo" in texto.lower()):
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
            _log_whatsapp("out", {"tipo": "confirmacao_rdo", "status": "enfileirado"}, telefone=telefone, mensagem="OK, RDO recebido e registrado no ConstruData.", projeto_id=projeto_id)
            return {"ok": True, "route": "rdo", "reply": "OK, RDO recebido e registrado no ConstruData."}
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Erro ao gravar RDO WhatsApp: {exc}") from exc

    return {"ok": True, "route": resposta}


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
