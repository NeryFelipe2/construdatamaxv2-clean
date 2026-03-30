# ConstruData HydroNetwork — Plataforma Completa V2
## Guia Definitivo para Claude Code / VS Code
### CT 11481051 · SE LIGA NA REDE · SABESP Santos/SP
### FCN Construções e Saneamento · Março 2026

---

> ⛔ **REGRA ABSOLUTA:** NUNCA usar "DGS Engenharia" em NENHUM arquivo, output, variável, comentário ou interface.
> Empresa: **FCN Construções e Saneamento** · Plataforma: **ConstruData - HydroNetwork**

---

## INSTRUÇÕES PARA O CLAUDE CODE

Você está recebendo a plataforma completa ConstruData HydroNetwork.
São **20 scripts Python + 6 HTML + 1 GUI desktop** que formam um sistema BIM 6D
para construção de redes de água e esgoto.

**Sua missão:** Montar, integrar e evoluir esta plataforma no VS Code do usuário.

**Localização dos arquivos:**
```
C:\Users\felip\Downloads\NOVA NS Versao 5\
```

**Antes de qualquer coisa:**
1. Leia este documento INTEIRO
2. Entenda a arquitetura (Seção 2)
3. Verifique quais arquivos existem no disco (Seção 3)
4. Complete o que estiver faltando usando o código de referência (Seção 4-10)
5. Integre os LLMs (Seção 11)
6. Teste o pipeline completo (Seção 12)

---

## 1. O QUE É A PLATAFORMA

Sistema BIM 6D completo para redes de água e esgoto. Faz:

```
DXF/DWG/LandXML/PDF → pvs + trechos → NS · Civil3D · IFC · Cronograma · Medição · Perdas
```

**Números verificados:**
- 20 scripts Python (7.851 linhas)
- 6 interfaces HTML (3.875 linhas)
- 1 GUI desktop Tkinter (1.497 linhas, feita em sessão anterior)
- Total: ~13.223 linhas de código
- 39 km de rede processada, 836 NS geradas com 0 erros
- Dados reais de 20 planilhas Excel do contrato integrados
- 4 LLMs gratuitos integrados (Gemini, Groq, Mistral, Cohere)

---

## 2. ARQUITETURA — COMO TUDO SE CONECTA

```
╔═══════════════════════════════════════════════════════════════════════╗
║                         ENTRADAS (qualquer uma)                      ║
╠═══════════════╦═══════════════╦═══════════════╦═══════════════════════╣
║ 📁 DXF        ║ 📁 DWG        ║ 📁 LandXML   ║ 📁 PDF  ║ 🖱️ Editor ║
║ ProSaneamento ║ Civil 3D      ║ Export C3D   ║ Gemini  ║ HTML       ║
║ ler_dxf_      ║ ler_dwg_      ║ ler_land     ║ motor_  ║ construdata║
║ gdal.py       ║ aec.py        ║ xml.py       ║ llm.py  ║ _editor   ║
╚═══════╦═══════╩═══════╦═══════╩═══════╦══════╩═══╦═════╩═══════╦═══╝
        │               │               │          │             │
        ▼               ▼               ▼          ▼             ▼
╔═══════════════════════════════════════════════════════════════════════╗
║               FORMATO INTERNO ÚNICO (pvs + trechos)                  ║
║                                                                       ║
║  pvs = { "PV01": {x, y, ct, cf, tipo, material_pv} }                ║
║  trechos = [ {pv_ini, pv_fim, dn_mm, ext_m, decl_mm, material} ]    ║
║                                                                       ║
║  TUDO gira em torno desse formato. Todos os módulos lêem e geram.    ║
╚═══════════════════════════╦═══════════════════════════════════════════╝
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
╔═══════════════╗ ╔═════════════════╗ ╔═════════════════════╗
║ PARAMÉTRICO   ║ ║  GERADORES (8)  ║ ║  MOTORES (9)        ║
║ PipeNetwork   ║ ║  NS             ║ ║  Custo (R$910/m)    ║
║ mover PV →    ║ ║  Civil 3D       ║ ║  Medição (NS→BM)    ║
║ recalcula     ║ ║  Cadastro NTS   ║ ║  ML (XGBoost)       ║
║ TUDO em       ║ ║  IFC LOD 500    ║ ║  Lean + LPS         ║
║ cascata       ║ ║  Project XML    ║ ║  Micro-Planejamento ║
║               ║ ║  Crono Macro    ║ ║  Perdas (IWA)       ║
║               ║ ║  PDF Perdas     ║ ║  Gemini (IA)        ║
║               ║ ║  Pipeline       ║ ║  Multi-LLM          ║
╚═══════════════╝ ╚═════════════════╝ ╚═════════════════════╝
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
╔═══════════════════════════════════════════════════════════════════════╗
║                    INTERFACES (6 HTML + 1 GUI)                       ║
╠════════════════╦════════════════╦════════════════╦════════════════════╣
║ Editor EPANET  ║ Viewer 3D      ║ Controle Obra  ║ RDO Diário       ║
║ (Leaflet)      ║ (Three.js)     ║ (As-Built+BM)  ║ (NS+fotos+custo) ║
╠════════════════╬════════════════╬════════════════╬════════════════════╣
║ Perdas Água    ║ Fluxograma     ║ GUI Desktop    ║                   ║
║ (IWA+ILI+DMA)  ║ (BIM 5D)       ║ (Tkinter 11ab) ║                   ║
╚════════════════╩════════════════╩════════════════╩════════════════════╝
```

