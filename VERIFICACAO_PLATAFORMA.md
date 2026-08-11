# CONSTRUDATA - HydroNetwork v7.0
## Documento de Verificacao da Plataforma
### Contrato 11481051 - SE LIGA NA REDE - Santos/SP
### FCN Construcoes e Saneamento - Marco 2026

---

## 1. VISAO GERAL

A plataforma ConstruData HydroNetwork e um sistema BIM 5D completo para redes de agua e esgoto.
Converte projetos ProSaneamento (DXF/DWG/LandXML) em todos os entregaveis necessarios para
execucao, medicao e cadastro de redes de saneamento.

**Numeros:**
- 18 scripts Python (6.275+ linhas de codigo)
- 6 interfaces HTML (editor, viewer 3D, controle, RDO, perdas, fluxograma)
- 1 GUI desktop (11 abas, 1.497 linhas)
- 39 km de rede processada e validada
- 836+ Notas de Servico geradas com 0 erros

---

## 2. O QUE CADA MODULO FAZ (VERIFICADO NO CODIGO)

### 2.1 LEITORES (3 modulos)

#### ler_dxf_gdal.py (395 linhas)
**O que faz:** Le arquivos DXF do ProSaneamento usando GDAL/OGR + scipy clustering
**Entrada:** Arquivo .dxf
**Saida:** (pvs, trechos, ruas, meta) - formato padrao da plataforma
**Como funciona:**
- Le layers TUBO_* via geopandas (mesmo motor do QGIS)
- Extrai endpoints de cada polyline de tubo
- Clusteriza endpoints com tolerancia de 2m → cada cluster = 1 PV real
- Associa textos PS_PONTOS_IDENTIFICACAO_TXT aos clusters (nomes, CT, CF)
- Le DN de PS_IND_DIAMETRO e inclinacao de PS_IND_INCLINACAO
- Dedup bidirecional (A→B = B→A)
- Detecta agua vs esgoto pelo nome do arquivo e layers
**Parametros fixos:** MIN_EXT_TUBO=2m, TOL_CLUSTER=2m, TOL_LABEL_PV=20m
**Testado com:** Pantanal (165 PVs, 137 trechos, 0 mismatch), Teteu (61 PVs)

#### ler_landxml.py (155 linhas)
**O que faz:** Le arquivos LandXML 1.2 exportados do Civil 3D
**Entrada:** Arquivo .xml
**Saida:** (pvs, trechos, ruas, meta) - mesmo formato
**Como funciona:**
- Detecta namespace automaticamente (Civil 3D pode omitir)
- Le elementos Struct → PVs (name, elevRim=CT, elevSump=CF, Center=coords)
- Le elementos Pipe → Trechos (refStart, refEnd, length, slope, CircPipe)
- Converte diametro de metros para mm
- Recalcula extensao se XML reporta zero
**Testado com:** 5 prolongamentos (492 PVs, 458 trechos, 0 erros)

#### ler_dwg_aec.py (316 linhas)
**O que faz:** Le DWG do Civil 3D com Pipe Networks (objetos AEC Proxy)
**Entrada:** Arquivo .dwg
**Saida:** (pvs, trechos, meta)
**Como funciona:**
- Converte DWG → DXF via libredwg (subprocess)
- Extrai textos: "P.V. NN", "C.T. valor", "C.F. valor"
- Reconstroi topologia por sequencia de nomes (PV01→PV02→PV03)
**Limitacao:** Precisa do libredwg compilado; objetos AEC Proxy sao descartados como "Unknown object"

---

### 2.2 GERADORES (7 modulos)

