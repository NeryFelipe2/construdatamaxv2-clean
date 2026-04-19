#!/usr/bin/env python3
"""
MOTOR_LLM.PY — Roteador Multi-LLM (1 modelo gratuito por módulo)
ConstruData - HydroNetwork · FCN Construções e Saneamento

Cada módulo usa o MELHOR modelo gratuito para a tarefa:

┌─────────────────────┬──────────────────┬───────────────────────────────────┐
│ MÓDULO              │ LLM GRATUITO     │ POR QUÊ                          │
├─────────────────────┼──────────────────┼───────────────────────────────────┤
│ Análise de Foto     │ Gemini Flash     │ Único free c/ visão multimodal   │
│ Leitura de PDF      │ Gemini Flash     │ Único free que lê PDF nativo     │
│ Consulta Rápida     │ Groq (Llama 3.3) │ Mais rápido do mundo (grátis)   │
│ Resumo Executivo    │ Mistral Large    │ Melhor escrita técnica free      │
│ Recomendações LPS   │ Groq (Llama 3.3) │ Resposta em <1s, bom raciocínio │
│ Análise de Perdas   │ Cohere Command-R │ Bom com dados tabulares          │
│ Validação Hidráulica│ Groq (Llama 3.3) │ Velocidade p/ validar em lote   │
│ Auto-legenda RDO    │ Gemini Flash     │ Multimodal (foto → texto)        │
│ Explicação ML       │ Mistral Large    │ Raciocínio + escrita clara       │
│ Chat Geral          │ Groq (Llama 3.3) │ Rápido + gratuito ilimitado*    │
└─────────────────────┴──────────────────┴───────────────────────────────────┘

LIMITES GRATUITOS:
  Gemini Flash:  500 req/dia  (multimodal, PDF, imagem)
  Groq:          30 req/min   (texto, ultra-rápido ~0.3s)
  Mistral:       1M tokens/mês(texto, boa escrita)
  Cohere:        1000 req/mês (texto, RAG, dados)

SETUP:
  pip install google-genai groq mistralai cohere
  
  API Keys (todas grátis):
    Gemini:  https://aistudio.google.com/app/apikey
    Groq:    https://console.groq.com/keys
    Mistral: https://console.mistral.ai/api-keys
    Cohere:  https://dashboard.cohere.com/api-keys
"""

import json, os, base64, time
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any


# ══════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════

CONFIG_PATH = Path.home() / ".construdata" / "llm_config.json"

PROVIDERS = {
    "gemini": {
        "env_key": "GEMINI_API_KEY",
        "modelos": {"flash": "gemini-2.5-flash", "pro": "gemini-2.5-pro"},
        "free_limit": "500 req/dia",
        "url_key": "https://aistudio.google.com/app/apikey",
        "capacidades": ["visao", "pdf", "texto", "codigo"],
    },
    "groq": {
        "env_key": "GROQ_API_KEY",
        "modelos": {"llama": "llama-3.3-70b-versatile", "mixtral": "mixtral-8x7b-32768"},
        "free_limit": "30 req/min, 14400/dia",
        "url_key": "https://console.groq.com/keys",
        "capacidades": ["texto", "codigo", "rapido"],
    },
    "mistral": {
        "env_key": "MISTRAL_API_KEY",
        "modelos": {"large": "mistral-large-latest", "small": "mistral-small-latest"},
        "free_limit": "1M tokens/mês",
        "url_key": "https://console.mistral.ai/api-keys",
        "capacidades": ["texto", "escrita", "raciocinio"],
    },
    "cohere": {
        "env_key": "COHERE_API_KEY",
        "modelos": {"command": "command", "light": "command-r-08-2024"},
        "free_limit": "1000 req/mês",
        "url_key": "https://dashboard.cohere.com/api-keys",
        "capacidades": ["texto", "rag", "dados"],
    },
    "anthropic": {
        "env_key": "ANTHROPIC_API_KEY",
        "modelos": {"opus": "claude-opus-4-6", "sonnet": "claude-sonnet-4-6", "haiku": "claude-haiku-4-5-20251001"},
        "free_limit": "pago (API key)",
        "url_key": "https://console.anthropic.com/settings/keys",
        "capacidades": ["texto", "codigo", "raciocinio", "agente"],
    },
    "openai": {
        "env_key": "OPENAI_API_KEY",
        "modelos": {"gpt4o": "gpt-4o", "gpt4o_mini": "gpt-4o-mini"},
        "free_limit": "pago (API key)",
        "url_key": "https://platform.openai.com/api-keys",
        "capacidades": ["texto", "codigo", "visao", "raciocinio"],
    },
}

