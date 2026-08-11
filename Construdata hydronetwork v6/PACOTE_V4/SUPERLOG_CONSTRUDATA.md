# SUPERLOG — ConstruData HydroNetwork
# Documento completo para qualquer LLM reconstruir a plataforma inteira
# FCN Construções e Saneamento · Março 2026
# 7 sessões · 6.5M de transcrição · ~14.000 linhas de código

---

## QUEM ESTÁ LENDO ISSO

Você é uma LLM (Claude, GPT, Gemini, Llama, Mistral — qualquer uma).
Está recebendo a documentação completa de um projeto de software que
foi construído ao longo de 7 sessões de desenvolvimento intensivo.

**Seu trabalho:** Entender tudo, continuar, melhorar, corrigir.

**Regra #1:** NUNCA "FCN Construções e Saneamento" — sempre **FCN Construções e Saneamento**
**Regra #2:** Plataforma = **ConstruData - HydroNetwork**

---

## O QUE É

Sistema BIM 6D completo para construção de redes de água e esgoto.
Lê projetos (DXF/DWG/XML/JSON/PDF), converte em formato interno,
e gera TODOS os entregáveis: notas de serviço, Civil 3D, IFC 3D,
cronogramas, custos, medição, análise de perdas, planejamento lean.

**Contrato principal:** CT 11481051 · SE LIGA NA REDE · SABESP · Santos/SP
**Mas:** a plataforma é multi-contrato (qualquer cidade/estado do Brasil)

---

## HISTÓRIA COMPLETA (7 sessões, 21-23 Mar 2026)

### Sessão 1 (21/Mar 23:59) — Debugar fantasmas
- **Problema:** Script v5 inventava trechos de rede (segmentos fantasma)
- **Causa:** Parser de XDATA do DXF conectava pontos errados
- **Solução:** Criou `ler_dxf_gdal.py` usando GDAL/OGR + scipy clustering
- **Resultado:** 0 fantasmas, 137 trechos corretos (Pantanal)
- **Entregues:** ler_dxf_gdal.py v1, ml_classificador.py

### Sessão 2 (22/Mar 01:00) — GDAL + Clustering
- **Problema:** PVs na posição errada (offset de 5-15m dos textos)
- **Solução:** Endpoint clustering com `fclusterdata(t=2.0)` em vez de snap texto
- **Resultado:** 137 NS perfeitas do Pantanal, 0 erros
- **Entregues:** ler_dxf_gdal.py v2, gerar_ns.py, integração no pipeline

### Sessão 3 (22/Mar 01:46) — Água + DWG
- **Novidade:** Redes de água (PEAD DN63/110/160) + DWG Civil 3D
- **Problema:** DXFs de água tinham 0 trechos (layers diferentes)
- **Solução:** ler_dxf_gdal.py v3 com fallback água, ler_dwg_aec.py com libredwg
- **Resultado:** 4 redes água processadas (23.446m), 1 DWG desbloqueado
- **Entregues:** ler_dwg_aec.py, ler_landxml.py, gerar_civil3d.py

### Sessão 4 (22/Mar 17:04) — BIM 5D completo
- **Construiu:** IFC LOD 500 (geometria 3D real, SweptDiskSolid), cadastro NTS 292,
  MS Project XML, Three.js viewer, controle as-built, Curva S
- **Resultado:** Pipeline 7 etapas funcionando end-to-end
- **Entregues:** gerar_ifc_lod500.py, gerar_cadastro_nts292.py, gerar_project_xml.py,
  construdata_manage.html, construdata_controle.html

### Sessão 5 (22/Mar 22:10) — Editor + Motores
- **Construiu:** Editor EPANET (Leaflet), motor custo, motor medição, motor ML,
  motor Lean/LPS, motor paramétrico, RDO diário
- **Resultado:** Plataforma com 18 scripts e 6 HTML
- **Entregues:** construdata_editor.html, motor_custo.py, motor_medicao.py,
  motor_ml.py, motor_lean_lps.py, motor_parametrico.py, construdata_rdo.html

### Sessão 6 (23/Mar 15:18) — Macro + Perdas + Micro
- **Construiu:** Cronograma macro (P6+OpenProject), microplanejamento por morfologia,
  motor perdas IWA, motor Gemini, motor multi-LLM, motor contratos,
  GUI desktop 12 abas, XLSX profissional, NS DESENHO + SAT
