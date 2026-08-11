# CONSTRUDATA - HydroNetwork
# FLUXOGRAMA + MANUAL COMPLETO
## FCN Construcoes e Saneamento · Marco 2026

---

# PARTE 1 — FLUXOGRAMA GERAL

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
║ L:328    ║ L:316    ║ L:267    ║          ║ L:562    ║ L:1054    ║        ║
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
║PipeNet  ║ ║ (8)     ║ ║ (9)     ║ ║ (4)     ║ ║CONTRATO ║ ║ 12 tabs ║
║mover PV ║ ║NS       ║ ║Custo    ║ ║Gemini   ║ ║multi-ct ║ ║Tkinter  ║
║→recalc  ║ ║Civil3D  ║ ║Medicao  ║ ║Groq     ║ ║precos   ║ ║+6 HTML  ║
║TUDO     ║ ║NTS292   ║ ║ML       ║ ║Mistral  ║ ║nucleos  ║ ║         ║
║cascata  ║ ║IFC      ║ ║Lean/LPS ║ ║Cohere   ║ ║CRS auto ║ ║         ║
║         ║ ║Project  ║ ║MicroPlan║ ║         ║ ║18 UFs   ║ ║         ║
║         ║ ║CronoMac ║ ║Perdas   ║ ║         ║ ║         ║ ║         ║
║         ║ ║PdfPerd  ║ ║Gemini   ║ ║         ║ ║         ║ ║         ║
║         ║ ║Pipeline ║ ║Multi-LLM║ ║         ║ ║         ║ ║         ║
╚═════════╝ ╚════╦════╝ ╚════╦════╝ ╚════╦════╝ ╚════╦════╝ ╚════╦════╝
                 │           │           │           │           │
                 ▼           ▼           ▼           ▼           ▼
╔══════════════════════════════════════════════════════════════════════════════╗
║                              SAIDAS (15+ formatos)                         ║
╠═══════════╦═══════════╦═══════════╦═══════════╦═══════════╦════════════════╣
║ PDF A4    ║ LandXML   ║ IFC 2x3   ║ MS Project║ PDF       ║ JSON/CSV      ║
║ NS campo  ║ Civil 3D  ║ LOD 500   ║ XML       ║ Perdas    ║ Dados         ║
║           ║           ║           ║           ║           ║               ║
║ HTML      ║ DXF       ║ CSV       ║ P6 XER    ║ BM        ║ GeoJSON       ║
║ Leaflet   ║ NTS 292   ║ LOD 500   ║ Primavera ║ Medicao   ║ Rede          ║
║           ║           ║           ║           ║           ║               ║
║ PDF A3    ║ Dynamo.py ║ JSON BIM  ║ CSV       ║ Curva S   ║ ZIP           ║
║ Sat+Perfil║ Script    ║ 5D        ║ OpenProj  ║           ║ Portabilidade ║
║           ║           ║           ║           ║           ║               ║
║           ║ .SCR      ║           ║ JSON      ║ Lookahead ║               ║
║           ║ AutoCAD   ║           ║ Dados     ║ 6 semanas ║               ║
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
│                                  │
│ .dxf → ler_dxf_gdal()           │  GDAL + scipy clustering
│ .xml → ler_landxml()            │  ElementTree direto
│ .dwg → ler_dwg_aec()           │  libredwg → DXF → parse
│ .json → json.load()             │  Formato interno
│ .pdf → motor_gemini.ler_pdf()   │  Gemini Flash vision
│                                  │
│ SAIDA: pvs + trechos + ruas     │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 2: NOTAS DE SERVICO        │
│ gerar_ns.py                      │
│                                  │
│ enriquecer_trechos()             │  Manning V/Q/tau por trecho
│ Para cada trecho:                │
│   gerar_ns_a4()     → PDF A4    │  Nota de servico campo
│   gerar_ns_desenho()→ PDF A3    │  Planta + perfil + satelite
│   gerar_html()      → HTML      │  Mapa Leaflet interativo
│ gerar_geojson()     → GeoJSON   │  Rede completa
│                                  │
│ SAIDA: 01_NS/ (1 pasta/trecho)  │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 3: CIVIL 3D                │
│ gerar_civil3d.py                 │
│                                  │
│ gerar_landxml()      → XML      │  Import no Civil 3D
│ gerar_cadastro_dxf() → DXF      │  1 folha A4/rua (NTS0292)
│ gerar_dynamo_script()→ .py      │  Cria Pipe Network via API
│ gerar_autocad_scr()  → .scr     │  Desenha sem Civil 3D
│ gerar_json_dados()   → JSON     │  Dados completos
│                                  │
│ SAIDA: 02_CIVIL3D/              │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 4: CADASTRO AS-BUILT       │
│ gerar_cadastro_nts292.py         │
│                                  │
│ _setup_doc()         → DXF R2010│  17 layers NTS 292
│ _draw_pv_symbol()    → Simbolos │  Circulo+cruz SIGNOS
│ _draw_tubo()         → Rede     │  DN+material+decl+ext
│ _draw_perfil()       → Perfil   │  H 1:500 / V 1:100
│ _draw_carimbo_sabesp()→ Carimbo │  NTS 116 SABESP
│ _draw_coord_grid()   → Grade    │  UTM cada 100m
│                                  │
│ SAIDA: 03_CADASTRO_NTS292/      │
│   DXF georref + Meta JSON       │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 5: BIM LOD 500             │
│ gerar_ifc_lod500.py              │
│                                  │
│ Tubos: IfcSweptDiskSolid        │  Cilindro oco (DN/2, 0.9)
│ PVs:   IfcExtrudedAreaSolid     │  Cilindro (r=0.6/0.3m)
│ Props: Dados_Tecnicos           │  PV, DN, material, ext
│        SABESP_Hidraulica        │  V, Q, tau, Manning
│        Custo5D                  │  8 itens + BDI + total
│        Dados_PV                 │  CT, CF, prof, E, N
│                                  │
│ SAIDA: 04_BIM_LOD500/           │
│   IFC 2x3 + CSV + JSON         │
└────────────┬─────────────────────┘
             │
             ▼
