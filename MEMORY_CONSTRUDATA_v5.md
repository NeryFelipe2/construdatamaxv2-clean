# MEMORY - CONSTRUDATA SABESP v5.0

## Contexto do Projeto
- **Sistema:** ConstruData BIM SABESP v5.0
- **Contrato:** 11481051 - Consorcio SE LIGA NA REDE
- **Cidade:** Santos-SP
- **Tipo:** Pipeline unificado para geracao de Notas de Servico (NS) para cadastro tecnico de redes de agua e esgoto

## O que o script faz
Pipeline que le DXF ProSaneamento (ou JSON), extrai PVs e tubulacoes, calcula hidraulica (Manning), quantitativos de vala, custos SINAPI, valida o grafo da rede, e gera 5 arquivos por NS + custos + GIS + Dynamo.

## Arquivos gerados por NS
| Arquivo | Descricao |
|---------|-----------|
| NS_XXX_A4.pdf | Ordem de Servico - folha de campo A4 landscape |
| NS_XXX_DESENHO.pdf | Prancha A3 - Planta UTM + Perfil + Tabela + Selo |
| NS_XXX_OSE.xlsx | OSE padrao SABESP formato NS_017rev1 |
| NS_XXX_DADOS.json | Dados tecnicos estruturados |
| NS_XXX_DASHBOARD.html | Dashboard interativo Leaflet + perfil SVG |

## Arquivos globais
| Arquivo | Descricao |
|---------|-----------|
| CUSTOS_POR_TRECHO.xlsx | Custos SINAPI com BDI por trecho |
| rede_definida.json | GeoJSON da rede |
| dynamo_civil3d.json | JSON para Civil 3D 2025/2026 Dynamo |
| dynamo_pipe_network_v5.py | Script Python para Dynamo |
| log_processamento.json | Log completo |

## Bugs corrigidos nesta versao (8 total)
1. **BUG-1:** `pvs_xd=None` causava TypeError - corrigido com `is not None`
2. **BUG-2:** `_agrupar_textos_pvs` crashava com textos sem x/y - adicionado filtro
3. **BUG-3:** `calc_manning` ValueError com declividade negativa - guard com status descritivo
4. **BUG-4:** `_materiais_agua` assumia grau_ini/grau_fim - default=1 documentado
5. **BUG-5:** `ler_json_rede` retornava ruas vazio - agora extrai do GeoJSON
6. **BUG-6:** Cache GPKG mutavel - agora retorna deepcopy
7. **BUG-7:** Nome ambiguo `decl_mm` - renomeado para `decl_mpm` no calculo
8. **BUG-8:** Excel OSE MergedCell error - merge corrigido no TOTAIS row

## Estrutura de modulos
```
Mod 01: Configuracao Global (CFG, SINAPI, log)
Mod 02: Leitura DXF ProSaneamento (XDATA raw + ezdxf fallback)
Mod 03: Enriquecimento (Manning, quantitativos, custos)
Mod 04: Validacao do grafo (NetworkX - ciclos, afogamento, sifoes)
Mod 05: Cartografia GPKG (quadras, ruas, eixos)
Mod 06: gerar_ns_a4 - PDF A4 campo
Mod 07: gerar_ns_desenho - PDF A3 prancha
Mod 08: gerar_ns_ose - Excel OSE
Mod 09: gerar_ns_dados_json - JSON dados
Mod 10: gerar_ns_html - Dashboard HTML
Mod 11: gerar_ns_completa - Orquestrador
Mod 12: GIS (GeoJSON + Dynamo JSON)
Mod 13: Excel Custos
Mod 14: Script Dynamo Civil 3D
Mod 15: Pipeline principal (processar)
Mod 16: Batch (processar_batch)
```

## Dependencias
- Python 3.14+
- matplotlib, ezdxf, openpyxl, networkx (obrigatorios)
- pyproj, geopandas (opcionais - UTM->LatLon e GPKG)

## Teste realizado
- **DXF:** Projeto Criadores- ESGOTOrev12elevatoria.dxf
- **Resultado:** 152 PVs, 42 trechos, 3 NS geradas (100% OK), 12.2s
- **20 arquivos** gerados na estrutura de pastas SABESP

## Uso rapido
```bash
python construdata_sabesp_v5_FINAL.py ESGOTO.dxf --nucleo "Nome"
python construdata_sabesp_v5_FINAL.py --json rede.json
python construdata_sabesp_v5_FINAL.py --batch
```

## Nucleos configurados no batch
- Sao Manoel (esgoto + agua)
- Vila Criadores
- Pantanal Baixo
- Morro do Teteu
- Vila Israel
- Joao Carlos

## Observacoes importantes
- Coordenadas do DXF podem ser locais (nao UTM) - verificar datum
- XDATA ProSaneamento: campo 1040[0] pode nao ser DN em todos os projetos
- Tolerancia de snap PV-tubo (25m) pode precisar ajuste por projeto
- Deteccao agua/esgoto automatica pode falhar se DXF tem layers mistas
