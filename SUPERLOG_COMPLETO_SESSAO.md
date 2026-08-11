# SUPERLOG COMPLETO — ConstruData HydroNetwork
# Documento unico para migrar NOVA-NS-Versao-5 → ConstruData_Project
# FCN Construcoes e Saneamento · 23/Mar/2026
# 8 sessoes · 24 scripts · 7 HTML · 1 GUI · ~16.000 linhas

---

> REGRA #1: NUNCA "FCN Construções e Saneamento" — sempre **FCN Construcoes e Saneamento**
> REGRA #2: Plataforma = **ConstruData - HydroNetwork**
> REGRA #3: Custos do CONTRATO (R$910/m), nao SINAPI generico
> REGRA #4: Formato pvs + trechos e SAGRADO — nao alterar

---

# PARTE 1 — FLUXOGRAMA GERAL DA PLATAFORMA

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                              ENTRADAS                                      ║
╠══════════╦══════════╦══════════╦══════════╦══════════╦═══════════╦═════════╣
║  .DXF    ║  .DWG    ║  .XML    ║  .JSON   ║  .PDF    ║  Mapa     ║ Foto   ║
║ ProSane  ║ Civil3D  ║ LandXML  ║ Rede     ║ Perfil   ║ (editor)  ║ (RDO)  ║
║          ║          ║          ║          ║ Gemini   ║ Leaflet   ║ Gemini ║
╠══════════╬══════════╬══════════╬══════════╬══════════╬═══════════╬═════════╣
║ ler_dxf_ ║ ler_dwg_ ║ ler_land ║ json     ║ motor_   ║ construda ║ motor_ ║
║ gdal.py  ║ aec.py   ║ xml.py   ║ .load()  ║ gemini   ║ ta_editor ║ gemini ║
║ 328L     ║ 316L     ║ 267L     ║          ║ 562L     ║ 1054L     ║        ║
╚════╦═════╩════╦═════╩════╦═════╩════╦═════╩════╦═════╩═════╦═════╩════╦═══╝
     │          │          │          │          │           │          │
     ▼          ▼          ▼          ▼          ▼           ▼          ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                    FORMATO INTERNO UNICO (pvs + trechos)                   ║
║                                                                            ║
║  pvs = {"PV01": {x, y, ct, cf, tipo, material_pv}}                        ║
║  trechos = [{pv_ini, pv_fim, dn_mm, ext_m, decl_mm, material, tipo}]      ║
║                                                                            ║
║  TODOS os modulos leem e geram esse formato. E SAGRADO.                    ║
╚══════════╦═══════════════════════╦═══════════════════════╦═════════════════╝
           │                       │                       │
     ┌─────┴─────┐          ┌─────┴─────┐          ┌─────┴─────┐
     ▼           ▼          ▼           ▼          ▼           ▼
╔═════════╗ ╔═════════╗ ╔═════════╗ ╔═════════╗ ╔═════════╗ ╔═════════╗
║PARAMET. ║ ║GERADORES║ ║ MOTORES ║ ║  LLMs   ║ ║ GESTAO  ║ ║   GUI   ║
║PipeNet  ║ ║ (9)     ║ ║ (10)    ║ ║ (4)     ║ ║CONTRATO ║ ║ 12 tabs ║
║mover PV ║ ║NS       ║ ║Custo    ║ ║Gemini   ║ ║multi-ct ║ ║Tkinter  ║
║→recalc  ║ ║Civil3D  ║ ║Medicao  ║ ║Groq     ║ ║precos   ║ ║+7 HTML  ║
║TUDO     ║ ║NTS292   ║ ║ML       ║ ║Mistral  ║ ║nucleos  ║ ║         ║
║cascata  ║ ║IFC      ║ ║Lean/LPS ║ ║Cohere   ║ ║CRS auto ║ ║         ║
║         ║ ║Project  ║ ║MicroPlan║ ║         ║ ║18 UFs   ║ ║         ║
║         ║ ║CronoMac ║ ║Perdas   ║ ║         ║ ║         ║ ║         ║
║         ║ ║PdfPerd  ║ ║Gemini   ║ ║         ║ ║         ║ ║         ║
║         ║ ║XLSX(6)  ║ ║LLM      ║ ║         ║ ║         ║ ║         ║
║         ║ ║Pipeline ║ ║Contratos║ ║         ║ ║         ║ ║         ║
╚═════════╝ ╚════╦════╝ ╚════╦════╝ ╚════╦════╝ ╚════╦════╝ ╚════╦════╝
                 │           │           │           │           │
                 ▼           ▼           ▼           ▼           ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                              SAIDAS (18+ formatos)                         ║
