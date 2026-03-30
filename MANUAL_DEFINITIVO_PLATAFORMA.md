# MANUAL DEFINITIVO — ConstruData HydroNetwork
## Plataforma BIM 6D para Redes de Agua e Esgoto
### FCN Construcoes e Saneamento · Marco 2026

---

# NUMEROS DA PLATAFORMA

- **22 scripts Python** (9.761 linhas de codigo de producao)
- **7 interfaces HTML** (4.357 linhas)
- **1 GUI desktop** (1.631 linhas, 12 abas, 95 metodos)
- **130+ funcoes publicas**
- **1 classe** (PipeNetwork, 18 metodos)
- **4 LLMs gratuitos** integrados (Gemini, Groq, Mistral, Cohere)
- **18 estados** com CRS automatico
- **15+ formatos** de saida
- **836 NS geradas**, 0 erros, 39 km de rede validada

---

# COMO ABRIR

```
Duplo-clique em ABRIR.bat
```

Ou:
```bash
python construdata_gui.py
```

---

# ARQUITETURA

```
ENTRADA                         PROCESSAMENTO                    SAIDA
─────────────                   ─────────────                    ─────
.DXF (ProSane)  ─┐              ┌─ motor_custo      R$910/m     PDF A4 (NS campo)
.DWG (Civil 3D) ─┤              ├─ motor_medicao    NS→BM       PDF A3 (desenho)
.XML (LandXML)  ─┤→ pvs+trechos─├─ motor_ml         XGBoost     PDF A3 (satelite)
.JSON (rede)    ─┤  (formato    ├─ motor_lean_lps   Takt+LPS    HTML (Leaflet)
.PDF (Gemini)   ─┤   unico)    ├─ motor_parametrico Cascata     GeoJSON
Mapa (editor)   ─┤              ├─ motor_micro      Morfologia   LandXML
Foto (RDO)      ─┘              ├─ motor_perdas     IWA/UARL    DXF NTS 292
                                ├─ motor_gemini     Foto/PDF     IFC LOD 500
                                ├─ motor_llm        4 LLMs       CSV
                                └─ motor_contratos  Multi-CT     MS Project XML
                                                                  Primavera P6 XER
                                                                  OpenProject CSV
                                                                  Dynamo .py
                                                                  AutoCAD .scr
                                                                  PDF Perdas
                                                                  JSON (dados)
                                                                  ZIP (contrato)
```

---

# MODULO POR MODULO

---

## 1. LEITORES (3 modulos — 911 linhas)

### ler_dxf_gdal.py — 328 linhas
Le DXF do ProSaneamento via GDAL/OGR + scipy clustering de endpoints.

```
ENTRADA: arquivo .dxf
SAIDA:   (pvs, trechos, ruas, meta)
```

| Funcao | O que faz |
|--------|-----------|
| `ler_dxf_gdal(dxf_path)` | Le DXF completo. Clusteriza endpoints (2m) = PVs reais. Conectividade topologica. |
| `_agrupar_textos_pv(pv_data)` | Agrupa textos PV/CT/CF por proximidade |
| `_parse_dn(txt)` | Extrai DN de "200mm" ou "DN200" |
| `_parse_incl(txt)` | Extrai declividade de "0.008 m/m" |
| `_nearest_text(mx, my, xy, txt, max_d)` | Texto mais proximo dentro de max_d metros |

**Fluxo:** GDAL le entities → filtra TUBO_* → endpoints → scipy.fclusterdata(t=2m) → clusters = PVs → match textos PS_PONTOS → topologia tubo[i] liga cluster[2i]↔cluster[2i+1] → dedup bidirecional

### ler_landxml.py — 267 linhas
Le LandXML 1.2 exportado do Civil 3D.

| Funcao | O que faz |
|--------|-----------|
| `ler_landxml(xml_path)` | Parseia Struct→PVs (elevRim=CT, elevSump=CF, Center=coords) + Pipe→Trechos (refStart/refEnd, CircPipe) |

### ler_dwg_aec.py — 316 linhas
Le DWG Civil 3D com objetos AEC Proxy.

| Funcao | O que faz |
|--------|-----------|
| `ler_dwg_aec(path)` | Converte DWG→DXF via libredwg, parseia textos PV/CT/CF, reconstroi topologia por nomes |
| `_converter_dwg_para_dxf(dwg_path)` | Chama libredwg subprocess |
| `_extrair_pvs_de_dxf(dxf_path)` | Parseia "P.V. NN", "C.T. valor", "C.F. valor" |
| `_reconstruir_rede(pvs, dn_padrao, max_ext)` | Topologia por sequencia: PV01→PV02→PV03 |

