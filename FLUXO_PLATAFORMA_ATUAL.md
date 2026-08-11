# FLUXO DA PLATAFORMA CONSTRUDATA — 25/03/2026

## O que funciona HOJE (testado e validado)

```
╔══════════════════════════════════════════════════════════════════╗
║                        ENTRADAS ACEITAS                         ║
╠═══════════════╦═══════════════╦═══════════════╦═════════════════╣
║  .DWG BIM     ║  .DXF ProSane ║  .XML LandXML ║  .JSON rede     ║
║  Civil 3D     ║  XDATA/textos ║  Civil 3D exp ║  formato interno║
║  Pipe Network ║  PS_PONTOS    ║  Struct+Pipe  ║  pvs+trechos    ║
╠═══════════════╬═══════════════╬═══════════════╬═════════════════╣
║ ler_dwg_aec   ║ ler_dxf()     ║ ler_landxml() ║ ler_json_rede() ║
║ COM win32com  ║ ezdxf+XDATA   ║ ElementTree   ║ json.load()     ║
║ 116 PVs+130tr ║ 61 PVs+67tr   ║ 492 PVs+458tr ║ qualquer        ║
╚═══════╦═══════╩═══════╦═══════╩═══════╦═══════╩════════╦════════╝
        ║               ║               ║                ║
        ╚═══════════════╩═══════╦═══════╩════════════════╝
                                ║
                                ▼
╔══════════════════════════════════════════════════════════════════╗
║                    FORMATO INTERNO ÚNICO                        ║
║                                                                  ║
║  pvs = {"PV-934": {x, y, ct, cf, prof, tipo, material_pv}}     ║
║  trechos = [{pv_ini, pv_fim, dn_mm, ext_m, material, tipo}]    ║
║                                                                  ║
║  TODOS os módulos leem e geram esse formato                     ║
╚════════════════════════════╦═════════════════════════════════════╝
                             ║
                             ▼
╔══════════════════════════════════════════════════════════════════╗
║                      ENRIQUECIMENTO                             ║
║                                                                  ║
║  Manning: V = (1/n) × Rh^(2/3) × I^(1/2)                      ║
║  → velocidade (m/s), vazão (l/s), tensão trativa (Pa)           ║
║  → status: OK / VERIFICAR / SEM_DADOS                           ║
║                                                                  ║
║  Quantitativos: escavação, lastro, reaterro, pavimentação       ║
║  Custos: R$ 910/m (composição 8 itens + BDI 25%)               ║
╚════════════════════════════╦═════════════════════════════════════╝
                             ║
                             ▼
╔══════════════════════════════════════════════════════════════════╗
║                       VALIDAÇÃO (NetworkX)                      ║
║                                                                  ║
║  V001: DN reduz (afogamento)    V005: prof < 0.30m              ║
║  V002: sifão (CF sobe)          V006: decl < 0.2%               ║
║  V003: partes desconectadas     V007: V < 0.6 m/s              ║
║  V004: ciclos                   V008: tau < 1.0 Pa             ║
╚════════════════════════════╦═════════════════════════════════════╝
                             ║
                             ▼
╔══════════════════════════════════════════════════════════════════╗
║                    GERAÇÃO DE NS (por trecho)                   ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Para CADA trecho da rede, gera 5 arquivos:                     ║
║                                                                  ║
║  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────┐ ║
║  │ NS_001_A4.pdf   │  │ NS_001_DESENHO   │  │ NS_001_OSE     │ ║
║  │ Nota de campo   │  │ .pdf             │  │ .xlsx          │ ║
║  │ A4 landscape    │  │ Planta+Perfil A3 │  │ Planilha SABESP│ ║
║  └─────────────────┘  └──────────────────┘  └────────────────┘ ║
║                                                                  ║
║  ┌─────────────────┐  ┌──────────────────┐                     ║
║  │ NS_001_DADOS    │  │ NS_001.html      │                     ║
║  │ .json           │  │ Dashboard        │                     ║
║  │ Dados técnicos  │  │ Leaflet + perfil │                     ║
║  └─────────────────┘  └──────────────────┘                     ║
║                                                                  ║
╚════════════════════════════╦═════════════════════════════════════╝
                             ║
                             ▼
╔══════════════════════════════════════════════════════════════════╗
║                    SAÍDAS GLOBAIS (por núcleo)                  ║
╠═════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  GIS                         BIM                                ║
║  ├─ rede_definida.geojson    ├─ REDE_NUCLEO.ifc (LOD 500)     ║
║  ├─ rede_dynamo.json         │  SweptDiskSolid + PropertySets  ║
║  └─ dynamo_pipe_network.py   └─ CSV LOD 500                   ║
║                                                                  ║
║  HTML                        Excel                              ║
║  ├─ REDE_GERAL.html          ├─ CUSTOS_POR_TRECHO.xlsx        ║
║  └─ DASHBOARD_QUALIDADE.html └─ COMPARATIVO_PROSANE.xlsx      ║
║                                                                  ║
║  Cronograma                  Log                                ║
║  └─ MS Project XML           └─ log_processamento.json         ║
║     (WBS 12 fases)                                              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## Estrutura de pastas gerada

```
SAIDA_BIM_SABESP/
└── SÃO_MANOEL_E_JOÃO_CARLOS/
    ├── 01_NS_CAMPO/
    │   ├── NS_001_PV-1136_AO_PV-1126/
    │   │   ├── NS_001_A4.pdf
    │   │   ├── NS_001_DESENHO.pdf
    │   │   ├── NS_001_OSE.xlsx
    │   │   ├── NS_001_DADOS.json
    │   │   └── NS_001.html
    │   ├── NS_002_.../
    │   └── ... (130 NS para este DWG)
    ├── 02_OSE/
    ├── 03_DESENHOS/
    ├── 04_HTML/
    │   ├── REDE_GERAL.html
    │   └── DASHBOARD_QUALIDADE.html
    ├── 05_GIS/
    │   ├── rede_definida.geojson
    │   ├── rede_dynamo.json
    │   └── dynamo_pipe_network_v5.py
    ├── 06_BIM/
    │   └── REDE_SÃO_MANOEL_E_JOÃO_CARLOS.ifc
    ├── 06_EXCEL/
    │   ├── CUSTOS_POR_TRECHO.xlsx
    │   └── COMPARATIVO_PROSANEAMENTO.xlsx
    └── 07_LOG/
        └── log_processamento.json