- **Dados:** Extraiu dados reais de 20 planilhas Excel do contrato
- **Resultado:** 22 scripts + 7 HTML + 1 GUI + 6 XLSX
- **Entregues:** gerar_cronograma_macro.py, motor_microplanejamento.py,
  motor_perdas.py, motor_gemini.py, motor_llm.py, motor_contratos.py,
  gerar_xlsx.py, gerar_pdf_perdas.py, construdata_gui.py, construdata_perdas.html

### Sessão 7 (23/Mar — continuação)
- **Problemas identificados:** tudo saía JSON fraco, HTML sumiu, LLM conversa fiado
- **Solução:** gerar_xlsx.py (XLSX profissional), prompts LLM especializados,
  NS_DESENHO + NS_SAT implementados, MESTRE_SLNR_V2.xlsx com fórmulas
- **Pendente:** construdata_analytics.py (XGBoost real + interface dinâmica)

---

## INVENTÁRIO COMPLETO V4 (o que existe AGORA)

### 22 Scripts Python (9.047 linhas)

```
LEITORES (3):
  ler_dxf_gdal.py        395L  DXF ProSaneamento, GDAL+scipy, água+esgoto, clustering
  ler_dwg_aec.py         316L  DWG Civil 3D, libredwg, AEC Proxy, topologia por nomes
  ler_landxml.py         155L  LandXML 1.2, ElementTree, namespace auto

GERADORES (9):
  gerar_ns.py            544L  NS campo: PDF A4 + JSON + HTML Leaflet + GeoJSON
  gerar_civil3d.py       803L  LandXML + DXF Cadastro + Dynamo .py + AutoCAD .scr + JSON
  gerar_cadastro_nts292.py 458L  DXF georref SIRGAS 2000 UTM 23S, 17 layers, SIGNOS
  gerar_ifc_lod500.py    184L  IFC 2x3: SweptDiskSolid + ExtrudedAreaSolid + 4 PSets
  gerar_project_xml.py   276L  MS Project XML, WBS 12 fases, 10 recursos
  gerar_cronograma_macro.py 414L  Multinúcleo: XML + P6 XER + OpenProject CSV + JSON
  gerar_pdf_perdas.py    314L  PDF reportlab: UARL + ILI + balanço + risco
  gerar_xlsx.py          636L  6 XLSX profissionais com gráficos (openpyxl)
  construdata_pipeline.py 203L  Orquestrador: detecta formato → 6 etapas

MOTORES (10):
  motor_custo.py         297L  R$910/m contrato, 20 materiais, BDI 25%, BM
  motor_medicao.py       269L  Excel→resumo→Curva S→BM, 521 dias dados
  motor_ml.py            247L  XGBoost rolling_3, pipeline 11 etapas, 5 cenários
  motor_lean_lps.py      475L  Lean (Takt/VSM) + LPS (WWP/PPC/Lookahead) + BIM 6D
  motor_parametrico.py   318L  PipeNetwork class, mover PV→recalcula cascata Manning
  motor_microplanejamento.py 465L  5 morfologias, equipe/equip por frente, JIT material
  motor_perdas.py        611L  IWA: balanço hídrico, UARL, ILI, DMA, risco ruptura
  motor_gemini.py        562L  Gemini Flash: foto→análise, PDF→pvs+trechos, assistente
  motor_llm.py           545L  Roteador: Gemini+Groq+Mistral+Cohere, fallback
  motor_contratos.py     560L  Multi-contrato, criar/editar/trocar, CRS auto 18 UFs
```

### 7 HTML (3.959 linhas)

```
  construdata_editor.html  1054L  Editor EPANET: Leaflet, toolbar, 4 abas, import/export
  construdata_rdo.html      892L  RDO: NS+custos+fotos+ocorrências+equipe+clima+PDF
  construdata_controle.html 576L  Controle: As-Built+Medição BM+Curva S+Resumo 5D
  construdata_perdas.html   524L  Perdas: Balanço IWA+UARL+ILI+Risco+DMAs+Economia
  FLUXOGRAMA_BIM_5D.html    519L  Fluxograma visual 7 fases
  construdata_manage.html   310L  Viewer 3D: Three.js, 5 modos, Timeline 4D
  ARQUITETURA_BIM_5D.html    84L  Diagrama arquitetura 3 camadas
```

