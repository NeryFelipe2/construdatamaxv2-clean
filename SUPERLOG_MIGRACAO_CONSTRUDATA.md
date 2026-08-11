# SUPERLOG — Migracao ConstruData HydroNetwork
# De: NOVA-NS-Versao-5 → Para: ConstruData_Project
# FCN Construcoes e Saneamento · Marco 2026

---

## PARA QUEM ESTA LENDO

Este documento descreve TODA a plataforma ConstruData HydroNetwork
desenvolvida em 7 sessoes (21-23 Mar 2026) no repositorio NOVA-NS-Versao-5.
O objetivo e migrar para o repositorio oficial ConstruData_Project
(https://github.com/NeryFelipe2/ConstruData_Project) e publicar no site.

---

## 1. O QUE E A PLATAFORMA

Sistema BIM 6D completo para construcao de redes de agua e esgoto.

```
ENTRADA              PROCESSAMENTO              SAIDA
.DXF (ProSane)  ──┐  motor_custo (R$910/m)     PDF A4 (NS campo)
.DWG (Civil 3D) ──┤  motor_medicao (NS→BM)     PDF A3 (desenho+sat)
.XML (LandXML)  ──┤  motor_ml (XGBoost)         HTML Leaflet
.JSON (rede)    ──┼→ motor_lean_lps (LPS+6D)    GeoJSON
.PDF (Gemini)   ──┤  motor_parametrico          LandXML (Civil 3D)
Mapa (editor)   ──┤  motor_micro (morfologia)   DXF NTS 292
Foto (RDO)      ──┘  motor_perdas (IWA)         IFC LOD 500
                     motor_gemini (IA)           MS Project XML
                     motor_llm (4 LLMs)          Primavera P6 XER
                     motor_contratos             XLSX profissional
                                                 PDF perdas
                                                 Dynamo .py / .scr
```

---

## 2. NUMEROS FINAIS

| Metrica | Valor |
|---------|-------|
| Scripts Python | 24 (produção) + 16 (auxiliares) |
| Interfaces HTML | 7 |
| GUI Desktop | 1 (12 abas, 95 metodos) |
| Linhas Python | 28.273 |
| Linhas HTML | 4.357 |
| Total linhas | 32.630 |
| Commits | 61 |
| NS geradas | 836 |
| Erros | 0 |
| Rede processada | 39 km |
| PVs validados | 2.302+ |
| Trechos validados | 2.094+ |
| Formatos de saida | 15+ |
| LLMs integrados | 4 (Gemini/Groq/Mistral/Cohere) |
| Estados CRS auto | 18 |
| Sessoes dev | 7 (21-23 Mar 2026) |

---

## 3. INVENTARIO COMPLETO DOS ARQUIVOS

### 3.1 LEITORES — Entrada → pvs + trechos

| Arquivo | Linhas | O que faz |
|---------|--------|-----------|
| `ler_dxf_gdal.py` | 328 | Le DXF ProSaneamento. GDAL + scipy clustering endpoints (2m). Agua+esgoto. Auto-naming junctions grau>=2. |
| `ler_landxml.py` | 267 | Le LandXML 1.2 Civil 3D. Namespace auto. Struct→PV, Pipe→trecho. |
| `ler_dwg_aec.py` | 316 | Le DWG Civil 3D. libredwg→DXF. Parseia PV/CT/CF. Topologia por nomes. |

### 3.2 GERADORES — pvs + trechos → saidas

| Arquivo | Linhas | Saida |
|---------|--------|-------|
| `gerar_ns.py` | 654 | 5 arquivos/trecho: PDF A4, PDF A3 desenho, PDF A3 satelite, HTML Leaflet, JSON |
| `gerar_civil3d.py` | 312 | LandXML 1.2 + DXF cadastro + Dynamo .py + AutoCAD .scr + JSON |
| `gerar_cadastro_nts292.py` | 458 | DXF georref SIRGAS 2000 UTM 23S. 17 layers. SIGNOS. Perfil H:500 V:100. |
| `gerar_ifc_lod500.py` | 184 | IFC 2x3: SweptDiskSolid (tubos) + ExtrudedAreaSolid (PVs). 4 PropertySets. |
| `gerar_project_xml.py` | 276 | MS Project XML. WBS 12 fases. 10 recursos. |
| `gerar_cronograma_macro.py` | 414 | Multinucleo: XML + P6 XER + OpenProject CSV + JSON |
| `gerar_pdf_perdas.py` | 314 | PDF A4 reportlab: UARL + ILI + balanco + risco |
| `gerar_xlsx.py` | 636 | 6 XLSX profissionais: custos, hidraulica, curva_s, lean, microplan, perdas |
| `construdata_pipeline.py` | 203 | Orquestrador: detecta formato → 6 etapas automaticas |

### 3.3 MOTORES DE CALCULO

| Arquivo | Linhas | O que faz |
|---------|--------|-----------|
| `motor_custo.py` | 297 | R$910/m contrato. 20 materiais. BDI 25%. Gera BM. |
| `motor_medicao.py` | 269 | Excel→resumo→Curva S→BM. 521 dias dados reais. |
| `motor_ml.py` | 247 | XGBoost rolling_3. Pipeline 11 etapas. 5 cenarios. |
| `motor_lean_lps.py` | 475 | Lean (Takt/VSM) + LPS (WWP/PPC/Lookahead) + BIM 6D (CO2). |
| `motor_parametrico.py` | 318 | PipeNetwork class. Mover PV → recalcula cascata Manning. |
| `motor_microplanejamento.py` | 465 | 5 morfologias. Equipe/equip por frente. Material JIT. |
| `motor_perdas.py` | 611 | IWA: balanco hidrico, UARL, ILI, DMA, risco ruptura. |
| `motor_gemini.py` | 562 | Gemini Flash: foto→analise, PDF→pvs+trechos, assistente. |
| `motor_llm.py` | 545 | Roteador: Gemini+Groq+Mistral+Cohere. 7 prompts especializados. |
| `motor_contratos.py` | 560 | Multi-contrato. Criar/editar/trocar. CRS auto 18 UFs. |

### 3.4 ANALYTICS ML (Qwen)

| Arquivo | Linhas | O que faz |
|---------|--------|-----------|
| `construdata_analytics.py` | 997 | XGBoost real + GridSearchCV (162 modelos). 4 graficos. XLSX 5 abas. |
| `slnr_mestre_ml.py` | 1665 | Integrador SLNR + ML. Notas de Servico PIs+PVs. |

### 3.5 INTERFACES

| Arquivo | Linhas | Tecnologia | O que faz |
|---------|--------|------------|-----------|
| `construdata_gui.py` | 1631 | Tkinter | GUI desktop 12 abas. 95 metodos. Tema escuro. |
| `construdata_editor.html` | 1054 | Leaflet | Editor EPANET: add PV(P), tubo(T), mover(M), apagar(Del). |
| `construdata_manage.html` | 310 | Three.js | Viewer 3D. 5 modos. Timeline 4D. Z exaggeration. |
| `construdata_controle.html` | 576 | Canvas | As-Built + Medicao BM + Curva S + Resumo 5D. |
| `construdata_rdo.html` | 892 | DOM | RDO diario: NS + custos + fotos + equipe + clima. |
| `construdata_perdas.html` | 524 | Canvas | Perdas IWA: Balanco + UARL + ILI + Risco + DMAs. |
| `FLUXOGRAMA_BIM_5D.html` | 519 | SVG | Fluxograma visual 7 fases. |
| `ARQUITETURA_BIM_5D.html` | 482 | SVG | Diagrama arquitetura 3 camadas. |

### 3.6 DADOS

| Arquivo | O que tem |
|---------|-----------|
| `dados_contrato/DADOS_CONTRATO.json` | 22 materiais + precos + composicao R$/m + saldo |
| `dados_contrato/EXECUCAO_DIARIA.json` | 521 dias x 6 nucleos |
| `dados_contrato/ML_DATA.json` | XGBoost features + pipeline 11 etapas |
| `dados_contrato/SLNR_MESTRE_MODELO.xlsx` | 48 abas com formulas (referencia) |
| `cronograma/*.xml/xer/csv/json` | Cronograma macro 4 formatos |
| `catalogos/AeccCatCfg.xml` | Catalogos SABESP para Civil 3D |

---

## 4. FORMATO INTERNO (SAGRADO — NAO ALTERAR)

```python
pvs = {
    "PV01": {
        "x": 362293.456,       # Easting UTM (EPSG:31983)
        "y": 7352565.123,      # Northing
        "ct": 5.20,            # Cota Terreno (pode ser negativo)
        "cf": 3.70,            # Cota Fundo
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
        "decl_mm": 8.5,        # permil
        "material": "PVC",
        "tipo": "esgoto",
    },
]
```

---

## 5. CONSTANTES DO CONTRATO

```
Composicao R$/metro (BDI 25%):
  Escavacao R$145 | Tubo ESG R$240 | Tubo AG R$95 | PV R$120
  Reaterro R$80 | Ramal R$65 | Pavim R$45 | Sinaliz R$15
  = R$805 + BDI 25% = R$910/m

Manning: PVC=0.013, PEAD=0.011, Concreto=0.015
Morfologia: Planicie=30, Encosta=20, Morro=12, Mangue=7, Viela=14 m/dia
Vida util: PVC=50a(3.2kgCO2/m), PEAD=100a(2.8), Concreto=80a(12.5)
UARL IWA: Rede=18, Conexao=0.8, Ramal=25 L/km/dia/mca
ML: 366 lig/mes atual, Meta=1044, Ciclo=76d, Feature#1=rolling_3(0.50)
Contrato: R$46.2M, 25.383 ligacoes, ~50.766m rede
```

---

## 6. REDES VALIDADAS (39 km, 836 NS, 0 erros)

| Rede | Tipo | PVs | Trechos | Extensao | NS |
|------|------|-----|---------|----------|-----|
| Pantanal Baixo | ESG | 165 | 137 | 7.700m | 137 |
| Verde e Teteu | ESG | 357 | 180 | 2.621m | 180 |
| Sao Manoel | ESG | 20 | 16 | 1.275m | 16 |
| Joao Carlos | ESG | — | — | — | OK |
| Vila Criadores | ESG | — | — | — | OK |
| Vila Israel | ESG | — | — | — | OK |
| Pantanal | AG | 348 | 372 | 6.986m | — |
| Criadores | AG | 122 | 130 | 4.138m | — |
| Teteu | AG | 337 | 346 | 4.813m | — |
| Israel | AG | 812 | 861 | 11.509m | — |
| Prol. Teteu Alt-01 | XML | 147 | 141 | 6.363m | 141 |
| Prol. Teteu | XML | 149 | 143 | 6.420m | 143 |
| Prol. Pantanal | XML | 29 | 25 | 1.261m | 25 |
| Prol. Criadores | XML | 76 | 70 | 2.689m | 70 |
| Prol. Sao Manoel | XML | 91 | 79 | 5.143m | 79 |
| **TOTAL** | | **2.302+** | **2.094+** | **~39 km** | **836** |

---

## 7. HISTORICO DE DESENVOLVIMENTO (61 commits, 7 sessoes)

### Sessao 1 (21/Mar) — Debugar trechos fantasma
- Parser XDATA conectava pontos errados
- Criou ler_dxf_gdal.py com GDAL/OGR
- Resultado: 0 fantasmas

### Sessao 2 (22/Mar) — GDAL + Clustering
- PVs offset 5-15m dos textos
- scipy.fclusterdata(t=2.0) nos endpoints
- 137 NS perfeitas Pantanal

### Sessao 3 (22/Mar) — Agua + DWG
- Redes agua (PEAD), DWG Civil 3D (libredwg)
- 4 redes agua processadas, 1 DWG desbloqueado

### Sessao 4 (22/Mar) — BIM 5D completo
- IFC LOD 500, NTS 292, MS Project, Three.js, Curva S
- Pipeline 7 etapas end-to-end

### Sessao 5 (22/Mar) — Editor + Motores
- Editor EPANET Leaflet, custo, medicao, ML, Lean/LPS, parametrico
- 18 scripts + 6 HTML

### Sessao 6 (23/Mar) — Plataforma completa
- Cronograma macro, microplanejamento, perdas IWA
- Gemini, multi-LLM, contratos, GUI 12 abas
- XLSX profissional, NS DESENHO + SAT
- 22 scripts + 7 HTML + 1 GUI

### Sessao 7 (23/Mar) — Integracao final
- gerar_xlsx.py centralizado (6 XLSX)
- Analytics ML real (XGBoost GridSearchCV, Qwen)
- SLNR Mestre integrador
- Prompts LLM especializados por modulo
- SLNR_MESTRE_MODELO.xlsx como referencia

---

## 8. LLMs INTEGRADOS

```
CAMADA 1 (deterministica, offline — FUNCIONA SEM INTERNET):
  motor_custo       → R$ exato
  motor_parametrico → Manning exato (V, Q, tau)
  motor_perdas      → UARL exato (formula IWA)
  motor_lean_lps    → PPC exato
  motor_ml          → rolling_3
  motor_micro       → morfologia

CAMADA 2 (IA opcional — PRECISA DE API KEY GRATUITA):
  Gemini Flash   500/dia    foto, PDF (unico multimodal free)
  Groq Llama3.3  30/min     consulta rapida (~0.3s)
  Mistral Large  1M tok/mes resumo gerencial
  Cohere Cmd-R+  1000/mes   analise dados

7 prompts especializados:
  lean_lps, custo, perdas, ml, micro, hidraulica, resumo_exec
```

---

## 9. COMO MIGRAR PARA ConstruData_Project

### Estrutura recomendada no ConstruData_Project:

```
ConstruData_Project/
├── hydronetwork/                    ← NOVA PASTA (scripts da plataforma)
│   ├── leitores/
│   │   ├── ler_dxf_gdal.py
│   │   ├── ler_landxml.py
│   │   └── ler_dwg_aec.py
│   ├── geradores/
│   │   ├── gerar_ns.py
│   │   ├── gerar_civil3d.py
│   │   ├── gerar_cadastro_nts292.py
│   │   ├── gerar_ifc_lod500.py
│   │   ├── gerar_project_xml.py
│   │   ├── gerar_cronograma_macro.py
│   │   ├── gerar_pdf_perdas.py
│   │   ├── gerar_xlsx.py
│   │   └── construdata_pipeline.py
│   ├── motores/
│   │   ├── motor_custo.py
│   │   ├── motor_medicao.py
│   │   ├── motor_ml.py
│   │   ├── motor_lean_lps.py
│   │   ├── motor_parametrico.py
│   │   ├── motor_microplanejamento.py
│   │   ├── motor_perdas.py
│   │   ├── motor_gemini.py
│   │   ├── motor_llm.py
│   │   └── motor_contratos.py
│   ├── analytics/
│   │   ├── construdata_analytics.py
│   │   └── slnr_mestre_ml.py
│   ├── gui/
│   │   └── construdata_gui.py
│   ├── dados/
│   │   ├── DADOS_CONTRATO.json
│   │   ├── EXECUCAO_DIARIA.json
│   │   ├── ML_DATA.json
│   │   └── SLNR_MESTRE_MODELO.xlsx
│   ├── cronograma/
│   │   ├── CRONOGRAMA_MACRO_SLNR.xml
│   │   ├── CRONOGRAMA_MACRO_SLNR.xer
│   │   ├── CRONOGRAMA_MACRO_SLNR.csv
│   │   └── CRONOGRAMA_MACRO_SLNR.json
│   ├── catalogos/
│   │   └── AeccCatCfg.xml
│   └── __init__.py
├── frontend/
│   └── public/
│       ├── construdata_editor.html
│       ├── construdata_manage.html
│       ├── construdata_controle.html
│       ├── construdata_rdo.html
│       ├── construdata_perdas.html
│       ├── FLUXOGRAMA_BIM_5D.html
│       └── ARQUITETURA_BIM_5D.html
├── backend/
│   └── backend/
│       └── construdata_backend.py   ← API Flask que chama hydronetwork/
├── bat/
│   ├── ABRIR.bat
│   └── EXPORTAR_PIPE_NETWORKS.bat
└── docs/
    ├── MANUAL_DEFINITIVO.md
    ├── SUPERLOG_MIGRACAO.md
    └── VERIFICACAO_PLATAFORMA.md
```

### Passos de migracao:

```bash
# 1. Clonar o repo
cd C:\Users\felip\Downloads
git clone https://github.com/NeryFelipe2/ConstruData_Project.git
cd ConstruData_Project

# 2. Criar pasta hydronetwork/
mkdir -p hydronetwork/leitores hydronetwork/geradores hydronetwork/motores
mkdir -p hydronetwork/analytics hydronetwork/gui hydronetwork/dados

# 3. Copiar scripts
SRC="C:\Users\felip\Downloads\NOVA NS Versao 5"
cp $SRC/ler_dxf_gdal.py hydronetwork/leitores/
cp $SRC/ler_landxml.py hydronetwork/leitores/
cp $SRC/ler_dwg_aec.py hydronetwork/leitores/
# ... (todos os scripts)

# 4. Copiar HTMLs para frontend
cp $SRC/html/*.html frontend/public/

# 5. Commit e push
git add hydronetwork/ frontend/public/*.html
git commit -m "HydroNetwork v7: 24 scripts + 7 HTML + GUI desktop"
git push
```

---

## 10. INTEGRACAO COM BACKEND EXISTENTE

O ConstruData_Project ja tem backend Flask. Adicionar endpoints:

```python
# Em construdata_backend.py, adicionar:

@app.route('/api/v5/hydronetwork/processar', methods=['POST'])
def hn_processar():
    """Processa DXF/XML/DWG e retorna pvs+trechos."""
    f = request.files['arquivo']
    path = save_upload(f)

    from hydronetwork.leitores.ler_dxf_gdal import ler_dxf_gdal
    from hydronetwork.leitores.ler_landxml import ler_landxml

    ext = Path(path).suffix.lower()
    if ext == '.xml':
        pvs, trechos, ruas, meta = ler_landxml(path)
    else:
        pvs, trechos, ruas, meta = ler_dxf_gdal(path)

    return jsonify({"pvs": pvs, "trechos": trechos, "meta": meta})

@app.route('/api/v5/hydronetwork/custo', methods=['POST'])
def hn_custo():
    """Calcula custos."""
    data = request.json
    from hydronetwork.motores.motor_custo import custo_nucleo
    return jsonify(custo_nucleo(data['pvs'], data['trechos']))

@app.route('/api/v5/hydronetwork/pipeline', methods=['POST'])
def hn_pipeline():
    """Pipeline completo: DXF → todos os outputs."""
    f = request.files['arquivo']
    path = save_upload(f)
    nucleo = request.form.get('nucleo', 'Auto')

    from hydronetwork.geradores.construdata_pipeline import run_pipeline
    results = run_pipeline(path, nucleo=nucleo)
    return jsonify(results)
```

---

## 11. INTEGRACAO COM FRONTEND REACT

O ConstruData_Project ja tem frontend React. Adicionar componentes:

```typescript
// Em frontend/src/api.ts, adicionar:
export async function processarHydroNetwork(file: File, nucleo: string) {
  const form = new FormData();
  form.append('arquivo', file);
  form.append('nucleo', nucleo);
  const res = await fetch('/api/v5/hydronetwork/pipeline', {method:'POST', body:form});
  return res.json();
}

// Em frontend/src/App.tsx, adicionar link:
<a href="/construdata_editor.html">Editor de Rede (EPANET)</a>
<a href="/construdata_manage.html">Viewer 3D</a>
<a href="/construdata_controle.html">Controle de Obra</a>
```

---

## 12. FUNCOES PUBLICAS — REFERENCIA RAPIDA

```python
# LEITURA
ler_dxf_gdal(path) → (pvs, trechos, ruas, meta)
ler_landxml(path) → (pvs, trechos, ruas, meta)
ler_dwg_aec(path) → (pvs, trechos, meta)

# PARAMETRICO
PipeNetwork(pvs, trechos)
  .mover_pv(nome, x, y)      → recalcula ext/decl/Manning/custo
  .alterar_cota(nome, ct, cf) → recalcula prof/decl
  .alterar_dn(idx, dn)        → recalcula Manning
  .exportar()                 → {"pvs":{}, "trechos":[]}

# GERADORES
gerar_ns_a4(ns_id, tr, pvs, nucleo, path) → PDF A4
gerar_ns_desenho(ns_id, tr, pvs, nucleo, path) → PDF A3
gerar_ns_sat(ns_id, tr, pvs, nucleo, path) → PDF A3 satelite
gerar_landxml(pvs, trechos, nucleo, path) → XML Civil 3D
gerar_ifc_lod500(pvs, trechos, nucleo, dir) → IFC + CSV + JSON
gerar_project_xml(pvs, trechos, nucleo, dir) → MS Project XML
gerar_tudo(nucleos, data, dir) → XML + XER + CSV + JSON
gerar_pdf_perdas(relatorio, path, nucleo) → PDF

# XLSX (6 geradores)
gerar_xlsx_custos(pvs, trechos, nucleo, path)
gerar_xlsx_hidraulica(trechos, pvs, nucleo, path)
gerar_xlsx_curva_s(trechos, nucleo, path)
gerar_xlsx_lean(rel, pvs, trechos, nucleo, path)
gerar_xlsx_microplan(mp, pvs, trechos, nucleo, path)
gerar_xlsx_perdas(relatorio, nucleo, path)

# MOTORES
custo_trecho(tr, pvs) → {itens, total}
custo_nucleo(pvs, trechos) → {total, resumo}
gerar_relatorio_ml(dados, saldo) → {previsao, cenarios}
gerar_relatorio_lean_lps(pvs, trechos, nucleo) → {lean, lps, 6d}
micro_planejar_nucleo(pvs, trechos, nucleo) → {por_morfologia}
gerar_relatorio_perdas(pvs, trechos, nucleo) → {uarl, ili, risco}
balanco_hidrico(prod, macro, micro) → {nrw, perdas}

# CONTRATOS
criar_contrato(nome, numero, cidade, estado) → contrato
ativar_contrato(slug)
listar_contratos() → [{slug, nome, cidade}]
salvar_rede_nucleo(pvs, trechos, nome)
carregar_rede_nucleo(nome) → (pvs, trechos)

# LLM
chamar(modulo, prompt) → texto (roteia pro melhor LLM gratis)
analisar_foto(path) → {material, dn, legenda}
ler_pdf(path) → {pvs, trechos}
resumo_executivo(contexto) → texto
```

---

## 13. DEPENDENCIAS

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

# LLM (opcional)
pip install google-genai groq mistralai cohere
```

---

## 14. REGRAS INVIOLAVEIS

1. Empresa: **FCN Construcoes e Saneamento** (NUNCA FCN)
2. Plataforma: **ConstruData - HydroNetwork**
3. Custos do **contrato** (R$910/m), nao SINAPI generico
4. Medicao por **Nota de Servico** (1 NS = 1 trecho)
5. Sempre **agua + esgoto**
6. CRS: **EPSG:31983** (SIRGAS 2000 UTM 23S) — auto por estado
7. Cadastro NTS 292 = **condicao para pagamento**
8. CT pode ser **negativo** (Santos)
9. CF > CT = possivel rede aerea (aviso)
10. Formato **pvs + trechos** e sagrado
11. LLMs sao **camada opcional** — motores sao deterministicos
12. Output = **JSON + XLSX** (JSON pra maquina, XLSX pra gente)
13. Respostas IA sao **sugestoes** — engenheiro decide

---

## 15. PROXIMO PASSO: DEPLOY NO SITE

O ConstruData_Project ja tem:
- Backend Flask (construdata_backend.py)
- Frontend React (frontend/src/)
- Deploy com waitress (producao)

Para publicar os HTMLs no site:
1. Copiar 7 HTMLs para `frontend/public/`
2. React ja serve arquivos estaticos de `public/`
3. Os HTMLs funcionam standalone (nao precisam de build React)
4. Adicionar links no menu do React

Para API:
1. Adicionar endpoints `/api/v5/hydronetwork/*` no Flask
2. Frontend chama via fetch
3. Uploads de DXF/XML processados no servidor
4. Resultados retornados como JSON + download XLSX/PDF

---

*SUPERLOG de migracao gerado em 23/03/2026*
*ConstruData HydroNetwork v7.0*
*61 commits · 32.630 linhas · 24 scripts · 7 HTML · 836 NS · 0 erros*
*FCN Construcoes e Saneamento · CT 11481051 · SE LIGA NA REDE · Santos/SP*
*De: github.com/NeryFelipe2/NOVA-NS-Versao-5*
*Para: github.com/NeryFelipe2/ConstruData_Project*
