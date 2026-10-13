from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import requests
import os
import urllib.request
import json

from api.agents_operacional import InboxPayload, processar_inbox_operacional

router = APIRouter(prefix="/api/agentes", tags=["Agentes e Orquestração"])

# ==========================================
# CONFIGURAÇÕES DE AMBIENTE
# ==========================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_KEY")
    or ""
)
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "construdata-felipe")

# Usar a porta em que a API principal do ConstruData estiver rodando para chamadas internas
BASE_API_URL = os.getenv("API_URL") or os.getenv("CONSTRUDATA_API_BASE_URL", "http://localhost:8787")
AGENT_HTTP_TIMEOUT_SECONDS = float(os.getenv("AGENT_HTTP_TIMEOUT_SECONDS", "5"))

class OrquestradorPayload(BaseModel):
    evento: str # mensagem, cobranca_manha, cobranca_meio_dia, cobranca_fim_dia, escalonamento
    origem: str # whatsapp, schedule, manual, n8n
    texto: Optional[str] = ""
    telefone: Optional[str] = ""
    projeto_id: Optional[str] = None
    responsavel: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = {}

def fetch_contatos_ativos() -> List[dict]:
    """Busca contatos na tabela Supabase 'contatos' (ou 'profiles' dependendo do schema)"""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return []
    try:
        url = f"{SUPABASE_URL}/rest/v1/contatos?select=*&ativo=eq.true"
        req = urllib.request.Request(url, headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}"
        })
        r = urllib.request.urlopen(req, timeout=AGENT_HTTP_TIMEOUT_SECONDS)
        return json.loads(r.read())
    except Exception as e:
        print(f"Erro ao buscar contatos no Supabase: {e}")
        return []

def enviar_whatsapp_interno(telefone: str, mensagem: str, projeto_id: str = None):
    """Encaminha o envio para a rota unificada do ConstruData (que lida com o Evolution)."""
    try:
        url = f"{BASE_API_URL}/api/whatsapp/send"
        payload = {
            "telefone": telefone,
            "mensagem": mensagem,
            "projeto_id": projeto_id,
        }
        resp = requests.post(url, json=payload, timeout=AGENT_HTTP_TIMEOUT_SECONDS)
        return resp.ok
    except Exception as e:
        print(f"Erro ao chamar envio de whatsapp interno: {e}")
        return False