# Roteamento: módulo → provider preferido → fallback
ROTEAMENTO = {
    "foto":           ["gemini"],                          # só Gemini tem visão free
    "pdf":            ["gemini"],                          # só Gemini lê PDF free
    "consulta":       ["groq", "mistral", "cohere"],       # Groq é mais rápido
    "resumo":         ["mistral", "groq", "cohere"],       # Mistral escreve melhor
    "lps":            ["groq", "mistral"],                  # resposta rápida
    "perdas":         ["cohere", "groq", "mistral"],        # bom com dados
    "hidraulica":     ["groq", "mistral"],                  # velocidade
    "legenda_rdo":    ["gemini", "groq"],                   # multimodal ou texto
    "ml_explicacao":  ["mistral", "groq"],                  # raciocínio
    "chat":           ["groq", "mistral", "cohere"],        # geral
    "agente":         ["anthropic", "openai", "groq"],       # agente principal
    "decisao":        ["anthropic", "openai", "mistral"],    # raciocínio complexo
    "codigo":         ["anthropic", "openai", "groq"],       # geração de código
}


PROMPTS_ANALISE = {
    "lean_lps": "Voce e consultor senior Lean Construction e LPS. Analise os dados e responda com ACOES CONCRETAS: 1.DIAGNOSTICO (PPC aceitavel? Takt compativel?) 2.GARGALOS (top 3 restricoes) 3.ACOES AMANHA 4.PROXIMA SEMANA (redistribuir equipes?) 5.ALERTA (PPC<60% = risco atraso). Use NUMEROS. Dados:",
    "custo": "Voce e analista de custos de saneamento. Analise: 1.COMPARACAO (R$/m vs contrato R$910/m) 2.DESVIO (itens acima) 3.OTIMIZACAO 4.PROJECAO custo final 5.BM (excluir algum trecho?). Use composicao: Escav R$145, Tubo R$240, PV R$120, Reaterro R$80, Pavim R$45. Dados:",
    "perdas": "Voce e especialista IWA perdas de agua. Analise: 1.ILI (faixa A/B/C/D, media Brasil 5-12) 2.UARL (componente dominante) 3.PRIORIDADE (deteccao vs hidrometro) 4.ECONOMIA (se ILI=4, quanto economiza/ano) 5.DMAs (onde instalar macromedidores). Dados:",
    "ml": "Voce e engenheiro de producao. Explique em LINGUAGEM DE CAMPO: 1.PRODUCAO ATUAL (bom?) 2.TENDENCIA 3.GARGALOS (qual etapa trava) 4.CENARIO RECOMENDADO 5.ACAO PRATICA amanha. Nao use jargao ML. Dados:",
    "micro": "Voce e planejador de obras em areas irregulares. Analise: 1.EQUIPES (distribuicao OK?) 2.MORRO (escoramento?) 3.MATERIAL JIT 4.SEQUENCIA (qual frente primeiro) 5.RISCO (chuva/mare/solo). Dados:",
    "hidraulica": "Voce e projetista hidraulico NBR 9649. Para cada alerta: V>5=erosao, V<0.6=sedimentacao, tau<1=fora norma, decl negativa=erro projeto, prof>5m=custo alto. De: Trecho, Problema, Causa, Acao, Urgencia(1-5). Alertas:",
    "resumo_exec": "Voce e gerente de contrato na reuniao semanal. Resumo 200 palavras: 1.SITUACAO (X de Y metros, Z%) 2.PRODUCAO (lig/mes vs meta) 3.CUSTOS (faturado vs contrato) 4.PROBLEMAS (top 3) 5.PROXIMOS PASSOS (3 acoes). Tom objetivo, direto, com numeros. Dados:",
}


