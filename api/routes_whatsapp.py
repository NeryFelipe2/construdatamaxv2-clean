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


# ---------------------------------------------------------------------------
# Parser de RDO via texto WhatsApp
# Campo format: "1:15 2:8h 3:Escavação 4:Retro 5:20tubos 6:N 7:Sol"
# 1=funcionarios 2=horas 3=servico 4=equipamento 5=material 6=ocorrencia 7=clima
# ---------------------------------------------------------------------------

_CAMPOS = {
    "1": "funcionarios",
    "2": "horas_trabalhadas",
    "3": "servico",
    "4": "equipamento",
    "5": "material",
    "6": "ocorrencia",
    "7": "clima",
}


def parse_rdo_whatsapp(texto: str) -> dict:
    resultado: dict = {}
    for m in re.finditer(r"(\d+)\s*:\s*([^\s]+)", texto):
        chave = _CAMPOS.get(m.group(1))
        if chave:
            resultado[chave] = m.group(2).strip()
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
    items = _load(RDOS_FILE)
    if ns_id is not None:
        items = [x for x in items if x.get("ns_id") == ns_id]
    return {"items": items}


@router.post("/send")
def enviar_mensagem(payload: dict):
    telefone = payload.get("telefone")
    mensagem = payload.get("mensagem")
    if not telefone or not mensagem:
        raise HTTPException(status_code=400, detail="Campos 'telefone' e 'mensagem' obrigatorios")
    # Salva RDO se o texto parecer um RDO
    campos_rdo = parse_rdo_whatsapp(mensagem)
    if campos_rdo:
        rdos = _load(RDOS_FILE)
        rdos.append({
            "id": str(uuid.uuid4()),
            "telefone": telefone,
            "ns_id": payload.get("ns_id"),
            "dados": campos_rdo,
            "texto_original": mensagem,
            "recebido_em": datetime.utcnow().isoformat(),
        })
        _save(RDOS_FILE, rdos)
    return {"ok": True, "telefone": telefone, "campos_rdo": campos_rdo or None}
