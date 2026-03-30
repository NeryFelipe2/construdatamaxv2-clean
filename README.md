# ConstruData SABESP v5.0 — Pipeline BIM
> SE LIGA NA REDE · Contrato 11481051 · DGS Engenharia & Arquitetura  
> Autor: Felipe Nery + Claude (Anthropic) · Março/2026

---

## Visão Geral

Script Python unificado que lê DXF do ProSaneamento/Civil 3D e gera automaticamente todo o pacote de Notas de Serviço (NS) no padrão SABESP, incluindo BIM/IFC LOD500, QR Codes, GeoJSON e script Dynamo para Civil 3D 2025/2026.

**Substitui:** `main.py`, `pipeline_dxf.py`, `construdata_engine.py`, `gerar_ns.py`, `calculos.py`, `validacoes.py`, `ns_cartografia.py`, `gerar_json_v4.py`, `integrador_ns_planejador.py`, `ler_dxf_prosaneamento.py`, `run_todos_nucleos.py`

---

## Instalação

```bash
pip install openpyxl matplotlib ezdxf networkx pyproj ifcopenshell "qrcode[pil]" Pillow
# Opcional (GPKG):
pip install geopandas pyogrio
```

Windows — duplo clique em `INSTALAR.bat`

---

## Uso Rápido

```bash
# DXF esgoto
python ConstruData_SABESP_v5.py CRIADORES_ESGOTO.dxf --nucleo "Vila Criadores"

# DXF água com cartografia
python ConstruData_SABESP_v5.py AGUA.dxf --tipo agua --gpkg MAPA.gpkg

# A partir de JSON
python ConstruData_SABESP_v5.py --json rede_definida.json

# Com QR Code linkando dashboard online
python ConstruData_SABESP_v5.py ESGOTO.dxf \
    --nucleo "Morro do Teteu" \
    --base-url "https://obra.sabesp.gov.br/slnr/"

# Todos os núcleos em lote
python ConstruData_SABESP_v5.py --batch

# Debug (só 5 NS)
python ConstruData_SABESP_v5.py ESGOTO.dxf --max-ns 5 --debug
```

---

## Argumentos CLI

| Argumento | Descrição |
|-----------|-----------|
| `dxf` | Caminho do DXF ProSaneamento |
| `--json ARQUIVO` | Ler de `rede_definida.json` ou `rede_esgoto_dynamo.json` |
| `--nucleo "Nome"` | Nome do núcleo |
| `--saida PASTA` | Pasta raiz de saída (default: `SAIDA_BIM_SABESP`) |
| `--gpkg ARQUIVO` | GPKG de cartografia |
| `--tipo agua\|esgoto` | Forçar tipo de rede |
| `--base-url URL` | URL base para QR Code |
| `--quant ARQUIVO` | Quantitativos de campo `.txt`/`.rtf` |
| `--batch` | Processar todos os núcleos configurados |
| `--max-ns N` | Limitar NS (debug) |
| `--debug` | Traceback completo |

---

## Estrutura de Saída

```
SAIDA_BIM_SABESP/
└── NUCLEO/
    ├── 01_NS_CAMPO/
    │   ├── NS_001_PVI_AO_PVF/
    │   │   ├── NS_001_A4.pdf          OS campo A4 + QR Code
    │   │   ├── NS_001_DADOS.json      Dados técnicos
    │   │   └── NS_001_QR.png          QR Code standalone
    │   └── NS_NNN_.../ ...
    ├── 02_OSE/
    │   ├── NS_001_OSE.xlsx            Planilha OSE padrão SABESP
    │   └── ...
    ├── 03_DESENHOS/
    │   ├── NS_001_DESENHO.pdf         Prancha A3: Planta + Perfil + Tabela
    │   └── ...
    ├── 04_HTML/
    │   ├── NS_001.html                Dashboard Leaflet + perfil SVG
    │   └── ...
    ├── 05_GIS/
    │   ├── rede_definida.json         GeoJSON EPSG:31983
    │   └── rede_dynamo.json           JSON Civil 3D 2025/2026
    ├── 06_BIM/
    │   └── REDE_NUCLEO.ifc            IFC LOD500 rede completa
    ├── 06_EXCEL/
    │   └── CUSTOS_POR_TRECHO.xlsx     Custos SINAPI + BDI
    └── 07_LOG/
        ├── dynamo_pipe_network_v5.py  Script Dynamo CPython3
        └── log_processamento.json    Log completo
```