---

## 3. INVENTÁRIO COMPLETO DOS ARQUIVOS

### 3.1 LEITORES (entrada → pvs + trechos)

| # | Arquivo | Linhas | Função | Retorno |
|---|---------|--------|--------|---------|
| 1 | `ler_dxf_gdal.py` | 395 | Lê DXF ProSaneamento. GDAL+scipy clustering. Auto-naming junctions grau≥2. Água+Esgoto. | `(pvs, trechos, ruas, meta)` |
| 2 | `ler_dwg_aec.py` | 316 | Lê DWG Civil 3D. Converte via libredwg. Parseia labels PV. Reconstrói topologia por nomes. | `(pvs, trechos, meta)` |
| 3 | `ler_landxml.py` | 155 | Lê LandXML 1.2 exportado do Civil 3D. Parseia Structures + Pipes direto. | `(pvs, trechos, ruas, meta)` |

### 3.2 GERADORES (pvs + trechos → saídas)

| # | Arquivo | Linhas | Gera | Formatos |
|---|---------|--------|------|----------|
| 4 | `gerar_ns.py` | 544 | Notas de Serviço campo | PDF A4, JSON, HTML Leaflet, GeoJSON |
| 5 | `gerar_civil3d.py` | 803 | Pacote Civil 3D | LandXML, DXF cadastro, Dynamo .py, AutoCAD .scr, JSON |
| 6 | `gerar_cadastro_nts292.py` | 458 | Cadastro as-built SABESP | DXF georref SIRGAS 2000 UTM 23S + Meta JSON |
| 7 | `gerar_ifc_lod500.py` | 184 | IFC 3D real LOD 500 | IFC 2x3 (SweptDiskSolid + ExtrudedAreaSolid) + CSV + JSON |
| 8 | `gerar_project_xml.py` | 276 | Cronograma 1 núcleo | MS Project XML com WBS 12 fases |
| 9 | `gerar_cronograma_macro.py` | 414 | Cronograma multinúcleo | MS Project XML + Primavera P6 XER + OpenProject CSV + JSON |
| 10 | `gerar_pdf_perdas.py` | 314 | Relatório PDF perdas | PDF A4 (reportlab) com UARL, ILI, balanço, risco |
| 11 | `construdata_pipeline.py` | 203 | Orquestrador | Detecta formato → roda tudo → pasta com 5 subdirs |

### 3.3 MOTORES DE CÁLCULO

