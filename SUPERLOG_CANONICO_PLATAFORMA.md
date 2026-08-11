# SUPERLOG CANONICO DA PLATAFORMA

Data de consolidacao: 2026-03-28
Repositorio de trabalho: `NOVA NS Versao 5`
Objetivo: ser a fonte canonica de contexto para reduzir releitura de markdowns, evitar regressao repetida e cortar gasto de tokens em sessoes futuras.

---

## 1. Como usar este arquivo

Leia este arquivo primeiro.

Nao abra todos os `.md` do projeto por padrao.

Abra documentacao adicional so quando o assunto exigir:
- DXF ProSane: `ler_dxf_gdal.py`, `test_ler_dxf_gdal.py`
- DWG/Civil 3D/BIM: `ler_dwg_aec.py`, `ler_dwg_universal.py`, `FLUXO_PLATAFORMA_ATUAL.md`
- GUI: `construdata_gui.py`, `GUI_ATUALIZADA_DWG_UNIVERSAL.md`
- Pipeline/saidas: `construdata_pipeline.py`, `gerar_ns.py`, `FLUXO_PLATAFORMA_ATUAL.md`
- Contrato/motores/planejamento: `VERIFICACAO_PLATAFORMA.md`, `MANUAL_DEFINITIVO_PLATAFORMA.md`

Se este arquivo conflitar com markdown historico, este arquivo vence.

---

## 2. Fonte de verdade atual

- Nome preferido da plataforma: `ConstruData HydroNetwork`
- Contrato: `11481051 - SE LIGA NA REDE - Santos/SP`
- Empresa correta: `FCN Construcoes e Saneamento`
- Formato interno sagrado: `pvs + trechos`
- Regra dura de DXF ProSane: nao inventar tubos nem PVs
- Regra dura de importacao: sucesso silencioso sem topologia confiavel e proibido

### Formato interno sagrado

```python
pvs = {
    "PV_01": {"x": ..., "y": ..., "ct": ..., "cf": ..., "prof": ...},
}

trechos = [
    {"pv_ini": "PV_01", "pv_fim": "PV_02", "dn_mm": 200, "ext_m": 14.5},
]
```

Todos os leitores, geradores e motores devem convergir para esse formato.

---

## 3. Estado atual consolidado

### Entradas aceitas hoje

- `.dxf` ProSaneamento via `ler_dxf_gdal.py`
- `.dwg` Civil 3D/AEC via `ler_dwg_aec.py`
- `.dwg` universal via `ler_dwg_universal.py`
- `.xml` LandXML via `ler_landxml.py`
- `.json` de rede definida

### Arquivos centrais de producao

- `ler_dxf_gdal.py`
- `ler_landxml.py`
- `ler_dwg_aec.py`
- `ler_dwg_universal.py`
- `gerar_ns.py`
- `gerar_civil3d.py`
- `gerar_ifc_lod500.py`
- `gerar_xlsx.py`
- `construdata_pipeline.py`
- `construdata_gui.py`

### Saidas principais

- NS por trecho: PDF A4, PDF A3 desenho, PDF A3 satelite, HTML, JSON
- Saidas por nucleo: OSE, HTML de rede geral, GIS, BIM, cronograma, XLSX, logs
- Pacotes Civil 3D: LandXML, DXF NTS292, Dynamo, SCR, JSON

---

## 4. Linha do tempo resumida

### Base da plataforma

- 2026-03-21 a 2026-03-23: consolidacao do pipeline HydroNetwork
- Leitores principais estabilizados: DXF GDAL, LandXML, DWG AEC
- Geracao de NS, Civil 3D, IFC, cronograma e XLSX integrada
- GUI desktop e HTMLs consolidados

### Expansao operacional

- 2026-03-23 a 2026-03-26: analytics, SLNR, multi-contrato, custos, medicao, campo, planejamento, WhatsApp/campo, status e GUIs novas
- Commits recentes indicam evolucao para v8/v9/v10 de GUI e gestao