#### gerar_ns.py (544 linhas)
**O que faz:** Gera Notas de Servico de campo
**Entrada:** pvs, trechos, nucleo, pasta_saida
**Saida por trecho:**
- PDF A4 (nota de servico com dados do trecho, PVs, Manning, coordenadas)
- JSON (dados estruturados do trecho)
- HTML Leaflet (mapa interativo com rota do trecho)
**Saida por nucleo:**
- REDE_GERAL.html (mapa Leaflet com toda a rede)
- GeoJSON (features LineString em EPSG:31983)
- Log JSON
**Calculos:** Manning secao plena: V=(1/n)*Rh^(2/3)*I^(1/2), n=0.013 PVC
**Testado:** 836 NS geradas (378 nucleos DXF + 458 prolongamentos XML), 0 erros

#### gerar_civil3d.py (803 linhas)
**O que faz:** Gera pacote completo para Civil 3D
**Entrada:** pvs, trechos, nucleo, pasta_saida
**Saidas:**
1. **LandXML 1.2** — Importa no Civil 3D como Pipe Network (File > Import > Import LandXML)
   - Structs com elevRim(CT), elevSump(CF), Center(N,E), CircStruct(diam 1.2m)
   - Pipes com refStart/refEnd, slope, CircPipe(DN, material), PipeFlow(Manning)
2. **Cadastro DXF** — 1 folha A4 paisagem por rua, com planta + carimbo NTS0292
3. **Dynamo .py** — Script Python para criar Pipe Network via API Civil 3D
4. **AutoCAD .scr** — Script de desenho (LINE + CIRCLE + TEXT) para AutoCAD sem Civil 3D
5. **JSON dados** — Dados completos para qualquer integracao

#### gerar_cadastro_nts292.py (458 linhas)
**O que faz:** Gera cadastro as-built georeferenciado conforme NTS 292 SABESP
**Entrada:** pvs, trechos, nucleo, pasta_saida
**Saidas:**
- DXF georeferenciado em SIRGAS 2000 UTM 23S (coordenadas reais em model space)
- 17 layers padrao NTS 292 (REDE_ESGOTO, REDE_AGUA, PV_ESGOTO, PERFIL_*, CARIMBO, etc.)
- Planta escala H 1:500 com grade de coordenadas UTM
- Perfil longitudinal escala V 1:100 (primeiros 50 trechos)
- Simbologia SIGNOS (circulo + cruz para PV, circulo simples para PI)
- Carimbo SABESP (NTS 116)
- JSON metadados (norma, datum, escalas, requisitos_entrega)

#### gerar_ifc_lod500.py (184 linhas)
**O que faz:** Gera modelo IFC 3D real (LOD 500) para Navisworks/BIMVision/Solibri
**Entrada:** pvs, trechos, nucleo, pasta_saida
**Saidas:**
- **IFC 2x3** com geometria real:
  - Tubos: IfcSweptDiskSolid (cilindro oco, raio_ext=DN/2, raio_int=DN/2*0.9)
  - PVs: IfcExtrudedAreaSolid (cilindro, r=0.6m PV / 0.3m PI, h=profundidade)
- **PropertySets:**
  - Dados_Tecnicos (PV mont/jus, DN, material, extensao, declividade, tipo)
  - SABESP_Hidraulica (velocidade, vazao, tensao trativa, Manning n)
  - Custo5D (tubo, escavacao, reaterro, reposicao, PV, total)
  - Dados_PV (nome, tipo, CT, CF, prof, diametro, material, E, N)
- CSV com dados tabulares LOD 500
- JSON modelo BIM 5D completo

#### gerar_project_xml.py (276 linhas)
**O que faz:** Gera cronograma MS Project 2016+
**Entrada:** pvs, trechos, nucleo, pasta_saida, data_inicio
**Saida:** XML compativel MS Project com WBS de 12 fases:
1. Mobilizacao (5 dias fixo)
2. Topografia e Cadastro (extensao / 200m/dia / 2 equipes)
3. Escavacao (extensao / 30m/dia / 2 equipes)
4. Assentamento de Rede (extensao / 40m/dia / 2 equipes)
5. Execucao PVs/PIs (n_pvs / 0.5un/dia / 2 equipes)
6. Reaterro e Compactacao (extensao / 50m/dia / 2 equipes)
7. Reposicao de Pavimento (extensao / 60m/dia / 2 equipes)
8. Ligacoes Prediais (n_pvs / 3un/dia / 2 equipes)
9. Testes e Comissionamento (extensao / 200m/dia)
10. Cadastro As-Built NTS 292 (n_folhas / 2folhas/dia)
11. BIM LOD 500 / Navisworks (n_trechos / 10/dia)
12. Desmobilizacao (3 dias fixo)
**Recursos:** 10 tipos (topografo, encanador, pedreiro PV, operador, motorista, servente, engenheiro, desenhista, tecnico BIM, fiscal SABESP)

