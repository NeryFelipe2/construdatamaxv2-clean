# whatsapp_receiver.py
"""
WhatsApp Receiver — ConstruData Campo (v10)
FastAPI webhook que recebe mensagens do apontador via WhatsApp
e atualiza STATUS_NS.json automaticamente.

Uso:
  uvicorn whatsapp_receiver:app --port 8765 --reload

Variáveis de ambiente necessárias:
  WA_TOKEN          — Meta Cloud API access token (obrigatório)
  WA_PHONE_ID       — Phone Number ID (Meta Dashboard)
  WA_VERIFY_TOKEN   — Token de verificação do webhook (padrão: construdata_campo)
  NUCLEO_DEFAULT    — Núcleo padrão (ex: TETEU22)
  STATUS_NS_PATH    — Caminho absoluto do STATUS_NS.json
  OUT_BASE          — Diretório base de saída (alternativa ao STATUS_NS_PATH)
  FOTOS_DIR         — Pasta para salvar fotos recebidas (padrão: GESTAO/FOTOS_CAMPO)

Testar localmente (sem WhatsApp real):
  curl -X POST http://localhost:8765/webhook/simular \
       -H "Content-Type: application/json" \
       -d '{"from": "5513999999999", "text": "NS003 executada"}'
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path

# FastAPI + httpx — instalados via: pip install fastapi uvicorn[standard] httpx
try:
    from fastapi import FastAPI, Request
    from fastapi.responses import PlainTextResponse, JSONResponse
    import httpx
    _FASTAPI_OK = True
except ImportError:
    _FASTAPI_OK = False
    # Stub mínimo para não quebrar import na GUI
    class FastAPI:  # type: ignore
        def get(self, *a, **k):
            return lambda f: f
        def post(self, *a, **k):
            return lambda f: f
    class Request: ...  # type: ignore
    class PlainTextResponse: ...  # type: ignore
    class JSONResponse: ...  # type: ignore

from motor_status_ns import (
    carregar, salvar, transitar, atualizar_campo_real,
    atualizar_whatsapp, resumo, _normalizar_ns_id,
)

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

WA_TOKEN        = os.environ.get("WA_TOKEN", "")
WA_PHONE_ID     = os.environ.get("WA_PHONE_ID", "")
WA_VERIFY_TOKEN = os.environ.get("WA_VERIFY_TOKEN", "construdata_campo")
NUCLEO_DEFAULT  = os.environ.get("NUCLEO_DEFAULT", "REDE")
OUT_BASE        = os.environ.get("OUT_BASE", str(Path.cwd() / "SAIDA"))
STATUS_NS_PATH  = os.environ.get("STATUS_NS_PATH", "")
FOTOS_DIR       = os.environ.get("FOTOS_DIR", str(Path.cwd() / "GESTAO" / "FOTOS_CAMPO"))

META_API_BASE   = "https://graph.facebook.com/v19.0"

# ---------------------------------------------------------------------------
# Estado de sessão por número (memória volátil — reinicia com o servidor)
# ---------------------------------------------------------------------------
# { "5513999999999": {"etapa": "aguardando_ns", "acao": "executada"} }
_sessoes: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="ConstruData Campo Webhook", version="1.0")


@app.get("/webhook", response_class=PlainTextResponse)
async def verify_webhook(request: Request):
    """Verificação do webhook pelo Meta."""
    params   = dict(request.query_params)
    mode     = params.get("hub.mode", "")
    token    = params.get("hub.verify_token", "")
    challenge = params.get("hub.challenge", "")

    if mode == "subscribe" and token == WA_VERIFY_TOKEN:
        return challenge
    return PlainTextResponse("Forbidden", status_code=403)


@app.post("/webhook")
async def receive_webhook(request: Request):
    """Recebe e processa mensagens do WhatsApp (Meta Cloud API)."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"status": "error", "msg": "invalid JSON"}, status_code=400)

    # Navegar pela estrutura do payload Meta
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            for msg in value.get("messages", []):
                sender = msg.get("from", "")
                await _processar_mensagem(sender, msg)

    return JSONResponse({"status": "ok"})


