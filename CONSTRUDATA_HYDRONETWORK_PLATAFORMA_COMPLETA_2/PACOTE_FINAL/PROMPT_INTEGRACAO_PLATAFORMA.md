# PROMPT DE INTEGRAÇÃO — ConstruData HydroNetwork
## Como juntar todos os módulos na plataforma existente
### CT 11481051 · SABESP · SLNR Santos · FCN Construções e Saneamento
### Atualizado: Março 2026 · v10 · 10.619 linhas · 18 scripts · 6 HTML

---

> **REGRA #1:** NUNCA "DGS Engenharia" — sempre **FCN Construções e Saneamento**
> **REGRA #2:** Plataforma = **ConstruData - HydroNetwork**
> **REGRA #3:** Custos do **CONTRATO** (R$910/m), não SINAPI genérico

---

## 📁 ONDE ESTÃO OS ARQUIVOS

```
C:\Users\felip\Downloads\NOVA NS Versao 5\CONSTRUDATA_HYDRONETWORK_PLATAFORMA_COMPLETA\PACOTE_FINAL\
```

---

## 🧠 ARQUITETURA — COMO TUDO SE CONECTA

```
                    ┌─────────────────────────────────┐
                    │         ENTRADA (qualquer)       │
                    │  DXF · DWG · LandXML · Editor   │
                    └──────────────┬──────────────────┘
                                   │
                    ┌──────────────▼──────────────────┐
                    │    FORMATO INTERNO ÚNICO         │
                    │    pvs = { "PV01": {x,y,ct,cf} }│
                    │    trechos = [ {pv_ini,pv_fim,   │
                    │      dn_mm,ext_m,decl_mm} ]     │
                    └──────────────┬──────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────▼─────┐          ┌──────▼──────┐          ┌──────▼──────┐
    │ PARAMÉTRICO│          │  GERADORES  │          │  MOTORES    │
    │ Recálculo  │◄────────►│  NS · Civil │◄────────►│  Custo      │
    │ em cascata │          │  IFC · Crono│          │  Medição    │
    └─────┬─────┘          └──────┬──────┘          │  ML         │
          │                       │                  │  Lean/LPS   │
          │                       │                  │  Micro Plan │
          │                       │                  │  Perdas     │
          │                       │                  └──────┬──────┘
          │                       │                         │
          └───────────────────────┼─────────────────────────┘
                                  │
                    ┌─────────────▼──────────────────┐
                    │         INTERFACES HTML          │
                    │  Editor · 3D · Controle · RDO   │
                    │  Perdas · Fluxograma            │
                    └─────────────────────────────────┘
```

O ponto central é o **formato pvs + trechos**. Todo script lê ou gera esse formato.
Qualquer GUI (HTML, Tkinter, PyQt, web) consome o mesmo JSON.

---

## 🔗 COMO CADA MÓDULO SE CONECTA COM CADA MÓDULO

### Passo 1: LEITURA (escolha 1 — resultado é sempre pvs + trechos)

```python
# Opção A: DXF ProSaneamento
from scripts.ler_dxf_gdal import ler_dxf_gdal
pvs, trechos, ruas, meta = ler_dxf_gdal("NUCLEO.dxf")

# Opção B: DWG Civil 3D (AEC Proxy)
from scripts.ler_dwg_aec import ler_dwg_aec
pvs, trechos, meta = ler_dwg_aec("PROLONGAMENTO.dwg")

# Opção C: LandXML
from scripts.ler_landxml import ler_landxml
pvs, trechos = ler_landxml("EXPORT_C3D.xml")

# Opção D: JSON do Editor HTML
import json
with open("rede.json") as f:
    data = json.load(f)
pvs, trechos = data["pvs"], data["trechos"]
```

### Passo 2: REDE PARAMÉTRICA (wrapper sobre pvs + trechos)

```python
from scripts.motor_parametrico import PipeNetwork

rede = PipeNetwork(pvs, trechos)

# Qualquer alteração recalcula em cascata:
rede.mover_pv("PV01", novo_x=362300, novo_y=7352570)
# → ext recalcula → decl recalcula → Manning recalcula → custo recalcula

rede.alterar_cota("PV01", ct=5.2, cf=3.7)
# → profundidade recalcula → escavação recalcula → custo recalcula

rede.alterar_dn(0, 300)
# → Manning recalcula → velocidade/vazão/tensão trativa atualiza

# Alertas automáticos:
alertas = rede.trechos_com_alerta()
# → V > 5 m/s, V < 0.6 m/s, τ < 1 Pa, declividade negativa, prof > 5m

# Exportar de volta para JSON padrão:
data = rede.exportar()  # {"pvs": {...}, "trechos": [...]}
```

