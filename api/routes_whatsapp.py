"""Rotas REST para gestao de RDO via WhatsApp."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException, Query

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "data" / "whatsapp_numeros.json"
RDOS_FILE = REPO_ROOT / "data" / "whatsapp_rdos.json"

router = APIRouter(tags=["whatsapp"], prefix="/api/whatsapp")


# ---------------------------------------------------------------------------
# Helpers de persistência
# ---------------------------------------------------------------------------

def _load(path: Path) -> list:
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _save(path: Path, data: list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


import os
from supabase import create_client

# Configura o cliente do Supabase pegando das variáveis de ambiente da Vercel
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("SUPABASE_ANON_KEY", os.environ.get("SUPABASE_KEY", "")))

supabase = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# ---------------------------------------------------------------------------
# Parser de RDO via texto WhatsApp
# Exemplo de Payload do Eng: "1:150m 2:120m 3:5000 4:6000 5:1000 6:4000 7:1500 8:4500"
# ---------------------------------------------------------------------------

_CAMPOS = {
    "1": "producao_prevista",
    "2": "producao_real",
    "3": "custo_previsto",
    "4": "custo_real",
    "5": "custo_previsto_fixo",
    "6": "custo_previsto_variavel",
    "7": "custo_real_fixo",
    "8": "custo_real_variavel"
}

def parse_rdo_whatsapp(texto: str) -> dict:
    resultado: dict = {}
    for m in re.finditer(r"(\d+)\s*:\s*([^\s]+)", texto):
        chave = _CAMPOS.get(m.group(1))
        if chave:
            # Converte valores numéricos para salvar limpo no banco, senão vira string
            valor = m.group(2).strip()
            # Tenta converter para float se possivel, removendo R$ e m
            clean_valor = re.sub(r"[^\d.,-]", "", valor).replace(",", ".")
            try:
                resultado[chave] = float(clean_valor)
            except ValueError:
                resultado[chave] = valor
    return resultado

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/numeros")
def listar_numeros(ns_id: int | None = Query(default=None)):
    items = _load(DATA_FILE)
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
    if not numeros:
        raise HTTPException(status_code=404, detail="Nenhum numero cadastrado para este NS")
    enviados = []
    for n in numeros:
        enviados.append({"telefone": n["telefone"], "nome": n["nome"], "status": "enfileirado"})
    return {"ns_id": ns_id, "enviados": enviados}


@router.get("/rdos")
def listar_rdos_whatsapp(ns_id: int | None = Query(default=None)):
    # Busca rdos direto do Supabase agora
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase nao configurado. Configure a variável no ambiente.")
    
    query = supabase.table("rk_rdo_diario").select("*")
    if ns_id:
        query = query.eq("ns_id", ns_id)
        
    res = query.execute()
    return {"items": res.data}


@router.post("/send")
def enviar_mensagem(payload: dict):
    telefone = payload.get("telefone")
    mensagem = payload.get("mensagem")
    ns_id = payload.get("ns_id")
    
    if not telefone or not mensagem:
        raise HTTPException(status_code=400, detail="Campos 'telefone' e 'mensagem' obrigatorios")
        
    # Salva RDO no SUPABASE se o texto parecer um RDO
    campos_rdo = parse_rdo_whatsapp(mensagem)
    if campos_rdo and supabase:
        novo_registro = {
            "telefone": telefone,
            "ns_id": ns_id,
            "texto_original": mensagem,
            "data_registro": datetime.utcnow().date().isoformat()
        }
        novo_registro.update(campos_rdo)
        
        try:
            supabase.table("rk_rdo_diario").insert(novo_registro).execute()
        except Exception as e:
             raise HTTPException(status_code=500, detail=f"Erro ao salvar no banco Supabase: {str(e)}")

    return {"ok": True, "telefone": telefone, "campos_rdo_inseridos": campos_rdo or None, "banco": "Supabase"}
@router.post("/workflow_dispatch")
def disparar_etapa_fluxograma(payload: dict):
    # payload: {"step_id": "1.1", "task": "...", "assignee_telefone": "5511999999999", "responsavel": "Comercial"}
    telefone = payload.get("assignee_telefone")
    task = payload.get("task")
    responsavel = payload.get("responsavel")
    
    if not telefone or not task:
        raise HTTPException(status_code=400, detail="assignee_telefone e task obrigatorios")
    
    mensagem = (
        f"⚠️ *NOVA TAREFA DESIGNADA* ⚠️\n\n"
        f"Olá {responsavel},\n"
        f"Você tem uma nova tarefa pendente no Fluxograma de Gestão de Obra do ConstruDataMax:\n\n"
        f"📌 *Tarefa:* {task}\n"
        f"🆔 *Etapa:* {payload.get('step_id')}\n\n"
        f"Responda 'OK' quando concluir ou acesse a Torre de Controle."
    )
    
    # Integração direta com nosso Motor Local Node.js (whatsapp-web.js)
    try:
        httpx.post("http://localhost:8090/api/send", json={"number": telefone, "text": mensagem}, timeout=5.0)
        print(f"[{datetime.utcnow().isoformat()}] MSG WHATSAPP ENVIADA para {telefone}")
    except Exception as e:
        print(f"[{datetime.utcnow().isoformat()}] AVISO: Motor de WhatsApp offline ({e}).")
        
    return {"ok": True, "disparado": True, "telefone": telefone, "preview": mensagem}