| # | Arquivo | Linhas | Função |
|---|---------|--------|--------|
| 12 | `motor_custo.py` | 297 | Preços reais contrato R$910/m. 20 materiais. Composição 8 itens + BDI 25%. Gera BM. |
| 13 | `motor_medicao.py` | 269 | Lê Execução_Geral.xlsx (521 dias × 6 núcleos). Resumo. Curva S. BM formal. |
| 14 | `motor_ml.py` | 247 | XGBoost rolling_3. Pipeline 11 etapas. 5 cenários aceleração. Predição produção. |
| 15 | `motor_lean_lps.py` | 475 | Lean (Takt, VSM). LPS (WWP, PPC, Lookahead 6sem, Pareto). BIM 6D (vida útil, CO2). |
| 16 | `motor_parametrico.py` | 318 | Classe PipeNetwork. Mover PV → recalcula ext/decl/Manning/custo em cascata. Alertas. |
| 17 | `motor_microplanejamento.py` | 465 | Morfologia terreno (5 tipos). Equipe/equipamento por frente. Material JIT. Produtividade. |
| 18 | `motor_perdas.py` | 611 | IWA (balanço hídrico). UARL + ILI. Risco ruptura por trecho. DMAs. Trocar vs manter. |
| 19 | `motor_gemini.py` | 562 | Gemini API direto. Foto→análise. PDF→pvs+trechos. Assistente. Resumo executivo. |
| 20 | `motor_llm.py` | 545 | Roteador multi-LLM. 1 modelo gratuito por módulo. Fallback automático. |

### 3.4 INTERFACES HTML

| # | Arquivo | Linhas | Função |
|---|---------|--------|--------|
| 21 | `construdata_editor.html` | 1.054 | Editor rede estilo EPANET. Leaflet. Toolbar. 4 abas (Props/NS/Cadastro/Custo). Atalhos teclado. |
| 22 | `construdata_manage.html` | 310 | Viewer 3D (Three.js). 5 modos: 3D/Custo/Hidráulica/DN/Timeline 4D. Z exaggeration. |
| 23 | `construdata_controle.html` | 576 | Controle obra. 4 abas: As-Built/Medição BM/Curva S/Resumo 5D. Tabela editável 180+ NS. |
| 24 | `construdata_rdo.html` | 892 | RDO diário. NS vinculadas + serviços/custos + ocorrências + fotos + equipe + clima + PDF. |
| 25 | `construdata_perdas.html` | 524 | Gestão perdas IWA. 6 abas: Balanço/UARL+ILI/Risco/DMAs/Economia/Dados. Gauge + Sankey. |
| 26 | `FLUXOGRAMA_BIM_5D.html` | 519 | Fluxograma visual do pipeline. 7 fases. Blocos clicáveis. |

### 3.5 GUI DESKTOP (de sessão anterior — verificar se existe no disco)

| # | Arquivo | Linhas | Função |
|---|---------|--------|--------|
| 27 | `construdata_gui.py` | 1.497 | GUI Tkinter 11 abas: Processar, Mapa, Rede, Hidráulica, Trechos, Custos5D, BIM/Civil3D, Lean/LPS, Perdas, Núcleos, Log |

### 3.6 DADOS DO CONTRATO (extraídos de 20 planilhas Excel)

| Arquivo | Conteúdo |
|---------|----------|
| `DADOS_CONTRATO.json` | 20 materiais + preços + composição R$/m + fatores + saldo por núcleo |
| `EXECUCAO_DIARIA.json` | 521 dias × 6 núcleos (equipe, rua, ligações água/esgoto) |
| `ML_DATA.json` | XGBoost features + pipeline 11 etapas + 4 cenários + micro-cronograma |

### 3.7 CRONOGRAMA (4 formatos gerados)

| Arquivo | Formato | Abre em |
|---------|---------|---------|
| `CRONOGRAMA_MACRO_SLNR.xml` | MS Project XML | MS Project 2016+ |
| `CRONOGRAMA_MACRO_SLNR.xer` | Primavera P6 XER | Oracle Primavera |
| `CRONOGRAMA_MACRO_SLNR.csv` | OpenProject CSV | OpenProject |
| `CRONOGRAMA_MACRO_SLNR.json` | JSON dados | Qualquer sistema |

### 3.8 OUTROS