### DXF/DWG da rodada atual

- 2026-03-27: tentativa de ampliar leitura DXF para multi-software com fallback generico
- 2026-03-27: criados docs e ferramentas de diagnostico DXF/DWG
- 2026-03-27/28: rollback do fallback generico para casos sem assinatura ProSane
- 2026-03-28: `PS_PONTOS_IDENTIFICACAO_LIN` passou a ser usado como ancora real de rotulo no DXF ProSane

---

## 5. Decisoes tecnicas que nao podem regredir

### 5.1 DXF ProSane nao pode inventar rede

- Se faltar `PS_PONTOS_IDENTIFICACAO_TXT` ou `PS_PONTOS`, a importacao deve abortar
- DXF BIM/Civil 3D exportado como geometria generica nao deve ser tratado como ProSane
- Mensagem de erro deve orientar para `DWG semantico` ou `LandXML`

### 5.2 Topologia ProSane deve partir da rede real

- Tubos reais devem vir das layers de tubo
- Labels de ponto nao podem definir conectividade por conta propria
- `PS_PONTOS_IDENTIFICACAO_LIN` e a referencia correta para ligar texto ao no real quando disponivel

### 5.3 Documentacao historica nao pode virar regra automatica

- Ha varios `.md` com versoes, nomes e escopos conflitantes
- Arquivo historico e util para contexto, mas nao pode sobrescrever o estado atual do codigo

### 5.4 Validacao minima obrigatoria apos mudanca

- `python -m pytest -q test_ler_dxf_gdal.py`
- `python -m py_compile ler_dxf_gdal.py test_ler_dxf_gdal.py`
- Teste real com `_tmp_teteu_esgoto.dxf`
- Teste negativo com `_tmp_dwg\\ESTUDO___CT_SAO_MANOEL_E_CT_JO.dxf`

---

## 6. Baselines atuais que servem de regua

### DXF ProSane - TETEU ESGOTO

Arquivo: `_tmp_teteu_esgoto.dxf`

- GDAL leu `50.239` entidades
- Tubos validos: `502`
- Clusters de endpoints: `661`
- Grupos de textos PS_PONTOS: `438`
- Ancoras de leader line aceitas: `354`
- Resultado atual: `274 PVs / 278 trechos`
- Cobertura do modo `snap_nomeado`: `61,8%`
- DNs preenchidos: `230/278`
- Mismatch geometrico final: `15/278`

### Regua dimensional local

Arquivo: `_tmp_teteu_dimensional.csv`

- Pares de referencia extraidos do CSV: `413`
- Pares importados pelo leitor atual: `278`
- Pares corretos: `185`
- Precisao: `0,665`
- Recall: `0,448`

### Caso negativo obrigatorio

Arquivo: `_tmp_dwg\\ESTUDO___CT_SAO_MANOEL_E_CT_JO.dxf`

- Deve falhar com erro explicito
- Motivo esperado: ausencia de `PS_PONTOS_IDENTIFICACAO_TXT/PS_PONTOS`
- Nao pode cair em fallback que gere PV/trecho sintetico

---

## 7. Docs historicos, uteis e perigosos

### Canonicos para leitura ampla

- `SUPERLOG_CANONICO_PLATAFORMA.md` <- este arquivo
- `FLUXO_PLATAFORMA_ATUAL.md`
- `VERIFICACAO_PLATAFORMA.md`
- `SUPERLOG_COMPLETO_SESSAO.md`
- `SUPERLOG_MIGRACAO_CONSTRUDATA.md`

### Uteis, mas parciais

- `MANUAL_DEFINITIVO_PLATAFORMA.md`
- `LER_DWG_UNIVERSAL_README.md`
- `GUI_ATUALIZADA_DWG_UNIVERSAL.md`
- `RELATORIO_REVISAO_DOCUMENTACAO.md`

### Historicos ou parcialmente obsoletos

- `README.md`
  - usa identidade antiga (`FCN Construções e Saneamento`, `v5.0`)