@app.post("/webhook/simular")
async def simular(request: Request):
    """
    Endpoint de teste local — simula recebimento de mensagem sem WhatsApp real.
    Body: {"from": "5513999999999", "text": "NS003 executada"}
    """
    data = await request.json()
    sender = data.get("from", "teste")
    text   = data.get("text", "")
    msg_simulada = {"type": "text", "text": {"body": text}, "id": "sim_001"}
    resultado = await _processar_mensagem(sender, msg_simulada)
    return JSONResponse({"status": "ok", "resposta": resultado})


@app.get("/status")
async def status_geral():
    """Retorna resumo atual do STATUS_NS.json."""
    status = _carregar_status()
    if not status:
        return JSONResponse({"erro": "STATUS_NS.json não encontrado"}, status_code=404)
    return JSONResponse(resumo(status))


# ---------------------------------------------------------------------------
# Lógica de processamento
# ---------------------------------------------------------------------------

async def _processar_mensagem(sender: str, msg: dict) -> str:
    """Roteador principal. Retorna texto da resposta enviada ao apontador."""
    tipo  = msg.get("type", "")
    texto = ""
    foto_path = ""

    if tipo == "text":
        texto = msg.get("text", {}).get("body", "").strip()
    elif tipo == "image":
        media_id = msg.get("image", {}).get("id", "")
        caption  = msg.get("image", {}).get("caption", "")
        foto_path = await _baixar_midia(media_id, sender)
        texto = caption

    sessao = _sessoes.get(sender, {})
    etapa  = sessao.get("etapa", "menu")

    # ---------- Fluxo por etapa ----------
    if etapa == "menu" or texto.lower() in ("oi", "olá", "ola", "menu", "inicio", "início"):
        resposta = await _etapa_menu(sender, texto, foto_path)

    elif etapa == "aguardando_ns":
        resposta = await _etapa_aguardando_ns(sender, texto, foto_path)

    elif etapa == "aguardando_dados_campo":
        resposta = await _etapa_dados_campo(sender, texto, foto_path)

    elif etapa == "aguardando_problema":
        resposta = await _etapa_problema(sender, texto, foto_path)

    else:
        # Tenta interpretar diretamente
        ns_id = _parse_ns_id(texto)
        if ns_id:
            resposta = _registrar_executada(ns_id, sender, obs=texto)
            _sessoes.pop(sender, None)
        else:
            resposta = _msg_menu()
            _sessoes[sender] = {"etapa": "menu"}

    # Foto avulsa durante execução
    if foto_path and etapa not in ("aguardando_ns", "aguardando_dados_campo"):
        ns_id_ativo = sessao.get("ns_id")
        if ns_id_ativo:
            status = _carregar_status()
            if status and ns_id_ativo in status.get("notas", {}):
                atualizar_campo_real(status, ns_id_ativo, foto_path=foto_path)
                _salvar_status(status)
                resposta += f"\n📸 Foto salva para {ns_id_ativo}."

    _send_whatsapp(sender, resposta)
    return resposta


# --- Etapas ---

async def _etapa_menu(sender: str, texto: str, foto_path: str) -> str:
    opcao = texto.strip()

    if opcao == "1":
        _sessoes[sender] = {"etapa": "aguardando_ns", "acao": "executada"}
        return "Qual é o número da NS?\n(ex: NS003 ou apenas 3)"

    elif opcao == "2":
        _sessoes[sender] = {"etapa": "aguardando_problema"}
        return "Qual é o número da NS e descreva o problema:\n(ex: NS005 - Interferência de raiz)"

    elif opcao == "3":
        _sessoes[sender] = {"etapa": "aguardando_ns", "acao": "dados_campo"}
        return (
            "Qual NS e os dados de campo?\n"
            "Formato: NS003 CT=27.45 CF=25.45\n"
            "ou: NS003 CT_ini=27.45 CF_ini=25.45 CT_fim=27.63 CF_fim=25.63"
        )

    elif opcao == "4":
        _sessoes[sender] = {"etapa": "aguardando_ns", "acao": "foto"}
        return "Envie a foto e informe a NS na legenda (caption). Ex: NS003"

    elif opcao == "5":
        return _status_resumo_texto()

    else:
        return _msg_menu()