┌──────────────────────────────────┐
│ ETAPA 6: CRONOGRAMA              │
│ gerar_project_xml.py             │
│                                  │
│ 12 fases WBS:                    │
│  1. Mobilizacao          5d     │
│  2. Topografia      ext/200/2   │
│  3. Escavacao        ext/30/2   │
│  4. Assentamento     ext/40/2   │
│  5. PVs/PIs        pvs/0.5/2   │
│  6. Reaterro         ext/50/2   │
│  7. Pavimentacao     ext/60/2   │
│  8. Ligacoes Pred.  pvs/3/2    │
│  9. Testes          ext/200     │
│ 10. Cadastro NTS   folhas/2    │
│ 11. BIM LOD 500    trechos/10  │
│ 12. Desmobilizacao       3d     │
│                                  │
│ SAIDA: 05_CRONOGRAMA/           │
│   MS Project XML + JSON         │
└──────────────────────────────────┘
```

---

# PARTE 3 — MANUAL COMPLETO FUNCAO POR FUNCAO

---

## MODULO 1: ler_dxf_gdal.py (328 linhas)
**Funcao:** Le DXF do ProSaneamento via GDAL/OGR com topologia por clustering

| Funcao | Linha | O que faz | Entrada | Saida |
|--------|-------|-----------|---------|-------|
| `_log(msg, nivel)` | 39 | Log com timestamp | msg, nivel | print |
| `_parse_dn(txt)` | 45 | Extrai DN de texto | "200mm" ou "DN200" | int (200) ou None |
| `_parse_incl(txt)` | 53 | Extrai declividade | "0.008 m/m" ou "0.8%" | float (0.008) |
| `_nearest_text(mx,my,xy,txt,max_d)` | 61 | Acha texto mais proximo | coord + array | str ou None |
| `_agrupar_textos_pv(pv_data)` | 68 | Agrupa PV/CT/CF por proximidade | lista (x,y,txt) | dict {nome: {ct,cf}} |
| `ler_dxf_gdal(dxf_path)` | 110 | **PRINCIPAL** Le DXF completo | caminho .dxf | (pvs, trechos, ruas, meta) |

**Fluxo interno de `ler_dxf_gdal()`:**
1. `geopandas.read_file(dxf, layer="entities")` → GeoDataFrame
2. Filtra layers TUBO_* (exclui PS_, DETALHE, PERFIL, BIFILAR)
3. Calcula `ext_m` por geometria, filtra > 2m
4. Extrai endpoints de cada tubo → array numpy
5. `fclusterdata(endpoints, t=2.0)` → cada cluster = 1 PV real
6. Le PS_PONTOS_IDENTIFICACAO_TXT → nomes + CT/CF
7. Match cluster → texto mais proximo (< 20m)
8. Conectividade: tubo[i] liga cluster[2i] → cluster[2i+1]
9. Le DN de PS_IND_DIAMETRO, inclinacao de PS_IND_INCLINACAO
10. Dedup bidirecional: `tuple(sorted([pv_ini, pv_fim]))`

---

## MODULO 2: ler_landxml.py (267 linhas)
**Funcao:** Le LandXML 1.2 exportado do Civil 3D

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `ler_landxml(xml_path)` | 18 | **PRINCIPAL** Parseia XML, retorna (pvs, trechos, ruas, meta) |

**Fluxo interno:**
1. `ET.parse(xml_path)` → arvore XML
2. Detecta namespace automatico (`{http://...}` ou vazio)
3. Itera `<Struct>` → PVs: name, elevRim(CT), elevSump(CF), Center(N E)
4. Itera `<Pipe>` → Trechos: refStart, refEnd, length, slope, CircPipe(diam, material)
5. Se length=0, recalcula por distancia PVs
6. Dedup bidirecional

---

## MODULO 3: ler_dwg_aec.py (316 linhas)
**Funcao:** Le DWG Civil 3D com objetos AEC Proxy

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `_log(msg, level)` | 34 | Log |
| `_converter_dwg_para_dxf(dwg_path)` | 38 | Chama libredwg dwg2dxf |
| `_extrair_pvs_de_dxf(dxf_path)` | 69 | Parseia textos PV/CT/CF |
| `_reconstruir_rede(pvs, dn_padrao, max_ext)` | 156 | Topologia por sequencia de nomes |
| `ler_dwg_aec(path, dn_padrao)` | 227 | **PRINCIPAL** DWG → pvs + trechos |

---

## MODULO 4: gerar_ns.py (548 linhas)
**Funcao:** Gera Notas de Servico (PDF + JSON + HTML + GeoJSON)

| Funcao | Linha | O que faz | Saida |
|--------|-------|-----------|-------|
| `log(msg, nivel)` | 54 | Log | print |
| `calc_manning(dn_mm, decl_mm)` | 63 | Manning secao plena | {v_ms, q_ls, tau_pa} |
| `enriquecer_trechos(trechos, pvs)` | 77 | Adiciona Manning + cotas a cada trecho | trechos modificados |
| `_get_transformer()` | 97 | Lazy load pyproj 31983→4326 | Transformer |
| `to_ll(x, y)` | 107 | UTM → lat/lon | (lat, lon) |
| `gerar_ns_a4(ns_id, trecho, pvs, nucleo, out_path)` | 119 | PDF A4 nota de servico | PDF |
| `gerar_ns_desenho(ns_id, trecho, pvs, all_trechos, nucleo, out_path)` | 220 | PDF A3 planta + perfil + satelite | PDF |
| `gerar_html(ns_id, trecho, pvs, all_trechos, nucleo, out_path)` | 323 | HTML Leaflet interativo | HTML |
| `gerar_geojson(trechos, pvs, out_path)` | 399 | GeoJSON LineString | .geojson |
| `processar_nucleo(dxf_path, nucleo, out_base)` | 421 | Pipeline completo 1 nucleo | (n_ok, n_err) |

**Calculo Manning:**
```
V = (1/n) * Rh^(2/3) * I^(1/2)
  n: PVC=0.013, PEAD=0.011, Concreto=0.015
  Rh = D/4 (secao plena circular)
  I = declividade m/m
Q = V * A * 1000 (L/s)
  A = pi * (D/2)^2
tau = 9810 * Rh * I (Pa)
  tau_min = 1.0 Pa (NBR 9649 esgoto)
```

---

## MODULO 5: gerar_civil3d.py (312 linhas)
**Funcao:** Pacote completo para Civil 3D

| Funcao | Linha | Saida |
|--------|-------|-------|
| `gerar_landxml(pvs, trechos, nucleo, out_path)` | 50 | LandXML 1.2 (.xml) |
| `_setup_layers(doc)` | 216 | Layers NTS0292 no DXF |
| `_draw_carimbo(msp, info, x0, y0, w, h)` | 240 | Carimbo SABESP |
| `_draw_rede_planta(msp, pvs, trechos, bounds)` | 288 | Rede na planta (auto-escala) |
| `gerar_cadastro_dxf(pvs, trechos, nucleo, out_dir)` | 378 | 1 DXF A4/rua |
| `gerar_dynamo_script(pvs, trechos, nucleo, out_path)` | 460 | Script Python Dynamo |
| `gerar_autocad_scr(pvs, trechos, nucleo, out_path)` | 631 | Script .scr AutoCAD |
| `gerar_json_dados(pvs, trechos, nucleo, out_path)` | 694 | JSON completo |

---

## MODULO 6: gerar_cadastro_nts292.py (458 linhas)
**Funcao:** Cadastro as-built georeferenciado NTS 292 SABESP

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `_setup_doc()` | 58 | Cria DXF R2010 com 17 layers NTS 292 |
| `_draw_pv_symbol(msp, x, y, nome, ct, cf, prof)` | 74 | Simbolo PV SIGNOS (circulo+cruz) |
| `_draw_tubo(msp, x0, y0, x1, y1, dn, mat, decl, ext)` | 108 | Linha + texto (DN MAT i=X L=Xm) |
| `_draw_perfil(msp, trechos, pvs, ox, oy)` | 134 | Perfil longitudinal H:500 V:100 |
| `_draw_carimbo_sabesp(msp, x, y, info)` | 255 | Carimbo NTS 116 |
| `_draw_coord_grid(msp, xmin, ymin, xmax, ymax, step)` | 305 | Grade UTM cada 100m |
| `gerar_cadastro_nts292(pvs, trechos, nucleo, out_dir)` | 329 | **PRINCIPAL** DXF + JSON |

---

## MODULO 7: gerar_ifc_lod500.py (184 linhas)
**Funcao:** IFC 3D real com geometria LOD 500

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `_calc_manning(dn_mm, decl_mm, material)` | 35 | Manning por material |
| `_calc_custo(tr, pvs, custos)` | 41 | Custo 5D (8 itens) |
| `_gerar_ifc_real(pvs, trechos, nucleo, ifc_path)` | 52 | **Geometria 3D:** SweptDiskSolid + ExtrudedAreaSolid |
| `gerar_ifc_lod500(pvs, trechos, nucleo, out_dir)` | 151 | **PRINCIPAL** IFC + CSV + JSON |

---

## MODULO 8: gerar_project_xml.py (276 linhas)
**Funcao:** Cronograma MS Project 2016+

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `_add_task(parent, uid, name, start, duration_days)` | 52 | Adiciona tarefa ao XML |
| `gerar_project_xml(pvs, trechos, nucleo, out_dir)` | 91 | **PRINCIPAL** WBS 12 fases |

---

## MODULO 9: gerar_cronograma_macro.py (414 linhas)
**Funcao:** Cronograma multinucleo em 4 formatos

| Funcao | Linha | O que faz | Saida |
|--------|-------|-----------|-------|
| `_dias_uteis(data_inicio, n_dias)` | 50 | Calcula data fim | date |
| `gerar_cronograma_nucleo(nome, ext, n_tr, data, eq)` | 61 | WBS 1 nucleo | list fases |
| `gerar_cronograma_macro(nucleos, data_inicio_str)` | 97 | WBS todos nucleos | dict |
| `exportar_project_xml(wbs, path)` | 162 | MS Project XML | .xml |
| `exportar_primavera_xer(wbs, path)` | 236 | Oracle Primavera P6 | .xer |
| `exportar_openproject_csv(wbs, path)` | 311 | OpenProject | .csv |
| `gerar_tudo(nucleos, data_inicio, out_dir)` | 357 | **PRINCIPAL** 4 formatos | (wbs, paths) |

---

## MODULO 10: gerar_pdf_perdas.py (314 linhas)
**Funcao:** Relatorio PDF profissional de perdas

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `_cor(hex_str)` | 17 | Converte hex → Color ReportLab |
| `gerar_pdf_perdas(relatorio, out_path, nucleo)` | 30 | **PRINCIPAL** PDF com 5 secoes |

---

## MODULO 11: construdata_pipeline.py (203 linhas)
**Funcao:** Orquestrador — detecta formato e roda tudo

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `run_pipeline(input_path, nucleo, out_dir, data_inicio)` | 33 | **PRINCIPAL** 6 etapas automaticas |
| `main()` | 173 | CLI argparse |

---

## MODULO 12: motor_custo.py (297 linhas)
**Funcao:** Custos reais do contrato (R$ 910/m com BDI 25%)

| Funcao | Linha | O que faz | Saida |
|--------|-------|-----------|-------|
| `custo_trecho(tr, pvs, tabela)` | 104 | Custo detalhado 1 trecho | dict 8 itens |
| `custo_nucleo(pvs, trechos, nucleo, tabela)` | 194 | Custo total nucleo | dict |
| `gerar_bm(trechos_exec, pvs, periodo, bm_num)` | 230 | Boletim de Medicao | dict |
| `importar_tabela_precos(path)` | 260 | Importa CSV/JSON precos | dict |

**Composicao R$/metro:**
```
Escavacao:      R$ 145/m
Tubo ESG:       R$ 240/m
Tubo AG:        R$  95/m
PV/Caixas:      R$ 120/m
Reaterro:       R$  80/m
Ramal:          R$  65/m
Pavimentacao:   R$  45/m
Sinalizacao:    R$  15/m
─────────────────────────
Subtotal:       R$ 805/m
BDI 25%:        R$ 105/m
TOTAL:          R$ 910/m
```

---

## MODULO 13: motor_medicao.py (269 linhas)
**Funcao:** Acompanhamento de execucao e medicao

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `carregar_execucao_xlsx(path)` | 21 | Le Excel execucao diaria |
| `carregar_execucao_json(path)` | 54 | Le JSON execucao |
| `gerar_resumo_execucao(dados_exec)` | 60 | Resumo por nucleo e mes |
| `gerar_curva_s(trechos, dados_exec, custo_metro)` | 97 | Curva S previsto x realizado |
| `vincular_ns_execucao(trechos, dados_exec)` | 155 | Vincula NS com status real |
| `gerar_boletim_medicao(trechos_exec, pvs, periodo, bm_num)` | 178 | BM formal |
| `gerar_acompanhamento_semanal(dados, sem_ini, sem_fim)` | 231 | Producao semanal |

---

## MODULO 14: motor_ml.py (247 linhas)
**Funcao:** Machine Learning — previsao de producao

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `prever_producao(dados_exec, dias_futuro)` | 67 | XGBoost rolling_3 → previsao |
| `analisar_gargalos(dados_exec)` | 140 | Pipeline 11 etapas + gargalos |
| `simular_cenario(cenario_idx, saldo_total_m, custo_metro)` | 171 | 5 cenarios aceleracao |
| `gerar_relatorio_ml(dados_exec, saldo_total_m)` | 193 | **PRINCIPAL** Relatorio completo |

**Pipeline 11 etapas (gargalos identificados):**
```
1. Projeto           10d → 5d  [GARGALO]
2. Aprovacao          5d → 3d
3. Planejamento       3d → 2d
4. Escavacao          5d → 3d
5. Assentamento       5d → 3d
6. Execucao Rede     15d → 8d  [GARGALO]
7. Reaterro           3d → 2d
8. Lavagem+Colif.     7d → 3d  [GARGALO]
9. Cadastro           5d → 3d
10. Liberacao SABESP  15d → 7d  [GARGALO]
11. Ligacao            3d → 2d
─────────────────────────────
TOTAL:               76d → 40d
```

---

## MODULO 15: motor_lean_lps.py (475 linhas)
**Funcao:** Lean Construction + Last Planner System + BIM 6D

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `calcular_6d_trecho(tr, pvs, custo_impl, data_exec)` | 52 | Ciclo vida 50 anos + CO2 |
| `gerar_6d_nucleo(pvs, trechos, nucleo)` | 82 | Resumo 6D nucleo |
| `calcular_takt_time(trechos, equipes, dias_uteis_mes)` | 134 | Takt, cycle time, throughput |
| `mapear_fluxo_valor(trechos, dados_exec)` | 159 | Value Stream Mapping |
| `criar_weekly_work_plan(ns_list, semana, equipes)` | 204 | Plano semanal LPS |
| `calcular_ppc(ns_planejadas, ns_executadas)` | 253 | Percent Plan Complete |
| `analisar_razoes_nao_conclusao(historico_semanas)` | 292 | Pareto nao-conclusao |
| `gerar_lookahead(ns_list, semanas, equipes)` | 330 | Lookahead 6 semanas |
| `gerar_relatorio_lean_lps(pvs, trechos, dados_exec, nucleo)` | 381 | **PRINCIPAL** |
| `get_6d_properties(material, ext_m, custo_impl)` | 423 | PropertySet IFC 6D |

**BIM 6D — Vida util:**
```
PVC:      50 anos | 0.5% manut/ano | 3.2 kg CO2/m  | Reciclavel: sim
PEAD:    100 anos | 0.3% manut/ano | 2.8 kg CO2/m  | Reciclavel: sim
Concreto: 80 anos | 1.0% manut/ano | 12.5 kg CO2/m | Reciclavel: nao
FFD:     100 anos | 0.2% manut/ano | 18.0 kg CO2/m | Reciclavel: sim
```

---

## MODULO 16: motor_parametrico.py (318 linhas)
**Funcao:** Rede parametrica com recalculo em cascata

| Classe/Funcao | Linha | O que faz |
|---------------|-------|-----------|
| `class PipeNetwork` | 26 | Classe principal |
| `__init__(pvs, trechos)` | 32 | Construtor + grafo adjacencia |
| `_build_graph()` | 39 | Constroi dict adjacencia PV→[trechos] |
| `mover_pv(nome, x, y)` | 50 | Move PV → recalcula ext+decl+Manning+custo |
| `alterar_cota(nome, ct, cf)` | 65 | Muda CT/CF → recalcula prof+decl |
| `alterar_dn(trecho_idx, dn)` | 87 | Muda DN → recalcula Manning |
| `alterar_material(trecho_idx, mat)` | 97 | Muda material → recalcula Manning (n diferente) |
| `adicionar_pv(nome, x, y, ct, cf, tipo)` | 107 | Novo PV |
| `remover_pv(nome)` | 113 | Remove PV + trechos conectados |
| `adicionar_trecho(pv_ini, pv_fim, dn, mat, tipo)` | 123 | Novo trecho |
| `remover_trecho(trecho_idx)` | 134 | Remove trecho |
| `_recalc_trecho(idx)` | 146 | **CORE** Recalcula 1 trecho (ext, decl, Manning, custo) |
| `_recalc_all()` | 203 | Recalcula todos |
| `resumo()` | 212 | Stats da rede |
| `trechos_com_alerta()` | 225 | Lista alertas hidraulicos |
| `vizinhos(pv_nome)` | 229 | PVs conectados |
| `exportar()` | 240 | → JSON padrao |
| `from_json(data)` | 253 | ← JSON |
| `from_leitor(leitor_func, path)` | 258 | ← Qualquer leitor |

---

## MODULO 17: motor_microplanejamento.py (465 linhas)
**Funcao:** Planejamento por frente baseado em morfologia

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `classificar_morfologia_trecho(tr, pvs)` | 190 | Classifica terreno |
| `classificar_frente(tr)` | 213 | Tipo de servico |
| `micro_planejar_trecho(tr, pvs)` | 227 | Equipe+equipamento+duracao+custo |
| `micro_planejar_nucleo(pvs, trechos, nucleo, equipes_max)` | 296 | **PRINCIPAL** |
| `_gerar_recomendacoes(resumo_morf, equipes)` | 368 | Recomendacoes automaticas |

**5 morfologias:**
```
Planicie: 25-35 m/dia | fator 1.00 | Escav. mecanica
Encosta:  15-25 m/dia | fator 1.25 | Mista
Morro:     8-15 m/dia | fator 1.65 | Manual + escoramento
Mangue:    5-10 m/dia | fator 2.10 | Rebaixamento + estaca-prancha
Viela:    10-18 m/dia | fator 1.45 | 100% manual
```

---

## MODULO 18: motor_perdas.py (611 linhas)
**Funcao:** Gestao de perdas de agua (IWA)

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `_idade_categoria(material, anos)` | 114 | nova/madura/velha/critica |
| `balanco_hidrico(vol_prod, vol_macro, vol_micro, ...)` | 129 | Balanco IWA completo |
| `calcular_uarl(rede_km, n_conex, ramal_km, pressao)` | 182 | Perdas minimas inevitaveis |
| `calcular_ili(perdas_reais, uarl)` | 208 | Infrastructure Leakage Index |
| `calcular_risco_trecho(tr, pvs, data_impl, pressao)` | 248 | Risco ruptura por trecho |
| `mapa_risco_nucleo(pvs, trechos, nucleo)` | 333 | Top 10 criticos |
| `analise_troca_vs_perda(ext, mat, idade, pressao)` | 364 | Trocar agora ou manter? |
| `criar_dma(pvs, trechos, n_setores)` | 429 | District Metering Areas |
| `gerar_relatorio_perdas(pvs, trechos, nucleo, ...)` | 471 | **PRINCIPAL** |
| `get_perdas_properties(material, dn, ext, idade, pressao)` | 559 | PropertySet IFC |

**Formula UARL (IWA):**
```
UARL = (18 × rede_km + 0.8 × n_conexoes + 25 × ramal_km) × pressao_mca
ILI = Perdas_Reais / UARL
  ILI < 2.0 = Excelente (Classe A)
  ILI < 4.0 = Bom (Classe B)
  ILI < 8.0 = Regular (Classe C)
  ILI ≥ 8.0 = Ruim (Classe D)
```

---

## MODULO 19: motor_gemini.py (562 linhas)
**Funcao:** Gemini API — foto, PDF, assistente

| Funcao | O que faz |
|--------|-----------|
| `analisar_foto(path)` | Foto → {material, DN, legenda, estado} |
| `ler_pdf(path)` | PDF perfil → pvs + trechos |
| `consultar(pergunta, contexto)` | Texto → resposta |
| `resumo_executivo(dados)` | Dados rede → resumo gerencial |

---

## MODULO 20: motor_llm.py (545 linhas)
**Funcao:** Roteador multi-LLM (4 providers gratuitos)

| Provider | Modelo | Uso |
|----------|--------|-----|
| Gemini | Flash 2.5 | Foto, PDF (unico multimodal free) |
| Groq | Llama 3.3 70B | Consulta rapida (~0.3s) |
| Mistral | Large | Resumo gerencial, explicacao ML |
| Cohere | Command-R+ | Analise dados, perdas |

---

## MODULO 21: motor_contratos.py (560 linhas)
**Funcao:** Gestor multi-contrato (qualquer cidade/estado)

| Funcao | Linha | O que faz |
|--------|-------|-----------|
| `criar_contrato(nome, numero, contratante, cidade, estado, ...)` | — | Novo contrato com CRS automatico |
| `editar_contrato(slug, **campos)` | — | Edita campos |
| `listar_contratos()` | — | Lista todos |
| `get_contrato(slug)` | — | Dados do contrato |
| `get_precos(slug)` | — | Tabela precos |
| `importar_precos(slug, caminho)` | — | Importa CSV/JSON |
| `ativar_contrato(slug)` | — | Troca contrato ativo |
| `criar_nucleo(nome, contrato_slug)` | — | Novo nucleo |
| `salvar_rede_nucleo(pvs, trechos, nome)` | — | Salva pvs+trechos |
| `carregar_rede_nucleo(nome)` | — | Carrega pvs+trechos |
| `listar_nucleos()` | — | Lista nucleos |
| `exportar_contrato(slug, out_path)` | — | Exporta ZIP |
| `importar_contrato(zip_path)` | — | Importa ZIP |
| `criar_slnr_santos()` | — | SLNR pre-configurado |

**CRS automatico 18 estados:**
```
SP/RJ/MG/DF/MA/PI → EPSG:31983 (UTM 23S)
PR/SC/RS/GO/PA     → EPSG:31982 (UTM 22S)
BA/CE/ES           → EPSG:31984 (UTM 24S)
PE                 → EPSG:31985 (UTM 25S)
MT/MS              → EPSG:31981 (UTM 21S)
AM                 → EPSG:31980 (UTM 20S)
```

---

# PARTE 4 — GUI DESKTOP (construdata_gui.py — 1.631 linhas, 81 metodos)

## 12 ABAS:

| # | Tab | Botoes | Funcionalidade |
|---|-----|--------|---------------|
| 1 | Processar | PIPELINE COMPLETO, APENAS LER, BATCH NUCLEOS, BATCH PROLONGAMENTOS, ABRIR SAIDA, EDITOR HTML | Selecao arquivo + execucao |
| 2 | Mapa | Carregar Rede, Validar GPKG, Gerar NS Selecionados, Satelite/Rua, Salvar ML, Treinar, Predizer | Leaflet + selecao trechos |
| 3 | Rede | — | Cards PVs/Trechos/Extensao + tabela PVs |
| 4 | Hidraulica | — | Cards OK/Verificar + tabela Manning |
| 5 | Trechos | — | Tabela completa todos campos |
| 6 | Custos 5D | CALCULAR CUSTOS, GERAR BM, CURVA S, MICRO-PLAN, RELATORIO ML, CRONOGRAMA MACRO | Tabela custos detalhada |
| 7 | BIM/Civil3D | GERAR TUDO, IFC, LandXML, NTS292, DXF, Cronograma, Dynamo, SCR + 6 HTMLs | Geradores + viewers |
| 8 | Lean/LPS | RELATORIO, TAKT TIME, LOOKAHEAD 6 SEM, BIM 6D | Cards + texto JSON |
| 9 | Perdas | RELATORIO, MAPA RISCO, CRIAR DMAs, PDF PERDAS, ANALISE TROCA | Cards + texto JSON |
| 10 | IA | Resumo Executivo, Validar Hidraulica, Analisar Perdas, Explicar ML, Analisar Foto, Ler PDF, campo pergunta | 4 LLMs gratuitos |
| 11 | Nucleos | BATCH NUCLEOS DXF, BATCH PROLONGAMENTOS, BATCH TUDO | Tabelas DXF + XML |
| 12 | Log | Limpar, Copiar | Console timestamps |

---

# PARTE 5 — INTERFACES HTML (6 arquivos, 4.357 linhas)

| HTML | Linhas | Tecnologia | Funcionalidade |
|------|--------|------------|---------------|
| construdata_editor.html | 1.054 | Leaflet + DOM | Editor rede estilo EPANET. Add PV(P), Tubo(T), Mover(M), Apagar(Del). 4 abas: Props/NS/Cadastro/Custo. Import/Export JSON. Manning tempo real. |
| construdata_rdo.html | 892 | DOM + Canvas | RDO diario. NS vinculadas, servicos, custos, ocorrencias, fotos, equipe, clima. |
| construdata_controle.html | 576 | DOM + Canvas | 4 abas: As-Built editavel, Medicao BM, Curva S grafico, Resumo 5D com pie chart. |
| construdata_perdas.html | 524 | DOM + Canvas | 6 abas: Balanco, UARL+ILI, Risco, DMAs, Economia, Dados. Gauge + Sankey. |
| FLUXOGRAMA_BIM_5D.html | 519 | SVG + DOM | Fluxograma visual pipeline 7 fases. Blocos clicaveis. |
| ARQUITETURA_BIM_5D.html | 482 | SVG + DOM | Diagrama arquitetura do sistema. |
| construdata_manage.html | 310 | Three.js | Viewer 3D. 5 modos: 3D/Custo/Hidraulica/DN/Timeline 4D. Z exaggeration. |

---

# PARTE 6 — CONTAGEM FINAL

| Categoria | Arquivos | Linhas |
|-----------|----------|--------|
| Leitores (3) | ler_dxf_gdal, ler_landxml, ler_dwg_aec | 911 |
| Geradores (8) | gerar_ns, civil3d, nts292, ifc, project, crono_macro, pdf_perdas, pipeline | 2.729 |
| Motores (10) | custo, medicao, ml, lean_lps, parametrico, micro, perdas, gemini, llm, contratos | 4.131 |
| GUI Desktop (1) | construdata_gui.py | 1.631 |
| HTML (7) | editor, manage, controle, rdo, perdas, fluxograma, arquitetura | 4.357 |
| **TOTAL** | **29 arquivos** | **13.759 linhas** |

Funcoes publicas: **105+**
Classe: **1** (PipeNetwork com 18 metodos)
Formatos de saida: **15+** (PDF, HTML, DXF, IFC, XML, XER, CSV, GeoJSON, JSON, ZIP, .py, .scr)
Estados suportados: **18** (CRS automatico)
LLMs integrados: **4** (Gemini, Groq, Mistral, Cohere)

---

*ConstruData - HydroNetwork · FCN Construcoes e Saneamento*
*21 scripts · 7 HTML · 1 GUI · 13.759 linhas · 105+ funcoes*
*Documento gerado em 23/03/2026*