---

## 2. GERADORES (8 modulos — 2.835 linhas)

### gerar_ns.py — 654 linhas
Gera Notas de Servico: 5 arquivos por trecho.

```
ENTRADA: pvs, trechos, nucleo, pasta
SAIDA POR TRECHO:
  NS_001_A4.pdf        ← PDF A4 nota de campo
  NS_001_DADOS.json    ← Dados estruturados
  NS_001_DESENHO.pdf   ← PDF A3 planta+perfil+satelite
  NS_001_SAT.pdf       ← PDF A3 satelite Esri + perfil limpo
  NS_001.html          ← Mapa Leaflet interativo
SAIDA POR NUCLEO:
  REDE_GERAL.html      ← Mapa toda a rede
  rede_definida.geojson ← GeoJSON LineString
```

| Funcao | O que faz |
|--------|-----------|
| `calc_manning(dn_mm, decl_mm)` | V=(1/n)*Rh^(2/3)*I^(1/2), Q=V*A*1000, tau=9810*Rh*I. n: PVC=0.013, PEAD=0.011 |
| `enriquecer_trechos(trechos, pvs)` | Adiciona v_ms, q_ls, tau_pa, cotas, prof a cada trecho |
| `gerar_ns_a4(ns_id, tr, pvs, nucleo, path)` | PDF A4 com header, dados PV, Manning, coordenadas |
| `gerar_ns_desenho(ns_id, tr, pvs, all, nucleo, path)` | PDF A3: planta + perfil + satelite contextily |
| `calcular_materiais(tr, pvs)` | Lista materiais: barras=ceil(ext/6), luvas, aneis, areia, brita, PV, ramal |
| `gerar_ns_sat(ns_id, tr, pvs, nucleo, path)` | PDF A3: satelite Esri + perfil longitudinal limpo |
| `gerar_html(ns_id, tr, pvs, all, nucleo, path)` | HTML Leaflet com polylines + markers + popups |
| `gerar_geojson(trechos, pvs, path)` | GeoJSON LineString EPSG:31983 |
| `processar_nucleo(dxf_path, nucleo, out)` | Pipeline completo: le DXF → enriquece → gera tudo |
| `processar_nucleo_from_data(pvs, tr, nucleo, out)` | Mesmo, a partir de dados ja lidos |
| `to_ll(x, y)` | UTM 31983 → lat/lon (pyproj ou fallback Santos) |

### gerar_civil3d.py — 312 linhas
Pacote completo para Civil 3D.

| Funcao | Saida |
|--------|-------|
| `gerar_landxml(pvs, tr, nucleo, path)` | LandXML 1.2 com PipeNetwork (Structs+Pipes+Inverts+Properties) |
| `gerar_cadastro_dxf(pvs, tr, nucleo, dir)` | 1 DXF A4/rua com planta+carimbo NTS0292 |
| `gerar_dynamo_script(pvs, tr, nucleo, path)` | Python script com JSON embutido para Dynamo Civil 3D |
| `gerar_autocad_scr(pvs, tr, nucleo, path)` | Script .scr: LINE + CIRCLE + TEXT (funciona sem Civil 3D) |
| `gerar_json_dados(pvs, tr, nucleo, path)` | JSON completo com meta + pvs + trechos |

### gerar_cadastro_nts292.py — 458 linhas
Cadastro as-built georeferenciado conforme NTS 292 SABESP.

| Funcao | O que faz |
|--------|-----------|
| `gerar_cadastro_nts292(pvs, tr, nucleo, dir)` | DXF georref SIRGAS 2000 UTM 23S + Meta JSON |
| `_setup_doc()` | DXF R2010, 17 layers NTS 292 |
| `_draw_pv_symbol()` | Circulo+cruz simbologia SIGNOS |
| `_draw_tubo()` | Linha + texto DN/MAT/i/L |
| `_draw_perfil()` | Perfil longitudinal H 1:500, V 1:100 |
| `_draw_carimbo_sabesp()` | Carimbo NTS 116 |
| `_draw_coord_grid()` | Grade UTM cada 100m |

### gerar_ifc_lod500.py — 184 linhas
IFC 3D real com geometria LOD 500.