╠═══════════╦═══════════╦═══════════╦═══════════╦═══════════╦════════════════╣
║ PDF A4    ║ LandXML   ║ IFC 2x3   ║ MS Project║ PDF       ║ XLSX          ║
║ NS campo  ║ Civil 3D  ║ LOD 500   ║ XML       ║ Perdas    ║ 6 planilhas   ║
║ PDF A3    ║ DXF       ║ CSV       ║ P6 XER    ║ BM        ║ profissionais ║
║ DESENHO   ║ NTS 292   ║ LOD 500   ║ Primavera ║ Medicao   ║ com graficos  ║
║ PDF A3    ║ Dynamo.py ║ JSON BIM  ║ CSV       ║ Curva S   ║               ║
║ SATELITE  ║ .SCR      ║ 5D        ║ OpenProj  ║ Lookahead ║ GeoJSON       ║
║ HTML      ║ AutoCAD   ║           ║ JSON      ║ 6 semanas ║ ZIP export    ║
║ Leaflet   ║           ║           ║           ║           ║               ║
╚═══════════╩═══════════╩═══════════╩═══════════╩═══════════╩════════════════╝
```

---

# PARTE 2 — FLUXOGRAMA DO PIPELINE (6 ETAPAS)

```
ARQUIVO (DXF/XML/DWG/JSON/PDF)
    │
    ▼