async def _etapa_aguardando_ns(sender: str, texto: str, foto_path: str) -> str:
    acao  = _sessoes.get(sender, {}).get("acao", "executada")
    ns_id = _parse_ns_id(texto)

    if not ns_id:
        return "NS não reconhecida. Informe o número da NS (ex: NS003 ou apenas 3)."

    if acao == "executada":
        resp = _registrar_executada(ns_id, sender, obs="via WhatsApp")
        if foto_path:
            status = _carregar_status()
            if status:
                atualizar_campo_real(status, ns_id, foto_path=foto_path)
                _salvar_status(status)
                resp += " Foto salva."
        _sessoes.pop(sender, None)
        return resp

    elif acao == "dados_campo":
        # Texto pode conter os dados diretamente
        dados = _parse_dados_campo(texto)
        if dados:
            return _registrar_dados_campo(ns_id, sender, dados)
        else:
            _sessoes[sender] = {"etapa": "aguardando_dados_campo", "ns_id": ns_id}
            return (
                f"NS {ns_id} selecionada.\n"
                "Informe CT e CF:\n"
                "CT=27.45 CF=25.45\n"
                "ou CT_ini=27.45 CF_ini=25.45 CT_fim=27.63 CF_fim=25.63"
            )

    elif acao == "foto":
        if foto_path:
            status = _carregar_status()
            if status:
                atualizar_campo_real(status, ns_id, foto_path=foto_path)
                atualizar_whatsapp(status, ns_id, mensagem="foto campo", foto_path=foto_path)
                _salvar_status(status)
            _sessoes.pop(sender, None)
            return f"📸 Foto registrada para {ns_id}."
        else:
            _sessoes[sender] = {"etapa": "aguardando_ns", "acao": "foto", "ns_id": ns_id}
            return f"{ns_id} selecionada. Envie a foto agora."

    _sessoes.pop(sender, None)
    return _msg_menu()


async def _etapa_dados_campo(sender: str, texto: str, foto_path: str) -> str:
    ns_id = _sessoes.get(sender, {}).get("ns_id")
    if not ns_id:
        _sessoes.pop(sender, None)
        return _msg_menu()

    dados = _parse_dados_campo(texto)
    if not dados:
        return "Formato não reconhecido. Tente:\nCT=27.45 CF=25.45"

    return _registrar_dados_campo(ns_id, sender, dados)


async def _etapa_problema(sender: str, texto: str, foto_path: str) -> str:
    ns_id = _parse_ns_id(texto)
    obs   = texto

    status = _carregar_status()
    if status and ns_id:
        try:
            transitar(status, ns_id, "BLOQUEADO", responsavel=sender, obs=obs)
            atualizar_whatsapp(status, ns_id, mensagem=obs, foto_path=foto_path)
            if foto_path:
                atualizar_campo_real(status, ns_id, foto_path=foto_path)
            _salvar_status(status)
            resposta = f"⚠️ {ns_id} marcada como BLOQUEADA. Equipe notificada."
        except Exception as e:
            resposta = f"Problema registrado (aviso: {e})."
    else:
        resposta = "Problema registrado. NS não identificada — verifique com o encarregado."

    _sessoes.pop(sender, None)
    return resposta


# ---------------------------------------------------------------------------
# Ações de negócio
# ---------------------------------------------------------------------------

def _registrar_executada(ns_id: str, sender: str, obs: str = "") -> str:
    status = _carregar_status()
    if not status:
        return "STATUS_NS.json não encontrado. Contate o escritório."

    ns_key = _normalizar_ns_id(ns_id)
    nota = status.get("notas", {}).get(ns_key)
    if nota is None:
        return f"{ns_key} não encontrada. Verifique o número."

    estado_atual = nota.get("status", "PLANEJADO")
    if estado_atual == "EXECUTADO":
        return f"ℹ️ {ns_key} já estava marcada como EXECUTADA."

    try:
        transitar(status, ns_key, "EXECUTADO", responsavel=sender, obs=obs)
        atualizar_whatsapp(status, ns_key, mensagem=obs or "executada via WhatsApp")
        _salvar_status(status)
        ext = nota.get("ext_m", 0)
        rua = nota.get("rua", "")
        return (
            f"✅ {ns_key} registrada como EXECUTADA.\n"
            f"Trecho: {nota['pv_ini']}→{nota['pv_fim']} ({ext}m)\n"
            f"{rua}"
        ).strip()
    except Exception as e:
        return f"Erro ao registrar: {e}"


