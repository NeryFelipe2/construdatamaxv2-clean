# ConstruData — HydroNetwork BIM 5D
## Manual Completo + Prompt de Continuidade
### CT 11481051 · SABESP · SLNR Santos · FCN Construções e Saneamento

> **REGRA DE OURO:** NUNCA usar "DGS Engenharia" em nenhuma saída.
> Empresa: **FCN Construções e Saneamento** · Plataforma: **ConstruData - HydroNetwork**

---

## 🗺️ FLUXOGRAMA GERAL (O QUE O SISTEMA FAZ)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENTRADAS (qualquer uma)                      │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│  📁 DXF      │  📁 DWG      │  📁 LandXML  │  🖱️ Editor Visual     │
│  ProSanea-   │  Civil 3D    │  Export      │  (estilo EPANET)      │
│  mento       │  Pipe Network│  nativo C3D  │  clica no mapa →      │
│  (água+esg)  │  AEC Proxy   │              │  cria PV, tubo        │
├──────────────┼──────────────┼──────────────┼────────────────────────┤
│ ler_dxf_     │ ler_dwg_     │ ler_land     │ construdata_           │
│ gdal.py      │ aec.py       │ xml.py       │ editor.html            │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬───────────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌─────────────────────────────────────────────────────────────────────┐
│              FORMATO INTERNO ÚNICO (pvs + trechos)                  │
│                                                                     │
│  pvs = { "PV01": {x, y, ct, cf, tipo, material} }                 │
│  trechos = [ {pv_ini, pv_fim, dn_mm, ext_m, decl_mm, material} ]  │
│                                                                     │
│  💧 ÁGUA: PE80/PE100, DN 63-160, Hazen-Williams                   │
│  🟢 ESGOTO: PVC, DN 200-400, Manning n=0.013                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  📋 NOTAS DE    │ │  📐 CIVIL 3D    │ │  🏗️ IFC LOD 500 │
│  SERVIÇO        │ │                 │ │  3D REAL         │
│                 │ │  • LandXML      │ │                  │
│  • PDF A4       │ │  • Cadastro DXF │ │  • SweptDisk-    │
│  • JSON         │ │  • Dynamo .py   │ │    Solid (tubos) │
│  • HTML Leaflet │ │  • AutoCAD .scr │ │  • ExtrudedArea  │
│  • GeoJSON      │ │  • JSON dados   │ │    (PVs)         │
│                 │ │                 │ │  • PropertySets  │
│  gerar_ns.py    │ │ gerar_civil3d   │ │    - Dados_Tec   │
│                 │ │ .py             │ │    - Hidraulica   │
│  1 NS = 1       │ │                 │ │    - Custo5D      │
│  trecho da rede │ │                 │ │                   │
│  (unidade de    │ │                 │ │  gerar_ifc_       │
│   medição)      │ │                 │ │  lod500.py        │
└────────┬────────┘ └────────┬────────┘ └────────┬─────────┘
         │                   │                    │
         ▼                   ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  📐 CADASTRO    │ │  📅 CRONOGRAMA  │ │  💰 CUSTO 5D    │
│  NTS 292        │ │                 │ │                  │
│                 │ │  • MS Project   │ │  • Tabela de     │
│  • DXF georref  │ │    XML          │ │    preços do     │
│  • SIRGAS 2000  │ │  • Primavera P6 │ │    CONTRATO      │
│  • UTM 23S      │ │  • OpenProject  │ │    (não SINAPI)  │
│  • Meta JSON    │ │  • Macro + NS   │ │  • Por NS        │
│                 │ │                 │ │  • Medição → BM  │
│  gerar_cadastro │ │ gerar_project   │ │  • Curva S       │
│  _nts292.py     │ │ _xml.py         │ │                  │
└────────┬────────┘ └────────┬────────┘ └────────┬─────────┘
         │                   │                    │
         ▼                   ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PLATAFORMA VISUAL (HTML)                       │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│ 🖱️ EDITOR      │ 🌐 VIEWER 3D   │ 📊 CONTROLE                    │