┌──────────────────────────────────┐
│ ETAPA 1: LEITURA                 │
│ .dxf → ler_dxf_gdal()           │  GDAL + scipy clustering
│ .xml → ler_landxml()            │  ElementTree direto
│ .dwg → ler_dwg_aec()           │  libredwg → DXF → parse
│ .json → json.load()             │  Formato interno
│ .pdf → motor_gemini.ler_pdf()   │  Gemini Flash vision
│ SAIDA: pvs + trechos + ruas     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 2: NS (5 arquivos/trecho) │
│ gerar_ns.py                      │
│ → PDF A4 (texto)                │
│ → PDF A3 DESENHO (planta+perfil)│
│ → PDF A3 SAT (satelite+perfil)  │
│ → HTML Leaflet                  │
│ → JSON dados                    │
│ + REDE_GERAL.html + GeoJSON     │
│ SAIDA: 01_NS/                   │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 3: CIVIL 3D                │
│ → LandXML 1.2 (.xml)           │
│ → Cadastro DXF (A4/rua)        │
│ → Dynamo Script (.py)           │
│ → AutoCAD Script (.scr)         │
│ → JSON dados                    │
│ SAIDA: 02_CIVIL3D/              │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 4: CADASTRO NTS 292        │
│ → DXF georref 17 layers SIGNOS │
│ → Perfil H:500 V:100           │
│ → Carimbo NTS 116 SABESP       │
│ → Grade UTM cada 100m          │
│ SAIDA: 03_CADASTRO_NTS292/      │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 5: BIM LOD 500             │
│ Tubos: IfcSweptDiskSolid        │
│ PVs: IfcExtrudedAreaSolid       │
│ 4 PropertySets por elemento     │
│ SAIDA: 04_BIM_LOD500/ (.ifc)   │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 6: CRONOGRAMA + XLSX       │
│ → MS Project XML (12 fases WBS) │
│ → 6 XLSX profissionais          │
│   (custos, hidraulica, curva_s, │
│    lean, microplan, perdas)     │
│ SAIDA: 05_CRONOGRAMA/ + 06_XLSX/│
└──────────────────────────────────┘
```

---

# PARTE 3 — INVENTARIO COMPLETO (24 scripts)

## 3.1 LEITORES (3)

| Arquivo | Linhas | Funcao principal | Retorno |
|---------|--------|------------------|---------|
| `ler_dxf_gdal.py` | 328 | `ler_dxf_gdal(path)` | (pvs, trechos, ruas, meta) |
| `ler_landxml.py` | 267 | `ler_landxml(path)` | (pvs, trechos, ruas, meta) |
| `ler_dwg_aec.py` | 316 | `ler_dwg_aec(path)` | (pvs, trechos, meta) |

**ler_dxf_gdal.py — Funcoes:**
- `_log(msg, nivel)` L39 — Log com timestamp
- `_parse_dn(txt)` L45 — Extrai DN de texto "200mm" ou "DN200"
- `_parse_incl(txt)` L53 — Extrai declividade "0.008 m/m" ou "0.8%"
- `_nearest_text(mx, my, xy_arr, txt_arr, max_d)` L61 — Texto mais proximo
- `_agrupar_textos_pv(pv_data)` L68 — Agrupa PV+CT+CF por proximidade
- `ler_dxf_gdal(dxf_path)` L110 — PRINCIPAL: GDAL + scipy.fclusterdata(t=2m)

**Fluxo do ler_dxf_gdal:**
1. geopandas.read_file(dxf) → GeoDataFrame
2. Filtra layers TUBO_* (exclui PS_, DETALHE, PERFIL, BIFILAR)
3. Endpoints de cada tubo → numpy array
4. fclusterdata(endpoints, t=2.0) → clusters = PVs reais
5. Match texto PS_PONTOS → nomes + CT/CF
6. Conectividade: tubo[i] liga cluster[2i] → cluster[2i+1]
7. Dedup bidirecional: tuple(sorted([pv_ini, pv_fim]))

**ler_landxml.py — Funcoes:**
- `ler_landxml(xml_path)` L26 — Parseia Struct(PVs) + Pipe(trechos)

**ler_dwg_aec.py — Funcoes:**
- `_converter_dwg_para_dxf(dwg_path)` L38 — libredwg subprocess
- `_extrair_pvs_de_dxf(dxf_path)` L69 — Parse textos PV/CT/CF
- `_reconstruir_rede(pvs, dn_padrao, max_ext)` L156 — Topologia por nomes
- `ler_dwg_aec(path, dn_padrao)` L227 — PRINCIPAL

---

## 3.2 GERADORES (9)

| Arquivo | Linhas | O que gera |
|---------|--------|------------|
| `gerar_ns.py` | 654 | PDF A4 + A3 DESENHO + A3 SAT + HTML + JSON + GeoJSON |
| `gerar_civil3d.py` | 312 | LandXML + DXF Cadastro + Dynamo .py + .scr + JSON |
| `gerar_cadastro_nts292.py` | 458 | DXF georref SIRGAS 2000 UTM 23S + Meta JSON |
| `gerar_ifc_lod500.py` | 184 | IFC 2x3 SweptDiskSolid + 4 PropertySets + CSV + JSON |
| `gerar_project_xml.py` | 276 | MS Project XML, WBS 12 fases, 10 recursos |
| `gerar_cronograma_macro.py` | 414 | XML + P6 XER + OpenProject CSV + JSON (multinucleo) |
| `gerar_pdf_perdas.py` | 314 | PDF reportlab: UARL + ILI + balanco + risco |
| `gerar_xlsx.py` | 636 | 6 XLSX profissionais com graficos (openpyxl) |
| `construdata_pipeline.py` | 203 | Orquestrador: detecta formato → 6 etapas |

**gerar_ns.py — Funcoes:**
- `calc_manning(dn_mm, decl_mm)` L60 — V=(1/n)*Rh^(2/3)*I^(1/2), Q, tau
- `enriquecer_trechos(trechos, pvs)` L72 — Adiciona Manning + cotas
- `to_ll(x, y)` L98 — UTM 31983 → lat/lon
- `gerar_ns_a4(ns_id, tr, pvs, nucleo, path)` L106 — PDF A4 texto
- `gerar_ns_desenho(ns_id, tr, pvs, nucleo, path)` L190 — PDF A3 completo
- `calcular_materiais(tr, pvs)` L274 — Lista materiais automatica
- `gerar_ns_sat(ns_id, tr, pvs, nucleo, path)` L296 — PDF A3 satelite
- `gerar_html(ns_id, tr, pvs, all_tr, nucleo, path)` L368 — HTML Leaflet
- `gerar_geojson(trechos, pvs, path)` L441 — GeoJSON LineString
- `processar_nucleo(dxf_path, nucleo, out_base)` L459 — Pipeline 1 nucleo
- `processar_nucleo_from_data(pvs, trechos, nucleo, out)` L541 — A partir de dados

**gerar_xlsx.py — 6 funcoes:**
- `gerar_xlsx_custos(pvs, trechos, nucleo, path)` — 2 abas: por trecho + composicao
- `gerar_xlsx_hidraulica(trechos, pvs, nucleo, path)` — Manning por trecho
- `gerar_xlsx_curva_s(trechos, nucleo, path)` — Grafico previsto x real
- `gerar_xlsx_lean(rel, pvs, trechos, nucleo, path)` — 5 abas: resumo+takt+LPS+lookahead+6D
- `gerar_xlsx_microplan(mp, pvs, trechos, nucleo, path)` — 3 abas: morfologia+trechos+material
- `gerar_xlsx_perdas(rel, nucleo, path)` — 2 abas: indicadores + risco ruptura

---

## 3.3 MOTORES DE CALCULO (12)

| Arquivo | Linhas | Funcao principal |
|---------|--------|------------------|
| `motor_custo.py` | 297 | `custo_trecho()`, `custo_nucleo()`, `gerar_bm()` |
| `motor_medicao.py` | 269 | `gerar_curva_s()`, `gerar_boletim_medicao()` |
| `motor_ml.py` | 247 | `prever_producao()`, `gerar_relatorio_ml()` |
| `motor_lean_lps.py` | 475 | `calcular_takt_time()`, `gerar_lookahead()`, `gerar_relatorio_lean_lps()` |
| `motor_parametrico.py` | 318 | `class PipeNetwork` — mover PV recalcula tudo |
| `motor_microplanejamento.py` | 465 | `micro_planejar_nucleo()` — 5 morfologias |
| `motor_perdas.py` | 611 | `balanco_hidrico()`, `calcular_uarl()`, `calcular_ili()`, `criar_dma()` |
| `motor_gemini.py` | 562 | `analisar_foto()`, `ler_pdf_projeto()`, `consultar()` |
| `motor_llm.py` | 545 | `chamar()` — roteador 4 LLMs + 7 prompts especializados |
| `motor_contratos.py` | 560 | `criar_contrato()`, `ativar_contrato()`, CRS auto 18 estados |
| `construdata_analytics.py` | 997 | XGBoost real + GridSearchCV 162 modelos (Qwen) |
| `slnr_mestre_ml.py` | 1665 | Integrador SLNR + ML + 48 abas XLSX (Qwen) |

**motor_custo.py — Composicao R$/metro:**
```
Escavacao:      R$ 145/m
Tubo ESG:       R$ 240/m
Tubo AG:        R$  95/m
PV/Caixas:      R$ 120/m
Reaterro:       R$  80/m
Ramal:          R$  65/m
Pavimentacao:   R$  45/m
Sinalizacao:    R$  15/m
Subtotal:       R$ 805/m + BDI 25% = R$ 910/m
```

**motor_parametrico.py — class PipeNetwork:**
- `mover_pv(nome, x, y)` — recalcula ext/decl/Manning/custo em cascata
- `alterar_cota(nome, ct, cf)` — recalcula prof/decl
- `alterar_dn(idx, dn)` — recalcula Manning
- `alterar_material(idx, mat)` — recalcula Manning (n diferente)
- `adicionar_pv()`, `remover_pv()`, `adicionar_trecho()`, `remover_trecho()`
- `trechos_com_alerta()` — lista alertas hidraulicos
- `exportar()` → JSON padrao
- `from_leitor(leitor_func, path)` — instancia de qualquer leitor

**motor_perdas.py — Formulas IWA:**
```
UARL = (18 * rede_km + 0.8 * n_conexoes + 25 * ramal_km) * pressao_mca
ILI = Perdas_Reais / UARL
  < 2.0 = Excelente (A)  |  < 4.0 = Bom (B)  |  < 8.0 = Regular (C)  |  >= 8.0 = Ruim (D)