- `CLAUDE.md` antigo
  - tinha regras e numeros defasados do DXF/Teteu
- `RELATORIO_CORRECOES_DXF.md`
  - defendia fallback generico para DXF sem assinatura ProSane
- `RESUMO_EXECUTIVO_DXF.md`
  - reflete a mesma fase experimental do fallback generico
- `TUDO_CONCLUIDO_RESUMO.md`
  - descreve o estado intermediario de 27/03/2026, nao o estado final seguro

---

## 8. Ordem minima de leitura por assunto

### Se o problema for DXF ProSane

1. Ler este arquivo
2. Ler `ler_dxf_gdal.py`
3. Ler `test_ler_dxf_gdal.py`
4. Ler `RELATORIO_REVISAO_DOCUMENTACAO.md`
5. So depois abrir markdown historico de DXF, se faltar contexto

### Se o problema for DWG/BIM/Civil 3D

1. Ler este arquivo
2. Ler `FLUXO_PLATAFORMA_ATUAL.md`
3. Ler `ler_dwg_aec.py` e `ler_dwg_universal.py`
4. Ler `LER_DWG_UNIVERSAL_README.md`

### Se o problema for GUI

1. Ler este arquivo
2. Ler `construdata_gui.py`
3. Ler `GUI_ATUALIZADA_DWG_UNIVERSAL.md`

### Se o problema for negocio, contrato ou planejamento

1. Ler este arquivo
2. Ler `VERIFICACAO_PLATAFORMA.md`
3. Ler `MANUAL_DEFINITIVO_PLATAFORMA.md`
4. Ler somente o modulo afetado

---

## 9. Protocolo anti-gasto de tokens

- Nao enviar para a LLM 10 markdowns quando 1 basta
- Sempre informar o arquivo-alvo e o criterio de sucesso numerico
- Sempre carregar primeiro o `superlog`, depois o codigo, depois 1 doc especifico
- Tratar docs historicos como contexto, nao como verdade
- Registrar deltas curtos apos cada rodada importante
- Preservar baselines numericos para evitar rediscutir o que ja foi medido
- Promover procedimento repetido para checklist curto, nao para texto longo

### Prompt minimo recomendado para sessoes futuras

```text
Leia primeiro SUPERLOG_CANONICO_PLATAFORMA.md.
Problema alvo: <arquivo ou fluxo>.
Nao releia markdown historico sem necessidade.
Criterio de sucesso: <numero/arquivo/teste>.
Regras duras: nao inventar rede; erro explicito se importacao nao for confiavel.
```

---

## 10. Template de delta para manter este arquivo vivo

Use este bloco no fim de cada rodada grande:

```text
Data:
Objetivo:
Arquivos alterados:
Antes:
Depois:
Validacao:
Riscos em aberto:
```

---

## 11. Ultimo delta consolidado

### 2026-03-28 - DXF ProSane com ancora real de leader line

Objetivo:
- melhorar aderencia quantitativa do DXF ProSane sem reabrir fallback que inventa rede

Arquivos alterados:
- `ler_dxf_gdal.py`
- `test_ler_dxf_gdal.py`
- `CLAUDE.md`
- `SUPERLOG_CANONICO_PLATAFORMA.md`

Antes:
- `TETEU_ESGOTO`: `264 PVs / 249 trechos`
- `157` pares corretos contra a CSV local
- docs de 27/03 voltavam a defender fallback generico para DXF sem assinatura ProSane

Depois:
- `TETEU_ESGOTO`: `274 PVs / 278 trechos`
- `185` pares corretos
- precisao `0,665`, recall `0,448`
- DXF sem `PS_PONTOS` volta a abortar explicitamente

Validacao:
- `6 passed` em `pytest`
- `py_compile` ok
- caso positivo e negativo executados localmente

Risco em aberto:
- ainda ha gap relevante para bater toda a planilha dimensional
- proxima rodada deve atacar os pontos sem ancora valida e ambiguidades restantes de topologia