| Funcao | O que faz |
|--------|-----------|
| `gerar_ifc_lod500(pvs, tr, nucleo, dir)` | IFC 2x3 + CSV + JSON |
| `_gerar_ifc_real()` | Tubos=IfcSweptDiskSolid (cilindro oco DN/2, parede 0.9), PVs=IfcExtrudedAreaSolid (r=0.6m PV, 0.3m PI) |

**PropertySets:** Dados_Tecnicos, SABESP_Hidraulica (V/Q/tau), Custo5D (8 itens+BDI), Dados_PV (CT/CF/prof/E/N)

### gerar_project_xml.py — 276 linhas
Cronograma MS Project 2016+, 12 fases WBS.

| Funcao | O que faz |
|--------|-----------|
| `gerar_project_xml(pvs, tr, nucleo, dir)` | XML com 12 fases sequenciais, produtividades, 10 recursos, calendario 8h/22d |

**12 fases:** Mobilizacao(5d), Topografia(ext/200/2eq), Escavacao(ext/30/2), Assentamento(ext/40/2), PVs(pvs/0.5/2), Reaterro(ext/50/2), Pavimentacao(ext/60/2), Ligacoes(pvs/3/2), Testes(ext/200), Cadastro(folhas/2), BIM(trechos/10), Desmobilizacao(3d)

### gerar_cronograma_macro.py — 414 linhas
Cronograma multinucleo em 4 formatos.

| Funcao | Saida |
|--------|-------|
| `gerar_tudo(nucleos, data_inicio, dir)` | XML + XER + CSV + JSON |
| `exportar_project_xml(wbs, path)` | MS Project XML |
| `exportar_primavera_xer(wbs, path)` | Oracle Primavera P6 |
| `exportar_openproject_csv(wbs, path)` | OpenProject CSV |

### gerar_pdf_perdas.py — 314 linhas
Relatorio PDF de gestao de perdas.

| Funcao | O que faz |
|--------|-----------|
| `gerar_pdf_perdas(relatorio, path, nucleo)` | PDF A4 com 5 secoes: Infraestrutura, UARL, Balanco IWA, ILI, Estrategias |

### construdata_pipeline.py — 203 linhas
Orquestrador: detecta formato → roda 6 etapas.

| Funcao | O que faz |
|--------|-----------|
| `run_pipeline(input_path, nucleo, out_dir)` | .dxf/.xml/.dwg → 01_NS + 02_CIVIL3D + 03_NTS292 + 04_IFC + 05_CRONOGRAMA |

---

## 3. MOTORES DE CALCULO (7 modulos — 2.978 linhas)

### motor_custo.py — 297 linhas
Custos reais do contrato.

```
Composicao R$/metro:
  Escavacao R$145 + Tubo ESG R$240 + Tubo AG R$95 + PV R$120
  + Reaterro R$80 + Ramal R$65 + Pavim R$45 + Sinaliz R$15
  = R$805 + BDI 25% = R$910/m
```

| Funcao | O que faz |
|--------|-----------|
| `custo_trecho(tr, pvs, tabela)` | Custo detalhado 1 trecho: 8 itens + subtotal + BDI + total |
| `custo_nucleo(pvs, trechos, nucleo)` | Custo total nucleo + R$/m medio |
| `gerar_bm(trechos_exec, pvs, periodo, bm_num)` | Boletim de Medicao formal |
| `importar_tabela_precos(path)` | Importa CSV ou JSON com precos |

### motor_medicao.py — 269 linhas
Acompanhamento de execucao e medicao mensal.

| Funcao | O que faz |
|--------|-----------|
| `carregar_execucao_xlsx(path)` | Le Excel de execucao diaria (521 dias x 6 nucleos) |
| `carregar_execucao_json(path)` | Le JSON de execucao |
| `gerar_resumo_execucao(dados)` | Resumo por nucleo, mes, totais |
| `gerar_curva_s(trechos, dados, custo_metro)` | Curva S previsto x realizado (22 dias uteis/mes) |
| `vincular_ns_execucao(trechos, dados)` | Vincula NS com status real por rua |
| `gerar_boletim_medicao(trechos_exec, pvs, periodo, bm_num)` | BM formal com itens + totais |
| `gerar_acompanhamento_semanal(dados, sem_ini, sem_fim)` | Producao semanal |

### motor_ml.py — 247 linhas
Machine Learning — previsao de producao.