```

**motor_lean_lps.py — BIM 6D vida util:**
```
PVC:      50 anos | 0.5% manut/ano | 3.2 kg CO2/m
PEAD:    100 anos | 0.3% manut/ano | 2.8 kg CO2/m
Concreto: 80 anos | 1.0% manut/ano | 12.5 kg CO2/m
FFD:     100 anos | 0.2% manut/ano | 18.0 kg CO2/m
```

**motor_microplanejamento.py — 5 morfologias:**
```
Planicie: 25-35 m/dia | fator 1.00 | Escav. mecanica
Encosta:  15-25 m/dia | fator 1.25 | Mista
Morro:     8-15 m/dia | fator 1.65 | Manual + escoramento
Mangue:    5-10 m/dia | fator 2.10 | Rebaixamento + estaca-prancha
Viela:    10-18 m/dia | fator 1.45 | 100% manual
```

**motor_llm.py — Roteamento 4 LLMs gratuitos:**
```
Foto/PDF      → Gemini Flash (unico multimodal free, 500/dia)
Consulta      → Groq Llama 3.3 70B (~0.3s resposta)
Resumo        → Mistral Large (escrita tecnica)
Perdas/Dados  → Cohere Command-R+ (bom com tabelas)
```

**motor_llm.py — 7 prompts especializados:**
- lean_lps: analise PPC, takt, gargalos, acoes imediatas
- custo: comparacao R$/m contrato, desvio, otimizacao
- perdas: ILI faixa, UARL componente, DMA prioridade
- ml: producao vs meta, tendencia, gargalos pipeline
- micro: equipes, morro, material JIT, sequencia
- hidraulica: V/tau/decl fora norma → acao corretiva
- resumo_exec: 200 palavras para diretoria

**motor_contratos.py — CRS automatico 18 estados:**
```
SP/RJ/MG/DF/MA/PI → EPSG:31983 (UTM 23S)
PR/SC/RS/GO/PA     → EPSG:31982 (UTM 22S)
BA/CE/ES           → EPSG:31984 (UTM 24S)
PE                 → EPSG:31985 (UTM 25S)
MT/MS              → EPSG:31981 (UTM 21S)
AM                 → EPSG:31980 (UTM 20S)
```

---

## 3.4 INTERFACES HTML (7)

| Arquivo | Linhas | Tecnologia | Funcionalidade |
|---------|--------|------------|---------------|
| `construdata_editor.html` | 1054 | Leaflet | Editor rede EPANET. PV(P), Tubo(T), Mover(M), Apagar(Del). Import/Export JSON |
| `construdata_rdo.html` | 892 | DOM+Canvas | RDO diario: NS+custos+fotos+ocorrencias+equipe+clima |
| `construdata_controle.html` | 576 | DOM+Canvas | 4 abas: As-Built/Medicao BM/Curva S/Resumo 5D |
| `construdata_perdas.html` | 524 | DOM+Canvas | 6 abas: Balanco/UARL+ILI/Risco/DMAs/Economia/Dados |
| `FLUXOGRAMA_BIM_5D.html` | 519 | SVG+DOM | Fluxograma visual 7 fases |
| `ARQUITETURA_BIM_5D.html` | 482 | SVG+DOM | Diagrama arquitetura 3 camadas |
| `construdata_manage.html` | 310 | Three.js | Viewer 3D: 5 modos (3D/Custo/Hidraulica/DN/Timeline 4D) |

**Tema visual (replicar em qualquer GUI):**
- Fundo: #06060f | Texto: #d0d0e8 | Acento esgoto: #00ff88 | Acento agua: #00aaff
- Fonts: Manrope (display) + JetBrains Mono (dados)

---

## 3.5 GUI DESKTOP (construdata_gui.py — 1.631 linhas, 81 metodos)

**12 abas:**

| # | Tab | Botoes |
|---|-----|--------|
| 1 | Processar | PIPELINE COMPLETO, APENAS LER, BATCH, EDITOR HTML |
| 2 | Mapa | Leaflet (tkintermapview) + satelite/rua + selecao trechos |
| 3 | Rede | Cards PVs/Trechos/Extensao + tabela PVs |
| 4 | Hidraulica | Cards OK/Verificar + tabela Manning (V, Q, tau) |
| 5 | Trechos | Tabela completa todos campos |
| 6 | Custos 5D | CUSTOS + BM + CURVA S + MICROPLAN + ML + CRONO MACRO |
| 7 | BIM/Civil3D | GERAR TUDO + IFC + LandXML + NTS292 + DXF + 6 HTMLs |
| 8 | Lean/LPS | RELATORIO + TAKT + LOOKAHEAD + BIM 6D |
| 9 | Perdas | RELATORIO + MAPA RISCO + DMAs + PDF + TROCA |
| 10 | IA | 4 LLMs + campo pergunta + 7 botoes analise especializada |
| 11 | Nucleos | BATCH DXF + BATCH PROLONGAMENTOS + BATCH TUDO |
| 12 | Log | Console com timestamps |

---

## 3.6 DADOS DO CONTRATO

| Arquivo | Conteudo |
|---------|----------|
| `DADOS_CONTRATO.json` | 20 materiais + composicao R$/m + fatores + saldo por nucleo |
| `EXECUCAO_DIARIA.json` | 521 dias x 6 nucleos (equipe, rua, ligacoes agua/esgoto) |
| `ML_DATA.json` | XGBoost features + pipeline 11 etapas + 4 cenarios |
| `SLNR_MESTRE_MODELO.xlsx` | Planilha referencia 48 abas com formulas linkadas |

---

# PARTE 4 — FORMATO INTERNO (SAGRADO)

```python
pvs = {
    "PV01": {
        "x": 362293.456,       # Easting UTM (EPSG:31983)
        "y": 7352565.123,      # Northing
        "ct": 5.20,            # Cota Terreno (m) — PODE SER NEGATIVO (Santos)
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
        "ext_m": 14.5,
        "decl_mm": 8.5,        # permil = (CF_ini - CF_fim) / ext * 1000
        "material": "PVC",     # PVC|PEAD|PE80|PE100|CONCRETO
        "tipo": "esgoto",
    },
]
```

---

# PARTE 5 — CONSTANTES DO CONTRATO

```
Manning n: PVC=0.013, PEAD=0.011, PE80/100=0.011, Concreto=0.015