### 1 GUI Desktop (982 linhas)

```
  construdata_gui.py  982L  Tkinter 12 abas: Processar/Mapa/Rede/Hidráulica/
                            Trechos/Custos5D/BIM/Lean/Perdas/IA/Núcleos/Log
```

### Dados do Contrato

```
  DADOS_CONTRATO.json    — 20 materiais + composição R$/m + fatores + saldo
  EXECUCAO_DIARIA.json   — 521 dias × 6 núcleos (equipe, rua, ligações)
  ML_DATA.json           — XGBoost features + pipeline 11 etapas + cenários
```

### Planilha Mestre (MESTRE_SLNR_V2.xlsx — 48 abas)

```
  Abas de dados: PROJETO, SALDO, CRONO_MACRO, FATORES, CUSTOS, DIMENSIONAMENTO,
    PLEITO, ADITIVOS, PRIMAVERA_P6, N07-N12 (6 núcleos novos),
    SD_JOAO_CARLOS, SD_SAO_MANOEL, SD_VILA_ISRAEL, SD_MORRO_TETEU,
    SD_VILA_CRIADORES, SD_PANTANAL_BAIXO (6 núcleos atuais, ~2238 trechos),
    TRECHOS_TODOS, SALDO_REDES_DXF, COMPRAS_DETALHADAS, etc.
  Abas com fórmulas: CURVA_S, DASHBOARD, PROJ_vs_EXEC, MEDICAO_MENSAL,
    MATERIAL_DELTA, PAINEL_EXECUTIVO, ML_PLANO_1044, TENDENCIAS
```

---

## FORMATO INTERNO — A FUNDAÇÃO DE TUDO

```python
pvs = {
    "PV01": {
        "x": 362293.456,       # Easting UTM (EPSG:31983)
        "y": 7352565.123,      # Northing
        "ct": 5.20,            # Cota Terreno (m) — PODE SER NEGATIVO
        "cf": 3.70,            # Cota Fundo (m)
        "tipo": "esgoto",      # "esgoto" | "agua"
        "material_pv": "CONCRETO",
    },
}

trechos = [
    {
        "pv_ini": "PV01",
        "pv_fim": "PV02",
        "dn_mm": 200,          # ESG: 100-600  AG: 32-315
        "ext_m": 14.5,         # calculada por dist(X,Y)
        "decl_mm": 8.5,        # ‰ = (CF_ini - CF_fim) / ext × 1000
        "material": "PVC",     # PVC|PEAD|PE80|PE100|CONCRETO
        "tipo": "esgoto",
    },
]
```

**TODOS os módulos** lêem e geram esse formato. É sagrado. Não alterar.

---

## CONSTANTES DO CONTRATO (dados reais)

```
Composição R$/metro (com BDI 25%):
  Escavação: R$ 145/m | Tubo ESG: R$ 240/m | Tubo AG: R$ 95/m
  PV/Caixas: R$ 120/m | Reaterro: R$ 80/m | Ramal: R$ 65/m
  Pavimentação: R$ 45/m | Sinalização: R$ 15/m
  SUBTOTAL: R$ 805/m + BDI 25% = ~R$ 910/m

Preços unitários:
  PVC DN200: R$200.12/m | PVC DN300: R$310/m | PV concreto: R$3.686/un
  PEAD DN63: R$85/m | PEAD DN110: R$101.80/m | PEAD DN160: R$145/m

Manning n: PVC=0.013, PEAD=0.011, Concreto=0.015
Morfologia: Planície=30 m/dia, Encosta=20, Morro=12, Mangue=7, Viela=14
Vida útil: PVC=50a (3.2 kgCO2/m), PEAD=100a (2.8), Concreto=80a (12.5)
UARL: Rede=18 L/km/dia/mca, Conexão=0.8, Ramal=25

ML: Produção=366 lig/mês, Meta=1044, Ciclo=76d, Feature #1=rolling_3 (0.50)
Total contrato: R$ 46.2M, 25.383 ligações, ~50.766m de rede
```

---

## REDES PROCESSADAS (39 km, 836 NS, 0 erros)

