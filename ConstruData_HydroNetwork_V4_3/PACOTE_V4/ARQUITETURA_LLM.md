# ARQUITETURA LLM — Camada Opcional de Inteligência
## ConstruData HydroNetwork · FCN Construções e Saneamento

---

## PRINCÍPIO FUNDAMENTAL

```
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   Os motores de cálculo são DETERMINÍSTICOS.                         ║
║   Manning é Manning. UARL é UARL. Custo é custo.                    ║
║   Não dependem de IA. Não mudam. Não alucinam.                       ║
║                                                                      ║
║   Os LLMs são CAMADA OPCIONAL que INTERPRETA os resultados.          ║
║   Se não configurar nenhuma key, tudo funciona igual.                ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## MAPA DE DEPENDÊNCIAS

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA 1: CÁLCULO PURO                       │
│                    (funciona SEM internet, SEM API key)          │
│                                                                 │
│  motor_custo.py          → R$ 2.592.048,38 (exato)             │
│  motor_medicao.py        → Curva S: 36.7% executado (exato)    │
│  motor_ml.py             → Rolling 3d: 12.5 lig/dia (dados)    │
│  motor_lean_lps.py       → PPC: 66.7% (contagem)              │
│  motor_parametrico.py    → V=0.892 m/s, τ=3.48 Pa (Manning)   │
│  motor_microplanejamento → 65% morro, 3 equipes (cotas)       │
│  motor_perdas.py         → UARL: 37.262 L/dia, ILI: 12 (IWA) │
│  motor_contratos.py      → CRS, preços, núcleos (JSON)        │
│                                                                 │
│  NENHUM desses módulos chama LLM.                               │
│  São fórmulas, dados, regras. Resultado é sempre o mesmo.       │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 │ resultados (números)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA 2: INTELIGÊNCIA (OPCIONAL)             │
│                    (precisa de internet + API key gratuita)      │
│                                                                 │
│  motor_gemini.py         → Gemini Flash (foto, PDF, consulta)  │
│  motor_llm.py            → Roteador (Gemini+Groq+Mistral+Cohere│
│                                                                 │
│  Estes módulos INTERPRETAM os números da Camada 1:              │
│                                                                 │
│  "O custo de R$ 989/m está 8% acima da média do contrato.      │
│   Recomendo revisar a alocação no morro onde o fator é 1.65x." │
│                                                                 │
│  "O ILI de 12 classifica como RUIM. Se reduzir pressão         │
│   noturna em 30%, estima-se economia de R$ 84k/ano."           │
│                                                                 │
│  "A foto mostra vala PVC DN200 com ~1.8m de profundidade.      │
│   Escoramento presente. Lençol freático visível."              │
│                                                                 │
│  SE NÃO CONFIGURAR KEYS → Camada 2 não existe.                 │
│  Plataforma funciona 100% só com Camada 1.                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## TABELA: QUEM USA LLM E QUEM NÃO USA

| Módulo | Usa LLM? | Método de Cálculo | Resultado |
|--------|----------|-------------------|-----------|
| `motor_custo.py` | ❌ NÃO | Preços contrato × extensão × BDI | R$ exato |
| `motor_medicao.py` | ❌ NÃO | Excel/JSON → soma/média | Curva S exata |
| `motor_ml.py` | ❌ NÃO | Rolling average + cenários | Previsão numérica |
| `motor_lean_lps.py` | ❌ NÃO | Takt/VSM/PPC/Lookahead | Indicadores exatos |
| `motor_parametrico.py` | ❌ NÃO | Manning + grafo adjacência | V, Q, τ exatos |
| `motor_microplanejamento.py` | ❌ NÃO | Declividade → morfologia → produtividade | Equipe/dias exatos |
| `motor_perdas.py` | ❌ NÃO | UARL/ILI/balanço IWA | m³/ano exato |
| `motor_contratos.py` | ❌ NÃO | JSON config + CRS por UF | Dados exatos |
| `motor_gemini.py` | ✅ SIM | Gemini Flash API | Texto/JSON interpretado |
| `motor_llm.py` | ✅ SIM | 4 providers roteados | Texto interpretado |
| GUI Tab IA | ✅ SIM | Chama motor_llm | Texto na interface |

---

## FLUXO DE DADOS: CÁLCULO → INTERPRETAÇÃO

### Exemplo 1: Custo
```
motor_custo.custo_nucleo(pvs, trechos)
  → {"total": 2592048.38, "custo_medio_metro": 989.10, ...}
                    │
                    │ (se o engenheiro pedir na Tab IA)
                    ▼
motor_llm.resumo_executivo(contexto_com_custo)
  → "O Verde e Teteu custa R$ 2,59M a R$ 989/m, acima dos R$ 910/m
     do contrato. O fator 1.65x do morro (65% da extensão) explica
     a diferença. Para reduzir, priorizar trechos de planície."