#### gerar_cronograma_macro.py (414 linhas)
**O que faz:** Cronograma multinucleo em 4 formatos
**Entrada:** Lista de nucleos com extensao e n_trechos
**Saidas:**
- MS Project XML (multinucleo)
- Primavera P6 XER
- OpenProject CSV
- JSON dados brutos
**Logica:** Nucleos iniciam com offset de 2 semanas (sobreposicao parcial)

#### gerar_pdf_perdas.py (314 linhas)
**O que faz:** Relatorio PDF profissional de gestao de perdas
**Entrada:** Relatorio dict (saida do motor_perdas)
**Saida:** PDF com secoes: Infraestrutura, UARL, Balanco Hidrico IWA, ILI, Estrategias

---

### 2.3 MOTORES DE CALCULO (7 modulos)

#### motor_custo.py (297 linhas)
**O que faz:** Calcula custos reais do contrato por trecho/nucleo
**Funcoes principais:**
- `custo_trecho(tr, pvs)` → detalhamento de custo de 1 trecho
- `custo_nucleo(pvs, trechos)` → custo total do nucleo
- `gerar_bm(trechos_executados, pvs, periodo)` → Boletim de Medicao
- `importar_tabela_precos(path)` → importa precos de CSV/JSON
**Composicao por metro (R$ 910/m com BDI 25%):**
- Escavacao: R$ 145/m
- Tubo ESG: R$ 240/m
- Tubo AG: R$ 95/m
- PVs: R$ 120/m
- Reaterro: R$ 80/m
- Ramal: R$ 65/m
- Pavimentacao: R$ 45/m
- Sinalizacao: R$ 15/m
- Subtotal: R$ 805/m + BDI 25% = R$ 910/m

#### motor_medicao.py (269 linhas)
**O que faz:** Acompanhamento de execucao e medicao mensal
**Funcoes principais:**
- `carregar_execucao_xlsx(path)` → le Excel de execucao diaria
- `gerar_resumo_execucao(dados)` → resumo por nucleo e mes
- `gerar_curva_s(trechos)` → Curva S previsto x realizado
- `gerar_boletim_medicao(trechos_exec, pvs, periodo, bm_num)` → BM formal
- `gerar_acompanhamento_semanal(dados, semana_ini, semana_fim)` → producao semanal
**Parametros:** 22 dias uteis/mes, custo_metro=R$ 910

#### motor_ml.py (247 linhas)
**O que faz:** Previsao de producao e analise de gargalos (XGBoost)
**Funcoes principais:**
- `prever_producao(dados_exec, dias_futuro)` → previsao rolling average
- `analisar_gargalos()` → pipeline 11 etapas com gargalos identificados
- `simular_cenario(cenario_idx, saldo_total_m)` → simulacao de aceleracao
- `gerar_relatorio_ml(dados_exec, saldo_total_m)` → relatorio completo
**Indicadores atuais:**
- 366 ligacoes/mes (atual) → Meta 2X: 733 → Meta SABESP: 1.000
- 6.1m de rede por ligacao
- Ciclo atual: 76 dias → Meta 2X: 40 dias
**5 cenarios de aceleracao simulados**