| Arquivo | Função |
|---------|--------|
| `AeccCatCfg.xml` | Catálogos SABESP PVC+PEAD+PV para Civil 3D |
| `ABRIR.bat` | Launcher Windows (duplo clique) |
| `EXPORTAR_PIPE_NETWORKS.bat` | Script Civil 3D → LandXML |
| `VERDE_TETEU_3D.ifc` | IFC exemplo (887KB, geometria 3D real) |
| `RELATORIO_PERDAS_VERDE_TETEU.pdf` | PDF relatório perdas (exemplo gerado) |

---

## 4. FORMATO INTERNO — NÃO ALTERAR

```python
# Todos os módulos lêem e geram esse formato.
# Qualquer GUI, API ou export parte daqui.

pvs = {
    "PV01": {
        "x": 362293.456,       # Easting UTM SIRGAS 2000 23S (EPSG:31983)
        "y": 7352565.123,      # Northing
        "ct": 5.20,            # Cota Terreno (m) — pode ser negativo em Santos
        "cf": 3.70,            # Cota Fundo (m)
        "tipo": "esgoto",      # "esgoto" | "agua"
        "material_pv": "CONCRETO",  # CONCRETO | PEAD | FFD
    },
}

trechos = [
    {
        "pv_ini": "PV01",      # PV montante (nome exato da key no dict pvs)
        "pv_fim": "PV02",      # PV jusante
        "dn_mm": 200,          # Diâmetro nominal (mm): ESG 100-600, AG 32-315
        "ext_m": 14.5,         # Extensão (m) — calculada pela distância X,Y
        "decl_mm": 8.5,        # Declividade (‰) — calculada por (CF_ini - CF_fim) / ext
        "material": "PVC",     # PVC | PEAD | PE 80 | PE 100 | CONCRETO
        "tipo": "esgoto",      # "esgoto" | "agua"
    },
]
```

---

## 5. CONSTANTES DO CONTRATO

```python
# Composição R$/metro (R$ 910/m com BDI) — DADOS REAIS
COMPOSICAO = {
    "escavacao": 145, "tubo_esg": 240, "tubo_ag": 95,
    "pv_caixas": 120, "reaterro": 80, "ramal": 65,
    "pavimentacao": 45, "sinalizacao": 15,
}  # Subtotal R$ 805 + BDI 25% = R$ ~910/m
BDI = 0.25

# Preços unitários (MESTRE_SLNR_FINALxxx1.xlsx → aba CUSTOS)
"Tubo PVC DN200": 200.12    "Tubo PVC DN300": 310.00
"PV concreto":    3686.00   "PI plástico":    1412.00
"PEAD DN63":      85.00     "PEAD DN110":     101.80
"PEAD PE80 DN160":145.00    "Areia": 160/m³   "CBUQ def": 120/m²

# Manning n
PVC = 0.013    PEAD = 0.011    PE80/100 = 0.011    Concreto = 0.015

# Morfologia produtividade (m/dia/equipe)
Planície = 30    Encosta = 20    Morro = 12    Mangue = 7    Viela = 14

# Vida útil BIM 6D
PVC = 50 anos (3.2 kg CO2/m)    PEAD = 100 anos (2.8 kg CO2/m)
Concreto = 80 anos (12.5 kg CO2/m)    FFD = 100 anos (18 kg CO2/m)

# UARL IWA
Rede = 18 L/km/dia/mca    Conexão = 0.8 L/un/dia/mca    Ramal = 25 L/km/dia/mca

# ML (dados reais)
Produção atual = 366 lig/mês    Meta 2X = 733    Meta SABESP = 1000+
Metros/ligação = 6.1    Ciclo atual = 76 dias    Meta 2X = 40 dias
Equipes ativas = 6    Feature principal = lig_rolling_3 (0.50)
```

---

## 6. REDES PROCESSADAS E VALIDADAS