│ construdata_    │ construdata_    │ construdata_controle.html       │
│ editor.html     │ manage.html     │                                 │
│                 │                 │ • As-Built (tabela editável)    │
│ • Estilo EPANET│ • Three.js      │ • Medição (BM por período)     │
│ • Cria PV      │ • 5 modos:      │ • Curva S (previsto × real)    │
│ • Conecta tubo │   3D/Custo/     │ • Resumo 5D                    │
│ • Edita CT/CF  │   Hidráulica/   │                                 │
│ • Manning real │   DN/Timeline   │                                 │
│   time         │ • Click →       │                                 │
│ • NS integrada │   propriedades  │                                 │
│ • Cadastro     │ • Z exaggeration│                                 │
│ • Import/Export│ • 4D animado    │                                 │
└─────────────────┴─────────────────┴─────────────────────────────────┘
```

---

## 📦 INVENTÁRIO DE CÓDIGO (12 arquivos)

### LEITORES (entrada → pvs + trechos)

| # | Arquivo | Linhas | O que faz | Quando usar |
|---|---------|--------|-----------|-------------|
| 1 | `ler_dxf_gdal.py` | 395 | Lê DXF do ProSaneamento. GDAL+pyogrio. Clustering scipy. Auto-naming junctions grau≥2. Água + Esgoto. | Recebeu DXF de projeto |
| 2 | `ler_dwg_aec.py` | 316 | Lê DWG do Civil 3D com AEC Proxy trancado. Converte via libredwg. Parseia labels PV. Reconstrói topologia por nomes. | Recebeu DWG com Pipe Network |
| 3 | `ler_landxml.py` | 155 | Lê LandXML exportado do Civil 3D. Parseia Structures + Pipes direto. | Civil 3D exportou LandXML |

### GERADORES (pvs + trechos → saídas)

| # | Arquivo | Linhas | O que gera | Formatos |
|---|---------|--------|------------|----------|
| 4 | `gerar_ns.py` | 544 | Notas de Serviço de campo | PDF A4, JSON, HTML Leaflet, GeoJSON |
| 5 | `gerar_civil3d.py` | 803 | Pacote Civil 3D completo | LandXML, DXF cadastro, Dynamo .py, AutoCAD .scr, JSON |
| 6 | `gerar_cadastro_nts292.py` | 458 | Cadastro as-built georref | DXF SIRGAS 2000 UTM 23S + Meta JSON |
| 7 | `gerar_ifc_lod500.py` | 184 | IFC 3D real LOD 500 | IFC 2x3 (SweptDiskSolid + ExtrudedAreaSolid) + CSV + JSON |
| 8 | `gerar_project_xml.py` | 276 | Cronograma | MS Project XML com WBS por fase |

### ORQUESTRADOR

| # | Arquivo | Linhas | O que faz |
|---|---------|--------|-----------|
| 9 | `construdata_pipeline.py` | 203 | Detecta formato, chama leitor certo, roda todos os geradores |

### INTERFACES HTML

| # | Arquivo | Linhas | O que faz |
|---|---------|--------|-----------|
| 10 | `construdata_editor.html` | 1054 | Editor de rede estilo EPANET — cria PV, conecta, edita, NS, cadastro |
| 11 | `construdata_manage.html` | 310 | Viewer 3D (Three.js) — 5 modos, 4D timeline, click→propriedades |
| 12 | `construdata_controle.html` | 576 | Controle de obra — As-Built, Medição BM, Curva S, Resumo 5D |

**TOTAL: 5.274 linhas de código · 12 arquivos · 337 KB**

---

## 🔧 COMO USAR CADA SCRIPT

### 1. Ler projeto (escolha UM)

```python
# DXF ProSaneamento (mais comum)
from ler_dxf_gdal import ler_dxf_gdal
pvs, trechos, ruas, meta = ler_dxf_gdal("NUCLEO_ESGOTO.dxf")

# DWG Civil 3D (AEC Proxy)
from ler_dwg_aec import ler_dwg_aec
pvs, trechos, meta = ler_dwg_aec("PROLONGAMENTO.dwg")

# LandXML
from ler_landxml import ler_landxml
pvs, trechos = ler_landxml("EXPORT_CIVIL3D.xml")
```

### 2. Gerar tudo (roda TODOS)

```python
# Opção A: Pipeline automático (1 comando)
# python construdata_pipeline.py NUCLEO.dxf "Nome do Núcleo" ./saida/