#### motor_lean_lps.py (475 linhas)
**O que faz:** Lean Construction + Last Planner System + BIM 6D
**Funcoes principais:**
- `calcular_6d_trecho(tr, pvs)` → custo ciclo de vida 50 anos + CO2
- `gerar_6d_nucleo(pvs, trechos)` → resumo 6D do nucleo
- `calcular_takt_time(trechos, equipes)` → takt, cycle time, throughput
- `mapear_fluxo_valor(trechos)` → value stream mapping (VA vs desperdicio)
- `criar_weekly_work_plan(ns_list, semana, equipes)` → planejamento semanal LPS
- `calcular_ppc(ns_planejadas, ns_executadas)` → Percent Plan Complete
- `gerar_lookahead(ns_list, semanas)` → lookahead 6 semanas com restricoes
**BIM 6D - Vida util por material:**
- PVC: 50 anos, 0.5% manutencao/ano, 3.2 kg CO2/m
- PEAD: 100 anos, 0.3% manut/ano, 2.8 kg CO2/m
- Concreto: 80 anos, 1.0% manut/ano, 12.5 kg CO2/m

#### motor_parametrico.py (318 linhas)
**O que faz:** Rede parametrica com recalculo em cascata
**Classe PipeNetwork:**
- `mover_pv(nome, x, y)` → recalcula extensao + declividade + Manning + custo
- `alterar_cota(nome, ct, cf)` → recalcula profundidade e propaga
- `alterar_dn(trecho_idx, dn)` → recalcula Manning + custo
- `alterar_material(trecho_idx, mat)` → recalcula Manning (n diferente por material)
- `adicionar_pv()`, `remover_pv()`, `adicionar_trecho()`, `remover_trecho()`
- `exportar()` / `from_json()` — serializa/deserializa
**Logica:** Mantem grafo de adjacencia; qualquer alteracao dispara _recalc_trecho() em todos os trechos conectados

#### motor_microplanejamento.py (465 linhas)
**O que faz:** Planejamento por frente de servico baseado em morfologia
**Funcoes principais:**
- `classificar_morfologia_trecho(tr, pvs)` → tipo de terreno
- `classificar_frente(tr)` → tipo de servico
- `micro_planejar_trecho(tr, pvs)` → equipamentos, equipe, duracao, custo, material
- `micro_planejar_nucleo(pvs, trechos, nucleo, equipes_max)` → plano completo
**5 tipos de morfologia com produtividades reais:**
| Morfologia | Prod (m/dia) | Fator Custo | Escavacao |
|------------|-------------|-------------|-----------|
| Planicie   | 25-35       | 1.00        | Mecanica  |
| Encosta    | 15-25       | 1.25        | Mista     |
| Morro      | 8-15        | 1.65        | Manual    |
| Mangue     | 5-10        | 2.10        | Rebaixamento + estaca-prancha |
| Viela      | 10-18       | 1.45        | 100% manual |

#### motor_perdas.py (611 linhas)
**O que faz:** Gestao de perdas de agua (metodologia IWA)
**Funcoes principais:**
- `balanco_hidrico(vol_produzido, vol_macro, vol_micro, ...)` → balanco IWA completo
- `calcular_uarl(rede_km, n_conexoes, ramal_km, pressao)` → perdas minimas inevitaveis
- `calcular_ili(perdas_reais, uarl)` → Infrastructure Leakage Index + classificacao
- `calcular_risco_trecho(tr, pvs)` → risco de ruptura por trecho
- `mapa_risco_nucleo(pvs, trechos)` → top 10 trechos criticos
- `analise_troca_vs_perda(ext, material, idade, pressao)` → trocar agora ou reparar?
- `criar_dma(pvs, trechos, n_setores)` → District Metering Areas
- `gerar_relatorio_perdas(pvs, trechos, nucleo)` → relatorio completo
**Coeficientes UARL (IWA):**
- Rede: 18 L/km/dia/mca
- Conexao: 0.8 L/conexao/dia/mca
- Ramal: 25 L/km ramal/dia/mca
**Vida util:** PVC 50a, PEAD 100a, FFD 80a, Concreto 80a, FoFo 60a