```
Pantanal Baixo    ESG  165 PVs  137 tr   ~7.700m  137 NS  ✅
Verde e Teteu     ESG  357 PVs  180 tr    2.621m  180 NS  ✅
São Manoel        ESG   20 PVs   16 tr    1.275m   16 NS  ✅
João Carlos       ESG    — PVs    — tr        —m   OK NS  ✅
Vila Criadores    ESG    — PVs    — tr        —m   OK NS  ✅
Vila Israel       ESG    — PVs    — tr        —m   OK NS  ✅
Pantanal          AG   348 PVs  372 tr    6.986m    — NS  ✅
Criadores         AG   122 PVs  130 tr    4.138m    — NS  ✅
Teteu             AG   337 PVs  346 tr    4.813m    — NS  ✅
Israel            AG   812 PVs  861 tr   11.509m    — NS  ✅
Prol.Teteu Alt-01 XML  147 PVs  141 tr    6.363m  141 NS  ✅
Prol.Teteu        XML  149 PVs  143 tr    6.420m  143 NS  ✅
Prol.Pantanal     XML   29 PVs   25 tr    1.261m   25 NS  ✅
Prol.Criadores    XML   76 PVs   70 tr    2.689m   70 NS  ✅
Prol.São Manoel   XML   91 PVs   79 tr    5.143m   79 NS  ✅
                                TOTAL:   ~39 km   836 NS  0 erros
```

---

## ARQUITETURA LLM — CAMADA OPCIONAL

```
CAMADA 1 (determinística, offline):
  motor_custo       → R$ exato (preços × ext × BDI)
  motor_parametrico → Manning exato (V, Q, τ)
  motor_perdas      → UARL exato (fórmula IWA)
  motor_lean_lps    → PPC exato (contagem)
  motor_ml          → rolling_3 (dados reais)
  motor_micro       → morfologia (cotas)

CAMADA 2 (IA opcional, internet, grátis):
  motor_gemini  → foto/PDF (Gemini Flash, 500/dia)
  motor_llm     → análise inteligente (Groq+Mistral+Cohere)

Se não configurar keys → Camada 2 não existe → plataforma funciona 100%
```

Roteamento:
```
Foto/PDF       → Gemini Flash (único multimodal free)
Consulta       → Groq Llama 3.3 70B (~0.3s)
Resumo         → Mistral Large (escrita técnica)
Perdas/Dados   → Cohere Command-R+ (bom com tabelas)
```

---

## PROBLEMAS CONHECIDOS E PENDENTES

### CORRIGIDOS nesta sessão
- ✅ JSON fraco → XLSX profissional (gerar_xlsx.py, 636 linhas)
- ✅ HTML rede sumiu → REDE_GERAL.html restaurado
- ✅ NS incompleta → NS_DESENHO + NS_SAT implementados
- ✅ LLM burra → 7 prompts especializados por módulo
- ✅ Planilha sem fórmulas → MESTRE_SLNR_V2.xlsx com fórmulas linkadas

### PENDENTES (próxima sessão)
- ⬜ **construdata_analytics.py** — XGBoost + GridSearchCV real, não simulado
  - Precisa: ler dados execução → feature engineering → treinar → gráficos
  - Gráficos: Real vs Predito (scatter), Violin por núcleo, Feature Importance
  - GridSearchCV: 108 combinações × 3 folds = 324 modelos
  - Params: n_estimators=[50,100,200], max_depth=[3,5,7], lr=[0.05,0.1,0.2], subsample=[0.8,1.0]
- ⬜ **NS completa no pipeline** — gerar_ns_desenho() e gerar_ns_sat() existem como funções
  soltas mas não estão integradas no gerar_ns.py oficial
- ⬜ **gerar_xlsx.py integrado nos motores** — as funções existem mas cada motor
  precisa chamar gerar_xlsx no final (try/except)
- ⬜ **construdata_gui.py** — funcional mas simplificado (982L vs 1.631L do doc)
- ⬜ **ARQUITETURA_BIM_5D.html** — existe mas minificado (84L vs 482L)
- ⬜ **Prompts LLM no motor_llm.py** — PROMPTS_ANALISE existe no prompt mas
  não foi implementado no código do motor_llm.py

---