| Rede | Tipo | PVs | Trechos | Extensão | NS | Erros |
|------|------|-----|---------|----------|-----|-------|
| Pantanal Baixo | Esgoto | 165 | 137 | ~7.700m | 137 | 0 |
| Verde e Teteu | Esgoto | 357 | 180 | 2.621m | 180 | 0 |
| Vila Criadores | Esgoto | — | — | — | OK | 0 |
| São Manoel | Esgoto | 20 | 16 | 1.275m | 16 | 0 |
| Vila Israel | Esgoto | — | — | — | OK | 0 |
| João Carlos | Esgoto | — | — | — | OK | 0 |
| Pantanal | Água | 348 | 372 | 6.986m | — | 0 |
| Criadores | Água | 122 | 130 | 4.138m | — | 0 |
| Teteu | Água | 337 | 346 | 4.813m | — | 0 |
| Israel | Água | 812 | 861 | 11.509m | — | 0 |
| Prol. Teteu Alt-01 | XML | 147 | 141 | 6.363m | 141 | 0 |
| Prol. Teteu | XML | 149 | 143 | 6.420m | 143 | 0 |
| Prol. Pantanal | XML | 29 | 25 | 1.261m | 25 | 0 |
| Prol. Criadores | XML | 76 | 70 | 2.689m | 70 | 0 |
| Prol. São Manoel | XML | 91 | 79 | 5.143m | 79 | 0 |
| **TOTAL** | | **2.302+** | **2.094+** | **~39 km** | **836** | **0** |

Saldo faltante por núcleo (MESTRE_SLNR):
- SM+JC: 5.759m (AG)
- Vila Israel: 1.925m (ESG+AG)
- Morro do Tetéu: 8.693m (ESG+AG)
- Vila Criadores: 2.633m (ESG)
- Pantanal Baixo: 6.720m (ESG+AG)

---

## 7. COMO CADA MÓDULO CHAMA CADA MÓDULO

### Pipeline completo (1 comando):
```python
python construdata_pipeline.py NUCLEO.dxf --nucleo "Nome" --saida ./saida/
```

### Manual (controle total):
```python
# 1. LER
from ler_dxf_gdal import ler_dxf_gdal
pvs, trechos, ruas, meta = ler_dxf_gdal("NUCLEO.dxf")

# 2. REDE PARAMÉTRICA (opcional — wrapper com recálculo)
from motor_parametrico import PipeNetwork
rede = PipeNetwork(pvs, trechos)
rede.mover_pv("PV01", x+10, y)  # → recalcula TUDO conectado
rede.alterar_dn(0, 300)          # → Manning recalcula
data = rede.exportar()            # → JSON padrão

# 3. GERAR NS
from gerar_ns import gerar_ns_a4, gerar_geojson, enriquecer_trechos
trechos_enr = enriquecer_trechos(trechos, pvs)
for i, tr in enumerate(trechos_enr):
    gerar_ns_a4(i+1, tr, pvs, "Núcleo", f"NS_{i+1:03d}.pdf")
gerar_geojson(trechos_enr, pvs, "rede.geojson")

# 4. GERAR CIVIL 3D
from gerar_civil3d import gerar_landxml, gerar_cadastro_dxf, gerar_dynamo_script, gerar_autocad_scr
gerar_landxml(pvs, trechos, "Núcleo", "esgoto.xml")

# 5. GERAR CADASTRO NTS 292
from gerar_cadastro_nts292 import gerar_cadastro_nts292
gerar_cadastro_nts292(pvs, trechos, "Núcleo", "./cadastro/")

# 6. GERAR IFC LOD 500 (geometria 3D real)
from gerar_ifc_lod500 import gerar_ifc_lod500
gerar_ifc_lod500(pvs, trechos, "Núcleo", "./ifc/")

# 7. CRONOGRAMA MACRO (6 núcleos, 4 formatos)
from gerar_cronograma_macro import gerar_tudo
nucleos = [{"nome":"Verde e Teteu","extensao_m":2621,"n_trechos":180,"equipes":3}, ...]
wbs, paths = gerar_tudo(nucleos, "2026-04-01", "./crono/")

# 8. CUSTO (preços reais do contrato)
from motor_custo import custo_trecho, custo_nucleo, gerar_bm
c = custo_trecho(trechos[0], pvs)      # 8 itens + BDI
cn = custo_nucleo(pvs, trechos)         # total do núcleo

# 9. MEDIÇÃO (execução real)
from motor_medicao import carregar_execucao_xlsx, gerar_resumo_execucao, gerar_curva_s
dados = carregar_execucao_xlsx("Execução_Geral.xlsx")
curva = gerar_curva_s(trechos, dados)

# 10. ML (predição)
from motor_ml import gerar_relatorio_ml
rel = gerar_relatorio_ml(dados, saldo_total_m=25730)

# 11. LEAN + LPS + 6D
from motor_lean_lps import gerar_relatorio_lean_lps, criar_weekly_work_plan, calcular_ppc
rel = gerar_relatorio_lean_lps(pvs, trechos, nucleo="Núcleo")

# 12. MICRO-PLANEJAMENTO (morfologia)
from motor_microplanejamento import micro_planejar_nucleo
mp = micro_planejar_nucleo(pvs, trechos, "Núcleo", equipes_max=4)

# 13. PERDAS (IWA)
from motor_perdas import gerar_relatorio_perdas
rel = gerar_relatorio_perdas(pvs, trechos, "Núcleo", vol_produzido=45000, vol_micromedido=28000)
from gerar_pdf_perdas import gerar_pdf_perdas
gerar_pdf_perdas(rel, "relatorio.pdf")

# 14. LLM (IA integrada)
from motor_llm import analisar_foto, ler_pdf, consultar, resumo_executivo
foto = analisar_foto("IMG_5282.jpg")       # → {material, DN, legenda}
dados = ler_pdf("PERFIL.pdf")               # → pvs + trechos
resp = consultar("Custo total?", contexto)   # → texto
```