```

### Exemplo 2: Perdas
```
motor_perdas.gerar_relatorio_perdas(pvs, trechos)
  → {"uarl": {"uarl_m3_ano": 13601}, "ili": {"ili": 12.01, "classificacao": "RUIM"}}
                    │
                    │ (se o engenheiro pedir)
                    ▼
motor_llm.analisar_perdas_texto(dados_perdas)
  → "ILI 12.01 está na faixa RUIM (Classe D, World Bank). O Brasil
     tem média 5-12, então este setor está no limite inferior. O
     componente conexões (29.988 L/d) domina 80% do UARL — priorizar
     manutenção dos ramais prediais e instalar VRPs nas DMAs 2 e 3."
```

### Exemplo 3: Foto RDO
```
(engenheiro tira foto da vala no celular)
                    │
                    ▼
motor_llm.analisar_foto("IMG_5282.jpg")    [SÓ LLM, sem cálculo]
  → {"material_tubo": "PVC", "dn_estimado_mm": 200,
     "profundidade_estimada_m": 1.8, "escoramento": "sim",
     "problemas": ["lençol freático alto"],
     "legenda_rdo": "Vala PVC DN200 prof 1.8m, escoramento, lençol alto"}
```

### Exemplo 4: PDF de projeto
```
(engenheiro recebe PDF do projetista)
                    │
                    ▼
motor_llm.ler_pdf("PERFIL_RUA_X.pdf")     [SÓ LLM, sem cálculo]
  → {"pvs": {"PV01": {ct:5.2, cf:3.7}}, "trechos": [{pv_ini:"PV01",...}]}
                    │
                    │ (a partir daqui, tudo é Camada 1 — cálculo puro)
                    ▼
motor_parametrico.PipeNetwork(pvs, trechos)
  → Manning, custo, cronograma, IFC, NS... tudo determinístico
```

---

## ROTEAMENTO NA GUI: TAB IA

```python
# Tab 10: IA — cada botão chama 1 função do motor_llm

"Resumo Executivo"    → motor_llm.resumo_executivo(contexto)     → Mistral Large
"Validar Hidráulica"  → motor_llm.validar_hidraulica(alertas)    → Groq Llama 3.3
"Analisar Perdas"     → motor_llm.analisar_perdas_texto(dados)   → Cohere Command-R+
"Explicar ML"         → motor_llm.explicar_ml(dados_ml)          → Mistral Large
"Analisar Foto"       → motor_llm.analisar_foto(path)            → Gemini Flash
"Ler PDF"             → motor_llm.ler_pdf(path)                  → Gemini Flash
"Perguntar"           → motor_llm.consultar(pergunta, contexto)  → Groq Llama 3.3
```

Se nenhuma key estiver configurada, os botões mostram:
```
"❌ Nenhum LLM disponível. Execute: python motor_llm.py setup"
```

A plataforma NÃO trava. As outras 11 abas funcionam normalmente.

---

## COMO CONFIGURAR (1 vez, 2 minutos)

```bash
pip install google-genai groq mistralai cohere
python motor_llm.py setup
```

O setup pede 4 keys (todas grátis):

| Provider | Onde pegar | Limite gratuito |
|----------|-----------|-----------------|
| Gemini | https://aistudio.google.com/app/apikey | 500 req/dia |
| Groq | https://console.groq.com/keys | 14.400 req/dia |
| Mistral | https://console.mistral.ai/api-keys | 1M tokens/mês |
| Cohere | https://dashboard.cohere.com/api-keys | 1.000 req/mês |

Keys ficam em `~/.construdata/llm_config.json` (nunca no código).

Se configurar só 1 (ex: Groq), todas as funções de texto usam Groq.
Se configurar só Gemini, foto e PDF funcionam mas texto vai pro Gemini também.
O roteador faz **fallback automático**: Groq falhou → tenta Mistral → tenta Cohere.

---

## POR QUE ESSA ARQUITETURA

1. **Determinismo:** Custo, Manning, UARL não podem "alucinar". São fórmulas.
2. **Offline:** Obra no morro não tem 4G. A Camada 1 funciona sem internet.
3. **Auditabilidade:** Fiscalização quer ver a fórmula, não o que a IA disse.
4. **Custo zero:** Sem API key = sem custo. Plataforma roda grátis.
5. **Complementar:** A IA não substitui — ela traduz R$ 2.592.048,38 em ação.

```
O engenheiro olha o número e entende.
O gerente olha o resumo e decide.
Ambos usam a mesma plataforma.
```

---

*ConstruData - HydroNetwork · FCN Construções e Saneamento*
*Camada 1: 18 scripts determinísticos · Camada 2: 2 módulos LLM opcionais*