def _load_config():
    """Carrega configuração salva."""
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text())
        except:
            pass
    return {}


def _save_config(config):
    """Salva configuração."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2))


def _get_key(provider):
    """Busca API key de um provider."""
    info = PROVIDERS.get(provider, {})
    env_key = info.get("env_key", "")
    
    # 1. Variável de ambiente
    key = os.environ.get(env_key)
    if key:
        return key
    
    # 2. Config salva
    config = _load_config()
    key = config.get(f"{provider}_api_key")
    if key:
        os.environ[env_key] = key
        return key
    
    return None


# ══════════════════════════════════════════════════════════
# CLIENTES (lazy loading)
# ══════════════════════════════════════════════════════════

_clients = {}

def _get_gemini():
    if "gemini" not in _clients:
        from google import genai
        _clients["gemini"] = genai.Client(api_key=_get_key("gemini"))
    return _clients["gemini"]

def _get_groq():
    if "groq" not in _clients:
        from groq import Groq
        _clients["groq"] = Groq(api_key=_get_key("groq"))
    return _clients["groq"]

def _get_mistral():
    if "mistral" not in _clients:
        try:
            from mistralai import Mistral
            _clients["mistral"] = Mistral(api_key=_get_key("mistral"))
        except ImportError:
            from mistralai.client import MistralClient
            _clients["mistral"] = MistralClient(api_key=_get_key("mistral"))
    return _clients["mistral"]

def _get_cohere():
    if "cohere" not in _clients:
        import cohere
        _clients["cohere"] = cohere.Client(api_key=_get_key("cohere"))
    return _clients["cohere"]

def _get_anthropic():
    if "anthropic" not in _clients:
        from anthropic import Anthropic
        _clients["anthropic"] = Anthropic(api_key=_get_key("anthropic"))
    return _clients["anthropic"]

def _get_openai():
    if "openai" not in _clients:
        from openai import OpenAI
        _clients["openai"] = OpenAI(api_key=_get_key("openai"))
    return _clients["openai"]


# ══════════════════════════════════════════════════════════
# CHAMADAS UNIFICADAS POR PROVIDER
# ══════════════════════════════════════════════════════════

def _call_gemini(prompt, modelo=None, imagem_bytes=None, imagem_mime=None, pdf_bytes=None):
    """Chama Gemini (texto, imagem ou PDF)."""
    client = _get_gemini()
    modelo = modelo or PROVIDERS["gemini"]["modelos"]["flash"]

    contents = []
    if imagem_bytes:
        contents.append({"mime_type": imagem_mime or "image/jpeg", "data": imagem_bytes})
    if pdf_bytes:
        contents.append({"mime_type": "application/pdf", "data": pdf_bytes})
    contents.append({"text": prompt})

    response = client.models.generate_content(
        model=modelo, contents=contents,
        config={"temperature": 0.2},
    )
    return response.text


def _call_groq(prompt, modelo=None, system=None):
    """Chama Groq (Llama 3.3 70B — ultra-rápido)."""
    client = _get_groq()
    modelo = modelo or PROVIDERS["groq"]["modelos"]["llama"]
    
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    
    response = client.chat.completions.create(
        model=modelo, messages=messages,
        temperature=0.2, max_tokens=2048,
    )
    return response.choices[0].message.content


def _call_mistral(prompt, modelo=None, system=None):
    """Chama Mistral (boa escrita técnica)."""
    client = _get_mistral()
    modelo = modelo or PROVIDERS["mistral"]["modelos"]["large"]

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.complete(
        model=modelo, messages=messages,
        temperature=0.3, max_tokens=2048,
    )
    return response.choices[0].message.content


def _call_cohere(prompt, modelo=None, system=None):
    """Chama Cohere (bom com dados e RAG)."""
    client = _get_cohere()
    modelo = modelo or PROVIDERS["cohere"]["modelos"]["command"]

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat(
        model=modelo, messages=messages,
        temperature=0.2, max_tokens=2048,
    )
    return response.message.content[0].text


def _call_anthropic(prompt, modelo=None, system=None):
    """Chama Anthropic Claude (raciocínio + agente)."""
    client = _get_anthropic()
    modelo = modelo or PROVIDERS["anthropic"]["modelos"]["sonnet"]

    kwargs = {"model": modelo, "max_tokens": 2048}
    if system:
        kwargs["system"] = system
    kwargs["messages"] = [{"role": "user", "content": prompt}]

    response = client.messages.create(**kwargs)
    return response.content[0].text


def _call_openai(prompt, modelo=None, system=None):
    """Chama OpenAI GPT-4o."""
    client = _get_openai()
    modelo = modelo or PROVIDERS["openai"]["modelos"]["gpt4o"]

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=modelo, messages=messages,
        temperature=0.2, max_tokens=2048,
    )
    return response.choices[0].message.content


CALL_MAP = {
    "gemini": _call_gemini,
    "groq": _call_groq,
    "mistral": _call_mistral,
    "cohere": _call_cohere,
    "anthropic": _call_anthropic,
    "openai": _call_openai,
}


# ══════════════════════════════════════════════════════════
# ROTEADOR INTELIGENTE
# ══════════════════════════════════════════════════════════

def chamar(modulo, prompt, **kwargs):
    """
    Chama o melhor LLM gratuito para o módulo.
    Faz fallback automático se o preferido falhar.
    
    Args:
        modulo: "foto", "pdf", "consulta", "resumo", "lps", "perdas",
                "hidraulica", "legenda_rdo", "ml_explicacao", "chat",
                "agente", "decisao", "codigo"
        prompt: texto do prompt
        **kwargs: imagem_bytes, pdf_bytes, system, etc.
    
    Returns:
        str com resposta do LLM
    """
    providers = ROTEAMENTO.get(modulo, ROTEAMENTO["chat"])
    
    for provider in providers:
        key = _get_key(provider)
        if not key:
            continue
        
        try:
            call_fn = CALL_MAP[provider]
            
            # Filtrar kwargs que o provider aceita
            if provider == "gemini":
                result = call_fn(prompt,
                    imagem_bytes=kwargs.get("imagem_bytes"),
                    imagem_mime=kwargs.get("imagem_mime"),
                    pdf_bytes=kwargs.get("pdf_bytes"))
            else:
                result = call_fn(prompt, system=kwargs.get("system"))
            
            return result
            
        except Exception as e:
            print(f"  ⚠️ {provider} falhou: {str(e)[:60]}. Tentando próximo...")
            continue
    
    return f"❌ Nenhum LLM disponível para '{modulo}'. Configure pelo menos 1 key: setup()"


# ══════════════════════════════════════════════════════════
# FUNÇÕES DE ALTO NÍVEL POR MÓDULO DA GUI
# ══════════════════════════════════════════════════════════

SYSTEM_ENGENHEIRO = (
    "Você é um engenheiro sanitarista especialista em redes de água e esgoto. "
    "Projeto SE LIGA NA REDE, SABESP Santos. Empresa: FCN Construções e Saneamento. "
    "Responda em português brasileiro, técnico e objetivo."
)


# ── MÓDULO REDE ──────────────────────────────────────────────────────────────

def analisar_rede(pvs, trechos, pergunta=""):
    """Analisa dados da rede de PVs e trechos."""
    resumo = {
        "n_pvs": len(pvs),
        "n_trechos": len(trechos),
        "extensao_total_m": sum(t.get("ext_m", 0) for t in trechos),
        "materiais": {},
        "dns": {},
        "profundidades": []
    }
    
    for t in trechos:
        mat = t.get("material", "N/A")
        dn = t.get("dn_mm", 0)
        resumo["materiais"][mat] = resumo["materiais"].get(mat, 0) + 1
        resumo["dns"][dn] = resumo["dns"].get(dn, 0) + 1
    
    prompt = f"""DADOS DA REDE:
