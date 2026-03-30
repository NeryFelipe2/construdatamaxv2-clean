# 🤖 Como Configurar os LLMs Gratuitos — ConstruData HydroNetwork

## ✅ Nova Funcionalidade (v7.0)

Agora você pode configurar **todas as 4 API keys diretamente na interface gráfica**, sem precisar usar o terminal!

---

## 📋 Passo a Passo

### 1️⃣ Abra o ConstruData GUI
```bash
python construdata_gui.py
```

### 2️⃣ Vá para a aba **IA**
Clique na aba **"IA"** no topo da janela.

### 3️⃣ Clique em **"⚙ Configurar API Keys"**
Botão roxo no canto superior direito da aba IA.

### 4️⃣ Obtenha suas API Keys (todas grátis!)

| LLM | Limite Gratuito | Link para Pegar a Key |
|-----|-----------------|----------------------|
| **Gemini Flash** | 500 req/dia | 🔗 https://aistudio.google.com/app/apikey |
| **Groq Llama 3.3** | 30 req/min | 🔗 https://console.groq.com/keys |
| **Mistral Large** | 1M tokens/mês | 🔗 https://console.mistral.ai/api-keys |
| **Cohere Command-R** | 1000 req/mês | 🔗 https://dashboard.cohere.com/api-keys |

Clique nos links na própria janela de configuração para abrir cada site.

### 5️⃣ Cole as Keys e Salve
- Cole cada API key no campo correspondente
- Clique em **"💾 Salvar Keys"**
- Opcional: Clique em **"📡 Testar Conexão"** para verificar se estão funcionando

---

## 🎯 O Que Cada LLM Faz

| Módulo | LLM Usado | Por Quê |
|--------|-----------|---------|
| 📸 Analisar Foto | Gemini Flash | Único free com visão multimodal |
| 📄 Ler PDF | Gemini Flash | Único free que lê PDF nativo |
| 💬 Consulta Rápida | Groq Llama 3.3 | Mais rápido do mundo (~0.3s) |
| 📊 Resumo Executivo | Mistral Large | Melhor escrita técnica |
| ✅ Validação Hidráulica | Groq Llama 3.3 | Velocidade para validar em lote |
| 📉 Análise de Perdas | Cohere Command-R | Bom com dados tabulares |
| 🧠 Explicação ML | Mistral Large | Raciocínio + escrita clara |

---

## 💡 Dicas

- **Todas as APIs são 100% gratuitas** para uso individual
- As keys são salvas em: `C:\Users\SEU_USUARIO\.construdata\llm_config.json`
- Você pode configurar apenas 1, 2, 3 ou todos as 4 keys
- O sistema usa **fallback automático**: se um LLM falhar, tenta o próximo
- **Recomendado:** Configure pelo menos **Gemini** (fotos/PDF) e **Groq** (consultas)

---

## ❓ Problemas Comuns

### "Nenhum LLM disponível para 'consulta'"
→ Você precisa configurar pelo menos 1 API key. Siga os passos acima.

### "Erro de conexão"
→ Verifique sua internet e se a key está correta (sem espaços extras)

### "Limite excedido"
→ Cada API tem limites gratuitos. Espere alguns minutos ou use outro LLM.

---

## 🔧 Configuração Manual (Alternativa)

Se preferir, edite o arquivo de configuração diretamente:

```
C:\Users\SEU_USUARIO\.construdata\llm_config.json
```

Formato:
```json
{
  "gemini_api_key": "SUA_KEY_AQUI",
  "groq_api_key": "SUA_KEY_AQUI",
  "mistral_api_key": "SUA_KEY_AQUI",
  "cohere_api_key": "SUA_KEY_AQUI"
}
```

Ou via terminal:
```bash
python motor_llm.py setup
```

---

## 📞 Suporte

Em caso de dúvidas, consulte a documentação completa em `COMO_USAR.md`.

**ConstruData HydroNetwork v7.0** · FCN Construções e Saneamento