### Passo 3: GERAR SAÍDAS (cada gerador consome pvs + trechos)

```python
from scripts.gerar_ns import gerar_ns_a4, gerar_geojson, enriquecer_trechos

# NS de campo
trechos_enr = enriquecer_trechos(trechos, pvs)
for i, tr in enumerate(trechos_enr):
    gerar_ns_a4(i+1, tr, pvs, "Verde e Teteu", f"NS_{i+1:03d}.pdf")
gerar_geojson(trechos_enr, pvs, "rede.geojson")

# Civil 3D
from scripts.gerar_civil3d import gerar_landxml, gerar_cadastro_dxf, gerar_dynamo_script, gerar_autocad_scr
gerar_landxml(pvs, trechos, "Verde e Teteu", "esgoto.xml")
gerar_cadastro_dxf(pvs, trechos, "Verde e Teteu", "./cadastro/")
gerar_dynamo_script(pvs, trechos, "Verde e Teteu", "criar_pipe.py")
gerar_autocad_scr(pvs, trechos, "Verde e Teteu", "desenhar.scr")

# Cadastro NTS 292
from scripts.gerar_cadastro_nts292 import gerar_cadastro_nts292
gerar_cadastro_nts292(pvs, trechos, "Verde e Teteu", "./cadastro_nts/")

# IFC LOD 500 (geometria 3D real — SweptDiskSolid + ExtrudedAreaSolid)
from scripts.gerar_ifc_lod500 import gerar_ifc_lod500
gerar_ifc_lod500(pvs, trechos, "Verde e Teteu", "./ifc/")
# → IFC com PropertySets: Dados_Tecnicos + SABESP_Hidraulica + Custo5D

# Cronograma por núcleo
from scripts.gerar_project_xml import gerar_project_xml
gerar_project_xml(pvs, trechos, "Verde e Teteu", "./crono/")
```

### Passo 4: CRONOGRAMA MACRO (todos os núcleos)

```python
from scripts.gerar_cronograma_macro import gerar_tudo

nucleos = [
    {"nome": "Verde e Teteu",  "extensao_m": 2621,  "n_trechos": 180, "equipes": 3},
    {"nome": "São Manoel",     "extensao_m": 1275,  "n_trechos": 16,  "equipes": 2},
    {"nome": "Vila Israel",    "extensao_m": 11509, "n_trechos": 861, "equipes": 3},
    {"nome": "Pantanal Baixo", "extensao_m": 6720,  "n_trechos": 189, "equipes": 3},
    {"nome": "Vila Criadores", "extensao_m": 4138,  "n_trechos": 130, "equipes": 2},
    {"nome": "João Carlos",    "extensao_m": 3000,  "n_trechos": 100, "equipes": 2},
]

wbs, paths = gerar_tudo(nucleos, "2026-04-01", "./cronograma/")
# → Gera 4 arquivos: .xml (MS Project) + .xer (Primavera P6) + .csv (OpenProject) + .json
```

### Passo 5: MOTOR DE CUSTO (preços reais do contrato)

```python
from scripts.motor_custo import custo_trecho, custo_nucleo, gerar_bm

# Custo de 1 trecho (8 itens detalhados + BDI 25%)
c = custo_trecho(trechos[0], pvs)
# → c["itens"] = [{servico, qtd, preco_unit, valor}, ...]
# → c["total"] = R$ 16.001,18 (exemplo)
# → c["custo_por_metro"] = R$ 973,90

# Custo do núcleo inteiro
cn = custo_nucleo(pvs, trechos, "Verde e Teteu")
# → cn["total"] = R$ 2.592.048,38

# Boletim de Medição
trechos_exec = [t for t in trechos if t.get("status") == "executado"]
bm = gerar_bm(trechos_exec, pvs, "Mar/2026", bm_num=3)
# → bm["total"] = soma dos trechos COM cadastro NTS 292

# Importar tabela de preços customizada:
from scripts.motor_custo import importar_tabela_precos
tabela = importar_tabela_precos("precos_contrato.csv")
c = custo_trecho(trechos[0], pvs, tabela)
```