- {len(pvs)} PVs
- {len(trechos)} trechos
- Extensão total: {resumo['extensao_total_m']:.0f}m
- Materiais: {resumo['materiais']}
- DNs: {resumo['dns']}

PERGUNTA: {pergunta or 'Analise esta rede e identifique: 1) Padrões predominantes 2) Possíveis problemas 3) Recomendações'}"""
    
    return chamar("consulta", prompt, system=SYSTEM_ENGENHEIRO)


# ── MÓDULO HIDRÁULICA ────────────────────────────────────────────────────────

def analisar_hidraulica(trechos_alertas, pergunta=""):
    """Analisa alertas hidráulicos."""
    resumo_alertas = []
    for tr in trechos_alertas[:30]:
        resumo_alertas.append(
            f"{tr.get('pv_ini','?')}→{tr.get('pv_fim','?')} DN{tr.get('dn_mm',0)} "
            f"V={tr.get('v_ms',0):.2f}m/s Q={tr.get('q_lps',0):.1f}L/s "
            f"τ={tr.get('tau_pa',0):.1f}Pa alertas={tr.get('alertas',[])}"
        )
    
    prompt = f"""ALERTAS HIDRÁULICOS ({len(trechos_alertas)} trechos):
{chr(10).join(resumo_alertas)}