def processar_evento_orquestrador(payload: OrquestradorPayload):
    """
    Função core do Agente Orquestrador. 
    Centraliza a lógica de cobrança e decisão PMBOK/RDO.
    """
    evento = payload.evento.lower()
    contatos = fetch_contatos_ativos()
    
    # 1. EVENTO: COBRANÇA MATINAL (Planejamento)
    if evento == "cobranca_manha":
        engenheiros = [c for c in contatos if "engenheiro" in str(c.get("cargo", "")).lower() or "campo" in str(c.get("setor", "")).lower()]
        enviados = []
        for eng in engenheiros:
            tel = eng.get("telefone_whatsapp")
            obra = eng.get("projeto_id", "sua obra")
            nome = eng.get("nome", "Engenheiro")
            msg = f"Bom dia, {nome}! Envie o *planejamento de hoje* da obra {obra}:\n- Frentes\n- Equipe\n- Meta de produção\n- Materiais\n- Restrições"
            if tel:
                enviar_whatsapp_interno(tel, msg, projeto_id=eng.get("projeto_id"))
                enviados.append(nome)
        return {"acao": "cobrar", "detalhe": "cobranca_manha executada", "destinatarios": enviados}

    # 2. EVENTO: COBRANÇA MEIO-DIA (Bloqueios)
    elif evento == "cobranca_meio_dia":
        engenheiros = [c for c in contatos if "engenheiro" in str(c.get("cargo", "")).lower()]
        enviados = []
        for eng in engenheiros:
            tel = eng.get("telefone_whatsapp")
            msg = f"Informe os bloqueios da manhã:\n- Falta material?\n- Equipe completa?\n- Chuva/Segurança?"
            if tel:
                enviar_whatsapp_interno(tel, msg, projeto_id=eng.get("projeto_id"))
                enviados.append(eng.get("nome"))
        return {"acao": "cobrar", "detalhe": "cobranca_meio_dia executada", "destinatarios": enviados}

    # 3. EVENTO: COBRANÇA FIM DO DIA (RDO)
    elif evento == "cobranca_fim_dia":
        engenheiros = [c for c in contatos if "engenheiro" in str(c.get("cargo", "")).lower()]
        enviados = []
        for eng in engenheiros:
            tel = eng.get("telefone_whatsapp")
            msg = f"Fim de expediente! Envie o *RDO do dia*:\n- Produção executada\n- Equipe/Maquinário\n- Custos/Fotos\n- Desvios PMBOK"
            if tel:
                enviar_whatsapp_interno(tel, msg, projeto_id=eng.get("projeto_id"))
                enviados.append(eng.get("nome"))
        return {"acao": "cobrar", "detalhe": "cobranca_fim_dia executada", "destinatarios": enviados}

    # 4. EVENTO: MENSAGEM RECEBIDA (Interpretação e Parsing)
    elif evento == "mensagem":
        metadata = payload.metadata or {}
        result = processar_inbox_operacional(
            InboxPayload(
                texto=payload.texto or "",
                origem=payload.origem,
                telefone=payload.telefone,
                projeto_id=payload.projeto_id,
                responsavel=payload.responsavel,
                dominio=str(metadata.get("dominio") or "geral"),
                data_ref=metadata.get("data_ref"),
                metadata=metadata,
                enviar_whatsapp=bool(metadata.get("enviar_whatsapp")),
            )
        )
        if payload.telefone and metadata.get("enviar_whatsapp"):
            ok = enviar_whatsapp_interno(payload.telefone, result["resposta_whatsapp"], payload.projeto_id)
            result["delivery"] = {"tentou": True, "ok": ok, "canal": "whatsapp"}
        return result
        # Aqui conectamos aos módulos LLM, PMBOK, XGBoost
        # Como este é o Orquestrador, ele decide o que fazer com a mensagem
        texto = payload.texto.lower()
        if not texto:
            return {"acao": "ignorar", "detalhe": "mensagem vazia"}

        # Identifica se é sobre RDO, Custos, Planejamento
        tipo_detectado = "indefinido"
        if "produção" in texto or "equipe" in texto or "rdo" in texto:
            tipo_detectado = "rdo"
        elif "custo" in texto or "gasto" in texto or "comprei" in texto or "nf" in texto:
            tipo_detectado = "custo"
        elif "bloqueio" in texto or "atraso" in texto or "falta" in texto:
            tipo_detectado = "desvio"
            
        # Resposta amigável enquanto processamos no backend
        msg_resposta = f"✅ Recebido. Classificado como: *{tipo_detectado.upper()}*. Registrando no ConstruData..."
        if payload.telefone:
            enviar_whatsapp_interno(payload.telefone, msg_resposta, payload.projeto_id)
            
        # TODO: Implementar chamada para o `llm_control_plane` aqui.
        # TODO: Implementar chamada para `motor_pmbok` e `xgboost`.
        
        return {
            "acao": "responder", 
            "tipo_detectado": tipo_detectado, 
            "registros_criados": [f"Log {tipo_detectado} gerado"]
        }

    # 5. EVENTO: ESCALONAMENTO
    elif evento == "escalonamento":
        # Verifica pendências e avisa diretores
        diretoria = [c for c in contatos if "diretor" in str(c.get("cargo", "")).lower() or "rk" in str(c.get("setor", "")).lower()]
        enviados = []
        for dir_c in diretoria:
            tel = dir_c.get("telefone_whatsapp")
            msg = f"⚠️ *Resumo de Escalonamento Diário*\nConsulte o painel para visualizar engenheiros pendentes de envio de RDO."
            if tel:
                enviar_whatsapp_interno(tel, msg, projeto_id=dir_c.get("projeto_id"))
                enviados.append(dir_c.get("nome"))
        return {"acao": "escalar", "destinatarios_diretoria": enviados}

    return {"acao": "ignorar", "detalhe": "evento desconhecido"}

@router.post("/orquestrador")
async def agente_orquestrador(payload: OrquestradorPayload, background_tasks: BackgroundTasks):
    """
    Endpoint principal para o n8n ou Webhook chamar.
    Ele delega a decisão para a função processar_evento_orquestrador em background (para não prender o n8n).
    """
    try:
        # Se você quiser rodar em background (para responder rápido ao webhook do n8n):
        # background_tasks.add_task(processar_evento_orquestrador, payload)
        
        # Para fins de retorno estruturado, podemos executar sincronamente (ou refatorar para ser assíncrono real):
        resultado = processar_evento_orquestrador(payload)
        
        return {
            "ok": True,
            "resultado": resultado,
            "delivery": {"evolution_instance": EVOLUTION_INSTANCE}
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/inbox")
async def agentes_inbox(payload: InboxPayload):
    """
    Inbox operacional unico para n8n, WhatsApp, formularios, email e uso manual.
    Classifica, extrai, aciona PMBOK quando necessario e registra log operacional.
    """
    try:
        resultado = processar_inbox_operacional(payload)
        if payload.enviar_whatsapp and payload.telefone:
            ok = enviar_whatsapp_interno(payload.telefone, resultado["resposta_whatsapp"], payload.projeto_id)
            resultado["delivery"] = {"tentou": True, "ok": ok, "canal": "whatsapp"}
        else:
            resultado["delivery"] = {"tentou": False, "canal": "whatsapp"}
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