# Opção B: Manual (controle total)
from gerar_ns import gerar_ns_a4, gerar_geojson, enriquecer_trechos
from gerar_civil3d import gerar_landxml, gerar_cadastro_dxf, gerar_dynamo_script, gerar_autocad_scr
from gerar_cadastro_nts292 import gerar_cadastro_nts292
from gerar_ifc_lod500 import gerar_ifc_lod500
from gerar_project_xml import gerar_project_xml

# NS
trechos_enriquecidos = enriquecer_trechos(trechos, pvs)
for i, tr in enumerate(trechos_enriquecidos):
    gerar_ns_a4(i+1, tr, pvs, "Nome Núcleo", f"NS_{i+1:03d}.pdf")

# GeoJSON
gerar_geojson(trechos_enriquecidos, pvs, "rede.geojson")

# Civil 3D
gerar_landxml(pvs, trechos, "Nome Núcleo", "esgoto.xml")
gerar_cadastro_dxf(pvs, trechos, "Nome Núcleo", "./cadastro_dxf/")
gerar_dynamo_script(pvs, trechos, "Nome Núcleo", "criar_pipe.py")
gerar_autocad_scr(pvs, trechos, "Nome Núcleo", "desenhar.scr")

# Cadastro NTS 292
gerar_cadastro_nts292(pvs, trechos, "Nome Núcleo", "./cadastro/")

# IFC LOD 500 (geometria 3D real)
gerar_ifc_lod500(pvs, trechos, "Nome Núcleo", "./ifc/")

# Cronograma
gerar_project_xml(pvs, trechos, "Nome Núcleo", "./cronograma/")
```

### 3. Editor visual (navegador)

```
Abrir construdata_editor.html no Chrome/Edge/Firefox
→ Atalhos: P=PV, T=Tubo, V=Selecionar, M=Mover, Del=Apagar, F=Zoom, Ctrl+Z=Desfazer
→ Importar JSON existente: botão 📂
→ Exportar rede: botão 💾
→ Gerar NS: botão 📋
```

---

## 📋 FORMATO INTERNO (pvs + trechos)

Todo o sistema gira em torno desses dois dicts. Qualquer leitor gera eles, qualquer gerador consome eles.

### pvs (dict)
```python
pvs = {
    "PV01": {
        "x": 362293.456,      # Easting UTM SIRGAS 2000 23S
        "y": 7352565.123,     # Northing
        "ct": 5.20,           # Cota Terreno (m) — do levantamento topo
        "cf": 3.70,           # Cota Fundo (m) — do projeto
        "prof": 1.50,         # Profundidade = CT - CF
        "tipo": "esgoto",     # "esgoto" ou "agua"
        "material_pv": "CONCRETO",  # CONCRETO, PEAD, FFD
    },
    "PV02": { ... },
}
```

### trechos (list)
```python
trechos = [
    {
        "pv_ini": "PV01",     # PV montante
        "pv_fim": "PV02",     # PV jusante
        "dn_mm": 200,         # Diâmetro nominal (mm)
        "ext_m": 14.5,        # Extensão (m)
        "decl_mm": 8.5,       # Declividade (‰)
        "material": "PVC",    # PVC, PEAD, PE 80, PE 100, CONCRETO
        "tipo": "esgoto",     # "esgoto" ou "agua"
    },
    { ... },
]
```

---

## 🧮 CÁLCULOS AUTOMÁTICOS

### Manning (esgoto)
```
V = (1/n) × Rh^(2/3) × I^(1/2)
Q = V × A × 1000 (L/s)
τ = γ × Rh × I (Pa)

n = 0.013 (PVC) | 0.011 (PEAD) | 0.015 (Concreto)
```

### Custo 5D (por trecho)
```
Custo_tubo     = preço_unit_tubo × extensão
Custo_escav    = preço_m³ × extensão × prof_média × largura_vala
Custo_reaterro = preço_m³ × vol_escav × 0.85
Custo_repav    = preço_m² × extensão × largura_vala
Custo_PV       = preço_unitário × 1