| Funcao | O que faz |
|--------|-----------|
| `prever_producao(dados_exec, dias_futuro)` | XGBoost rolling_3 (feature 50% importancia) → previsao |
| `analisar_gargalos(dados_exec)` | Pipeline 11 etapas: identifica 4 gargalos (Projeto, Execucao, Lavagem, Liberacao) |
| `simular_cenario(cenario_idx, saldo_total_m, custo_metro)` | 5 cenarios de aceleracao |
| `gerar_relatorio_ml(dados_exec, saldo_total_m)` | Relatorio completo: indicadores + previsao + cenarios |

**Indicadores:** 366 lig/mes atual → Meta 2X: 733 → Meta SABESP: 1000+ | 6.1m/ligacao | Ciclo 76d→40d

### motor_lean_lps.py — 475 linhas
Lean Construction + Last Planner System + BIM 6D.

| Funcao | O que faz |
|--------|-----------|
| `calcular_6d_trecho(tr, pvs)` | Ciclo vida 50 anos + CO2 por trecho |
| `gerar_6d_nucleo(pvs, trechos)` | Resumo 6D: custo ciclo vida total + CO2 total |
| `calcular_takt_time(trechos, equipes)` | Takt = n_trechos / (equipes x 22d x 12m) |
| `mapear_fluxo_valor(trechos, dados)` | Value Stream Mapping: VA vs desperdicio |
| `criar_weekly_work_plan(ns_list, semana, equipes)` | Plano semanal LPS por equipe e dia |
| `calcular_ppc(ns_planejadas, ns_executadas)` | Percent Plan Complete + classificacao |
| `analisar_razoes_nao_conclusao(historico)` | Pareto: material 30%, equipe 25%, clima 20% |
| `gerar_lookahead(ns_list, semanas, equipes)` | Lookahead 6 semanas com restricoes |
| `gerar_relatorio_lean_lps(pvs, tr, dados, nucleo)` | Relatorio integrado: 6D + Lean + LPS |
| `get_6d_properties(material, ext_m)` | PropertySet IFC para dados 6D |

**BIM 6D:** PVC 50a/3.2kgCO2/m | PEAD 100a/2.8kgCO2/m | Concreto 80a/12.5kgCO2/m | FFD 100a/18kgCO2/m

### motor_parametrico.py — 318 linhas
Rede parametrica com recalculo em cascata.

```python
class PipeNetwork:
    mover_pv(nome, x, y)         # → recalcula ext + decl + Manning + custo de TODOS conectados
    alterar_cota(nome, ct, cf)   # → recalcula prof + decl + Manning
    alterar_dn(trecho_idx, dn)   # → recalcula Manning (V/Q/tau)
    alterar_material(idx, mat)   # → recalcula Manning (n diferente por material)
    adicionar_pv() / remover_pv()
    adicionar_trecho() / remover_trecho()
    resumo()                     # → stats da rede
    trechos_com_alerta()         # → V<0.6 ou tau<1.0
    exportar() / from_json()     # → JSON padrao
```

### motor_microplanejamento.py — 465 linhas
Planejamento por frente baseado em morfologia do terreno.

| Funcao | O que faz |
|--------|-----------|
| `classificar_morfologia_trecho(tr, pvs)` | Classifica: planicie/encosta/morro/mangue/viela |
| `classificar_frente(tr)` | Tipo: tronco/ramal/agua/predial/prolongamento |
| `micro_planejar_trecho(tr, pvs)` | Equipe + equipamento + duracao + custo + material por trecho |
| `micro_planejar_nucleo(pvs, tr, nucleo, equipes_max)` | Plano completo do nucleo com recomendacoes |

**5 morfologias:**
```
Planicie:  30 m/dia | fator 1.00 | Escavadeira + caminhao
Encosta:   20 m/dia | fator 1.25 | Escavadeira + escoramento
Morro:     12 m/dia | fator 1.65 | Manual + escoramento pesado
Mangue:     7 m/dia | fator 2.10 | Rebaixamento + estaca-prancha
Viela:     14 m/dia | fator 1.45 | 100% manual (espaco limitado)
```

### motor_perdas.py — 611 linhas
Gestao de perdas de agua (metodologia IWA).