---

## 8. INTERFACES HTML — DESIGN DE REFERÊNCIA

Se criar ou modificar qualquer GUI, replicar este padrão:

**Tema:** Fundo escuro `#06060f`, texto `#d0d0e8`, acento esgoto `#00ff88`, acento água `#00aaff`, acento perdas `#00b4ff`
**Fonts:** `Manrope` (display) + `JetBrains Mono` (dados/código)
**Layout Editor:** Toolbar 56px esquerda + Mapa central (Leaflet) + Painel 380px direita
**Atalhos:** P=PV, T=Tubo, V=Selecionar, M=Mover, Del=Apagar, F=Zoom, Ctrl+Z=Desfazer

---

## 9. GUI DESKTOP (construdata_gui.py) — 11 ABAS

Se o arquivo `construdata_gui.py` existir no disco, usar como está.
Se NÃO existir, criar com estas 11 abas:

| Tab | Nome | Conteúdo |
|-----|------|----------|
| 1 | PROCESSAR | Seleção arquivo + Pipeline completo + Batch |
| 2 | MAPA | Leaflet (tkintermapview) + lista trechos + validação GPKG |
| 3 | REDE | Cards PVs/Trechos/Extensão + tabela PVs |
| 4 | HIDRÁULICA | Cards OK/Verificar + tabela Manning (V, Q, τ) |
| 5 | TRECHOS | Tabela completa todos os campos |
| 6 | CUSTOS 5D | Cards custo + botões BM/CurvaS/MicroPlan/ML/CronoMacro |
| 7 | BIM/CIVIL3D | Botões geradores (IFC, LandXML, NTS292, etc) + botões HTML |
| 8 | LEAN/LPS | Cards Takt/CycleTime/PPC/CO2 + botões relatórios |
| 9 | PERDAS | Cards UARL/ILI/Risco + botões análise |
| 10 | NÚCLEOS | Tabelas DXF + Prolongamentos + Batch |
| 11 | LOG | Console com timestamps |

**Dependência GUI:** `pip install tkintermapview`

---

## 10. DEPENDÊNCIAS PYTHON

```bash
# Core (obrigatório)
pip install geopandas pyogrio shapely scipy ezdxf pyproj numpy

# IFC (modelo 3D)
pip install ifcopenshell

# PDF + relatórios
pip install reportlab openpyxl matplotlib

# GUI desktop
pip install tkintermapview contextily

# LLMs (todos gratuitos)
pip install google-genai groq mistralai cohere

# DWG (opcional — precisa compilar)
# libredwg: https://github.com/LibreDWG/libredwg
```

