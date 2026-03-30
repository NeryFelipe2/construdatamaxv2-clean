# LOG_ADERENCIA_PLATAFORMA_20260328.md

Data: 2026-03-28

## Escopo

Auditoria da plataforma contra o arquivo canonico `SUPERLOG_CANONICO_PLATAFORMA.md`,
conforme orientacao de `CLAUDE.md`.

Base de comparacao:

- `SUPERLOG_CANONICO_PLATAFORMA.md`
- `CLAUDE.md`
- `construdata_pipeline.py`
- `construdata_gui.py`
- `gerar_ns.py`
- `gerar_xlsx.py`
- `ler_dxf_gdal.py`
- `ler_dwg_universal.py`

## Veredito

Status geral: PARCIALMENTE ADERENTE.

A parte critica de importacao DXF ProSane esta de acordo com o markdown canonico.
Os desvios principais estao na integracao do pipeline central, principalmente em
entradas `.json`, saidas ricas de NS, XLSX e no fluxo padrao de DWG universal.

## O que esta de acordo

### 1. Regras duras do DXF ProSane

Conforme `SUPERLOG_CANONICO_PLATAFORMA.md`:

- Nao inventar rede sem assinatura ProSane.
- Falhar com erro explicito quando faltar `PS_PONTOS_IDENTIFICACAO_TXT/PS_PONTOS`.
- Usar `PS_PONTOS_IDENTIFICACAO_LIN` como ancora real quando disponivel.

Confirmado em `ler_dxf_gdal.py`:

- `has_ps_pontos` e validacao de assinatura: linha 105
- erro duro por importacao nao confiavel: linhas 110 e 741
- ancoras de `PS_PONTOS_IDENTIFICACAO_LIN`: linha 190
- montagem por `snap_nomeado`: linha 402

### 2. Baseline atual do caso ProSane principal

Executado:

- `python -m pytest -q test_ler_dxf_gdal.py`
- `python -m py_compile ler_dxf_gdal.py test_ler_dxf_gdal.py`
- `python -X utf8 ler_dxf_gdal.py _tmp_teteu_esgoto.dxf`
- `python -X utf8 ler_dxf_gdal.py _tmp_dwg\\ESTUDO___CT_SAO_MANOEL_E_CT_JO.dxf`

Resultado observado:

- testes: `6 passed`
- `py_compile`: sem erro
- `_tmp_teteu_esgoto.dxf`: `274 PVs / 278 trechos`
- `_tmp_dwg\\ESTUDO___CT_SAO_MANOEL_E_CT_JO.dxf`: falha explicita sem inventar rede

Conclusao: a parte mais sensivel do markdown hoje esta cumprida.

### 3. Arquivos centrais existem de fato

Os arquivos listados como centrais no superlog existem e estao ativos:

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

## O que NAO esta 100% de acordo

### 1. Entrada `.json` nao esta integrada no pipeline central

O superlog afirma em "Entradas aceitas hoje" que a plataforma aceita:

- `.json` de rede definida

Estado real:

- `construdata_pipeline.py` aceita apenas `.xml`, `.dwg` e `.dxf` nas linhas 77, 80 e 84
- nao existe ramo `.json` no pipeline central
- `construdata_gui.py` aceita `.json` somente na linha 1503, e apenas se o modulo legado `v5` estiver disponivel

Impacto:

- o markdown esta mais amplo do que a integracao real do entrypoint principal
- o suporte a `.json` hoje e parcial e dependente do GUI/legado, nao da pipeline central

Falta para aderir:

- integrar `.json` em `construdata_pipeline.py`, ou
- restringir o markdown para deixar claro que `.json` e suporte condicional via GUI/v5

### 2. Saida de NS prometida pelo markdown nao e a que o pipeline central gera

O superlog afirma em "Saidas principais":

- `NS por trecho: PDF A4, PDF A3 desenho, PDF A3 satelite, HTML, JSON`
- `Saidas por nucleo: OSE, HTML de rede geral, GIS, BIM, cronograma, XLSX, logs`

Estado real do pipeline central:

- `construdata_pipeline.py` chama `gerar_ns()` nas linhas 99 a 101
- `gerar_ns()` em `gerar_ns.py` linha 184 gera apenas PDF A4 em lote
- a estrutura rica `CAMPO/ + PLANEJAMENTO/` existe em `processar_nucleo_from_data()` na linha 673, com saidas descritas nas linhas 687 a 689, mas nao e a funcao usada pelo pipeline central
- mesmo assim, o resumo impresso por `construdata_pipeline.py` nas linhas 161 a 165 fala em `JSON+PDF+HTML`, o que nao corresponde ao que `gerar_ns()` realmente entrega