Precos unitarios:
  PVC DN200: R$200.12/m  |  PVC DN300: R$310/m
  PV concreto: R$3.686/un  |  PI plastico: R$1.412/un
  PEAD DN63: R$85/m  |  PEAD DN110: R$101.80/m  |  PEAD DN160: R$145/m

ML dados reais:
  Producao atual: 366 lig/mes  |  Meta SABESP: 1044 lig/mes
  Metros/ligacao: 6.1  |  Ciclo atual: 76 dias  |  Meta 2X: 40 dias
  Feature #1: lig_rolling_3 (0.50 importance)

Total contrato: R$ 46.2M, 25.383 ligacoes, ~50.766m de rede
```

---

# PARTE 6 — REDES PROCESSADAS E VALIDADAS

| Rede | Tipo | PVs | Trechos | Extensao | NS | Erros |
|------|------|-----|---------|----------|-----|-------|
| Pantanal Baixo | ESG | 165 | 137 | ~7.700m | 137 | 0 |
| Verde e Teteu | ESG | 357 | 180 | 2.621m | 180 | 0 |
| Sao Manoel | ESG | 20 | 16 | 1.275m | 16 | 0 |
| Joao Carlos | ESG | — | — | — | OK | 0 |
| Vila Criadores | ESG | — | — | — | OK | 0 |
| Vila Israel | ESG | — | — | — | OK | 0 |
| Pantanal | AG | 348 | 372 | 6.986m | — | 0 |
| Criadores | AG | 122 | 130 | 4.138m | — | 0 |
| Teteu | AG | 337 | 346 | 4.813m | — | 0 |
| Israel | AG | 812 | 861 | 11.509m | — | 0 |
| Prol.Teteu Alt-01 | XML | 147 | 141 | 6.363m | 141 | 0 |
| Prol.Teteu | XML | 149 | 143 | 6.420m | 143 | 0 |
| Prol.Pantanal | XML | 29 | 25 | 1.261m | 25 | 0 |
| Prol.Criadores | XML | 76 | 70 | 2.689m | 70 | 0 |
| Prol.Sao Manoel | XML | 91 | 79 | 5.143m | 79 | 0 |
| **TOTAL** | | **2.302+** | **2.094+** | **~39 km** | **836** | **0** |

---

# PARTE 7 — REFERENCIA RAPIDA DE FUNCOES

```python
# LEITURA
ler_dxf_gdal(path) → (pvs, trechos, ruas, meta)
ler_dwg_aec(path) → (pvs, trechos, meta)
ler_landxml(path) → (pvs, trechos, ruas, meta)

