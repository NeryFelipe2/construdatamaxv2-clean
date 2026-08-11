# PROMPT — Adicionar LLMs Gratuitos à Plataforma ConstruData
## Cole este prompt no Claude Code ou qualquer assistente de código
## FCN Construções e Saneamento · ConstruData - HydroNetwork

---

## OBJETIVO

Adicionar inteligência artificial (4 LLMs gratuitos) à plataforma ConstruData HydroNetwork existente.
Já existem 20 scripts Python + 6 HTML + 1 GUI desktop (Tkinter). Os LLMs vão COMPLEMENTAR, não substituir.

---

## ARQUIVOS NOVOS A INTEGRAR

Dois scripts novos precisam ser integrados na plataforma existente:

```
scripts/
  motor_gemini.py    ← Gemini API (fotos + PDF + assistente)
  motor_llm.py       ← Roteador multi-LLM (melhor free por módulo)
```

---

## ROTEAMENTO: 1 LLM GRATUITO POR MÓDULO

```
┌─────────────────────┬──────────────────┬────────────────────────┐
│ MÓDULO              │ LLM GRATUITO     │ POR QUÊ                │
├─────────────────────┼──────────────────┼────────────────────────┤
│ Análise de Foto     │ Gemini Flash     │ Único free c/ visão    │
│ Leitura de PDF      │ Gemini Flash     │ Único free que lê PDF  │
│ Consulta Rápida     │ Groq Llama 3.3   │ ~0.3s resposta         │
│ Resumo Executivo    │ Mistral Large    │ Melhor escrita técnica  │
│ Recomendações LPS   │ Groq Llama 3.3   │ Resposta instantânea   │
│ Análise de Perdas   │ Cohere Command-R │ Bom com dados tabulares│
│ Validação Hidráulica│ Groq Llama 3.3   │ Velocidade em lote     │
│ Auto-legenda RDO    │ Gemini Flash     │ Multimodal (foto→texto)│
│ Explicação ML       │ Mistral Large    │ Raciocínio + escrita   │
│ Chat Geral          │ Groq Llama 3.3   │ Rápido + ilimitado     │
└─────────────────────┴──────────────────┴────────────────────────┘
```

---

## LIMITES GRATUITOS (suficientes para obra)

| Provider | Limite Free | Modelo | SDK |
|----------|------------|--------|-----|
| Gemini | 500 req/dia | gemini-2.5-flash | `pip install google-genai` |
| Groq | 14.400 req/dia | llama-3.3-70b-versatile | `pip install groq` |
| Mistral | 1M tokens/mês | mistral-large-latest | `pip install mistralai` |
| Cohere | 1.000 req/mês | command-r-plus | `pip install cohere` |

API Keys (todas grátis):
- Gemini: https://aistudio.google.com/app/apikey
- Groq: https://console.groq.com/keys
- Mistral: https://console.mistral.ai/api-keys
- Cohere: https://dashboard.cohere.com/api-keys

---

## COMO INTEGRAR NA GUI DESKTOP (construdata_gui.py)

### Passo 1: Nova aba "IA" (Tab 12)

Adicionar uma aba na GUI Tkinter com:

```python
# Na GUI, nova aba:
tab_ia = ttk.Frame(notebook)
notebook.add(tab_ia, text="🤖 IA")

# Dentro da aba:
# 1. Status dos providers (verde/vermelho)
# 2. Campo de pergunta (Entry + botão "Perguntar")
# 3. Área de resposta (ScrolledText)
# 4. Botões rápidos:
#    [Resumo Executivo] [Validar Hidráulica] [Analisar Perdas]
#    [Explicar ML] [Recomendações LPS] [Configurar Keys]
```

### Passo 2: Integrar fotos no RDO (Tab RDO)

```python
# Quando o usuário adiciona foto no RDO:
from motor_llm import analisar_foto

def on_foto_adicionada(caminho_foto):
    resultado = analisar_foto(caminho_foto)
    # Preenche automaticamente:
    # - Legenda da foto (resultado["legenda_rdo"])
    # - Material identificado
    # - DN estimado
    # - Problemas detectados
```

### Passo 3: Integrar leitura de PDF (Tab PROCESSAR)

```python
# Quando o usuário seleciona um PDF na aba Processar:
from motor_llm import ler_pdf

if arquivo.endswith('.pdf'):
    dados = ler_pdf(arquivo)
    pvs = dados["pvs"]
    trechos = dados["trechos"]
    # Alimenta o pipeline normal (mesma interface pvs+trechos)
```

### Passo 4: Botão "Perguntar" na aba IA

```python
from motor_llm import consultar, resumo_executivo, validar_hidraulica
from motor_llm import recomendar_lps, analisar_perdas_texto, explicar_ml

def on_perguntar():
    pergunta = entry_pergunta.get()
    contexto = _build_contexto_atual()  # pvs, trechos, execução
    resposta = consultar(pergunta, contexto)
    text_resposta.insert("end", resposta)

def on_resumo_executivo():
    contexto = _build_contexto_atual()
    resposta = resumo_executivo(contexto)
    text_resposta.insert("end", resposta)

def on_validar_hidraulica():
    from motor_parametrico import PipeNetwork
    rede = PipeNetwork(pvs, trechos)
    alertas = rede.trechos_com_alerta()
    resposta = validar_hidraulica(alertas)
    text_resposta.insert("end", resposta)
```