PERGUNTA: {pergunta or 'Analise os alertas e recomende ações corretivas prioritárias'}"""
    
    return chamar("hidraulica", prompt, system=SYSTEM_ENGENHEIRO)


# ── MÓDULO CUSTOS ────────────────────────────────────────────────────────────

def analisar_custos(custos_detalhados, curva_s=None, pergunta=""):
    """Analisa dados de custos 5D."""
    if isinstance(custos_detalhados, dict):
        total = custos_detalhados.get("total", 0)
        por_etapa = custos_detalhados.get("por_etapa", {})
    else:
        total = 0
        por_etapa = {}
    
    prompt = f"""CUSTOS DO PROJETO:
- Total: R$ {total:,.2f}
- Por etapa: {por_etapa}
- Curva S: {curva_s if curva_s else 'N/A'}

PERGUNTA: {pergunta or 'Analise a distribuição de custos e identifique oportunidades de otimização'}"""
    
    return chamar("perdas", prompt, system=SYSTEM_ENGENHEIRO)


# ── MÓDULO BIM/IFC ───────────────────────────────────────────────────────────

def analisar_bim(ifc_dados, lod_info=None, pergunta=""):
    """Analisa dados BIM/IFC LOD500."""
    prompt = f"""DADOS BIM/IFC:
- Elementos: {ifc_dados if isinstance(ifc_dados, (int, str)) else len(ifc_dados) if isinstance(ifc_dados, (list, dict)) else 'N/A'}
- LOD: {lod_info or '500'}

PERGUNTA: {pergunta or 'Analise o modelo BIM e identifique inconsistências ou melhorias'}"""
    
    return chamar("resumo", prompt, system=SYSTEM_ENGENHEIRO)


# ── MÓDULO LEAN/LPS ──────────────────────────────────────────────────────────

def analisar_lean(ppc, takt, restricoes, lookahead=None, pergunta=""):
    """Analisa dados Lean/LPS."""
    prompt = f"""LEAN/LPS:
- PPC: {ppc:.1f}%
- Takt Time: {takt:.1f} dias
- Restrições ativas: {len(restricoes) if restricoes else 0}
- Lookahead: {lookahead or 'N/A'}

PERGUNTA: {pergunta or 'Analise o PPC e as restrições. Recomende ações para melhorar a produção'}"""
    
    return chamar("lps", prompt, system=SYSTEM_ENGENHEIRO)


# ── MÓDULO PERDAS ────────────────────────────────────────────────────────────

def analisar_perdas(uarl, il, pressao_med, dmAs=None, pergunta=""):
    """Analisa dados de perdas de água."""
    ili = il / uarl if uarl > 0 else 0
    
    prompt = f"""PERDAS DE ÁGUA:
- UARL: {uarl:.1f} m³/km/dia
- IL (Índice de Perdas): {il:.1f} m³/km/dia
- ILI: {ili:.2f} (ILI < 4 = bom, 4-8 = aceitável, > 8 = ruim)
- Pressão média: {pressao_med:.1f} mca
- DMAs: {dmAs or 'N/A'}