# PARAMETRICO
PipeNetwork(pvs, trechos)
  .mover_pv(nome, x, y)       .alterar_cota(nome, ct, cf)
  .alterar_dn(idx, dn)        .alterar_material(idx, mat)
  .trechos_com_alerta()        .exportar() → JSON
  .from_leitor(func, path)

# GERADORES
gerar_ns_a4(ns_id, tr, pvs, nucleo, path) → PDF A4
gerar_ns_desenho(ns_id, tr, pvs, nucleo, path) → PDF A3
gerar_ns_sat(ns_id, tr, pvs, nucleo, path) → PDF A3 sat
gerar_geojson(trechos, pvs, path) → GeoJSON
gerar_landxml(pvs, trechos, nucleo, path) → XML
gerar_ifc_lod500(pvs, trechos, nucleo, dir) → [ifc, csv, json]
gerar_project_xml(pvs, trechos, nucleo, dir) → XML
gerar_tudo(nucleos, data, dir) → (wbs, paths)
gerar_pdf_perdas(relatorio, path, nucleo) → PDF

# XLSX
gerar_xlsx_custos(pvs, trechos, nucleo, path)
gerar_xlsx_hidraulica(trechos, pvs, nucleo, path)
gerar_xlsx_curva_s(trechos, nucleo, path)
gerar_xlsx_lean(rel, pvs, trechos, nucleo, path)
gerar_xlsx_microplan(mp, pvs, trechos, nucleo, path)
gerar_xlsx_perdas(rel, nucleo, path)