### Passo 5: Setup interativo

```python
# Botão "Configurar Keys" abre dialog:
from motor_llm import setup, status

def on_configurar_keys():
    # Pode ser uma janela Toplevel com 4 campos (1 por provider)
    # Ou chamar setup() no terminal
    setup()
```

---

## COMO INTEGRAR NOS HTMLs

### construdata_rdo.html — Análise de foto via API

```javascript
// No RDO, quando adiciona foto:
async function analisarFotoIA(file) {
    const base64 = await fileToBase64(file);
    
    // Chama Gemini diretamente do frontend:
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_KEY, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
            contents: [{parts: [
                {inline_data: {mime_type: file.type, data: base64}},
                {text: "Analise esta foto de obra de saneamento. Retorne JSON: {material, dn_mm, profundidade_m, problemas, legenda}"}
            ]}]
        })
    });
    
    const data = await response.json();
    const analise = JSON.parse(data.candidates[0].content.parts[0].text);
    
    // Preenche legenda automaticamente
    document.getElementById('foto-legenda').value = analise.legenda;
}
```

### construdata_perdas.html — Análise textual via Groq

```javascript
// Na aba de perdas, botão "Analisar com IA":
async function analisarPerdasIA() {
    const dados = collectDadosPerdas();
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + GROQ_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{
                role: "system",
                content: "Você é engenheiro sanitarista. Analise dados de perdas de água."
            }, {
                role: "user",
                content: "Dados: " + JSON.stringify(dados) + "\nAnalise ILI, UARL e recomende ações."
            }],
            temperature: 0.3
        })
    });
    
    const data = await response.json();
    document.getElementById('ia-resposta').textContent = data.choices[0].message.content;
}
```

### construdata_editor.html — Assistente no editor

```javascript
// Chat flutuante no editor:
async function perguntarIA(pergunta) {
    const contexto = `Rede: ${Object.keys(state.pvs).length} PVs, ${state.trechos.length} trechos`;
    
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + GROQ_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{role: "user", content: contexto + "\n" + pergunta}],
            temperature: 0.3
        })
    });
    
    const data = await response.json();
    return data.choices[0].message.content;
}
```

---

## API KEYS — SEGURANÇA

**Python (backend):** Keys ficam em `~/.construdata/config.json` ou variáveis de ambiente.
Nunca hardcode no código.

```python
# config.json (criado pelo setup):
{
    "gemini_api_key": "AIza...",
    "groq_api_key": "gsk_...",
    "mistral_api_key": "...",
    "cohere_api_key": "..."
}
```

**HTML (frontend):** Keys ficam em localStorage do navegador.
Adicionar modal de configuração:

```javascript
// Salvar keys no navegador:
localStorage.setItem('GEMINI_KEY', key);
localStorage.setItem('GROQ_KEY', key);

// Recuperar:
const GEMINI_KEY = localStorage.getItem('GEMINI_KEY');
const GROQ_KEY = localStorage.getItem('GROQ_KEY');
```

---

## FUNÇÕES DISPONÍVEIS NO motor_llm.py

```python
from motor_llm import (
    # Alto nível (escolhe LLM automaticamente):
    analisar_foto,         # foto → JSON {material, DN, legenda}      [Gemini]
    ler_pdf,               # PDF → pvs + trechos                      [Gemini]
    consultar,             # pergunta → resposta                      [Groq]
    resumo_executivo,      # dados → texto gerencial                  [Mistral]
    recomendar_lps,        # PPC + restrições → ações                 [Groq]
    analisar_perdas_texto, # dados perdas → análise                   [Cohere]
    validar_hidraulica,    # alertas → correções por trecho           [Groq]
    explicar_ml,           # dados ML → linguagem de campo            [Mistral]
    
    # Baixo nível:
    chamar,                # chamar(modulo, prompt, **kwargs)
    setup,                 # configurar keys interativamente
    status,                # ver status de todos os providers
)
```

---

## REGRAS

1. **NUNCA** hardcode API keys no código-fonte
2. **Fallback automático**: se Groq cai, tenta Mistral, depois Cohere
3. **Gemini é insubstituível** para fotos e PDFs (único multimodal free)
4. **Respostas da IA são SUGESTÕES** — o engenheiro decide
5. Rodar `python motor_llm.py setup` ANTES de usar qualquer função
6. Mesma regra: **NUNCA** "FCN Construções e Saneamento", sempre **FCN Construções e Saneamento**
7. O motor_llm.py e motor_gemini.py são COMPLEMENTARES:
   - motor_gemini.py = acesso direto ao Gemini (mais controle)
   - motor_llm.py = roteador automático (mais prático)

---

## CHECKLIST DE INTEGRAÇÃO

```
[ ] pip install google-genai groq mistralai cohere
[ ] python motor_llm.py setup (configurar 4 keys)
[ ] python motor_llm.py test (testar conexões)
[ ] Adicionar aba IA na GUI desktop
[ ] Integrar analisar_foto() no fluxo de fotos do RDO
[ ] Integrar ler_pdf() como novo formato de entrada no pipeline
[ ] Adicionar botão "Perguntar à IA" na GUI
[ ] Adicionar modal de API keys nos HTMLs
[ ] Testar fallback (desconectar 1 provider, verificar que usa outro)
[ ] Verificar que nenhuma key aparece em log/console/export
```