| Funcao | O que faz |
|--------|-----------|
| `balanco_hidrico(vol_prod, vol_macro, vol_micro, ...)` | Balanco IWA: agua faturada, NRW, perdas reais, perdas aparentes |
| `calcular_uarl(rede_km, n_conex, ramal_km, pressao)` | UARL = (18*km + 0.8*n + 25*ramal) * pressao |
| `calcular_ili(perdas_reais, uarl)` | ILI = Perdas/UARL. A(<2) B(<4) C(<8) D(>=8) |
| `calcular_risco_trecho(tr, pvs, data_impl, pressao)` | Score risco: material + idade + DN + pressao + profundidade |
| `mapa_risco_nucleo(pvs, trechos, nucleo)` | Top 10 criticos + contagem por categoria |
| `analise_troca_vs_perda(ext, mat, idade, pressao)` | Economico: trocar agora ou manter e reparar? |
| `criar_dma(pvs, trechos, n_setores)` | Divide rede em District Metering Areas |
| `gerar_relatorio_perdas(pvs, tr, nucleo, vol_prod, vol_micro, pressao)` | Relatorio completo |
| `get_perdas_properties(material, dn, ext, idade, pressao)` | PropertySet IFC |

---

## 4. INTELIGENCIA ARTIFICIAL (2 modulos — 1.107 linhas)

### motor_gemini.py — 562 linhas
Gemini API direto — unico LLM free com visao multimodal.

| Funcao | O que faz | Modelo |
|--------|-----------|--------|
| `analisar_foto(path)` | Foto de obra → {material, DN, legenda, estado_conservacao} | Gemini Flash |
| `analisar_fotos_lote(pasta)` | Batch: todas as fotos de uma pasta | Gemini Flash |
| `ler_pdf_projeto(path)` | PDF perfil longitudinal → pvs + trechos | Gemini Flash |
| `consultar(pergunta, contexto)` | Pergunta em linguagem natural → resposta | Gemini Flash |
| `gerar_resumo_executivo(dados)` | Dados rede → resumo gerencial | Gemini Flash |
| `setup_api_key()` | Configura API key interativamente | — |
| `verificar_conexao()` | Testa se Gemini esta acessivel | — |

### motor_llm.py — 545 linhas
Roteador multi-LLM: 1 modelo gratuito por modulo.

| Modulo | LLM | Por que |
|--------|-----|---------|
| Foto RDO | **Gemini Flash** | Unico free multimodal (imagem→texto) |
| Leitura PDF | **Gemini Flash** | Unico free que le PDF nativo |
| Consulta rapida | **Groq Llama 3.3 70B** | Mais rapido (~0.3s resposta) |
| Resumo executivo | **Mistral Large** | Melhor escrita tecnica free |
| Recomendacoes LPS | **Groq Llama 3.3 70B** | Velocidade + raciocinio |
| Analise perdas | **Cohere Command-R+** | Bom com dados tabulares |
| Validacao hidraulica | **Groq Llama 3.3 70B** | Velocidade pra validar em lote |
| Explicacao ML | **Mistral Large** | Raciocinio + escrita clara |
| Chat geral | **Groq Llama 3.3 70B** | Rapido + gratuito |

| Funcao | O que faz |
|--------|-----------|
| `chamar(modulo, prompt, imagem, pdf)` | Roteia automaticamente pro melhor LLM |
| `consultar(pergunta, contexto)` | Chat com contexto da rede |
| `resumo_executivo(dados)` | Resumo gerencial via Mistral |
| `validar_hidraulica(trechos)` | Valida V/Q/tau via Groq |
| `analisar_perdas_texto(relatorio)` | Analise textual via Cohere |
| `explicar_ml(relatorio)` | Explica previsao via Mistral |
| `recomendar_lps(dados)` | Recomendacoes LPS via Groq |
| `analisar_foto(path)` | Foto → analise via Gemini |
| `ler_pdf(path)` | PDF → pvs+trechos via Gemini |
| `status()` | Status dos 4 providers (verde/vermelho) |
| `setup()` | Configura as 4 API keys |

**Limites gratuitos:**
```
Gemini Flash:  500 req/dia    (foto, PDF, texto)
Groq:          30 req/min     (texto, ultra-rapido)
Mistral:       1M tokens/mes  (texto, boa escrita)
Cohere:        1000 req/mes   (texto, dados)
```

**Setup (1 vez):**
```bash
pip install google-genai groq mistralai cohere
python motor_llm.py setup
```

---

## 5. GESTAO DE CONTRATOS (1 modulo — 560 linhas)

### motor_contratos.py — 560 linhas
Multi-contrato: qualquer cidade, qualquer contratante.