# MOTORES
custo_trecho(tr, pvs) → {itens, total}
custo_nucleo(pvs, trechos) → {total, resumo}
gerar_relatorio_ml(dados, saldo) → {previsao, cenarios}
gerar_relatorio_lean_lps(pvs, trechos, nucleo) → {lean, lps, bim_6d}
micro_planejar_nucleo(pvs, trechos, nucleo, eq) → {por_morfologia}
gerar_relatorio_perdas(pvs, trechos, nucleo, pressao) → {uarl, ili, risco}
balanco_hidrico(prod, macro, micro) → {nrw, perdas_reais}

# CONTRATOS
criar_contrato(nome, numero, cidade, estado) → contrato
ativar_contrato(slug) | listar_contratos()
criar_nucleo(nome) | salvar_rede_nucleo(pvs, trechos, nome)
carregar_rede_nucleo(nome) → (pvs, trechos)
exportar_contrato(slug, path) → ZIP | importar_contrato(zip)

# LLM
analisar_foto(path) → {material, dn, legenda}
ler_pdf(path) → {pvs, trechos}
consultar(pergunta, contexto) → texto
chamar(modulo, prompt) → texto (roteamento automatico)
```

---

# PARTE 8 — DEPENDENCIAS

```bash
# Core
pip install geopandas pyogrio shapely scipy ezdxf pyproj numpy

# BIM
pip install ifcopenshell

