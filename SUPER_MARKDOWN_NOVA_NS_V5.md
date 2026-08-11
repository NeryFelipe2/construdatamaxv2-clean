# NOVA NS Versao 5 — Plataforma BIM/GIS de Notas de Servico SABESP

> **Consorcio SE LIGA NA REDE (SLNR)** · **Contrato SABESP 11481051** · Santos/SP
> **CRS de referencia:** SIRGAS 2000 / UTM Zona 23S — **EPSG:31983**
> **Autoria:** Felipe Nery (+ Claude / Anthropic) · Plataforma *ConstruData — HydroNetwork*
> Baseado em `README.md`, `MANUAL_DEFINITIVO_PLATAFORMA.md` e `FLUXO_PLATAFORMA_ATUAL.md`.

---

> **Documento gerado por analise automatizada multi-agente** · 2026-06-04  
> Escopo varrido: ~1.280 arquivos `.py` e ~1.070 arquivos `.md` na raiz `NOVA NS Versao 5/`  
> Repositorio Git: `NeryFelipe2/NOVA-NS-Versao-5` · branch ativa `fix/tubos-fantasmas-polylines`

---

## Indice

- [Visao Geral](#visao-geral)
- [Stack Tecnologica](#stack-tecnologica)
- [Arquitetura](#arquitetura)
- [Motor Monolitico de Geracao de NS](#motor-monolitico-de-geracao-de-ns)
- [Motores Analiticos e de ML](#motores-analiticos-e-de-ml)
- [Leitores e Importadores CAD/GIS](#leitores-e-importadores-cadgis)
- [Geradores de Saida (NS, BIM, Civil 3D, Cronograma)](#geradores-de-saida-ns-bim-civil-3d-cronograma)
- [Arquitetura Web (API / Backend / Core)](#arquitetura-web-api-backend-core)
- [Campo, RDO e Ciclo Operacional](#campo-rdo-e-ciclo-operacional)
- [Cadastro Tecnico e Topografia](#cadastro-tecnico-e-topografia)
- [Analytics Operacional, BI e Financeiro](#analytics-operacional-bi-e-financeiro)
- [Interfaces Graficas (Desktop GUI e HTML)](#interfaces-graficas-desktop-gui-e-html)
- [Integracoes, Automacao e Infraestrutura](#integracoes-automacao-e-infraestrutura)
- [Documentacao, Historico e Evolucao do Projeto](#documentacao-historico-e-evolucao-do-projeto)

---

## Visao Geral

A **NOVA NS Versao 5** (codinome interno *ConstruData SABESP v5.0 / HydroNetwork*) e uma plataforma BIM/GIS de geracao automatizada de **Notas de Servico (NS)** no padrao SABESP, construida para o Consorcio SE LIGA NA REDE no escopo do Contrato 11481051 (implantacao de redes de agua e esgoto nos nucleos de Santos/SP). O ponto de partida e o **projeto de engenharia em formato CAD/GIS** — DXF do ProSaneamento, DWG de Pipe Network do Civil 3D, LandXML exportado do Civil 3D, ou JSON de rede ja definida. Todos esses formatos sao convertidos para um **formato interno unico** descrito em `FLUXO_PLATAFORMA_ATUAL.md`: um dicionario `pvs = {nome: {x, y, ct, cf, prof, tipo, material_pv}}` e uma lista `trechos = [{pv_ini, pv_fim, dn_mm, ext_m, material, tipo}]`. Conforme a "regra inviolavel" 11 do manual, esse par `pvs + trechos` e tratado como contrato de dados sagrado: todos os leitores produzem e todos os geradores consomem exatamente essa estrutura.

A partir desse modelo unificado a plataforma executa, em sequencia, **enriquecimento hidraulico** (formula de Manning para velocidade, vazao e tensao trativa), **calculo de quantitativos e custos** (composicao do contrato a R$ 910/m com BDI 25%) e **validacao topologica e normativa** das redes (regras V001 a V008 sobre grafo NetworkX). Em seguida, para **cada trecho** da rede, gera o pacote completo de NS: PDF A4 de nota de campo com QR Code, PDF A3 de desenho (planta + perfil longitudinal + imagem de satelite), planilha OSE `.xlsx` no padrao SABESP, JSON de dados tecnicos e dashboard HTML Leaflet interativo. No nivel de nucleo, produz ainda os entregaveis georreferenciados e de interoperabilidade: **GeoJSON EPSG:31983**, **IFC LOD 500** (geometria 3D real com `IfcSweptDiskSolid` e PropertySets de hidraulica/custo/perdas), cadastro **DXF as-built conforme NTS 292**, script **Dynamo** para Civil 3D 2025/2026, script `.scr` de AutoCAD e **LandXML** de retorno.

Alem da geracao documental, a plataforma cobre o ciclo de obra de ponta a ponta. O **microplanejamento** classifica cada trecho por morfologia do terreno (planicie, encosta, morro, mangue, viela) e dimensiona equipe, equipamento, produtividade e duracao; os **cronogramas** sao exportados em multiplos formatos (MS Project XML com WBS de 12 fases, Oracle Primavera P6 XER, OpenProject CSV). A **operacao de campo** e suportada por interfaces de RDO (Relatorio Diario de Obra) e por um motor de WhatsApp (Evolution API + Node.js) integravel a automacoes n8n, alimentando a **medicao** (Boletins de Medicao vinculados 1 NS = 1 trecho) e a camada de **analytics/BI/ML**: previsao de producao com XGBoost, analise de gargalos, simulacao de cenarios de aceleracao, gestao de perdas pela metodologia IWA (UARL/ILI) e consultas em linguagem natural via LLMs gratuitos (Gemini, Groq, Mistral, Cohere).

Em numeros consolidados pelo `MANUAL_DEFINITIVO_PLATAFORMA.md`, a plataforma reune 22 scripts Python de producao, 7 interfaces HTML, 1 GUI desktop de 12 abas, mais de 130 funcoes publicas e a classe parametrica `PipeNetwork`, tendo gerado **836 NS com zero erros sobre ~39 km de rede validada** entre os nucleos de Santos (Sao Manoel, Joao Carlos, Vila Criadores, Pantanal Baixo, Morro do Teteu/Verde e Teteu e Vila Israel). As secoes seguintes deste documento detalham, modulo a modulo, cada subsistema.

> Observacao de nomenclatura: a base documental mistura referencias a "FCN Construções e Saneamento" (cabecalho do `README.md`) e a "FCN Construcoes e Saneamento" (manual), sendo esta ultima a designacao tratada como canonica pelas "regras inviolaveis" do projeto. O escopo contratual e sempre o do **Consorcio SE LIGA NA REDE / Contrato 11481051**.

---

## Stack Tecnologica

A plataforma e majoritariamente Python (nucleo de processamento), com camadas auxiliares em HTML/JS (interfaces), Node.js (WhatsApp) e .NET (addins Civil 3D). A tabela abaixo consolida as bibliotecas efetivamente citadas no `README.md` e no `MANUAL_DEFINITIVO_PLATAFORMA.md` por camada funcional.

| Camada | Tecnologias |
|--------|-------------|
| **Leitura CAD / GIS** | `ezdxf` (DXF ProSaneamento via XDATA/textos), **GDAL/OGR** (`ler_dxf_gdal.py`), `geopandas` + `pyogrio` (GPKG e parsing de textos DWG), `shapely`, `scipy` (clustering de endpoints, `fclusterdata` t=2m), `pyproj` (UTM↔lat/lon), `xml.etree.ElementTree` (LandXML 1.2), `libredwg` / `win32com` + `accoreconsole` (DWG Civil 3D Pipe Network), `networkx` (topologia e validacoes V001–V008) |
| **BIM** | `ifcopenshell` — geracao de **IFC 2x3 / LOD 500** (`IfcSweptDiskSolid` para tubos, `IfcExtrudedAreaSolid` para PVs) com PropertySets `Dados_Tecnicos`, `SABESP_Hidraulica`, `Custo5D`, `Dados_PV` |
| **Geracao de saida** | `reportlab` (PDF A4/A3: NS, desenho, satelite, perdas), `openpyxl` (OSE `.xlsx`, custos, comparativos), `matplotlib` + `contextily` (perfis longitudinais e tiles de satelite Esri), `qrcode[pil]` + `Pillow` (QR Codes das NS) |
| **ML / IA** | `xgboost` (previsao de producao, feature `rolling_3`; classificacao trecho-real-vs-ruido no mapa), `scikit-learn`, LLMs gratuitos: **Gemini Flash** (`google-genai`, multimodal foto/PDF), **Groq Llama 3.3 70B** (`groq`), **Mistral Large** (`mistralai`), **Cohere Command-R+** (`cohere`) — roteados por `motor_llm.py` |
| **Web / API** | **FastAPI** + `uvicorn` (`backend/main.py`, `api/server.py`, rotas `routes_ns.py`, `routes_cadastro.py`, `routes_campo.py`, `routes_rdo.py`, `routes_operational.py`, `routes_bi_analytics.py`, `routes_evolucao.py`); deploy em **Render**; front HTML/JS com **Leaflet** e **Three.js** |
| **GUI Desktop** | `tkinter` + `tkintermapview` (mapa Leaflet embarcado) + `contextily` — `construdata_gui.py`, 12 abas e 95 metodos |
| **Automacao / Integracao** | **n8n** (orquestracao de fluxos), **Evolution API** + Node.js (`whatsapp-motor/index.js`, `whatsapp-web.js`/Puppeteer, `@supabase`), **addin .NET para Civil 3D** (bundles `ConstruData.bundle`, `C3DRENESG4.bundle`; `civil3d_pipe_exporter` em .NET 8) |
| **Dados / Persistencia** | JSON em `~/.construdata/` (multi-contrato), `DADOS_CONTRATO.json`, `EXECUCAO_DIARIA.json` (521 dias x 6 nucleos), `ML_DATA.json`; exportacoes XLSX/CSV/GeoJSON |

---

## Arquitetura

O diagrama abaixo (Mermaid `flowchart TD`) resume o fluxo de ponta a ponta: entrada CAD/GIS → leitores → formato interno unico → enriquecimento/validacao → motor de NS → geradores → saidas, com os ramais de Web/API, Campo/RDO e Analytics/ML que consomem o mesmo modelo `pvs + trechos`.

```mermaid
flowchart TD
    subgraph ENTRADA["Entrada CAD / GIS"]
        DXF["DXF ProSaneamento\n(XDATA / PS_PONTOS)"]
        DWG["DWG Civil 3D\nPipe Network"]
        XML["LandXML 1.2\nStruct + Pipe"]
        JSON_IN["JSON rede\n(pvs + trechos)"]
        PDF_IN["PDF / Foto\n(Gemini)"]
    end

    subgraph LEITORES["Leitores e Importadores"]
        L1["ler_dxf_gdal.py\nGDAL/OGR + scipy"]
        L2["ler_dwg_aec.py\nwin32com / libredwg"]
        L3["ler_landxml.py\nElementTree"]
        L4["ler_json_rede()"]
    end

    MODELO["Formato interno unico\npvs + trechos"]

    ENRIQ["Enriquecimento\nManning V/Q/tau + Quant + Custos R$910/m + BDI 25%"]
    VALID["Validacao NetworkX\nV001-V008"]

    MOTOR["Motor de NS\ngerar_ns_completa() / processar()"]

    subgraph GERADORES["Geradores de Saida"]
        G1["NS PDF A4 + QR"]
        G2["Desenho A3 + Satelite"]
        G3["OSE .xlsx SABESP"]
        G4["IFC LOD 500"]
        G5["Cadastro NTS 292 DXF"]
        G6["GeoJSON / Dynamo / SCR / LandXML"]
        G7["Cronograma MSProject/P6/OpenProject"]
    end

    DXF --> L1
    DWG --> L2
    XML --> L3
    JSON_IN --> L4
    PDF_IN -->|Gemini| MODELO

    L1 --> MODELO
    L2 --> MODELO
    L3 --> MODELO
    L4 --> MODELO

    MODELO --> ENRIQ --> VALID --> MOTOR
    MOTOR --> G1 & G2 & G3 & G4 & G5 & G6 & G7

    MODELO --> WEB["Web / API\nFastAPI + Render\nroutes_ns / cadastro / campo"]
    WEB --> CAMPO["Campo / RDO\nRDO + WhatsApp (Evolution + n8n)"]
    CAMPO --> MEDICAO["Medicao\nBM 1 NS = 1 trecho"]
    MEDICAO --> ANALYTICS["Analytics / BI / ML\nXGBoost + Perdas IWA + LLMs"]
    MODELO --> ANALYTICS
    G3 --> MEDICAO
```

---

## Motor Monolitico de Geracao de NS

### Proposito do subsistema

O motor monolitico `ConstruData_SABESP_v5.py` (3695 linhas) e sua evolucao `construdata_sabesp_v5_FINAL.py` (6081 linhas) constituem o nucleo do pipeline BIM SABESP do projeto "SE LIGA NA REDE" (Consorcio SLNR Santos, Contrato SABESP 11481051, FCN Construções e Saneamento). O motor le projetos de rede de esgoto/agua exportados pelo ProSaneamento/Civil 3D (DXF), enriquece-os com calculos hidraulicos, quantitativos e custos, valida a topologia da rede e gera automaticamente todo o pacote de Notas de Servico (NS) no padrao SABESP, incluindo BIM/IFC LOD500, QR Codes, GeoJSON e script Dynamo para Civil 3D 2025/2026.

Conforme o cabecalho do proprio arquivo, ele **substitui** onze scripts anteriores: `main.py`, `pipeline_dxf.py`, `construdata_engine.py`, `gerar_ns.py`, `calculos.py`, `validacoes.py`, `ns_cartografia.py`, `gerar_json_v4.py`, `integrador_ns_planejador.py`, `ler_dxf_prosaneamento.py` e `run_todos_nucleos.py`. O modelo de referencia documental e o conjunto NS015 Criadores + NS_017rev1 + NS_130 + NS_212.

O fluxo de alto nivel e:

```
DXF (+ GPKG + JSON opcionais) -> PVs/Trechos -> Enriquecimento (Manning + Quant + Custos)
   -> Validacao (V001-V008) -> NS Completa (A4/Desenho/OSE/JSON/HTML/QR) + GIS + IFC + Dynamo + Log
```

### Arquivo | Responsabilidade | Principais funcoes/classes

| Arquivo | Responsabilidade | Principais funcoes/classes |
|---------|------------------|----------------------------|
| `ConstruData_SABESP_v5.py` | Motor monolitico base (modulos 02-19). Le DXF, enriquece, valida, gera todo o pacote de NS. | `ler_dxf`, `ler_json_rede`, `enriquecer_trechos`, `validar_rede`, `gerar_ns_completa`, `processar`, `processar_batch`, `calc_manning`, `calc_quantitativos`, `calc_custos`, `gerar_ifc`, `gerar_qr_png`, `gerar_rede_geojson`, `gerar_rede_dynamo`, `ler_quantitativo_campo`, `main` |
| `construdata_sabesp_v5_FINAL.py` | Evolucao do motor: parametros lidos de `.INI`, filtro bifilar, calc_manning com guardas de declividade, dashboards HTML adicionais (rede geral, qualidade, mapa todos os nucleos), OSE fiel ao template ProSaneamento. | Mesmas funcoes publicas + `_filtrar_bifilar`, `gerar_rede_html`, `gerar_dashboard_qualidade_html`, `gerar_mapa_todos_nucleos_html` |
| `models.py` | Modelos de dados (dataclasses) inspirados no Bentley SewerCAD. Validacao orientada a objeto e (de)serializacao. | `PV`, `Trecho`, `Rede` (dataclasses); enums `TipoPV`, `MaterialTubo`, `StatusHidraulico` |
| `database.py` | Persistencia SQLite (analogo ao `.stsw.sqlite` do SewerCAD): historico de processamentos, PVs, trechos, erros. | classe `BancoDeDados`; funcao `criar_banco_exemplo` |
| `integrador_nova_ns.py` | Integrador batch que processa pastas de DXF via o motor `motor_teteu_esgoto.ler_dxf_teteu` e exporta JSON/CSV. | `processar_dxf`, `processar_pasta`, `exportar_para_csv`, `main` |
| `consolidar_ns.py` | Varre uma arvore de NS ja gerada por bairro e produz relatorios consolidados em XLSX/JSON/TXT. | `listar_todos_arquivos_ns`, `gerar_relatorio_excel`, `gerar_relatorio_json`, `gerar_resumo_texto` |
| `README.md` | Documentacao de uso (instalacao, CLI, estrutura de saida, API Python, correcoes v5.0, lista de modulos 02-19, nucleos batch). | (documentacao) |
| `config/PARAMETROS_PROSANE.INI` | Parametros tecnicos (vala, declividade, perfil, PV, Manning, layers ProSaneamento, layout OSE) consumidos pelo variant FINAL. | (configuracao) |

### Estrutura interna em modulos (02-19)

O arquivo e organizado em modulos numerados via comentarios de cabecalho. Conforme `README.md` e o codigo:

| # | Modulo | Funcoes principais |
|---|--------|--------------------|
| 02 | Leitura DXF | `ler_dxf()`, `ler_json_rede()`, helpers `_ler_xdata_raw`, `_agrupar_textos_pvs`, `_build_trechos_agua` |
| 03 | Enriquecimento | `enriquecer_trechos()`, `calc_manning()`, `calc_quantitativos()`, `calc_custos()`, `_materiais_agua()` |
| 04 | Validacao | `validar_rede()` — V001-V008 (usa networkx) |
| 05 | Cartografia | `ler_cartografia_gpkg()` |
| 06 | NS A4 | `gerar_ns_a4()` / `gerar_ns_a4_com_qr()` |
| 07 | NS Desenho | `gerar_ns_desenho()` / `gerar_ns_desenho_com_qr()` |
| 08 | OSE xlsx | `gerar_ns_ose()` — formato NS_017rev1 |
| 09 | Dados JSON | `gerar_ns_dados_json()` |
| 10 | HTML Leaflet | `gerar_ns_html()` |
| 11 | Orquestrador | `gerar_ns_completa()` |
| 12 | GIS | `gerar_rede_geojson()`, `gerar_rede_dynamo()` |
| 13 | Custos | `gerar_excel_custos()` |
| 14 | Dynamo | `gerar_dynamo_script()`, `criar_pipe_network_v5()` |
| 15 | Pipeline | `processar()` |
| 16 | Batch | `processar_batch()` |
| 17 | IFC LOD500 | `gerar_ifc()`, helpers `_ifc_cylinder`, `_ifc_box`, `_ifc_pset`, `_dd_to_dms` |
| 18 | QR Code | `gerar_qr_png()`, `_embed_qr_no_ax()` |
| 19 | Quant campo | `ler_quantitativo_campo()`, `exportar_quant_campo_para_ns()` |

### Fluxo completo DXF -> pacote de NS

A funcao orquestradora e `processar()` (modulo 15, `ConstruData_SABESP_v5.py` linhas 2435 em diante). O fluxo e:

1. **Leitura.** Se `dxf_path` existe, chama `ler_dxf()`; senao, se `json_path` existe, chama `ler_json_rede()`; senao levanta `FileNotFoundError`. Retorna a tupla `(pvs, trechos, ruas, meta)`.
   - `ler_dxf()` adota uma estrategia dupla: primeiro `_ler_xdata_raw()` faz parsing **bruto** (texto, encoding `latin-1`) do DXF para extrair XDATA ProSaneamento (`PH_DATCNX`, `PH_DATTUB`, `PH_DATIDN`, `PH_DATGEO`) e — no mesmo passe — coleta os textos de logradouro (`TEXT`/`MTEXT`) no espaco de coordenadas LOCAL dos PVs/tubos. Se nao houver XDATA (`inserts` vazio), faz fallback para `ezdxf.readfile` e agrupa textos empilhados em PVs via `_agrupar_textos_pvs()` (layer `PS_PONTOS_IDENTIFICACAO_TXT`).
   - PVs sao decodificados dos blocos INSERT: o layout de `PH_DATCNX` e `[diam_pv, flag, prof, CF]`, de onde `prof = reals[2]`, `cf = reals[3]` e `ct = round(cf + prof, 4)`. Tubos sao decodificados das LWPOLYLINEs (`PH_DATTUB`): material em `strs_t[0]`, DN explicito em `strs_t[1]`.
   - Trechos sao montados via snap por distancia: cada extremo do tubo e ligado ao PV mais proximo com `_pv_mais_proximo(pt, pvs, CFG["tol_pv_tubo"])`; a rua e atribuida pelo texto mais proximo do ponto medio (`_mais_proximo(..., 300.0)` no espaco local). Trechos sao deduplicados por par `(pv_ini, pv_fim)`. Redes de agua usam `_build_trechos_agua()`, que projeta os nodos N_xx ao longo das polilinias LIN-AF.

2. **Override de tipo.** Se `tipo_override` ("agua"/"esgoto") for passado, ajusta `meta["tipo_rede"]` e marca `is_agua` em todos os trechos.

3. **Enriquecimento.** `enriquecer_trechos(trechos, pvs)` (modulo 03) copia CT/CF/prof dos PVs para o trecho, calcula `prof_media_m`, deriva `decl_mm` de `abs(cf_ini - cf_fim)/ext_m` quando ausente, e anexa tres blocos: `hidraulica` (via `calc_manning`), `quantitativos` (via `calc_quantitativos`) e `custos` (via `calc_custos`). Para agua, anexa `materiais_agua`.

4. **Validacao.** `validar_rede(pvs, trechos)` (modulo 04) retorna `(erros, avisos)` — validacoes V001-V008 detalhadas adiante.

5. **Pastas de saida.** Cria a arvore de pastas sob `pasta_saida/NUCLEO` (estrutura 01..07 detalhada adiante).

6. **Cartografia GPKG (opcional).** Se `gpkg_path` existe, `ler_cartografia_gpkg()` extrai eixos de rua (`P_Eixo`), quadras (`0-quadras`) e textos (`ZZ-Carimbo Texto`), filtrando por bounds UTM (`minx > 300_000` e `miny > 7_000_000`); ruas vazias ("Sem Rua") sao complementadas por snap a 100 m.

7. **Geracao de NS por trecho.** Para cada trecho (limitado por `max_ns`), atribui `ns_id` zero-padded de 3 digitos (`001`, `002`, ...) e chama `gerar_ns_completa()`.

8. **Saidas agregadas.** Gera `CUSTOS_POR_TRECHO.xlsx` (modulo 13), GeoJSON + `rede_dynamo.json` (modulo 12), IFC global da rede (modulo 17), script Dynamo (modulo 14) e `log_processamento.json` (modulo 07).

9. **Retorno.** Dicionario com `raiz`, `pvs`, `trechos`, `ns_ok`, `ns_erros`, `erros_validacao`, `avisos_validacao` e caminhos das subpastas.

A funcao `gerar_ns_completa()` (modulo 11) e o orquestrador por-NS. Para cada NS cria a subpasta `01_NS_CAMPO/NS_XXX_PVINI_AO_PVFIM/` e dispara, com captura de erro individual via helper interno `_try`, os geradores: `gerar_ns_a4_com_qr` (A4 + QR), `gerar_ns_dados_json` (DADOS), `gerar_ns_ose` (OSE -> `02_OSE`), `gerar_ns_desenho_com_qr` (DESENHO -> `03_DESENHOS`), `gerar_ns_html` (HTML -> `04_HTML`), `gerar_ifc` (IFC -> `06_BIM`) e o QR PNG standalone.

### Estrutura de pastas de saida (01_NS_CAMPO .. 07_LOG)

Conforme `README.md` e a funcao `processar()`, a saida e organizada por nucleo (nome maiusculo, espacos/barras viram `_`, truncado em 30 chars):

```
SAIDA_BIM_SABESP/
└── NUCLEO/
    ├── 01_NS_CAMPO/NS_XXX_PVI_AO_PVF/   NS_XXX_A4.pdf, NS_XXX_DADOS.json, NS_XXX_QR.png
    ├── 02_OSE/                          NS_XXX_OSE.xlsx (OSE SABESP NS_017rev1)
    ├── 03_DESENHOS/                     NS_XXX_DESENHO.pdf (prancha A3 planta+perfil+tabela+selo)
    ├── 04_HTML/                         NS_XXX.html (dashboard Leaflet + perfil SVG)
    ├── 05_GIS/                          rede_definida.json (GeoJSON EPSG:31983), rede_dynamo.json
    ├── 06_BIM/                          REDE_NUCLEO.ifc (IFC LOD500 rede completa)
    ├── 06_EXCEL/                        CUSTOS_POR_TRECHO.xlsx (SINAPI + BDI)
    └── 07_LOG/                          dynamo_pipe_network_v5.py, log_processamento.json
```

Observacao factual: `06_BIM` e `06_EXCEL` compartilham o mesmo prefixo "06" no codigo (`pasta_excel = raiz/"06_EXCEL"` e `pasta_bim = raiz/"06_BIM"`).

### Entradas e saidas (formatos)

**Entradas:**
- **DXF** ProSaneamento/Civil 3D (esgoto ou agua) — formato primario. Lido tanto por parsing raw de XDATA quanto por `ezdxf`.
- **JSON** — `rede_definida.json` (GeoJSON FeatureCollection) ou `rede_esgoto_dynamo.json` (estrutura `{pontos, tubulacoes}`), via `ler_json_rede()`.
- **GPKG** (GeoPackage) — cartografia opcional (eixos de rua, quadras, textos), lida com `geopandas`/`pyogrio`.
- **TXT/RTF/CSV** — quantitativos de campo do ProSaneamento, via `ler_quantitativo_campo()` (suporta `QUANTITATIVO_XX.txt`, `lista_XX.rtf`, CSV item/quantidade/unidade).
- **INI** — `config/PARAMETROS_PROSANE.INI` (apenas no variant FINAL).

**Saidas:**
- **PDF** — `NS_XXX_A4.pdf` (OS de campo A4 landscape, 29.7x21.0 cm) e `NS_XXX_DESENHO.pdf` (prancha A3: planta + perfil longitudinal + tabela + selo SABESP), geradas via matplotlib (backend `Agg`).
- **XLSX** — `NS_XXX_OSE.xlsx` (OSE no layout NS_017rev1) e `CUSTOS_POR_TRECHO.xlsx`, via `openpyxl`.
- **JSON** — `NS_XXX_DADOS.json`, `rede_definida.json` (GeoJSON com CRS `urn:ogc:def:crs:EPSG::31983`), `rede_dynamo.json`, `log_processamento.json`, `log_batch.json`.
- **HTML** — `NS_XXX.html` (dashboard interativo Leaflet + perfil SVG). No variant FINAL: `rede_geral.html`, dashboard de qualidade e mapa de todos os nucleos.
- **IFC** — `REDE_NUCLEO.ifc` (esquema IFC4, LOD500), via `ifcopenshell`.
- **PNG** — `NS_XXX_QR.png` (QR Code), via `qrcode`/`Pillow`.
- **PY** — `dynamo_pipe_network_v5.py` (script CPython3 para o no Python do Dynamo, Civil 3D 2025/2026).

### Formulas e normas tecnicas reais encontradas no codigo

**Manning (secao plena) — `calc_manning()`:**
```
n   = CFG["manning"][material]      # PVC=0.013, PEAD/PE80/PE100=0.011, FC=0.012, CONC=0.013, FD=0.013
d   = dn_mm / 1000                  # diametro em metros
A   = pi * d**2 / 4                 # area da secao plena
Rh  = d / 4                         # raio hidraulico (secao circular plena)
V   = (1/n) * Rh**(2/3) * sqrt(decl_mpm)   # velocidade (m/s)
Q   = V * A * 1000                  # vazao (L/s)
tau = 1000 * 9.81 * Rh * decl_mpm   # tensao trativa (Pa) = gamma * Rh * I
```
Onde `gamma = 1000 * 9.81` (peso especifico da agua em N/m3) e `Rh = d/4`. Os criterios de autolimpeza embutidos sao **V >= 0.6 m/s** e **tau >= 1.0 Pa** (criterio de tensao trativa minima da NBR 9649). O variant FINAL acrescenta o limite **V <= 5.0 m/s** e guardas de declividade (status `DECL_INVALIDA` para `< 0`, `DECL_ZERO` para `0`, `DECL_ABSURDA` para `> 1.0 m/m`).

**Quantitativos de vala — `calc_quantitativos()`** (largura de vala `lv = 0.60 m`):
```
esc    = lv * H * ext              # escavacao (m3)
lastro = lv * 0.10 * ext           # lastro (FINAL: usa CFG["lastro"]=0.15)
h_env  = min(d + 0.30, H - 0.10)
envolt = max(0, lv*h_env*ext - pi*(d/2)**2*ext)   # envoltorio de areia
brita  = lv * 0.15 * ext
tubo_v = pi*(d/2)**2 * ext
reat   = max(0, esc - lastro - envolt - brita - tubo_v)   # reaterro por subtracao
pav    = lv * ext * 1.20           # pavimentacao (20% extra)
barras = max(1, ceil(ext / 6))     # tubos de 6 m
```

**Custos SINAPI + BDI — `calc_custos()`:** cada componente e `preco_SINAPI * quantidade * bdi`, com `bdi = 1.25` (campo `bdi_pct` reportado como `25`). A tabela `SINAPI` traz precos unitarios (R$): tubos PVC DN100-DN400 (28,50 a 142,60), tubos PE80 DN63-DN160, escavacao (30,77), reaterro (19,97), lastro (85,50), envoltorio (75,30), brita (95,20), pavimentacao (97,80), PV concreto DN1200 (3078,00) e DN600 (1850,00), e materiais de agua (sela DN63x20, TE FoFo, registro de gaveta, chave de servico DN20, luva, tampao). A selecao da chave de tubo e `tubo_pe80_{dn}` se material contem "PE", senao `tubo_pvc_{dn}` (fallback `tubo_pvc_200`).

**Normas e georreferenciamento:**
- **EPSG:31983** (SIRGAS 2000 UTM Zona 23S) — CRS de todo o projeto. Conversao UTM->lat/lon via `pyproj.Transformer.from_crs("EPSG:31983","EPSG:4326")`.
- **NBR 9649** — Projeto de Redes Coletoras de Esgoto Sanitario. Citada no rotulo "DADOS HIDRAULICOS (Manning — NBR 9649)" e gravada no IFC como `IfcClassification(Source="ABNT", Edition="2021", Name="NBR 9649")`.
- **OSE NS_017rev1** — formato da planilha OSE SABESP reproduzido por `gerar_ns_ose()`. O variant FINAL espelha o template `OSE-Modelo_1.xlsx` do ProSaneamento (mapa de colunas em `config/PARAMETROS_PROSANE.INI`, secao `[OSE_Layout]`: trecho=B, CT=L, I=N, CP=P, CR=R, DN=T, G/H/P=V/X/Z, a partir da linha 19).
- **IFC4 LOD500** — `gerar_ifc()` cria `IfcPipeSegment` (cilindro 3D com DN real, via `_ifc_cylinder` -> `IfcExtrudedAreaSolid`) por trecho e `IfcFlowStorageDevice` (caixa 3D CT/CF) por PV, com `Pset_PipeSegmentPHistory`/`Pset_FlowStorageDeviceTypeCommon`, hierarquia espacial `IfcProject -> IfcSite (Santos SP) -> IfcBuilding -> IfcBuildingStorey`, e georreferenciamento via `IfcProjectedCRS` (Name "SIRGAS 2000 UTM Zone 23S", GeodeticDatum "GRS 1980", MapZone "23S") + `IfcMapConversion` com Eastings/Northings = centroide UTM dos PVs.

### Validacoes V001-V008 — `validar_rede()`

| Codigo | Severidade | Condicao | Significado |
|--------|-----------|----------|-------------|
| V001 | Erro | `0 < dn_saida < max(dn_entrada)` no no (grafo networkx) | DN reduz na saida — afogamento |
| V002 | Erro | `cf_fim > cf_ini` em trecho de esgoto | Sifao (cota de fundo sobe contra o fluxo) |
| V003 | Aviso | `> 1` componente conexo no grafo | Rede com partes desconectadas |
| V004 | Erro | `nx.simple_cycles(G)` retorna ciclos | Ciclo no grafo direcionado (esgoto deve ser arvore) |
| V005 | Aviso | `prof_ini`/`prof_fim < 0.50 m` | Profundidade abaixo do minimo |
| V006 | Aviso | `decl_pct < 0.30%` em esgoto | Declividade abaixo do minimo |
| V007 | Aviso | `vel_ms < 0.60 m/s` | Velocidade de autolimpeza insuficiente |
| V008 | Aviso | `tau_pa < 1.0 Pa` | Tensao trativa abaixo do minimo NBR 9649 |

V001, V003 e V004 dependem de `networkx` (`_HAS_NX`); as demais sao puramente por-trecho. A classe `Rede.validar()` em `models.py` replica conectividade e ciclos de forma orientada a objeto, com a regra adicional de que redes de **AGUA podem ter ciclos (malhadas)** e por isso pulam a deteccao de ciclos.

### Argumentos CLI — `main()`

| Argumento | Descricao |
|-----------|-----------|
| `dxf` (posicional, opcional) | Caminho do DXF ProSaneamento |
| `--json ARQUIVO` | Ler de `rede_definida.json` ou `rede_esgoto_dynamo.json` |
| `--saida PASTA` | Pasta raiz de saida (default `SAIDA_BIM_SABESP`) |
| `--nucleo "Nome"` | Nome do nucleo (default: stem do arquivo com `_`->espaco) |
| `--gpkg ARQUIVO` | GPKG de cartografia (opcional) |
| `--tipo agua\|esgoto` | Forca o tipo de rede |
| `--base-url URL` | URL base para o QR Code |
| `--quant ARQUIVO` | Quantitativos de campo `.txt`/`.rtf` |
| `--batch` | Processa todos os nucleos de `NUCLEOS_BATCH` |
| `--max-ns N` | Limita o numero de NS (debug) |
| `--debug` | Traceback completo nos erros |

Sem `dxf` nem `--json`, imprime ajuda e exemplos. O modo `--batch` itera a lista hardcoded `NUCLEOS_BATCH` (Sao Manoel, Joao Carlos AGUA, Vila Criadores, Pantanal Baixo, Morro do Teteu, Vila Israel, Joao Carlos), pulando arquivos inexistentes e gravando `log_batch.json`.

### Modelos de dados — `models.py`

Tres dataclasses inspiradas no SewerCAD (Structure/Pipe/Network):

- **`PV`** (Poco de Visita = Structure): `id, tipo (TipoPV), x, y, ct, cf, prof, diametro_tampa=0.60, grau, nucleo, sintético`. Propriedades `profundidade_real` (`ct - cf`), `tem_coords`, `tem_cotas`. `validar()` sinaliza prof `< 0.30 m` ou `> 10.0 m` e PVs sinteticos. Enum `TipoPV` cobre PV/PI/PM/PT/QE/DE (esgoto) e RG/TE/C90/C45/CAP/RED/CURVA (agua) + ND.
- **`Trecho`** (= Pipe): `id, pv_ini, pv_fim, material (MaterialTubo), dn_mm, ext_m, decl_pct, rua, layer, is_agua` + campos hidraulicos (`velocidade_ms, vazao_ls, lamina_m, tensao_trativa_pa, status`) e copias de cotas. Propriedades `decl_mpm` (`decl_pct/100`), `ext_m_valida` (0.5-500 m), `dn_valido` (50-2000 mm). `validar()` aplica limites de velocidade (0.6-5.0 m/s), tensao trativa (>= 1.0 Pa) e declividade (>= 0.2%).
- **`Rede`** (= Network): agrega `pvs: Dict[str,PV]` e `trechos: List[Trecho]`. Propriedades `total_pvs`, `total_trechos`, `extensao_total`, `custo_total`. Metodos `adicionar_pv`/`adicionar_trecho` (atualiza grau), `validar()` (PVs + trechos + conectividade + ciclos via networkx, com agua isenta de ciclos), `estatisticas()`, `to_dict`/`from_dict`, `exportar_geojson()` (CRS EPSG:31983).

Todas as classes oferecem `to_dict`/`from_dict` para interoperar com o codigo legado baseado em dicionarios do motor monolitico.

### Persistencia — `BancoDeDados` em `database.py`

Classe `BancoDeDados(db_path)` abre SQLite (`check_same_thread=False`, `row_factory=sqlite3.Row`) e cria automaticamente quatro tabelas com indices:

- **`processamentos`** — historico: `nucleo, tipo_rede, arquivo_dxf, data_processamento, total_pvs, total_trechos, extensao_total, custo_total, tempo_processamento, status`.
- **`pvs`** — FK `processamento_id`; `pv_id, tipo, x, y, ct, cf, prof, grau, sintético, nucleo`.
- **`trechos`** — FK `processamento_id`; `pv_ini, pv_fim, material, dn_mm, ext_m, decl_pct, rua, velocidade_ms, vazao_ls, tensao_trativa_pa, status, custo_total`.
- **`erros_validacao`** — FK `processamento_id`; `tipo ('pv'|'trecho'), elemento_id, erro` (JSON).

Indices: `idx_pvs_processamento`, `idx_trechos_processamento`, `idx_processamentos_nucleo`. Metodos principais: `salvar_rede(rede, arquivo_dxf, tempo_processamento, erros_validacao)` (retorna `processamento_id`), `carregar_rede(id)`, `listar_processamentos()`, `gerar_relatorio([id])`, `exportar_relatorio_json()`, `comparar_processamentos(id1, id2)` e `fechar()` (suporta context manager `__enter__/__exit__`). E analogo declarado ao arquivo `.stsw.sqlite` do Bentley SewerCAD.

### Diferencas entre o motor base e o variant FINAL

`construdata_sabesp_v5_FINAL.py` e a evolucao em producao do `ConstruData_SABESP_v5.py`. Diferencas factuais observadas:

- **Parametros via INI:** carrega `config/PARAMETROS_PROSANE.INI` com `configparser` (secoes `[Vala]`, `[Declividade]`, `[Perfil]`, `[PV]`, `[Manning_Esgoto]`, `[Manning_Agua]`, `[Layers_ProSaneamento]`, `[OSE_Layout]`). Vala/Lastro em cm sao convertidos para metros; BDI=1.25, decl minima=0.002 m/m, prof minima=0.30 m. Sem o INI, usa defaults hardcoded.
- **Tolerancia de snap PV-tubo:** `tol_pv_tubo` passou de 25.0 (base) para 50.0 (FINAL).
- **`_filtrar_bifilar()`:** remove polilinias duplicadas (representacao bifilar — duas linhas paralelas por tubo real) usando tolerancias de ponto medio (1.0 m), extensao (2%) e angulo (5 graus), mantendo a de maior DN.
- **`calc_manning()` endurecido:** guardas para declividade negativa/zero/absurda e limite superior de velocidade (5.0 m/s).
- **Dashboards HTML adicionais:** `gerar_rede_html()` (rede geral Leaflet), `gerar_dashboard_qualidade_html()` (KPIs de % tau<1.0, vel<0.6 etc.) e `gerar_mapa_todos_nucleos_html()` (mapa multinucleos).
- **OSE fiel ao template** ProSaneamento `OSE-Modelo_1.xlsx`, com basemap via `contextily` (`ctx.add_basemap`, EPSG:31983) na prancha de desenho.

### Dependencias (libs)

Todas as dependencias pesadas sao importadas com fallback (flags `_HAS_*`), permitindo execucao degradada:

| Lib | Flag | Uso |
|-----|------|-----|
| `matplotlib` (backend Agg) | — (obrigatorio) | PDFs A4 e prancha A3 |
| `ezdxf` | `_HAS_EZDXF` | Leitura DXF (fallback do parser raw) |
| `openpyxl` | `_HAS_OPENPYXL` | OSE e custos XLSX |
| `networkx` | `_HAS_NX` | Validacoes V001/V003/V004 (grafo) |
| `pyproj` | `_HAS_PYPROJ` | UTM EPSG:31983 -> lat/lon (mapa) |
| `geopandas` + `pyogrio` | `_HAS_GEO` | Cartografia GPKG |
| `ifcopenshell` (>= 0.8.4) | `_HAS_IFC` | IFC4 LOD500 |
| `qrcode` + `Pillow` | `_HAS_QR` | QR Code PNG |
| `configparser` | — | INI (apenas FINAL) |
| `contextily` | — | Basemap da prancha (apenas FINAL) |

Os arquivos `requirements.txt`/`requirements-full.txt` da raiz listam o stack mais amplo da plataforma (sqlalchemy, pandas, ezdxf, pyproj, shapely, reportlab, pywebview, xgboost, scikit-learn); o `README.md` recomenda `pip install openpyxl matplotlib ezdxf networkx pyproj ifcopenshell "qrcode[pil]" Pillow` (+ geopandas/pyogrio para GPKG).

### Detalhes notaveis e bugs corrigidos (v5.0)

Conforme `README.md` e comentarios no codigo:

- **Bug critico "Sem Rua" em 100% dos trechos:** `PS_DATRUA` no XDATA estava vazio. Os nomes de rua estavam em `TEXT`/`MTEXT` nos layers `A_Alerta`/`TXT-LOGRAD`, mas o `ezdxf` os lia em UTM (~358.000, 7.353.000) enquanto PVs/tubos estao em espaco local (~-500, -130) — distancia de ~7 milhoes de metros, snap impossivel. **Fix:** coletar `TEXT`/`MTEXT` no parser raw, no mesmo passe do XDATA, garantindo o espaco local. Resultado: 134/134 trechos com rua. O snap de rua usa threshold largo de 300 m no espaco local.
- **CT/CF invertidos:** `reals[3]` do `PH_DATCNX` e CF (geratriz inferior), nao CT. **Fix:** `cf = reals[3]`, `ct = cf + prof`.
- **DN errado (`DN6` em vez de `DN300`):** `reals[0]` e flag de versao (6.0). **Fix:** usar `strs[1]` do `PH_DATTUB` como DN explicito.
- **Encoding:** `_limpar_encoding()` corrige residuos CP1252/latin-1 (ex.: sequencias `Ã...` -> caracteres acentuados corretos) e converte `\P` (quebra de paragrafo AutoCAD) em espaco.

Tolerancias de snap (CFG): `tol_pv_tubo=25.0` (base) / `50.0` (FINAL); `tol_texto_tubo=40.0`; `tol_rua_trecho=150.0`; agrupamento de textos de PV `tol_grupo_pv_x=3.0`, `tol_grupo_pv_y=8.0`. Parsing de DN aceita 20-1200 mm. Helpers de regex (`_parsear_dn`, `_parsear_comp`, `_parsear_incl`, `_parsear_pressao`) extraem valores de textos de indicacao. O `gerar_qr_png()` usa `version=2`, correcao de erro M, `box_size=8`, `border=2`, com cache em `_QR_CACHE`. O `_GPKG_CACHE` evita releitura de GeoPackage.

**Contexto de manutencao (`CLAUDE.md`):** registra correcao recente nos leitores `ler_dxf_gdal.py`/`ler_dwg_universal.py` (modulos externos ao motor monolitico) onde a tolerancia de snap de 20 m importava topografia inteira e "inventava" tubos; foi reduzida para 3 m, a leitura travada apenas em camadas com palavras-chave de rede (TUBO, REDE, ESGOTO, etc.) e instancias de Array convertidas para `shapely.Point`.

**Arquivos de apoio:** `integrador_nova_ns.py` e um integrador batch que usa `motor_teteu_esgoto.ler_dxf_teteu(..., modo="hibrido")` (motor distinto do monolitico) para processar pastas inteiras de DXF e exportar JSON/CSV. `consolidar_ns.py` (depende de `pandas`) varre uma arvore de NS ja geradas por bairro e produz `CONSOLIDADO_NOTAS_SERVICO.xlsx`/`.json` e `RESUMO_NOTAS_SERVICO.txt`, com flags por NS (tem_desenho, tem_a4, tem_ose_xlsx, tem_mapa_html etc.).

**Arquivos relevantes (caminhos relativos a raiz):** `ConstruData_SABESP_v5.py`, `construdata_sabesp_v5_FINAL.py`, `models.py`, `database.py`, `integrador_nova_ns.py`, `consolidar_ns.py`, `README.md`, `config/PARAMETROS_PROSANE.INI`.

---

## Motores Analiticos e de ML

Este subsistema reúne os arquivos `motor_*.py` da raiz do projeto, mais os módulos dedicados de Machine Learning (`slnr_mestre_ml.py`, `ml_classificador.py`, `construdata_analytics.py`). São motores Python "puros" (sem GUI) que recebem o grafo de rede (`pvs` como `dict` e `trechos` como `list[dict]`, produzidos pelos leitores de DXF/DWG) e/ou dados de execução, e devolvem dicionários JSON-serializáveis, planilhas XLSX, PDFs/HTML e relatórios Markdown. Eles concentram a "matemática, os motores e a geração das notas" — exatamente o foco descrito no `CLAUDE.md`. Todos carregam a identidade do contrato real: **CT 11481051 — SLNR Santos / SABESP — FCN Construções e Saneamento**, com custo de referência de **R$ 910/m** e **BDI de 25%**.

### Propósito do subsistema

- **Engenharia/hidráulica paramétrica**: recálculo em cascata (Manning, tensão trativa, custo) quando a geometria muda.
- **Financeiro**: custos por composição contratual, boletins de medição (BM), curva S, retenção de caixa.
- **Planejamento/Lean**: Lean Construction + Last Planner System (LPS), BIM 6D, micro-planejamento por morfologia de terreno.
- **Operação/ativos**: gestão de perdas de água (IWA), as-built, auditoria projeto×execução, estado por NS.
- **ML/Previsão**: previsão de produção (ligações/dia), análise de gargalos do pipeline, classificação de trechos reais×falsos.
- **IA generativa (LLM)**: roteamento multi-provedor (Gemini/Groq/Mistral/Cohere) para análise de fotos, leitura de PDF e relatórios em linguagem natural.
- **Integração corporativa**: Supabase, n8n e Evolution API (WhatsApp) para automação multi-obra.

### Tabela geral — Arquivo | Responsabilidade | Principais funções/classes

| Arquivo | Responsabilidade | Principais funções/classes |
|---|---|---|
| `motor_parametrico.py` | Rede paramétrica com recálculo em cascata (geometria → declividade → Manning → custo → alertas) | Classe `PipeNetwork`; `mover_pv`, `alterar_cota`, `alterar_dn`, `alterar_material`, `adicionar/remover_trecho`, `_recalc_trecho`, `resumo`, `trechos_com_alerta`, `from_json`, `from_leitor` |
| `motor_custo.py` | Custos 5D pela composição do contrato SLNR (R$/m + BDI 25%) e geração de BM | `custo_trecho`, `custo_nucleo`, `gerar_bm`, `importar_tabela_precos`; dicts `PRECOS_CONTRATO`, `COMPOSICAO_METRO`, `FATORES`, `DN_MATERIAL` |
| `motor_medicao.py` | Fluxo NS→RDO→BM→Curva S→pagamento; vínculo execução×projeto | `carregar_execucao_xlsx/json`, `gerar_resumo_execucao`, `gerar_curva_s`, `vincular_ns_execucao`, `gerar_boletim_medicao`, `gerar_acompanhamento_semanal`, `gerar_xlsx_curva_s` |
| `motor_lean_lps.py` | Lean Construction + LPS + BIM 6D (ciclo de vida, CO₂) | `calcular_6d_trecho`, `gerar_6d_nucleo`, `calcular_takt_time`, `mapear_fluxo_valor`, `criar_weekly_work_plan`, `calcular_ppc`, `analisar_razoes_nao_conclusao` (Pareto), `gerar_lookahead`, `gerar_relatorio_lean_lps`, `gerar_xlsx_lean_lps` |
| `motor_microplanejamento.py` | Alocação de recursos por morfologia de terreno e tipo de frente | `classificar_morfologia_trecho`, `classificar_frente`, `micro_planejar_trecho`, `micro_planejar_nucleo`, `_gerar_recomendacoes`; dicts `MORFOLOGIA`, `FRENTES_SERVICO`, `CUSTO_RECURSO_DIA` |
| `motor_perdas.py` | Gestão de perdas de água — metodologia IWA (balanço hídrico, UARL, ILI, DMA, risco de ruptura) | `balanco_hidrico`, `calcular_uarl`, `calcular_ili`, `calcular_risco_trecho`, `mapa_risco_nucleo`, `analise_troca_vs_perda`, `criar_dma`, `gerar_relatorio_perdas`, `get_perdas_properties` |
| `motor_ml.py` | Previsão de produção (LightGBM) + análise de gargalos do pipeline 11 etapas + simulação de cenários | `prever_producao`, `analisar_gargalos`, `simular_cenario`, `gerar_relatorio_ml`; constantes `PIPELINE`, `CENARIOS` |
| `slnr_mestre_ml.py` | Orquestrador ML XGBoost+GridSearchCV que reescreve TODAS as abas da planilha mestre e gera NS | Classe `SLNRMLIntegrador` (`carregar_dados`, `preparar_features`, `treinar_modelo`, `gerar_cenarios`, `atualizar_planilha`, `_gerar_notas_servico_pis_pvs`, `gerar_graficos`, `executar`) |
| `ml_classificador.py` | Classificador XGBoost trecho real×falso (aprende com decisões do usuário no mapa) | `extrair_features`, `salvar_decisoes`, `treinar_modelo`, `predizer`, `gerar_visualizacao` |
| `construdata_analytics.py` | Pipeline analítico XGBoost completo (XLSX 5 abas + JSON + gráficos + MD + HTML) | `carregar_dados`, `preparar_features`, `treinar_modelo`, `calcular_feature_importance`, `gerar_cenarios`, gráficos Seaborn, `gerar_xlsx`, `exportar_json`, `gerar_relatorio_markdown`, `gerar_relatorio_html`, `main` |
| `motor_gemini.py` | Integração Gemini (visão/PDF/chat) via SDK `google-genai` | `analisar_foto`, `analisar_fotos_lote`, `analisar_foto_para_rdo`, `ler_pdf_projeto`, `consultar`, `gerar_resumo_executivo`, `setup_api_key`, `verificar_conexao` |
| `motor_llm.py` | Roteador multi-LLM (Gemini/Groq/Mistral/Cohere) com fallback por módulo | `chamar`, `_call_gemini/_groq/_mistral/_cohere`, `analisar_rede/hidraulica/custos/lean/perdas/ml`, `validar_hidraulica`, `setup`, `status` |
| `motor_contratos.py` | Gestor multi-contrato (qualquer cidade/contratante), preços e núcleos por contrato | `criar_contrato`, `editar_contrato`, `listar/get_contrato`, `get/importar_precos`, `ativar_contrato`, `criar_nucleo`, `salvar/carregar_rede_nucleo`, `exportar/importar_contrato`, `criar_slnr_santos` |
| `motor_status_ns.py` | Máquina de estados centralizada por NS (fonte de verdade) | `criar_status_inicial`, `carregar`, `salvar`, `transitar`, `atualizar_campo_real/cadastro/medicao/whatsapp`, `resumo`, `exportar_csv`, `ns_pode_medir` |
| `motor_teteu_esgoto.py` | Leitor DXF robusto "nunca inventar tubos" (clusterização de endpoints) | `ler_dxf_teteu`, `_extrair_tubos`, `_agrupar_textos_pv`, `_associar_clusters_textos`, `_montar_trechos_direto`, `_dedup_trechos`, parsers `_parse_dn/_incl/_cota` |
| `motor_asbuilt.py` | As-built: snap espacial de PVs de projeto a pontos reais do topógrafo | `parse_topografia_txt`, `interpolar_as_built` |
| `motor_auditoria_v4.py` | Auditoria projeto×execução cruzando shapefiles (SHP) | `e_cadastro`, `carregar_shp`, `match_shp`, `processar_lote_auditoria`, `limpar` |
| `motor_producao_vs_medido.py` | Retenção de caixa: cruza produção × medição × custos (GAP financeiro) | Classe `MotorProducaoVsMedido` (`carregar_producao_supabase/xlsx`, `carregar_medicao`, `calcular_gap`, `calcular_gap_por_nucleo`, `gerar_excel`, `gerar_relatorio_md`, `push_supabase`, `salvar_snapshot`) |
| `motor_atas.py` | Atas de reunião → XLSX + ingestão Supabase/n8n (delegação de tarefas WhatsApp) | Classe `MotorAtas` (`adicionar_tarefas`, `disparar_para_supabase`, `gerar_excel`) |
| `motor_maestro_lote.py` | Maestro multi-obra (lote diário) → Supabase + Evolution API (WhatsApp) | Classes `MotorObra`, `MaestroLote` (`rodar`, `_consolidar`, `_salvar_snapshot`, `_push_supabase`, `_gerar_excel`, `_notificar_whatsapp`) |

### Detalhes técnicos por motor

#### `motor_parametrico.py` — recálculo hidráulico em cascata (Manning + tensão trativa)
Núcleo de cálculo hidráulico do sistema. A classe `PipeNetwork` mantém um grafo de adjacência (`_adjacencia: pv_nome → [idx de trecho]`); qualquer operação (`mover_pv`, `alterar_cota`, `alterar_dn`, `alterar_material`) dispara `_recalc_trecho` apenas nos trechos afetados. As fórmulas reais em `_recalc_trecho`:

- **Extensão**: `ext = sqrt((x0-x1)² + (y0-y1)²)`.
- **Declividade**: `decl_mm = (cf0 - cf1) / ext × 1000` (em ‰).
- **Manning** com `n` por material (`MANNING_N = {"PVC":0.013, "PEAD":0.011, "PE 80":0.011, "PE 100":0.011, "CONCRETO":0.015}`), para seção plena: `A = πD²/4`, raio hidráulico `Rh = D/4`, `V = (1/n)·Rh^(2/3)·I^(1/2)`, `Q = V·A·1000` (L/s), e **tensão trativa** `τ = γ·Rh·I = 9810·Rh·I` (Pa, com γ_água = 9810 N/m³).
- **Custo**: `ext × 910`.

Os **alertas hidráulicos** gerados aqui são a base de validação usada por outros motores e pelo LLM: `V > 5 m/s` (erosão), `0 < V < 0,6 m/s` (falha de autolimpeza), `0 < τ < 1,0 Pa` (fora da **NBR 9649** que exige τ mínimo de 1 Pa), `declividade negativa` (contra-fluxo/erro de projeto) e `profundidade > 5 m` (escoramento especial).

#### `motor_custo.py` — composição contratual SINAPI-like + BDI
Usa preços REAIS do contrato (não SINAPI genérico), extraídos da planilha `MESTRE_SLNR_FINAL...xlsx`. A `COMPOSICAO_METRO` soma R$ 805/m (escavação 145, tubo esgoto 240, tubo água 95, PV/caixas 120, reaterro 80, ramal 65, pavimentação 45, sinalização 15), e com `BDI = 0.25` chega ao referencial de **R$ 910/m**. `custo_trecho` calcula quantitativos (volume de escavação `ext × prof_média × largura_vala 0,80`; reaterro 0,85×escavação; áreas de CBUQ via `FATORES`) e devolve itens codificados (ESC-001, TUB-xxx, PV-001, REA-001, PAV-001/002, RAM-001, SIN-001), subtotal, valor de BDI e total. `gerar_bm` produz o Boletim de Medição (separando subtotal/BDI por engenharia reversa de `total/(1+BDI)`). `importar_tabela_precos` lê CSV (detecta separador `;`/`,`, `utf-8-sig`) ou JSON, permitindo substituir a tabela por contrato.

#### `motor_medicao.py` — RDO, BM e Curva S
Regra de negócio central: **pagamento condicionado ao cadastro NTS 292 aprovado (contrato pág. 64)**. `gerar_boletim_medicao` só soma ao `total_liberado` os trechos com `cadastro_ok`/`ct_ini_real`, separando `total_pendente_cadastro`. `gerar_curva_s` produz série prevista (distribuição linear, ~2 km/mês por frente) × realizada (a partir de execução real, estimando **6,1 m de rede por ligação**). `gerar_xlsx_curva_s` gera planilha com gráfico `LineChart` (openpyxl) previsto×realizado. Entradas: `Execução_Geral.xlsx` (lê a partir da linha 5, colunas equipe/rua/lig_água/lig_esgoto/PRA) ou JSON.

#### `motor_lean_lps.py` — Lean + LPS + BIM 6D
Implementa três frentes:
- **BIM 6D**: dict `VIDA_UTIL` por material (PVC 50 anos, PEAD/PE 100 anos, CONCRETO 80, FFD 100) com `manutencao_anual_pct`, **CO₂ kg/m** (PVC 3,2; PEAD 2,8; CONCRETO 12,5; FFD 18,0) e reciclabilidade. Calcula custo de ciclo de vida, manutenção anual e data prevista de substituição.
- **Lean**: `calcular_takt_time` (takt em m/dia/equipe, cycle/lead time a partir do `FLUXO_NS` de 9 etapas, throughput NS/semana) e `mapear_fluxo_valor` (VSM: eficiência = tempo de valor agregado / cycle, meta lean 50%).
- **LPS**: `criar_weekly_work_plan` (separa NS ready×bloqueadas, capacidade = equipes×5 dias), `calcular_ppc` (**PPC** = executadas/planejadas; classificação <60% crítico, 60-75% aceitável, 75-85% bom, >85% excelente), `analisar_razoes_nao_conclusao` (**análise de Pareto** das razões com % acumulado) e `gerar_lookahead` (planejamento 6 semanas à frente, make-ready). 10 `CATEGORIAS_RESTRICAO` (material, equipe, projeto, clima, **sabesp**, acesso, interferência, equipamento, documentação, topografia). Saída XLSX multi-aba (Resumo, BIM 6D, Lookahead).

#### `motor_microplanejamento.py` — recursos por morfologia
Classifica cada trecho pela declividade calculada das cotas (`>15%`=morro, `8-15%`=encosta, `<8%`=planície), além de mangue e viela. O dict `MORFOLOGIA` define produtividade (planície 30 m/dia, encosta 20, morro 12, mangue 7, viela 14), `fator_custo` (1,0 a 2,10), equipe, equipamentos, riscos e exigências de escoramento. `classificar_frente` mapeia DN/tipo para tipo de frente (tronco esgoto, ramal, rede de água, ligação predial, prolongamento). `CUSTO_RECURSO_DIA` lista custo/dia e disponibilidade de mão de obra e equipamentos. Gera material just-in-time, custo de frente e recomendações priorizadas (ALTA/MÉDIA/NORMAL). Há também `NUCLEOS_MORFOLOGIA` com a morfologia conhecida dos núcleos reais (Verde e Teteu = morro, Pantanal Baixo = mangue, etc.).

#### `motor_perdas.py` — balanço hídrico IWA / UARL / ILI
Implementa a metodologia **IWA (International Water Association)** por completo:
- **Balanço hídrico** (`balanco_hidrico`): separa água faturada, perdas aparentes (submedição ~5% + fraude) e perdas reais; calcula **NRW (Non-Revenue Water)**, IPL e IPA, além do custo das perdas e da receita perdida.
- **UARL (Unavoidable Annual Real Losses)** (`calcular_uarl`): fórmula `UARL = (18·Lm + 0,8·Nc + 25·Lp)·P` [L/dia], onde Lm = km de rede, Nc = nº de conexões, Lp = km de ramal, P = pressão média (m.c.a.). Coeficientes em `UARL_COEF`.
- **ILI (Infrastructure Leakage Index)** (`calcular_ili`): `ILI = Perdas Reais / UARL`, com classificação do World Bank (<2 excelente, 2-4 bom, 4-8 regular, 8-16 ruim, >16 crítico; Brasil médio 5-12).
- **Risco de ruptura** (`calcular_risco_trecho`): usa o cadastro 6D (material, DN, idade, profundidade, pressão). Taxa de falha por material/idade (`TAXA_FALHA`), probabilidade `P(ruptura) = 1 - e^(-falhas_esperadas)`, com custo esperado de reparo e de água perdida (vazamento médio 2 L/s × 48 h × 60% recuperável ≈ 207 m³/ruptura).
- **Análise econômica** (`analise_troca_vs_perda`): payback de trocar o tubo vs continuar perdendo.
- **DMA (District Metered Area)** (`criar_dma`): setorização por clustering de coordenada Y.
- Constantes financeiras: `CUSTO_AGUA` (produção R$ 2,80/m³, tarifa R$ 8,50/m³, energia 0,45 kWh/m³, R$ 0,85/kWh) e `CUSTO_REPARO`.

#### `motor_ml.py` — previsão de produção (LightGBM) + gargalos
Apesar do cabeçalho referir-se à análise XGBoost original (R²=0.271, 124 amostras, feature dominante `lig_rolling_3`≈0,50), o motor treina dinamicamente um **`lightgbm.LGBMRegressor`** (`n_estimators=50, learning_rate=0.05, num_leaves=7, min_child_samples=2`) com features rolling-3, rolling-7 e tendência. Constantes calibradas: **6,1 m/ligação**, ciclo atual 76 dias (meta 2X = 40), produção 366 lig/mês (meta 2X = 733, meta SABESP = 1000). `analisar_gargalos` percorre o `PIPELINE` de 11 etapas marcando as 4 com `gargalo=True` (Projeto, Execução Rede, Lavagem+Coliformes, Liberação SABESP) e calcula o caminho crítico (somando etapas não-paralelas). `simular_cenario` projeta meses-para-concluir, investimento e data de conclusão para cada um dos 5 cenários em `CENARIOS` (A: +2 eq rede; B: pipeline 2X; C: full scale; D: só automação).

#### `slnr_mestre_ml.py` — orquestrador XGBoost da planilha mestre
Módulo de maior porte (1666 linhas). A classe `SLNRMLIntegrador` carrega `SLNR_MESTRE_UNIFICADO.xlsx`, faz **feature engineering** completo (rolling 3/7 por núcleo via `groupby().transform()`, `LabelEncoder` de núcleo, features temporais, acumulados, dias decorridos) e treina **XGBoost (`XGBRegressor`) com `GridSearchCV`** (grid de `n_estimators`/`max_depth`/`learning_rate`/`subsample` = 108 combinações × 3 folds = 324 modelos, scoring `r2`), com **fallback automático para `RandomForestRegressor`** se o xgboost não estiver instalado. Métricas: R² (teste 20% e CV 5-fold), MAE, RMSE, feature importance. Gera 5 cenários de aceleração (baseline, +10/20/30%, meta contratual 366/mês). Em seguida **reescreve ~13 abas + abas por núcleo** da planilha (`ML_RESULTADOS`, `METODO_ML`, `TENDENCIAS`, `DASHBOARD`, `NOVOS_NUCLEOS`, `CRONO_MACRO`, `CUSTOS`, `CURVA_S`, `MEDICAO_MENSAL`, `COMPRAS_MENSAL`, `PAINEL_EXECUTIVO`, `HEATMAP_REDE/LIG`, N07–N12 e SD_*), inserindo fórmulas Excel nativas (`=HOJE()+D...`, `=F.../E.../22`), e ainda gera Notas de Serviço por PIs/PVs (`_gerar_notas_servico_pis_pvs`) e gráficos Seaborn/matplotlib (`gerar_graficos`). Constantes: `META_TOTAL_LIG = 25383`, `META_MENSAL_LIG = 366`, `BDI = 1.25`, e `NUCLEOS_20` (20 núcleos com TAG, tipo de terreno e produtividade m/eq/dia, ex.: Montanhoso 2,3; Urbano_facil 4,0). Detalhe notável: se faltar histórico, gera **dados sintéticos** com `np.random.seed(42)` simulando 90 dias por núcleo. Há um caminho hard-coded para `dados_contrato/EXECUCAO_DIARIA.json`.

#### `ml_classificador.py` — XGBoost real×falso (Human-in-the-loop)
Aprende com as decisões do usuário no mapa (marca trecho real/falso). `extrair_features` deriva 12 features geométricas (ext, DN, distância PV-PV, **ratio dist/ext**, presença de CT/CF, DN padrão, PVs sintéticos, cruza-quadra). `salvar_decisoes` acumula dataset JSON; `treinar_modelo` usa **`XGBClassifier` + `GridSearchCV`** (grid de `max_depth`/`n_estimators`/`learning_rate`, scoring `f1`, exige mínimo de 20 amostras) e persiste o modelo em `config/ml_modelo_trechos.pkl` (pickle). `predizer` aplica o modelo a novos DXFs (retorna `[True]*n` se não há modelo). `gerar_visualizacao` produz boxplots/heatmap de correlação com Seaborn. Degrada graciosamente se `xgboost`/`sklearn` não estiverem instalados (`_HAS_ML=False`).

#### `construdata_analytics.py` — pipeline analítico completo
Variante "produto" do ML: lê `dados_contrato/EXECUCAO_DIARIA.json` (521 dias × 6 núcleos) e `ML_DATA.json`, treina XGBoost+GridSearchCV (fallback RandomForest), calcula feature importance e cenários, e exporta um pacote completo: **`ANALYTICS_SLNR.xlsx` (5 abas)**, `ANALYTICS_SLNR.json`, relatórios **Markdown e HTML** e PNGs (scatter real×predito, violin por núcleo, feature importance, tendência semanal). Todas as dependências (xgboost, sklearn, matplotlib, seaborn, openpyxl) são opcionais com flags `*_OK`.

#### `motor_gemini.py` e `motor_llm.py` — camada de IA generativa
`motor_gemini.py` usa o SDK novo **`google-genai`** (não o deprecated `google-generativeai`), modelos `gemini-2.5-flash`/`gemini-2.5-pro` (e referência a `gemini-3-flash-preview`). Funções: análise de foto de obra (vala/PV) retornando JSON estruturado para RDO, leitura de PDF de perfil longitudinal convertendo em `pvs`+`trechos` (declividade % → ‰), assistente em linguagem natural (`consultar`) e resumo executivo. Busca a API key em env vars, `config.json` ou `.env`.

`motor_llm.py` é um **roteador multi-LLM gratuito** com fallback: dict `PROVIDERS` (Gemini, Groq `llama-3.3-70b-versatile`, Mistral `mistral-large-latest`, Cohere `command`) com limites grátis, e dict `ROTEAMENTO` que mapeia cada módulo ao melhor provedor (foto/pdf→Gemini; consulta/lps/hidráulica/chat→Groq; resumo/ml→Mistral; perdas→Cohere). `chamar(modulo, prompt)` tenta os provedores em ordem e cai no próximo se falhar. Os prompts já embutem as regras técnicas reais (composição R$ 910/m, benchmarks ILI, e os limites hidráulicos V>5 / V<0,6 / τ<1 da **NBR 9649**). Clientes são lazy-loaded.

#### `motor_contratos.py` — multi-contrato e parametrização regional
Generaliza a plataforma para qualquer contrato/cidade. Estrutura em `~/.construdata/contratos/<slug>/` com `contrato.json` e `precos.json`. `TEMPLATE_CONTRATO` define parâmetros por contrato, incluindo **`crs: "EPSG:31983"`** (padrão Brasil, ajustável por região), zona UTM, BDI, custo/m, e os coeficientes de **Manning por material** por contrato (`{"PVC":0.013, "PEAD":0.011, "CONCRETO":0.015, ...}`). `criar_slnr_santos` instancia o contrato real (CT 11481051, SABESP, EPSG:31983). Suporta exportar/importar contrato inteiro (portabilidade ZIP).

#### `motor_status_ns.py` — máquina de estados (fonte de verdade)
Define o ciclo de vida de cada NS: **PLANEJADO → EXECUTADO → CADASTRADO → MEDIDO | BLOQUEADO**, com tabela `_TRANSICOES` de transições permitidas. `transitar` valida a transição (levanta `ValueError` se inválida), registra histórico (de/para/data/responsável/obs) e aplica efeitos colaterais (ex.: ao ir para CADASTRADO marca `cadastro.ok=True` e libera `pendente_cadastro=False`). `ns_pode_medir` impõe a regra de pagamento (só mede se cadastrado). Persistência em `SAIDA/{NUCLEO}/PLANEJAMENTO/STATUS_NS.json`, com exportação CSV.

#### `motor_teteu_esgoto.py` — leitor DXF conservador
Materializa o princípio do `CLAUDE.md` de "nunca inventar tubos". Lê o DXF com **GeoPandas** (`gpd.read_file(layer="entities")`), extrai apenas tubos de camadas inequívocas (TUBO/PROLONG/CONDUTO/PIPE/COLETORA/RECALQUE) excluindo perfis/detalhes/cortes, e deriva os PVs **clusterizando os endpoints reais dos tubos** via `scipy.cluster.hierarchy.fclusterdata`. Tolerâncias notáveis: `MIN_EXT_TUBO = 2,0 m`, **`TOL_CLUSTER = 3,0 m`** (endpoints a ≤3 m = mesmo PV — a tolerância de snap reduzida de 20 m para 3 m citada no `CLAUDE.md`), `TOL_LABEL_PV = 15 m`, `TOL_TEXTO_TUBO = 30 m`, e snap direto de fallback a 5 m. Faz validação geométrica final (razão distância/extensão entre 0,5 e 2,0; avisa se >30% inconsistente). Saída: `(pvs, trechos, ruas, meta)` + JSON.

#### `motor_asbuilt.py` e `motor_auditoria_v4.py` — campo vs projeto
`motor_asbuilt.py` lê o arquivo do topógrafo (`ID, N, E, Z, código, descrição`), detecta automaticamente qual coluna é Norte/Este pela magnitude (UTM Sul: Y na casa dos milhões) e faz **snap espacial** dos PVs de projeto aos pontos reais (raio 15 m), atualizando coordenadas e cota de tampa (recalculando CF = CT − prof). `motor_auditoria_v4.py` cruza o projeto com shapefiles de execução (`carregar_shp` força `SHAPE_ENCODING=latin-1`, fallback `pyogrio`), faz `match_shp` por ponto médio e por endpoints (tolerância 15 m), e `e_cadastro` heurístico identifica rede existente (PVs com "(1)" em São Manoel; DN≥300 em prolongamentos) para distinguir obra nova de cadastro. Processamento em lote via `processar_lote_auditoria`.

#### `motor_producao_vs_medido.py` — retenção de caixa
Cruza 3 fontes (produção diária via RDO/Supabase ou `Execução_Geral.xlsx`; medição oficial BM SABESP; custos reais) e calcula o **GAP financeiro** = (ligações executadas − ligações medidas) × `CUSTO_POR_LIGACAO (1820,0)` — o dinheiro já gasto mas ainda não pago pela SABESP, reforçando a regra do contrato p.64 (só paga com cadastro NTS 292). Calcula GAP mês a mês, acumulado e por núcleo, gera Excel de 4 abas com gráficos, relatório MD e snapshot JSON, com push opcional ao Supabase. Constantes: `CUSTO_METRO_REDE=910`, `META_TOTAL_LIG=25383`, `BDI=1.25`, `NUCLEOS` com produtividade m/dia por terreno.

#### `motor_atas.py` e `motor_maestro_lote.py` — automação corporativa
`motor_atas.py` (classe `MotorAtas`) gera atas em XLSX e dispara tarefas delegadas diretamente para o **Supabase** (`/rest/v1/tarefas`) com mapa de telefones para acionamento via n8n/WhatsApp — observação de segurança: contém URL e chave anon do Supabase hard-coded como default. `motor_maestro_lote.py` é o "Maestro Central" multi-obra (classes `MotorObra` e `MaestroLote`): processa todas as obras em `OBRAS_ATIVAS` (SLNR Santos, Tatuí, Osasco, Pardinho — RK Engenharia) em um ciclo, consolida indicadores, salva snapshot no Supabase, gera Excel e notifica diretores via **Evolution API (WhatsApp)**. Projetado para ser chamado por n8n Schedule Trigger (18h, dias úteis) ou endpoint FastAPI.

### Entradas e saídas (formatos)

- **Entradas**: grafo `pvs`/`trechos` (JSON/dict, vindo dos leitores DXF/DWG); `DXF` (`motor_teteu_esgoto.py` via GeoPandas); `SHP`/shapefile (`motor_auditoria_v4.py`); `TXT` de topografia (`motor_asbuilt.py`); `XLSX` (`Execução_Geral.xlsx`, `SLNR_MESTRE_UNIFICADO.xlsx`); `JSON` (`EXECUCAO_DIARIA.json`, `ML_DATA.json`, datasets de treino); `CSV` (tabelas de preço); `PDF`/imagens (Gemini); Supabase REST (produção/medição).
- **Saídas**: `JSON` (relatórios estruturados, snapshots, status NS, modelos previstos); `XLSX` (BM, Curva S com gráficos, Lean/LPS, ML mestre, analytics 5 abas, retenção de caixa 4 abas); `PNG` (gráficos Seaborn/matplotlib); `MD` e `HTML` (relatórios executivos); `CSV` (status NS); `.pkl` (modelo XGBoost classificador); propriedades para `IFC` (PropertySets 6D em `motor_lean_lps.py` e `motor_perdas.py`); mensagens WhatsApp (Evolution API) e registros Supabase.

### Tecnologias de ML/IA empregadas

| Motor | Biblioteca/Modelo | Técnica |
|---|---|---|
| `slnr_mestre_ml.py`, `construdata_analytics.py` | **XGBoost** (`XGBRegressor`) + `GridSearchCV` (fallback `RandomForestRegressor`) | Regressão de produção diária; CV 5-fold; feature importance |
| `ml_classificador.py` | **XGBoost** (`XGBClassifier`) + `GridSearchCV` (scoring f1) | Classificação supervisionada trecho real×falso (human-in-the-loop) |
| `motor_ml.py` | **LightGBM** (`LGBMRegressor`) | Previsão rolling com treino dinâmico |
| `motor_gemini.py` | **Gemini** (`google-genai`, gemini-2.5-flash/pro) | Visão multimodal (fotos/PDF) e NLP |
| `motor_llm.py` | **Gemini, Groq (Llama 3.3 70B), Mistral Large, Cohere Command-R** | Roteamento multi-LLM com fallback |
| Visualização (ML) | **Seaborn / matplotlib (Agg)**, **pandas/numpy** | Scatter, violin, heatmap, tendência |
| Geometria/leitura | **GeoPandas, Shapely, SciPy (fclusterdata), pyogrio** | Clusterização de endpoints, snap espacial |
| Planilhas/HTTP | **openpyxl** (charts), **requests** (Supabase/Evolution API) | XLSX com fórmulas/gráficos, integração corporativa |

### Observações notáveis

- **Normas e padrões reais** presentes no código: **NBR 9649** (τ mínimo 1 Pa, autolimpeza), **NTS 292** SABESP (condição de pagamento), metodologia **IWA** (balanço hídrico/UARL/ILI), classificação ILI do **World Bank**, **BDI 25%**, **EPSG:31983** (UTM 23S Brasil).
- **Manning** aparece em dois locais com `n` por material consistentes: `motor_parametrico.py` (cálculo) e `motor_contratos.py` (parametrização por contrato).
- **Degradação graciosa**: praticamente todos os motores de ML protegem importações com `try/except` e flags `*_OK`, caindo para fallback (RandomForest, legenda fallback no Gemini, `[True]*n` no classificador) quando libs faltam.
- **Risco de segurança**: `motor_atas.py` possui URL e token (anon) do Supabase como valores default hard-coded no código.
- **Caminhos absolutos** acoplados ao ambiente do desenvolvedor existem em `slnr_mestre_ml.py` (`C:\Users\felip\Downloads\NOVA NS Versao 5\dados_contrato`), `motor_producao_vs_medido.py` (`.env` em `01-OBRAS-RK`) e nos blocos `__main__` dos motores (`/home/claude/...`, `/mnt/user-data/outputs`), o que indica origem de execução em sandbox Linux e Windows local.
- **Constantes-chave compartilhadas** entre motores: **R$ 910/m**, **R$ 1.820/ligação**, **6,1 m/ligação**, **366 lig/mês** (meta contratual), **25.383/25.730 m** de saldo — repetidas em `motor_custo`, `motor_ml`, `slnr_mestre_ml` e `motor_producao_vs_medido`, evidenciando que são parâmetros de negócio do contrato e não valores arbitrários.

Arquivos lidos (caminhos absolutos da raiz `c:\Users\felip\Desktop\_ORGANIZADO\22-NOVA-NS-VERSAO-5\NOVA NS Versao 5\`): `motor_perdas.py`, `motor_custo.py`, `motor_lean_lps.py`, `motor_medicao.py`, `motor_ml.py`, `motor_microplanejamento.py`, `slnr_mestre_ml.py`, `ml_classificador.py`, `construdata_analytics.py`, `motor_gemini.py`, `motor_llm.py`, `motor_parametrico.py`, `motor_status_ns.py`, `motor_teteu_esgoto.py`, `motor_asbuilt.py`, `motor_auditoria_v4.py`, `motor_contratos.py`, `motor_producao_vs_medido.py`, `motor_atas.py`, `motor_maestro_lote.py`.

---

## Leitores e Importadores CAD/GIS

### Propósito do subsistema

Este subsistema é a camada de **entrada** (ingestão) da plataforma ConstruData/NOVA NS. Sua função é converter projetos de redes de água e esgoto produzidos em diferentes softwares (ProSaneamento/SABESP, AutoCAD Civil 3D, AutoCAD MEP, MicroStation) para o **formato interno canônico** `(pvs, trechos, ruas, meta)`, que alimenta todos os motores a jusante (geração de NS, Civil 3D, IFC, cadastro NTS 292 etc.). Os formatos de entrada suportados são **DXF**, **DWG** e **LandXML 1.2**; as saídas intermediárias são estruturas Python (dicts/listas) e relatórios em **JSON/TXT/CSV**.

O contrato de retorno é uniforme em todos os leitores (`ler_landxml.py`, linhas 26-27; `ler_dxf_prosaneamento.py`, linhas 65-69):

- **`pvs`**: `dict { "PV_NNN": {x, y, ct, cf, prof, ...} }` — poços de visita/inspeção com cota de terreno (CT), cota de fundo/geratriz inferior (CF) e profundidade.
- **`trechos`**: `list [ {pv_ini, pv_fim, dn_mm, ext_m, decl_mm, decl_pct, material, rua, is_agua, ct_ini, cf_ini, ...} ]`.
- **`ruas`**: lista de logradouros.
- **`meta`**: `dict { motor, tipo_rede, n_pvs, n_trechos, ... }`.

A regra de governança (CLAUDE.md do worktree `frosty-lederberg`) é **"Não inventar tubos nem PVs"** e **"Importação sem confiança deve falhar com erro explícito"** — princípio que motivou a correção crítica descrita adiante.

### Arquivo | Responsabilidade | Principais funções/classes

| Arquivo | Responsabilidade | Principais funções/classes |
|---|---|---|
| `ler_dxf_gdal.py` (1097 linhas, v5) | Leitor universal de DXF ProSaneamento via GDAL/OGR + clustering de endpoints | `ler_dxf_gdal()`, `_extrair_tubos_conservador()`, `_extrair_tubos_brutal()`, `_layer_tubo_valido()`, `_parse_dn()`, `_parse_incl()`, `_parse_cota()`, `_coords_geom()`, `_nearest_text()`, `_agrupar_textos_pv()` |
| `ler_dwg_universal.py` | Leitor DWG multi-método independente (ODA → libredwg → DXF homônimo → fallback AEC) | `ler_dwg_universal()`, `ler_dwg_universal_com_relatorios()`, `_converter_dwg_dxf_oda()`, `_converter_dwg_dxf_libredwg()`, `_ler_dxf_completo()`, `_extrair_pvs_tubos()`, `gerar_relatorios()` |
| `ler_dwg_aec.py` (1193 linhas) | Leitor de Pipe Networks de DWG Civil 3D em 3+1 camadas com fallback | `ler_dwg_aec()`, `_extrair_via_landxml()`, `_extrair_via_lisp()`, `_extrair_pvs_de_dxf()`, `_extrair_pvs_de_textos()`, `_ler_csv_pvs/tubos/textos()`, `_achar_accoreconsole()`, `_stem_ascii()` |
| `ler_landxml.py` | Leitor de LandXML 1.2 exportado do Civil 3D (Pipe Network) | `ler_landxml()` |
| `ler_dxf_prosaneamento.py` | Leitor dedicado de DXF ProSaneamento via layers `PS_*` e `TUBO_PVC` (ezdxf) | `ler_dxf_prosaneamento()`, `detectar_prosaneamento()` |
| `LER_DWG_BIM.py` | Leitura **direta** da API COM do Civil 3D (preserva todos os dados BIM) | script de topo via `win32com.client.Dispatch` |
| `LER_DWG_DIRETO.py` | Conversão DWG→DXF via ODA sem abrir Civil 3D + parser de textos | `converter_dwg_dxf_oda()`, `ler_dxf_completo()`, `extrair_pvs_tubos()` |
| `monitor_leitura_dxf.py` | Monitor/log em tempo real das etapas de leitura (perfilagem + relatório JSON) | classe `DXFReadMonitor`, `testar_leitura_gdal()`, `testar_leitura_ezdxf()`, `analisar_lote()` |
| `verificar_dwg.py` | Inspeção de entidades/tubos de DWG original via COM | script COM (`AeccDbPipe`) |
| `verificar_redes.py` | Conta `AeccDbPipe` (gravidade) vs `AeccDbPressurePipe` (pressão) e lista Pipe Networks | script COM + `Autodesk.Civil.ApplicationServices` |
| `verificar_tubos.py` | Diagnóstico de origem dos tubos e estruturas conectadas/desconectadas | script COM |
| `verificar_tipo_rede.py` | Conta trechos por tipo de rede (água/esgoto) e DN a partir de `_debug_trechos.json` | script |
| `diagnostico_dxf_completo.py` | Diagnóstico técnico de DXF de qualquer software (detecção de padrão de camadas) | `verificar_dependencias()`, `analisar_camadas()`, dicionário `PADROES_POR_SOFTWARE` |
| `corrigir_rede_esgoto.py` | Correção de incompatibilidade de CRS (UTM vs local) e re-snap | `ler_dxf_verificado()`, `detectar_crs()`, `calcular_deslocamento()`, `fazer_snap_corrigido()` |
| `scripts/ler_dwg_semantico.py` | Leitor semântico via Civil 3D oculto + exporter .NET → JSON/CSV | `_build_pvs_and_mapping()`, `export_pipe_network_hidden` (importado) |
| `scripts/landxml_import.py` | Conversor CLI de PipeNetworks LandXML → JSON/CSV normalizados | `parse_args()`, `iter_descendants()`, `local_name()` |
| `construdata_sabesp_v5_FINAL.py` (módulo de leitura) | Decodificação **raw de XDATA** ProSaneamento (sem ezdxf) e roteamento DXF | `_ler_xdata_raw()`, `ler_dxf()`, `_filtrar_bifilar()`, `_inferir_material()` |

### Entradas e saídas (formatos)

- **Entradas**: DXF (ProSaneamento e Civil 3D convertido), DWG (Civil 3D/AEC, AutoCAD MEP, MicroStation), LandXML 1.2.
- **Saídas intermediárias** (`ler_dwg_universal.gerar_relatorios()`, linhas 461-567): `RESULTADO_<ts>.json` (metadados + PVs + trechos), `RELATORIO_<ts>.txt`, `PVs_<ts>.csv`, `TRECHOS_<ts>.csv`, `RESUMO_<ts>.txt`. O monitor (`monitor_leitura_dxf.py`, linhas 148-152) emite `MONITOR_<stem>_<ts>.json` e `MONITOR_LEITURA.log`.
- **CRS de saída**: `EPSG:31983` (SIRGAS 2000 / UTM Zona 23S), reusado nos geradores a jusante (`gerar_civil3d.py`: `CRS_EPSG = "EPSG:31983"`; `gerar_ns.py`: comentário "GeoJSON EPSG:31983"; `cadastro/nts292.py`: `"projecao": "UTM 23S / EPSG:31983"`). Os DXF as-built saem georreferenciados em "SIRGAS 2000 UTM 23S".

### Leitura de XDATA do ProSaneamento (PH_DATCNX, PH_DATTUB, PS_DATRUA)

A função `_ler_xdata_raw()` em `construdata_sabesp_v5_FINAL.py` (linhas 389-562) lê o DXF como **texto cru em `latin-1`** (sem ezdxf), percorrendo pares de grupos DXF (código/valor). XDATA é detectado pelo código de grupo **`1001`** (nome da aplicação), acumulando códigos `>= 1000` (linhas 457-467). As aplicações reconhecidas são:

- **`PH_DATCNX`** (conexão/poço, em `INSERT`): layout dos reais código `1040` = `[diam_pv, flag, prof, CF]`. **Detalhe crítico documentado no código** (linhas 508-512): "CF = geratriz inferior. CT = CF + prof. NUNCA reals[3] como CT" — portanto `cf = reals[3]`, `prof = reals[2]`, `ct = round(cf + prof, 4)`. Strings código `1000` dão o tipo do nó; tipos como `TE`, `CURVA`, `CAP`, `RG`, `RED`, `LUVA`, `CV`, `X DN`, `C11/C22/C45/C90` indicam **nó de rede de água** (`is_agua_node`), nomeado `N_NNN`, enquanto os demais viram `PV_NNN` (linhas 519-527).
- **`PH_DATIDN`** (identificação): fornece o número sequencial do PV (`reals_i[0]`).
- **`PH_DATTUB`** (tubo, em `LWPOLYLINE`): `strs_t[0]` = material bruto (normalizado por `_inferir_material`, ex.: "TUBO PVC" → "PVC", anotado como `G-1 FIX`), `strs_t[1]` = DN explícito ("300", "200"). Fallback de DN pelos reais com faixa válida `50 <= cand <= 1200` (linhas 540-560).
- **`PS_DATRUA`**: a sigla é citada como marcador de XDATA ProSaneamento na verificação de `LER_DWG_DIRETO.py` (linhas 240-242: testa `'PH_DAT' in str(xd) or 'PS_DAT' in str(xd)`). Os textos de logradouro são colhidos no **mesmo espaço local** dos PVs/tubos, restritos às camadas `LAYERS_LOGR` (`A_Alerta`, `TXT-LOGRAD`, `TEXTO`, `0`, `ZZ-Carimbo Texto`, `LT-TEXTO-RUA`, `TXT-PRACA`, `PS_IND_TRECHO`) e ao prefixo `PREF_RUA` (`RUA `, `BECO `, `TRAV`, `AV `, `ESTRADA`, `VIELA`, `ALAMEDA`, `ACESSO`) — linhas 395-429.

Quando não há XDATA (`if not inserts:`, linha 484), o módulo registra "Sem XDATA — fallback ezdxf" e recorre ao parser geométrico. Há ainda um **filtro agressivo** que remove blocos de detalhe cujas camadas contenham termos como `DETALHE`, `LISTAGEM`, `QUADRO`, `PERFIL`, `BLOCO`, `LEGENDA`, `CARIMBO`, `SIMBOLO`, `IND`, `FLUXO`, `DIAM`, `INCL`, `COMPR` (linhas 489-495).

As **layers padronizadas do ProSaneamento** reconhecidas estão documentadas no cabeçalho de `ler_dxf_prosaneamento.py` (linhas 10-17): `TUBO_PVC` (tubos), `PS_PONTOS_IDENTIFICACAO_TXT` (textos P.V./P.I., C.T., C.F.), `PS_IND_DIAMETRO` (D=xxxmm), `PS_IND_COMPRIMENTO`, `PS_IND_FLUXO`, `COTAS` (círculos de PV), `ZZ-Carimbo Texto` (ruas). A detecção (`detectar_prosaneamento`, linhas 45-58) considera ProSaneamento qualquer DXF com **≥ 3 camadas com prefixo `PS_`**.

### Uso de GDAL/OGR, ezdxf, GeoPandas, SciPy e shapely

- **GeoPandas + GDAL/OGR**: `ler_dxf_gdal.py` lê o DXF com `gpd.read_file(dxf_path, layer="entities")` (o "entities" é a layer OGR padrão do driver DXF). `ler_dwg_aec.py` usa explicitamente o engine `pyogrio` (`gpd.read_file(dxf_path, engine="pyogrio")`, linha 385). Os textos são filtrados por `gdf.geometry.geom_type == 'Point'` e geometrias de tubo por `geom_type.isin(['LineString','MultiLineString'])`.
- **ezdxf**: usado em `ler_dwg_universal._ler_dxf_completo()`, `ler_dxf_prosaneamento.py`, `corrigir_rede_esgoto.py`, `LER_DWG_DIRETO.py` e `monitor_leitura_dxf.testar_leitura_ezdxf()`. Lê `doc = ezdxf.readfile(...)` / `doc.modelspace()`, iterando `LWPOLYLINE`/`POLYLINE`/`LINE`/`TEXT`/`MTEXT`/`INSERT`. Importação protegida por `try/except ImportError` com `_HAS_EZDXF`.
- **SciPy**: `scipy.cluster.hierarchy.fclusterdata` clusteriza os endpoints dos tubos (`fclusterdata(ep_arr, t=TOL_CLUSTER, criterion='distance')` em `ler_dxf_gdal.py`, linhas 711/921). Cada cluster vira um PV real; o **centro** do cluster é a posição (`ep_arr[mask].mean(axis=0)`), e a conectividade é **topológica** (qual endpoint pertence a qual cluster), eliminando o snap por proximidade que "errava 33%" (cabeçalho da v2, linhas 9-10).
- **shapely**: `ler_dwg_aec._extrair_pvs_de_dxf()` usa `g.centroid.x/.centroid.y` para obter a posição do texto. A conversão **explícita de Array para `shapely.Point`** (mencionada no CLAUDE.md raiz) aparece na variante de `ler_dxf_gdal.py` (worktree `frosty-lederberg`, linhas 648-651): `from shapely.geometry import Point; pt_mid = Point(mid[0], mid[1])`, usada para a busca espacial `texts.geometry.distance(pt_mid) < 50` — a conversão de coordenadas numéricas (Array NumPy) em `Point` evita o erro de tipo que o GeoPandas lançava ao comparar geometria com array bruto.
- **NumPy**: clustering, distâncias vetorizadas (`np.sqrt(((xy_arr - [mx,my])**2).sum(axis=1))`), `argmin`/`argsort`.
- **win32com.client**: leitura COM nativa do Civil 3D em `LER_DWG_BIM.py`, `verificar_dwg.py`, `verificar_redes.py`, `verificar_tubos.py` (objetos `AeccDbPipe`, `AeccDbPressurePipe`, `AeccDbStructure`, propriedades `InnerDiameterOrWidth`, `Slope`, `StartStructure`/`EndStructure`).

### Correção CRÍTICA do bug dos "tubos fantasmas"

Esta foi a correção mais importante do subsistema, registrada no CLAUDE.md raiz: o sistema importava a topografia inteira (casas, ruas, lotes) e **"inventava" tubos** porque a tolerância de snap era de ~20m e qualquer linha era aceita como tubo. As medidas aplicadas:

1. **Tolerância de snap reduzida de 20m para 3m.** Em `ler_dwg_universal.py` (linha 61): `TOL_SNAP = 3.0  # metros para snap de PVs (reduzido de 15 para evitar invenção de tubos)`. Em `ler_dxf_gdal.py` v5, o clustering de endpoints usa `TOL_CLUSTER = 3.0` ("endpoints dentro de 3m = mesmo PV", linha 41); na variante com snap genérico a tolerância efetiva é `TOL_SNAP_GENERICO * 2 = 3.0` (worktree, linhas 636-639) com comentário "Tolerância estrita (2 * 1.5 = 3.0 metros)". (Observação factual: a v2 em `PACOTE_FINAL_V2/scripts/ler_dxf_gdal.py` ainda usa `TOL_CLUSTER = 2.0`.)

2. **Filtragem por palavras-chave de camada (whitelist + blacklist).** Em `ler_dwg_universal._ler_dxf_completo()` (linhas 258-263), cada `LWPOLYLINE` passa por:
   - **Blacklist** (descarta sujeira/topografia): `TEXT, CURVA, CONTORNO, CONTOUR, LOTE, TERRENO, QUADRA, LIMITE, DETALHE, COTAS, HATCH, VIA, RUA, CALC, MOLDURA, CARIMBO, LEGENDA, PERFIL`.
   - **Whitelist NTS** (só aceita rede): `TUBO, REDE, ESGOTO, COLETOR, EMISSARIO, EMISSÁRIO, INTERCEPTOR, RAMAL, CONDUTO, PIPE, PROLONG, RECALQUE`.
   
   Em `ler_dxf_gdal.py` v5, a mesma lógica está em `_extrair_tubos_conservador()` (linhas 286-336): inclui `TUBO, PROLONG, CONDUTO, PIPE, COLETORA, COLETOR, RECALQUE, REDE, ESGOTO, EMISSARIO, INTERCEPTOR, RAMAL, AGUA_REDE`; exclui `PERFIL, DETALHE, CORTE, BIFILAR, TXT, TEXTO, COTA, DIMENSÃO, HACHURA, PONTOS, CAIXAS, IDENTIFICACAO, IND_, INDICACAO`. A constante `MODO_BRUTAL = False` (linha 47) e a variável de ambiente `CONSTRUDATA_BRUTAL` permitem desativar o filtro conservador apenas sob demanda (`_extrair_tubos_brutal`).

3. **Explosão de polylines / extração de endpoints.** Polylines são reduzidas aos seus endpoints reais (`p0 = coords[0][:2]`, `p1 = coords[-1][:2]`) e o comprimento é medido pela geometria (`tubos_gdf.geometry.length`); tubos com `ext_m <= MIN_EXT_TUBO (2.0 m)` são descartados como detalhes. O ODA File Converter é chamado com o argumento **Explode AEC = "1"** (`ler_dwg_universal._converter_dwg_dxf_oda`, linha 123; idem `LER_DWG_DIRETO.py`, linha 78), explodindo objetos AEC em primitivas legíveis. Há ainda `_filtrar_bifilar()` (`construdata_sabesp_v5_FINAL.py`, linhas 565-608) que remove polylines paralelas duplicadas (representação bifilar de um mesmo tubo) por proximidade de midpoint (`tol_mid=1.0`), similaridade de extensão (`tol_ext_pct=0.02`) e ângulo (`tol_angle_deg=5.0`), mantendo a de maior DN.

4. **Fallback DWG→DXF via ODA (cadeia de métodos).** `ler_dwg_universal()` tenta em ordem: (1) **ODA File Converter** (caminhos em `ODA_PATHS`, saída `ACAD2018`), (2) **libredwg** (`dwg2dxf`, `LIBREDWG_PATHS`), (3) DXF homônimo no disco, (4) **fallback AEC** chamando `ler_dwg_aec.ler_dwg_aec()` (linhas 632-644). Já `ler_dwg_aec.py` é organizado em camadas com fallback: **Camada 0** `LANDXMLOUT` via `accoreconsole` → reusa `ler_landxml.py` (método mais confiável, preserva CT/CF/DN/slope); **Camada 1** LISP `extrair_pipe_network.lsp` via `accoreconsole` gerando CSVs (`PVS_EXTRAIDOS.csv`, `TUBOS_EXTRAIDOS.csv`, `TEXTOS_EXTRAIDOS.csv`, `EXTRACAO_STATUS.txt` com flag `BIM_OK=1`); **Camada 2** parser de textos do DXF convertido (`_extrair_pvs_de_dxf`); **Camada 3** complemento via COM (win32com). Os caminhos de `accoreconsole.exe` cobrem Civil 3D/AutoCAD 2024-2026 (`_ACAD_PATHS`).

### Tratamento de CRS (UTM vs local) e EPSG:31983

`corrigir_rede_esgoto.py` documenta e resolve um problema recorrente (linhas 6-16): os PVs do `PS_PONTOS_IDENTIFICACAO_TXT` vêm em **UTM** (X≈360 mil, Y≈7,35 milhões) enquanto os tubos do `TUBO_PVC` vêm em **coordenadas locais** (X<100 mil), fazendo o snap falhar e gerar 52–76% de nós sintéticos `ND_`. A detecção usa limiares `utm_min_x = 200000`, `utm_min_y = 1000000`, `local_max = 100000` (`detectar_crs()` classifica `UTM`/`LOCAL`/`MISTO`). Quando há incompatibilidade (PVs UTM + tubos LOCAL), calcula-se o deslocamento por **centróides** (`calcular_deslocamento()`) e aplica-se a translação aos tubos antes de re-fazer o snap. O `ler_dxf_gdal.py` filtra coordenadas locais/perfil pelo limiar `MIN_COORD_UTM = 100000` (`abs(g.x) > MIN_COORD_UTM`). O CRS de referência da plataforma é **`EPSG:31983` (SIRGAS 2000 / UTM Zona 23S)**, com transformação para `EPSG:4326` (WGS84) nos geradores (`Transformer.from_crs("EPSG:31983","EPSG:4326", always_xy=True)` em `construdata_gui.py` e `gerar_ns.py`); o catálogo regional em `motor_contratos.py` mapeia outras zonas (ex.: PR/SC `EPSG:31982`, BA/ES `EPSG:31984`).

### Detalhes notáveis, parsing e validações

- **Posição do PV vem dos tubos, não dos labels.** O design da v2/v5 do `ler_dxf_gdal.py` parte do princípio de que os textos `PS_PONTOS` são *labels deslocados 5–15 m* do PV real; por isso a posição é o **centro do cluster de endpoints** e o texto só é "casado" ao cluster mais próximo dentro de `TOL_LABEL_PV` (15 m na v5; 20 m na v2). DN/inclinação vêm do texto mais próximo do **midpoint** do tubo dentro de `TOL_TEXTO_TUBO` (30 m na v5; 40 m na v2).
- **Auto-nomeação de junções órfãs.** Clusters sem texto que sejam **junções (grau ≥ 2)** recebem nomes `N_NNN`; dead-ends (grau 1) sem texto são tratados como ligações prediais e **descartados**, exceto em redes de água (0 PVs nomeados → nomeia tudo) — `ler_dxf_gdal.py` v2, linhas 209-253.
- **Dedup bidirecional.** Em todos os leitores, o par `(pv_ini, pv_fim)` é normalizado por `tuple(sorted([...]))` e mantém-se o trecho de **maior DN** (`ler_dxf_gdal.py` linhas 340-346; `ler_landxml.py` linhas 189-194; `ler_dxf_prosaneamento.py` via `seen`/`rev_key`).
- **Parsing de DN e inclinação.** DN aceito na faixa **50–1200 mm** (`_parse_dn` em `ler_dxf_gdal.py`; faixa 20–1200 em `construdata_sabesp_v5_FINAL._parsear_dn`). Inclinação aceita `m/m` (ex.: "0.005 m/m") ou `%` convertido para fração (`_parse_incl`). Cotas parseadas com vírgula decimal (`.replace(",", ".")`).
- **Coerência CT/CF.** Em vários leitores, se `cf > ct` faz-se a troca (`if cf > ct: ct, cf = cf, ct`) e calcula-se `prof = ct - cf`; o `ler_landxml.py` apenas **avisa** (não rejeita) quando `CF > CT`, sinalizando possível rede aérea (linhas 84-86).
- **LandXML.** `ler_landxml()` detecta o namespace automaticamente, lê `Struct` (atributos `elevRim`/`rimElev` → CT; `elevSump`/`sumpElev` → CF; `Center` em ordem "northing easting"), e `Pipe` (`refStart`/`refEnd`, `length`, `slope`, `CircPipe`/`EggPipe` com conversão de diâmetro m↔mm pelo limiar `< 10`). O tipo de rede vem do atributo `pipeNetType` (`storm`/`water`/`combined` → ÁGUA).
- **Detecção água × esgoto.** Por nome de arquivo (`"ESGOTO"/"ESG"` vs `"AGUA"/"ÁGUA"`) em `ler_dxf_gdal.py` e `construdata_sabesp_v5_FINAL.ler_dxf()`, por material da layer (`PE_80`, `PE_100`, `PEAD`, `PVC`, `FFD`/`FERRO`) e por palavras no `desc`/tipo de nó.
- **Monitoramento e validações operacionais.** `monitor_leitura_dxf.py` mede tempo por etapa e **alerta** quando não há camada `PS_PONTOS` ("DXF não-ProSaneamento?", linha 192) ou camada de tubo (linha 195), gerando relatório JSON com `pvs`, `trechos`, `ext_total_m`, `trechos_com_dn`. O teste de integridade no `__main__` de `ler_dxf_gdal.py` (v2, linhas 386-395) calcula um **"mismatch"**: razão entre a distância PV-PV e a extensão do tubo; razões `< 0.5` ou `> 2.0` contam como inconsistência geométrica.

### Dependências (libs)

`ezdxf` (leitura DXF nativa), `geopandas` + GDAL/OGR (driver DXF, engine `pyogrio`), `shapely` (geometria/Point/distância), `numpy` (vetorização), `scipy` (`fclusterdata`), `pywin32`/`win32com.client` (COM Civil 3D/AutoCAD), ferramentas externas **ODA File Converter** e **libredwg (`dwg2dxf`)** para conversão DWG→DXF, e o `accoreconsole.exe` do Civil 3D para `LANDXMLOUT`/LISP. O módulo `diagnostico_dxf_completo.py` declara o conjunto mínimo (`DEPENDENCIAS`: ezdxf, geopandas, numpy, scipy) e mapeia padrões de camadas por software (`PADROES_POR_SOFTWARE`: ProSaneamento, Civil3D_AEC, QGIS, AutoCAD_MEP, Genérico).

Caminhos relevantes (absolutos): a raiz canônica do código é `c:\Users\felip\Desktop\_ORGANIZADO\22-NOVA-NS-VERSAO-5\NOVA NS Versao 5`. Os arquivos de topo (`ler_dxf_gdal.py` v5, `ler_dwg_universal.py`, `ler_dwg_aec.py`, `ler_landxml.py`, `ler_dxf_prosaneamento.py`, `LER_DWG_BIM.py`, `LER_DWG_DIRETO.py`, `construdata_sabesp_v5_FINAL.py`, verificadores e `corrigir_rede_esgoto.py`) ficam diretamente nessa pasta; `ler_dwg_semantico.py` e `landxml_import.py` em `scripts\`. Existe uma variante v2 de `ler_dxf_gdal.py` em `CONSTRUDATA_HYDRONETWORK_V7_FINAL\PACOTE_FINAL_V2\scripts\` (e cópias nos demais pacotes `PACOTE_*` e worktrees `.claude\worktrees\`), cujas tolerâncias diferem da versão de topo (notadamente `TOL_CLUSTER=2.0` e `TOL_LABEL_PV=20.0`/`TOL_TEXTO_TUBO=40.0`).

---

## Geradores de Saida (NS, BIM, Civil 3D, Cronograma)

### Propósito do subsistema

Os scripts `gerar_*.py` na raiz do projeto formam a **camada de produção de artefatos** do motor NOVA NS Versão 5. Eles consomem a estrutura padronizada `(pvs, trechos, ruas, meta)` produzida pelos leitores (`ler_dxf_gdal.py`, `ler_landxml.py`, `ler_dwg_universal.py`) e a transformam em entregáveis de obra e de gestão para o contrato SABESP **11481051** ("SE LIGA NA REDE" — SLNR Santos/SP, executado por FCN Construções e Saneamento). A saída cobre desde a Nota de Serviço de campo (PDF A4/A3, HTML interativo) até modelos BIM IFC LOD 500, cadastro NTS 292, cronogramas em MS Project/Primavera P6/OpenProject e planilhas executivas XLSX.

O dicionário `pvs` mapeia `nome → {x, y, ct, cf, prof, tipo, material_pv}` (coordenadas em UTM, cotas de terreno/fundo) e cada item de `trechos` carrega `{pv_ini, pv_fim, dn_mm, ext_m, decl_mm, material, rua, tipo, ...}`. Vários geradores enriquecem esses trechos com hidráulica (V, Q, τ) via `enriquecer_trechos()` de `gerar_ns.py`.

### Tabela mestre: Arquivo | Responsabilidade | Principais funções/classes

| Arquivo | Responsabilidade | Principais funções/classes |
| --- | --- | --- |
| `gerar_ns.py` | Núcleo do subsistema: gera por trecho PDF A4 + A3 (planta/perfil), HTML Leaflet, GeoJSON, JSON de dados; cálculo Manning; integra OSE/banco SQLite | `calc_manning`, `enriquecer_trechos`, `gerar_ns_a4`, `gerar_ns_desenho`, `gerar_ns_sat`, `gerar_html`, `gerar_geojson`, `calcular_materiais`, `processar_nucleo`, `processar_nucleo_from_data`, `processar_landxml`, `_ler_params_prosane` |
| `gerar_ifc_lod500.py` | Modelo BIM IFC 2x3 / LOD 500 com geometria 3D real (As-Built) + CSV + JSON 5D | `gerar_ifc_lod500`, `_gerar_ifc_real`, `_calc_manning`, `_calc_custo` |
| `gerar_civil3d.py` | Pipe Network Civil 3D: LandXML, cadastro DXF/PDF A4, script Dynamo `.py`, arquivo `.dyn`, AutoCAD `.scr`, JSON | `gerar_landxml`, `gerar_cadastro_dxf`, `gerar_dynamo_script`, `gerar_dynamo_dyn`, `gerar_autocad_scr`, `gerar_json_dados`, `processar` |
| `gerar_cadastro_nts292.py` | Cadastro técnico As-Built conforme NTS 292 Rev.3 (DXF georref + perfil + carimbo NTS 116) + divergências projeto/campo | `gerar_cadastro_nts292`, `_setup_doc`, `_draw_pv_symbol`, `_draw_tubo`, `_draw_perfil`, `_draw_carimbo_sabesp`, `_draw_coord_grid`, `_gerar_divergencias_xlsx` |
| `gerar_project_xml.py` | Cronograma de obra MS Project XML com WBS de 12 fases e produtividades SINAPI | `gerar_project_xml`, `_add_task` |
| `gerar_medicao_curva_s.py` | Medição mensal + Curva S físico-financeira + diário de obras (HTML/XLSX/JSON) | `gerar_medicao_curva_s`, `_gerar_medicao_html`, `_gerar_curva_s_html`, `_gerar_diario_html`, `_gerar_xlsx`, `_dias_uteis_entre` |
| `gerar_ose.py` | Ordem de Serviço para Gabarito (OSE) em XLSX, layout idêntico ao template ProSaneamento | `gerar_ose`, `_fmtv` |
| `gerar_xlsx.py` | Biblioteca de 7 planilhas profissionais (Lean/LPS/6D, Curva S, Microplan, Custos, Perdas, ML, Hidráulica) | `gerar_xlsx_lean`, `gerar_xlsx_curva_s`, `gerar_xlsx_microplan`, `gerar_xlsx_custos`, `gerar_xlsx_hidraulica`, `gerar_xlsx_perdas`, helpers `_hdr`/`_dat`/`_aw` |
| `gerar_compras.py` | Sistema de compras por NS: catálogo de preços, consolidação, XLSX + HTML | `calcular_materiais_ns`, `consolidar_compras`, `gerar_compras`, `_gerar_html_compras`, `_gerar_xlsx_compras` |
| `gerar_cronograma.py` | Cronograma físico-financeiro multinúcleo (script standalone), 10 abas XLSX, meta 1.000 lig./mês | módulo procedural; `frac_mes_ativa`, `frac_mes_ativo_ate`, `gantt_row`, `titulo_aba` |
| `gerar_cronograma_macro.py` | Cronograma macro WBS por núcleo + exports MS Project XML, Primavera P6 XER, OpenProject CSV, XLSX; cronograma por NS round-robin | `gerar_cronograma_macro`, `gerar_cronograma_nucleo`, `exportar_project_xml`, `exportar_primavera_xer`, `exportar_openproject_csv`, `exportar_macro_xlsx`, `gerar_cronograma_por_ns`, `gerar_tudo` |
| `gerar_cronograma_ns.py` | Cronograma 1-tarefa-por-NS: Gantt HTML + MS Project XML + JSON | `gerar_cronograma_ns`, `_gerar_gantt_html`, `_gerar_project_xml`, `_dias_uteis` |
| `gerar_trechos_completo.py` | Consolida JSONs das NS já geradas em XLSX TRECHOS_POR_NUCLEO (12 núcleos) | módulo procedural; `calcular`, `preco_tubo`, `pav_tipo`, `escrever_*` |
| `gerar_trechos_inferidos.py` | Gera trechos sintéticos para 68 núcleos por similaridade com 6 núcleos reais (perfis de terreno) | `gerar_trechos`, `classificar`, `dn_por_ligs`, `pavimento_por_nome`, `calcular_quant` |
| `gerar_trechos_mega.py` | Trechos inferidos dos 83 núcleos da MEGA INTEGRADA, agrupados por clusters (Union-Find, 500 m) | `inferir_trechos`, `connected_components`, `escrever_*`, `add_tot` |
| `gerar_trechos_recortados.py` | Trechos inferidos organizados pelos 8 grupos de proximidade real (GPKG RECORTADO1-8) | `inferir_trechos`, `ler_gpkg`, `gravar_grupo_na_aba`, `escrever_resumo` |
| `gerar_planilha_mega.py` | Planilha MEGA INTEGRADA por núcleo: quantitativos SINAPI completos + ruas via GPKG | `gerar_mega`, `calc_quant`, `calc_custos`, `prof_media`, `associar_ruas_gpkg` |
| `gerar_apresentacao.py` | Relatório executivo gerente geral (8 abas XLSX) + mapa Folium de clusters | módulo procedural; `titulo_aba`, `kpi_block`, leitura CSV/GPKG/MEGA |
| `gerar_tudo_nucleos.py` | Orquestrador: roda 7 outputs/NS + 14 extras/núcleo para todos os núcleos (DXF + LandXML) | módulo procedural; importa os demais geradores |

### Entradas e saídas (formatos)

**Entradas:** DXF (via `ler_dxf_gdal`), DWG (via `ler_dwg_universal`), LandXML `.xml` (via `ler_landxml`), JSON de rede pré-extraída, GPKG cartográfico/de proximidade (GeoPandas), CSV (`nucleos_enriquecido.csv`, `SLNR_MEGA_INTEGRADA_NUCLEOS_PROX_SETOR.csv`), XLSX (`todos os nucleos.xlsx`, `TRECHOS_MEGA_CLUSTERS.xlsx`) e parâmetros ProSaneamento de `C:\pro_sane` (`LST_VALA.DEF`, `DECL_ALT.MIN`, `PAR_ADD0.DAT`).

**Saídas por formato:**
- **PDF A4** — Nota de Serviço de campo (`gerar_ns_a4`, matplotlib `figsize=(11.69, 8.27)`).
- **PDF A3** — desenho planta+perfil (`gerar_ns_desenho`, `figsize=(16.54, 11.69)`) e versão cartográfica (`gerar_ns_sat`, base Contextily CartoDB Positron / OpenStreetMap, nunca satélite).
- **PDF A4 multi-página** — relatório de perdas (`gerar_pdf_perdas.py`, ReportLab `SimpleDocTemplate`).
- **IFC 2x3 / LOD 500** — `gerar_ifc_lod500.py` (ifcopenshell).
- **DXF** — cadastro NTS 292 e folha A4 SABESP.
- **LandXML 1.2** — `gerar_civil3d.gerar_landxml` (schema `http://www.landxml.org/schema/LandXML-1.2`, datum SIRGAS2000).
- **MS Project XML** — `gerar_project_xml.py`, `gerar_cronograma_macro.exportar_project_xml`, `gerar_cronograma_ns._gerar_project_xml` (namespace `http://schemas.microsoft.com/project`).
- **Primavera P6 XER** e **OpenProject CSV** — `gerar_cronograma_macro.py`.
- **XLSX** — OSE, custos, compras, medição, cronogramas, trechos, MEGA, apresentação (openpyxl).
- **HTML** — mapas Leaflet (`gerar_html`), Curva S/medição/diário (Chart.js + Leaflet), Gantt (canvas/Chart.js), mapa Folium de clusters.
- **GeoJSON** — `gerar_geojson` com `crs` nomeado `EPSG:31983`.
- **JSON** — dados de cada NS, BIM 5D, resumos de cronograma, sequência executiva.
- **AutoCAD SCR** (`.scr`) e **Dynamo** (`.py` e `.dyn`) — `gerar_civil3d.py`.

### Fórmulas e normas técnicas reais encontradas no código

**Manning (escoamento à seção plena).** Em `gerar_ns.calc_manning`, com `D = dn/1000`, `A = πD²/4`, `Rh = D/4`:
```
V = (1/n)·Rh^(2/3)·decl^0.5     Q = V·A·1000     τ = 1000·9.81·Rh·decl
```
O `n` de Manning padrão é **0,013** (PVC), lido de `PAR_ADD0.DAT`. Em `gerar_ifc_lod500._calc_manning` o `n` varia por material via dicionário `N_MANNING = {"PVC":0.013, "PEAD":0.011, "PE 80":0.011, "PE 100":0.011, "CONCRETO":0.015}`, com `I = abs(decl_mm)/1000` e `τ = 9810·Rh·I`. Note que em `gerar_ns` a declividade `decl_mm` entra direta em V (m/m), enquanto em IFC ela é dividida por 1000 — convenções distintas entre os scripts. Os geradores de trechos inferidos (`gerar_trechos_inferidos`, `gerar_trechos_mega`, `gerar_trechos_recortados`) reaplicam Manning com `r_h = (dn/1000)/4`, `n=0.013` hardcoded.

**Critérios hidráulicos SABESP (NBR 9649) em `gerar_ose.py`.** Status APROVADO exige `0,6 ≤ V ≤ 5 m/s` e `τ ≥ 1 Pa`; emite alertas "V>5m/s", "V<0,6m/s", "τ<1.0Pa". Em `gerar_xlsx.gerar_xlsx_hidraulica` os mesmos limites geram classificação ✅ OK / ⚠️ VERIFICAR / ❌ CRÍTICO (V>5 = erosão; 0<V<0,6 = sedimentação; τ<1 = fora NBR; declividade negativa).

**BDI e custos.** BDI **1,25** (25%) é constante em praticamente todos os scripts (`_ler_params_prosane` lê de `LST_VALA.DEF[4]`; `gerar_planilha_mega.BDI`, `gerar_xlsx.gerar_xlsx_custos` aplica `=SUM(F:K)*1.25`). Custo contratual de referência **R$ 910/m** (em `gerar_ns_a4`, `gerar_medicao_curva_s`, `gerar_cronograma_ns`, `gerar_xlsx`). Valor total do contrato **R$ 241.235.263,31** (`gerar_cronograma.py`, `gerar_apresentacao.py`).

**SINAPI.** `gerar_planilha_mega.SINAPI` traz preços unitários (tubo PVC DN100=28,50 … DN400=142,60; escavação 30,77; reaterro 19,97; lastro 85,50; pavimentação 97,80; PV concreto DN1200=3.078,00; escoramento 28,50). `gerar_project_xml.py` declara produtividades "baseadas em SINAPI SP Jan/2025" (escavação 30 m/dia, assentamento 40 m/dia, PV 0,5 un/dia etc.). `gerar_ifc_lod500.CUSTOS_DEFAULT` usa escavação 30,77, reaterro 18,45, repav CBUQ 85,60, largura de vala 0,80.

**Parâmetros ProSaneamento (`_ler_params_prosane`).** Lê `LST_VALA.DEF` (vala 60 cm→0,60 m; lastro 15 cm→0,15 m; BDI índice 4), `DECL_ALT.MIN` (declividade mínima 0,005 m/m; profundidade mínima 0,30 m). Declividade mínima ProSaneamento 0,002 m/m é reforçada em `gerar_trechos_inferidos`.

**Normas/padrões citados explicitamente:**
- **NTS 292 Rev.3 (2017)** — cadastro As-Built (`gerar_cadastro_nts292.py`): escala H 1:500 / V 1:100, simbologia SIGNOS (Tabela 4), layers padronizados, datum H "SIRGAS 2000 / UTM Zone 23S (EPSG:31983)", datum V "Imbituba-SC".
- **NTS 116** — carimbo SABESP (`_draw_carimbo_sabesp`).
- **NTS 044** (PVs/PIs pré-moldados), **NTS 217** (ligações prediais), **NBR 7362** (tubos PVC) — citadas nas notas do WBS em `gerar_project_xml.py`.
- **EPSG:31983** (SIRGAS 2000 / UTM 23S) — CRS de todos os GeoJSON/LandXML/IFC; reprojeção para EPSG:4326 (WGS84) via `pyproj.Transformer` em `to_ll`.
- **Metodologia IWA** (Balanço Hídrico, UARL, ILI) em `gerar_pdf_perdas.py` / `gerar_xlsx.gerar_xlsx_perdas`: `UARL = (18·Lm + 0.8·Nc + 25·Lp)·P`; escala ILI <2 Excelente / 2-4 Bom / 4-8 Regular / 8-16 Ruim / >16 Crítico.

### Destaques por gerador

**`gerar_ifc_lod500.py` (BIM As-Built).** Constrói o modelo IFC 2x3 via `ifcopenshell.api` com hierarquia `IfcProject → IfcSite → IfcBuilding → IfcBuildingStorey` (storeys separados "Esgoto" e "Agua"). Tubos são `IfcFlowSegment` com geometria **`IfcSweptDiskSolid`** (disco oco: raio externo `re = dn/2000`, raio interno `ri = 0.9·re`, varrido sobre `IfcPolyline`); PVs/PIs são `IfcBuildingElementProxy` com **`IfcExtrudedAreaSolid`** de `IfcCircleProfileDef` (raio 0,60 m para PV, 0,30 m para PI). Coordenadas trasladadas pela origem mínima `(ox, oy)`. Anexa quatro PropertySets por tubo — `Dados_Tecnicos`, `SABESP_Hidraulica`, `Custo5D` — e `Dados_PV` por estrutura. Faz validação pós-escrita reabrindo o IFC e afirmando `len(by_type("IfcFlowSegment")) == np_` e `len(by_type("IfcBuildingElementProxy")) == nv`. Compatibilidade declarada: Navisworks, BIMVision, Solibri, IFC.js, xBIM. Saída tripla: `.ifc` + `.csv` (delimitador `;`, encoding `utf-8-sig`) + `.json` BIM 5D. Falha graciosamente com `[WARN]` se ifcopenshell ausente.

**`gerar_cadastro_nts292.py` (padrão NTS-292 SABESP).** Documento ezdxf R2010 com `$INSUNITS=6` (metros) e 18 layers padronizados (cores ACI por tipo: REDE_ESGOTO verde=3, REDE_AGUA azul=5, CARTOGRAFIA cinza=8, PERFIL_TERRENO tracejado etc.). Desenha planta georreferenciada com malha de coordenadas UTM (passo 50 m), perfil longitudinal (fatores `fx = 1000/escala_h`, `fy = 1000/escala_v`), carimbo NTS 116 e Norte magnético. **Suporta dados de campo reais via `status_ns`**: PVs com cota real entram no layer `CAMPO_REAL` (ACI 1 vermelho), os de projeto no layer `PROJETO` (ACI 8 cinza); registra divergências quando |CT_real − CT_proj| > 0,05 m (>5 cm) e classifica "DIVERGÊNCIA SIGNIFICATIVA" quando >0,10 m no XLSX `DIVERGENCIAS_NTS292`. Faz **2ª passada (`REAL_COMPILADO`)** quando há `topo_path`, aplicando topografia de campo via `cadastro.compilar_campo`. Gera META JSON com `requisitos_entrega` (DWG georref, PDF assinado, ART/CAU, CTB plotstyle, lançamento SIGNOS via VisualBIM/1DOC — todos marcados PENDENTE).

**`gerar_project_xml.py` (MS Project).** Produz `Project` XML 2016+ com WBS de 12 fases (1. Mobilização … 12. Desmobilização, incluindo "10. Cadastro As-Built (NTS 292)" e "11. BIM LOD 500 / Navisworks"). Durações calculadas por produtividade/equipe (`N_EQUIPES=2`, 8 h/dia, `MinutesPerDay=480`, `DaysPerMonth=22`). Tarefas com `Type=0` (Fixed Units), `Duration=PT{h}H0M0S`, dependências `PredecessorLink` tipo `1` (Finish-to-Start). Subtarefas de assentamento (até 20 lotes) e recursos (Topógrafo, Encanador, Técnico BIM, Fiscal SABESP...). Notas das fases referenciam GC ≥ 95% Proctor Normal, solo 1ª/2ª categoria, DN 200-400 PVC. Saída dupla XML + RESUMO JSON.

**`gerar_medicao_curva_s.py`.** Aloca NS em `equipes` (round-robin pegando a equipe livre mais cedo, contando apenas dias úteis `weekday()<5`), com `prod_m_dia=6.0` e `custo_metro=910`. Distribui físico/financeiro por mês com fração de sobreposição de dias úteis, calculando acumulados, `pct_fisico_prev` e `pct_financ_prev`. Gera 5 saídas: `MEDICAO_MENSAL.html`, `CURVA_S.html` (Chart.js com 2 curvas % físico e financeiro + barras de desembolso), `DIARIO_OBRAS.html` (Leaflet com tile ArcGIS World_Imagery + OSM overlay 40%, conversão UTM→lat/lon aproximada de Santos), `MEDICAO.xlsx` (3 abas) e `MEDICAO.json`.

**`gerar_ns.py` (motor central).** Cria estrutura v9 `CAMPO/` + `PLANEJAMENTO/{CRONOGRAMA,CUSTOS,OSE,BIM,GIS,MEDICAO,LOG}`. Nome de pasta NS via `_ns_folder_name` (`NS001_PV001_AO_PI054`). Há **validação de coordenadas brasileiras** `_coords_validas` (-34 ≤ lat ≤ 5, -75 ≤ lon ≤ -28) usada nos mapas Leaflet para descartar PVs/trechos fora do território (fallback de centro `-23.96, -46.33`). `processar_nucleo_from_data` aceita `ns_sequencia` (ordem executiva) e `modo_rapido`. Cabeçalho do script registra teste de regressão: "137 NS perfeitas no PANTANAL_ESGOTO.dxf, 165 PVs, 0 mismatch". Integra `core.database.bootstrap_database`/`importar_pvs_trechos` (SQLite) e chama `gerar_ose` quando disponível.

**`gerar_ose.py`.** Reproduz o template ProSaneamento OSE com colunas intercaladas (pares = dado, ímpares = espaçador): B=TRECHO, L=CT, N=I, P=CP(CF), R=CR, T=DN, V=G(vala), X=H, Z=P, AB-AF=PV. Lê largura de vala `G_VALA` de `LST_VALA.DEF` (fallback 0,60 m), monta convenções (CT/CP/I/DN/G/H/CR/P), bloco hidráulico com status APROVADO/VERIFICAR e bloco de 6 assinaturas (Eng. Campo, Executor, Coord., Gerente, C. Proj., G. Eng.).

**`gerar_civil3d.py`.** O `gerar_dynamo_dyn` produz `.dyn` Dynamo 2.x (versão 2.17.0.3472) com nó File Path + Python Script (engine IronPython2) que chama `CivilApplication.ActiveDocument.ImportLandXML(xml_path)` dentro de `doc.LockDocument()`. O `gerar_dynamo_script` gera `.py` NETLOAD equivalente. Cadastro DXF/PDF delegado a `cadastro.folha_a4.generate_batch` (folhas A4 SABESP, máx. 8 PVs/folha, agrupadas por rua). Suporta As-Built por interpolação topográfica (`motor_asbuilt.interpolar_as_built`, raio 15 m) e cartografia de fundo (`cadastro.base_topografica`).

**`gerar_xlsx.py`.** Sete planilhas com estilo ConstruData (cabeçalho `003366`, dinheiro `#,##0`, alertas BG verde/amarelo/vermelho) e gráficos nativos openpyxl (BarChart, LineChart, PieChart). Inclui Lean/LPS/BIM 6D (Takt Time, Cycle Time, PPC, ciclo de vida 50 anos com CO₂ por material), Curva S com fórmulas vivas, Custos (composição R$/m + BDI 25%) e Perdas (UARL/ILI/risco). Vida útil e CO₂ por material: PVC 50 anos/3,2 kg, PEAD 100 anos/2,8 kg, Concreto 80 anos/12,5 kg.

**`gerar_compras.py`.** Catálogo `CATALOGO` com preço, unidade, lead time e tipo (ESG/AG/GERAL) por item. `calcular_materiais_ns` deriva nº de barras (`ceil(ext/6)`), luvas, anéis, junções Y, PV/PI, agregados (berço 15 cm, drenagem 10 cm, CBUQ 5 cm × 2,4 t/m³). Consolida, prioriza por custo (🔴 >R$100k, 🟡 >R$10k) e emite HTML (Chart.js bar/doughnut) + XLSX (2 abas).

**Geradores de cronograma.** `gerar_cronograma_macro.py` é o mais completo: WBS de 12 fases padrão (`FASES`, durações por `dias_fixo` ou `dias_por_100m/equipe`, dias úteis pulando fins de semana) e quatro exports — MS Project XML, **Primavera P6 XER** (formato tabular `%T/%F/%R` com tabelas PROJECT/CALENDAR/PROJWBS/TASK/TASKPRED, header `ERMHDR 13.0`), **OpenProject CSV** e XLSX macro. Também contém `gerar_cronograma_por_ns` (round-robin por equipe, cores por equipe, Gantt HTML em canvas com tooltips). `gerar_cronograma_ns.py` gera 1 tarefa/NS (Gantt HTML com barras posicionais + MS Project XML com calendário 5d/semana). `gerar_cronograma.py` é um script executivo standalone que monta 10 abas (capa, meta 1.000 lig./mês, Gantt físico semanal com `██/◑/✔`, financeiro, núcleos ativos, grupos, equipes, Curva S com `LineChart`, semana-a-semana, riscos) — todos os dados de núcleos/grupos estão hardcoded a partir de `Execucao_Geral.xlsx` e `TRECHOS_NUCLEOS_RECORTADOS.xlsx`.

**Geradores de trechos.** `gerar_trechos_completo.py` lê os JSONs reais das NS já geradas (12 núcleos) e consolida em XLSX com subtotais e GRAND TOTAL. `gerar_trechos_inferidos.py`, `gerar_trechos_mega.py` e `gerar_trechos_recortados.py` **sintetizam** trechos PV-a-PV quando não há geometria real: usam `random.Random(seed)` com semente determinística por TAG para reprodutibilidade, perfis de terreno (dique/morro/monte/encosta/urbano/prolongamento/planície/palafita com pavimento, DN e declividade base) e classificação por nome/setor. `gerar_trechos_mega.py` agrupa os 83 núcleos por **Union-Find** (`connected_components`, limiar de proximidade `DIST_THRESHOLD=500 m`); `gerar_trechos_recortados.py` usa os 8 grupos GPKG reais resolvendo sobreposições por prioridade (R5 > R4) e separando isolados. Profundidade base por DIFIC: `{1:1.0, 2:1.3, 3:1.7, 4:2.1, 5:2.5}` m.

**`gerar_planilha_mega.py`.** Quantitativos completos com geometria de vala (`calc_quant`: escavação `lv·H·ext`, lastro, envoltória descontando volume do tubo `π(d/2)²·ext`, brita, reaterro, bota-fora, pavimentação, escoramento 2 faces, barras de 6 m) e custos SINAPI com BDI. **`associar_ruas_gpkg`** lê textos do GPKG (layer `texts`), filtra prefixos de logradouro e corrige *triple-encoding* UTF-8→cp1252 (mapa `_ENC_MAP`) com tolerância de snap de **50 m** (`np.hypot` ao ponto médio do trecho). Quatro abas: TRECHOS, QUANTITATIVOS POR RUA, RESUMO, MATERIAIS.

**`gerar_apresentacao.py`.** Relatório executivo de 8 abas (capa, situação hoje com KPIs LA/LE/PRA/PRE, núcleos ativos, meta 1.000, clusters geográficos, plano de ação semanal, cronograma visual, custos, 83 núcleos) lendo `nucleos_enriquecido.csv` + RESUMO_CLUSTERS do MEGA XLSX, mais **mapa Folium** (CartoDB positron) com 35 clusters coloridos, legenda, marcadores ★ para núcleos em execução e fallback de círculos por setor quando o GPKG falha.

**`gerar_tudo_nucleos.py`.** Orquestrador final: para cada núcleo (6 DXF + 5 LandXML) executa 7 outputs por NS (A4, JSON, DESENHO, SAT, HTML, OSE) e ~14 extras por núcleo (REDE_GERAL.html, GeoJSON, 5 Civil3D, NTS292, IFC LOD500, 6 XLSX via motores Lean/Microplan/Perdas, PDF de perdas), em estrutura `01_NS_CAMPO`…`08_CIVIL3D`. Contabiliza `total_ns`, `total_ose`, `total_extras` e acumula erros sem abortar.

### Dependências (bibliotecas)

- **matplotlib** (backend `Agg`) + **numpy** — PDFs A4/A3 de `gerar_ns.py`.
- **reportlab** (`SimpleDocTemplate`, `Table`, `TableStyle`, pagesize A4) — `gerar_pdf_perdas.py`.
- **ifcopenshell** (`ifcopenshell.api`) — `gerar_ifc_lod500.py`.
- **ezdxf** (`ezdxf.new`, `TextEntityAlignment`) — `gerar_civil3d.py`, `gerar_cadastro_nts292.py`.
- **openpyxl** (`Workbook`, `styles`, `chart`, `utils`) — todos os geradores XLSX.
- **folium** + **geopandas** — `gerar_apresentacao.py`, `gerar_trechos_recortados.py`, `gerar_planilha_mega.py` (GPKG).
- **pyproj** (`Transformer`) — reprojeção UTM↔WGS84 em `gerar_ns.py`.
- **contextily** (CartoDB Positron / OSM Mapnik) — base cartográfica opcional em `gerar_ns_sat`.
- **xml.etree.ElementTree** + **xml.dom.minidom** — LandXML, MS Project XML.
- Bibliotecas client-side via CDN: **Leaflet 1.9**, **Chart.js 4.4.2** (HTMLs).
- Módulos internos: `ler_dxf_gdal`, `ler_landxml`, `ler_dwg_universal`, `gerar_ose`, `core.database`, `motor_contratos`, `motor_asbuilt`, `motor_perdas`, `motor_lean_lps`, `motor_microplanejamento`, `cadastro.folha_a4`, `cadastro.ler_cartografia`, `cadastro.ler_topo`, `cadastro.compilar_campo`, `cadastro.base_topografica`.

### Detalhes notáveis

- **Tolerância de snap de ruas:** 50 m em `gerar_planilha_mega.associar_ruas_gpkg` (snap geométrico distinto da tolerância de 3 m da leitura de rede mencionada no CLAUDE.md).
- **Divergências projeto×campo:** limiar de 5 cm (registro) e 10 cm (significativa) em `gerar_cadastro_nts292.py`.
- **Validação geográfica V (coordenadas brasileiras):** `_coords_validas` em `gerar_ns.py` impede que PVs com UTM corrompido sejam plotados nos mapas.
- **Validação IFC:** afirmações pós-escrita garantem que todos os tubos e PVs foram realmente exportados.
- **Tratamento robusto:** uso extensivo de `try/except` graciosos (cartografia sem internet, ifcopenshell/openpyxl ausentes, folha A4 indisponível) para não abortar o pipeline em lote.
- **Correção de triple-encoding:** mapa `_ENC_MAP` em `gerar_planilha_mega.py` corrige textos AutoCAD UTF-8→cp1252→UTF-8 e quebras `\P`/`\p`.
- **Reprodutibilidade dos inferidos:** sementes `random.Random` derivadas da TAG do núcleo garantem que reexecuções gerem os mesmos trechos sintéticos.
- **Convenção de declividade inconsistente** entre `gerar_ns.calc_manning` (usa `decl_mm` direto como m/m) e `gerar_ifc_lod500._calc_manning` (divide por 1000) — ponto de atenção para harmonização futura.

---

## Arquitetura Web (API / Backend / Core)

Este subsistema é o resultado da migração da plataforma legada **NOVA NS Versão 5** (originalmente desktop, baseada em Tkinter/pywebview) para uma aplicação **web REST**. Ele expõe os motores de Notas de Serviço (NS), RDO, Ciclo Operacional, BI e o backbone offline ConstruData através de uma API HTTP, persistindo tudo em um banco relacional (SQLite local ou PostgreSQL no deploy). O nome interno da plataforma é `construdatamaxv2` / `ConstruDataMaxV2` (definido em `core/config.py`).

### Propósito e visão geral

O subsistema cobre três camadas claras:

- **`api/`** — Camada de transporte HTTP. Aplicação FastAPI (`server.py`) que registra dez routers e serve páginas HTML estáticas. Os routers são finos: validam o payload e delegam para a camada `core`/`campo`/`financeiro`/`analytics_operacional`. O módulo `api/operational.py` concentra a lógica de negócio do Ciclo Operacional (desvios, métricas SPI/CPI/PPC, fallback determinístico/XGBoost, replanejamento).
- **`backend/`** — Entrypoint de deploy no Render. `main.py` apenas insere a raiz do repositório no `sys.path` e reexporta `api.server.app` para o `uvicorn`.
- **`core/`** — Núcleo compartilhado: configuração (`config.py`), persistência SQLAlchemy 2.0 (`database.py`, `models.py`) e o backbone offline ConstruData (`construdata_offline.py`).

### Framework web

O framework é **FastAPI**, não Flask. Confirmado em `api/server.py`:

```python
app = FastAPI(title=f"{PLATFORM_DISPLAY_NAME} API", version="2.0.0")
```

Detalhes relevantes:
- **CORS aberto:** `CORSMiddleware` com `allow_origins=["*"]`, `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`. Isso permite o consumo pelo frontend React local e por qualquer origem (sem restrição de domínio).
- **Bootstrap no startup:** no evento `@app.on_event("startup")` chama-se `bootstrap_database(force_import=False)`, que cria o schema e tenta importar a base legacy se o banco estiver vazio.
- **Servidor de HTML:** o helper `_servir_html()` resolve arquivos em `HTML_DIR` (pasta `html/`) e retorna `FileResponse` com `text/html; charset=utf-8`. A rota raiz `GET /` faz `RedirectResponse("/rdo", status_code=307)`.
- **Snapshot dinâmico de "manage":** `_manage_snapshot_atual()` procura o HTML mais recente em `tempfile.gettempdir()/construdata_manage/manage_atual_*.html`, ordenando por `st_mtime` (mais novo primeiro), e o serve em `GET /manage` quando existir.

`backend/main.py` roda com:
```python
uvicorn.run("main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8787")), reload=False)
```
A porta padrão local é **8787** (também o padrão em `core/config.py`, `CONSTRUDATA_API_PORT`).

### Tabela Arquivo | Responsabilidade | Principais funções/classes

| Arquivo | Responsabilidade | Principais funções/classes |
| --- | --- | --- |
| `api/server.py` | Cria o `app` FastAPI, registra routers e middleware, serve páginas HTML | `app`, `on_startup()`, `health()`, `raiz()`, `_servir_html()`, `_manage_snapshot_atual()`, telas `/rdo` `/manage` `/controle` `/bi/analytics` `/ciclo-operacional` `/campo` `/ns-v5` |
| `api/operational.py` | Lógica do Ciclo Operacional: log, desvios, métricas, ML/fallback, replanejamento | `log_operational_event()`, `calcular_metricas_desvio()`, `classificar_severidade()`, `gerar_desvios_rdo()`, `fallback_deterministico()`, `tentar_xgboost()`, `aplicar_replanejamento()` |
| `api/routes_ns.py` | CRUD/consulta de Notas de Serviço | `api_listar_ns()`, `api_detalhe_ns()`, `api_atualizar_status_ns()` |
| `api/routes_ns_v5.py` | Camada `ns-v5` (14 módulos web) para o ConstruDataWeb | `api_ns_v5_modules()`, `api_ns_v5_contracts()`, `api_ns_v5_projects()`, `api_ns_v5_snapshot()`, `api_ns_v5_module()`, `api_ns_v5_rdo_texto()`, `api_ns_v5_ml()` |
| `api/routes_rdo.py` | RDO: criação, upload automático, PDF, revisão, finalização, medição/relatório 360 | `api_listar_rdo()`, `api_criar_rdo()`, `api_rdo_automatico_upload()`, `api_rdo_pdf()`, `api_rdo_revisar()`, `api_rdo_finalizar()`, `api_relatorio360_rdo()`; usa `RDOEngine` |
| `api/routes_campo.py` | Dashboards, fotos, curva S, cronograma, webhook WhatsApp | `api_webhook_whatsapp()`, `api_dashboard()`, `api_fotos_ns()`, `api_curva_s()`, `api_cronograma()` |
| `api/routes_cadastro.py` | Cadastro técnico (rede em GeoJSON) | `api_cadastro_geojson()` |
| `api/routes_bi_analytics.py` | BI Analytics operacional + exportação PDF/XLSX | `api_bi_analytics()`, `api_bi_analytics_recalcular()`, `api_bi_analytics_pdf()`, `api_bi_analytics_excel()` |
| `api/routes_evolucao.py` | Evolução 360 (consolidação tipo Palantir): predição, ontologia, ciclo | `api_evolucao_resumo()`, `api_evolucao_predicao()`, `api_evolucao_ontologia()`, `api_evolucao_executar_ciclo()` |
| `api/routes_operational.py` | REST do Ciclo Operacional por núcleo (logs, planejamento, desvios, ML, replanejamento) | `api_criar_log()`, `api_listar_planejamentos()`, `api_criar_planejamento()`, `api_validar_planejamento()`, `api_listar_desvios()`, `api_recalcular_desvios()`, `api_validar_replanejamento()` |
| `api/routes_construdata_offline.py` | API genérica do backbone offline (`/api/offline/...`) | `api_offline_health()`, `api_offline_projetos()`, `api_offline_entity_list/create()`, `api_offline_snapshot()`, `api_offline_relatorio()` |
| `api/routes_frontend_local.py` | Fachada local para o frontend React (projetos, dashboard, gestão360, torre, financeiro, planejamento, ML) | `_base()`, `_project_record()`, `api_frontend_projetos()`, `api_frontend_dashboard()`, `api_frontend_gestao360()`, `api_frontend_torre()`, `api_frontend_financeiro()`, `api_frontend_ciclo_operacional()` |
| `backend/main.py` | Entrypoint de deploy (Render) — ajusta `sys.path` e reexporta o `app` | `REPO_ROOT`, `app`, bloco `uvicorn.run` |
| `core/config.py` | Configuração central (paths, CRS, BDI, DATABASE_URL, host/porta) | `PLATFORM_NAME`, `CRS_PROJETO`, `BDI_PADRAO`, `DATABASE_URL`, `ensure_runtime_dirs()` |
| `core/database.py` | Persistência: engine/sessão, migração SQLite sem Alembic, importadores legacy, KPIs, GeoJSON, curva S | `get_session()`, `criar_banco()`, `upsert_ns_com_relacoes()`, `bootstrap_database()`, `geojson_rede()`, `kpis_nucleo()`, `dashboard_metricas()`, `curva_s_dados()` |
| `core/models.py` | Modelos SQLAlchemy 2.0 (NS, PV, Trecho, RDO e satélites, Ciclo Operacional) | `Base`, enums `StatusNS`/`StatusRDO`/`SeveridadeDesvio`, classes `NS`, `PV`, `Trecho`, `RDO`, `RDOApontamento`, `PlanejamentoSemanal`, `DesvioPlanejamento`, `MLExecucao`, `Replanejamento` |
| `core/construdata_offline.py` | Backbone offline ConstruData: projetos/contatos/entidades que não dependem de NS | classes `CDM*`, `ENTITY_MODELS`, `PROJECT_NUCLEO_GROUPS`, `seed_offline_core()`, `project_snapshot()`, `build_project_report()` |

### Inventário completo de rotas/endpoints

**Páginas HTML e healthcheck (`api/server.py`):**
- `GET /` → redireciona 307 para `/rdo`
- `GET /health` → `{"ok": True, "app": PLATFORM_NAME, "display_name": PLATFORM_DISPLAY_NAME}` (usado pelo `healthCheckPath` do Render)
- `GET /rdo`, `GET /manage`, `GET /controle`, `GET /bi/analytics`, `GET /ciclo-operacional`, `GET /campo`, `GET /ns-v5`, `GET /ns-v5/{module_key}` → servem HTML estático de `html/`

**Notas de Serviço (`routes_ns.py`):**
- `GET /api/ns?nucleo=&status=` → lista NS
- `GET /api/ns/{ns_id}` → detalhe completo (PVs, trechos, checklist, fotos, apontamentos)
- `PATCH /api/ns/{ns_id}/status` → atualiza status (exige campo `status`)

**ns-v5 (`routes_ns_v5.py`, prefixo `/api/ns-v5`):**
- `GET /modules`, `GET /contracts`, `GET /projects`
- `GET /projects/{project_id}/snapshot`
- `GET /projects/{project_id}/modules/{module_key}`
- `POST /projects/{project_id}/rdo/preencher-texto` (parser de texto operacional)
- `POST /projects/{project_id}/ml/recalcular` (roda `tentar_xgboost` por núcleo)

**RDO (`routes_rdo.py`):**
- `GET /api/rdo`, `POST /api/rdo`
- `POST /api/rdo/automatico/upload` (recebe `content_base64` ou `texto`, grava evidência em `_RDO_EVIDENCIAS/AAAAMMDD/`, chama `criar_rdo_automatico`)
- `PATCH /api/rdo/{rdo_id}/fechar`, `GET /api/rdo/{rdo_id}/pdf`, `GET /api/rdo/{rdo_id}/evidencias`
- `PATCH /api/rdo/{rdo_id}/revisar`, `POST /api/rdo/{rdo_id}/finalizar`, `POST /api/rdo/{rdo_id}/rejeitar`
- `GET /api/rdo/{rdo_id}/medicao-fontes`, `GET /api/relatorio360/rdo/{rdo_id}`
- `DELETE /api/rdo/{rdo_id}` (soft delete via `deleted_at`)
- `GET /api/rdo/{data_ref}` (RDO de um dia específico)

**Campo/Dashboards (`routes_campo.py`):**
- `POST /webhook/whatsapp` (encaminha para `processar_webhook_whatsapp`)
- `GET /api/dashboard?nucleo=`, `GET /api/fotos/{ns_id}`, `GET /api/curva-s?nucleo=`, `GET /api/cronograma?nucleo=`

**Cadastro (`routes_cadastro.py`):** `GET /api/cadastro/geojson?nucleo=` → FeatureCollection GeoJSON.

**BI Analytics (`routes_bi_analytics.py`):** `GET /api/bi/analytics`, `POST /api/bi/analytics/recalcular`, `GET /api/bi/analytics/export/pdf`, `GET /api/bi/analytics/export/excel`.

**Evolução 360 (`routes_evolucao.py`):** `GET /api/evolucao`, `GET /api/evolucao/predicao`, `GET /api/evolucao/ontologia`, `POST /api/evolucao/{nucleo}/executar-ciclo`.

**Ciclo Operacional por núcleo (`routes_operational.py`):**
- `POST /api/logs`, `GET /api/nucleos/{nucleo}/logs?limit=`
- `GET|POST /api/nucleos/{nucleo}/planejamentos-semanais`, `POST .../{plan_id}/validar`
- `GET /api/nucleos/{nucleo}/desvios?limit=`
- `POST /api/nucleos/{nucleo}/ml/recalcular-desvios`
- `GET /api/nucleos/{nucleo}/replanejamentos`, `POST .../{replanejamento_id}/validar` (ações: `aprovar`, `rejeitar`, `aplicar`)

**Backbone offline (`routes_construdata_offline.py`, prefixo `/api/offline`):**
- `GET /health`, `GET|POST /projetos`, `GET|POST /contatos`
- `GET /projetos/{project_id}/dashboard|snapshot|relatorio360`
- `POST /projetos/{project_id}/relatorio360/export`
- `GET|POST /projetos/{project_id}/{entity}` (entidades genéricas)
- `PATCH /{entity}/{row_id}/status`

**Fachada do frontend React (`routes_frontend_local.py`):** mais de 40 endpoints sob `/api/...`, incluindo `GET /api/health/integrations`, `GET|POST /api/projetos`, `GET /api/projetos/{id}/dashboard|gestao360|torre|financeiro|controle-fluxo|ciclo-operacional`, CRUD de tarefas/contatos/LPS-restrições, `whatsapp/agendamentos` (stubs locais), planejamentos semanais (incluindo `preencher-texto`), `ml/recalcular-desvios`, replanejamentos (`validar`/`aplicar`) e `GET /api/nucleos`.

### Modelo de dados (`core/models.py`)

Modelos **SQLAlchemy 2.0** (sintaxe `Mapped[...]` / `mapped_column`), com `Base(DeclarativeBase)` e `__allow_unmapped__ = True`. Banco padrão SQLite; PostgreSQL opcional via `DATABASE_URL`.

**Enums:** `StatusNS` (PLANEJADA, EM_EXECUCAO, CONCLUIDA, MEDIDA, BLOQUEADA), `StatusRDO` (ABERTO, FECHADO, ASSINADO), `StatusRevisaoRDO` (rascunho, extraido, em_revisao, finalizado, rejeitado), `TipoOcorrencia`, `SeveridadeDesvio` (BAIXA, MEDIA, ALTA, CRITICA), `StatusPlanejamento` (RASCUNHO, ATIVO, ENCERRADO, SUBSTITUIDO), `StatusReplanejamento` (RASCUNHO, APROVADO, REJEITADO, APLICADO).

**Tabelas principais:**
- `ns` — Nota de Serviço. Campos de identificação (`seq`, `nucleo`, `pv_ini`, `pv_fim`), técnicos (`ext_m`, `dn_mm`, `material`, `rua`), de status/datas, **cotas de campo reais** (`ct_ini_real`, `cf_ini_real`, `ct_fim_real`, `cf_fim_real`), medição (`bm_numero`, `bm_valor`), rastreabilidade de origem (`caminho_json`, `nome_arquivo`, `origem_dados`) e integração WhatsApp (`wa_ultima_msg`, `wa_timestamp`). Gera o código `NS_{seq:03d}` em `to_dict()`.
- `pv` — Poço de Visita / Ponto de Inspeção. Coordenadas projetadas (`x`, `y`), geográficas (`lat`, `lon`), cotas (`ct` = cota de terreno, `cf` = cota de fundo), `prof`, `tipo` (PV/PI/TI) e `is_agua` (booleano que distingue rede de água de esgoto).
- `trecho` — Geometria/dados do trecho entre dois PVs, incluindo `decl_mm` (declividade).
- `rdo` — Relatório Diário de Obra, com revisão/qualidade (`status_revisao`, `assinatura_presente`), multitenant (`organization_id`, `project_id`), soft delete (`deleted_at`), `total_custo`, `pdf_path` e relacionamentos para `rdo_apontamento`, `rdo_equipe`, `rdo_ocorrencia`, `rdo_foto`, `rdo_evidencia`, `rdo_extracao`, `rdo_medicao_fonte`, `rdo_qualidade_sinal`.
- Satélites do RDO: `rdo_evidencia` (com `hash_sha256`, `mime_type`, `tamanho_bytes` — útil para deduplicação/integridade), `rdo_extracao` (provider, `campos_json`, `confianca_json`, `pendencias_json` — extração estruturada de evidências), `rdo_medicao_fonte`, `rdo_qualidade_sinal` (severidade, `exige_fvs`).
- `checklist_ns` — checklist por NS com `CHECKLIST_PADRAO` de 8 itens (Escavação de vala, Lastro/berço de areia, Assentamento de tubulação, Teste de estanqueidade, Reaterro compactado, Recomposição de pavimento, Montagem de PV/PI, Ligação predial).
- `whatsapp_session` — máquina de estados por telefone (estado padrão `IDLE`).
- Ciclo Operacional: `operational_log` (log centralizado), `planejamento_semanal` + `planejamento_item` + `planejamento_validacao`, `desvio_planejamento` (com `spi`, `cpi`, `ppc`, `severidade`, `acao_recomendada`), `ml_execucao` e `replanejamento`.

O backbone offline (`core/construdata_offline.py`) adiciona, sobre a mesma `Base`, as tabelas `cdm_projeto`, `cdm_contato`, `cdm_tarefa`, `cdm_lps_restricao`, `cdm_suprimento`, `cdm_mao_obra`, `cdm_equipamento`, `cdm_custo`, `cdm_agenda`, `cdm_punch_item`, `cdm_whatsapp_log`. O mapa `ENTITY_MODELS` é o que viabiliza as rotas genéricas `/api/offline/projetos/{id}/{entity}`.

### Camada de persistência (`core/database.py`)

- **Engine lazy:** `_get_engine()` cria o engine com `future=True`; para SQLite aplica `connect_args={"check_same_thread": False}` (necessário porque o FastAPI/uvicorn pode acessar a sessão em threads diferentes). `_SessionLocal` usa `expire_on_commit=False`.
- **Sessão transacional:** `get_session()` é um `@contextmanager` que faz `commit` ao sair, `rollback` em exceção e sempre `close`.
- **Migração sem Alembic:** `_ensure_sqlite_columns()` aplica `ALTER TABLE ... ADD COLUMN` idempotente para colunas novas (apenas em SQLite), evitando dependência de ferramenta de migração. É chamado em `criar_banco()` após `Base.metadata.create_all`.
- **Importadores legacy:** `importar_ns_json_arquivo` (lê `*DADOS.json`), `importar_status_ns_json` (migra `STATUS_NS.json`), `importar_consolidado_notas_servico` (usa `CONSOLIDADO_NOTAS_SERVICO.json`) e `importar_pvs_trechos`. O `upsert_ns_com_relacoes` deduz `is_agua` a partir do material (tokens PEAD, PPR, FFD, FOFO, AGUA) e mapeia status legados (PLANEJADO/EXECUTADO/CADASTRADO/MEDIDO → enum `StatusNS`).
- **`bootstrap_database()`:** cria schema e, se não houver NS, importa o consolidado; caso falhe, varre pastas de fallback (`EXEMPLO_COMPLETO`, `SAIDA_BIM_SABESP`, `SAIDA_HYDRONETWORK`) por `*DADOS.json` via `rglob`. Possui flag `_bootstrapped` para evitar reimportação.
- **Saídas analíticas:** `geojson_rede()` gera **GeoJSON** (`FeatureCollection` com `LineString` para trechos e `Point` para PVs, em coordenadas `x`/`y` projetadas); `kpis_nucleo()`/`dashboard_metricas()` consolidam % físico e financeiro; `curva_s_dados()` produz previsto/realizado acumulado para a Curva S.

### Formatos de entrada e saída

| Formato | Onde | Direção |
| --- | --- | --- |
| **JSON** | Toda a API REST (payloads e respostas) | E/S |
| **GeoJSON** | `GET /api/cadastro/geojson` (`geojson_rede`) | Saída |
| **HTML** | Telas servidas por `server.py` (`html/*.html`) | Saída |
| **PDF** | RDO (`/api/rdo/{id}/pdf`, via `reportlab`) e BI (`/api/bi/analytics/export/pdf`) | Saída |
| **XLSX** | BI Analytics (`/api/bi/analytics/export/excel`, `openpyxl`) | Saída |
| **Markdown** | Relatório 360 offline (`build_project_report`/`export_project_report`) | Saída |
| **base64 / binário** | Upload de evidências de RDO (`/api/rdo/automatico/upload`) | Entrada |
| **JSON legacy** (`*DADOS.json`, `STATUS_NS.json`, `CONSOLIDADO_NOTAS_SERVICO.json`) | Importadores em `core/database.py` | Entrada |

Observação: formatos de engenharia (DXF/DWG/LandXML/IFC) **não** são manipulados dentro deste subsistema web — eles pertencem aos motores legados (ezdxf/pyproj/shapely aparecem apenas em `requirements-full.txt`, não no requirements do deploy web).

### Fórmulas, normas técnicas e constantes encontradas no código

- **Constantes contratuais/geodésicas (`core/config.py`):** `CONTRATO_PADRAO = "11481051"` (contrato SLNR/Santos, também default em `RDO.contrato`), `BDI_PADRAO = 1.25` (BDI de 25%), `CRS_PROJETO = "EPSG:31983"` (SIRGAS 2000 / UTM 23S — São Paulo) e `CRS_WEB = "EPSG:4326"` (WGS84).
- **Métricas de gestão de projetos (`api/operational.py`, `calcular_metricas_desvio`):**
  - SPI (Schedule Performance Index) = `realizado / meta` (>1 adiantado)
  - CPI (Cost Performance Index) = `custo_previsto / custo_real` (>1 abaixo do orçamento)
  - PPC (Percent Plan Complete / Last Planner System) = `min(realizado/meta*100, 100)`
  - Desvio percentual = `(realizado - meta)/meta*100`; desvio de custo = `custo_real - custo_previsto`.
- **Classificação de severidade (`classificar_severidade`):** pega o pior entre |desvio %| e |custo %| — `>50%` → CRITICA, `>30%` → ALTA, `>15%` → MEDIA, senão BAIXA.
- **Fallback determinístico (`fallback_deterministico`):** pesos por severidade CRITICA=4, ALTA=3, MEDIA=2, BAIXA=1; gera sugestão quando peso ≥ 3; confiança = `min(n_desvios/10, 1.0)`; gera replanejamento rascunho se `score_total >= 6` ou existir desvio CRITICA.
- O fluxo do Ciclo Operacional segue a lógica **Last Planner System** (planejamento semanal do engenheiro → validação do diretor → RDO diário → comparação planejado×realizado → desvios automáticos → ML/fallback → replanejamento → aprovação/aplicação → novo plano oficial), explicitada nas 9 etapas (`steps`) de `api_frontend_ciclo_operacional`.

Não há, neste subsistema, equações hidráulicas (Manning, tensão trativa τ) nem tabelas SINAPI/NTS SABESP no código lido — elas residem nos motores de dimensionamento legados, fora dos arquivos-alvo.

### Modo offline (`core/construdata_offline.py`)

O backbone offline garante que projetos, contatos e entidades de gestão funcionem **sem** depender das Notas de Serviço nem de serviços externos:

- **Seeding idempotente:** `seed_offline_core()` (chamado em quase todas as funções públicas) recria o schema e insere 6 projetos oficiais (`OFFICIAL_PROJECTS`, com UUIDs fixos — Tatuí-RK, Osasco, Consórcio/SLNR Santos, Pardinho, Brasília, Morro do Teteu) e 13 contatos oficiais (`OFFICIAL_CONTACTS`).
- **Agrupamento de núcleos:** `PROJECT_NUCLEO_GROUPS` expande projetos "guarda-chuva" — ex.: `TATUI` agrupa TATUI, CESARIO_LANGE, PORANGABA e SAO_ROQUE. `nucleos_do_projeto()` é usado em quase todos os routers para somar dados de múltiplos núcleos.
- **Entidades genéricas:** `ENTITY_MODELS` mapeia 9 entidades (`tarefas`, `lps`, `suprimentos`, `mao_obra`, `equipamentos`, `custos`, `agenda`, `punch`, `whatsapp`) atendidas pelas rotas genéricas, com coerção de tipos (`_parse_date`, `_float`, `_int`).
- **Snapshot e relatório:** `project_snapshot()` consolida contagens e totais (custos lançados, mão de obra/dia, equipamentos/dia, custo diário estimado); `build_project_report()` gera **Markdown** e `export_project_report()` o grava em `SAIDA_CONSTRUDATA_OFFLINE/`.
- **Health offline:** `offline_health()` reporta `mode: "offline"` e `database: "sqlite"|"external"` conforme o `DATABASE_URL`.
- Para evitar erros de objeto detached, as funções fazem `session.expunge(row)` antes de retornar entidades para fora da sessão.

### Deploy no Render (`render.yaml`)

Serviço web único:
```yaml
services:
  - type: web
    name: construdatamaxv2-api
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    autoDeploy: true
    healthCheckPath: /health
```
- **`rootDir: backend`** — o build/start ocorre dentro de `backend/`, por isso `main.py` insere `REPO_ROOT` (pasta-pai) no `sys.path` antes de `from api.server import app`, permitindo importar `api/`, `core/`, `campo/`, etc.
- **buildCommand** usa o `backend/requirements.txt` (FastAPI, uvicorn[standard], SQLAlchemy 2.0, `psycopg2-binary` para PostgreSQL, `aiosqlite`, `python-multipart`, `reportlab`, `google-genai`, `requests`).
- **startCommand** sobe o `uvicorn` apontando para `main:app` com `--port $PORT` (Render injeta `PORT`).
- **`healthCheckPath: /health`** — o Render monitora a saúde via `GET /health`.
- **`autoDeploy: true`** — deploy automático a cada push.
- **envVars (todas `sync: false`, ou seja, configuradas manualmente no painel):**
  - `DATABASE_URL` — string de conexão (PostgreSQL no deploy; `core/config.py` cai para SQLite local `SAIDA_HYDRONETWORK/db/construdata.db` se ausente).
  - `GEMINI_API_KEY` — chave do Google Gemini, consumida pela extração de RDO/LLM (não referenciada dentro dos arquivos do pacote `api/`; o `requirements.txt` do backend instala `google-genai`).
  - `CONSTRUDATA_API_BASE_URL` — URL base da API (default local `http://127.0.0.1:8787`).

### Requirements: três arquivos distintos

- **`backend/requirements.txt`** — dependências do **deploy web** (FastAPI/uvicorn/PostgreSQL/Gemini); é o que o Render instala.
- **`requirements.txt`** (raiz) — dependências do **app desktop/local** legado (sqlalchemy, pandas, openpyxl, requests, python-dotenv, reportlab, `pywebview>=6.2`).
- **`requirements-full.txt`** — superset com as libs dos **motores de engenharia/ML**: `xgboost>=2.0`, `scikit-learn>=1.3`, `ezdxf>=0.18` (DXF), `pyproj>=3.6` (transformação de CRS), `shapely>=2.0` (geometria), além de reportlab e pywebview.

### Detalhes notáveis

- **Migração documentada (`NS_V5_WEB_MIGRATION_20260501.md`):** registra a criação da camada `ns-v5` (14 módulos com manifesto web e contratos de dados), o snapshot único por projeto/núcleo, as telas `/ns-v5` e `/ns-v5/{module_key}`, e os 7 endpoints novos `/api/ns-v5/*`. Inclui instruções de rollback (remover `campo/ns_v5_web.py`, `api/routes_ns_v5.py`, `html/construdata_ns_v5.html` e desfazer as linhas adicionadas em `api/server.py`).
- **XGBoost com fallback gracioso:** `tentar_xgboost()` tenta `import xgboost`; mesmo quando a lib existe, o modelo "não está treinado" e cai em `fallback_deterministico()`. Há um `# TODO` explícito para treinar o modelo com histórico de desvios.
- **GEMINI_API_KEY declarada mas não usada no pacote `api/`:** o grep por `GEMINI`/`genai` no diretório `api/` não retorna ocorrências — a chave alimenta os engines de extração fora do escopo deste subsistema (o backend apenas instala `google-genai`).
- **Soft delete de RDO:** todas as consultas de RDO filtram `RDO.deleted_at.is_(None)`; a exclusão via `DELETE /api/rdo/{id}` apenas marca `deleted_at`.
- **Tratamento de erro resiliente em `api_criar_rdo`:** se a geração de desvios falhar, o RDO ainda é retornado com `desvios_planejamento: []` e o erro é registrado em `operational_log` via `log_operational_event` (severidade ERROR, status OPEN).
- **Coerção robusta de tipos:** `_coerce_float`/`_coerce_int` em `core/database.py` tratam vírgula decimal brasileira (`"3,50"` → `3.5`) e sentinelas `""`/`"-"` como `None`.
- **Convenção de bug corrigido herdada do motor (CLAUDE.md):** a redução da tolerância de snap de 20 m para 3 m e a conversão de Arrays para `shapely.Point` afetam a leitura DXF/DWG legada (`ler_dxf_gdal.py`/`ler_dwg_universal.py`), fora deste subsistema, mas explica por que as libs de geometria estão isoladas em `requirements-full.txt`.
- **Validações de payload:** os endpoints validam campos obrigatórios e retornam HTTP 400/404 apropriadamente (ex.: `status` em `PATCH /api/ns/{id}/status`, `data` em `POST /api/rdo`, `texto` nos endpoints `preencher-texto`, `semana_inicio`/`semana_fim` em planejamento). Não há um conjunto formal V001–V008 neste subsistema web.

Caminhos relevantes (relativos à raiz): `api/server.py`, `api/operational.py`, `api/routes_ns.py`, `api/routes_ns_v5.py`, `api/routes_rdo.py`, `api/routes_campo.py`, `api/routes_cadastro.py`, `api/routes_bi_analytics.py`, `api/routes_evolucao.py`, `api/routes_operational.py`, `api/routes_construdata_offline.py`, `api/routes_frontend_local.py`, `backend/main.py`, `backend/requirements.txt`, `core/config.py`, `core/database.py`, `core/models.py`, `core/construdata_offline.py`, `render.yaml`, `requirements.txt`, `requirements-full.txt`, `NS_V5_WEB_MIGRATION_20260501.md`.

---

## Campo, RDO e Ciclo Operacional

### Propósito do subsistema

Este subsistema fecha o laço **campo → escritório → medição** do NOVA NS Versão 5. Ele captura dados de execução de obra (produção, equipe, custos, fotos, ocorrências) por três canais distintos — bot conversacional WhatsApp, webhook WhatsApp (Meta Cloud API) e texto colado/upload de documento — e os transforma em um **RDO (Relatório Diário de Obra)** persistido em banco. A partir do RDO, o sistema deriva automaticamente: **fontes de medição** rastreáveis, **sinais de qualidade** (pendências de evidência/FVS), **desvios planejado×realizado** (PPC, SPI, CPI, severidade), **replanejamento** (ML/fallback) e o painel **Evolução 360** (camada tipo Palantir). O motor de RDO é deliberadamente independente do GUI: pode ser acionado por API REST, CLI, bot WhatsApp ou aba Tkinter offline (`campo/rdo_engine.py`, linhas 126-129).

### Arquivos e responsabilidades

| Arquivo | Responsabilidade | Principais funções/classes |
|---|---|---|
| `campo/rdo_engine.py` | Motor central do RDO: criar, atualizar, revisar, finalizar, fechar, gerar PDF e Markdown | `RDOEngine` (`criar_rdo`, `criar_rdo_completo`, `adicionar_apontamento`, `adicionar_equipe`, `adicionar_ocorrencia`, `adicionar_foto`, `registrar_evidencia`, `registrar_extracao`, `revisar_rdo`, `finalizar_rdo`, `fechar_rdo`, `gerar_pdf`, `atualizar_curva_s`, `_sync_status_ns_json`); `_custo_unit`, `_checklist_servico`, `_sha256_file` |
| `campo/rdo_automatico.py` | Pipeline plugável de RDO automático a partir de foto/PDF/texto, com extração e pendências | `RDOExtractionProvider`, `DeterministicRDOExtractionProvider` (`extract`), `criar_rdo_automatico` |
| `campo/rdo_integracoes.py` | Derivações do RDO finalizado: medição, qualidade, gestão e relatório 360 | `gerar_fontes_medicao`, `gerar_sinais_qualidade`, `resumo_gestao360_rdo`, `resumo_relatorio360_rdo` |
| `campo/texto_operacional.py` | Parser único de texto colado (RDO, planejamento, custos, desvios) e aplicação no banco | `parse_texto_operacional`, `payload_frontend_para_operacional`, `aplicar_operacional`, `aplicar_texto_operacional`, `_criar_plano_e_desvios`, `_itens_quantidade`, `_equipe`, `_custos`, `_desvios`, `_nucleo_do_texto` |
| `campo/whatsapp_bot.py` | Bot conversacional (state machine) de apontamento de campo persistido em SQLite | `WhatsAppBot` (`process_webhook`, `process_message`, estados `_estado_*`, `_normalizar_payload`, `_salvar_media_base64`, `_resolver_ns*`) |
| `campo/webhook_server.py` | Helper fino que despacha payload de webhook ao `WhatsAppBot` | `processar_webhook_whatsapp` |
| `campo/ns_v5_web.py` | Camada web ns-v5: expõe módulos, contratos de dados e snapshot consolidado por projeto | `listar_modulos_ns_v5`, `contratos_ns_v5`, `snapshot_ns_v5`, `module_payload`; constantes `NS_V5_MODULES`, `DATA_CONTRACTS` |
| `campo/evolucao_platform.py` | Plataforma Evolução 360 (Palantir-like): score, predição de risco, ontologia, 14 módulos | `resumo_evolucao`, `executar_ciclo_evolucao`, `_predicao`, `_ontologia`, `_module`, `_score_status`, `_decisao_texto` |
| `whatsapp_receiver.py` (raiz) | Webhook FastAPI standalone (Meta Cloud API) que atualiza `STATUS_NS.json` | `app`, `verify_webhook`, `receive_webhook`, `simular`, `_processar_mensagem`, etapas `_etapa_*`, `_parse_ns_id`, `_parse_dados_campo`, `_baixar_midia`, `_send_whatsapp` |
| `api/routes_rdo.py` | Rotas REST do RDO (listar, criar, upload automático, fechar, revisar, finalizar, rejeitar, evidências, medição, relatório 360, soft-delete, PDF) | `api_listar_rdo`, `api_criar_rdo`, `api_rdo_automatico_upload`, `api_fechar_rdo`, `api_rdo_revisar`, `api_rdo_finalizar`, `api_rdo_rejeitar`, `api_relatorio360_rdo`, `api_rdo_pdf` |
| `api/operational.py` | Núcleo do Ciclo Operacional: log, métricas de desvio, geração de desvios, ML/fallback, replanejamento | `log_operational_event`, `calcular_metricas_desvio`, `classificar_severidade`, `gerar_desvios_rdo`, `fallback_deterministico`, `tentar_xgboost`, `aplicar_replanejamento` |
| `api/routes_operational.py` | Rotas REST do ciclo: logs, planejamentos semanais, validação, desvios, recálculo ML, replanejamentos | `api_criar_log`, `api_criar_planejamento`, `api_validar_planejamento`, `api_listar_desvios`, `api_recalcular_desvios`, `api_validar_replanejamento` |
| `api/routes_campo.py` | Webhook WhatsApp do bot e dashboards (curva S, cronograma, fotos) | `api_webhook_whatsapp`, `api_dashboard`, `api_curva_s`, `api_cronograma` |
| `ui_operational_cycle.py` | Aba nativa Tkinter (sem HTML) para o ciclo operacional offline, consumindo o mesmo banco | `build_operational_cycle_tab`, `_load_operational_summary`, `_create_weekly_plan`, `_validate_latest_plan`, `_latest_replan_action`, `_run_ml` |
| `whatsapp-motor/index.js` | Motor Node (whatsapp-web.js) — conexão por QR, parser RDO bruto, integração Supabase/Obsidian e ponte para FastAPI | `parseRDO`, `_parseServico`, `_parseEquipe`, `_parseFinanceiro`, `_parseOcorrencia`, `resumoRDO`, `enviarRDOParaAPI`, handlers Express `/api/send`, `/api/team`, `/api/logs` |
| `sql_rdos_whatsapp.sql` | Migração Supabase: colunas extras em `rdos` para dados do WhatsApp + políticas RLS + projetos fixos | DDL `ALTER TABLE rdos`, `CREATE POLICY`, `INSERT INTO projetos` |
| `MODELO_PREENCHER_TEXTO_OPERACIONAL.md` / `MODELO_PREENCHER_TEXTO_CONTROLE_FLUXO.md` / `GUIA_CICLO_OPERACIONAL_360_20260427.md` | Modelos de texto colável e guia do fluxo oficial 360 | — |

### Entradas e saídas (formatos)

**Entradas:**
- **Texto livre estruturado** colado no GUI ("Preencher com Texto") ou recebido via WhatsApp/e-mail — parseado por `parse_texto_operacional`. Seções reconhecidas: `Data/Dia`, `Producao/Atividades/Servicos`, `Material/Materiais`, `Mao de obra/Equipe/Pessoal`, `Equipamentos/Maquinas`, `Custos`, `Planejamento`, `Desvios`, `Ocorrencias`, `Paralisacoes`, `Responsavel`, `Clima` (`texto_operacional.py`, 173-205).
- **Imagens (JPG/PNG/WebP)** de campo: via base64 no webhook do bot (`_salvar_media_base64`, salva em `FOTOS_DIR`) ou via media-id na Meta Cloud API (`_baixar_midia` → `FOTOS_DIR/{data}_{sender}_{media_id[:8]}.jpg`).
- **Documentos/arquivos** em base64 (`POST /api/rdo/automatico/upload`) gravados em `SAIDA_HYDRONETWORK/_RDO_EVIDENCIAS/{YYYYMMDD}/` com hash SHA-256 (`routes_rdo.py`, 117-169; `rdo_engine._sha256_file`).
- **Payload JSON** do RDO completo (`POST /api/rdo`) e payloads de webhook Meta/Evolution.

**Saídas:**
- **PDF** do RDO via `reportlab` (`gerar_pdf`): A4, cabeçalho `#06060f`/`#00ff88`, em `SAIDA_HYDRONETWORK/<NUCLEO>/CAMPO/RDO/RDO_{numero:04d}_{data}.pdf`. Se `reportlab` ausente, retorna `""` (degradação graciosa).
- **Markdown** do RDO (`exportar_markdown`/`detalhe_markdown`) no mesmo diretório (`RDO_{numero:04d}_{data}.md`).
- **JSON**: `STATUS_NS.json` (sincronizado por `_sync_status_ns_json` e pelo receiver), respostas REST, snapshot ns-v5 e relatório 360.
- **Banco SQLite/SQLAlchemy** (tabelas `rdo`, `rdo_apontamento`, `rdo_equipe`, `rdo_ocorrencia`, `rdo_foto`, `rdo_evidencia`, `rdo_extracao`, `rdo_medicao_fonte`, `rdo_qualidade_sinal`, `whatsapp_session`, `operational_log`, etc.).
- **Supabase (PostgreSQL)**: tabelas `logs_rdo`, `equipes`, `rdos` (via motor Node), com colunas `producao_m`, `equipe_number`, `apontador`, `latitude/longitude`, `custo_diesel/alimentacao/mao_obra/materiais` (`sql_rdos_whatsapp.sql`).
- **Markdown/Obsidian**: caixa-preta `WhatsApp-Logs-Campo.md` (append automático pelo motor Node).

### Como o RDO é gerado automaticamente

Existem **três modos de criação**, todos convergindo para o mesmo `RDO` no banco:

**1. RDO manual/estruturado (`criar_rdo_completo`, API `POST /api/rdo`):** idempotente por `data + nucleo + organization_id` (a menos de `force_new`). Numeração sequencial por núcleo via `_numero_rdo_proximo` (`MAX(numero)+1`). Aceita `equipe`, `ocorrencias`/`paralisacoes`, `fotos`, `servicos`/`producao` (lista ou dict por NS) e recalcula `total_custo` somando os apontamentos. `_normalizar_payload_rdo` em `routes_rdo.py` converte `apontamentos` em `servicos` e clima string em `{manha, tarde}`.

**2. RDO automático por foto/PDF/texto (`criar_rdo_automatico`, API `POST /api/rdo/automatico/upload`):** o `DeterministicRDOExtractionProvider` (provider `deterministico_v1`) chama `parse_texto_operacional`, infere a data a partir do nome do arquivo via regex `(20\d{2})[-_]?(\d{2})[-_]?(\d{2})` quando ausente, e marca `assinatura_presente` se "assin" aparece no texto/filename. Calcula uma lista de **pendências** (`data`, `nucleo`, `responsavel` com confiança < 0.5; `servicos_quantidades`; `assinatura`). O RDO nasce com `origem="automatico"` e `status_revisao = "em_revisao"` se houver pendências, ou `"extraido"` caso contrário. Registra `RDOEvidencia` (com SHA-256 e tamanho) e `RDOExtracao` (raw/campos/confiança/pendências em JSON).

**3. RDO via WhatsApp** (ver seção seguinte) — o bot Python cria/atualiza o RDO do dia incrementalmente e o motor Node parseia mensagens completas e chama a API.

**Ciclo de vida e fechamento (`fechar_rdo`/`finalizar_rdo`):** ao fechar, o motor (1) recalcula `total_custo`, (2) muda NS de `PLANEJADA → EM_EXECUCAO`, (3) checa checklist completo da NS para promover a `CONCLUIDA` (define `data_fim`), (4) sincroniza `STATUS_NS.json` transicionando `PLANEJADO → EXECUTADO`, (5) gera o PDF. `finalizar_rdo` adicionalmente marca `status_revisao=FINALIZADO` e dispara `gerar_fontes_medicao`, `gerar_sinais_qualidade` e `resumo_relatorio360_rdo`.

**Custos (tabela SINAPI interna + BDI):** `_SINAPI_UNITARIO` em `rdo_engine.py` (35-53) traz valores R$/m por serviço (escavação 35, assentamento 85, reaterro 28, recomposição pavimento 120, ligação predial 450, montagem PV 1200, montagem PI 850, teste estanqueidade 15, lastro/berço 20). O custo unitário aplica `_BDI = BDI_PADRAO` (`core.config`); default 50.0×BDI. Custo total = `custo_unit × quantidade`. Há comentário explícito de usar `motor_custo` quando disponível.

### Integração WhatsApp (bot, webhook, receiver)

Existem **três implementações de WhatsApp** convivendo, com responsabilidades distintas:

**A. `WhatsAppBot` (`campo/whatsapp_bot.py`) — state machine persistida em SQLite.** Implementa um wizard conversacional cujo estado é gravado em `WhatsAppSession` (telefone único, `estado`, `contexto_json`). A máquina de estados: `IDLE → SELECAO_NUCLEO → SELECAO_NS → SERVICO → QUANTIDADE → DN → FOTO → MAIS_SERVICOS → OUTRA_NS → EQUIPE_ENCANADORES → EQUIPE_AJUDANTES → EQUIPE_OPERADORES → OCORRENCIA → OCORRENCIA_DESC → IDLE`. Núcleos padrão e aliases mapeiam fala do campo para nomes de banco (`NUCLEO_ALIASES`, ex. "verde e teteu" → `["Morro do Teteu", "Prol Teteu", ...]`). Ao receber a foto (`_estado_foto`), chama `analisar_foto_para_rdo` (motor Gemini) para gerar `legenda_rdo`, grava apontamento e foto, e ao final fecha o RDO no `_montar_resumo_final`. `_normalizar_payload` entende formatos Evolution API (`key.remoteJid`, `mediaBase64`, `extendedTextMessage`). É dependência opcional `evolutionapi` (importada com try/except). A entrada HTTP é `POST /webhook/whatsapp` (`api/routes_campo.py` → `processar_webhook_whatsapp` → `campo/webhook_server.py`).

**B. `whatsapp_receiver.py` (raiz) — webhook FastAPI para Meta Cloud API.** Servidor independente (`uvicorn whatsapp_receiver:app --port 8765`). Faz a verificação do webhook (`GET /webhook`, valida `hub.verify_token` contra `WA_VERIFY_TOKEN`, padrão `construdata_campo`) e processa mensagens (`POST /webhook`). Diferentemente do bot A, **não usa o RDOEngine** — atualiza diretamente o `STATUS_NS.json` via `motor_status_ns` (`transitar`, `atualizar_campo_real`, `atualizar_whatsapp`). Menu numérico: `1` NS executada, `2` Problema/parada (→ `BLOQUEADO`), `3` Dados campo CT/CF, `4` Foto de obra, `5` Status geral. Sessões em memória volátil (`_sessoes`, reinicia com o servidor). Parsers: `_parse_ns_id` (regex `\b(?:ns|nota[s]?)\s*0*(\d+)\b` → `NS{n:03d}`) e `_parse_dados_campo` (extrai `CT/CF`, `CT_ini/CF_ini/CT_fim/CF_fim`). Envio via Meta Graph API v19.0 (`https://graph.facebook.com/v19.0/{WA_PHONE_ID}/messages`), com fallback de log local quando `WA_TOKEN`/`WA_PHONE_ID` ausentes. Inclui endpoint `POST /webhook/simular` para teste sem WhatsApp real. Variáveis de ambiente: `WA_TOKEN`, `WA_PHONE_ID`, `WA_VERIFY_TOKEN`, `NUCLEO_DEFAULT`, `STATUS_NS_PATH`/`OUT_BASE`, `FOTOS_DIR`.

**C. `whatsapp-motor/index.js` — motor Node (whatsapp-web.js + Express + Supabase).** Conecta por QR Code (`LocalAuth`, `clientId: 'constru-wapp-v2'`), salvando o QR em `qr-code.png` (evita quebra no terminal Windows). Roda Express na porta **8090** com `/api/send` (disparo de mensagem, exige `isReady`), `/api/team` e `/api/logs` (CRUD em Supabase). Ignora grupos (`@g.us`). Possui um `parseRDO` próprio (independente do parser Python) que entende o template em blocos `NUCLEO/DATA/RT/TRECHO/SISTEMA/EXECUTADO/CLIMA/SERVICOS/EQUIPE/FINANCEIRO/OCORRENCIAS/OBS/FOTOS` (regex `HEADER_RE`), normaliza data BR→ISO, extrai DN (`DN\s*(\d{2,4})`), e parseia valores financeiros em formato BR (`2.409,84`). RDO completo (gatilho: linha `^RDO$` + `TRECHO:`) é enviado a `${CONSTRUDATA_API_URL}/api/rdo`. Há também um fluxo de "máscara 1-8" (produção/custo previsto×real) roteado para `${API_URL}/api/whatsapp/send`. Persiste tudo em Supabase (`logs_rdo`) e em uma caixa-preta Obsidian Markdown. Atualiza LPS (`workflow_status.json`) ao receber "OK"/"CIENTE". **Detalhe notável:** o motor Node grava fotos e arquivos em caminhos absolutos hardcoded (`C:\Users\felip\Downloads\construdatamaxv2-clean\...` e `C:\Users\felip\Downloads\COFREOBSIDIAN\...`), o que o acopla à máquina do desenvolvedor.

A foto recebida vira evidência preservada: salva no disco, vinculada ao RDO via `RDOFoto`/`RDOEvidencia` (com `hash_sha256` e `tamanho_bytes`), e — no fluxo Gemini — recebe legenda automática. Quando o serviço apontado exige evidência mas o RDO não tem foto/documento, `gerar_sinais_qualidade` cria um sinal de severidade **ALTA** `SEM_EVIDENCIA_MINIMA`.

### Análise de foto por IA (motor Gemini)

`motor_gemini.analisar_foto_para_rdo` (usado pelo bot A) chama o SDK novo `google-genai` (não o deprecated `google-generativeai`), modelo Gemini Flash por padrão, retornando `legenda_rdo`. Tem fallback determinístico: se a chave (`GEMINI_API_KEY`/`GOOGLE_API_KEY`) ou o SDK não estiverem disponíveis, gera legenda a partir do nome do arquivo (`Registro fotográfico de campo - {stem}`), preservando a robustez offline.

### Plataforma de Evolução 360

`campo/evolucao_platform.py` é a camada "tipo Palantir" sobre os dados operacionais (`resumo_evolucao`). Expõe **14 módulos** (Análise por ML, Decisão pós-ML, Predição, Replanejamento, RDO automático/digital, Planejamento semanal, Comparação planejado×realizado, Desvios automáticos, Relatório 360/BI, Medição rastreável, Qualidade e evidências, Fluxo financeiro projetado, Auditoria/memória operacional, XGBoost/fallback), cada um com `palantir_equivalente`, `explicacao`, `objetivo`, `memoria_calculo`, `status` e `score`. O **score** de cada módulo é classificado por `_score_status` (≥80 operacional; ≥55 em consolidação; ≥30 parcial; senão sem base) e o `score_geral` é a média.

**Predição de risco (`_predicao`):** janela de 30 dias; `risco = 15 + min(criticos×8, 45) + (15 se produção média 0 com RDOs) + min(qualidade_aberta×2, 20)`, limitado a 95. Tendência derivada (≥70 "risco alto"; ≥45 "atenção"; produção>0 "controle operacional"; senão "estável"). A `_ontologia` modela nós (`obra_nucleo`, `nota_servico`, `rdo`, `planejamento`, `desvio`, `ml_execucao`, `replanejamento`) e arestas do grafo (`planejamento → rdo → desvio → ml_execucao → replanejamento`, `rdo → medicao`, `rdo → qualidade`, `evidencia → auditoria`). `executar_ciclo_evolucao` roda `tentar_xgboost` (com fallback) e loga o evento em `subsystem="evolucao360"`.

`campo/ns_v5_web.py` complementa com `snapshot_ns_v5(project_id)`: consolida RDOs, NS, planejamentos, desvios, replanejamentos, logs, ML, custos, tarefas e LPS por núcleo do projeto, mais KPIs (`rdos_total`, `desvios_criticos`, `ppc_medio`, `custo_total`). Define `DATA_CONTRACTS` (contratos de dados estáveis para o frontend ConstruDataWeb) e `NS_V5_MODULES` (13 módulos com seus endpoints).

### Ciclo operacional e fluxo planejado×realizado

O `GUIA_CICLO_OPERACIONAL_360_20260427.md` formaliza o fluxo oficial: engenheiro envia planejamento semanal por texto → sistema cria `PlanejamentoSemanal` em RASCUNHO → diretor valida → plano vira ATIVO e marca concorrentes como SUBSTITUIDO → engenheiro envia RDO diário → sistema compara RDO × plano ATIVO da data → cria desvios automáticos → ML/fallback analisa → gera replanejamento RASCUNHO → diretor aplica → novo plano ATIVO.

**Geração de desvios (`gerar_desvios_rdo`, `api/operational.py`):** busca o `PlanejamentoSemanal` ATIVO do núcleo cuja janela (`semana_inicio ≤ data ≤ semana_fim`) cobre o RDO. Para cada `PlanejamentoItem`, casa o realizado por correspondência textual de atividade×serviço (`_realizado_do_item`; quando o plano tem 1 item ou o RDO tem 1 apontamento, usa o total). Cria `DesvioPlanejamento` com `item_id` e ação recomendada.

**Métricas/normas técnicas reais (`calcular_metricas_desvio`):**
- `desvio_percentual = (realizado − meta) / meta × 100`
- **SPI** (Schedule Performance Index) `= realizado / meta` (>1 adiantado)
- **CPI** (Cost Performance Index) `= custo_previsto / custo_real` (>1 abaixo do orçamento)
- **PPC** (Percent Plan Complete, Last Planner System) `= min(realizado/meta × 100, 100)`
- `desvio_custo = custo_real − custo_previsto`

**Classificação de severidade (`classificar_severidade`):** com base no pior entre |desvio%| e |desvio_custo%|: **>50% CRITICA**, **>30% ALTA**, **>15% MEDIA**, senão **BAIXA**.

**ML/fallback determinístico (`fallback_deterministico` / `tentar_xgboost`):** XGBoost é tentado por import; como o modelo ainda não está treinado, sempre cai no fallback (TODO explícito em `operational.py`, 357). O fallback pondera desvios (CRITICA=4, ALTA=3, MEDIA=2, BAIXA=1); `confianca = min(n_desvios/10, 1.0)`; grava `MLExecucao`; gera `Replanejamento` RASCUNHO se `score_total ≥ 6` ou houver sugestão CRITICA. `aplicar_replanejamento` cria novo `PlanejamentoSemanal` ATIVO ajustando metas para cobrir o déficit (`meta + |desvio_quantidade|` quando negativo), marca o anterior SUBSTITUIDO e registra `PlanejamentoValidacao`.

**Interface offline:** `ui_operational_cycle.py` é uma aba Tkinter (módulo `[14] Ciclo Operacional`) que consome o mesmo banco local — sem HTML — permitindo criar/validar plano, rodar ML e aprovar/aplicar/rejeitar replanejamento, com filtros por severidade (BAIXA/MEDIA/ALTA/CRITICA) e status de plano.

### Fluxo end-to-end: campo → WhatsApp → RDO → medição

```text
[Campo: encanador/apontador]
   │  (a) WhatsApp bot wizard (Python)         (b) WhatsApp Meta Cloud (receiver)    (c) Texto colado / upload doc / foto
   ▼                                            ▼                                     ▼
WhatsAppBot.process_message                 _processar_mensagem                   parse_texto_operacional /
 (state machine + Gemini legenda)            (menu 1-5, STATUS_NS.json)            DeterministicRDOExtractionProvider
   │                                            │                                     │
   ▼                                            ▼                                     ▼
RDOEngine.criar_rdo / adicionar_apontamento  motor_status_ns.transitar           RDOEngine.criar_rdo_completo /
 + adicionar_foto + adicionar_equipe          (PLANEJADO→EXECUTADO→…)              criar_rdo_automatico + RDOEvidencia/RDOExtracao
   │                                                                                  │
   └──────────────► RDO (banco) ◄────────────────────────────────────────────────────┘
                       │  fechar_rdo / finalizar_rdo
                       ▼
   gerar_desvios_rdo (PPC/SPI/CPI/severidade)  +  gerar_sinais_qualidade (evidência/FVS)
                       │
                       ▼
   gerar_fontes_medicao  ──►  RDOMedicaoFonte (status="pendente_conferencia", trecho/serviço/qtd/evidência)
                       │
                       ▼
   Evolução 360 / Relatório 360 / BI  ──►  decisão, predição de risco, replanejamento
```

Pontos-chave do encadeamento:
- A **medição** nasce do RDO finalizado: cada apontamento vira uma `RDOMedicaoFonte` rastreável (`origem="rdo"`, `status="pendente_conferencia"`), ligada à primeira evidência do RDO — reduzindo divergência entre campo, medição e financeiro (`rdo_integracoes.gerar_fontes_medicao`).
- O **apontamento** que cita uma NS atualiza a NS para `EM_EXECUCAO`, soma `custo_realizado` e marca itens de checklist concluídos (mapa `_CHECKLIST_POR_SERVICO`), o que permite a promoção automática a `CONCLUIDA` no fechamento.
- A **curva S** é recalculada a cada fechamento (`atualizar_curva_s` → `core.database.curva_s_dados`), retornando `{data, ext_acum_m, pct_fisico}`.
- Toda ação relevante é auditada em `OperationalLog` (`log_operational_event`), e o RDO suporta **soft-delete** (`deleted_at`), preservando memória operacional.

### Dependências (libs)

- **Python:** `fastapi`, `uvicorn`, `httpx` (receiver/Meta API), `sqlalchemy` (ORM e sessão `core.database`), `reportlab` (PDF, opcional — degrada para `""` se ausente), `xgboost` (opcional, cai no fallback), `google-genai` (legenda de foto, opcional), `evolutionapi` (opcional), `tkinter` (aba offline).
- **Node (`whatsapp-motor`):** `whatsapp-web.js`, `qrcode-terminal` + `qrcode` (PNG), `express`, `cors`, `@supabase/supabase-js`, `dotenv`, `puppeteer` (headless, `--no-sandbox`).
- **Internas:** `core.database`, `core.models`, `core.config` (`BDI_PADRAO`, `CONTRATO_PADRAO`, `FOTOS_DIR`), `core.construdata_offline`, `motor_status_ns`, `motor_gemini`.

### Detalhes notáveis, validações e tolerâncias

- **`DEFAULT_ORGANIZATION_ID`** fixo `4234fff0-3d87-4967-bddd-a86fb2c237d3` e `CONTRATO_PADRAO` (SABESP SLNR Santos, **contrato 11481051**) impressos no rodapé do PDF.
- **Idempotência do RDO:** unicidade lógica por `data + nucleo + organization_id` (com `or_` para `organization_id` nulo), evitando RDOs duplicados do dia.
- **Confiança da extração automática:** texto parseado recebe confiança 0.82; data por filename 0.55, por metadado 0.30; campos de metadado 0.90. Pendências geradas quando confiança < 0.5.
- **Sinais de qualidade:** tokens que exigem foto (`assentamento`, `recomposicao`, `pv`, `pi`, `teste`, `escavacao`) e que exigem FVS/checklist (`teste`, `estanqueidade`, `recomposicao`, `assentamento`) determinam severidade ALTA (`SEM_EVIDENCIA_MINIMA`) ou MEDIA (`FVS_PENDENTE_CONFERENCIA`).
- **Estados válidos do `STATUS_NS.json`** (`motor_status_ns`): `PLANEJADO → EXECUTADO → CADASTRADO → MEDIDO | BLOQUEADO`, com transições restritas em `_TRANSICOES` (ex.: `MEDIDO` só pode ir para `BLOQUEADO`).
- **Limite de mensagem WhatsApp:** texto truncado a 4096 caracteres no envio Meta (`whatsapp_receiver._send_whatsapp`).
- **Normalização de números BR:** todos os parsers tratam vírgula decimal e separador de milhar (`_float` em `texto_operacional.py`, `_parseFinanceiro` no motor Node).
- **Reconhecimento de obra por texto** (`_nucleo_do_texto`): "cesario"→`CESARIO_LANGE`, "porangaba"→`PORANGABA`, "sao roque"→`SAO_ROQUE`, "teteu"/"subempreita"→`RK_SUB` (alinhado com os modelos `.md`).
- **Acoplamento de máquina (risco/débito técnico):** o motor Node usa paths absolutos hardcoded à máquina do desenvolvedor e mistura destino de fotos do frontend `construdatamaxv2-clean`, divergente do `FOTOS_DIR` do backend Python.
- **Duplicidade de parsers:** existem dois parsers de RDO independentes (Python `parse_texto_operacional` e JS `parseRDO`) e duas integrações WhatsApp paralelas (Evolution/bot vs Meta Cloud/receiver vs whatsapp-web.js), sem fonte única — ponto de atenção para consolidação.
- **Migração Supabase (`sql_rdos_whatsapp.sql`):** habilita `INSERT`/`SELECT` para o papel `anon` (RLS `WITH CHECK (true)`) — permissivo, adequado a protótipo, mas inseguro para produção. Cadastra 4 projetos com UUIDs fixos e telefones de responsáveis.

---

## Cadastro Tecnico e Topografia

Subsistema responsável por transformar levantamentos topográficos de campo (as-built) e dados de projeto em **cadastro técnico digital georreferenciado** no padrão **NTS 292 / NTS 0292 da SABESP**, gerando DXF georreferenciados, folhas A4 de cadastro (DXF + PDF), perfis longitudinais, planilhas de divergência projeto-versus-campo e pacotes GeoJSON/JSON serializáveis. O subsistema cobre desde a leitura crua do levantamento do topógrafo (CSV ASCII e Leica GSI) até a folha de cadastro plotável com carimbo SABESP.

### Propósito e visão geral

O subsistema integra cinco capacidades:

1. **Leitura de levantamento de campo** (CSV/TXT e Leica GSI 8/16) e classificação de pontos por código.
2. **Georreferenciamento de poligonal livre** (frame local → UTM) por casamento rígido com RANSAC contra os PVs do projeto.
3. **Compilação de campo**: substituição das coordenadas/cotas de projeto pelos valores reais e geração de divergências.
4. **Cartografia de fundo** (DXF/DWG/GPKG) com filtragem de camadas por palavra-chave.
5. **Emissão de cadastro NTS 292**: DXF consolidado (planta + perfil + carimbo + malha UTM), folhas A4 (DXF/PDF) e metadados JSON.

A norma de referência citada explicitamente no código é a **NTS 292 Rev.3 (2017)** (e a variante **NTS 0292 Ver 4** em `folha_a4.py`), o carimbo segue a **NTS 116**, e o datum/projeção é **SIRGAS 2000 / UTM Zona 23S (EPSG:31983)**, com datum vertical **Imbituba-SC**. O contrato referenciado nos defaults é o **11481051 — SLNR Santos / "SE LIGA NA REDE" — FCN Construções e Saneamento**.

### Tabela de arquivos

| Arquivo | Responsabilidade | Principais funções/classes |
|---|---|---|
| `cadastro/__init__.py` | Docstring do pacote ("Modulo de cadastro tecnico NTS 292") | — |
| `cadastro/as_built.py` | Monta pacote as-built a partir do banco da plataforma; enriquece PVs com signos e cotas reais | `construir_as_built(ns_id)`, `consolidar_as_built(nucleo)` |
| `cadastro/base_topografica.py` | Leitura opcional de base topográfica DXF/GPKG (lotes, quadras, logradouros, curvas de nível) | `extrair_base_topografica(dxf_path, gpkg_path)`, `json_like_records(gdf)`; const. `LAYERS_BASE_TOPO` |
| `cadastro/nts292.py` | Helpers operacionais NTS 292: validação de metadados obrigatórios e montagem do pacote serializável | `validar_metadados_nts292(metadados)`, `pacote_cadastro_nts292(nucleo, metadados)`; const. `METADADOS_OBRIGATORIOS` |
| `cadastro/poligonal.py` | Georreferenciamento de poligonal livre (frame local→UTM) via RANSAC sobre pares de PVs | `georreferenciar(topo_pts, pvs_projeto, tol_dist, tol_match)`, `_transf_de_par`, `_aplicar`, `_eh_local` |
| `cadastro/ler_topo.py` | Leitor de levantamento de campo (CSV ASCII e Leica GSI 8/16); classifica pontos por código | `ler_topo(path)`, `_ler_csv`, `_ler_gsi`, `_gsi_word`, `_classifica`; mapas `_CODIGO_TIPO`, `_MARCADORES_POLIGONAL` |
| `cadastro/compilar_campo.py` | Casa pontos do topógrafo com PVs/trechos do projeto; substitui CT/CF reais e gera divergências | `compilar_campo(pvs, trechos, topo_pts, raio_match)`, `_dist` |
| `cadastro/ler_cartografia.py` | Extrai polilinhas de fundo (ruas/quadras/lotes) de DWG/DXF/GPKG para cartografia | `ler_cartografia(path)`, `_ler_dxf`, `_ler_gpkg`, `_quer_layer`; const. `KEEP`, `SKIP` |
| `cadastro/signos.py` | Simbologia SIGNOS SABESP (Tabela 4 NTS 292) para elementos da rede | `simbolo_por_elemento(tipo, is_agua)`; dict `SIGNOS_SABESP` |
| `cadastro/folha_a4.py` | Geração da folha A4 padrão SABESP NTS 0292 (DXF e PDF) com carimbo, rede, anotações, cartografia e detalhes ampliados | `generate_dxf`, `generate_pdf`, `generate_batch`, `draw_carimbo`, `draw_trecho`, `draw_cartografia_dxf`, `draw_detalhes_dxf`, `draw_detalhes_pdf`, `setup_layers`, `calc_inclinacao`, `format_coord`, `format_cota` |
| `api/routes_cadastro.py` | Rota REST FastAPI que expõe o GeoJSON da rede | `api_cadastro_geojson(nucleo)` → `GET /api/cadastro/geojson` |
| `gerar_cadastro_nts292.py` | Orquestrador: gera o DXF consolidado NTS 292 (planta+perfil+carimbo+malha), XLSX de divergências, JSON de metadados e dispara as folhas A4 | `gerar_cadastro_nts292(...)`, `_setup_doc`, `_draw_pv_symbol`, `_draw_tubo`, `_draw_perfil`, `_draw_carimbo_sabesp`, `_draw_coord_grid`, `_gerar_divergencias_xlsx`, `_ensure_layer`; const. `LAYERS`, `ESCALA_H`, `ESCALA_V` |

### Entradas e saídas (formatos)

**Entradas:**
- **Levantamento de campo** (`ler_topo.py`): CSV/TXT ASCII no formato `id,N,E,Z,codigo,descricao` (aceita também `;` como separador, encoding `latin-1`); e **Leica GSI 8/16** (`.gsi`), com palavras WI `*11`=ponto, `*81`=E, `*82`=N, `*83`=Z, `*41/42`=código/subcódigo, `*71`=código alternativo.
- **Cartografia de fundo** (`ler_cartografia.py`): **DXF**, **DWG** (convertido via conversor ODA `_converter_dwg_dxf_oda` do `ler_dwg_universal`) e **GPKG** (GeoPackage de export QGIS, camadas `lines`/`polylines`/`hatches` via `pyogrio`).
- **Base topográfica** (`base_topografica.py`): **DXF** (via `ezdxf`) e **GPKG** (via `geopandas`).
- **Projeto**: dicts `pvs` (`{nome: {x,y,ct,cf,prof,...}}`) e `trechos` (`[{pv_ini, pv_fim, dn_mm, ext_m, decl_mm, material, tipo}]`), e opcionalmente `status_ns` (do `motor_status_ns`, com `campo_real` e `status_historico`).
- **Banco da plataforma** (SQLAlchemy via `core.database`): `detalhe_ns`, `listar_ns`, `geojson_rede`.

**Saídas:**
- **DXF** georreferenciado consolidado (`CADASTRO_ASBUILT_<NUCLEO>.dxf`, R2010, `$INSUNITS=6` metros).
- **DXF + PDF** de folha A4 SABESP (par por trecho), via `generate_batch`. PDF gerado com `reportlab` em `landscape(A4)`.
- **XLSX** de divergências (`DIVERGENCIAS_NTS292_<NUCLEO>.xlsx`, via `openpyxl`) com abas "Divergencias" e "Resumo".
- **JSON** de metadados (`META_<NUCLEO>.json`) com norma, datum, escalas, contagem de PVs/trechos, extensão e requisitos de entrega.
- **GeoJSON** (`FeatureCollection` de `LineString`/`Point`) via `geojson_rede` (rota REST e pacote NTS 292).
- **Pacotes JSON serializáveis** (`pacote_cadastro_nts292`, `consolidar_as_built`, `construir_as_built`).

### Fluxo: levantamento topográfico → cadastro técnico → folha

1. **Leitura do levantamento** (`ler_topo`): o arquivo é detectado por extensão `.gsi` ou por *sniffing* do conteúdo (linha iniciando com `*` e contendo `+0000`/`-0000` indica GSI). Cada ponto vira `{id, n, e, z, codigo, desc, tipo}`. O `tipo` é classificado por `_classifica` usando o mapa `_CODIGO_TIPO` (ver normas abaixo) ou heurística por palavras-chave na descrição. No GSI as distâncias vêm em milímetros e são escaladas por `1e-3`; o código (WI 41/42) costuma vir em **linha separada** antes da linha de coordenadas, então é mantido um "código pendente" entre linhas.

2. **Georreferenciamento** (`poligonal.georreferenciar`): se o levantamento estiver em frame local (heurística `_eh_local`: coordenadas absolutas < 100.000), é feito um casamento rígido (rotação + translação, **escala fixa = 1**) por força bruta/RANSAC. Para cada par de PVs do topo cuja distância casa com um par de PVs do projeto (dentro de `tol_dist=1.5 m`), gera-se a transformação `_transf_de_par` e contam-se inliers (PVs do topo que caem a menos de `tol_match=5.0 m` de algum PV do projeto, com consumo único por PV). A transformação com mais inliers vence; exige no mínimo 2 inliers. Pares de projeto só são considerados se `5 m < distância < 300 m`; pares de topo com distância `< 5 m` são ignorados. Ambas as orientações do par (A→a,B→b e A→b,B→a) são testadas.

3. **Compilação de campo** (`compilar_campo`): para cada PV do projeto, busca o PV de campo mais próximo dentro de `raio_match=8.0 m`. Substitui `x/y` pelas coordenadas de campo (`e/n`), `ct` pela cota `z` do PV de campo, e `cf` pela cota `z` da **geratriz** (fundo de tubo) mais próxima dentro do mesmo raio. Recalcula `prof = round(ct - cf, 3)` e marca `fonte="CAMPO"`. Gera divergências CT/CF quando `|diferença| > 0,05 m` (5 cm). As extensões dos trechos são recalculadas com as coordenadas novas (`ext_m`).

4. **Geração do cadastro NTS 292** (`gerar_cadastro_nts292`): monta o documento DXF com `_setup_doc` (layers padronizados, estilos Arial/Arial Narrow), desenha:
   - **Malha de coordenadas UTM** (`_draw_coord_grid`) com passo `step=50 m` (rótulos `E .../N ...`).
   - **Cartografia de fundo** filtrada para a área da rede (camada `CARTOGRAFIA_FUNDO`).
   - **Tubulações** (`_draw_tubo`) com texto `DN<dn> <material> i=<decl·1000>‰ L=<ext>m`, rotacionado para acompanhar o tubo.
   - **PVs** (`_draw_pv_symbol`): círculo (raio 0,5 m PV / 0,3 m PI), cruz interna, linha de chamada e bloco de texto (nome, CT, CF, Prof). PV cujo nome começa com `PI`/`P.I.` é tratado como PI. Quando há dados de campo, usa layer **CAMPO_REAL** (ACI 1, vermelho); só projeto usa **PROJETO** (ACI 8, cinza).
   - **Perfil longitudinal** (`_draw_perfil`) abaixo da planta, com escalas H 1:500 / V 1:100 (fatores `fx=1000/500`, `fy=1000/100` mm por metro), grade de cotas, linhas verticais nos PVs, linha de terreno (tracejada) e do tubo (contínua), além de tabela "PV / Cota Tampão / Cota Fundo / Prof. / Distância" (limitado a `trechos[:50]`).
   - **Carimbo SABESP** (`_draw_carimbo_sabesp`, NTS 116) e **norte magnético**.
   - Se houver campo real, uma **legenda AS-BUILT** com data/responsável e a convenção de cores.

5. **Segunda passada — REAL COMPILADO**: se `topo_path` for fornecido, a primeira passada gera o cadastro "fictício" (projeto) e dispara uma segunda chamada recursiva que lê o topo (`ler_topo`), compila (`compilar_campo`) e grava em subpasta `REAL_COMPILADO_<NUCLEO>/`, com sufixo `_REAL` no núcleo.

6. **Folhas A4** (`folha_a4.generate_batch`): cada **trecho** (par PV_ini→PV_fim) vira **uma folha**. Cada folha gera DXF e PDF com carimbo, rede em vermelho, anotações de PV (N/E/CT/CF/nome) com posicionamento anti-sobreposição, cartografia de fundo recortada e **detalhes ampliados** (insets) para trechos curtos (< 15 m).

### Fórmulas, normas e padrões técnicos reais no código

- **Norma de cadastro**: NTS 292 Rev.3 (2017) / NTS 0292 Ver 4 (SABESP); carimbo conforme **NTS 116**; layers da folha A4 referenciados como **Tabela C1** e simbologia **SIGNOS (Tabela 4 NTS 292)**.
- **Datum/Projeção**: SIRGAS 2000, UTM Zona 23S, **EPSG:31983**; datum vertical **Imbituba-SC**; carimbo registra "Datum horiz. Sirgas2000" e "UTM Fuso 23m". `nts292.pacote_cadastro_nts292` define defaults `datum="SIRGAS 2000"` e `projecao="UTM 23S / EPSG:31983"`.
- **Inclinação/declividade** (`folha_a4.calc_inclinacao`): `i = |CF2 − CF1| / comprimento` (somente se `comp > 0`), impressa com 4 casas. No DXF consolidado a declividade aparece como `i=<decl·1000>‰` (per mil) em `_draw_tubo`.
- **Escalas**: planta/perfil horizontal **1:500** (`ESCALA_H=500`), perfil vertical **1:100** (`ESCALA_V=100`).
- **Tolerância de divergência projeto×campo**: divergência registrada se `|Δ| > 0,05 m` (5 cm); marcada como "DIVERGÊNCIA SIGNIFICATIVA" no XLSX se `|Δ| > 0,10 m` (10 cm), senão "Dentro da tolerância".
- **Mapa de códigos do topógrafo** (`ler_topo._CODIGO_TIPO`), descoberto cruzando o `LEV.txt` de São Manoel com o GSI de Pantanal Baixo (o WI 41 do GSI carrega o mesmo número da coluna código do LEV.txt):

| Código | Tipo | Significado |
|---|---|---|
| `86` | PV | PVE — poço de visita esgoto |
| `48` | GERATRIZ | geratriz inferior (fundo do tubo) |
| `49` | GERATRIZ | geratriz superior |
| `91` | RAMAL | registro de água |
| `37`, `38`, `79`, `80` | CART | divisa de terreno, pavimento/calçada, poste, poste de ferro |

  Marcadores de poligonal (WI 41 alfa): `OCUPAR`, `RE`, `V`, `VANTE` (tipo `POLIGONAL`).

- **SIGNOS SABESP** (`signos.SIGNOS_SABESP`): `PV_ESG` (círculo cheio), `PV_AGUA` (círculo vazio), `TI` — terminal de inspeção (triângulo), `RG` — registro (retângulo), `VRP` — válvula redutora de pressão (losango), `HI` — hidrante (hexágono). `simbolo_por_elemento` mapeia tipos iniciados em `TI`/`RG` e por padrão retorna PV de esgoto ou água conforme `is_agua`.
- **Layers do DXF consolidado** (`gerar_cadastro_nts292.LAYERS`): definidos por cor ACI e lineweight — ex.: `REDE_ESGOTO` (verde 3), `REDE_AGUA` (azul 5), `PERFIL_TERRENO` (DASHED), `CARIMBO`, `COORD_GRID`, `RAMAL`, etc., somados a `CAMPO_REAL` (ACI 1) e `PROJETO` (ACI 8).
- **Layers da folha A4** (`folha_a4.setup_layers`, Tabela C1): cores ACI dedicadas — `Rede executada`/`Pecas executadas` em vermelho (ACI 1), `Quadra` (ACI 250), `Amarracao` (ACI 251), `Margem externa` (ACI 252), `Rede remanejada` (ACI 160), `Grade` (ACI 254, `plot=0`). Linetypes customizados: `DASHED` (`[1.0,0.5,-0.25]`), `HIDDEN2` (`[0.5,0.25,-0.125]`), `DASHDOT2`. Texto do tubo formatado como `O/<diametro>/<material>/<met_construtivo>` (ex.: `O/200/PVC/VCA`).
- **Metadados obrigatórios NTS 292** (`nts292.METADADOS_OBRIGATORIOS`): `data_levantamento`, `responsavel_tecnico`, `crea`, `datum`, `rn`. `validar_metadados_nts292` retorna `{ok, faltantes}`.
- **Folha A4**: formato ABNT-ISO A4 = 297×210 mm, margem 7 mm, carimbo 32 mm de altura em 4 faixas de 8 mm; área de desenho ~162 mm.
- **Requisitos de entrega** (META JSON): `dwg_georref=True` e pendências explícitas — `pdf_assinado` (assinar digitalmente), `art_cau` (emitir ART), `ctb_plotstyle` (gerar `.ctb`), `signos_lancamento` (via VisualBIM/1DOC).

### Detalhes notáveis, validações e tolerâncias

- **Bug de snap corrigido (contexto do projeto)**: conforme `CLAUDE.md`, havia importação indevida de topografia inteira com tolerância de snap de 20 m que "inventava" tubos; a tolerância foi reduzida para 3 m e a leitura travada a camadas de rede. Em consonância, `ler_cartografia.py` separa explicitamente camadas: `KEEP` (RUA, QUADRA, LOTE, MEIO, CALC/CALÇ, CONTORNO, LIMITE, DIVISA, EDIF, CASA, PAVIMENT, VIA, MURO) e `SKIP` (TUBO, REDE, ESGOTO, AGUA/ÁGUA, PV_, POCO/POÇO) — cartografia NÃO importa camadas de rede.
- **Filtro de lixo de georreferência**: polilinhas com bounding box `> 5000 m` em E ou N são descartadas (`ler_cartografia._ler_dxf` e `_ler_gpkg`).
- **Tolerâncias de casamento** (resumo): `tol_dist=1,5 m` (casa distâncias entre pares na poligonal), `tol_match=5,0 m` (conta inliers), `raio_match=8,0 m` (casa PV de campo com PV de projeto na compilação), `DIST_MAX=50 m` na folha A4 (não conecta pontos distantes na rede), detalhe ampliado para trechos `< 15 m`.
- **Resiliência a dependências opcionais**: `base_topografica.extrair_base_topografica` devolve estrutura vazia mas consistente se `geopandas`/`ezdxf` não estiverem disponíveis; `ler_cartografia._ler_gpkg` falha graciosamente se `pyogrio` não estiver instalado; `_gerar_divergencias_xlsx` retorna `""` sem `openpyxl`; o PDF importa `reportlab` apenas dentro de `generate_pdf`/`draw_detalhes_pdf`.
- **Posicionamento anti-sobreposição das anotações** (`folha_a4.draw_trecho` e `generate_pdf`): 8 direções radiais (NE, N, NW, E, W, SE, S, SW), pontuação que penaliza proximidade a outros pontos e overlap com zonas já ocupadas (`-200` no DXF, `-m(50)` no PDF), bônus para anotação acima (`+5`), e tentativa em múltiplas distâncias (`base`, `×1.5`, `×2.0`). Distância base ajustada por `annot_dist_base = max(12, min(30, min_pt_dist·0.8))`.
- **Convenção de cor as-built**: dados de campo reais em **vermelho** (CAMPO_REAL/Rede executada/Pecas executadas, ACI 1); projeto em **cinza** (PROJETO, ACI 8). A legenda AS-BUILT explicita essa convenção no DXF.
- **GeoJSON** (`geojson_rede` em `core/database.py`): `FeatureCollection` com `LineString` para trechos (propriedades `feature_type=trecho`, `ns_id`, `codigo` `NS_<seq>`, `nucleo`, `pv_ini/pv_fim`, `ext_m`, `dn_mm`, `material`, `status`) e `Point` para PVs (`feature_type=pv`, `nome`, `tipo`, `ct`, `cf`, `prof`, `is_agua`). As coordenadas saem nas unidades armazenadas (x/y em UTM/EPSG:31983); o GeoJSON não embute `crs` explícito.
- **API REST**: `routes_cadastro.py` registra um único endpoint, `GET /api/cadastro/geojson?nucleo=<str>`, montado em `api/server.py`. As demais saídas (DXF/PDF/XLSX/JSON) são geradas por scripts/orquestradores em disco, não por rota HTTP.
- **As-built do banco** (`as_built.py`): `construir_as_built` carrega `detalhe_ns`, atribui `signo` a cada PV via `simbolo_por_elemento(tipo, is_agua)` e empacota o bloco `as_built` com cotas reais (`ct_ini_real`, `cf_ini_real`, `ct_fim_real`, `cf_fim_real`), `cadastro_ok` e `fotos`. `consolidar_as_built` itera todas as NS de um núcleo retornando `{items, n_total}`.
- **Detalhes ampliados (insets)**: `draw_detalhes_dxf`/`draw_detalhes_pdf` renderizam caixas "DETALHE" de 65×28 mm (gap 5 mm) lado a lado no rodapé da área de desenho, uma por par de pontos consecutivos com distância `< 15 m`, mostrando N/E/CT/CF, profundidades, comprimento, inclinação (`i:`) e o texto do tubo.

Caminhos relevantes (relativos à raiz): `cadastro/as_built.py`, `cadastro/base_topografica.py`, `cadastro/nts292.py`, `cadastro/poligonal.py`, `cadastro/ler_topo.py`, `cadastro/ler_cartografia.py`, `cadastro/folha_a4.py`, `cadastro/signos.py`, `cadastro/compilar_campo.py`, `api/routes_cadastro.py`, `gerar_cadastro_nts292.py`, e dependência de banco em `core/database.py` (`geojson_rede`, `detalhe_ns`, `listar_ns`).

**Dependências (libs):** `ezdxf` (DXF, com `ezdxf.enums.TextEntityAlignment`), `reportlab` (PDF A4 landscape), `openpyxl` (XLSX de divergências), `pyogrio` (GPKG/cartografia), `geopandas` (base topográfica GPKG), `fastapi` (rota REST), `sqlalchemy` (acesso a banco em `core.database`), e módulos do próprio projeto (`ler_dwg_universal._converter_dwg_dxf_oda` para conversão DWG→DXF via ODA, `motor_status_ns` para dados de campo reais). Bibliotecas-padrão: `math`, `json`, `os`, `pathlib`, `datetime`, `collections`.

---

## Analytics Operacional, BI e Financeiro

Este subsistema cobre quatro frentes correlacionadas da plataforma NOVA NS Versão 5: (1) o **Analytics operacional/BI** por responsável (pacote `analytics_operacional/`), que treina modelos XGBoost a partir dos RDOs já importados e gera dashboards em PDF/XLSX/JSON; (2) o **enriquecimento de RDO textual** ("Icaro"), que estrutura textos livres de campo em produção quantificável; (3) o **controle de fluxo financeiro** projetado por texto (`financeiro/`); e (4) a família **ConstruData** (pacote `construdata/`, scripts `construdata_pipeline.py`, `construdata_planner.py`, `construdata_integrador.py`, `construdata_analytics.py`), que liga a geração das Notas de Serviço ao planejamento, à medição GeoPackage e a um motor de Analytics ML independente (XGBoost + GridSearchCV). As rotas FastAPI `api/routes_bi_analytics.py`, `api/routes_evolucao.py` e `api/routes_construdata_offline.py` expõem esses motores via HTTP.

### Visão geral dos arquivos

| Arquivo | Responsabilidade | Principais funções/classes |
| --- | --- | --- |
| `analytics_operacional/xgboost_responsaveis.py` | Treina XGBoost por responsável (ICARO, IGOR) a partir dos RDOs no banco; persiste `MLExecucao`; gera JSON/MD/PDF | `rodar_xgboost_responsaveis`, `_dataset`, `_treinar`, `_text_metros`, `_dn_media`, `_score`, `_gerar_markdown`, `_gerar_pdf` |
| `analytics_operacional/bi_dashboard.py` | Consolida resultados XGBoost em payload de BI; exporta Excel (com gráficos) e PDF executivo | `montar_bi_payload`, `exportar_bi_excel`, `exportar_bi_pdf`, `_series`, `_serie_agregada`, `_risco`, `_resumo_executivo` |
| `analytics_operacional/icaro_rdo_enrichment.py` | Estrutura RDO textual do Icaro em apontamentos (metros, tubos, etapas de caixa) gravados no banco | `enriquecer_rdos_icaro`, `extrair_producao_icaro`, `_meters`, `_tubos`, `_caixa_etapas`, `_has_block` |
| `analytics_operacional/__init__.py` | Docstring do pacote | — |
| `financeiro/controle_fluxo_texto.py` | Parser "Preencher com Texto" para controle de obra e fluxo de caixa projetado por núcleo | `aplicar_texto_controle_fluxo`, `parse_texto_controle_fluxo`, `fluxo_projetado`, `_lancamentos`, `_tarefas`, `_linhas_secao`, `_valor_linha` |
| `financeiro/__init__.py` | Docstring do pacote | — |
| `construdata/__init__.py` | Fachada do pacote modular "ConstruData SABESP v5.1.0" (re-exporta domínio e DB) | reexporta `PV`, `Trecho`, `Rede`, `TipoPV`, `MaterialTubo`, `StatusHidraulico`, `BancoDeDados` |
| `construdata/models/models.py`, `construdata/models/__init__.py` | Shim: re-exporta classes de domínio do `models.py` raiz via `sys.path.insert` | reexporta `PV`, `Trecho`, `Rede`, etc. |
| `construdata/database.py` | Shim: re-exporta `BancoDeDados` do `database.py` raiz | reexporta `BancoDeDados` |
| `construdata/core/`, `construdata/io/`, `construdata/utils/` | Diretórios de camadas previstos pela arquitetura, atualmente **vazios** (sem `.py`) | — |
| `construdata_pipeline.py` | Pipeline end-to-end DXF/DWG/LandXML → pacote NS + XLSX + Civil 3D + NTS 292 + IFC LOD 500 + MS Project | `run_pipeline`, `_gerar_pacote_ns_completo`, `_gerar_xlsx_automaticos`, `_normalize_microplan_for_xlsx` |
| `construdata_planner.py` | Lê GeoPackage de status, cruza com planilha mestre, calcula saldo, gera lista de compras + Excel + dashboard HTML | `ler_gpkg`, `corrigir_crs`, `normalizar_status`, `analisar_redes`, `exportar_excel`, `gerar_dashboard`, `CONFIG`, `CATALOGO_FORNECEDORES` |
| `construdata_integrador.py` | Ponte NS↔Planejador: importa/atualiza status de executados em GeoPackage e chama o Planejador | `modo_importar_geo`, `modo_selecionar_executados`, `modo_atualizar_via_tabela`, `salvar_gpkg_atualizado`, `executar_planejador`, `_corrigir_crs`, `_normalizar_status_series` |
| `construdata_analytics.py` | Motor de Analytics ML autônomo (XGBoost real + GridSearchCV) sobre `EXECUCAO_DIARIA.json` | `carregar_dados`, `preparar_features`, `treinar_modelo`, `gerar_cenarios`, `gerar_xlsx`, `gerar_dashboard`, `main` |
| `ANALYTICS_COMPLETO.py` | Driver CLI que chama `construdata_analytics.main()` e abre a saída no Explorer | script `__main__` |
| `api/routes_bi_analytics.py` | Rotas FastAPI do BI operacional | `api_bi_analytics`, `api_bi_analytics_recalcular`, `api_bi_analytics_pdf`, `api_bi_analytics_excel` |
| `api/routes_evolucao.py` | Rotas FastAPI "Evolução 360" (consolidação estilo Palantir) | `api_evolucao_resumo`, `api_evolucao_predicao`, `api_evolucao_ontologia`, `api_evolucao_executar_ciclo` |
| `api/routes_construdata_offline.py` | CRUD genérico de projeto/entidades do ConstruData offline (custos, tarefas, agenda, LPS) | `api_offline_*` |

### Modelo XGBoost por responsável (`xgboost_responsaveis.py`)

**Propósito.** Para cada responsável de obra (`RESPONSAVEIS`: `ICARO` = núcleos `CESARIO_LANGE`, `PORANGABA`, `SAO_ROQUE`; `IGOR` = `RK_SUB`), o módulo monta uma série temporal diária a partir dos RDOs já persistidos e treina um `XGBRegressor` para prever a produção equivalente do dia seguinte.

**Entrada:** banco operacional via `core.database.get_session()` e ORM `core.models` (`RDO`, `RDOApontamento`, `MLExecucao`, com `selectinload` de `apontamentos`, `equipe`, `ocorrencias`). **Saída:** `RELATORIO_XGBOOST_ICARO_IGOR_20260426.json`, `GUIA_FLUXO_OPERACIONAL_XGBOOST_20260426.md` (com diagrama Mermaid do fluxo) e o PDF homônimo; além de uma linha `MLExecucao` (`tipo="xgboost_producao"`, `resultado_json`, `confianca`) gravada por responsável.

**Engenharia de features (`_dataset`).** Agrega RDOs por dia. A produção é separada em três dimensões e somada em um equivalente:
- `producao_m` (apontamentos com unidade `m`/`metro`/`metros`) ou, na ausência, `producao_texto_m` extraída por regex do texto;
- `producao_un` (`un`/`und`/`unid`);
- `producao_etapa` (`etapa`/`atividade`);
- `producao_equiv = producao_m + producao_un + producao_etapa`.

Extração textual: `_text_metros` usa o regex `(?<!dn)\b(\d+(?:[,.]\d+)?)\s*m\b(?!m)` com janela de contexto de ±16 caracteres, descartando casos de dimensão (`" x "`, `"dimens"`) e limitando a `0 < val < 1000`. `_dn_media` extrai diâmetros via `\bdn\s*(\d{2,4})`. `_score` conta termos de bloqueio (`BLOQUEIOS`: "nao teve", "falta", "paralis", "chuva", "aguard", "documentacao", "seguranca", etc.) e de atividade (`ATIVIDADE`: "assentamento", "escavacao", "reaterro", "caixa", "pv", "ramal", "ligacao", etc.).

`FEATURES` (12): `rdo_count`, `equipe_qtd`, `custo_total`, `bloqueio_score`, `atividade_score`, `dn_media`, `dia_semana`, `dia_mes`, `mes`, `prev1` (lag 1), `rolling3`, `rolling7` (médias móveis 3 e 7 dias, deslocadas com `.shift(1)` para evitar vazamento).

**Treino (`_treinar`).** Hiperparâmetros fixos do `XGBRegressor`: `n_estimators=160`, `max_depth=3`, `learning_rate=0.06`, `subsample=0.9`, `colsample_bytree=0.9`, `objective="reg:squarederror"`, `random_state=42`. Split temporal 75% (`split = max(1, int(n*0.75))`). Para `n < 8` ou alvo constante (`y.nunique() <= 1`), há **fallback** para média móvel (`media_movel_sem_amostras_suficientes`) com confiança reduzida (fator 0,4/0,6). Métricas reportadas: MAE (`np.mean(np.abs(...))`), R² calculado manualmente `1 - SS_res/SS_tot` (somente se `len(yt)>1` e variância positiva), `previsao_proximo_dia`, `previsao_7_dias = pred*7` e importâncias (top 8). A **confiança** é uma composição empírica:

`confianca = min(0.95, max(0.15, min(n/45,1)*0.65 + (1 - min(mae/(mean+1e-6),1))*0.25 + variabilidade*0.1))`

onde `variabilidade = min(std/(mean+1e-6), 1)` (coeficiente de variação truncado). O nível de risco (`_risco` em `bi_dashboard.py`) deriva da confiança: ALTO se `conf < 0.5` ou `r2 < 0`; MÉDIO se `conf < 0.75`; senão BAIXO.

### BI operacional (`bi_dashboard.py`)

`montar_bi_payload(recalcular)` lê o JSON do XGBoost (ou recalcula) e monta cards consolidados (`rdos`, `total_m`, `total_un`, `total_etapa`, `total_equiv`, `previsao_7_dias`, `responsaveis`), um `comparativo` por responsável (com previsões, MAE, R², risco e importâncias), `series` diárias por responsável, `resumo_executivo` e `acoes_operacionais` (rotina engenheiro→"Preencher com Texto"→XGBoost→gestão). `_serie_agregada` produz a matriz Data×Responsável×Total para a curva de tendência.

**Saídas.** `exportar_bi_excel` gera `BI_ANALYTICS_OPERACIONAL_20260426.xlsx` com abas Dashboard, Comparativo, Série Diária e Série BI, estilização institucional (cor `#123A75`, `freeze_panes`, bordas, larguras automáticas), um `BarChart` (produção equivalente por responsável) e um `LineChart` (tendência diária) via `openpyxl.chart`. `exportar_bi_pdf` gera `BI_ANALYTICS_OPERACIONAL_20260426.pdf` em A4 paisagem via ReportLab (resumo executivo, cards, comparativo, leitura dos modelos com top-5 features, série diária recente — últimas 28 linhas). `_fmt` aplica formatação numérica pt-BR (milhar com ponto, decimal com vírgula).

**Dependências:** `openpyxl` (Workbook, charts, styles), `reportlab` (platypus/styles/units), e indiretamente `pandas`, `numpy`, `xgboost`, `sqlalchemy` via `xgboost_responsaveis`.

### Enriquecimento de RDO textual — "Icaro" (`icaro_rdo_enrichment.py`)

**Propósito.** Os RDOs do responsável Icaro chegam como texto livre (núcleos `CESARIO_LANGE`, `PORANGABA`, `SAO_ROQUE`). Este módulo converte o texto em apontamentos quantificáveis (`RDOApontamento`) para alimentar o BI/XGBoost. Cada apontamento criado recebe o prefixo-marcador `AUTO_ESTRUTURADO_ICARO` (constante `MARKER`), o que torna a operação **idempotente**: `enriquecer_rdos_icaro` primeiro apaga todos os apontamentos antigos com `servico LIKE 'AUTO_ESTRUTURADO_ICARO%'` antes de recriar.

**Regras de extração:**
- `_meters`: regex `\b(\d+(?:[,.]\d+)?)\s*m\b(?!m)`, faixa `0 < val <= 500`, classifica o serviço pelo prefixo de ±55 chars ("assent" → "Assentamento de rede"; "escav" → "Escavacao executada"); captura `DN` via `\bDN\s*(\d{2,4})`.
- `_tubos`: regex `\b(\d+)\s+tubos?\s+(?:[A-Z]{1,3}\s+)?DN\s*(\d{2,4})` → unidade `un`.
- `_caixa_etapas`: detecta `caixa|abrigo|vrp`, fatia por `Equipe N:` e conta termos de etapa (`STAGE_TERMS`: "inicio", "limpeza", "laje", "parede", "reboco", "armacao", "concretagem", "tampa", "dreno", "escavacao", etc.); `"100%"` força `stages>=2`; "nao teve" zera; resultado limitado a `min(stages,4)` na unidade `etapa`.

`_has_block` (termos `BLOCK_TERMS`: "nao teve atividades", "falta de hr", "paralis", "nao realizou", etc.) zera a produção quando o dia foi de bloqueio sem produção detectada. Há deduplicação por chave `(servico, quantidade, unidade, dn_mm)`. Normalização de acentos via `str.maketrans` em `_norm`. **Detalhe notável:** os apontamentos gerados entram com `custo_unit=0`/`custo_total=0` (são quantitativos de produção, não de custo).

### Controle de fluxo financeiro por texto (`financeiro/controle_fluxo_texto.py`)

**Propósito.** Parser "Preencher com Texto" que lê um relatório textual de controle/financeiro do engenheiro e materializa lançamentos de fluxo de caixa, tarefas, riscos e itens de agenda no ConstruData offline. Depende de `campo.texto_operacional` (`_data`, `_float`, `_kv`, `_nucleo_do_texto`) e de `core.construdata_offline` (`create_entity`, `get_project`, `list_entity`).

**Seções reconhecidas (`SECOES`):** controle, fixos, diretos, indiretos, variaveis, medicao, recebimento, desvios, observacoes — cada uma com sinônimos. `_linhas_secao` faz parsing por estado (liga/desliga ao detectar cabeçalhos). `_valor_linha` extrai valores em `R$ ...,xx` ou último número da linha (descartando datas), e `_data_linha` aceita ISO, `dd/mm/aaaa` ou `mês/ano` por extenso (mapa `MESES`).

**Convenção de sinais (fluxo de caixa):** custos (`fixos`, `diretos`, `indiretos`, `variaveis`) são lançados com **sinal −1** ("Custo X projetado"); `medicao` e `recebimento` com **sinal +1** ("Medicao prevista"/"Recebimento previsto"). `fluxo_projetado(project_id)` filtra entidades `custos` com `origem == "texto_controle_fluxo"`, agrega por mês (`%Y-%m`) em buckets `receitas` (parte positiva), `custos` (módulo da parte negativa) e `saldo`, e por categoria; o resumo retorna `saldo_projetado = receitas_previstas − custos_projetados`. `_prioridade` classifica linhas em ALTA/MEDIA/NORMAL por palavras-chave ("critico", "urgente", "atraso", "bloqueio"...). `aplicar_texto_controle_fluxo` grava `custos`, `tarefas`, `agenda` (para medição/recebimento) e `lps` (restrições, a partir de riscos/desvios) e devolve `{ok, parsed, created, fluxo}`. As entidades-alvo (`custos`, `tarefas`, `agenda`, `lps`) correspondem aos modelos `CDMCusto`, `CDMTarefa`, `CDMAgenda`, `CDMLpsRestricao` de `core/construdata_offline.py`.

### Arquitetura do pacote ConstruData (`construdata/`)

Diferentemente do que o layout `core/io/models/utils` sugere, o pacote **não** é uma implementação em camadas preenchida: `construdata/core/`, `construdata/io/` e `construdata/utils/` estão **vazios** (sem módulos `.py`). O pacote funciona como **fachada modular** (`__init__.py` descreve "ConstruData SABESP v5.1.0", inspirado na arquitetura modular do Bentley SewerCAD, autor "Felipe Nery - FCN Construções e Saneamento") que reexporta:
- de `construdata/models/` → as classes de domínio `PV`, `Trecho`, `Rede`, `TipoPV`, `MaterialTubo`, `StatusHidraulico` definidas no `models.py` da **raiz** (acesso via `sys.path.insert(...parent.parent.parent...)`);
- de `construdata/database.py` → a classe `BancoDeDados` do `database.py` da raiz, um wrapper SQLite (`sqlite3`, `row_factory=sqlite3.Row`) "similar ao arquivo `.stsw.sqlite` do SewerCAD", com tabelas como `processamentos`.

Portanto, a "camada de modelos" e a "camada de IO/persistência" residem nos arquivos de raiz `models.py` e `database.py`; o subpacote apenas oferece um namespace `construdata.*` estável sobre eles.

### Orquestração ConstruData (pipeline, planner, integrador)

**`construdata_pipeline.py` — pipeline completo.** `run_pipeline(input_path, nucleo, out_dir, data_inicio)` lê a entrada conforme a extensão (`.xml`→`ler_landxml`, `.dwg`→`ler_dwg_aec`, `.dxf`→`ler_dxf_gdal`) e executa 6 etapas: (1) leitura (PVs/trechos/extensão), (2) pacote completo de NS (`gerar_ns.processar_nucleo_from_data`) + XLSX automáticas, (3) saídas Civil 3D (`LandXML`, cadastro DXF, Dynamo `.py`/`.dyn`, `.scr`), (4) cadastro As-Built **NTS 292** (`gerar_cadastro_nts292`), (5) **BIM LOD 500** IFC 2x3 (`gerar_ifc_lod500`), (6) cronograma **MS Project XML** (`gerar_project_xml`). As XLSX automáticas (`_gerar_xlsx_automaticos`) integram motores externos: `motor_lean_lps` (LEAN/LPS), `motor_medicao.gerar_curva_s` (Curva S), `motor_microplanejamento.micro_planejar_nucleo`, além de custos e hidráulica (`gerar_xlsx`). Tudo é resiliente a `ImportError`/exceções, acumulando `warnings` e um manifesto JSON (`XLSX_AUTOMATICAS.json`); o resultado consolidado é salvo em `PIPELINE_RESULTADO.json`. `_normalize_microplan_for_xlsx` recalcula equipes recomendadas (`equipes_base * pct_total/100`) e `dias_estimados = ceil(dias_total/equipes_rec)`.

**Entradas/saídas (formatos):** entrada DXF/DWG/LandXML(XML); saídas PDF (A4/DESENHO/SAT), HTML, JSON, XLSX (OSE, Curva S, Microplanejamento, Custos, Hidráulica), LandXML, DXF (cadastro), Dynamo `.py`/`.dyn`, AutoCAD `.scr`, IFC 2x3 + CSV (LOD 500) e MS Project XML.

**`construdata_planner.py` — saldo e lista de compras.** Lê GeoPackage (layers redes/pvs/registros, detecção automática por palavras-chave: "rede","trecho","tubo","esgoto","coletor","adutora" etc.) e cruza com planilha mestre (`MESTRE_SLNR_FINAL4.xlsx`). Calcula saldo por material×diâmetro (`planejado_m`, `executado_m`, `em_andamento_m`, `a_executar_m`, `saldo_m = a_executar + em_andamento`, `pct_exec = executado/planejado*100`) e por núcleo. `corrigir_crs` trata o bug clássico de **CRS mal-rotulado** (label EPSG:4326 com coordenadas UTM): se `to_epsg()==4326` e `abs(x) > 180`, sobrescreve para `EPSG:31983` (SIRGAS 2000 / UTM 23S). `calcular_comprimento_real` usa `geometry.length` quando o comprimento está ausente/zerado. `normalizar_status` mapeia variações textuais para os 3 status canônicos (`EXECUTADO`/`EM ANDAMENTO`/`A EXECUTAR`). O `CATALOGO_FORNECEDORES` é uma base real de fornecedores e normas técnicas brasileiras por (material, DN): tubos PVC SN8 **NBR 7362** (Tigre, Amanco), PEAD PE100 PN10 (Plastubos, Fortlev), grés **NBR 8094** (São Simão), concreto **NBR 8890** (Premold), PV em anéis **NBR 9794**, hidrante **NBR 14880**, com prazos de entrega. Saídas: Excel multi-aba (`exportar_excel`) e dashboard HTML embutido (`gerar_dashboard` → `construplan_brutal.html`). Constantes de projeto: `SE LIGA NA REDE - SANTOS`, consórcio SLNR, responsável Felipe Nery.

**`construdata_integrador.py` — ponte NS↔Planejador.** Três modos: `modo_importar_geo` (lê `.gpkg`/`.shp`/`.geojson` já com status executado, com merge opcional ao projeto), `modo_selecionar_executados` (marca executados por filtros: núcleo, BM, IDs ou percentual com `np.random.seed(42)`), e `modo_atualizar_via_tabela` (cruza GeoPackage com CSV/XLSX exportado pelo NS por ID detectado automaticamente). Detalhes técnicos: `CRS_PROJETO = "EPSG:31983"` (SIRGAS 2000 UTM 23S); `_corrigir_crs` corrige CRS ausente/mal-rotulado; `_normalizar_status_series` mapeia ~30 variações (incl. "1"/"0", "sim"/"nao", "done") para os 3 status; `salvar_gpkg_atualizado` adiciona metadados de rastreabilidade (`data_atualizacao`, `bm_referencia`); `executar_planejador` carrega `construdata_planner.py` dinamicamente via `importlib` e injeta `CONFIG`.

> **Bug latente (não corrigido) em `construdata_integrador.py`:** em `modo_atualizar_via_tabela` (linha ~263) o código indexa `df_ns[[" _id_str", col_st_tab]]` com um **espaço inicial** no nome da coluna (`" _id_str"`), enquanto a coluna foi criada como `"_id_str"` (linha 259). Como resultado, o ramo "com coluna de status" (`col_st_tab` presente) lança `KeyError` no merge; apenas o ramo sem coluna de status (marca tudo como `EXECUTADO`) funciona.

### Motor de Analytics ML autônomo (`construdata_analytics.py` + `ANALYTICS_COMPLETO.py`)

Independente do `xgboost_responsaveis.py`, este é o "Analytics ML" do contrato 11481051 (FCN Construções, SLNR Santos). **Entrada:** `dados_contrato/EXECUCAO_DIARIA.json` (e opcional `ML_DATA.json`). **Saídas:** `analiticos/ANALYTICS_SLNR.xlsx`, `ANALYTICS_SLNR.json`, gráficos PNG (`graficos/`) e relatórios MD/HTML. `ANALYTICS_COMPLETO.py` é o driver: valida `OPENPYXL_OK`/`MPL_OK`, executa `anyt.main(...)` e abre a pasta no Explorer (`os.startfile`).

- **Features (`preparar_features`):** 11 features — `lig_total_r3/r7`, `pra_r3/r7`, `la_r3`, `le_r3`, `nucleo_enc` (LabelEncoder), `dia_semana`, `mes`, `fim_semana`, `dias_decorridos`. Alvo: `lig_total = la + le` (ligações água+esgoto). Rolling features por núcleo com `groupby.transform(shift(1).rolling(...))` para evitar leakage.
- **GridSearchCV (`treinar_modelo`):** `param_grid` = `n_estimators∈{50,100,200}`, `max_depth∈{3,5,7}`, `learning_rate∈{0.05,0.1,0.2}`, `subsample∈{0.8,1.0}` → **3×3×3×2 = 108 combinações × 3 folds = 324 modelos** (o cabeçalho cita "108 combinações"; o código calcula `n_combos` dinamicamente). `XGBRegressor(objective="reg:squarederror", random_state=42)`, com **fallback para `RandomForestRegressor`** se `xgboost` não estiver disponível (`XGBOOST_OK`). Métricas: R²-test, R²-CV (5 folds), MAE, RMSE, `best_params`.
- **Cenários (`gerar_cenarios`):** 5 cenários (Baseline, +10%, +20%, +30%, Meta contratual 366/mês) projetando a conclusão das `META_TOTAL = 25383` ligações. Usa média recente (últimos 60 dias com produção) ponderada por fator de utilização (% dias com produção nos últimos 30, piso 0,3); `dias_para_concluir = ceil(lig_faltam / prod_diaria)`; estimativa de custo extra de aceleração (`aceleracao_pct/100 × R$50.000/mês`). Constantes: `META_MENSAL = 366`, `CUSTO_POR_LIG = 910*2 = R$1.820/ligação`, `NUCLEO_LABELS`/`CORES` por núcleo (Morro do Teteu, Pantanal Baixo, João Carlos, São Manoel, Vila Israel, Vila Criadores).
- **Gráficos (matplotlib/seaborn):** real×predito, violin por núcleo, feature importance, tendência semanal (degradáveis se `MPL_OK` for falso).

### Rotas FastAPI

| Rota | Método | Ação |
| --- | --- | --- |
| `/api/bi/analytics` | GET | Retorna `montar_bi_payload(False)` |
| `/api/bi/analytics/recalcular` | POST | Recalcula XGBoost e retorna payload |
| `/api/bi/analytics/export/pdf` | GET | `FileResponse` do PDF do BI |
| `/api/bi/analytics/export/excel` | GET | `FileResponse` do XLSX do BI |
| `/api/evolucao` | GET | `resumo_evolucao(nucleo)` (consolidação Evolução 360) |
| `/api/evolucao/predicao` | GET | Predição + decisão recomendada |
| `/api/evolucao/ontologia` | GET | Ontologia do núcleo |
| `/api/evolucao/{nucleo}/executar-ciclo` | POST | `executar_ciclo_evolucao` (HTTP 400 em falha) |
| `/api/offline/...` | GET/POST/PATCH | CRUD de projeto, contatos, dashboard, snapshot, relatório 360 e entidades genéricas (`custos`, `tarefas`, `agenda`, `lps`, ...) |

As rotas de Evolução 360 dependem de `campo.evolucao_platform` (`resumo_evolucao`, `executar_ciclo_evolucao`), fora do escopo deste subsistema mas que consome os mesmos RDOs/métricas.

### Dependências (bibliotecas)

- **ML/dados:** `xgboost` (`XGBRegressor`), `scikit-learn` (`GridSearchCV`, `cross_val_score`, `train_test_split`, `LabelEncoder`, métricas), `pandas`, `numpy`.
- **Persistência/ORM:** `sqlalchemy` (`select`, `selectinload`, sessão de `core.database`), `sqlite3` (`BancoDeDados`).
- **Geoprocessamento:** `geopandas`, `fiona`, `shapely` (planner/integrador), CRS `EPSG:31983`.
- **Relatórios:** `openpyxl` (XLSX + charts), `reportlab` (PDF), `matplotlib`/`seaborn` (gráficos PNG, opcionais).
- **API:** `fastapi` (`APIRouter`, `FileResponse`, `HTTPException`, `Query`).

### Detalhes notáveis e validações

- **Idempotência do enriquecimento Icaro** via marcador `AUTO_ESTRUTURADO_ICARO` (apaga antes de recriar), evitando duplicação de apontamentos a cada execução.
- **Anti-leakage temporal** consistente nos dois motores ML: médias móveis sempre com `.shift(1)` antes de `rolling`.
- **Fallbacks robustos:** XGBoost→média móvel (poucos dados) em `xgboost_responsaveis.py`; XGBoost→RandomForest (lib ausente) em `construdata_analytics.py`; `OPENPYXL_OK`/`MPL_OK`/`SKLEARN_OK` desativam exportações sem quebrar.
- **Correção de CRS mal-rotulado** (EPSG:4326 com UTM → EPSG:31983) presente e duplicada em planner e integrador — coerente com o histórico do projeto de cuidado com tolerâncias geométricas e leitura de redes.
- **Normas/contratos reais** referenciados: NTS 292 (cadastro As-Built SABESP), NBR 7362/8094/8890/9794/14880 (catálogo de materiais), contrato 11481051 / consórcio SLNR Santos / "SE LIGA NA REDE".
- **Bug latente** documentado acima em `construdata_integrador.py` (chave `" _id_str"` com espaço) — quebra o caminho de atualização por status na importação via tabela NS.
- **Convenção financeira** clara de sinais (custos negativos, medições/recebimentos positivos) e saldo projetado mensal/por categoria em `controle_fluxo_texto.py`.
- **Pasta de camadas vazias:** `construdata/{core,io,utils}` existem sem código — a arquitetura "modular SewerCAD" hoje é uma fachada de reexportação sobre `models.py`/`database.py` da raiz, e não uma implementação em camadas separada.

Observação de varredura: além das versões aqui documentadas (na raiz `NOVA NS Versao 5/`), existem cópias dos mesmos arquivos em `.claude/worktrees/*` e em pastas de pacotes históricos (`CONSTRUDATA_HYDRONETWORK_*`, `ConstruData_HydroNetwork_V4*`, `Construdata hydronetwork v6/PACOTE_V4/`); este documento baseou-se exclusivamente nos arquivos canônicos da raiz do projeto.

---

## Interfaces Graficas (Desktop GUI e HTML)

Este subsistema concentra a camada de apresentacao do **NOVA NS Versao 5 / ConstruData HydroNetwork v9.0** (FCN Construcoes e Saneamento, Contrato 11481051, Santos/SP). Ele e composto por tres frentes complementares: (1) GUIs desktop nativas escritas em **Tkinter**, (2) um conjunto de **paineis HTML/JS** servidos pela API local FastAPI (porta 127.0.0.1:8787) e/ou abertos via `webbrowser`, e (3) um wrapper opcional em **pywebview** que encapsula um frontend React/Vite real. A documentacao abaixo baseia-se na leitura direta de `construdata_gui.py`, `construdata_gui_premium.py`, `ns_v5_gui.py`, `ui_construdata_modules.py`, `ui_operational_cycle.py`, `abrir_construdata_frontend_gui.py`, dos `.html` da pasta `html/` e dos lancadores `ABRIR*.bat` na raiz.

### Tecnologia das interfaces

- **GUIs desktop = Tkinter puro.** Tanto `construdata_gui.py` quanto `construdata_gui_premium.py` definem a classe `HydroNetworkApp` instanciada sobre `tkinter.Tk()` e encerram em `root.mainloop()` (funcao `main()` ao final de ambos). Usam `tkinter.ttk` (`Notebook`, `Treeview`, estilos), `filedialog`, `messagebox` e `scrolledtext`. **Nao** ha pywebview nessas duas GUIs principais.
- **Diferenca da versao "premium":** `construdata_gui_premium.py` e funcionalmente identica a `construdata_gui.py` (mesmas 13+ abas, mesma paleta de cores, mesmo cabecalho de docstring "v9.0"), porem importa `sv_ttk` e aplica `sv_ttk.set_theme("dark")` no construtor (linhas 14 e 122) para dar um tema escuro moderno aos widgets `ttk`. As cores hexadecimais base sao as mesmas (`BG="#06060f"`, `ACCENT="#00ff88"`, `BLUE="#00aaff"`, etc.).
- **Paineis HTML = SPA estaticas + JS vanilla.** Os `.html` em `html/` sao paginas single-file (CSS e JS embutidos) que consomem a API local via `fetch('/api/...')`. Usam bibliotecas CDN: **Leaflet 1.9.4** (mapa/cadastro de rede em `construdata_editor.html`, `ARQUITETURA_BIM_5D.html`, `FLUXOGRAMA_BIM_5D.html`) e **three.js r128** (viewer 3D em `construdata_manage.html`).
- **Wrapper pywebview (opcional).** Apenas `abrir_construdata_frontend_gui.py` usa `import webview` + `webview.create_window(...)` / `webview.start()` para abrir um frontend React/Vite externo (ver secao de lancadores).
- **GUI satelite Tkinter independente:** `ns_v5_gui.py` (classe `NSV5Gui` sobre `Tk()`) e uma janela autonoma so para gerar Nota de Servico v5.

### Arquivos do subsistema

| Arquivo | Responsabilidade | Principais funcoes/classes |
|---|---|---|
| `construdata_gui.py` | GUI desktop principal (Tkinter), orquestra todos os motores via `_try_import` e expoe 14 abas/Notebook | `HydroNetworkApp`, `_build_ui`, `_tab_processar`…`_tab_gestao`, `_tab_ciclo_operacional`, `_tab_construdata_workspace`, `_abrir_html`, `main` |
| `construdata_gui_premium.py` | Mesma GUI com tema `sv_ttk` dark aplicado | identica + `sv_ttk.set_theme("dark")` |
| `ns_v5_gui.py` | Janela Tkinter autonoma para gerar NS v5 a partir de JSON/DXF | `NSV5Gui`, `_load_json`, `_load_dxf`, `_normalize_pvs`, helpers `_float/_int/_clean`; usa `gerar_ns.*` |
| `ui_construdata_modules.py` | Aba/shell "ConstruData Workspace" offline plugada no Notebook; navegacao tipo frontend (sidebar + cards) sobre banco local | `build_construdata_workspace_tab`, `NAV_SECTIONS`, `ENTITY_PAGES`, `KEY_TO_ENTITY`, `RAIL_ACTIONS`, `PROJECT_COORDS`; consome `core.construdata_offline.*` |
| `ui_operational_cycle.py` | Aba nativa Tkinter (sem HTML) do ciclo operacional offline, lendo o mesmo banco da API | `_load_operational_summary`, helpers `_to_float/_to_int`, `_week_defaults`, `_current_nucleo`; consome `core.database`/`core.models` |
| `abrir_construdata_frontend_gui.py` | Wrapper **pywebview**: sobe API (uvicorn) + frontend Vite e abre janela nativa | `main`, `_ensure_api`, `_ensure_frontend`, `_url_ok` |
| `html/*.html` | Paineis web servidos pela API local / abertos no navegador | 11 paginas (detalhadas abaixo) |

### Modulos/abas da GUI desktop (`construdata_gui.py`)

O `_build_ui` cria um `ttk.Notebook` (`self.nb`) e adiciona as abas via os metodos `_tab_*` (linhas 239-253), com `_on_tab_changed` ligado ao evento `<<NotebookTabChanged>>`:

| # | Aba | Conteudo/funcao |
|---|---|---|
| 1 | `[1] Processar` | Importacao de projeto (DXF ProSaneamento, LandXML/Civil 3D, DWG AEC, JSON, GPKG) e disparo do pipeline 6 etapas |
| 2 | `[2] Mapa` | Mapa via tile servers (ArcGIS World_Imagery satelite e OpenStreetMap) — `tkintermapview`/`contextily` |
| 3 | `[3] Rede` | Visao da rede de PVs/trechos lidos |
| 4 | `[4] Hidraulica` | Calculo hidraulico dos trechos |
| 5 | `[5] Trechos` | Tabela/edicao de trechos |
| 6 | `[6] Custos 5D` | Orcamento/custo (motor de custo, base SINAPI/BDI nos motores) |
| 7 | `[7] BIM` | Acessos aos paineis HTML (Editor EPANET, Viewer 3D, Controle As-Built, RDO, Perdas, Fluxograma) e geracao IFC LOD500 |
| 8 | `[8] Lean/LPS` | Last Planner System / Lean (`motor_lean_lps`) |
| 9 | `[9] Perdas` | Gestao de perdas (`motor_perdas`, `gerar_pdf_perdas`) |
| 10 | `[10] IA` | Motores de IA: Gemini, Multi-LLM, SLNR Mestre ML |
| 11 | `[11] Nucleos` | Gestao dos 12 nucleos da obra |
| 12 | `[12] Log` | Console/log (inclui `_webhook_log_reader` em thread) |
| 13 | `[13] Gestao` | Geracao de MEDICAO.xlsx, CURVA_S.html e DIARIO.html |
| 14 | Ciclo Operacional | `_tab_ciclo_operacional` (aba nativa via `ui_operational_cycle.py`) |
| 15 | ConstruData Workspace | `_tab_construdata_workspace` → `build_construdata_workspace_tab(self, index=15)` de `ui_construdata_modules.py` |

Toda execucao pesada roda em `threading.Thread(..., daemon=True)` com `self.progress.start(15)` para nao travar a UI. A aba BIM (`_tab_bim`, linhas ~908-913) expoe links que chamam `self._abrir_html(...)` para abrir os paineis HTML, e diversas saidas (`GANTT_NS.html`, `REDE_GERAL.html`, `RELATORIO_ANALYTICS.html`) sao abertas via `webbrowser.open(...)`.

#### Roteamento HTML da GUI (`_abrir_html`)

A GUI mapeia cada arquivo HTML para uma rota da API local (`API_LOCAL_URL`, default `http://127.0.0.1:8787`) — linhas ~1946-1955:

- `construdata_rdo.html` → `/rdo`
- `construdata_manage.html` → `/manage` (e tambem renderizado como snapshot estatico `manage_atual_<pid>.html` a partir do template em `html/construdata_manage.html`, abrindo via `as_uri()`)
- `construdata_controle.html` → `/controle`
- `construdata_campo.html` → `/campo`

### Shell "ConstruData Workspace" (`ui_construdata_modules.py`)

Aba unica estilo frontend (sidebar de navegacao + cards) que **nasce de projeto e banco local, nao de Nota de Servico** (docstring do arquivo). A navegacao `NAV_SECTIONS` organiza modulos em grupos: **Gestao** (Gestao 360, Evolucao 360, Torre Controle, Projetos), **Engenharia** (Motor NS V5, Mapa/GIS, BIM 3D/4D/5D, Rede 360, Pre-Construcao), **Planejamento** (Plan. Mestre, Agenda, LPS/Lean, EVM/Curva S), **Financeiro** (DRE & Resultado), **Operacao de Campo** (RDO, RDOs WhatsApp, Relatorio 360, Punch List), **Recursos** (Suprimentos, Mao de Obra, Equipamentos, Quantitativos), **IA & Inteligencia** (Engine V5, IA & Analytics, Agente Chat, Leitor PDF) e **Comunicacao** (Contatos, Fluxo Oper., WhatsApp RDO). O dicionario `ENTITY_PAGES` define colunas e campos CRUD por entidade (tarefas, lps, suprimentos, mao_obra, equipamentos, custos/DRE, agenda, punch, whatsapp), e `PROJECT_COORDS` fixa lat/long de cada nucleo (ex.: `SLNR/RK_SUB = (-23.9608, -46.3336)` Santos; `OSASCO`, `TATUI`, `PARDINHO`, `BRASILIA`). Consome funcoes de `core.construdata_offline` (`create_project`, `dashboard_counts`, `build_project_report`, `export_project_report`, etc.).

### Aba Ciclo Operacional nativa (`ui_operational_cycle.py`)

Aba Tkinter **sem HTML** que pluga no Notebook e le o **mesmo banco local da API** via `core.database.get_session()` e `core.models` (`PlanejamentoSemanal`, `DesvioPlanejamento`, `Replanejamento`, `OperationalLog`, `StatusPlanejamento`, `StatusReplanejamento`). `_load_operational_summary` chama `criar_banco()` e monta o resumo semanal (default Mon–Sun via `_week_defaults`) com filtros de severidade/status; nucleo default `SLNR`.

### Paginas HTML (`html/`)

Todas as 11 paginas sao single-file (CSS+JS embutidos), tema escuro/corporativo, consumindo a API local por `fetch`.

| Arquivo | Titulo | O que exibe | Tecnologia / API |
|---|---|---|---|
| `construdata_editor.html` (1054 linhas) | "Editor de Rede · NS · Cadastro" | Editor interativo de PVs/trechos sobre mapa; calculo hidraulico de Manning ao vivo; abas Propriedades/NS/Cadastro/Custo; cadastro As-Built **NTS 292**; importa `.json/.geojson` | **Leaflet 1.9.4**; calculo client-side |
| `construdata_perdas.html` (524 linhas) | "Gestao de Perdas de Agua" | KPIs de Perdas Reais (fisicas) vs Aparentes; UARL, ILI; diagrama Sankey de balanco hidrico; custo de perdas/ano + energia; geracao de relatorio imprimivel | JS vanilla; metodologia IWA |
| `construdata_rdo.html` (1113 linhas) | "RDO · Relatorio Diario de Obra" | RDO digital e automatico; upload (`/api/rdo/automatico/upload`); relatorio impresso "RDO Nº ${rdo.numero}" | `fetch /api/rdo`, `/api/ns`, `/api/relatorio360/rdo/` |
| `construdata_controle.html` (576 linhas) | "Controle NS" | Abas As-Built (campo → Cadastro NTS 292), Boletim de Medicao (NS→BM→Pagamento condicionado ao cadastro), Curva S (Previsto × Realizado) e Resumo BIM 5D; status de BM (aprovado/em_analise/rascunho); aciona pipeline `construdata_pipeline.py --asbuilt` (gera DXF georref + PDF + meta JSON) | JS vanilla |
| `construdata_manage.html` (310 linhas) | "Manage NS" | Viewer 3D da rede; usado tanto via rota `/manage` quanto como snapshot estatico gerado pela GUI | **three.js r128** |
| `construdata_campo.html` (153 linhas) | "Campo" | Painel de campo conectado a RDO, NS e cadastro | `fetch /api/dashboard`, `/api/ns`, `/api/rdo` |
| `construdata_bi_analytics.html` (380 linhas) | "BI Analytics" | BI operacional; recalculo e exportacao | `fetch /api/bi/analytics`, `.../export/excel`, `.../export/pdf`, `.../recalcular` |
| `construdata_ns_v5.html` (78 linhas) | "ConstruDataWeb NS V5" | SPA da NS V5 no ConstruDataWeb: sidebar (Gestao 360, NS V5 Web, BI Analytics, RDO, Ciclo Operacional, Controle/Fluxo), 6 KPIs (RDOs, NS, Planejamentos, Desvios, PPC %, Custo R$), grade de "14 modulos migrados", contratos, RDO por texto e tabela de desvios/replanejamento | `fetch /api/ns-v5/projects/...` (snapshot, modules, ml/recalcular, rdo/preencher-texto) |
| `construdata_ciclo_operacional.html` (75 linhas) | "Ciclo Operacional" | "Ciclo Operacional 360" por projeto | `fetch /api/projetos/...` |
| `ARQUITETURA_BIM_5D.html` (482 linhas) | "Arquitetura de Dados BIM 5D" | Diagrama/arquitetura de dados BIM 5D | Leaflet |
| `FLUXOGRAMA_BIM_5D.html` (519 linhas) | "Fluxograma BIM 5D" | Fluxograma do processo BIM 5D | Leaflet |

#### Formulas tecnicas reais nos paineis HTML

- **Manning (escoamento livre)** — `construdata_editor.html`, funcao `calcManning(dn_mm, decl_mm, material)`:
  - `V = (1/n) · Rh^(2/3) · I^(1/2)`, com `Rh = D/4` (secao plena), `A = π·D²/4`, `Q = V·A` (em L/s).
  - **Tensao trativa**: `tau = 9810 · Rh · I` (Pa).
  - Coeficientes de Manning embutidos: `MANNING_N = { PVC: 0.013, PEAD: 0.011, 'PE 80': 0.011, 'PE 100': 0.011, CONCRETO: 0.015 }` (fallback 0.013).
  - **Validacao normativa**: para trechos de esgoto, destaca em vermelho e emite alerta "⚠️ < 1Pa" quando `tau < 1` Pa (criterio de autolimpeza/tensao trativa minima da NBR 9649). Recalculo de declividade: `decl_mm = ((CF_montante − CF_jusante)/ext_m)·1e6`.
- **Perdas de agua (metodologia IWA)** — `construdata_perdas.html`:
  - **UARL** (perda real inevitavel): `UARL = (18·Lm + 0.8·Nc + 25·Lp)·P` (Lm = extensao de rede, Nc = nº de ligacoes, Lp = comprimento de ramais, P = pressao).
  - **ILI** (indice de vazamento da infraestrutura): `ILI = Perdas Reais / UARL`.
  - Distingue **Perdas Reais (fisicas)** de **Perdas Aparentes (submedicao + fraude)** e projeta custo de perdas/ano e custo de energia.
- **Cadastro As-Built**: paineis `construdata_editor.html` e `construdata_controle.html` produzem cadastro no padrao **NTS 292 (SABESP)**, com pipeline real gerando DXF georreferenciado + PDF + meta JSON.

### Entradas e saidas

- **Entradas (GUI desktop):** DXF (ProSaneamento), LandXML (Civil 3D), DWG (AEC Proxy/COM), JSON, GPKG. `ns_v5_gui.py` aceita JSON (pvs+trechos ou trecho+pv_montante+pv_jusante) e DXF (via `ler_dxf_gdal`).
- **Entradas (HTML):** `.json/.geojson` (editor), texto livre de RDO, uploads de RDO.
- **Saidas:** NS (A4/desenho/SAT/GeoJSON/HTML via `gerar_ns`), IFC LOD500, Cronograma (MS Project XML, GANTT_NS.html), Curva S (HTML), MEDICAO.xlsx, DIARIO.html, PDF de perdas, Cadastro NTS 292 (DXF georref + PDF + meta JSON), exportacoes BI em Excel/PDF, planilha `SLNR_MESTRE_UNIFICADO_ML.xlsx` e `ANALYTICS_SLNR.xlsx/.json`.

### Como o usuario abre o sistema (lancadores `.bat`)

Os atalhos na raiz sao a porta de entrada principal:

| `.bat` | Acao |
|---|---|
| `ABRIR.bat` | Lancador "oficial" v9.0: banner ASCII, verifica/instala 7 grupos de dependencias (ezdxf/matplotlib/openpyxl/networkx/pyproj; geopandas/pyogrio/shapely/numpy/scipy; tkintermapview/contextily; reportlab; ifcopenshell; pywin32; sklearn/xgboost) e executa `python construdata_gui.py` |
| `ABRIR_CONSTRUDATA.bat` | Variante v8.0 com 6 etapas de dependencias; tambem chama `construdata_gui.py` |
| `ABRIR_GUI.bat` | Execucao direta minima: detecta `python`/`python3`, usa `construdata_gui.py` (fallback `gui.py`) |
| `ABRIR_GUI_ATUALIZADO.bat` | "v10": define `PYTHONUTF8=1`, prepara dirs de runtime (`core.config.ensure_runtime_dirs`), garante stack FastAPI/uvicorn/sqlalchemy/reportlab, sobe API local sob demanda em `http://127.0.0.1:8787` e roda `python -X utf8 construdata_gui.py` |
| `ABRIR_CONSTRUDATA_FRONTEND_GUI.bat` | Executa `abrir_construdata_frontend_gui.py`: sobe a API (`uvicorn api.server:app`, porta 8787) e o frontend **Vite/React** (`npm run dev`, porta 5174, env `VITE_API_URL`/`VITE_ENABLE_DEMO_DATA=false`), depois abre janela **pywebview** em `http://127.0.0.1:5174/app/gestao-360`. Requer `pywebview` instalado |
| `ABRIR_NS_V5_GUI.bat` | `python ns_v5_gui.py` (janela autonoma de NS v5) |
| `ABRIR_SLNR_PLANILHA.bat` | Abre a planilha `saida_hydronetwork\slnr_mestre\SLNR_MESTRE_UNIFICADO_ML.xlsx` (ou o modelo); referencia "12 Nucleos + 115 Formulas + ML" |
| `EXECUTAR_ANALYTICS.bat` | Roda `construdata_analytics.py --output analiticos` (XGBoost + GridSearchCV), gera `ANALYTICS_SLNR.xlsx/.json` + graficos; checa se o Excel esta aberto antes |

### Detalhes notaveis

- **Carga resiliente de motores:** ambas as GUIs usam `_try_import(name, import_fn)` populando `_ENGINES[name] = True/False`; qualquer motor ausente e desabilitado sem quebrar a UI (ex.: IFC sem `ifcopenshell`, DWG sem `pywin32`, ML sem `sklearn/xgboost`).
- **API local sob demanda:** `API_LOCAL_URL` vem de `core.config.API_BASE_URL` com fallback `http://127.0.0.1:8787`; os paineis HTML so funcionam plenamente com a API ativa.
- **Tile servers fixos** (linhas 104-105): satelite ArcGIS `World_Imagery` e ruas OpenStreetMap.
- **Caminhos hardcoded de ambiente:** `_XML_DIR = ~/Downloads/PROJETOS DE AGUA E ESGOTO - DWG E DXF 2018` (lista `_PROLONGAMENTOS` de Santos: Teteu, Pantanal, Criadores, Sao Manoel); `EXECUTAR_ANALYTICS.bat` faz `cd "C:\Users\felip\Downloads\NOVA NS Versao 5"` e `abrir_construdata_frontend_gui.py` aponta `FRONTEND_DIR = C:\Users\felip\Downloads\construdatamaxv2-clean\frontend` — caminhos absolutos de maquina especifica, fragilidade de portabilidade.
- **Validacao hidraulica de campo (V de tensao trativa):** o editor sinaliza `tau < 1 Pa` em esgoto como condicao critica (autolimpeza), implementando a verificacao normativa no proprio painel.
- **Cadastro condicionado:** em `construdata_controle.html` o Boletim de Medicao (NS→BM→Pagamento) e explicitamente "condicionado ao cadastro" As-Built NTS 292, e a geracao do cadastro bloqueia ("Nenhum trecho lancado!") se nao houver trechos as-built.
- **Observacao de versionamento:** os docstrings das duas GUIs declaram "v9.0", a constante interna e `VERSION = "9.0.0"`, mas `ABRIR_GUI_ATUALIZADO.bat` se intitula "v10" — divergencia de rotulagem entre lancador e codigo. Existem ainda muitas copias dos `.bat` em `.claude/worktrees/*` e em pacotes legados (`CONSTRUDATA_HYDRONETWORK_*`, `ConstruData_HydroNetwork_V4*`), que sao replicas de worktrees/backup e nao a versao raiz canonica.

---

## Integracoes, Automacao e Infraestrutura

Este subsistema reune todos os componentes que conectam o nucleo de calculo Python da plataforma (geracao de Notas de Servico, RDOs, dimensionamento de redes) com o mundo externo: o motor WhatsApp para captura de RDO de campo, a automacao n8n / Evolution API para roteamento de mensagens e jobs agendados, os plugins/bundles de Civil 3D para extracao e injecao de Pipe Networks, e a infraestrutura Docker/VPS que hospeda tudo. Convivem aqui **dois caminhos de WhatsApp paralelos** (um Node `whatsapp-web.js` local e um stack Evolution API/n8n em container) e **tres familias de integracao com Civil 3D** (exporter .NET 8 proprio, bundle comercial C3DRENESG4 de terceiros, e o bundle proprio `ConstruData.bundle`).

### Visao geral por componente

| Pasta / Arquivo | Responsabilidade | Principais funcoes/classes |
|---|---|---|
| `whatsapp-motor/index.js` | Motor WhatsApp local (Node) via `whatsapp-web.js` + Puppeteer; recebe RDO de campo, parseia, posta no FastAPI e persiste no Supabase/Obsidian | `parseRDO`, `_parseServico`, `_parseEquipe`, `_parseFinanceiro`, `_parseOcorrencia`, `_normDate`, `resumoRDO`, `enviarRDOParaAPI`; endpoints Express `/api/send`, `/api/team`, `/api/logs` |
| `whatsapp-motor/package.json` | Manifesto Node do motor | deps: `whatsapp-web.js@^1.23.0`, `@supabase/supabase-js`, `express`, `cors`, `qrcode`, `qrcode-terminal`, `dotenv` |
| `whatsapp_receiver.py` (raiz) | Caminho alternativo: webhook FastAPI para **Meta Cloud API** (oficial), atualiza `STATUS_NS.json` | usa `WA_TOKEN`, `WA_PHONE_ID`, `WA_VERIFY_TOKEN`; integra `motor_status_ns` |
| `workflows/MEGA_ROUTER_WHATSAPP_SINISTRO.json` | Workflow n8n monolitico: webhook Evolution -> lookup Supabase -> roteamento por comando/cargo -> resposta via Evolution API | node `webhook` (`path: whatsapp-master`) + node `code` "Processador Monolitico" |
| `workflows/MEGA_SCHEDULED_JOBS_SINISTRO.json` | Job agendado n8n: cobranca matinal 7h para diretores e financeiro | `scheduleTrigger` (cron `0 7 * * 1-6`) + node `code` "Processador Lembretes" |
| `workflows/*/personal/*.workflow.ts` | Workflows n8n versionados como TypeScript (CONSTRUDATA_CODEX_*, dashboards por obra, LPS, alertas) | exportacoes locais e do n8n Railway de producao |
| `n8n_local/` | Instancia n8n local + dumps do schema/config Evolution (Postgres) | `package.json` (`n8n@^2.16.1`), `evolution_schema_dump*.sql`, `exported_workflows/*.json` |
| `civil3d_pipe_exporter/PipeNetworkExporter.cs` | Plugin/addin .NET 8 para Civil 3D: exporta Pipe Networks gravitacionais para JSON + CSV | `PipeNetworkExporterPlugin` (`IExtensionApplication`), comando `CD_EXPORT_PIPENET`, records `ExportDocument`/`NetworkExport`/`PipeExport`/`StructureExport`/`PointExport` |
| `civil3d_pipe_exporter/PipeNetworkExporter.csproj` | Projeto C# referenciando DLLs nativas do AutoCAD/Civil 3D 2026 | `net8.0-windows`, refs `acmgd`, `acdbmgd`, `accoremgd`, `AeccDbMgd`, `AecBaseMgd` |
| `civil3d_pipe_exporter/build.ps1` / `install-bundle.ps1` / `setup-dotnet.ps1` | Compila a DLL, copia para o bundle e instala em `ApplicationPlugins` | scripts PowerShell |
| `scripts/exportar_pipe_network_oculto.py` | Abre o Civil 3D/AutoCAD em **instancia oculta via COM**, da `NETLOAD` na DLL e dispara `CD_EXPORT_PIPENET` | `export_pipe_network_hidden`, `wait_for_export`, `resolve_dll_path`, `resolve_prog_id`, `wait_quiescent` |
| `scripts/extrair_pipe_network.py` | Roteador unificado DWG (via COM) ou LandXML -> JSON/CSV normalizados | `run_dwg`, `run_landxml` (reusa `landxml_import`) |
| `scripts/importar_bim_civil3d.py` | Caminho inverso: importa BIM JSON no Civil 3D aberto criando circles (PVs) e lines (tubos) via COM `comtypes` | `importar_bim` |
| `scripts/c3drenesg_port.py` | Port Python do nucleo hidraulico/hidrologico reconstruido a partir do C3DRENESG4 | `SafeExpression`, `RainEquation`, metodos `tc_*` (tempo de concentracao), `pop_*` (projecao populacional), `hydraulic_result`, `circular_pipe_full_flow` |
| `automacao_civil3d.py` (raiz) | Automacao de criacao de Pipe Network no Civil 3D via .NET interop (`pythonnet`/`clr`) ou por GUI (`pyautogui`/Dynamo) | `criar_pipe_network_direto`, `executar_dynamo_script`, `encontrar_janela_civil3d` |
| `C3DRENESG4.bundle` | Bundle Autodesk comercial de terceiros (TBN2NET) para dimensionamento de drenagem/esgoto urbano | `PackageContents.xml` + DLLs 2014/2018, CUIX, catalogos de pipes/structures |
| `ConstruData.bundle` | Bundle Autodesk proprio (FCN Construções e Saneamento) — manifesto do produto "ConstruData SABESP" para Civil 3D | `PackageContents.xml` (comandos `CONSTRUDATA`, `CONSTRUDATA_BATCH`, `CONSTRUDATA_QA`) |
| `docker-infra/` | Infraestrutura de producao (VPS Docker Swarm + Traefik) | `setup_vps.sh`, `README.md`, `stacks/*.yml`, `.env.example` |
| `docker-compose.yml` (raiz) | Stack Docker **local isolado** da NOVA NS v5 (portas exclusivas para nao colidir com o ambiente web) | servicos `postgres`, `redis`, `n8n`, `evolution`, `portainer` |
| `tools/construdata_video_generator.py` | Gerador de quadros/animacao (PIL) para video institucional/explicativo | `font`, `line`, `dashed`, `ease`, `fade` |
| `sql_rdos_whatsapp.sql` (raiz) | Migracao Supabase para receber dados de RDO do WhatsApp (colunas extras + RLS + seed de projetos) | `ALTER TABLE rdos`, policies `anon_insert_rdos`/`anon_select_rdos` |

---

### 1. Motor WhatsApp local — `whatsapp-motor/index.js`

Implementacao em Node.js baseada em **`whatsapp-web.js`** (sessao via QR code + Puppeteer headless, e nao a Evolution API — apesar do README de docker mencionar Evolution para o outro caminho). Caracteristicas notaveis:

- **Autenticacao**: `LocalAuth({ clientId: 'constru-wapp-v2' })`; pin de versao do WhatsApp Web via `webVersionCache` remoto (`wa-version/.../2.2412.54.html`); Puppeteer com `--no-sandbox`. O QR e gravado em `qr-code.png` (em vez do terminal) para evitar quebras no Windows.
- **Servidor Express** na porta **8090** com endpoints:
  - `POST /api/send` — disparo de mensagens chamado pelo FastAPI; formata o numero como `${ddi+ddd+numero}@c.us`, registra `taskId` em `lastTaskMap` e retorna 503 enquanto a sessao nao esta `ready`.
  - `GET/POST /api/team` — CRUD de equipes no Supabase (tabela `equipes`), com fallback para `team.json` local.
  - `GET /api/logs` — ultimos 100 registros da tabela `logs_rdo`.
- **Parser RDO "brutal"** (`parseRDO`): le uma mensagem de texto livre com blocos case-insensitive (`NUCLEO`, `DATA`, `RT`, `TRECHO`, `SISTEMA`, `EXECUTADO`, `CLIMA`, `SERVICOS`, `EQUIPE`, `FINANCEIRO`, `OCORRENCIAS`, `OBS`, `FOTOS`), detectados pelo regex `HEADER_RE`. Regras extraidas do codigo:
  - `_parseServico`: extrai descricao, quantidade e unidade (`m3|m2|ml|un|kg|t|h|m`) e captura o diametro via `DN\s*(\d{2,4})` para `dn_mm`.
  - `_parseFinanceiro`: normaliza categoria via `CAT_MAP` (MO/MAO_OBRA->"Mao de Obra", EQ->"Equipamentos", etc.), suporta valor em formato brasileiro (`2.409,84`, `R$500`), e tipo `DESPESA`/`RECEITA`.
  - `_normDate`: converte `DD/MM/AAAA` -> ISO `AAAA-MM-DD`.
- **Fluxo de mensagem** (`client.on('message')`): ignora grupos (`@g.us`); detecta RDO completo por `^\s*RDO\s*$` + presenca de `TRECHO:`. RDO completo e parseado e enviado via `POST /api/rdo` ao backend FastAPI (`CONSTRUDATA_API_URL`, default `http://localhost:8000`); fotos sao baixadas e gravadas em disco. Ha tambem um fluxo de menu "8 grandezas" (Prod Prevista/Real, custos) que chama `POST /api/whatsapp/send`.
- **Persistencia tripla**: arquivo Markdown "caixa-preta" no Obsidian (`appendFileSync`), Supabase (`logs_rdo`) e atualizacao em tempo real de `workflow_status.json` (LPS/linha de balanco) quando o usuario responde `OK`/`CIENTE`.

Detalhe notavel: o codigo contem **caminhos absolutos hardcoded** apontando para a maquina do desenvolvedor (`C:\Users\felip\Downloads\construdatamaxv2-clean\...` e `C:\Users\felip\Downloads\COFREOBSIDIAN\...`), o que acopla este motor a um ambiente especifico.

### Caminho alternativo Meta Cloud API — `whatsapp_receiver.py`

Webhook FastAPI separado (porta sugerida 8765) que fala com a **Meta WhatsApp Cloud API oficial** (variaveis `WA_TOKEN`, `WA_PHONE_ID`, `WA_VERIFY_TOKEN`) e atualiza diretamente o `STATUS_NS.json` via `motor_status_ns`. E um caminho independente do motor Node, voltado a transicao de status de NS por comando textual (ex.: `"NS003 executada"`), com endpoint de teste `/webhook/simular`.

---

### 2. Automacao n8n + Evolution API

Existe um segundo pipeline de WhatsApp, baseado em **n8n + Evolution API** (Baileys), totalmente desacoplado do motor Node. Entradas e saidas em JSON.

**`MEGA_ROUTER_WHATSAPP_SINISTRO.json`** — workflow de roteamento:
- Webhook `POST /whatsapp-master` recebe eventos da Evolution API.
- Um unico node `code` ("Processador Monolitico") faz: deduplicacao de eventos (`messages.update/delete`, `send.message` ignorados), extracao do texto (`conversation`, `extendedTextMessage`, `imageMessage.caption`), prevencao de loop do bot (ignora `fromMe` com assinatura "Construdata - powered by"), normalizacao de telefone BR (insercao do nono digito quando `length===12`), **lookup de contato no Supabase** (`/rest/v1/contatos`), e roteamento por comando (`menu`, `1`..`16`, atalhos `@rdo`/`@tarefa`/`@pagamento`/`@ia`) ou por **cargo** (diretor/master, eng/coord, demais). A resposta e enviada via `POST` ao endpoint Evolution `http://rk-evolution:8080/message/sendText/construdata-felipe`.
- **Achado de seguranca**: o workflow embute **credenciais em texto plano** no codigo do node — `SUPABASE_URL`/anon key JWT (`vblfdikfobsirwpdnybw.supabase.co`) e `EVOLUTION_API_KEY = 'construdata2026'`.

**`MEGA_SCHEDULED_JOBS_SINISTRO.json`** — jobs agendados:
- `scheduleTrigger` com cron `0 7 * * 1-6` (07h, segunda a sabado) dispara mensagens matinais de cobranca para listas hardcoded de `diretores` e `financeiros` (nomes + telefones), via Evolution API. Tambem expoe `EVOLUTION_API_KEY` em claro.

Ambos os workflows estao com `"active": false`. Os workflows versionados em `workflows/*/personal/*.workflow.ts` e em `n8n_local/exported_workflows/*.json` (familias `CONSTRUDATA_CODEX_*` e `CONSTRUDATA_CODEX2_*`) usam nodes `n8n-nodes-base.webhook`, `.httpRequest`, `.if` e `.code`, e referenciam consistentemente **Supabase** e **Evolution** como backends de dados e canal de saida.

O `n8n_local/` guarda dumps do schema PostgreSQL da Evolution (`evolution_schema_dump.sql` / `_utf8.sql`); o `evolution_config_dump.sql` na verdade contem um **log de erro do `pg_dump`** (regex de parenteses nao balanceados), util como nota de troubleshooting, mas nao e um dump valido.

---

### 3. Integracao Civil 3D — exporter .NET 8 e bundles

#### 3.1 Plugin `PipeNetworkExporter` (.NET 8 / Civil 3D 2026)

`civil3d_pipe_exporter/PipeNetworkExporter.cs` e um addin gerenciado registrado via `[assembly: ExtensionApplication]` + `[assembly: CommandClass]`, expondo o comando **`CD_EXPORT_PIPENET`**. Ele percorre `civilDocument.GetPipeNetworkIds()` dentro de uma transacao e serializa cada `Network`, com seus `Pipe` e `Structure`, capturando entre outros:

- **Pipes**: handle, nome, material, part family/size, style, estrutura inicial/final, `StartPoint`/`EndPoint` (X/Y/Z), `Length2D`/`Length3D` (e center-to-center), `Slope`, diametro interno/externo, **coeficiente de Manning** (`pipe.ManningCoefficient`, apenas quando `pipe.HasManningCoefficient`) e `CrossSectionalShape`.
- **Structures (PVs)**: location/easting/northing, `RimElevation`, `SumpElevation`, `SumpDepth`, diametro, contagem e nomes/handles dos pipes conectados, `StructureType`.

**Saidas** (gravadas em `<pasta_do_dwg>\_construdata_exports\` com timestamp `yyyyMMdd_HHmmss`):
- `*_pipe_network_export_*.json` (camelCase, UTF-8)
- `*_networks.csv`, `*_pipes.csv`, `*_structures.csv`

Detalhes de robustez: serializacao CSV culture-invariant (`0.############`, escape de aspas/virgulas), `SafeGet` para propriedades que podem lancar excecao (alignment/surface de referencia), e colecao de `Warnings` por pipe/structure que falha, sem abortar o export. Limitacao declarada: **le apenas Pipe Networks gravitacionais nativos — nao cobre pressure networks**.

`PipeNetworkExporter.csproj` referencia localmente `acmgd.dll`, `acdbmgd.dll`, `accoremgd.dll` (de `C:\Program Files\Autodesk\AutoCAD 2026`), `AeccDbMgd.dll` (de `...\C3D`) e `AecBaseMgd.dll`, com `<Private>false</Private>` (nao copia as DLLs do Autodesk) e um target `CheckAutodeskReferences` que falha o build com mensagem clara se algum caminho nao existir. O `build.ps1` baixa um SDK .NET 8 local (`.dotnet\`) quando necessario e copia a DLL/PDB para `bundle\PipeNetworkExporter.bundle\Contents\`; o `install-bundle.ps1` copia o bundle para `C:\ProgramData\Autodesk\ApplicationPlugins\`. O `PackageContents.xml` do bundle declara `Platform="Civil3D"`, `SeriesMin/Max="R25.1"` (Civil 3D 2026), `LoadOnRequest="True"`.

#### 3.2 Driver headless via COM — `scripts/exportar_pipe_network_oculto.py`

Orquestra o exporter sem interface: abre o AutoCAD/Civil 3D em **instancia oculta** via `win32com.client.DispatchEx`, resolve o ProgID pelo registro do Windows (`AutoCAD.Application\CurVer`, fallbacks `AutoCAD.Application.25.1`/`.25`/base), desativa dialogs (`FILEDIA=0`, `CMDDIA=0`, `EXPERT=5`), aguarda `GetAcadState().IsQuiescent`, da `_.NETLOAD "<dll>"` e dispara `CD_EXPORT_PIPENET`. A funcao `wait_for_export` faz **polling com verificacao de estabilidade de tamanho de arquivo** (snapshot + 2 s) e exige o grupo completo (`.json` + 3 CSVs) antes de declarar sucesso; timeouts default de 180 s (export) e 90 s (load). A DLL e localizada em `ProgramData\...\ApplicationPlugins\` ou na build local `bin\Release\`. O `scripts/extrair_pipe_network.py` envolve esse driver e oferece tambem o caminho **LandXML** (via `landxml_import`), normalizando ambos para o mesmo JSON/CSV.

#### 3.3 Importacao inversa e automacao GUI

- `scripts/importar_bim_civil3d.py`: via `comtypes.GetActiveObject("AutoCAD.Application")`, cria a camada `CONSTRUDATA`, desenha **circles verdes** para PVs (raio = diametro/2, em metros) com texto do nome, **lines cyan** para tubos com rotulo `DN<mm>`, e aplica `ZoomExtents`. Le BIM JSON com chaves `structures`/`pipes` (campos `x`, `y`, `rim_elevation`, `diameter_mm`, `start_structure`, `end_structure`).
- `automacao_civil3d.py`: dois metodos para criar Pipe Network a partir de `rede_dynamo.json` — (1) **direto via .NET interop** (`import clr` + `Autodesk.Civil...`), criando `Structure.ByPoint` com `RimElevation`/`SumpElevation` e `Pipe.ByStructures` com `NominalDiameter = dn_mm/1000`; (2) fallback **semi-automatico via Dynamo** com `pyautogui`/`pygetwindow`/`clipboard`, guiando o usuario por passos manuais.

#### 3.4 Bundle proprio `ConstruData.bundle`

`PackageContents.xml` do produto "ConstruData SABESP" v5.1.0 (FCN Construções e Saneamento / Felipe Nery), com `SupportedLocales="Ptb"`. Declara tres familias de componentes para Civil 3D: **2020–2024** (.NET 4.8, `dotnet_4/ConstruData_2020.dll`, `R23.0`–`R24.3`), **2025+** (.NET 8, `dotnet_8/ConstruData_2025.dll`, `R25.0`–`R26.0`) e **Dynamo Scripts** (`ConstruData.pkg.json`). Comandos expostos: `CONSTRUDATA`, `CONSTRUDATA_BATCH`, `CONSTRUDATA_QA`, mais CUIX. (Observacao: o `PackageContents.xml` referencia DLLs/CUIX/icone que nao estao presentes nesta arvore — apenas o manifesto foi versionado.) A `.sln` da raiz (`NOVA NS Versao 5.sln`) contem somente o projeto `civil3d_pipe_exporter`.

#### 3.5 Bundle de terceiros `C3DRENESG4.bundle` e seu port Python

Plugin comercial **C3DRENESG** (autor Neyton Luiz Dalle Molle, TBN2NET, "Urban Drain and Sewer Calculation", versao 9125.0.0), licenciado (inclui `CONTRATO DE LICENCA - PLUGINS TBN2NET.pdf`). Suporta Civil 3D 2014–2017 (`C3DRENESG4_2014.DLL`) e 2018–2022 (`C3DRENESG4_2018.DLL`) com dezenas de comandos (`C3DCalc`, `CALIN`, `CAREA`, `Cnum`, `Crecon`, `Creset`, etc.) e traz **catalogos de pipes/structures metricos** (PVC, PEAD, ADS, galerias circulares/retangulares, PV redondo/retangular, alas DER/DNIT). Inclui arquivos de calibracao `EQUACOES DE CHUVA.INI` e `SECOES DE SARJETAS.INI`.

`scripts/c3drenesg_port.py` e uma **reimplementacao Python do nucleo hidraulico/hidrologico** desse plugin (a camada de integracao Civil 3D continua presa as DLLs originais). Formulas/normas reais identificadas no codigo:

- **Equacoes de chuva IDF** por cidade, lidas do `.INI` e avaliadas com seguranca por `SafeExpression` (AST whitelisted, suporta `log/exp/sqrt`, `^`->`**`), com variaveis `Tr` (anos) e `Tc` (minutos).
- **Tempo de concentracao** (`Catchment`): metodos `tc_kerby`, `tc_kirpich` e `tc_kirpich_modified`, `tc_picking`, `tc_usce`, `tc_ven_te_chow`, `tc_passini`, `tc_ventura`, `tc_rossi`, `tc_giandotti`, `tc_tr55` — cada um com sua constante e expoentes proprios.
- **Projecao populacional**: `pop_arithmetic`, `pop_geometric` e `curve_log_raw`.
- **Hidraulica de Manning**: `hydraulic_result` e `circular_pipe_full_flow` aplicam a equacao de Manning `V = (Rh^(2/3) · S^(1/2)) / n` (e `Q = A·V`), com `n` por material das secoes de sarjeta e **`n = 0.013` default para tubo circular a secao plena**; `solve_depth_for_discharge` resolve a lamina por busca/bissecao para uma vazao alvo.

---

### 4. Integracao MCP Civil 3D

O ambiente de execucao expoe um servidor MCP **`civil3d`** com ferramentas para `pipe`, `alignment`, `surface`, `profile`, `corridor`, `point`, `geometry`, `drawing` e `health`. **Nao ha, porem, configuracao desse MCP versionada no projeto** (nenhum `mcp.json`/`.mcp` ou registro em `.claude/` aponta para ele); as referencias textuais a `civil3d_*` no repositorio sao apenas o pipeline `civil3d_pipe_exporter` e seus scripts COM/`NETLOAD` descritos acima. Ou seja, a automacao Civil 3D **do codigo do projeto** se da por DLL .NET + COM/Dynamo, e nao por MCP.

---

### 5. Infraestrutura Docker / VPS

Ha duas configuracoes distintas:

**Local isolado — `docker-compose.yml` (raiz).** Stack "NOVA NS v5" pensado para conviver com o ambiente web sem colisao de portas. Servicos e portas externas: PostgreSQL 16-alpine (`5433`), Redis 7-alpine (`6380`), n8n (`5679`), Evolution API `atendai/evolution-api` (`8081`), Portainer (`9001`/`9444`). Notas tecnicas: limites de memoria agressivos (RAM total alvo ~960 MB), `healthcheck` em Postgres/Redis com `depends_on: condition: service_healthy`, n8n com `N8N_RUNNERS_DISABLED=true` (comentario: "task runner causa crash loop") e poda de execucoes (`EXECUTIONS_DATA_PRUNE`, `MAX_AGE=168`); Evolution apontando para Postgres interno com `schema=evolution_ns5` e Redis com prefixo `ns5_evo`, transcricao de audio via `OPENAI_ENABLED=true`. Senhas estao hardcoded no compose (`Ns5Eng2026!SecurePass`, etc.).

**Producao VPS — `docker-infra/`.** Voltado a **Docker Swarm** sobre Oracle Cloud Free Tier (ARM) / Hetzner / Contabo, com **Traefik** (proxy reverso + SSL Let's Encrypt) e **Portainer** como deployer das demais stacks. `setup_vps.sh` instala Docker, faz `docker swarm init`, cria redes overlay `traefik_public` e `rk_internal`, prepara `/opt/rk-infra/{postgres_data,redis_data,n8n_data,evolution_*,portainer_data,traefik_data}` e faz `docker stack deploy` de Traefik e Portainer. As stacks individuais ficam em `docker-infra/stacks/`:

| Stack | Conteudo |
|---|---|
| `traefik.yml` | Proxy reverso + TLS (entrypoints `web`/`websecure`, certresolver letsencrypt) |
| `portainer.yml` | Gerenciador visual de containers |
| `postgres-redis.yml` | Banco + cache/fila |
| `n8n.yml` | n8n em **modo fila**: 3 replicas (`n8n_editor` start / `n8n_webhook` webhook / `n8n_worker` worker), `EXECUTIONS_MODE=queue` via Redis (Bull), Postgres como DB, `N8N_BASIC_AUTH_ACTIVE=true`, labels Traefik (Host `n8n.${DOMAIN}` + PathPrefix `/webhook`) |
| `evolution.yml` | Evolution API `atendai/evolution-api`: Postgres `schema=evolution`, Redis cache, `OPENAI_ENABLED=true`, label Traefik para `evolution.${DOMAIN}` |
| `chatwoot.yml` | Atendimento (opcional) |

`docker-infra/README.md` documenta o mapa de portas de referencia (PostgreSQL 5432, Redis 6379, n8n 5678, Evolution 8080, Portainer 9000, Chatwoot 3000, Traefik 80/443) e o fluxo "subir Traefik+Portainer -> deployar stacks pelo Portainer". O `.env.example` parametriza dominios, senhas de Postgres/Redis/n8n, `EVOLUTION_API_KEY`, SMTP, chaves de IA gratuitas (Groq, Gemini) e opcionais (OpenAI), e o Supabase ja existente. **Risco de seguranca**: o `.env.example` traz `SUPABASE_URL` real e defaults de senha; e a stack n8n/Evolution embute senhas-padrao no proprio YAML via `${VAR:-default}`.

---

### 6. Ferramenta de video — `tools/construdata_video_generator.py`

Gerador de frames com **Pillow** (`PIL.Image/ImageDraw/ImageFont`) para producao de animacao institucional/explicativa. Implementa helpers de desenho vetorial animado: `line`/`dashed` com `progress`, easing cubico (`ease`, `fade`), transformacao de coordenadas (`tx`), paleta fixa (fundo escuro `(8,18,34)`), carregamento de fontes do Windows (`consola.ttf`/`arial.ttf`) e saida em `outputs/`. Tem dependencia opcional de `subprocess` (provavel chamada a ffmpeg para montar o video a partir dos frames). E uma utilidade auxiliar, sem acoplamento ao nucleo de calculo.

---

### Notas transversais e riscos

- **Dois canais WhatsApp coexistem**: motor Node `whatsapp-web.js` (porta 8090, local, com caminhos hardcoded do dev) e pipeline Evolution API + n8n (containerizado). O webhook Meta Cloud API (`whatsapp_receiver.py`) e um terceiro caminho oficial. Nao ha um unico ponto de verdade.
- **Segredos em claro**: anon key do Supabase e `EVOLUTION_API_KEY=construdata2026` aparecem dentro dos JSON de workflow n8n; senhas hardcoded no `docker-compose.yml` local; dados pessoais (telefones de diretores/financeiro) embutidos nos jobs agendados.
- **Acoplamento Windows/Autodesk**: toda a automacao Civil 3D depende de COM/registro do Windows, DLLs proprietarias do AutoCAD 2026 (`<Private>false</Private>`) e instancias ocultas — nao roda em CI Linux. O exporter cobre apenas redes gravitacionais.
- O `evolution_config_dump.sql` e, na pratica, um log de erro de `pg_dump`, nao um dump utilizavel.

---

## Documentacao, Historico e Evolucao do Projeto

Esta seção documenta o acervo de documentação em Markdown da plataforma — a camada narrativa que registra o propósito, o histórico, as decisões de engenharia e a evolução do produto que internamente recebe os nomes "NOVA NS Versão 5" (motor de geração de Notas de Serviço) e "ConstruData - HydroNetwork" (plataforma BIM 6D). O acervo `.md` não é código executável, mas é a fonte canônica do conhecimento do projeto: ele descreve o contexto contratual, as fórmulas hidráulicas, as normas SABESP, os bugs corrigidos e a transição da ferramenta de um script monolítico para uma plataforma web modular com API.

### Propósito do subsistema de documentação

O conjunto de arquivos `.md` cumpre quatro papéis distintos:

1. **Manuais técnicos definitivos** — descrevem módulo a módulo, função a função, o código de produção (`MANUAL_DEFINITIVO_PLATAFORMA.md`, `FLUXOGRAMA_E_MANUAL_COMPLETO.md`, `MANUAL_CONSTRUDATA.md`, `ConstruData_HydroNetwork_Plataforma_Completa_V2.md`).
2. **Diários de evolução e changelogs** — registram o que mudou entre versões e por quê (`EVOLUCAO_VERSAO_5.md`, `EVOLUCAO_360_IMPLEMENTACAO_20260501.md`, `ATUALIZACAO_MOTOR_V5.md`, `CORRECOES_CONCLUIDAS_RESUMO.md`, `NS_V5_WEB_MIGRATION_20260501.md`).
3. **Análises e auditorias** — comparam a plataforma com softwares de referência e auditam aderência (`ANALISE_PROSANEAMENTO.md`, `ANALISE_SEWERCAD_COMPLETA.md`, `LOG_ADERENCIA_PLATAFORMA_20260328.md`, `ANALISE_SNAP_LLM1.md`).
4. **Instruções para agentes de IA / guias de uso** — orientam quem mantém o código (`CLAUDE.md`, `AGENTS.md`) e quem o opera (`COMO_USAR_MOTOR.md`, `BIM_IFC_GUIA_RAPIDO.md`, `COMO_ABRIR.md`, `COMO_CONFIGURAR_LLMs.md`).

**Volume do acervo:** uma contagem recursiva (`find . -name "*.md" | wc -l`) na raiz `NOVA NS Versao 5` retorna **1.070 arquivos `.md`** no total — número inflado por cópias dentro de `.claude/worktrees/`, pacotes `CONSTRUDATA_HYDRONETWORK_PLATAFORMA_COMPLETA*` redundantes e backups. Filtrando esses diretórios de backup/worktree restam **164 arquivos `.md`** de documentação efetiva, dos quais **96 estão na raiz do projeto**. Essa duplicação massiva é, em si, um indicador histórico: a plataforma foi empacotada e re-empacotada várias vezes (vide pastas `CONSTRUDATA_HYDRONETWORK_PLATAFORMA_COMPLETA`, `_1`, `_1_BACKUP`, `_2`, `CONSTRUDATA_HYDRONETWORK_V7_FINAL`).

### Contexto do projeto (contrato e atores)

Toda a documentação converge para um único projeto-âncora, descrito de forma consistente em `FLUXO_PLATAFORMA_ATUAL.md`, `ConstruData_HydroNetwork_Plataforma_Completa_V2.md` e `MANUAL_CONSTRUDATA.md`:

| Atributo | Valor documentado |
|----------|-------------------|
| Programa / obra | **SE LIGA NA REDE** |
| Contratante | **SABESP** (Companhia de Saneamento Básico do Estado de São Paulo) |
| Número do contrato | **CT 11481051** |
| Local | **Santos / SP** |
| Consórcio / executor | **SLNR Santos** (Consórcio SLNR — "Se Liga Na Rede"), pré-configurado no código via `criar_slnr_santos()` em `motor_contratos.py` |
| Empresa-marca atual | **FCN Construções e Saneamento** |
| Empresa-marca anterior | **FCN Construções e Saneamento** |
| Autor | **Felipe Nery** (assinatura explícita em `CORRECOES_CONCLUIDAS_RESUMO.md` e `ANALISE_PROSANEAMENTO.md`) |
| CRS padrão | **EPSG:31983** (SIRGAS 2000 / UTM 23S), datum vertical Imbituba-SC |

Um detalhe histórico relevante registrado pelos documentos é a **mudança de marca**: `ANALISE_PROSANEAMENTO.md` (20/03/2026) ainda é assinada como "Felipe Nery, FCN Construções e Saneamento", enquanto os documentos posteriores (`MANUAL_DEFINITIVO_PLATAFORMA.md`, `ConstruData_HydroNetwork_Plataforma_Completa_V2.md`, `MANUAL_CONSTRUDATA.md`) elevam a "Regra de Ouro / Regra Absoluta": **"NUNCA usar 'FCN Construções e Saneamento' em nenhum arquivo, output, variável, comentário ou interface — Empresa: FCN Construções e Saneamento"**. Essa regra inviolável aparece como item nº 1 das listas de "Regras Invioláveis" em três manuais distintos, evidenciando que a substituição de marca foi uma decisão consciente e enforçada a posteriori sobre uma base de código que originalmente usava o nome antigo.

### Os 6 núcleos da obra

A obra SE LIGA NA REDE é segmentada em núcleos (bairros/setores de Santos). A documentação (`MANUAL_DEFINITIVO_PLATAFORMA.md` seção "Redes Validadas", `ConstruData_HydroNetwork_Plataforma_Completa_V2.md` seção 6, `FLUXO_PLATAFORMA_ATUAL.md`) lista os **6 núcleos**: **São Manoel, João Carlos, Vila Criadores, Pantanal Baixo, Morro do Teteu (Verde e Teteu)** e **Vila Israel**. Os dados de execução diária cobrem `521 dias × 6 núcleos`. As redes processadas e validadas documentadas:

| Rede / Núcleo | Tipo | PVs | Trechos | Extensão | NS | Erros |
|---------------|------|-----|---------|----------|-----|-------|
| Pantanal Baixo | Esgoto | 165 | 137 | ~7.700 m | 137 | 0 |
| Verde e Teteu (Morro do Teteu) | Esgoto | 357 | 180 | 2.621 m | 180 | 0 |
| São Manoel | Esgoto | 20 | 16 | 1.275 m | 16 | 0 |
| Vila Criadores / Vila Israel / João Carlos | Esgoto | — | — | — | OK | 0 |
| Pantanal / Criadores / Teteu / Israel | Água | 348/122/337/812 | 372/130/346/861 | 6.986/4.138/4.813/11.509 m | — | 0 |
| Prolongamentos (Teteu Alt-01, Teteu, Pantanal, Criadores, São Manoel) | LandXML | 147/149/29/76/91 | 141/143/25/70/79 | 6.363/6.420/1.261/2.689/5.143 m | 489 | 0 |
| **TOTAL** | | **2.302+** | **2.094+** | **~39 km** | **836** | **0** |

O número-síntese repetido em quase todos os manuais é **"836 NS geradas, 0 erros, ~39 km de rede validada"** (em versões mais antigas como `FLUXO_PLATAFORMA_ATUAL.md` de 25/03/2026 o número era "905+ NS, ~37 km", evidenciando que o portfólio cresceu entre revisões).

### A evolução das versões (V4 → V5 → V6 → V7 → plataforma web)

A trajetória do produto, reconstruída a partir dos changelogs e manuais:

**Origem — script monolítico V4/V5:** o ponto de partida foi um único arquivo gigante, `construdata_sabesp_v5_FINAL.py`, com **~4.446-4.500 linhas** (`ANALISE_PROSANEAMENTO.md`, `ANALISE_SEWERCAD_COMPLETA.md`). A própria análise do SewerCAD (`ANALISE_SEWERCAD_COMPLETA.md`) propõe quebrar esse monólito em módulos (`core/extractor.py`, `core/snap.py`, `core/hydraulics.py`), refletindo a lição de "arquitetura modular" aprendida observando as DLLs separadas da Bentley.

**V4 → V5 (motor de leitura DXF):** documentado em `ATUALIZACAO_MOTOR_V5.md` (29/03/2026). A V4 "inventava tubos inexistentes" porque lia layers ambíguas (PONTOS-CAIXAS, PS_PERFIL_TUBO). A V5 introduziu o **filtro conservador** ("melhor perder do que inventar") em `ler_dxf_gdal.py`. Resultado comprovado no arquivo `TETÉU_ESGOTO22.dxf`:

| Métrica | V4 | V5 | Variação |
|---------|----|----|----------|
| Tubos lidos | 108 | 64 | −41% (menos invenção) |
| PVs | 51 | 57 | +12% |
| Trechos | 39 | 50 | +28% |
| Extensão | 611 m | 708 m | +16% |
| Ligações sem PV | 11 | 0 | −100% |

**V6.1 (otimização de motores):** `EVOLUCAO_VERSAO_5.md` registra a transição "NOVA NS Versao 5 → Versão 6.1 Otimizada", com três cirurgias: (1) substituição da heurística que "mockava XGBoost" por um surrogate real `lightgbm.LGBMRegressor` (`learning_rate=0.05`) em `motor_ml.py`; (2) paralelismo `concurrent.futures.ThreadPoolExecutor` em `processar_lote_dxf_ns.py` e `gerar_ns_v4.py`; (3) pré-compilação de regex como constantes globais (`_RE_DN = re.compile(...)`) em `ler_dxf_gdal.py` e `motor_auditoria_v4.py`.

**V7 (pacote final consolidado):** referenciado pelos diretórios `CONSTRUDATA_HYDRONETWORK_V7_FINAL/` e arquivos `PROMPT_CLAUDE_CODE_V7.md`. A versão V10 também é mencionada no rodapé de `ConstruData_HydroNetwork_Plataforma_Completa_V2.md` ("ConstruData - HydroNetwork v10"), indicando que a numeração da plataforma e a numeração do "NS" seguiram trilhas paralelas.

**Plataforma web (V5 Web / Evolução 360 — maio/2026):** a virada arquitetural mais recente, documentada em `NS_V5_WEB_MIGRATION_20260501.md` e `EVOLUCAO_360_IMPLEMENTACAO_20260501.md` (ambos 01/05/2026). A ferramenta deixou de ser apenas um GUI Tkinter desktop e ganhou uma camada **API FastAPI + frontend HTML**:

- `campo/ns_v5_web.py` — manifesto web dos 14 módulos do NOVA NS V5, com contratos de dados e snapshot único por projeto/núcleo (RDO, NS, planejamento, desvios, replanejamento, custos, logs, ML, BI).
- `api/routes_ns_v5.py` — endpoints REST: `GET /api/ns-v5/modules`, `/contracts`, `/projects`, `/projects/{id}/snapshot`, `/projects/{id}/modules/{key}`, `POST /projects/{id}/rdo/preencher-texto`, `POST /projects/{id}/ml/recalcular`.
- `html/construdata_ns_v5.html` — tela web `/ns-v5` que consome a API (sem chamar scripts soltos do Tkinter).
- `campo/evolucao_platform.py` + `api/routes_evolucao.py` — "Evolução 360", uma leitura operacional tipo Palantir: score de maturidade, predição determinística de risco, e ontologia operacional (`planejamento → RDO → desvio → ML → replanejamento`). Endpoints `GET /api/evolucao`, `/predicao`, `/ontologia`, `POST /api/evolucao/{nucleo}/executar-ciclo`.

Um detalhe notável de processo registrado em `EVOLUCAO_360_IMPLEMENTACAO_20260501.md`: a primeira versão criou uma tela HTML separada, que foi **removida** porque a diretriz era integrar o módulo dentro do GUI/shell ConstruData existente (`ui_construdata_modules.py`), não criar telas órfãs. Ambos os documentos de migração incluem seções explícitas de **rollback** (quais arquivos remover e quais linhas reverter em `api/server.py`), e validação por `python -m py_compile` + `TestClient`.

### Os números da plataforma (conforme manuais)

Os manuais reportam contagens que crescem ao longo do tempo (cada manual é um snapshot):

| Documento (data) | Scripts Python | Linhas Python | HTML | Linhas totais | Funções |
|------------------|----------------|---------------|------|---------------|---------|
| `MANUAL_CONSTRUDATA.md` (inicial) | 12 arquivos | 5.274 linhas | 3 HTML | 337 KB | — |
| `ConstruData_..._V2.md` (23/03) | 20 scripts | 7.851 | 6 HTML | ~13.223 | — |
| `FLUXOGRAMA_E_MANUAL_COMPLETO.md` (23/03) | 21 scripts | — | 7 HTML | 13.759 | 105+ |
| `MANUAL_DEFINITIVO_PLATAFORMA.md` (23/03) | 22 scripts | 9.761 | 7 HTML | 15.749 | 130+ |

Constantes compartilhadas por todos: **4 LLMs gratuitos** (Gemini, Groq, Mistral, Cohere), **18 estados** com CRS automático, **1 classe** (`PipeNetwork`, 18 métodos), **15+ formatos de saída**, **GUI desktop Tkinter** de 11→12 abas.

### Fórmulas, normas e parâmetros técnicos registrados na documentação

O acervo `.md` é a fonte autoritativa das fórmulas e normas. Os documentos citam de forma explícita:

- **Manning (escoamento à seção plena, esgoto)** — `gerar_ns.py`, `FLUXOGRAMA_E_MANUAL_COMPLETO.md`, `MANUAL_CONSTRUDATA.md`:
  - `V = (1/n) · Rh^(2/3) · I^(1/2)`
  - `Q = V · A · 1000` (L/s), com `A = π·(D/2)²`
  - `Rh = D/4` (seção plena circular)
  - **Tensão trativa** `τ = γ · Rh · I` com `γ = 9810 N/m³`, ou seja `τ = 9810 · Rh · I` (Pa)
  - Coeficientes `n`: PVC = 0,013; PEAD = 0,011; Concreto = 0,015
- **NBR 9649 (esgoto sanitário)** — `τ_min = 1.0 Pa` citada em `gerar_ns.py`.
- **Critérios hidráulicos de status** — `V ≥ 0,6 m/s` e `τ ≥ 1,0 Pa` para status "OK" (Tab 4 Hidráulica da GUI).
- **Metodologia IWA / UARL / ILI (perdas de água)** — `motor_perdas.py`, `FLUXOGRAMA_E_MANUAL_COMPLETO.md`:
  - `UARL = (18·rede_km + 0,8·n_conexões + 25·ramal_km) · pressão_mca`
  - `ILI = Perdas_Reais / UARL`, com classes A (<2), B (<4), C (<8), D (≥8)
- **NTS SABESP** — **NTS 292** (cadastro as-built georreferenciado, condição para pagamento — contrato pág. 64) e **NTS 116** (carimbo). O cadastro produz DXF R2010 com **17 layers NTS 292** em SIRGAS 2000 UTM 23S, com perfil longitudinal H 1:500 / V 1:100. A simbologia segue o padrão **SIGNOS** (círculo+cruz).
- **EPSG / CRS automático por estado** (`motor_contratos.py`): 31983 (SP/RJ/MG/DF/MA/PI — UTM 23S), 31982 (PR/SC/RS/GO/PA — 22S), 31984 (BA/CE/ES — 24S), 31985 (PE — 25S), 31981 (MT/MS — 21S), 31980 (AM — 20S).
- **Custos / BDI** — composição real do contrato de **R$ 805/m + BDI 25% = ~R$ 910/m** (8 itens: Escavação R$145, Tubo ESG R$240, Tubo AG R$95, PV R$120, Reaterro R$80, Ramal R$65, Pavimentação R$45, Sinalização R$15). Regra inviolável: usar a **tabela do contrato (R$ 910/m), NÃO SINAPI genérico** — embora os preços unitários tenham origem SINAPI/planilha `MESTRE_SLNR`.
- **BIM 6D (ciclo de vida / CO₂)**: PVC 50 anos / 3,2 kg CO₂/m; PEAD 100 anos / 2,8; Concreto 80 anos / 12,5; FFD 100 anos / 18.

### Comparação com ProSaneamento e SewerCAD (engenharia reversa documentada)

Dois documentos de análise registram a engenharia reversa que validou os parâmetros do código:

**`ANALISE_PROSANEAMENTO.md`** compara `construdata_sabesp_v5_FINAL.py` contra os arquivos `.DEF`/`.DAT` do software ProSaneamento (em `C:\pro_sane`). Veredito: **95% igual**. Confirma alinhamento de `LST_VALA.DEF` (largura vala 0,60 m, lastro 0,15 m, BDI 1,25), `DECL_ALT.MIN` (decl. mínima 0,002 m/m, prof. mínima 0,30 m), `GER_PERF.DEF` (escalas H/V 200, exagero 0,5), mapeamento OSE `DATOSE.DEF` (colunas B/D/F/.../AH) e o layout XDATA `PH_DATCNX` (reals[2]=prof, reals[3]=CF → **CT = CF + prof**, nunca reals[3] como CT) e `PH_DATTUB` (DN vem de strs[1], texto, não de reals[0]). Registra **um bug crítico**: o **Manning da água** estava `0,011` no ConstruData contra `0,003` do `PAR_ADD2.DAT` — diferença que invalida o cálculo hidráulico de água e cuja correção (`PEAD/PE80/PE100 = 0,003`) está documentada mas não necessariamente aplicada.

**`ANALISE_SEWERCAD_COMPLETA.md`** disseca o Bentley SewerCAD (DLLs Haestad: GVFSolver, HHSolver, SWMM5; storage SQLite `.stsw.sqlite`; UI DevExpress/Telerik) e extrai lições: arquitetura modular (separar motor de cálculo da UI), uso de banco de dados (o ConstruData mantém tudo em memória, dict/list, sem persistência), e múltiplos formatos I/O.

### As validações V001–V008 (NetworkX)

`FLUXO_PLATAFORMA_ATUAL.md` documenta o conjunto canônico de 8 validações topológico-hidráulicas executadas com NetworkX:

| Código | Validação | Código | Validação |
|--------|-----------|--------|-----------|
| **V001** | DN reduz (afogamento) | **V005** | profundidade < 0,30 m |
| **V002** | sifão (CF sobe) | **V006** | declividade < 0,2% |
| **V003** | partes desconectadas | **V007** | velocidade V < 0,6 m/s |
| **V004** | ciclos | **V008** | tensão trativa τ < 1,0 Pa |

`ANALISE_PROSANEAMENTO.md` confirma que essas validações (ciclos, sifões, afogamento, desconexões, V>5 m/s, τ extra) são **vantagem** do ConstruData sobre o ProSaneamento, que valida apenas profundidade e declividade mínimas.

### Bugs corrigidos e lições documentadas (tolerâncias de snap)

O tema recorrente e mais importante do histórico é a **eliminação da invenção de tubos**. Há uma evolução clara — e até uma contradição entre documentos que revela a linha do tempo:

- `CORRECOES_CONCLUIDAS_RESUMO.md` (27/03/2026) descreve uma fase em que a tolerância de snap foi **aumentada para 20 m** para suportar DXF/DWG multi-software (Civil 3D, QGIS, AutoCAD MEP), removendo o bloqueio do `PS_PONTOS`.
- `CLAUDE.md` e `AGENTS.md` (estado atual / "Token Economy Mode") documentam que **esse mesmo snap de 20 m era um bug crítico**: "o sistema importava a topografia inteira (casas/ruas) e 'inventava' tubos devido a uma tolerância de snap de 20 metros. **A tolerância foi reduzida para 3 m** e travamos a leitura apenas para camadas que contenham palavras-chave de rede (TUBO, REDE, ESGOTO etc.). Convertemos também instâncias de Arrays que davam erro no GeoPandas para `shapely.Point`."
- `COMO_USAR_MOTOR.md` e `ATUALIZACAO_MOTOR_V5.md` consolidam as tolerâncias finais: `TOL_CLUSTER = 3.0 m` (mesmo PV físico), `TOL_LABEL_PV = 15.0 m` (texto→PV), `TOL_TEXTO_TUBO = 30.0 m` (texto→tubo), `MIN_EXT_TUBO = 2.0 m`, `MIN_COORD_UTM = 100000` (rejeita coordenadas locais < 100 km). PVs sem texto viram **genéricos** marcados com `"_generico": True` (ex.: `PV_G44`).

Os **princípios de design** cristalizados pela documentação: (1) "Melhor perder do que inventar"; (2) "Topologia real > labels" (conectividade vem da geometria dos tubos, não dos textos); (3) "Transparência total" (PVs genéricos marcados); (4) "Universalidade" (qualquer DXF do ProSaneamento). A correção de DWG multi-software gerou um leitor independente `ler_dwg_universal.py` (métodos ODA File Converter, libredwg, fallback DXF) que **deliberadamente não mexe nos botões DWG existentes**.

### Auditoria de aderência (gap entre documentação e código)

O documento `LOG_ADERENCIA_PLATAFORMA_20260328.md` é uma autocrítica honesta e tecnicamente importante: audita a plataforma contra o `SUPERLOG_CANONICO_PLATAFORMA.md`. Veredito: **PARCIALMENTE ADERENTE**. A parte crítica (importação DXF ProSane) está conforme, mas registra que **o markdown canônico promete mais do que o pipeline central entrega**:

1. Entrada `.json` não está integrada em `construdata_pipeline.py` (só aceita `.xml`, `.dwg`, `.dxf`); o suporte a `.json` é condicional via GUI/legado.
2. A saída de NS do pipeline central (`gerar_ns()`) gera apenas PDF A4 em lote, não o pacote rico (PDF A3, satélite, HTML, JSON) que está em `processar_nucleo_from_data()` mas não é chamado pelo pipeline.
3. `gerar_xlsx.py` existe (geradores reais de Lean, Curva S, microplan, custos, hidráulica, perdas) mas não é chamado pelo pipeline central.
4. `ler_dwg_universal.py` existe mas o fluxo padrão ainda manda `.dwg` para `ler_dwg_aec()`.
5. A instrução `--gui` imprime "abra construdata_gui.html" quando a interface ativa é `construdata_gui.py`.

A recomendação explícita do log é **não reescrever o superlog canônico** com base na auditoria, mas usar o arquivo como registro de aderência e fechar os gaps no código primeiro. Esse documento é a melhor evidência de que a documentação da plataforma é em parte **aspiracional** (descreve o estado-alvo) e em parte **descritiva** (estado real), e que existe uma disciplina de auditoria para reconciliar os dois.

### Instruções para agentes de IA (CLAUDE.md / AGENTS.md)

`CLAUDE.md` e `AGENTS.md` são idênticos em conteúdo e estabelecem o "TOKEN ECONOMY MODE" para qualquer agente que mantenha o código. Suas regras (declaradas "LEIS"): (1) nunca varrer o repositório inteiro — ir direto ao arquivo-alvo, evitar `grep`/`find` recursivos pesados; (2) ser direto e gerar o mínimo de código; (3) não mexer em UI/UX de `construdata_gui.py` salvo pedido explícito — "o foco é a matemática, os motores e a geração das notas". Ambos reafirmam o contexto do bug de snap 20m→3m como leitura obrigatória.

### Tabela-resumo dos documentos mais importantes

| Documento | Conteúdo |
|-----------|----------|
| `MANUAL_DEFINITIVO_PLATAFORMA.md` | Manual mestre (23/03/2026). 22 scripts/9.761 linhas. Descreve módulo a módulo: leitores, 8 geradores, 7 motores, IA (4 LLMs), contratos, GUI 12 abas, 7 HTML, dados do contrato, 15 redes validadas, dependências e as 11 Regras Invioláveis. |
| `FLUXOGRAMA_E_MANUAL_COMPLETO.md` | Fluxograma ASCII completo (entradas → formato interno único → geradores/motores → 15+ saídas) + manual função-por-função com números de linha. Pipeline de 6 etapas. Contagem final 13.759 linhas. |
| `FLUXO_PLATAFORMA_ATUAL.md` | Estado validado em 25/03/2026. Fonte canônica das validações **V001–V008** (NetworkX). Estrutura de pastas de saída (`01_NS_CAMPO`...`07_LOG`). Fluxo do DWG BIM (win32com → Civil 3D → fallback DXF). |
| `ConstruData_HydroNetwork_Plataforma_Completa_V2.md` | Guia definitivo para Claude Code/VS Code (23/03/2026). Inventário dos 20 scripts + 6 HTML, formato interno `pvs+trechos`, constantes do contrato, integração dos 4 LLMs com URLs e limites, checklist de testes e estrutura de pastas recomendada. |
| `MANUAL_CONSTRUDATA.md` | Manual + prompt de continuidade. Fluxograma do ciclo de vida da obra (Projeto→Campo→Escritório→SABESP), cálculos (Manning, Custo 5D, geometria IFC), DNs suportados, roadmap "A Construir". |
| `EVOLUCAO_VERSAO_5.md` | Changelog V5 → V6.1. Substituição de XGBoost mockado por `lightgbm.LGBMRegressor` real, paralelismo `ThreadPoolExecutor`, regex pré-compilados. |
| `ATUALIZACAO_MOTOR_V5.md` | Changelog do motor de leitura V4 → V5 (29/03/2026). Filtro conservador de layers, PVs genéricos, validação UTM, resultados comprovados no TETÉU (−41% tubos inventados). |
| `CORRECOES_CONCLUIDAS_RESUMO.md` | Correção DXF/DWG multi-software (27/03/2026, autor Felipe Nery). Snap 20m, `ler_dwg_universal.py`, ferramentas de diagnóstico. Registra o estado anterior à redução para 3m. |
| `EVOLUCAO_360_IMPLEMENTACAO_20260501.md` | Módulo "Evolução 360" (Palantir-like): score de maturidade, ontologia operacional, rotas `/api/evolucao`. Inclui rollback. |
| `NS_V5_WEB_MIGRATION_20260501.md` | Migração para web: camada `ns-v5`, 14 módulos com manifesto/contratos, API FastAPI, tela `/ns-v5`. Endpoints e rollback. |
| `LOG_ADERENCIA_PLATAFORMA_20260328.md` | Auditoria de aderência código-vs-documentação. Veredito "PARCIALMENTE ADERENTE": 5 gaps no pipeline central (`.json`, NS rica, XLSX, DWG universal, `--gui`). |
| `ANALISE_PROSANEAMENTO.md` | Engenharia reversa vs ProSaneamento (`.DEF`/`.DAT`). 95% igual. Bug crítico Manning água 0,011 vs 0,003. Mapeamento OSE/XDATA validado. |
| `ANALISE_SEWERCAD_COMPLETA.md` | Engenharia reversa do Bentley SewerCAD (DLLs Haestad, SQLite). Lições: modularização, banco de dados, formatos I/O. |
| `BIM_IFC_GUIA_RAPIDO.md` | Guia operacional BIM/IFC e automação Civil 3D 2025.1+. Geração de IFC LOD500, visualizadores (Solibri/BIMvision/Navisworks), troubleshooting de CRS incompatível e snap. |
| `COMO_USAR_MOTOR.md` | Guia rápido do motor de extração TETÉU. Tolerâncias (cluster 3m, label 15m, tubo 30m), proteções contra invenção, exemplos de uso e validação. |
| `CLAUDE.md` / `AGENTS.md` | Instruções para agentes de IA ("Token Economy Mode"). Contexto do bug de snap 20m→3m, regras de economia de tokens, foco em motores/matemática/notas. |

### Dependências e formatos (conforme documentação)

Os manuais listam o stack Python documentado: **core** (`geopandas`, `pyogrio`, `shapely`, `scipy`, `ezdxf`, `pyproj`, `numpy`, `networkx`); **BIM** (`ifcopenshell`); **relatórios** (`reportlab`, `openpyxl`, `matplotlib`); **GUI** (`tkintermapview`, `contextily`); **LLMs** (`google-genai`, `groq`, `mistralai`, `cohere`); **ML** (`lightgbm`/XGBoost); **web** (FastAPI, na fase de migração). DWG depende de `libredwg` ou ODA File Converter. **Formatos de entrada**: DXF (ProSaneamento), DWG (Civil 3D/AEC), LandXML 1.2, JSON, PDF (lido via Gemini), Foto (RDO via Gemini). **Formatos de saída**: PDF (A4/A3), HTML (Leaflet/Three.js), GeoJSON, DXF (NTS 292), IFC 2x3 (LOD 500), LandXML, MS Project XML, Primavera P6 XER, OpenProject CSV, XLSX, CSV, JSON, ZIP (contrato portável), `.py` (Dynamo), `.scr` (AutoCAD).

### Notas finais sobre o acervo

O acervo documental é volumoso e parcialmente redundante (1.070 cópias `.md` no disco, dominadas por backups e worktrees), com snapshots datados que permitem reconstruir a linha do tempo com precisão (20/03 → 23/03 → 25/03 → 27/03 → 28/03 → 29/03 → 01/05/2026). Os documentos não são perfeitamente consistentes entre si — divergem em contagens de scripts (12/20/21/22), de linhas (5.274 a 15.749) e até em parâmetros (snap 20m vs 3m, Manning água 0,011 vs 0,003) — mas essas próprias divergências são o registro fiel da evolução: cada manual congela um estágio diferente do produto. O `LOG_ADERENCIA_PLATAFORMA_20260328.md` é o documento que melhor explicita a disciplina do projeto de separar "o que a plataforma promete" de "o que o pipeline central realmente executa", recomendando alinhar o código antes de reescrever a documentação canônica.

---

## Notas Finais

- Este super markdown foi produzido lendo o codigo-fonte real de cada subsistema; afirmacoes tecnicas (formulas de Manning, validacoes V001-V008, layout de XDATA, tolerancias de snap, normas SABESP NTS 292, EPSG:31983) refletem o que esta implementado nos arquivos citados.
- Onde a base documental diverge (ex.: razao social FCN vs. FCN), o texto sinaliza a divergencia.
- Arquivo de saida: `SUPER_MARKDOWN_NOVA_NS_V5.md` na raiz do projeto.