### Passo 6: MOTOR DE MEDIÇÃO (execução real → BM → Curva S)

```python
from scripts.motor_medicao import (
    carregar_execucao_xlsx, gerar_resumo_execucao,
    gerar_curva_s, gerar_boletim_medicao
)

# Carregar dados reais da planilha de execução
dados = carregar_execucao_xlsx("Execução_Geral.xlsx")
# → 6 núcleos × 500+ dias cada

resumo = gerar_resumo_execucao(dados)
# → por_nucleo: {M_TETEU: {dias, lig_agua, lig_esg, prod_dia}}
# → por_mes: {2025-11: {lig_agua, lig_esg, dias}}

curva = gerar_curva_s(trechos, dados, custo_metro=910)
# → previsto: [{mes, pct_acum, custo_acum}]
# → realizado: [{mes, lig_acum, pct_acum}]
```

### Passo 7: MOTOR ML (predição de produção)

```python
from scripts.motor_ml import gerar_relatorio_ml

rel = gerar_relatorio_ml(dados, saldo_total_m=25730)

# Previsão:
# → rolling_3d: 12.5 lig/dia (feature mais importante do XGBoost)
# → prod_mes: 275 lig/mês
# → tendência: +3.2%

# Cenários de aceleração:
# → Atual: 366/mês → 12 meses
# → Pipeline 2X: 733/mês → 6 meses (R$180k/mês invest)
# → Full SABESP: 1000/mês → 5 meses (R$450k/mês)
# → Só automação: 450/mês → 10 meses (R$25k/mês)

# Gargalos: Projeto(10d), Execução(15d), Lavagem(7d), SABESP(15d)
```

### Passo 8: LEAN + LPS + BIM 6D

```python
from scripts.motor_lean_lps import (
    gerar_relatorio_lean_lps, calcular_takt_time,
    criar_weekly_work_plan, calcular_ppc, gerar_lookahead,
    analisar_razoes_nao_conclusao, get_6d_properties
)

rel = gerar_relatorio_lean_lps(pvs, trechos, dados, "Verde e Teteu")

# LEAN:
# → Takt time: 3.3 m/dia/equipe
# → Cycle time: 9 dias/NS
# → Eficiência fluxo: 28% (meta: 50%+)

# LPS — Weekly Work Plan:
ns_list = [{"id": f"NS_{i+1}", "pv_ini": t["pv_ini"], "pv_fim": t["pv_fim"],
            "ext_m": t["ext_m"], "restricoes": [], "prioridade": i}
           for i, t in enumerate(trechos)]

wwp = criar_weekly_work_plan(ns_list, "2026-W13", equipes_disponiveis=6)
# → 30 NS planejadas, distribuídas por dia e equipe

# PPC (Percent Plan Complete):
ppc = calcular_ppc(
    ns_planejadas=["NS_001","NS_002","NS_003"],
    ns_executadas=["NS_001","NS_003"]
)
# → ppc = 66.7% → ACEITÁVEL

# Lookahead 6 semanas:
look = gerar_lookahead(ns_list)
# → Identifica restrições por semana, urgência de make-ready

# Razões de não-conclusão (Pareto):
hist = [{"semana":"W12","ns_nao_concluidas":[
    {"ns":"NS_002","razao":"material"},
    {"ns":"NS_005","razao":"chuva"}
]}]
pareto = analisar_razoes_nao_conclusao(hist)
# → top3: material(40%), chuva(30%), equipe(20%)

# BIM 6D — PropertySet para IFC:
props = get_6d_properties("PVC", ext_m=14.5, custo_impl=13000)
# → {Vida_Util_Anos:50, CO2_kg:46.4, Custo_Ciclo_Vida:16250, Reciclavel:True}
```

### Passo 9: MICRO-PLANEJAMENTO (morfologia + recursos)