def _registrar_dados_campo(ns_id: str, sender: str, dados: dict) -> str:
    status = _carregar_status()
    if not status:
        return "STATUS_NS.json não encontrado."

    ns_key = _normalizar_ns_id(ns_id)
    if ns_key not in status.get("notas", {}):
        return f"{ns_key} não encontrada."

    atualizar_campo_real(
        status, ns_key,
        ct_ini=dados.get("ct_ini") or dados.get("ct"),
        cf_ini=dados.get("cf_ini") or dados.get("cf"),
        ct_fim=dados.get("ct_fim"),
        cf_fim=dados.get("cf_fim"),
    )
    atualizar_whatsapp(status, ns_key, mensagem=f"dados campo: {dados}")
    _salvar_status(status)

    cr = status["notas"][ns_key]["campo_real"]
    return (
        f"📐 Dados de campo salvos para {ns_key}:\n"
        f"CT ini={cr.get('ct_ini_real')} / CF ini={cr.get('cf_ini_real')} "
        f"(prof {cr.get('prof_ini_real')}m)\n"
        f"CT fim={cr.get('ct_fim_real')} / CF fim={cr.get('cf_fim_real')}"
    )


# ---------------------------------------------------------------------------
# Parsers de texto
# ---------------------------------------------------------------------------

def _parse_ns_id(text: str) -> str | None:
    """Extrai NS ID: 'NS003', 'ns 3', 'nota 3', '003' → 'NS003'"""
    if not text:
        return None
    m = re.search(r'\b(?:ns|nota[s]?)\s*0*(\d+)\b', text.lower())
    if m:
        return f"NS{int(m.group(1)):03d}"
    # Somente número
    m2 = re.fullmatch(r'\s*0*(\d{1,4})\s*', text.strip())
    if m2:
        return f"NS{int(m2.group(1)):03d}"
    return None


def _parse_dados_campo(text: str) -> dict:
    """
    Extrai CT e CF do texto.
    Aceita: 'CT=27.45 CF=25.45', 'ct_ini=27.45 cf_ini=25.45 ct_fim=27.63 cf_fim=25.63'
    Retorna dict com chaves: ct, cf, ct_ini, cf_ini, ct_fim, cf_fim (valores float ou None)
    """
    result: dict[str, float | None] = {}
    padroes = [
        (r'ct[_\s]*ini\s*[=:]\s*([\d.,]+)', "ct_ini"),
        (r'cf[_\s]*ini\s*[=:]\s*([\d.,]+)', "cf_ini"),
        (r'ct[_\s]*fim\s*[=:]\s*([\d.,]+)', "ct_fim"),
        (r'cf[_\s]*fim\s*[=:]\s*([\d.,]+)', "cf_fim"),
        (r'\bct\s*[=:]\s*([\d.,]+)', "ct"),
        (r'\bcf\s*[=:]\s*([\d.,]+)', "cf"),
    ]
    for pat, chave in padroes:
        m = re.search(pat, text.lower())
        if m:
            result[chave] = float(m.group(1).replace(",", "."))
    return result


# ---------------------------------------------------------------------------
# WhatsApp API
# ---------------------------------------------------------------------------

def _send_whatsapp(to: str, text: str) -> bool:
    """Envia mensagem de texto via Meta Cloud API. Retorna True se OK."""
    if not WA_TOKEN or not WA_PHONE_ID:
        print(f"[WA→{to}] {text}")  # fallback para log local
        return False

    url = f"{META_API_BASE}/{WA_PHONE_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": to,
        "type": "text",
        "text": {"body": text[:4096]},
    }
    headers = {"Authorization": f"Bearer {WA_TOKEN}", "Content-Type": "application/json"}

    try:
        with httpx.Client(timeout=10) as client:
            r = client.post(url, json=payload, headers=headers)
            return r.status_code == 200
    except Exception as e:
        print(f"[WA send error] {e}")
        return False