| Funcao | O que faz |
|--------|-----------|
| `criar_contrato(nome, numero, contratante, cidade, estado, bdi, custo_metro)` | Novo contrato com CRS automatico |
| `editar_contrato(slug, **campos)` | Edita dados. Se mudar estado, atualiza CRS |
| `listar_contratos()` | Lista todos com status ativo |
| `get_contrato(slug)` | Dados do contrato |
| `get_precos(slug)` | Tabela precos do contrato |
| `importar_precos(slug, caminho)` | Importa CSV ou JSON de precos |
| `ativar_contrato(slug)` | Troca contrato ativo (muda precos, CRS, mapa) |
| `criar_nucleo(nome)` | Novo nucleo no contrato ativo |
| `salvar_rede_nucleo(pvs, trechos, nome)` | Salva rede no nucleo |
| `carregar_rede_nucleo(nome)` | Carrega rede do nucleo |
| `listar_nucleos()` | Lista nucleos do contrato |
| `exportar_contrato(slug, path)` | ZIP portavel (levar pra outro PC) |
| `importar_contrato(zip_path)` | Importa ZIP |
| `criar_slnr_santos()` | SLNR Santos pre-configurado (16 materiais, R$910/m) |

**CRS automatico 18 estados:**
```
SP/RJ/MG/DF/MA/PI  → EPSG:31983 (UTM 23S)
PR/SC/RS/GO/PA      → EPSG:31982 (UTM 22S)
BA/CE/ES            → EPSG:31984 (UTM 24S)
PE                  → EPSG:31985 (UTM 25S)
MT/MS               → EPSG:31981 (UTM 21S)
AM                  → EPSG:31980 (UTM 20S)
```

**Estrutura de pastas:**
```
~/.construdata/
  contratos/
    11481051_se_liga_na_rede_santos/
      contrato.json     ← dados, BDI, CRS, centro mapa
      precos.json       ← tabela precos
      nucleos/
        verde_e_teteu/
          rede.json     ← pvs + trechos
        pantanal_baixo/
          rede.json
    2024_001_programa_agua_legal/    ← outro contrato (BH/MG)
      contrato.json
      precos.json
```

---

## 6. GUI DESKTOP — 1.631 linhas, 12 abas, 95 metodos

### Tab 1: PROCESSAR
Selecao de arquivo + execucao do pipeline.

| Botao | O que faz |
|-------|-----------|
| PIPELINE COMPLETO | Le arquivo → 6 etapas (NS + Civil3D + NTS292 + IFC + Cronograma) |
| APENAS LER | Le e mostra nas tabelas (sem gerar saidas) |
| BATCH NUCLEOS | Processa todos os 6 nucleos DXF de uma vez |
| BATCH PROLONGAMENTOS | Processa os 5 prolongamentos LandXML |
| ABRIR SAIDA | Abre pasta de saida no Explorer |
| EDITOR HTML | Abre construdata_editor.html no navegador |

Aceita: .dxf .xml .json .dwg .pdf

### Tab 2: MAPA
Mapa Leaflet (tkintermapview) com selecao de trechos.

| Botao | O que faz |
|-------|-----------|
| Carregar Rede | Desenha PVs + trechos no mapa (pyproj UTM→lat/lon) |
| Validar GPKG | Cartografia GPKG: marca trechos que cruzam quadras |
| Gerar NS Selecionados | Gera NS so dos trechos marcados |
| Satelite/Rua | Troca tile (Esri WorldImagery / OpenStreetMap) |
| Salvar ML | Salva decisoes como amostras XGBoost |
| Treinar | Treina modelo XGBoost com amostras salvas |
| Predizer | Aplica modelo: marca trechos reais vs ruido |

Lista lateral: Space/Enter = incluir/excluir trecho

### Tab 3: REDE
Cards: PVs, Trechos, Extensao, Tipo (esgoto/agua), Motor, Ruas
Tabela PVs: Nome, X, Y, CT, CF, Prof

### Tab 4: HIDRAULICA
Cards: OK, Verificar, Sem Dados, Manning n
Tabela: NS, PV Ini, PV Fim, DN, Ext, Decl%, V(m/s), Q(l/s), Tau(Pa), Status
Status OK = V>=0.6 e tau>=1.0

### Tab 5: TRECHOS
Tabela completa: NS, PV Ini, PV Fim, Rua, DN, Ext, Material, CT Ini, CF Ini, Prof Ini, Custo R$

### Tab 6: CUSTOS 5D
Cards: Custo Total R$, R$/metro, BDI 25%, Trechos, Extensao, BMs