⚠️ PREÇOS VÊM DA SUA TABELA DO CONTRATO (não SINAPI fixo)
```

### IFC Geometria
```
Tubo  → IfcSweptDiskSolid (raio_ext = DN/2, raio_int = DN/2 × 0.9)
PV    → IfcExtrudedAreaSolid (raio = 0.6m PV / 0.3m PI, altura = prof)
Ambos → PropertySets: Dados_Tecnicos + SABESP_Hidraulica + Custo5D
```

---

## 📊 CICLO DE VIDA DA OBRA

```
PROJETO          CAMPO            ESCRITÓRIO       SABESP
   │                │                  │              │
   ▼                ▼                  ▼              ▼
┌──────┐      ┌──────────┐      ┌──────────┐   ┌──────────┐
│DXF/  │─────▶│NS de     │─────▶│As-Built  │──▶│Cadastro  │
│DWG/  │      │campo     │      │(topo     │   │NTS 292   │
│XML   │      │(PDF A4)  │      │ mede)    │   │→ SIGNOS  │
└──┬───┘      └──────────┘      └────┬─────┘   └──────────┘
   │                                  │
   ▼                                  ▼
┌──────────────────────────────────────────────┐
│            MEDIÇÃO PELA NS                    │
│                                              │
│  NS executada → entra no BM mensal           │
│  BM aprovado → pagamento                     │
│  Sem cadastro NTS 292 → NÃO paga (pág.64)   │
│                                              │
│  Curva S: previsto × real                    │
│  Cronograma: macro (núcleo) + micro (NS)    │
│  IFC 5D: custo vinculado à geometria 3D     │
└──────────────────────────────────────────────┘
```

---

## 📁 DEPENDÊNCIAS PYTHON

```bash
pip install geopandas pyogrio shapely scipy ezdxf pyproj ifcopenshell numpy
# Para converter DWG: compilar libredwg (https://github.com/LibreDWG/libredwg)
```

---

## ⚙️ CONFIGURAÇÕES

### CRS
- **EPSG:31983** — SIRGAS 2000 UTM Zone 23S
- Datum Vertical: Imbituba-SC

### Manning n
| Material | n |
|----------|---|
| PVC | 0.013 |
| PEAD | 0.011 |
| PE 80 / PE 100 | 0.011 |
| Concreto | 0.015 |

### DNs suportados
- **Esgoto:** 100, 150, 200, 250, 300, 400, 500, 600 mm
- **Água:** 32, 50, 63, 75, 110, 160, 200, 250, 315 mm

---

## 🚧 A CONSTRUIR (próximos passos)

| Módulo | Prioridade | Descrição |
|--------|-----------|-----------|
| `motor_custo.py` | 🔴 ALTA | Importar tabela de preços do contrato (CSV/Excel) e aplicar automaticamente por NS |
| `motor_medicao.py` | 🔴 ALTA | NS executada → BM mensal → Curva S automática |
| Pipe Network paramétrico | 🟡 MÉDIA | Mexer PV → recalcula extensão → declividade → Manning → custo → geometria em cascata |
| `gerar_primavera.py` | 🟡 MÉDIA | Export Primavera P6 (formato XER) |
| `gerar_openproject.py` | 🟡 MÉDIA | Export OpenProject (CSV com WBS) |
| `ler_pdf_projeto.py` | 🟢 BAIXA | Ler tabelas de projeto em PDF → pvs + trechos |
| Cronograma macro multinúcleo | 🟡 MÉDIA | WBS: Contrato → Núcleo → Fase → NS, todos núcleos num Project só |

---

## 🔑 REGRAS INVIOLÁVEIS

1. **NUNCA** "DGS Engenharia" — sempre "FCN Construções e Saneamento"
2. **Plataforma** = "ConstruData - HydroNetwork"
3. **Custos** = vêm da tabela do contrato, NÃO do SINAPI fixo
4. **Medição** = pela Nota de Serviço (1 NS = 1 trecho)
5. **Cadastro** = condição para pagamento (contrato pág. 64)
6. **Água + Esgoto** = sempre ambos, nunca só um
7. **CRS** = EPSG:31983 (SIRGAS 2000 UTM 23S)