---

## 11. INTEGRAÇÃO DOS LLMs — 4 PROVIDERS GRATUITOS

### Setup (1 vez):
```bash
pip install google-genai groq mistralai cohere
python motor_llm.py setup
```

### API Keys (todas grátis):
| Provider | URL | Limite |
|----------|-----|--------|
| Gemini | https://aistudio.google.com/app/apikey | 500 req/dia |
| Groq | https://console.groq.com/keys | 14.400 req/dia |
| Mistral | https://console.mistral.ai/api-keys | 1M tokens/mês |
| Cohere | https://dashboard.cohere.com/api-keys | 1.000 req/mês |

### Roteamento automático (motor_llm.py decide):
| Módulo | LLM | Por quê |
|--------|-----|---------|
| Foto RDO | Gemini Flash | Único free multimodal |
| Leitura PDF | Gemini Flash | Único free que lê PDF |
| Consulta rápida | Groq Llama 3.3 70B | ~0.3s resposta |
| Resumo gerencial | Mistral Large | Escrita técnica |
| LPS/Hidráulica | Groq Llama 3.3 70B | Velocidade |
| Análise perdas | Cohere Command-R+ | Bom com dados |
| Explicação ML | Mistral Large | Raciocínio |

### Onde integrar na GUI:

**Nova aba 12: "🤖 IA"** com:
- Status dos 4 providers (verde/vermelho)
- Campo de pergunta + botão "Perguntar"
- Botões rápidos: [Resumo Executivo] [Validar Hidráulica] [Analisar Perdas] [Explicar ML] [LPS]
- Área de resposta (ScrolledText)

**Na aba RDO:** Quando adiciona foto, chamar `analisar_foto()` → preenche legenda automaticamente

**Na aba Processar:** Aceitar PDF como input via `ler_pdf()` → extrai pvs+trechos → pipeline normal

### Nos HTMLs (JavaScript direto):

```javascript
// Gemini (fotos):
fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key="+KEY, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({contents:[{parts:[{inline_data:{mime_type:"image/jpeg",data:base64}},{text:prompt}]}]})
})

// Groq (texto):
fetch("https://api.groq.com/openai/v1/chat/completions", {
    method:"POST", headers:{"Authorization":"Bearer "+KEY,"Content-Type":"application/json"},
    body: JSON.stringify({model:"llama-3.3-70b-versatile",messages:[{role:"user",content:prompt}],temperature:0.3})
})
```

### Segurança:
- Python: keys em `~/.construdata/config.json` ou `$GEMINI_API_KEY`, `$GROQ_API_KEY`, etc.
- HTML: keys em `localStorage` do navegador
- **NUNCA** hardcode no código-fonte

---

## 12. REGRAS INVIOLÁVEIS

1. Empresa: **FCN Construções e Saneamento** (NUNCA "DGS Engenharia")
2. Plataforma: **ConstruData - HydroNetwork**
3. Custos: tabela do **contrato** (R$910/m), NÃO SINAPI genérico
4. Medição: por **Nota de Serviço** (1 NS = 1 trecho)
5. Sempre **água + esgoto**, nunca só um
6. CRS: **EPSG:31983** (SIRGAS 2000 UTM 23S)
7. Cadastro NTS 292 = **condição para pagamento** (contrato pág. 64)
8. CT pode ser negativo (Santos abaixo do nível do mar)
9. CF > CT = possível rede aérea (aviso, não rejeitar)
10. Respostas da IA são **SUGESTÕES** — o engenheiro decide
11. O formato **pvs + trechos** é sagrado — não alterar a estrutura

---

## 13. CHECKLIST PARA O CLAUDE CODE