| Botao | O que faz | Motor |
|-------|-----------|-------|
| CALCULAR CUSTOS | Calcula custo de todos os trechos | motor_custo |
| GERAR BM | Boletim de Medicao JSON | motor_custo |
| CURVA S | Previsto x realizado JSON | motor_medicao |
| MICRO-PLAN | Plano por frente/morfologia JSON | motor_microplanejamento |
| RELATORIO ML | Previsao + gargalos + cenarios JSON | motor_ml |
| CRONOGRAMA MACRO | XML + XER + CSV + JSON (4 formatos) | gerar_cronograma_macro |

Tabela custos: NS, PVs, DN, Ext, Tubo R$, Escav R$, Reaterro R$, Repav R$, PV R$, TOTAL R$

### Tab 7: BIM / CIVIL 3D

| Botao | O que faz | Motor |
|-------|-----------|-------|
| GERAR TUDO (6 etapas) | Roda etapas 3-6 de uma vez | Todos geradores |
| IFC LOD500 | IFC 3D real (SweptDiskSolid) | gerar_ifc_lod500 |
| LandXML | XML para Civil 3D Import | gerar_civil3d |
| Cadastro NTS292 | DXF georref as-built | gerar_cadastro_nts292 |
| Cadastro DXF | DXF folha A4/rua | gerar_civil3d |
| Cronograma | MS Project XML | gerar_project_xml |
| Dynamo | Script .py para Dynamo Civil 3D | gerar_civil3d |
| SCR | Script .scr para AutoCAD | gerar_civil3d |

HTMLs: Editor EPANET, Viewer 3D, Controle As-Built, RDO Diario, Gestao Perdas, Fluxograma

### Tab 8: LEAN / LPS
Cards: Takt (dias), Cycle Time, PPC (%), VA/NVA, CO2 (ton), Custo 50 anos

| Botao | O que faz | Motor |
|-------|-----------|-------|
| RELATORIO LEAN+LPS | 6D + Lean + LPS integrado | motor_lean_lps |
| TAKT TIME | Takt, cycle time, throughput | motor_lean_lps |
| LOOKAHEAD 6 SEM | Planejamento 6 semanas com restricoes | motor_lean_lps |
| BIM 6D (Ciclo Vida) | CO2 + custo 50 anos por material | motor_lean_lps |

### Tab 9: PERDAS
Cards: UARL (m3/ano), ILI, Classif., Risco Alto, DMAs, Perda R$/ano

| Botao | O que faz | Motor |
|-------|-----------|-------|
| RELATORIO PERDAS | IWA completo: UARL + ILI + risco | motor_perdas |
| MAPA RISCO | Top 10 trechos criticos | motor_perdas |
| CRIAR DMAs | District Metering Areas | motor_perdas |
| PDF PERDAS | Relatorio PDF profissional | gerar_pdf_perdas |
| ANALISE TROCA | Trocar agora ou manter? (economico) | motor_perdas |

### Tab 10: IA
Status dos 4 LLMs (Gemini, Groq, Mistral, Cohere) + campo de pergunta

| Botao | O que faz | LLM |
|-------|-----------|-----|
| Resumo Executivo | Resumo gerencial da rede | Mistral Large |
| Validar Hidraulica | Valida V/Q/tau em linguagem natural | Groq Llama 3.3 |
| Analisar Perdas | Analise textual das perdas | Cohere Command-R+ |
| Explicar ML | Explica previsao do modelo | Mistral Large |
| Analisar Foto | Foto → material, DN, estado | Gemini Flash |
| Ler PDF | PDF perfil → pvs + trechos | Gemini Flash |
| [Campo pergunta] | Chat livre com contexto da rede | Groq Llama 3.3 |

### Tab 11: NUCLEOS
Tabela DXF (6 nucleos ProSaneamento) + Tabela XML (5 prolongamentos Civil 3D)
Botoes: BATCH NUCLEOS DXF, BATCH PROLONGAMENTOS, BATCH TUDO

### Tab 12: LOG
Console com timestamps. Botoes: Limpar, Copiar.

---

## 7. INTERFACES HTML (7 arquivos — 4.357 linhas)