---

### 2.4 ORQUESTRADOR

#### construdata_pipeline.py (203 linhas)
**O que faz:** Detecta formato → executa pipeline completo de 6 etapas
**Entrada:** Arquivo DXF, DWG ou LandXML
**Saida:** Pasta SAIDA_NUCLEO/ com 5 subdiretorios:
```
SAIDA_NUCLEO/
  01_NS/              ← PDF A4 + JSON + HTML + GeoJSON por trecho
  02_CIVIL3D/         ← LandXML + Cadastro DXF + Dynamo + .scr
  03_CADASTRO_NTS292/ ← DXF as-built georref + Meta JSON
  04_BIM_LOD500/      ← IFC 2x3 + CSV LOD 500 + JSON
  05_CRONOGRAMA/      ← MS Project XML + Resumo JSON
  PIPELINE_RESULTADO.json
```

---

### 2.5 GUI DESKTOP (construdata_gui.py — 1.497 linhas)

#### Tab 1: PROCESSAR
- Selecao de arquivo (DXF/XML/JSON/DWG)
- Deteccao automatica de formato
- GPKG cartografia opcional
- Pasta de saida
- Botoes: PIPELINE COMPLETO | APENAS LER | BATCH NUCLEOS | BATCH PROLONGAMENTOS | ABRIR SAIDA | EDITOR HTML

#### Tab 2: MAPA
- Mapa Leaflet (tkintermapview) com satelite/rua
- Lista de trechos com selecao (Space/Enter = incluir/excluir)
- Validacao GPKG (cruza quadra = suspeito)
- Gerar NS dos selecionados
- ML: Salvar decisoes / Treinar / Predizer (XGBoost)

#### Tab 3: REDE
- Cards: PVs, Trechos, Extensao, Tipo, Motor, Ruas
- Tabela PVs: Nome, X, Y, CT, CF, Prof

#### Tab 4: HIDRAULICA
- Cards: OK, Verificar, Sem Dados, Manning n
- Tabela: NS, PV Ini/Fim, DN, Ext, Decl%, V(m/s), Q(l/s), Tau(Pa), Status

#### Tab 5: TRECHOS
- Tabela completa: NS, PV Ini/Fim, Rua, DN, Ext, Material, CT, CF, Prof, Custo R$

#### Tab 6: CUSTOS 5D
- Cards: Custo Total, R$/metro, BDI 25%, Trechos, Extensao, BMs
- Botoes: CALCULAR CUSTOS | GERAR BM | CURVA S | MICRO-PLAN | RELATORIO ML | CRONOGRAMA MACRO
- Tabela custos: NS, PVs, DN, Ext, Tubo R$, Escav R$, Reaterro R$, Repav R$, PV R$, TOTAL R$

#### Tab 7: BIM / CIVIL 3D
- Botoes geradores: GERAR TUDO | IFC LOD500 | LandXML | Cadastro NTS292 | Cadastro DXF | Cronograma | Dynamo | SCR
- Botoes HTML: Editor EPANET | Viewer 3D | Controle As-Built | RDO Diario | Gestao Perdas | Fluxograma

#### Tab 8: LEAN / LPS
- Cards: Takt (dias), Cycle Time, PPC (%), VA/NVA, CO2 (ton), Custo 50 anos
- Botoes: RELATORIO LEAN+LPS | TAKT TIME | LOOKAHEAD 6 SEM | BIM 6D (Ciclo Vida)
- Texto scrollavel com resultados JSON

#### Tab 9: PERDAS
- Cards: UARL (m3/ano), ILI, Classif., Risco Alto, DMAs, Perda R$/ano
- Botoes: RELATORIO PERDAS | MAPA RISCO | CRIAR DMAs | PDF PERDAS | ANALISE TROCA
- Texto scrollavel com resultados JSON

