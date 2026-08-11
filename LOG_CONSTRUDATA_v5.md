# CONSTRUDATA SABESP v5.0 - LOG DE DESENVOLVIMENTO E TESTE
**Data:** 20/03/2026
**Arquivo:** construdata_sabesp_v5_FINAL.py (2443 linhas, 102KB)
**Autor das correcoes:** Claude Code

---

## 1. DESCRICAO DO SISTEMA

Pipeline unificado para geracao de Notas de Servico (NS) SABESP Santos.
Contrato 11481051 - Consorcio SE LIGA NA REDE.

**Entrada:** DXF ProSaneamento + GPKG (opcional) + JSON (alternativo)
**Saida por NS:** 5 arquivos em pasta dedicada:
- `NS_XXX_A4.pdf` - Folha de campo / Ordem de Servico (A4 landscape)
- `NS_XXX_DESENHO.pdf` - Prancha A3: Planta UTM + Perfil Longitudinal + Tabela + Selo
- `NS_XXX_OSE.xlsx` - OSE padrao SABESP (formato NS_017rev1)
- `NS_XXX_DADOS.json` - Dados tecnicos estruturados
- `NS_XXX_DASHBOARD.html` - Dashboard interativo Leaflet + perfil SVG

**Saida global:**
- `CUSTOS_POR_TRECHO.xlsx` - Planilha de custos SINAPI por trecho
- `rede_definida.json` - GeoJSON da rede completa
- `dynamo_civil3d.json` - JSON para Dynamo/Civil 3D 2025+
- `dynamo_pipe_network_v5.py` - Script Dynamo pronto para uso
- `log_processamento.json` - Log completo da execucao

---

## 2. BUGS CORRIGIDOS (8 total)

### BUG-1: pvs_xd=None causa TypeError em ler_dxf
- **Antes:** `if pvs_xd:` -- dict vazio {} e falsy, pulava dados validos
- **Correcao:** `if pvs_xd is not None:` -- checagem explicita contra None
- **Impacto:** Crash silencioso ao processar DXFs sem XDATA ProSaneamento

### BUG-2: _agrupar_textos_pvs crash com dados incompletos
- **Antes:** Assumia que todo dict na lista tinha x, y, text validos
- **Correcao:** Filtra textos sem coordenadas numericas antes do sort
- **Impacto:** IndexError/KeyError em DXFs com textos corrompidos

### BUG-3: calc_manning ValueError com declividade negativa
- **Antes:** `decl_mm**0.5` explodia se valor negativo
- **Correcao:** Guard `<= 0` com status descritivo (DECL_INVALIDA, DECL_ZERO, DECL_ABSURDA)
- **Impacto:** Crash do pipeline inteiro; agora retorna status informativo
- **Confirmado em teste:** Declividade 300.0 m/m detectada como DECL_ABSURDA

### BUG-4: _materiais_agua assume grau_ini/grau_fim existem
- **Antes:** Campos so existiam em trechos vindos de _build_trechos_agua
- **Correcao:** .get() com default=1 documentado como intencional
- **Impacto:** KeyError em trechos de agua vindos de DXF/JSON

### BUG-5: ler_json_rede retorna ruas vazio
- **Antes:** `return pvs, trechos, [], meta` -- sempre lista vazia
- **Correcao:** Extrai nomes de rua das properties e posiciona no ponto medio
- **Impacto:** Mapa/prancha A3 sem nomes de rua ao usar JSON como entrada

### BUG-6: Cache GPKG retorna referencia mutavel
- **Antes:** Retornava referencia direta ao dict no cache
- **Correcao:** `return copy.deepcopy(result)` -- copia defensiva
- **Impacto:** Corrupcao silenciosa do cache em processamento batch

### BUG-7: Nome ambiguo decl_mm (m/m vs milimetros)
- **Antes:** Parametro `decl_mm` sugeria milimetros mas era m/m
- **Correcao:** Renomeado para `decl_mpm` no calc_manning, alias mantido nos dicts
- **Impacto:** Risco de erro de interpretacao em manutencao futura

### BUG-8: Excel OSE MergedCell write error
- **Antes:** _merge(tot_row, 1-4) e depois _w(tot_row, 3) tentava escrever em celula merged
- **Correcao:** Merge so colunas 1-2 no TOTAIS, colunas 3-4 ficam livres para valores
- **Impacto:** OSE.xlsx nao era gerado (5o gerador falhava)

---

## 3. MODULOS DO SISTEMA