async def _baixar_midia(media_id: str, sender: str) -> str:
    """
    Baixa mídia do WhatsApp via Graph API.
    Salva em FOTOS_DIR/{data}_{sender}_{media_id[:8]}.jpg
    Retorna path local ou '' se falhar.
    """
    if not WA_TOKEN or not media_id:
        return ""

    headers = {"Authorization": f"Bearer {WA_TOKEN}"}
    url_info = f"{META_API_BASE}/{media_id}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # 1. Obter URL de download
            r_info = await client.get(url_info, headers=headers)
            if r_info.status_code != 200:
                return ""
            media_url = r_info.json().get("url", "")
            if not media_url:
                return ""

            # 2. Baixar conteúdo
            r_media = await client.get(media_url, headers=headers)
            if r_media.status_code != 200:
                return ""

            # 3. Salvar arquivo
            fotos_dir = Path(FOTOS_DIR)
            fotos_dir.mkdir(parents=True, exist_ok=True)
            data_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            nome = f"{data_str}_{sender[-4:]}_{media_id[:8]}.jpg"
            path_foto = fotos_dir / nome
            path_foto.write_bytes(r_media.content)
            return str(path_foto)

    except Exception as e:
        print(f"[download_media error] {e}")
        return ""


# ---------------------------------------------------------------------------
# Helpers internos
# ---------------------------------------------------------------------------

def _carregar_status() -> dict | None:
    """Carrega STATUS_NS.json via STATUS_NS_PATH ou OUT_BASE+NUCLEO_DEFAULT."""
    if STATUS_NS_PATH and Path(STATUS_NS_PATH).exists():
        with open(STATUS_NS_PATH, encoding="utf-8") as f:
            return json.load(f)
    # Fallback: usar OUT_BASE + NUCLEO_DEFAULT
    status = carregar(NUCLEO_DEFAULT, OUT_BASE)
    return status if status else None


def _salvar_status(status: dict) -> str:
    """Salva STATUS_NS.json."""
    nucleo = status.get("nucleo", NUCLEO_DEFAULT)
    if STATUS_NS_PATH:
        Path(STATUS_NS_PATH).parent.mkdir(parents=True, exist_ok=True)
        status["_salvo_em"] = datetime.now().isoformat(timespec="seconds")
        with open(STATUS_NS_PATH, "w", encoding="utf-8") as f:
            json.dump(status, f, ensure_ascii=False, indent=2)
        return STATUS_NS_PATH
    return salvar(status, nucleo, OUT_BASE)


def _msg_menu() -> str:
    return (
        "ConstruData Campo\n"
        "Selecione:\n"
        "1 - NS executada\n"
        "2 - Problema/parada\n"
        "3 - Dados campo (CT/CF)\n"
        "4 - Foto de obra\n"
        "5 - Status geral"
    )


def _status_resumo_texto() -> str:
    status = _carregar_status()
    if not status:
        return "Status nao disponivel."
    r = resumo(status)
    nucleo = status.get("nucleo", "?")
    return (
        f"Status {nucleo}:\n"
        f"Total: {r['n_total']} NS\n"
        f"Planejadas: {r['n_planejadas']}\n"
        f"Executadas: {r['n_executadas']}\n"
        f"Cadastradas: {r['n_cadastradas']}\n"
        f"Medidas: {r['n_medidas']}\n"
        f"Fisico: {r['pct_fisico']}%\n"
        f"Extensao exec.: {r['extensao_executada_m']}m"
    )


# ---------------------------------------------------------------------------
# Entry-point direto (sem uvicorn)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not _FASTAPI_OK:
        print("AVISO: FastAPI/uvicorn nao instalados.")
        print("Execute: pip install fastapi uvicorn[standard] httpx")
    else:
        import uvicorn
        print("Iniciando ConstruData Campo Webhook na porta 8765...")
        print("Endpoint de teste: POST http://localhost:8765/webhook/simular")
        uvicorn.run(app, host="0.0.0.0", port=8765, log_level="info")