#### Tab 10: NUCLEOS
- Tabela nucleos DXF (6 nucleos ProSaneamento)
- Tabela prolongamentos LandXML (5 prolongamentos Civil 3D)
- Botoes: BATCH NUCLEOS DXF | BATCH PROLONGAMENTOS | BATCH TUDO

#### Tab 11: LOG
- Console com timestamps
- Botoes: Limpar | Copiar

---

### 2.6 INTERFACES HTML (6 arquivos)

#### construdata_editor.html (1.054 linhas)
**O que faz:** Editor de rede estilo EPANET no navegador
- Mapa Leaflet com satelite/rua/topo
- Ferramentas: Selecionar(V), Add PV(P), Tubo(T), Mover(M), Apagar(Del)
- Painel propriedades: CT, CF, DN, material (Manning tempo real)
- 4 abas: Propriedades | NS | Cadastro | Custo
- Import/Export JSON compativel com pipeline Python
- Atalhos teclado: P, T, V, M, Del, F, Ctrl+Z

#### construdata_manage.html (310 linhas)
**O que faz:** Viewer 3D da rede (Three.js)
- 5 modos: 3D | Custo (cor) | Hidraulica (cor) | DN (cor) | Timeline 4D
- Click em elemento → propriedades + custo
- Sliders: Z exaggeration (1-20x), Pipe scale (1-15x)
- Vistas: Planta | 3D perspectiva

#### construdata_controle.html (576 linhas)
**O que faz:** Controle de obra e medicao
- 4 abas: As-Built | Medicao (BM) | Curva S | Resumo 5D
- Tabela editavel (180+ NS com status)
- Graficos Curva S: previsto (verde) vs real (amarelo)
- Gerar Cadastro NTS 292 direto da interface

#### construdata_rdo.html (892 linhas)
**O que faz:** Relatorio Diario de Obra (RDO)
- Formulario diario: equipe, clima, atividades, producao
- Cards KPI: producao dia, acumulado, meta

#### construdata_perdas.html (524 linhas)
**O que faz:** Dashboard de gestao de perdas
- KPIs: UARL, ILI, NRW, custos
- Abas por metrica de perda

#### FLUXOGRAMA_BIM_5D.html (519 linhas)
**O que faz:** Fluxograma visual do pipeline BIM 5D

---

## 3. DADOS DO CONTRATO

### dados_contrato/DADOS_CONTRATO.json
- 22 materiais com precos SINAPI
- Composicao R$/m: R$ 805/m + BDI 25% = R$ 910/m
- Fatores unitarios: m3/m, un/m por material
- Saldo por nucleo (metros ESG + AG)

### dados_contrato/EXECUCAO_DIARIA.json
- 521 dias de execucao x 6 nucleos
- Campos: data, equipe, rua, ligacoes_agua, ligacoes_esgoto

### dados_contrato/ML_DATA.json
- Features XGBoost treinado
- Pipeline 11 etapas com gargalos

---

## 4. REDES PROCESSADAS E VALIDADAS

| Rede | Tipo | PVs | Trechos | Extensao | NS | Erros |
|------|------|-----|---------|----------|-----|-------|
| Pantanal Baixo | Esgoto | 165 | 137 | ~7.700m | 137 | 0 |
| Verde e Teteu | Esgoto | 357 | 180 | 2.621m | 180 | 0 |
| Joao Carlos | Esgoto | - | - | - | OK | 0 |
| Vila Criadores | Esgoto | - | - | - | OK | 0 |
| Sao Manoel | Esgoto | 20 | 16 | 1.275m | 16 | 0 |
| Vila Israel | Esgoto | - | - | - | OK | 0 |
| **Subtotal nucleos** | | | | | **378** | **0** |
| Prol. Teteu Alt-01 | XML | 147 | 141 | 6.363m | 141 | 0 |
| Prol. Teteu | XML | 149 | 143 | 6.420m | 143 | 0 |
| Prol. Pantanal | XML | 29 | 25 | 1.261m | 25 | 0 |
| Prol. Criadores | XML | 76 | 70 | 2.689m | 70 | 0 |
| Prol. Sao Manoel | XML | 91 | 79 | 5.143m | 79 | 0 |
| **Subtotal prolongamentos** | | **492** | **458** | **21.876m** | **458** | **0** |
| **TOTAL** | | | | **~39 km** | **836** | **0** |