```python
from scripts.motor_microplanejamento import (
    micro_planejar_nucleo, micro_planejar_trecho,
    classificar_morfologia_trecho, NUCLEOS_MORFOLOGIA
)

resultado = micro_planejar_nucleo(pvs, trechos, "Verde e Teteu", equipes_max=4)

# Por morfologia:
# → Morro: 65% (1708m) → 3 equipes especializadas, 8m/dia, escoramento obrigatório
# → Encosta: 17% (447m) → 1 equipe mista, mini-retro
# → Planície: 18% (465m) → 1 equipe padrão, retroescavadeira

# Material just-in-time consolidado:
# → Tubo PVC DN200: 2342m | Areia: 655m³ | CBUQ: 2306m²

# Recomendações automáticas por tipo de terreno
for rec in resultado["recomendacoes"]:
    print(f"[{rec['prioridade']}] {rec['tipo']}: {rec['equipes']}eq → {rec['extensao']}m")
```

### Passo 10: GESTÃO DE PERDAS

```python
from scripts.motor_perdas import (
    gerar_relatorio_perdas, balanco_hidrico,
    calcular_uarl, calcular_ili, mapa_risco_nucleo,
    analise_troca_vs_perda, criar_dma, get_perdas_properties
)

# Relatório completo (rede nova — preventivo):
rel = gerar_relatorio_perdas(pvs, trechos, "Verde e Teteu", pressao_media=35)
# → UARL: 37.262 L/dia | 4 DMAs | Custo projetado: R$ 362k/ano

# Com dados de macromedição (rede operando):
rel = gerar_relatorio_perdas(pvs, trechos, "Verde e Teteu",
    vol_produzido=45000, vol_micromedido=28000, pressao_media=35)
# → NRW: 36.7% | ILI: 12.01 (RUIM) | Receita perdida: R$ 140k/mês

# Análise trocar vs manter:
an = analise_troca_vs_perda(ext_m=500, material_atual="Ferro Fundido",
    idade_anos=35, pressao_mca=35, material_novo="PEAD")
# → Payback: 136 anos → MANTER (ainda não compensa)

# PDF do relatório:
from scripts.gerar_pdf_perdas import gerar_pdf_perdas
gerar_pdf_perdas(rel, "relatorio_perdas.pdf", "Verde e Teteu")

# PropertySet IFC para gestão de perdas:
props = get_perdas_properties("PVC", 200, ext_m=14.5, idade_anos=0, pressao_mca=35)
# → {Taxa_Falha_km_ano:0.05, Prob_Ruptura_Ano:0.001, UARL_Contribuicao:9.1}
```

---

## 🎨 GUI — DESIGN DE REFERÊNCIA

Os 6 HTMLs em `html/` são o design de referência. Se criar gui.py, replicar:

| HTML | Função | Visual |
|------|--------|--------|
| `construdata_editor.html` | Editor rede estilo EPANET | Fundo #06060f, verde #00ff88, toolbar 56px esquerda, Leaflet centro, painel 380px direita, 4 abas |
| `construdata_manage.html` | Viewer 3D | Three.js, 5 modos (3D/Custo/Hidráulica/DN/Timeline) |
| `construdata_controle.html` | Controle obra | As-Built tabela editável + Medição BM + Curva S + Resumo 5D |
| `construdata_rdo.html` | RDO diário | NS vinculadas + custos por serviço + ocorrências + fotos + PDF |
| `construdata_perdas.html` | Perdas água | Balanço IWA + UARL/ILI gauge + risco ruptura + DMAs + análise econômica |
| `FLUXOGRAMA_BIM_5D.html` | Fluxograma | 7 fases do sistema, blocos clicáveis |