## COMO CONTINUAR O DESENVOLVIMENTO

### Para o Claude Code (VS Code)

1. Copiar PACOTE_V4/ para o workspace
2. Ler este SUPERLOG inteiro
3. Executar checklist:
```
[ ] pip install geopandas pyogrio shapely scipy ezdxf pyproj numpy
[ ] pip install ifcopenshell reportlab openpyxl matplotlib seaborn
[ ] pip install xgboost scikit-learn
[ ] pip install tkintermapview contextily
[ ] pip install google-genai groq mistralai cohere
[ ] python scripts/construdata_pipeline.py VERDE_TETEU.dxf --nucleo "Verde e Teteu"
[ ] Verificar: 01_NS/ tem PDF+HTML+GeoJSON, 04_BIM/ tem .ifc
```

### Para qualquer LLM reconstruindo do zero

Ordem de construção:
1. `ler_dxf_gdal.py` — sem ele nada funciona
2. `gerar_ns.py` — valida que a leitura está correta
3. `motor_parametrico.py` — PipeNetwork é o wrapper central
4. `gerar_ifc_lod500.py` — prova que a geometria 3D funciona
5. `motor_custo.py` — preços reais do contrato
6. Demais motores em qualquer ordem
7. HTMLs depois (usam mesmos dados)
8. GUI por último (integra tudo)

### Para evolução da plataforma

Prioridades:
1. **construdata_analytics.py** — XGBoost real com GridSearchCV
2. **Interface dinâmica** — mostrar resultados conforme calcula
3. **Multi-contrato na GUI** — seletor de contrato em todas as abas
4. **NS_DESENHO no pipeline** — gerar 5 arquivos por trecho automaticamente
5. **MESTRE_SLNR auto-update** — script que lê DXFs e atualiza a planilha

---

## FUNÇÕES PÚBLICAS — REFERÊNCIA RÁPIDA

```python
# LEITURA
ler_dxf_gdal(path) → (pvs, trechos, ruas, meta)
ler_dwg_aec(path) → (pvs, trechos, meta)
ler_landxml(path) → (pvs, trechos, ruas, meta)

# PARAMÉTRICO
PipeNetwork(pvs, trechos)
  .mover_pv(nome, x, y)      → recalcula ext/decl/Manning/custo
  .alterar_cota(nome, ct, cf) → recalcula prof/decl
  .alterar_dn(idx, dn)        → recalcula Manning
  .trechos_com_alerta()        → [{trecho, alerta}]
  .exportar()                  → {"pvs":{}, "trechos":[]}

# GERADORES
gerar_ns_a4(ns_id, tr, pvs, nucleo, path) → PDF
gerar_ns_desenho(ns_id, tr, pvs, nucleo, path) → PDF A3
gerar_ns_sat(ns_id, tr, pvs, nucleo, path) → PDF A3 sat
gerar_geojson(trechos, pvs, path) → GeoJSON
gerar_landxml(pvs, trechos, nucleo, path) → XML
gerar_ifc_lod500(pvs, trechos, nucleo, dir) → [ifc, csv, json]
gerar_project_xml(pvs, trechos, nucleo, dir) → XML
gerar_tudo(nucleos, data, dir) → (wbs, paths)  # 4 formatos crono
gerar_pdf_perdas(relatorio, path, nucleo) → PDF

# XLSX
gerar_xlsx_lean(rel, pvs, trechos, nucleo, path) → xlsx 5 abas
gerar_xlsx_curva_s(trechos, nucleo, path) → xlsx gráfico
gerar_xlsx_microplan(mp, pvs, trechos, nucleo, path) → xlsx 3 abas
gerar_xlsx_custos(pvs, trechos, nucleo, path) → xlsx 2 abas
gerar_xlsx_hidraulica(trechos, pvs, nucleo, path) → xlsx
gerar_xlsx_perdas(relatorio, nucleo, path) → xlsx 2 abas

# MOTORES
custo_trecho(tr, pvs) → {itens, total, custo_por_metro}
custo_nucleo(pvs, trechos) → {total, resumo_servicos}
gerar_relatorio_ml(dados, saldo) → {previsao, cenarios, gargalos}
gerar_relatorio_lean_lps(pvs, trechos, nucleo) → {lean, lps, bim_6d}
micro_planejar_nucleo(pvs, trechos, nucleo, eq_max) → {por_morfologia}
gerar_relatorio_perdas(pvs, trechos, nucleo, pressao) → {uarl, ili, risco}
balanco_hidrico(prod, macro, micro) → {nrw, perdas_reais, perdas_aparentes}

# CONTRATOS
criar_contrato(nome, numero, cidade, estado) → contrato
ativar_contrato(slug) → slug
listar_contratos() → [{slug, nome, cidade}]
criar_nucleo(nome) → dir
salvar_rede_nucleo(pvs, trechos, nome) → dir
carregar_rede_nucleo(nome) → (pvs, trechos)

# LLM
analisar_foto(path) → {material, dn, legenda}
ler_pdf(path) → {pvs, trechos}
consultar(pergunta, contexto) → texto
resumo_executivo(contexto) → texto
chamar(modulo, prompt, **kwargs) → texto
setup() → configura 4 keys
```