```

---

## Como usar

```bash
# DWG BIM (Civil 3D Pipe Network) — NOVO!
python construdata_sabesp_v5_FINAL.py "ARQUIVO.dwg" --nucleo "Nome"

# DXF ProSaneamento (fluxo original)
python construdata_sabesp_v5_FINAL.py "ARQUIVO.dxf" --nucleo "Nome"

# LandXML exportado do Civil 3D
python construdata_sabesp_v5_FINAL.py "ARQUIVO.xml" --nucleo "Nome"

# JSON de rede definida
python construdata_sabesp_v5_FINAL.py --json "rede.json" --nucleo "Nome"

# Batch (todos os núcleos)
python construdata_sabesp_v5_FINAL.py --batch

# GUI desktop
python construdata_gui.py
```

---

## Redes processadas e validadas

| Rede | Formato | PVs | Trechos | Extensão | NS | CT/CF |
|------|---------|-----|---------|----------|-----|-------|
| São Manoel + João Carlos | **DWG BIM** | **116** | **130** | **4.887m** | **130** | **100%** |
| Pantanal Baixo | DXF | 165 | 137 | 7.700m | 137 | OK |
| Verde e Teteu | DXF | 357 | 180 | 2.621m | 180 | OK |
| Prol. Teteu Alt-01 | XML | 147 | 141 | 6.363m | 141 | OK |
| Prol. Teteu | XML | 149 | 143 | 6.420m | 143 | OK |
| Prol. Pantanal | XML | 29 | 25 | 1.261m | 25 | OK |
| Prol. Criadores | XML | 76 | 70 | 2.689m | 70 | OK |
| Prol. São Manoel | XML | 91 | 79 | 5.143m | 79 | OK |
| **TOTAL** | | **1.130+** | **905+** | **~37 km** | **905+** | |

---

## Fluxo detalhado do DWG BIM (novo)

```
ARQUIVO.dwg
    │
    ▼
┌─────────────────────────────────────┐
│ CAMADA 1: COM automation            │
│ win32com → Civil 3D (Visible=False) │
│ Itera 8527 entidades ModelSpace     │
│ AeccDbStructure → PVs (CT, CF)      │
│ AeccDbPipe → Trechos (DN, slope)    │
│ Resultado: 116 PVs + 130 trechos   │
└──────────────┬──────────────────────┘
               │ Se COM falhar:
               ▼
┌─────────────────────────────────────┐
│ CAMADA 2: DXF text parser           │
│ accoreconsole → SAVEAS DXF          │
│ geopandas lê textos (PV10\nCTF=..) │
│ Resultado: 5 PVs + CTF relativo    │
└──────────────┬──────────────────────┘
               │
               ▼
         pvs + trechos
               │
               ▼
     (mesmo pipeline de sempre)
```

---

*ConstruData SABESP v5.0 — FCN Construções e Saneamento*
*Contrato 11481051 — SE LIGA NA REDE — Santos/SP*
*25/03/2026*