**Tema:** escuro (#06060f). **Fonts:** Manrope + JetBrains Mono. **Acento:** verde #00ff88 (esgoto), azul #00aaff (água), azul #00b4ff (perdas).

---

## 📊 FORMATO INTERNO (pvs + trechos) — NÃO ALTERAR

```python
pvs = {
    "PV01": {
        "x": 362293.456,      # Easting UTM SIRGAS 2000 23S
        "y": 7352565.123,      # Northing
        "ct": 5.20,            # Cota Terreno (m)
        "cf": 3.70,            # Cota Fundo (m)
        "tipo": "esgoto",      # "esgoto" | "agua"
        "material_pv": "CONCRETO",
    },
}

trechos = [
    {
        "pv_ini": "PV01",      # PV montante
        "pv_fim": "PV02",      # PV jusante
        "dn_mm": 200,          # Diâmetro nominal (mm)
        "ext_m": 14.5,         # Extensão (m)
        "decl_mm": 8.5,        # Declividade (‰)
        "material": "PVC",     # PVC | PEAD | PE 80 | PE 100 | CONCRETO
        "tipo": "esgoto",      # "esgoto" | "agua"
    },
]
```

---

## 🧮 CONSTANTES DO CONTRATO

```python
# Composição R$/metro (R$ 910/m com BDI)
COMPOSICAO = {
    "escavacao": 145, "tubo_esg": 240, "tubo_ag": 95, "pv_caixas": 120,
    "reaterro": 80, "ramal": 65, "pavimentacao": 45, "sinalizacao": 15,
}
BDI = 0.25  # 25%

# Preços unitários materiais
"Tubo PVC DN200": R$ 200,12/m   "Tubo PVC DN300": R$ 310/m
"PV concreto":    R$ 3.686/un   "PI plástico":    R$ 1.412/un
"PEAD DN63":      R$ 85/m       "PEAD DN110":     R$ 101,80/m
"Areia":          R$ 160/m³     "CBUQ definitivo":R$ 120/m²

# Manning n
PVC=0.013  PEAD=0.011  Concreto=0.015

# Morfologia produtividade (m/dia/equipe)
Planície=30  Encosta=20  Morro=12  Mangue=7  Viela=14

# Vida útil (BIM 6D)
PVC=50 anos  PEAD=100 anos  Concreto=80 anos
```

---

## 🔬 REDES PROCESSADAS E VALIDADAS

| Rede | Tipo | PVs | Trechos | Extensão | Status |
|------|------|-----|---------|----------|--------|
| Verde e Teteu | Esgoto | 357 | 180 | 2.621m | ✅ Pipeline completo |
| Pantanal | Esgoto+Água | 654 | 561 | 14.686m | ✅ Lido |
| Criadores | Água | 122 | 130 | 4.138m | ✅ Lido |
| Teteu | Água | 337 | 346 | 4.813m | ✅ Lido |
| Israel | Água | 812 | 861 | 11.509m | ✅ Lido |
| São Manoel | Esgoto | 20 | 16 | 1.275m | ✅ AEC desbloqueado |

**Total: 2.302 PVs · 2.094 trechos · ~39 km**

---

## 💡 PARA O CLAUDE CODE

1. **Leia este prompt INTEIRO antes de começar**
2. **Leia os scripts** — entenda as funções e seus retornos
3. **Leia os HTMLs** — esse é o visual de referência
4. **Se for criar gui.py:** mesmo tema escuro, mesmas cores, mesmo fluxo
5. **Se for evoluir scripts:** manter interface `pvs, trechos = leitor(arquivo)` e `paths = gerador(pvs, trechos, nucleo, out_dir)`
6. **NUNCA quebrar** o formato pvs + trechos
7. **NUNCA usar** "DGS Engenharia"
8. **Testar** com dados reais (Verde e Teteu)
9. Os HTMLs usam **localStorage** (RDO salva localmente). Para persistir de verdade, migrar para SQLite ou API.
10. O `motor_parametrico.py` é a **classe central** (`PipeNetwork`) — GUI deve instanciar ela e chamar métodos que recalculam em cascata.

---

## 📋 CHECKLIST DE INTEGRAÇÃO

```
[ ] Leitor DXF funciona com todos os DXFs do projeto
[ ] Leitor DWG desbloqueia AEC Proxy dos prolongamentos
[ ] NS gera PDF A4 + JSON + HTML + GeoJSON
[ ] Civil 3D gera LandXML importável
[ ] IFC abre no Navisworks/BIMVision com PropertySets
[ ] Cronograma importa no MS Project / Primavera P6
[ ] Motor Custo calcula com preços do contrato (não SINAPI)
[ ] Motor Medição gera BM com regra cadastro pág.64
[ ] Motor ML prevê produção com rolling 3d
[ ] LPS gera Weekly Work Plan com PPC
[ ] Micro-planejamento classifica morfologia por cota
[ ] Motor Perdas calcula UARL + ILI + DMA
[ ] PDF de perdas gera relatório profissional
[ ] Editor HTML import/export JSON compatível com pipeline
[ ] RDO vincula NS + custos + fotos + ocorrências
[ ] Todos os módulos usam pvs + trechos como formato único
```