---

## XGBOOST — O QUE FOI FEITO E O QUE FALTA

### Feito (motor_ml.py — simulação)
- Rolling average com janela 3 dias
- Pipeline 11 etapas com gargalos identificados
- 5 cenários de aceleração
- Feature importance hardcoded (lig_total_r3=0.311)

### Falta (construdata_analytics.py — real)
```python
# PRECISA IMPLEMENTAR:
from xgboost import XGBRegressor
from sklearn.model_selection import GridSearchCV, cross_val_score
import seaborn as sns

# 1. Feature engineering dos dados reais
features = ['lig_total_r3', 'rede_acum', 'rede_total_r7', 'rede_total_r3',
            'lig_total_r7', 'pvs_r3', 'pre_r3', 'equipe_count',
            'dia_semana', 'mes', 'nucleo_enc']

# 2. GridSearchCV real
param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [3, 5, 7],
    'learning_rate': [0.05, 0.1, 0.2],
    'subsample': [0.8, 1.0]
}
# = 108 combinações × 3 folds = 324 modelos

# 3. Gráficos (matplotlib + seaborn)
# - Real vs Predito (scatter + linha perfeita)
# - Feature Importance (barras horizontais)
# - Distribuição lig/dia por núcleo (violin plot)
# - Tendência semanal (line plot com banda)

# 4. XLSX resultado com fórmulas
# - Aba MODELO: R², params, features
# - Aba PREDIÇÃO: real vs predito por dia
# - Aba CENÁRIOS: 5 cenários com custo/mês
# - Aba PIPELINE: 11 etapas com gargalos
```

---

## REGRAS INVIOLÁVEIS

1. Empresa: **FCN Construções e Saneamento** (NUNCA FCN)
2. Plataforma: **ConstruData - HydroNetwork**
3. Custos do **CONTRATO** (R$910/m), não SINAPI genérico
4. Medição por **Nota de Serviço** (1 NS = 1 trecho)
5. Sempre **água + esgoto**, nunca só um
6. CRS: **EPSG:31983** (SIRGAS 2000 UTM 23S)
7. Cadastro NTS 292 = **condição para pagamento** (contrato p.64)
8. CT pode ser **negativo** (Santos abaixo do nível do mar)
9. CF > CT = possível rede aérea (aviso, não rejeitar)
10. Formato **pvs + trechos** é sagrado — não alterar
11. LLMs são **camada opcional** — motores são determinísticos
12. Output = **JSON + XLSX** (JSON pra máquina, XLSX pra gente)
13. Respostas da IA são **SUGESTÕES** — engenheiro decide

---

## DEPENDÊNCIAS

```bash
# Core
pip install geopandas pyogrio shapely scipy ezdxf pyproj numpy

# BIM
pip install ifcopenshell

# Relatórios
pip install reportlab openpyxl matplotlib seaborn

# ML
pip install xgboost scikit-learn

# GUI
pip install tkintermapview contextily

# LLM (opcional)
pip install google-genai groq mistralai cohere
```

---

*SUPERLOG gerado em 23/03/2026 · ConstruData HydroNetwork V4*
*7 sessões · 22 scripts · 7 HTML · 1 GUI · ~14.000 linhas*
*FCN Construções e Saneamento · CT 11481051 · SE LIGA NA REDE · Santos/SP*