PERGUNTA: {pergunta or 'Analise as perdas e recomende ações prioritárias para redução'}"""
    
    return chamar("perdas", prompt, system=SYSTEM_ENGENHEIRO)


# ── MÓDULO ML/PREVISÃO ───────────────────────────────────────────────────────

def analisar_ml(producao_atual, meta, rolling_3, tendencia=None, pergunta=""):
    """Analisa previsões do modelo ML."""
    aceleracao_necessaria = (meta - producao_atual) / max(1, rolling_3) if rolling_3 > 0 else 0
    
    prompt = f"""MACHINE LEARNING - PREVISÃO DE PRODUÇÃO:
- Produção atual: {producao_atual} m/dia
- Meta: {meta} m/dia
- Média móvel 3 dias: {rolling_3:.1f} m/dia
- Aceleração necessária: {aceleracao_necessaria:.1f}x
- Tendência: {tendencia or 'N/A'}

PERGUNTA: {pergunta or 'Explique a previsão e recomende ações para atingir a meta'}"""
    
    return chamar("ml_explicacao", prompt, system=SYSTEM_ENGENHEIRO)


# ── MÓDULO CRONOGRAMA ────────────────────────────────────────────────────────

def analisar_cronograma(duracao_total, caminho_critico, marcos=None, pergunta=""):
    """Analisa cronograma do projeto."""
    prompt = f"""CRONOGRAMA:
- Duração total: {duracao_total} dias
- Caminho crítico: {len(caminho_critico) if isinstance(caminho_critico, list) else caminho_critico} atividades
- Marcos: {marcos or 'N/A'}

PERGUNTA: {pergunta or 'Analise o cronograma e identifique riscos e oportunidades de aceleração'}"""
    
    return chamar("resumo", prompt, system=SYSTEM_ENGENHEIRO)


def analisar_foto(caminho_foto, tipo="auto"):
    """Analisa foto de obra → JSON estruturado. Usa: Gemini Flash."""
    with open(caminho_foto, "rb") as f:
        img = f.read()
    mime = "image/jpeg" if caminho_foto.lower().endswith((".jpg",".jpeg")) else "image/png"
    
    prompt = """Analise esta foto de obra de saneamento. Retorne APENAS JSON:
{"tipo_foto":"vala|pv|pavimento|geral","material_tubo":"PVC|PEAD|não visível",
"dn_estimado_mm":200,"profundidade_estimada_m":1.5,"escoramento":"sim|não",
"condicao":"boa|regular|ruim","problemas":[],"legenda_rdo":"legenda em 1 linha"}"""
    
    text = chamar("foto", prompt, imagem_bytes=img, imagem_mime=mime)
    try:
        clean = text.strip().replace("```json","").replace("```","").strip()
        return json.loads(clean)
    except:
        return {"legenda_rdo": text[:100], "raw": text}


def ler_pdf(caminho_pdf):
    """Lê PDF de projeto → pvs + trechos. Usa: Gemini Flash."""
    with open(caminho_pdf, "rb") as f:
        pdf = f.read()
    
    prompt = """Extraia dados do perfil longitudinal. Retorne APENAS JSON:
{"pvs":[{"nome":"PV01","cota_terreno":5.2,"cota_fundo":3.7}],
"trechos":[{"pv_ini":"PV01","pv_fim":"PV02","dn_mm":200,"extensao_m":45.0,"material":"PVC"}]}"""
    
    text = chamar("pdf", prompt, pdf_bytes=pdf)
    try:
        clean = text.strip().replace("```json","").replace("```","").strip()
        data = json.loads(clean)
        pvs = {p["nome"]: {"ct":p.get("cota_terreno"),"cf":p.get("cota_fundo"),"x":0,"y":0,"tipo":"esgoto"} 
               for p in data.get("pvs",[])}
        trechos = [{"pv_ini":t["pv_ini"],"pv_fim":t["pv_fim"],"dn_mm":t.get("dn_mm",200),
                    "ext_m":t.get("extensao_m",0),"material":t.get("material","PVC"),"tipo":"esgoto"}
                   for t in data.get("trechos",[])]
        return {"pvs": pvs, "trechos": trechos}
    except:
        return {"raw": text, "erro": "parse falhou"}


def consultar(pergunta, contexto_dados=""):
    """Pergunta sobre os dados. Usa: Groq (Llama 3.3 70B)."""
    prompt = f"DADOS DO PROJETO:\n{contexto_dados}\n\nPERGUNTA: {pergunta}"
    return chamar("consulta", prompt, system=SYSTEM_ENGENHEIRO)


def resumo_executivo(contexto_dados):
    """Gera resumo gerencial. Usa: Mistral Large."""
    prompt = f"""{contexto_dados}