### Validacao de referencia (Teteu Esgoto):
- Dimensional CSV: 61 PVs (PV_1 a PV_61), 67 trechos
- PV_01: CT=3.963 CF=2.863 prof=1.10 → **CONFIRMADO** no PS_PONTOS_IDENTIFICACAO_TXT

---

## 5. FORMATOS DE SAIDA

| Formato | Gerador | Compativel com |
|---------|---------|----------------|
| PDF A4 | gerar_ns.py | Impressao campo |
| PDF A3 (satelite+perfil) | gerar_ns.py | Escritorio |
| HTML Leaflet | gerar_ns.py | Navegador |
| GeoJSON | gerar_ns.py | QGIS, ArcGIS |
| LandXML 1.2 | gerar_civil3d.py | Civil 3D (Import LandXML) |
| DXF Cadastro | gerar_civil3d.py | AutoCAD, Civil 3D |
| Dynamo .py | gerar_civil3d.py | Dynamo for Civil 3D |
| AutoCAD .scr | gerar_civil3d.py | AutoCAD (Run Script) |
| DXF NTS 292 | gerar_cadastro_nts292.py | SABESP SIGNOS |
| IFC 2x3 LOD 500 | gerar_ifc_lod500.py | Navisworks, BIMVision, Solibri |
| CSV LOD 500 | gerar_ifc_lod500.py | Excel |
| MS Project XML | gerar_project_xml.py | MS Project 2016+ |
| Primavera P6 XER | gerar_cronograma_macro.py | Oracle Primavera P6 |
| OpenProject CSV | gerar_cronograma_macro.py | OpenProject |
| PDF Perdas | gerar_pdf_perdas.py | Impressao |
| JSON (dados) | Todos | Qualquer sistema |

---

## 6. REGRAS INVIOLAVEIS DA PLATAFORMA

1. Empresa: **FCN Construcoes e Saneamento** (NUNCA "FCN Construções e Saneamento")
2. Plataforma: **ConstruData - HydroNetwork**
3. Custos: tabela do contrato (importada), NAO SINAPI fixo
4. Medicao: por Nota de Servico (1 NS = 1 trecho)
5. Sempre agua + esgoto, nunca so um
6. CRS: EPSG:31983 (SIRGAS 2000 UTM 23S)
7. Cadastro NTS 292 = condicao para pagamento (contrato pag. 64)
8. CT pode ser negativo (Santos abaixo do nivel do mar)
9. CF > CT = possivel rede aerea (aviso, nao rejeitar)

---

## 7. DEPENDENCIAS

```
pip install geopandas pyogrio shapely scipy ezdxf pyproj
pip install ifcopenshell numpy matplotlib reportlab openpyxl
pip install tkintermapview contextily
```

Para DWG: libredwg (https://github.com/LibreDWG/libredwg)

---

## 8. COMO USAR

### Duplo-clique no ABRIR.bat
Abre a GUI desktop. Selecione DXF/XML/JSON/DWG → clique PIPELINE COMPLETO.

### Linha de comando
```bash
python construdata_pipeline.py PANTANAL_ESGOTO.dxf --nucleo "Pantanal Baixo"
python construdata_pipeline.py REDE.xml --saida ./SAIDA
```

### Batch (todos os nucleos)
```bash
python processar_prolongamentos.py
```

---

*Documento gerado em 23/03/2026 — ConstruData HydroNetwork v7.0*
*FCN Construcoes e Saneamento — Contrato 11481051 — SE LIGA NA REDE — Santos/SP*
