"""
routes_agent.py — Endpoint de chat do agente ConstruData.
Multi-LLM com isolamento de domínio (RK vs Sala Técnica).
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Optional, List

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

REPO = Path(__file__).resolve().parent.parent
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

router = APIRouter(prefix="/api/agent", tags=["Agent Chat"])


# ─── System Prompts por domínio ────────────────────────────────────────────

_PROMPT_BASE = None

def _get_base_prompt():
    global _PROMPT_BASE
    if _PROMPT_BASE is None:
        from scripts.managed_agent import SYSTEM_PROMPT
        _PROMPT_BASE = SYSTEM_PROMPT
    return _PROMPT_BASE


FILTROS_DOMINIO = {
    "rk": (
        "\n\n## CONTEXTO ATIVO: RK Engenharia"
        "\nVocê está no domínio RK. Fale APENAS sobre: Osasco CLU, Pardinho SES, "
        "medições RK, máquinas, subcontratados, Renato, Luiz, Mateus, Ícaro, Alexandre, Igor."
        "\n❌ NÃO mencione dados da Sala Técnica SLNR."
    ),
    "sala": (
        "\n\n## CONTEXTO ATIVO: Sala Técnica SLNR"
        "\nVocê está no domínio Sala Técnica. Fale APENAS sobre: SABESP, NS, "
        "ligações, trechos, cadastro, Gabriel, Vinicius, Junior, Valdean, Veronica, "
        "José Márcio, Aline, Claudio, Fabrizzio."
        "\n❌ NÃO mencione dados da RK Engenharia."
    ),
    "dmae": (
        "\n\n## CONTEXTO ATIVO: DMAE 17670"
        "\nVocê está no domínio DMAE Porto Alegre. Foque em: orçamento, BDI industrial, "
        "SICRO, SINAPI, SABESP, ORSE, TCU."
    ),
    "cdm": (
        "\n\n## CONTEXTO ATIVO: ConstruDataMax"
        "\nVocê está no domínio de desenvolvimento. Foque em: React, FastAPI, n8n, "
        "Vercel, Railway, WhatsApp bot, Evolution API."
    ),
    "geral": "",
}


# ─── Request/Response Models ───────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" ou "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    dominio: str = "geral"
    historico: Optional[List[ChatMessage]] = None
    provider: Optional[str] = None

class ChatResponse(BaseModel):
    resposta: str
    provider_usado: str
    dominio: str


# ─── Endpoints ─────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
async def agent_chat(req: ChatRequest):
    """Chat com o agente ConstruData. Respeita isolamento de domínio."""
    try:
        from motor_llm import chamar, ROTEAMENTO, _get_key, CALL_MAP

        system = _get_base_prompt() + FILTROS_DOMINIO.get(req.dominio, "")

        # Monta prompt com histórico se houver
        prompt_parts = []
        if req.historico:
            for msg in req.historico[-6:]:  # últimas 6 mensagens
                prompt_parts.append(f"[{msg.role}]: {msg.content}")
        prompt_parts.append(f"[user]: {req.message}")
        prompt = "\n".join(prompt_parts)

        # Determina provider
        if req.provider and req.provider in CALL_MAP:
            providers = [req.provider]
        else:
            providers = ROTEAMENTO.get("agente", ["anthropic", "openai", "groq"])

        # Tenta cada provider com fallback
        provider_usado = "nenhum"
        resposta = ""
        for provider in providers:
            key = _get_key(provider)
            if not key:
                continue
            try:
                call_fn = CALL_MAP[provider]
                resposta = call_fn(prompt, system=system)
                provider_usado = provider
                break
            except Exception as e:
                continue

        if not resposta:
            resposta = "Nenhum provedor LLM disponível. Configure ANTHROPIC_API_KEY, OPENAI_API_KEY ou GROQ_API_KEY."

        return ChatResponse(
            resposta=resposta,
            provider_usado=provider_usado,
            dominio=req.dominio,
        )

    except Exception as e:
        return JSONResponse(
            content={"status": "error", "detail": str(e)},
            status_code=500,
        )


@router.get("/dominios")
def listar_dominios():
    """Lista domínios disponíveis."""
    return {
        "dominios": [
            {"id": "rk", "nome": "RK Engenharia", "desc": "Osasco CLU + Pardinho SES"},
            {"id": "sala", "nome": "Sala Técnica SLNR", "desc": "SABESP Santos, NS, medições"},
            {"id": "dmae", "nome": "DMAE 17670", "desc": "Orçamento Porto Alegre"},
            {"id": "cdm", "nome": "ConstruDataMax", "desc": "Desenvolvimento da plataforma"},
            {"id": "geral", "nome": "Geral", "desc": "Todos os projetos"},
        ]
    }


@router.get("/providers")
def listar_providers():
    """Lista providers LLM disponíveis e seus status."""
    try:
        from motor_llm import PROVIDERS, _get_key
        resultado = {}
        for nome, info in PROVIDERS.items():
            resultado[nome] = {
                "configurado": bool(_get_key(nome)),
                "modelos": info["modelos"],
                "capacidades": info["capacidades"],
            }
        return resultado
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