Gere resumo executivo (máx 250 palavras) para a gerência:
1. Situação atual 2. Produção 3. Custos 4. Alertas 5. Próximos passos
Texto corrido, profissional, sem markdown."""
    return chamar("resumo", prompt, system=SYSTEM_ENGENHEIRO)


def recomendar_lps(ns_planejadas, ns_executadas, restricoes):
    """Recomendações LPS. Usa: Groq (rápido)."""
    prompt = f"""Weekly Work Plan:
Planejadas: {len(ns_planejadas)} NS
Executadas: {len(ns_executadas)} NS
PPC: {len(ns_executadas)/max(1,len(ns_planejadas))*100:.0f}%
Restrições ativas: {json.dumps(restricoes)}

Analise o PPC e as restrições. Recomende:
1. Ações de make-ready para remover restrições
2. Ajustes no plano da próxima semana
3. Alerta se PPC < 60%
Seja direto e prático."""
    return chamar("lps", prompt, system=SYSTEM_ENGENHEIRO)


def analisar_perdas_texto(dados_perdas):
    """Análise textual dos dados de perdas. Usa: Cohere."""
    prompt = f"""Dados de gestão de perdas de água:
{json.dumps(dados_perdas, indent=2, ensure_ascii=False)[:3000]}

Analise os dados e responda:
1. O ILI está aceitável? Compare com benchmarks IWA.
2. Qual componente do UARL é mais relevante?
3. Quais ações prioritárias para reduzir perdas?
4. Estimativa de economia se atingir ILI=4.
Seja técnico e use dados reais."""
    return chamar("perdas", prompt, system=SYSTEM_ENGENHEIRO)


def validar_hidraulica(trechos_alertas):
    """Valida alertas hidráulicos em lote. Usa: Groq (velocidade)."""
    resumo = []
    for idx, tr in trechos_alertas[:20]:
        resumo.append(f"T{idx}: {tr.get('pv_ini','?')}→{tr.get('pv_fim','?')} DN{tr.get('dn_mm',0)} "
                      f"V={tr.get('v_ms',0):.2f} τ={tr.get('tau_pa',0):.1f} alertas={tr.get('alertas',[])}")
    
    prompt = f"""Trechos com alertas hidráulicos:
{chr(10).join(resumo)}

Para cada alerta, recomende ação corretiva:
- V > 5 m/s: aumentar DN ou reduzir declividade
- V < 0.6 m/s: verificar autolimpeza, aumentar declividade
- τ < 1 Pa: NBR 9649 exige mínimo 1 Pa
- Declividade negativa: erro de projeto ou cota
Seja breve, 1 linha por trecho."""
    return chamar("hidraulica", prompt, system=SYSTEM_ENGENHEIRO)


def explicar_ml(dados_ml):
    """Explica resultados do ML. Usa: Mistral (raciocínio)."""
    prompt = f"""Resultados do modelo de Machine Learning (XGBoost):
{json.dumps(dados_ml, indent=2, ensure_ascii=False)[:2000]}