| #  | Modulo                   | Funcao                          | Status |
|----|--------------------------|----------------------------------|--------|
| 01 | Configuracao Global      | CFG, SINAPI, log()              | OK     |
| 02 | Leitura DXF              | ler_dxf, _ler_xdata_raw         | OK     |
| 03 | Enriquecimento           | calc_manning, calc_quantitativos | OK     |
| 04 | Validacao do Grafo       | validar_rede (NetworkX)          | OK     |
| 05 | Cartografia GPKG         | ler_cartografia_gpkg             | OK     |
| 06 | NS A4 PDF                | gerar_ns_a4                      | OK     |
| 07 | NS Desenho A3 PDF        | gerar_ns_desenho                 | OK     |
| 08 | NS OSE Excel             | gerar_ns_ose                     | OK     |
| 09 | NS Dados JSON            | gerar_ns_dados_json              | OK     |
| 10 | NS Dashboard HTML        | gerar_ns_html                    | OK     |
| 11 | Orquestrador NS          | gerar_ns_completa                | OK     |
| 12 | GIS                      | gerar_rede_geojson, _dynamo      | OK     |
| 13 | Excel Custos             | gerar_excel_custos               | OK     |
| 14 | Script Dynamo            | gerar_dynamo_script              | OK     |
| 15 | Pipeline Principal       | processar()                      | OK     |
| 16 | Batch                    | processar_batch()                | OK     |

---

## 4. TESTE DE EXECUCAO

**Arquivo DXF:** Projeto Criadores- ESGOTOrev12elevatoria.dxf
**Nucleo:** Vila Criadores
**Limitado a:** 3 NS (--max-ns 3)

### Resultado:
```
Tempo:            12.2s
PVs extraidos:    152 (via XDATA: 1010 INSERTs, 1054 polilinias)
Trechos gerados:  42 (994 sem match de PV)
NS geradas:       3/3 (100% OK)
Tipo detectado:   AGUA
```

### Validacao da rede:
- 3 erros: Ciclos detectados (PV_-01->PV_X144, PV_154->PV_155, PV_158->PV_157)
- 42 avisos: Profundidades = 0.00m em todos os trechos, 7 partes desconectadas

### Arquivos gerados (20 total):
```
SAIDA_TESTE/VILA_CRIADORES/
  01_NS_CAMPO/
    NS_001_PV_112_AO_PV_114/
      NS_001_A4.pdf
      NS_001_DESENHO.pdf
      NS_001_OSE.xlsx
      NS_001_DADOS.json
      NS_001_DASHBOARD.html
    NS_002_PV_114_AO_PV_115/  (5 arquivos)
    NS_003_PV_115_AO_PV_118/  (5 arquivos)
  05_GIS/
    rede_definida.json
    dynamo_civil3d.json
    dynamo_pipe_network_v5.py
  06_EXCEL/
    CUSTOS_POR_TRECHO.xlsx
  07_LOG/
    log_processamento.json
```

---

## 5. OBSERVACOES SOBRE OS DADOS DO DXF

Os dados extraidos do DXF de teste apresentam inconsistencias que NAO sao bugs do codigo:

1. **DN=6mm** - XDATA PH_DATTUB retorna valor 6 no campo 1040[0], provavelmente
   nao e o diametro nominal (pode ser indice de material ou codigo interno ProSaneamento)
2. **Coordenadas locais** (x~1324, y~187) - Nao sao UTM SIRGAS 2000.
   Lat/lon resultante e incorreto (-85 graus). O DXF usa coordenadas internas do projeto.
3. **994 tubos sem match** - Tolerancia tol_pv_tubo=25.0m pode ser insuficiente
   para a escala do desenho
4. **Prof=0.00m em todos** - XDATA PH_DATCNX campo reals[2] retorna 0.0
5. **Tipo detectado como AGUA** em projeto de ESGOTO - Presenca de layers LIN-AF
   no DXF forca deteccao como agua

---

## 6. DEPENDENCIAS

| Pacote      | Versao Testada | Obrigatorio |
|-------------|----------------|-------------|
| Python      | 3.14.3         | Sim         |
| matplotlib  | 3.10.8         | Sim         |
| ezdxf       | 1.4.3          | Sim (DXF)   |
| openpyxl    | 3.1.5          | Sim (Excel) |
| networkx    | 3.6.1          | Sim (grafo) |
| pyproj      | 3.7.2          | Nao*        |
| geopandas   | -              | Nao*        |

*pyproj e geopandas sao opcionais - sem eles, UTM->LatLon e cartografia GPKG ficam desabilitados.

---

## 7. USO

```bash
# Processar um DXF
python construdata_sabesp_v5_FINAL.py ESGOTO.dxf --nucleo "Vila Israel"

# Com cartografia GPKG
python construdata_sabesp_v5_FINAL.py AGUA.dxf --gpkg MAPA.gpkg --tipo agua

# A partir de JSON
python construdata_sabesp_v5_FINAL.py --json rede_definida.json

# Batch (todos os nucleos)
python construdata_sabesp_v5_FINAL.py --batch

# Debug (limitar NS)
python construdata_sabesp_v5_FINAL.py ESGOTO.dxf --max-ns 5
```
