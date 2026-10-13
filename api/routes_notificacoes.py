"""
Rotas de notificacao automatica e proxy LLM.
- /api/notificacoes/pendencias — verifica punch list e envia WhatsApp
- /api/llm/query — proxy para chamadas LLM (Gemini/Groq/Mistral/Cohere)
"""
from __future__ import annotations

import os
import asyncio
import httpx
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from api.supabase_client import filter_rk_rows, rk_project_ids

router = APIRouter(tags=["notificacoes"])

# ─── Supabase config ────────────────────────────────────────────────────────

SUPABASE_URL = os.environ.get("SUPABASE_URL", os.environ.get("VITE_SUPABASE_URL", ""))
SUPABASE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    os.environ.get("SUPABASE_SERVICE_KEY", os.environ.get("VITE_SUPABASE_ANON_KEY", "")),
)

def _supabase_headers():
    return {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Content-Type": "application/json"}


def _rk_in_filter() -> str:
    return ",".join(rk_project_ids(include_aliases=True))

# ─── Notificacao de pendencias ──────────────────────────────────────────────

@router.get("/api/notificacoes/pendencias")
async def check_pendencias():
    """Verifica itens pendentes no punch_list e retorna quem precisa ser notificado."""
    if not SUPABASE_URL:
        return {"status": "skip", "reason": "Supabase nao configurado"}

    async with httpx.AsyncClient() as client:
        rk_ids = _rk_in_filter()
        # Buscar itens pendentes
        r = await client.get(
            f"{SUPABASE_URL}/rest/v1/punch_list_items?status=eq.aberto&projeto_id=in.({rk_ids})&select=*",
            headers=_supabase_headers()
        )
        items = filter_rk_rows(r.json() if r.status_code == 200 else [])

        # Buscar contatos
        r2 = await client.get(
            f"{SUPABASE_URL}/rest/v1/contatos?ativo=eq.true&projeto_id=in.({rk_ids})&select=*",
            headers=_supabase_headers()
        )
        contatos = filter_rk_rows(r2.json() if r2.status_code == 200 else [])

    # Mapear responsaveis para telefones
    contato_map = {
        (c.get("nome"), c.get("projeto_id")): c.get("telefone_whatsapp")
        for c in contatos
        if isinstance(c, dict) and c.get("nome") and c.get("telefone_whatsapp")
    }

    notificacoes = []
    for item in items:
        if not isinstance(item, dict):
            continue
        resp = item.get("responsavel", "")
        projeto_id = item.get("projeto_id")
        tel = contato_map.get((resp, projeto_id))
        if tel:
            notificacoes.append({
                "responsavel": resp,
                "telefone": tel,
                "projeto_id": projeto_id,
                "item": item.get("descricao", ""),
                "prazo": item.get("prazo", ""),
                "localizacao": item.get("localizacao", ""),
            })

    return {
        "status": "ok",
        "pendentes": len(items),
        "notificacoes": notificacoes,
        "timestamp": datetime.now().isoformat(),
    }


@router.post("/api/notificacoes/disparar")
async def disparar_notificacoes():
    """Dispara WhatsApp para todos os responsaveis com pendencias."""
    data = await check_pendencias()
    enviados = 0

    for n in data.get("notificacoes", []):
        msg = f"⚠️ PENDENCIA: {n['item']}\n📍 {n['localizacao']}\n📅 Prazo: {n['prazo']}\nResolva o mais rapido possivel."
        try:
            from api.routes_whatsapp import enviar_mensagem

            result = await asyncio.to_thread(
                enviar_mensagem,
                {"telefone": n["telefone"], "mensagem": msg, "projeto_id": n.get("projeto_id")},
            )
            if result.get("delivery") not in {"blocked_non_rk", "blocked_unregistered_phone"}:
                enviados += 1
        except Exception:
            pass

    return {"status": "ok", "enviados": enviados, "total": len(data.get("notificacoes", []))}


# ─── LLM Proxy ──────────────────────────────────────────────────────────────

class LlmQuery(BaseModel):
    provider: str
    api_key: str
    prompt: str
    module: Optional[str] = "chat"

@router.post("/api/llm/query")
async def llm_query(q: LlmQuery):
    """Proxy LLM — recebe key do frontend e chama o provider."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            if q.provider == "groq":
                r = await client.post("https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {q.api_key}", "Content-Type": "application/json"},
                    json={"model": "llama-3.3-70b-versatile", "messages": [{"role": "user", "content": q.prompt}], "temperature": 0.2})
                d = r.json()
                return {"response": d.get("choices", [{}])[0].get("message", {}).get("content", "Sem resposta")}

            elif q.provider == "mistral":
                r = await client.post("https://api.mistral.ai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {q.api_key}", "Content-Type": "application/json"},
                    json={"model": "mistral-large-latest", "messages": [{"role": "user", "content": q.prompt}], "temperature": 0.2})
                d = r.json()
                return {"response": d.get("choices", [{}])[0].get("message", {}).get("content", "Sem resposta")}

            elif q.provider == "gemini":
                r = await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={q.api_key}",
                    headers={"Content-Type": "application/json"},
                    json={"contents": [{"parts": [{"text": q.prompt}]}]})
                d = r.json()
                return {"response": d.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "Sem resposta")}

            elif q.provider == "cohere":
                r = await client.post("https://api.cohere.ai/v1/chat",
                    headers={"Authorization": f"Bearer {q.api_key}", "Content-Type": "application/json"},
                    json={"message": q.prompt, "model": "command-r-08-2024"})
                d = r.json()
                return {"response": d.get("text", "Sem resposta")}

            else:
                raise HTTPException(400, f"Provider {q.provider} nao suportado")

    except httpx.HTTPError as e:
        raise HTTPException(502, f"Erro ao chamar {q.provider}: {str(e)}")