```
VERIFICAR EXISTÊNCIA:
[ ] Todos os 20 .py existem na pasta scripts/
[ ] Todos os 6 .html existem na pasta html/
[ ] construdata_gui.py existe (se não, criar com 11 abas)
[ ] dados_contrato/ tem os 3 JSON
[ ] cronograma/ tem os 4 arquivos

DEPENDÊNCIAS:
[ ] pip install geopandas pyogrio shapely scipy ezdxf pyproj numpy
[ ] pip install ifcopenshell reportlab openpyxl matplotlib
[ ] pip install tkintermapview contextily
[ ] pip install google-genai groq mistralai cohere

INTEGRAÇÃO LLM:
[ ] python motor_llm.py setup (configurar 4 keys)
[ ] python motor_llm.py test (verificar conexões)
[ ] Adicionar aba IA na GUI desktop (Tab 12)
[ ] Integrar analisar_foto() no RDO
[ ] Integrar ler_pdf() como input no pipeline
[ ] Adicionar modal de API keys nos HTMLs

TESTES:
[ ] python construdata_pipeline.py VERDE_TETEU.dxf (pipeline 7 etapas, 0 erros)
[ ] python motor_custo.py (R$ ~989/m Verde e Teteu)
[ ] python motor_perdas.py (UARL 37.262 L/dia)
[ ] python motor_microplanejamento.py (65% morro no Tetéu)
[ ] python motor_parametrico.py (mover PV recalcula)
[ ] python gerar_cronograma_macro.py (6 núcleos, 72 tarefas, 835 dias)
[ ] Abrir cada HTML no navegador e verificar funcionalidade
[ ] GUI desktop abre e todas as 11 abas funcionam
```

---

## 14. ESTRUTURA DE PASTAS RECOMENDADA

```
ConstruData_HydroNetwork/
├── scripts/                    ← 20 Python
│   ├── ler_dxf_gdal.py
│   ├── ler_dwg_aec.py
│   ├── ler_landxml.py
│   ├── gerar_ns.py
│   ├── gerar_civil3d.py
│   ├── gerar_cadastro_nts292.py
│   ├── gerar_ifc_lod500.py
│   ├── gerar_project_xml.py
│   ├── gerar_cronograma_macro.py
│   ├── gerar_pdf_perdas.py
│   ├── construdata_pipeline.py
│   ├── motor_custo.py
│   ├── motor_medicao.py
│   ├── motor_ml.py
│   ├── motor_lean_lps.py
│   ├── motor_parametrico.py
│   ├── motor_microplanejamento.py
│   ├── motor_perdas.py
│   ├── motor_gemini.py
│   └── motor_llm.py
├── html/                       ← 6 interfaces
│   ├── construdata_editor.html
│   ├── construdata_manage.html
│   ├── construdata_controle.html
│   ├── construdata_rdo.html
│   ├── construdata_perdas.html
│   └── FLUXOGRAMA_BIM_5D.html
├── gui/
│   └── construdata_gui.py      ← GUI desktop (11 abas)
├── dados_contrato/
│   ├── DADOS_CONTRATO.json
│   ├── EXECUCAO_DIARIA.json
│   └── ML_DATA.json
├── cronograma/
│   ├── CRONOGRAMA_MACRO_SLNR.xml
│   ├── CRONOGRAMA_MACRO_SLNR.xer
│   ├── CRONOGRAMA_MACRO_SLNR.csv
│   └── CRONOGRAMA_MACRO_SLNR.json
├── catalogos/
│   └── AeccCatCfg.xml
├── exemplos/
│   ├── VERDE_TETEU_3D.ifc
│   └── RELATORIO_PERDAS_VERDE_TETEU.pdf
├── bat/
│   ├── ABRIR.bat
│   └── EXPORTAR_PIPE_NETWORKS.bat
├── MANUAL_CONSTRUDATA.md
├── PROMPT_INTEGRACAO_PLATAFORMA.md
├── PROMPT_ADICIONAR_LLM.md
└── ConstruData_HydroNetwork_Plataforma_Completa_V2.md  ← ESTE DOCUMENTO
```

---

*Documento gerado em 23/03/2026*
*ConstruData - HydroNetwork v10 · 20 scripts · 6 HTML · 11.726 linhas*
*FCN Construções e Saneamento · Contrato 11481051 · SE LIGA NA REDE · Santos/SP*
