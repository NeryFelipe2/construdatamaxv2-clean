# PROMPT PARA CLAUDE CODE — CONSTRUDATA SUPER PLANEJADOR SLNR
# Cole este prompt no Claude Code (VS Code) para criar o sistema completo integrado

---

## CONTEXTO DO PROJETO

Você está trabalhando na plataforma **CONSTRUDATA ENGENHARIA** — um sistema de engenharia 
sanitária integrado que combina GIS, hidráulica, gestão de obras e planejamento.

O módulo a criar é o **SUPER PLANEJADOR SLNR Santos**, que faz parte do sistema ConstruData 
e deve se integrar com os módulos existentes (NS — Nota de Serviço, CADASTRO, HydroNetwork).

### Contexto da obra:
- **Contrato:** SE LIGA NA REDE — Consórcio SLNR Santos  
- **Cliente:** SABESP  
- **Escopo:** Instalação de redes de esgoto e água em 83+ núcleos de assentamentos irregulares em Santos/SP  
- **Dados:** GeoPackage com layers de redes, PVs e registros; Planilha Mestre Excel  
- **CRS:** SIRGAS 2000 UTM Zone 23S (EPSG:31983) — atenção: alguns arquivos têm label EPSG:4326 com dados UTM  

---

## O QUE VOCÊ DEVE CRIAR

### Estrutura de arquivos:
```
construdata/
├── modulos/
│   └── planejador/
│       ├── __init__.py
│       ├── leitor_geo.py          # Lê e valida GeoPackage (redes/pvs/registros)
│       ├── analisador.py          # Calcula saldo planejado × executado × a executar
│       ├── compras.py             # Gera lista de compras com catálogo de fornecedores
│       ├── exportador_excel.py    # Gera Excel multi-aba com xlsxwriter
│       ├── dashboard.py           # Gera HTML com Chart.js (construplan_brutal.html)
│       └── catalogo_fornecedores.py  # Base de dados de fornecedores editável
├── construdata_planner.py         # Entry point CLI (aceita .gpkg e .xlsx como args)
├── construdata_app.py             # Entry point Tkinter (UI desktop)
├── requirements.txt
└── README.md
```

---

## ESPECIFICAÇÕES FUNCIONAIS

### 1. LEITURA DO GEOPACKAGE (`leitor_geo.py`)
```python
# Deve:
# - Detectar automaticamente os layers (redes/pvs/registros) pelo nome
# - Corrigir CRS mislabeled (EPSG:4326 com dados UTM → forçar EPSG:31983)
# - Calcular comprimento da geometria se coluna "comprimento" estiver zerada/ausente
# - Normalizar coluna "status" para: EXECUTADO / EM ANDAMENTO / A EXECUTAR
# - Retornar GeoDataFrames prontos para análise
# - Logar cada etapa com timestamp

def ler_gpkg(gpkg_path: str, config: dict) -> tuple[gpd.GeoDataFrame, gpd.GeoDataFrame, gpd.GeoDataFrame]:
    """Retorna (gdf_redes, gdf_pvs, gdf_registros)"""
```

### 2. ANÁLISE DE SALDO (`analisador.py`)
```python
# Para REDES, calcular por (material × diâmetro):
#   - planejado_m, executado_m, em_andamento_m, a_executar_m, pct_exec
# Para PVS e REGISTROS, calcular por tipo:
#   - total, executado, em_andamento, a_executar, pct_exec
# Para cada NÚCLEO:
#   - extensao_total_m, executado_m, em_andamento_m, a_executar_m, pct_exec
# Retornar dicionário com todos os resultados

def analisar_redes(gdf: gpd.GeoDataFrame) -> dict:
    ...
def analisar_pvs(gdf: gpd.GeoDataFrame) -> dict:
    ...
def analisar_registros(gdf: gpd.GeoDataFrame) -> dict:
    ...
```

### 3. LISTA DE COMPRAS (`compras.py`)
```python
# Para TUBOS (status = EM ANDAMENTO ou A EXECUTAR):
#   - Agrupar por (material, diâmetro)
#   - Calcular: extensão_necessária_m, barras_6m, barras_12m
#   - Cruzar com catálogo de fornecedores
# Para PVS e REGISTROS pendentes:
#   - Agrupar por tipo, contar quantidade
#   - Cruzar com catálogo de fornecedores
# Saída: DataFrames prontos para Excel e PDF
```