---

## API Python — Uso como Módulo no VSCode

```python
from ConstruData_SABESP_v5 import (
    ler_dxf, ler_json_rede,
    enriquecer_trechos, validar_rede,
    gerar_ns_completa, processar,
    calc_manning, calc_quantitativos,
    gerar_ifc, gerar_qr_png,
    gerar_rede_geojson, gerar_rede_dynamo,
    ler_quantitativo_campo,
)
from pathlib import Path

# ── Ler DXF ──────────────────────────────────────────────────────────────────
pvs, trechos, ruas, meta = ler_dxf("CRIADORES_ESGOTO.dxf")
# pvs     : dict {nome: {x, y, ct, cf, prof, tipo}}
# trechos : list de dicts com pv_ini, pv_fim, dn_mm, ext_m, rua, ...
# meta    : {arquivo, tipo_rede, n_pvs, n_trechos}

# ── Ou ler JSON ───────────────────────────────────────────────────────────────
pvs, trechos, ruas, meta = ler_json_rede("rede_definida.json")

# ── Enriquecer (Manning + Quant + Custos) ────────────────────────────────────
trechos = enriquecer_trechos(trechos, pvs)
# Cada trecho ganha:
#   hidraulica:    {vel_ms, vazao_ls, tau_pa, status}
#   quantitativos: {esc_m3, lastro_m3, reat_m3, pav_m2, tubo_barras}
#   custos:        {tubo_R, escavacao_R, total_R, bdi_pct}

# ── Validar rede ─────────────────────────────────────────────────────────────
erros, avisos = validar_rede(pvs, trechos)
# V001=DN reduz, V002=sifão, V003=desconectado
# V004=ciclo, V005=prof, V006=declividade, V007=V, V008=τ

# ── Gerar uma NS individualmente ─────────────────────────────────────────────
cfg = {
    "contrato":   "11481051",
    "empresa":    "CONSÓRCIO SE LIGA NA REDE",
    "cidade":     "SANTOS-SP",
    "nucleo":     "Vila Criadores",
    "engenheiro": "Felipe Nery",
}
trechos[0]["ns_id"] = "001"

resultado = gerar_ns_completa(
    trechos[0], pvs, "001",
    pasta_raiz=Path("saida/01_NS_CAMPO"),
    cfg=cfg,
    pastas_extras={
        "ose":      Path("saida/02_OSE"),
        "desenhos": Path("saida/03_DESENHOS"),
        "html":     Path("saida/04_HTML"),
        "bim":      Path("saida/06_BIM"),
    },
    ns_base_url="https://sabesp.gov.br/slnr/",
)
# resultado["arquivos"] = {"A4": "..._A4.pdf", "OSE": "..._OSE.xlsx", ...}

# ── Pipeline completo ─────────────────────────────────────────────────────────
r = processar(
    dxf_path="CRIADORES_ESGOTO.dxf",
    pasta_saida="SAIDA_BIM_SABESP",
    nucleo="Vila Criadores",
    ns_base_url="https://obra.sabesp.gov.br/slnr/",
)
# r["ns_ok"]    → NS geradas com sucesso
# r["ns_erros"] → NS com erro
# r["raiz"]     → pasta raiz da saída

# ── Cálculos isolados ─────────────────────────────────────────────────────────
hid = calc_manning(dn_mm=200, decl_mm=0.005, material="PVC")
# {"vel_ms": 0.924, "vazao_ls": 29.0, "tau_pa": 3.84, "status": "OK"}

q = calc_quantitativos(ext_m=30.0, prof_media_m=1.5, dn_mm=200)
# {"esc_m3": 22.5, "reat_m3": 16.2, "pav_m2": 28.8, "tubo_barras": 5}

# ── IFC isolado ───────────────────────────────────────────────────────────────
gerar_ifc(pvs, trechos, Path("rede.ifc"), cfg, meta)

# ── QR Code ───────────────────────────────────────────────────────────────────
img = gerar_qr_png("https://sabesp.gov.br/NS_001.html")
img.save("NS_001_QR.png")

# ── GIS ───────────────────────────────────────────────────────────────────────
gerar_rede_geojson(pvs, trechos, Path("05_GIS"))
gerar_rede_dynamo(pvs, trechos, Path("05_GIS"), meta, cfg)

# ── Quantitativos de campo ────────────────────────────────────────────────────
q_campo = ler_quantitativo_campo("QUANTITATIVO_20.txt")
# {"extensao_m": 134.81, "esc_m3": 113.64, "aterro_m3": 99.72, "pav_m2": 85.21}
```