| HTML | Linhas | Tecnologia | O que faz |
|------|--------|------------|-----------|
| construdata_editor.html | 1.054 | Leaflet | Editor de rede estilo EPANET. Ferramentas: Add PV(P), Tubo(T), Mover(M), Selecionar(V), Apagar(Del). 4 abas: Propriedades, NS, Cadastro, Custo. Import/Export JSON. Manning tempo real. Satelite/rua/topo. |
| construdata_rdo.html | 892 | DOM+Canvas | RDO diario. NS vinculadas + servicos + custos + ocorrencias + fotos + equipe + clima. |
| construdata_controle.html | 576 | DOM+Canvas | 4 abas: As-Built (tabela editavel), Medicao BM, Curva S (grafico), Resumo 5D (pie chart). |
| construdata_perdas.html | 524 | DOM+Canvas | 6 abas: Balanco, UARL+ILI, Risco, DMAs, Economia, Dados. Gauges + Sankey diagram. |
| FLUXOGRAMA_BIM_5D.html | 519 | SVG+DOM | Fluxograma visual do pipeline 7 fases. Blocos clicaveis. |
| ARQUITETURA_BIM_5D.html | 482 | SVG+DOM | Diagrama de arquitetura do sistema. 3 camadas. |
| construdata_manage.html | 310 | Three.js | Viewer 3D. 5 modos: 3D/Custo/Hidraulica/DN/Timeline 4D. Z exaggeration 1-20x. Pipe scale 1-15x. |

---

## 8. DADOS DO CONTRATO

| Arquivo | O que tem |
|---------|-----------|
| dados_contrato/DADOS_CONTRATO.json | 22 materiais + precos SINAPI + composicao R$/m + fatores unitarios + saldo por nucleo |
| dados_contrato/EXECUCAO_DIARIA.json | 521 dias x 6 nucleos (equipe, rua, ligacoes agua/esgoto) |
| dados_contrato/ML_DATA.json | Features XGBoost + pipeline 11 etapas + cenarios + micro-cronograma |

---

## 9. REDES VALIDADAS

| Rede | Tipo | PVs | Trechos | Extensao | NS | Erros |
|------|------|-----|---------|----------|-----|-------|
| Pantanal Baixo | ESG | 165 | 137 | 7.700m | 137 | 0 |
| Verde e Teteu | ESG | 357 | 180 | 2.621m | 180 | 0 |
| Vila Criadores | ESG | — | — | — | OK | 0 |
| Sao Manoel | ESG | 20 | 16 | 1.275m | 16 | 0 |
| Vila Israel | ESG | — | — | — | OK | 0 |
| Joao Carlos | ESG | — | — | — | OK | 0 |
| Pantanal | AG | 348 | 372 | 6.986m | — | 0 |
| Criadores | AG | 122 | 130 | 4.138m | — | 0 |
| Teteu | AG | 337 | 346 | 4.813m | — | 0 |
| Israel | AG | 812 | 861 | 11.509m | — | 0 |
| Prol. Teteu Alt-01 | XML | 147 | 141 | 6.363m | 141 | 0 |
| Prol. Teteu | XML | 149 | 143 | 6.420m | 143 | 0 |
| Prol. Pantanal | XML | 29 | 25 | 1.261m | 25 | 0 |
| Prol. Criadores | XML | 76 | 70 | 2.689m | 70 | 0 |
| Prol. Sao Manoel | XML | 91 | 79 | 5.143m | 79 | 0 |
| **TOTAL** | | **2.302+** | **2.094+** | **~39 km** | **836** | **0** |

---

## 10. DEPENDENCIAS

```bash
# Core
pip install geopandas pyogrio shapely scipy ezdxf pyproj numpy

# IFC 3D
pip install ifcopenshell

# PDF + relatorios
pip install reportlab openpyxl matplotlib

# GUI
pip install tkintermapview contextily

# LLMs (todos gratuitos)
pip install google-genai groq mistralai cohere
```

---

## 11. REGRAS INVIOLAVEIS

1. Empresa: **FCN Construcoes e Saneamento** (NUNCA "DGS Engenharia")
2. Plataforma: **ConstruData - HydroNetwork**
3. Custos: tabela do **contrato** (R$910/m), NAO SINAPI generico
4. Medicao: por **Nota de Servico** (1 NS = 1 trecho)
5. Sempre **agua + esgoto**, nunca so um
6. CRS: **EPSG:31983** (SIRGAS 2000 UTM 23S) — automatico por estado
7. Cadastro NTS 292 = **condicao para pagamento** (contrato pag. 64)
8. CT pode ser negativo (Santos abaixo do nivel do mar)
9. CF > CT = possivel rede aerea (aviso, nao rejeitar)
10. Respostas da IA sao **SUGESTOES** — o engenheiro decide
11. Formato **pvs + trechos** e sagrado — nao alterar estrutura

---

*ConstruData - HydroNetwork · FCN Construcoes e Saneamento*
*22 scripts · 7 HTML · 1 GUI · 15.749 linhas · 130+ funcoes · 4 LLMs · 18 estados*
*Documento gerado em 23/03/2026*