### 4. EXCEL MULTI-ABA (`exportador_excel.py`)
```python
# Abas obrigatórias (engine: xlsxwriter):
# 1. "📊 PAINEL GERAL"      → KPIs + tabela de progresso por núcleo
# 2. "🔵 SALDO REDES"       → Saldo planejado × executado por material/diâmetro
# 3. "🛒 COMPRAS TUBOS"     → Lista de compras com fornecedor/prazo/especificação
# 4. "🔵 PVS"               → Saldo e compras de PVs
# 5. "🔴 REGISTROS"         → Saldo e compras de registros
# 6. "📋 FORNECEDORES"      → Catálogo completo de fornecedores
#
# Formatação CONSTRUDATA:
# - Header: bg #0A2342 (azul escuro), texto branco
# - Tabelas: header verde #1A6B3A, compras vermelho #C0392B
# - Formatação numérica brasileira (#.##0,00)
# - Colorir % execução: verde≥60%, laranja≥20%, vermelho<20%
# - Logotipo "CONSTRUDATA" no cabeçalho de cada aba
```

### 5. DASHBOARD HTML (`dashboard.py`)
```python
# Gera construplan_brutal.html com:
# - Visual dark mode, fundo #0A0E1A
# - 6 KPI cards no topo (extensão, executado, %, saldo, PVs, registros)
# - Gráfico doughnut: status geral (executado/andamento/a executar)
# - Gráfico bar horizontal: top 10 núcleos por % execução
# - Gráfico bar stacked: extensão por núcleo (total vs executado)
# - Tabela detalhada por núcleo com badges coloridos por %
# - Chart.js 4.4.2 via CDN, sem dependências externas
# - Responsive, mobile-friendly
# - Rodapé com timestamp e logotipo CONSTRUDATA
```

### 6. INTERFACE DESKTOP TKINTER (`construdata_app.py`)
```python
# UI desktop simples com:
# - Campo para selecionar GeoPackage (botão "Procurar...")
# - Campo para selecionar Planilha Mestre (botão "Procurar...")
# - Campo para pasta de saída
# - Checkbox: [x] Gerar Excel  [x] Gerar Dashboard  [x] Gerar PDF
# - Botão "▶ PROCESSAR" (grande, verde)
# - Log em tempo real (área de texto scrollável)
# - Barra de progresso
# - Ao terminar: botão "📂 Abrir pasta de saída"
# - Estilo: tema escuro, fonte Segoe UI, logotipo CONSTRUDATA no topo
```

### 7. CATÁLOGO DE FORNECEDORES (`catalogo_fornecedores.py`)
```python
# Dicionário editável com:
# - Chave: (material, diâmetro) para tubos, ou (tipo,) para PVs/registros
# - Valor: {fornecedor, contato, prazo_entrega_dias, especificacao, norma_tecnica}
# Incluir fornecedores reais do mercado brasileiro:
# - PVC: Tigre, Amanco Wavin
# - PEAD: Plastubos, Fortlev
# - Grés: São Simão Cerâmica  
# - Concreto: fornecedores locais Santos/SP
# - PVs: pré-moldados padrão SABESP
# - Registros: Rexnord Elster, Inoval, Durall
# Exportável como aba "FORNECEDORES" no Excel
```

---

## INTEGRAÇÃO COM CONSTRUDATA

O sistema DEVE se integrar com:

```python
# 1. Módulo NS (Nota de Serviço) — via localStorage (HTML) ou SQLite (desktop)
#    → Importar itens executados do NS para atualizar status no GeoPackage

# 2. Módulo CADASTRO — lê GeoPackage e atualiza atributos
#    → Compartilhar leitura do .gpkg com o Planejador

# 3. Módulo HydroNetwork — cálculos hidráulicos por trecho
#    → Exportar lista de trechos com diâmetros para o HydroNetwork calcular

# Interface de integração (usar eventos/callbacks ou arquivos JSON intermediários):
class IntegradorConstruData:
    def importar_do_ns(self, db_path: str) -> pd.DataFrame:
        """Importa execuções registradas no módulo NS"""
    
    def exportar_para_hydronetwork(self, gdf_redes: gpd.GeoDataFrame) -> dict:
        """Prepara dados para cálculo hidráulico"""
    
    def sincronizar_cadastro(self, gpkg_path: str) -> None:
        """Sincroniza status de execução com o cadastro GIS"""
```

---

## CONFIGURAÇÃO (`CONFIG`)