---

## Módulos

| # | Módulo | Funções principais |
|---|--------|--------------------|
| 02 | Leitura DXF | `ler_dxf()`, `ler_json_rede()` |
| 03 | Enriquecimento | `enriquecer_trechos()`, `calc_manning()`, `calc_quantitativos()` |
| 04 | Validação | `validar_rede()` — V001–V008 (networkx) |
| 05 | Cartografia | `ler_cartografia_gpkg()` |
| 06 | NS A4 | `gerar_ns_a4_com_qr()` |
| 07 | NS Desenho | `gerar_ns_desenho_com_qr()` |
| 08 | OSE xlsx | `gerar_ns_ose()` — formato NS_017rev1 |
| 09 | Dados JSON | `gerar_ns_dados_json()` |
| 10 | HTML Leaflet | `gerar_ns_html()` |
| 11 | Orquestrador | `gerar_ns_completa()` |
| 12 | GIS | `gerar_rede_geojson()`, `gerar_rede_dynamo()` |
| 13 | Custos | `gerar_excel_custos()` |
| 14 | Dynamo | `gerar_dynamo_script()` |
| 15 | Pipeline | `processar()` |
| 16 | Batch | `processar_batch()` |
| 17 | IFC LOD500 | `gerar_ifc()` |
| 18 | QR Code | `gerar_qr_png()`, `salvar_qr_png()` |
| 19 | Quant campo | `ler_quantitativo_campo()` |

---

## Correções v5.0

### Ruas — `Sem Rua` em 100% dos trechos (bug crítico)
`PS_DATRUA` no XDATA estava vazio. Ruas ficam em `TEXT/MTEXT` nos layers `A_Alerta` / `TXT-LOGRAD`. O ezdxf lia em UTM (~358.000, 7.353.000) mas PVs/tubos estão em espaço local (~-500, -130) — distância de 7M metros, snap impossível.  
**Fix:** coletar `TEXT/MTEXT` no parser raw, mesmo loop que lê XDATA. **134/134 com rua.**

### CT/CF invertidos
`reals[3]` do `PH_DATCNX` = CF (geratriz inferior), não CT.  
**Fix:** `cf = reals[3]`, `ct = cf + prof`

### DN errado (`DN6` em vez de `DN300`)
`reals[0]` é flag de versão (`6.0`).  
**Fix:** `strs[1]` do `PH_DATTUB` = DN explícito (`"300"`, `"200"`)

### Encoding
**Fix:** `_limpar_encoding()` — `Ã\x89 → É`, `Ã\xa3 → ã`, `\\P → espaço`

---

## Núcleos (Batch)

Edite `NUCLEOS_BATCH` no script:

```python
NUCLEOS_BATCH = [
    {"nucleo": "São Manoel",     "dxf": r"C:\...\SÃO_MANOEL_ESGOTO.dxf",   "gpkg": r"...gpkg"},
    {"nucleo": "João Carlos",    "dxf": r"C:\...\JOÃO_CARLOS_ESGOTO.dxf",  "gpkg": r"...gpkg"},
    {"nucleo": "Vila Criadores", "dxf": r"C:\...\CRIADORES_ESGOTO.dxf",    "gpkg": r"...gpkg"},
    {"nucleo": "Pantanal Baixo", "dxf": r"C:\...\PANTANAL_ESGOTO.dxf",     "gpkg": r"...gpkg"},
    {"nucleo": "Morro do Teteu", "dxf": r"C:\...\TETEU_ESGOTO.dxf",        "gpkg": r"...gpkg"},
    {"nucleo": "Vila Israel",    "dxf": r"C:\...\ISRAEL_ESGOTO.dxf",       "gpkg": None},
]
```

---

## Projeto

**SE LIGA NA REDE** — Consórcio SLNR Santos  
**Contrato SABESP:** 11481051  
**CRS:** SIRGAS 2000 UTM Zona 23S (EPSG:31983)  
**Núcleos:** São Manoel · João Carlos · Vila Criadores · Pantanal Baixo · Morro do Teteu · Vila Israel