Explique para um engenheiro de campo (não data scientist):
1. O que o rolling_3 significa na prática
2. Por que a tendência está subindo/descendo
3. Qual cenário de aceleração faz mais sentido
4. O que ele pode fazer AMANHÃ para melhorar a produção
Linguagem simples, prática, sem jargão de ML."""
    return chamar("ml_explicacao", prompt, system=SYSTEM_ENGENHEIRO)


# ══════════════════════════════════════════════════════════
# SETUP
# ══════════════════════════════════════════════════════════

def setup():
    """Configura todas as API keys interativamente."""
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  ConstruData — Configurar LLMs Gratuitos                ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print("║  Todas as APIs são GRATUITAS. Pegue as keys abaixo.     ║")
    print("╚══════════════════════════════════════════════════════════╝")
    
    config = _load_config()
    
    for provider, info in PROVIDERS.items():
        print(f"\n{'─'*50}")
        print(f"  {provider.upper()} — {info['free_limit']}")
        print(f"  Pegue grátis: {info['url_key']}")
        
        existing = _get_key(provider)
        if existing:
            print(f"  ✅ Key já configurada ({existing[:8]}...)")
            change = input("  Alterar? (s/N): ").strip().lower()
            if change != 's':
                continue
        
        key = input(f"  {info['env_key']}: ").strip()
        if key:
            config[f"{provider}_api_key"] = key
            os.environ[info["env_key"]] = key
    
    _save_config(config)
    print(f"\n✅ Configuração salva em {CONFIG_PATH}")
    
    # Testar conexões
    print(f"\n{'─'*50}")
    print("  Testando conexões...")
    status()


def status():
    """Mostra status de todos os providers."""
    print(f"\n  {'PROVIDER':12s} │ {'STATUS':8s} │ {'MODELO':25s} │ LIMITE FREE")
    print(f"  {'─'*12}─┼─{'─'*8}─┼─{'─'*25}─┼─{'─'*20}")
    
    for provider, info in PROVIDERS.items():
        key = _get_key(provider)
        if key:
            try:
                # Teste rápido
                CALL_MAP[provider]("Diga OK", system="Responda apenas OK")
                st = "✅ OK"
            except Exception as e:
                st = f"❌ {str(e)[:15]}"
        else:
            st = "⬚ SEM KEY"
        
        modelo = list(info["modelos"].values())[0]
        print(f"  {provider:12s} │ {st:8s} │ {modelo:25s} │ {info['free_limit']}")
    
    # Mostrar roteamento
    print(f"\n  ROTEAMENTO POR MÓDULO:")
    for modulo, providers in ROTEAMENTO.items():
        disponivel = next((p for p in providers if _get_key(p)), None)
        simbolo = "✅" if disponivel else "❌"
        print(f"    {simbolo} {modulo:18s} → {' > '.join(providers)} {'(usando: '+disponivel+')' if disponivel else '(NENHUM DISPONÍVEL)'}")


def status_rapido():
    """Retorna dict com status (sem testar conexão)."""
    result = {}
    for provider in PROVIDERS:
        result[provider] = bool(_get_key(provider))
    return result


# ══════════════════════════════════════════════════════════
# CLI
# ══════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys
    
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  ConstruData — Multi-LLM Router                         ║")
    print("║  1 modelo gratuito por módulo                            ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print("║  Gemini Flash → fotos, PDF (visão)                      ║")
    print("║  Groq Llama   → consultas, LPS, hidráulica (velocidade) ║")
    print("║  Mistral      → resumos, ML (escrita técnica)           ║")
    print("║  Cohere       → perdas, dados (RAG)                     ║")
    print("╚══════════════════════════════════════════════════════════╝")
    
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "setup":
            setup()
        elif cmd == "status":
            status()
        elif cmd == "test":
            print("\nTestando todos os providers...")
            for provider in PROVIDERS:
                key = _get_key(provider)
                if key:
                    try:
                        resp = CALL_MAP[provider]("Responda apenas: CONECTADO")
                        print(f"  ✅ {provider}: {resp[:30]}")
                    except Exception as e:
                        print(f"  ❌ {provider}: {e}")
                else:
                    print(f"  ⬚ {provider}: sem key")
    else:
        # Mostrar status rápido
        for provider, info in PROVIDERS.items():
            key = _get_key(provider)
            s = "✅" if key else "⬚"
            print(f"  {s} {provider:10s} → {info['url_key']}")
        
        print(f"\n  python motor_llm.py setup   → configurar keys")
        print(f"  python motor_llm.py status  → ver status detalhado")
        print(f"  python motor_llm.py test    → testar conexões")