# Relatorios
pip install reportlab openpyxl matplotlib seaborn

# ML
pip install xgboost scikit-learn

# GUI
pip install tkintermapview contextily

# LLM (opcional — plataforma funciona 100% sem)
pip install google-genai groq mistralai cohere
```

---

# PARTE 9 — HISTORIA (8 sessoes, 21-23 Mar 2026)

| Sessao | Data | O que fez |
|--------|------|-----------|
| 1 | 21/Mar | Debugar fantasmas → ler_dxf_gdal v1 |
| 2 | 22/Mar 01:00 | GDAL clustering v2 → 137 NS perfeitas |
| 3 | 22/Mar 01:46 | Agua + DWG → 4 redes agua, ler_dwg_aec |
| 4 | 22/Mar 17:04 | BIM 5D → IFC, NTS292, Project, Three.js |
| 5 | 22/Mar 22:10 | Editor + Motores → custo, medicao, ML, Lean |
| 6 | 23/Mar 15:18 | Macro + Perdas → cronograma, micro, perdas, LLM, contratos |
| 7 | 23/Mar 20:00 | XLSX + prompts LLM → gerar_xlsx, prompts especializados |
| 8 | 23/Mar 22:00 | Analytics ML (Qwen) + SLNR integrador + migracao |

---

# PARTE 10 — REGRAS INVIOLAVEIS

1. Empresa: **FCN Construcoes e Saneamento** (NUNCA FCN)
2. Plataforma: **ConstruData - HydroNetwork**
3. Custos do **CONTRATO** (R$910/m), nao SINAPI generico
4. Medicao por **Nota de Servico** (1 NS = 1 trecho)
5. Sempre **agua + esgoto**, nunca so um
6. CRS: **EPSG:31983** (SIRGAS 2000 UTM 23S)
7. Cadastro NTS 292 = **condicao para pagamento** (contrato p.64)
8. CT pode ser **negativo** (Santos abaixo do nivel do mar)
9. CF > CT = possivel rede aerea (aviso, nao rejeitar)
10. Formato **pvs + trechos** e sagrado — nao alterar
11. LLMs sao **camada opcional** — motores sao deterministicos
12. Output = **JSON + XLSX** (JSON pra maquina, XLSX pra gente)
13. Respostas da IA sao **SUGESTOES** — engenheiro decide

---

# PARTE 11 — ONDE ESTAO OS ARQUIVOS

```
Repositorio: https://github.com/NeryFelipe2/NOVA-NS-Versao-5
Local: C:\Users\felip\Downloads\NOVA NS Versao 5\

Scripts Python (raiz):
  ler_dxf_gdal.py, ler_landxml.py, ler_dwg_aec.py
  gerar_ns.py, gerar_civil3d.py, gerar_cadastro_nts292.py
  gerar_ifc_lod500.py, gerar_project_xml.py, gerar_cronograma_macro.py
  gerar_pdf_perdas.py, gerar_xlsx.py, construdata_pipeline.py
  motor_custo.py, motor_medicao.py, motor_ml.py, motor_lean_lps.py
  motor_parametrico.py, motor_microplanejamento.py, motor_perdas.py
  motor_gemini.py, motor_llm.py, motor_contratos.py
  construdata_analytics.py, slnr_mestre_ml.py
  construdata_gui.py

HTMLs: html/
Dados: dados_contrato/
Cronograma: cronograma/
Catalogos: catalogos/
BATs: ABRIR.bat, ABRIR_CONSTRUDATA.bat, EXECUTAR_ANALYTICS.bat

Planilha MESTRE modelo: dados_contrato/SLNR_MESTRE_MODELO.xlsx (48 abas)
XLSX gerados: Construdata hydronetwork v5/*.xlsx (6 planilhas)
```

---

*SUPERLOG COMPLETO · ConstruData HydroNetwork · FCN Construcoes e Saneamento*
*24 scripts · 7 HTML · 1 GUI · ~16.000 linhas · 836 NS · 39 km · 0 erros*
*Documento para migracao NOVA-NS-Versao-5 → ConstruData_Project*
*23/03/2026*