Impacto:

- o markdown canonico descreve uma plataforma mais integrada do que o fluxo central realmente executa
- a pipeline principal hoje nao entrega o pacote rico de NS que o markdown sugere

Falta para aderir:

- trocar `gerar_ns()` por `processar_nucleo_from_data()` no pipeline central, ou
- ajustar o markdown e o resumo do pipeline para refletir o fluxo real atual

### 3. XLSX existe na plataforma, mas nao esta integrado no pipeline central

O superlog afirma:

- linha 77: saidas por nucleo incluem `XLSX`
- linha 88: `Geracao de NS, Civil 3D, IFC, cronograma e XLSX integrada`

Estado real:

- `gerar_xlsx.py` existe e possui geradores reais:
  - `gerar_xlsx_lean` linha 85
  - `gerar_xlsx_curva_s` linha 252
  - `gerar_xlsx_microplan` linha 309
  - `gerar_xlsx_custos` linha 399
  - `gerar_xlsx_hidraulica` linha 470
  - `gerar_xlsx_perdas` linha 537
- `construdata_gui.py` tem chamadas para geracao XLSX
- `construdata_pipeline.py` nao chama `gerar_xlsx.py`

Impacto:

- XLSX faz parte da plataforma, mas nao da pipeline central como o markdown da a entender

Falta para aderir:

- integrar `gerar_xlsx.py` no pipeline central, ou
- corrigir o superlog para separar "recursos da plataforma" de "saidas do pipeline central"

### 4. DWG universal existe, mas nao entrou no fluxo padrao de leitura

O superlog lista:

- `.dwg` Civil 3D/AEC via `ler_dwg_aec.py`
- `.dwg` universal via `ler_dwg_universal.py`

Estado real:

- `ler_dwg_universal.py` existe e expoe `ler_dwg_universal()` na linha 575
- `construdata_gui.py` tem acao dedicada para DWG universal nas linhas 318, 1713, 1736 e 1853
- o fluxo generico `_ler_arquivo()` da GUI manda `.dwg` para `ler_dwg_aec()` nas linhas 1499 a 1501
- `construdata_pipeline.py` tambem manda `.dwg` direto para `ler_dwg_aec()` na linha 80

Impacto:

- o suporte universal existe, mas nao e o comportamento padrao do importador principal
- isso reduz a aderencia do markdown se ele for lido como "entrada universal automatica"

Falta para aderir:

- integrar selecao AEC vs Universal no fluxo padrao, ou
- documentar que DWG universal hoje e um modo explicito, nao o padrao

### 5. A instrucao `--gui` do pipeline esta desatualizada

Estado real:

- `construdata_pipeline.py` linha 196 imprime: `GUI: abra construdata_gui.html no navegador`
- a interface ativa do repositorio e `construdata_gui.py`, nao um `construdata_gui.html` central

Impacto:

- onboarding errado
- risco de operador abrir caminho incorreto e concluir que a plataforma quebrou

Falta para aderir:

- corrigir a mensagem do `--gui`

## Conclusao objetiva

Se a pergunta for:

- "A regra critica do DXF ProSane esta de acordo com o markdown?"
  - Sim.
- "A plataforma inteira esta 100% de acordo com tudo o que o markdown canonico promete?"
  - Nao.

O principal que falta hoje nao e o motor DXF. O que falta e alinhar o entrypoint
central com o que o markdown canonico promete em integracao:

1. aceitar `.json` no pipeline central
2. gerar a estrutura rica de NS no pipeline central
3. integrar XLSX no pipeline central
4. incorporar DWG universal ao fluxo padrao ou documentar melhor seu escopo
5. corrigir a chamada de `--gui`

## Recomendacao

Nao apagar nem reescrever o `SUPERLOG_CANONICO_PLATAFORMA.md` com base neste log.
Use este arquivo como auditoria de aderencia.

Se for para fechar o gap de vez, a ordem correta e:

1. alinhar `construdata_pipeline.py` ao estado real desejado
2. validar novamente
3. so depois atualizar o superlog canonico se ainda houver diferenca