```python
# Arquivo: construdata/modulos/planejador/config.py
CONFIG = {
    # Arquivos padrão
    "gpkg_path"   : "tudo_feito_ate_março.gpkg",
    "mestre_path" : "MESTRE_SLNR_FINAL4.xlsx",
    
    # Mapeamento automático de layers (case-insensitive)
    "keywords_redes"    : ["rede","trecho","tubo","esgoto","agua","coletor","adutora"],
    "keywords_pvs"      : ["pv","poco","manhole","caixa","til"],
    "keywords_registros": ["registro","valvula","valve","hidrante","equipamento","acessorio"],
    
    # Colunas esperadas (adapta automaticamente se diferente)
    "col_nucleo"     : "nucleo",
    "col_status"     : "status",
    "col_material"   : "material",
    "col_diametro"   : "diametro",
    "col_comprimento": "comprimento",
    "col_tipo"       : "tipo",
    
    # CRS
    "crs_esperado" : "EPSG:31983",   # SIRGAS 2000 UTM 23S
    "force_crs"    : False,
    
    # Status padrão
    "status_executado"    : "EXECUTADO",
    "status_em_andamento" : "EM ANDAMENTO",
    "status_a_executar"   : "A EXECUTAR",
    
    # Saídas
    "excel_out"     : "CONSTRUDATA_PLANEJADOR.xlsx",
    "dashboard_out" : "construplan_brutal.html",
    "pdf_out"       : "CONSTRUDATA_RELATORIO.pdf",
    
    # Projeto
    "projeto"     : "SE LIGA NA REDE - SANTOS",
    "contrato"    : "Consórcio SLNR Santos",
    "empresa"     : "CONSTRUDATA ENGENHARIA",
    "responsavel" : "Felipe Nery",
    "cnpj"        : "XX.XXX.XXX/0001-XX",
}
```

---

## REQUISITOS TÉCNICOS

```
# requirements.txt
geopandas>=0.14.0
fiona>=1.9.0
pandas>=2.0.0
numpy>=1.24.0
xlsxwriter>=3.1.0
openpyxl>=3.1.0
shapely>=2.0.0
pyproj>=3.5.0
tkinter  # nativo Python
```

---

## REGRAS DE QUALIDADE DO CÓDIGO

1. **Todo código em português** (variáveis, funções, docstrings, comentários)
2. **Logging com timestamp** em todas as etapas principais
3. **Tratamento de erros robusto** — nunca deixar o programa travar silenciosamente
4. **Detecção automática** de nomes de colunas e layers (não hardcoded)
5. **Compatível com Windows** (paths, encoding UTF-8, tkinter)
6. **Nenhum servidor necessário** — roda 100% local, sem internet (exceto o CDN do Chart.js no HTML)
7. **Extensível** — fácil adicionar novos tipos de peças ou novas abas no Excel

---

## PASSO A PASSO DE EXECUÇÃO

```bash
# 1. Instalar dependências
pip install geopandas fiona pandas xlsxwriter openpyxl shapely pyproj

# 2. Rodar pela linha de comando
python construdata_planner.py tudo_feito_ate_março.gpkg MESTRE_SLNR_FINAL4.xlsx

# 3. Rodar pela interface gráfica
python construdata_app.py

# 4. Abrir saídas
# → CONSTRUDATA_PLANEJADOR.xlsx  (Excel com 6 abas)
# → construplan_brutal.html      (Dashboard — abrir no Chrome)
```

---

## ARQUIVO BASE

O arquivo `construdata_planner.py` já existe com a lógica central funcionando.
Refatore-o na estrutura de módulos acima, mantendo toda a lógica e ampliando com:
- Interface Tkinter
- Integração com Planilha Mestre (cruzar quantitativos planejados × GIS)
- Exportação PDF do relatório de saldo
- Seção de "Compras Urgentes" (prazo entrega > andamento da obra)

**IMPORTANTE:** Ao ler a Planilha Mestre, procurar por colunas como:
- "NUCLEO", "NÚCLEO", "NOME_NUCLEO"
- "QTD_PV", "QTD_PV_PROJ", "TOTAL_PV"  
- "EXT_REDE", "EXTENSÃO_PROJ", "COMP_TOTAL"
- "DIAMETRO", "MATERIAL_TUBO"
E fazer o cruzamento automático independente do nome exato da coluna.

---

*Prompt gerado por CONSTRUDATA ENGENHARIA · Felipe Nery · 19/03/2026*
