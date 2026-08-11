# Status - Ciclo Operacional Offline ConstruData / NOVA NS V5

Data: 2026-04-26  
Base: `C:\Users\felip\Downloads\NOVA NS Versao 5`  
Escopo: planejamento semanal, validacao de diretor, RDO, desvios, ML/regras e replanejamento offline.

## Decisao Principal

Esta entrega foi adaptada para rodar **tudo no computador**, dentro do software offline NOVA NS V5.

Nao foi criado HTML novo. A integracao atual fica pronta para:

- API local FastAPI;
- banco local SQLite via SQLAlchemy;
- consumo por GUI Python existente;
- motores internos do ConstruData offline.

## Fluxo Implementado

```text
Planejamento semanal do engenheiro
-> validacao do diretor
-> RDO diario
-> comparacao planejado x realizado
-> desvios automaticos
-> ML/fallback deterministico
-> replanejamento em rascunho
-> validacao/aplicacao pelo diretor
-> novo plano oficial
```

## Arquivos Envolvidos

### Alterados nesta fase

- `api/server.py`
  - Registrou o router operacional local.
  - Nao possui rota HTML nova.

- `api/routes_rdo.py`
  - O POST de RDO agora tenta gerar desvios automaticamente apos criar o RDO.
  - Se a geracao de desvios falhar, grava log operacional e nao quebra a criacao do RDO.
  - Aceita `clima` como texto simples ou objeto.
  - Aceita `apontamentos` simples e converte para o formato interno `servicos` do motor RDO.

- `api/routes_operational.py`
  - Endpoints locais de log, planejamento, validacao, desvios, ML e replanejamento.
  - Ajuste de serializacao para salvar listas/dicionarios em campos texto do SQLite sem quebrar.

- `api/operational.py`
  - Log operacional.
  - Geracao de desvios do RDO contra planejamento ativo.
  - Matching simples entre atividade planejada e servico apontado no RDO.
  - Calculo de PPC, SPI, CPI, desvio fisico, desvio de custo, severidade e acao recomendada.

- `ui_operational_cycle.py`
  - Aba nativa Tkinter do Ciclo Operacional Offline.
  - Nao usa HTML.
  - Mostra resumo por nucleo, planejamentos, desvios, logs e replanejamentos.
  - Possui botao para recalcular ML/regras.

- `ui_construdata_modules.py`
  - Adiciona os modulos do ConstruData online como abas nativas offline.
  - Nao remove as 13 abas existentes do NS.
  - Nao usa HTML.
  - Cada modulo carrega um snapshot local por nucleo e mostra resumo/KPIs iniciais.

- `construdata_gui.py`
  - Registrou a aba nativa `Ciclo Operacional`.
  - Registrou as novas abas nativas do ConstruData offline.

- `construdata_gui_premium.py`
  - Registrou a aba nativa `Ciclo Operacional`.
  - Registrou as novas abas nativas do ConstruData offline.

### Criados/estruturados pela etapa anterior Antigravity

- `core/models.py`
  - Modelos SQLAlchemy do ciclo operacional.

- `api/operational.py`
  - Base do motor operacional.

- `api/routes_operational.py`
  - Base dos endpoints operacionais.

## Tabelas Offline

As tabelas do ciclo operacional ficam em SQLite local. Nomes reais no modelo atual:

- `operational_log`
- `planejamento_semanal`
- `planejamento_item`
- `planejamento_validacao`
- `desvio_planejamento`
- `ml_execucao`
- `replanejamento`

O RDO continua usando o modelo existente do software:

- `rdos`
- apontamentos/itens vinculados ao RDO conforme engine atual.

## Endpoints Locais Disponiveis

### Logs

- `POST /api/logs`
- `GET /api/nucleos/{nucleo}/logs`

### Planejamento Semanal

- `GET /api/nucleos/{nucleo}/planejamentos-semanais`
- `POST /api/nucleos/{nucleo}/planejamentos-semanais`
- `POST /api/nucleos/{nucleo}/planejamentos-semanais/{plan_id}/validar`

### Desvios

- `GET /api/nucleos/{nucleo}/desvios`

### ML / Regras

- `POST /api/nucleos/{nucleo}/ml/recalcular-desvios`

### Replanejamento

- `GET /api/nucleos/{nucleo}/replanejamentos`
- `POST /api/nucleos/{nucleo}/replanejamentos/{replanejamento_id}/validar`

### RDO Existente com Integracao Nova

- `POST /api/rdo`
  - Cria RDO pelo motor existente.
  - Em seguida tenta gerar `desvios_planejamento`.
  - Retorna `desvios_planejamento` no payload de resposta.

## Teste Offline Ja Realizado

O ciclo foi testado sem mexer no banco real, usando SQLite temporario.

Banco temporario usado no primeiro teste:

```text
C:\Users\felip\AppData\Local\Temp\ns5_operacional_rtu8jah3.db
```

Banco temporario usado no teste final apos integrar GUI/RDO:

```text
C:\Users\felip\AppData\Local\Temp\ns5_operacional_codex_smoke.db
```

Teste executado:

1. Criado planejamento semanal para nucleo `CODEX_TEST_OFFLINE`.
2. Validado como diretor, mudando para status `ATIVO`.
3. Criado RDO com producao menor que a meta.
4. RDO gerou 1 desvio automaticamente.
5. Consulta de desvios retornou:
   - `realizado = 4.0`
   - `ppc = 40.0`
6. Rodado endpoint de ML/regras.
7. Criado 1 replanejamento em rascunho.
8. Aba nativa carregou resumo sem HTML e sem quebrar com banco vazio.

Resultado:

```text
API local funcionando em modo offline.
Planejamento -> Validacao -> RDO -> Desvio -> ML/Regras -> Replanejamento funcionando.
```

## Exemplo De Payload Para Criar Planejamento

```json
{
  "semana_inicio": "2026-04-27",
  "semana_fim": "2026-05-03",
  "engenheiro": "Icaro",
  "responsavel": "Icaro",
  "observacao": "Plano semanal Tatui",
  "itens": [
    {
      "atividade": "Assentamento tubo",
      "meta_quantidade": 10,
      "unidade": "m",
      "equipe_prevista": 4,
      "custo_previsto": 1000,
      "data_inicio": "2026-04-27",
      "data_fim": "2026-04-30",
      "restricoes": ["liberacao de material"]
    }
  ]
}
```

## Exemplo De Validacao Pelo Diretor

```json
{
  "aprovado": true,
  "diretor": "Felipe Nery",
  "observacao": "Plano aprovado"
}
```

## Exemplo De RDO Para Gerar Desvio

```json
{
  "data": "2026-04-25",
  "nucleo": "CODEX_TEST_OFFLINE",
  "encarregado": "Teste",
  "clima": "Bom",
  "observacoes": "RDO de teste",
  "apontamentos": [
    {
      "servico": "Assentamento tubo",
      "quantidade": 4,
      "unidade": "m",
      "equipe": "Equipe A",
      "equipamentos": "Retro",
      "custo_total": 500
    }
  ]
}
```

## O Que Ja Esta Pronto

- Contrato offline de planejamento semanal.
- Validacao de plano por diretor.
- Log operacional local.
- Criacao automatica de desvios apos RDO.
- Calculo inicial de PPC, SPI, CPI e severidade.
- ML/fallback deterministico para risco e acoes.
- Replanejamento em rascunho.
- Aplicacao de replanejamento como novo plano oficial.
- API local pronta para ser chamada pelo GUI Python.
- Aba nativa `Ciclo Operacional` plugada no GUI normal e premium.
- RDO mais tolerante para payload simples de campo.
- As 13 abas originais do NS foram preservadas.
- Foram adicionadas 14 abas novas do ConstruData:
  - Torre de Controle
  - Planejamento
  - Planejamento Mestre
  - RDO
  - RDOs WhatsApp
  - Projetos
  - Gestao 360
  - Suprimentos
  - Mao de Obra
  - Equipamentos
  - Contatos
  - DRE / Financeiro
  - EVM / Curva S
  - WhatsApp RDO

## Historico Do Que Ainda Faltava

1. **Evoluir o painel nativo do GUI Python**
   - A aba inicial ja existe.
   - Falta adicionar formulario completo de criacao de planejamento diretamente pela tela.
   - Falta botao visual para aprovar/rejeitar planejamento e aplicar replanejamento.
   - As novas abas existem como paineis nativos de resumo/KPI; falta evoluir cada uma para operacao completa por clique.

2. **Mapear todos os motores online para offline**
   - RDO
   - tarefas
   - LPS/restricoes
   - dashboard
   - Gestao 360
   - Torre de Controle
   - custos/DRE/EVM
   - contatos/equipe

3. **Persistencia detalhada do RDO**
   - O ciclo ja usa o RDO atual.
   - Falta expandir a leitura detalhada para maquinas, materiais, mao de obra, locacoes, fotos e localizacao caso estes campos ja existam em outros motores do offline.

4. **XGBoost real**
   - Hoje o fluxo usa fallback deterministico quando nao ha massa historica suficiente.
   - O XGBoost deve entrar quando houver historico local robusto.

5. **Teste integrado com GUI**
   - O teste atual foi API/local.
   - Ainda falta testar pelo clique real dentro do software desktop.

Observacao 2026-04-26: os blocos posteriores deste arquivo ja entregam parte relevante desta lista: ciclo operacional por clique, shell ConstruData unificado, RDO detalhado, exportacao Markdown e acoes de fechar/exportar na tela RDO.

## Rollback Seguro

Rollback de codigo:

1. Remover de `api/server.py`:

```python
from api.routes_operational import router as operational_router
app.include_router(operational_router)
```

2. Remover de `api/routes_rdo.py` a chamada a:

```python
gerar_desvios_rdo(...)
log_operational_event(...)
```

3. Manter as tabelas no SQLite ate confirmar backup.

Rollback destrutivo so com backup validado:

```sql
drop table if exists replanejamentos;
drop table if exists ml_execucoes;
drop table if exists desvios_planejamento;
drop table if exists planejamento_validacoes;
drop table if exists planejamento_itens;
drop table if exists planejamentos_semanais;
drop table if exists operational_logs;
```

## Proxima Acao Recomendada

Evoluir a aba nativa `Ciclo Operacional` para permitir operacao completa por clique:

- criar planejamento semanal;
- validar/rejeitar planejamento;
- aplicar/rejeitar replanejamento;
- abrir RDOs relacionados;
- filtrar por nucleo, severidade e status;
- ligar tarefas/LPS offline ao mesmo ciclo.


## Correcao De Arquitetura GUI - ConstruData Shell

A primeira versao das abas do ConstruData ficou superficial porque criava muitos paineis soltos no Notebook. A correcao aplicada troca esse modelo por uma aba unica `ConstruData`, com comportamento parecido com o frontend web:

- sidebar interna por secoes;
- seletor de projeto ativo;
- cards de KPI;
- area principal por modulo;
- projetos canonicos offline independentes de Nota de Servico;
- NS, RDO, planejamento, desvios, custos e logs entram como dados do projeto, nao como raiz da plataforma.

As 13 abas originais do NS continuam preservadas. A plataforma offline passa a ter uma aba `ConstruData` com os modulos do web dentro dela, em vez de 14 abas soltas.


## Evolucao Operavel Do Shell ConstruData

A aba `ConstruData` deixou de ser apenas painel textual. Foram adicionadas telas operaveis iniciais dentro do shell offline:

- `Projetos`: tabela visual dos 6 projetos canonicos, com troca de contexto por selecao.
- `Planejamento`: formulario para criar planejamento semanal em rascunho e botao para validacao de diretoria.
- `RDO`: formulario para criar RDO local, gerar desvios automaticamente e recalcular ML/regras.
- `Torre Controle`: tabela de logs/desvios com resumo operacional.
- `Contatos`: tabela local inicial de al?adas e papeis.

Teste de motor executado com banco temporario:

```text
plan 1 valid 1 rdo 1 desvios 1 ml_ok True
kpis {'projetos': 6, 'frentes_ns': 0, 'rdos': 1, 'planos': 1, 'desvios': 1, 'ppc': 40.0, 'custo': 0, 'equipe': 0, 'logs': 2}
```

Isso confirma que o GUI agora consegue criar dados operacionais sem depender de Nota de Servico. A NS segue como motor tecnico dentro do projeto, nao como pre-requisito da plataforma.


## Backbone 100% Offline - Entidades Operacionais

Foi adicionada a camada local `core/construdata_offline.py`, com tabelas SQLite para a plataforma funcionar sem depender apenas da Nota de Servico:

- `cdm_projeto`
- `cdm_contato`
- `cdm_tarefa`
- `cdm_lps_restricao`
- `cdm_suprimento`
- `cdm_mao_obra`
- `cdm_equipamento`
- `cdm_custo`
- `cdm_agenda`
- `cdm_punch_item`
- `cdm_whatsapp_log`

A aba `ConstruData` agora usa esse backbone para criar/listar dados reais nos modulos:

- Projetos
- Contatos
- Tarefas / Planejamento Mestre / Fluxo Operacional
- LPS / Restricoes
- Suprimentos
- Mao de Obra
- Equipamentos
- Custos / DRE
- Agenda
- Punch List
- WhatsApp Logs

Teste de smoke executado com banco temporario:

```text
projects 6
created {'tarefas': 1, 'lps': 1, 'suprimentos': 1, 'mao_obra': 1, 'equipamentos': 1, 'custos': 1, 'agenda': 1, 'punch': 1, 'whatsapp': 1}
counts {'tarefas': 1, 'lps': 1, 'suprimentos': 1, 'mao_obra': 1, 'equipamentos': 1, 'custos': 1, 'agenda': 1, 'punch': 1, 'whatsapp': 1, 'contatos': 13}
```

Isso fecha a base estrutural offline dos principais modulos do ConstruData.


## API Local ConstruData Offline

Foi adicionada a API local do backbone offline:

- `GET /api/offline/projetos`
- `GET /api/offline/contatos`
- `GET /api/offline/projetos/{project_id}/dashboard`
- `GET /api/offline/projetos/{project_id}/{entity}`
- `POST /api/offline/projetos/{project_id}/{entity}`
- `PATCH /api/offline/{entity}/{row_id}/status`

Entidades aceitas:

- `tarefas`
- `lps`
- `suprimentos`
- `mao_obra`
- `equipamentos`
- `custos`
- `agenda`
- `punch`
- `whatsapp`

Teste API executado:

```text
api_ok 200 {'ok': True, 'id': 1} {'tarefas': 1, 'lps': 0, 'suprimentos': 0, 'mao_obra': 0, 'equipamentos': 0, 'custos': 0, 'agenda': 0, 'punch': 0, 'whatsapp': 0, 'contatos': 13}
```


## Snapshot / Health / Relatorio 360 Completo

Mudanca deste bloco:

- `core/construdata_offline.py` ganhou `offline_health()` e `project_snapshot(project_id)`.
- O Relatorio 360 agora usa snapshot estruturado e inclui todas as entidades offline principais.
- A API local ganhou:
  - `GET /api/offline/health`
  - `GET /api/offline/projetos/{project_id}/snapshot`
  - `GET /api/offline/projetos/{project_id}/relatorio360`
  - `POST /api/offline/projetos/{project_id}/relatorio360/export`
- A tela `Gestao 360` passou a mostrar health local, totais de custo e botao de exportacao do Relatorio 360.
- A tela `Relatorio 360` passou a exibir o markdown real que sera exportado.
- `Contatos` virou cadastro offline real no GUI e na API, com `POST /api/offline/contatos`.
- O Relatorio 360 agora inclui a secao `Contatos / Alcadas`.

Validacao executada:

```text
py_compile OK
health True 7 13
counts 1 1
totals 123.45
report True True
api 200 200 200 1 True
contacts 14 200 True True True True
```

Rollback:

- Remover `offline_health`, `project_snapshot`, `_to_public_dict`, `_public_value` e `ENTITY_REPORT_TITLES` de `core/construdata_offline.py`.
- Remover as rotas `/health` e `/snapshot` de `api/routes_construdata_offline.py`.
- Remover `create_contact` e `POST /api/offline/contatos` se quiser voltar contatos para somente leitura.
- Em `ui_construdata_modules.py`, voltar `_render_gestao` e `_render_relatorio` para as versoes anteriores de contagem simples.


## Pacote RDO Detalhado Copiado Para NOVA NS

Origem:

```text
C:\Users\felip\Downloads\construdatamaxv2-clean\PACOTE_COPIAR_PARA_NOVA_NS_RDO_DETALHADO_20260426
```

Destino:

```text
C:\Users\felip\Downloads\NOVA NS Versao 5
```

Arquivos substituidos:

- `ui_construdata_modules.py`
- `campo\rdo_engine.py`

Efeito esperado:

- RDO do GUI passa a capturar producao, equipe, maquinas, equipamentos, locacoes, materiais, custos, ocorrencias, paralisacoes, foto e localizacao.
- O RDO detalhado espelha recursos no backbone offline: mao de obra, equipamentos, suprimentos, custos, LPS e log WhatsApp.

Rollback operacional:

1. Restaurar `ui_construdata_modules.py` para a versao anterior ao pacote.
2. Restaurar `campo\rdo_engine.py` para a versao anterior ao pacote.
3. Revalidar:

```powershell
python -m py_compile ui_construdata_modules.py campo\rdo_engine.py
```

Validacao executada apos copiar:

```text
py_compile OK
rdo 1 desvios 0
counts 2 3 2 7 2 1
```

Interpretacao dos counts do RDO detalhado:

- `mao_obra`: 2 registros espelhados
- `equipamentos`: 3 registros espelhados (maquina, equipamento e locacao)
- `suprimentos`: 2 materiais espelhados
- `custos`: 7 custos espelhados
- `lps`: 2 restricoes/ocorrencias espelhadas
- `whatsapp`: 1 log offline do RDO

## Ultra Handover Copiado E Validado

Arquivo copiado para a pasta real:

```text
C:\Users\felip\Downloads\NOVA NS Versao 5\ULTRA_HANDOVER_NOVA_NS_RDO_DETALHADO_20260426.md
```

Validacao recomendada no proprio handover executada com banco temporario:

```text
py_compile OK
{'rdo_id': 1, 'desvios': 0, 'counts': {'mao_obra': 2, 'equipamentos': 3, 'suprimentos': 2, 'custos': 7, 'lps': 2, 'whatsapp': 1}}
```

Observacao: `desvios` igual a `0` e esperado quando nao existe planejamento ativo para o nucleo/data do smoke.

---

## Evolucao 2026-04-26 - Ciclo Operacional Operavel Por Clique

Mudancas aplicadas direto na base `C:\Users\felip\Downloads\NOVA NS Versao 5`.

### GUI

- `ui_operational_cycle.py` deixou de ser apenas resumo textual.
- A aba `[14] Ciclo Operacional` agora possui formulario nativo Tkinter para criar planejamento semanal.
- Foram adicionados botoes de operacao:
  - `Criar plano`
  - `Aprovar plano`
  - `Rejeitar plano`
  - `ML/Regras`
  - `Aprovar replan`
  - `Aplicar replan`
  - `Rejeitar replan`
- Foram adicionados filtros no cabecalho:
  - severidade/risco do desvio;
  - status do planejamento.
- O resumo agora exibe RDO vinculado ao desvio quando existir.

### Arquitetura Do ConstruData No GUI

- `construdata_gui.py` voltou a registrar uma aba unica `[15] ConstruData`, usando `build_construdata_workspace_tab`.
- `construdata_gui_premium.py` voltou a registrar uma aba unica `[15] ConstruData`, usando `build_construdata_workspace_tab`.
- A funcao `build_construdata_module_tabs` continua disponivel como opcional, mas nao e mais chamada pelo GUI principal.
- Isso alinha a arquitetura com o shell estilo frontend: sidebar interna, seletor de projeto ativo e modulos dentro da mesma aba.

### Teste Executado

Teste offline com SQLite temporario:

```text
plan 1
rdo 1
desvios 1
ml fallback
replan 1
novo_plano 2
```

Fluxo testado:

1. Criar planejamento semanal.
2. Aprovar planejamento como diretor.
3. Criar RDO com producao abaixo da meta.
4. Gerar desvio automaticamente.
5. Rodar ML/regras.
6. Aprovar replanejamento.
7. Aplicar replanejamento.
8. Confirmar criacao de novo plano rascunho.

Resultado:

```text
Ciclo operacional por clique validado em modo offline.
```

### Arquivos Alterados

- `ui_operational_cycle.py`
- `construdata_gui.py`
- `construdata_gui_premium.py`

---

## Evolucao 2026-04-26 - RDO Detalhado Operavel Na Plataforma

Mudancas aplicadas direto na base `C:\Users\felip\Downloads\NOVA NS Versao 5`.

### Motor RDO

- `campo/rdo_engine.py` agora gera detalhe auditavel em Markdown por RDO.
- `campo/rdo_engine.py` agora exporta `RDO_####_YYYY-MM-DD.md` em `SAIDA_HYDRONETWORK/<NUCLEO>/CAMPO/RDO`.
- `reportlab>=4.0` foi fixado em `requirements.txt` e `requirements-full.txt` para o PDF do fechamento funcionar no ambiente.

### GUI ConstruData

- Aba `RDO` agora permite escolher foto por seletor de arquivo.
- Tabela de RDOs agora possui acoes:
  - `Ver detalhe RDO`
  - `Exportar Markdown`
  - `Fechar/Gerar PDF`

### Teste Executado

```text
py_compile OK
{'rdo_id': 1, 'md_exists': True, 'pdf_exists': True, 'status': 'FECHADO', 'chars': 403}
{'gui_render': True, 'module': 'rdo', 'projects': 6}
{'gui_click_flow': True, 'rdo_id': 1, 'status': 'FECHADO', 'pdf_exists': True, 'messages': 3}
```

Fluxo testado com SQLite temporario:

1. Criar RDO detalhado.
2. Gerar detalhe Markdown.
3. Exportar `.md`.
4. Fechar RDO.
5. Gerar PDF.
6. Montar a tela Tkinter `ConstruData -> RDO`.
7. Executar fluxo de clique programatico no GUI: `Criar RDO`, `Ver detalhe RDO`, `Exportar Markdown`, `Fechar/Gerar PDF`.
8. Limpar temporarios.

Correcao adicional encontrada no teste de clique:

- `_legacy_snapshot()` agora carrega antecipadamente relacoes de RDO e planejamento com `selectinload`, evitando erro de objeto SQLAlchemy destacado da sessao ao atualizar a tabela do GUI.

### Rollback Cirurgico

- Para voltar este bloco, remover os metodos `detalhe_markdown` e `exportar_markdown` de `campo/rdo_engine.py`.
- Em `ui_construdata_modules.py`, remover import `filedialog`, botao `Escolher foto` e bloco de acoes da tabela RDO.

---

## Importacao 2026-04-26 - RDOs Icaro XLSX

Arquivos importados para o banco local:

- `RDO Cesario Lange.xlsx` -> nucleo `CESARIO_LANGE`: 2 RDOs, de 2026-04-22 a 2026-04-23.
- `RDO Porangaba.xlsx` -> nucleo `PORANGABA`: 10 RDOs, de 2026-03-23 a 2026-04-18.
- `RDO São Roque.xlsx` -> nucleo `SAO_ROQUE`: 21 RDOs, de 2026-03-23 a 2026-04-23.

Responsavel gravado: `Icaro`.

Marcador de auditoria em `rdo.observacoes`:

```text
IMPORT_XLSX_ICARO:<arquivo>:<aba>
```

Rollback dos RDOs importados:

```sql
delete from rdo_foto where rdo_id in (select id from rdo where observacoes like '%IMPORT_XLSX_ICARO:%');
delete from rdo_ocorrencia where rdo_id in (select id from rdo where observacoes like '%IMPORT_XLSX_ICARO:%');
delete from rdo_equipe where rdo_id in (select id from rdo where observacoes like '%IMPORT_XLSX_ICARO:%');
delete from rdo_apontamento where rdo_id in (select id from rdo where observacoes like '%IMPORT_XLSX_ICARO:%');
delete from rdo where observacoes like '%IMPORT_XLSX_ICARO:%';
```

---

## Importacao 2026-04-26 - Producao Morro Do Teteu / RK_SUB

Fonte:

```text
Produção\4 - Barufi Consultoria - Modelos\EXECUÇÃO\NOVAS_PLANILHAS\Execução_Geral - REV01.xlsx
Aba: M_TETEU
Local: MORRO DO TETÉU E VALE VERDE
```

Nucleo oficial usado:

```text
RK_SUB
Obra: Morro do Teteu / Subempreita
Responsavel: Igor
```

Importacao criada no banco local:

- 66 RDOs diarios com producao.
- Periodo: 2026-01-09 a 2026-04-23.
- 289 apontamentos de producao.
- Total por unidade:
  - `m`: 2409.6
  - `un`: 831.0

Tambem foi corrigido o seed oficial em `core/construdata_offline.py` para `RK_SUB` abrir como `Morro do Teteu / Subempreita`, responsavel `Igor`.

Marcador de auditoria em `rdo.observacoes`:

```text
IMPORT_PRODUCAO_M_TETEU_20260426
```

Rollback dos RDOs importados:

```sql
delete from rdo_apontamento where rdo_id in (select id from rdo where observacoes like '%IMPORT_PRODUCAO_M_TETEU_20260426%');
delete from rdo where observacoes like '%IMPORT_PRODUCAO_M_TETEU_20260426%';
```

Rollback do seed oficial:

```text
Em core/construdata_offline.py, voltar o projeto RK_SUB para:
nome = RK Sub Empreita
responsavel = Felipe Nery
```

---

## Evolucao 2026-04-26 - Shell Visual ConstruData

Motivo: a aba ConstruData estava funcional, mas visualmente parecida com esqueleto e distante das referencias enviadas.

Mudancas aplicadas em `ui_construdata_modules.py`:

- Topo azul estilo plataforma SaaS, com navegacao horizontal.
- Barra de filtros abaixo do topo.
- Trilho lateral com icones.
- Sidebar interna de workspace/modulos.
- Projeto padrao agora abre em `Morro do Teteu / Subempreita` quando existir.
- `Torre Controle` deixou de ser tabela preta vazia e passou a renderizar:
  - KPIs;
  - board/kanban por etapa;
  - cards de RDO/desvios/tarefas;
  - painel de notificacoes.

Validacao:

```text
py_compile OK
{'render': 'ok', 'project': 'Morro do Teteu / Subempreita', 'module': 'torre'}
GUI reaberto: ConstruData - HydroNetwork v9.0.0 | NS v9
```

Rollback:

```text
Restaurar em ui_construdata_modules.py:
- _colors anterior;
- _build anterior;
- _card/render anteriores;
- _render_torre anterior.
```

---

## Evolucao 2026-04-26 - Frontend Real Em GUI Desktop

Decisao: o frontend real do ConstruData nao deve ser refeito em Tkinter. O Tk fica para motores legados; a experiencia igual ao ConstruData deve abrir o app React/Vite real.

Arquivos criados:

- `abrir_construdata_frontend_gui.py`
- `ABRIR_CONSTRUDATA_FRONTEND_GUI.bat`

Comportamento:

- Sobe o frontend real em `C:\Users\felip\Downloads\construdatamaxv2-clean\frontend`.
- Usa `http://127.0.0.1:5173/app/gestao-360`.
- Abre em janela desktop via `pywebview`, com titulo `ConstruData HydroNetwork - Frontend Real`.

Validacao:

```text
py_compile OK
HTTP 200 em /app/gestao-360
Processo GUI ativo: ConstruData HydroNetwork - Frontend Real
```

Dependencia adicionada:

```text
pywebview>=6.2
```

---

## Evolucao 2026-04-26 - Tatui Guarda-Chuva + API Frontend Local

Motivo: os RDOs enviados pelo Icaro estavam importados, mas Cesario Lange, Porangaba e Sao Roque ainda apareciam como nucleos soltos. O projeto Tatui precisava contemplar essas cidades como frentes/obras dentro do mesmo contexto.

Amarracao aplicada:

```text
TATUI = TATUI + CESARIO_LANGE + PORANGABA + SAO_ROQUE
RK_SUB = Morro do Teteu / Subempreita
```

Responsabilidades:

```text
Tatui / cidades: Icaro
Morro do Teteu / RK_SUB: Igor
```

Arquivos alterados:

- `core/construdata_offline.py`
- `ui_construdata_modules.py`
- `api/routes_frontend_local.py`
- `api/routes_rdo.py`
- `api/routes_campo.py`
- `api/server.py`
- `abrir_construdata_frontend_gui.py`

Validacao:

```text
py_compile OK
Frontend real: http://127.0.0.1:5174/app/gestao-360 -> 200
API local: http://127.0.0.1:8787 -> 200
Primeiro projeto no frontend: Tatui - RK
Tatui - RK: 33 RDOs, 3 frentes
  CESARIO_LANGE: 2 RDOs, 2026-04-22 a 2026-04-23
  PORANGABA: 10 RDOs, 2026-03-23 a 2026-04-18
  SAO_ROQUE: 21 RDOs, 2026-03-23 a 2026-04-23
Morro do Teteu / RK_SUB: 66 RDOs, 2026-01-09 a 2026-04-23, 289 apontamentos
```

Rollback:

```text
1. Remover PROJECT_NUCLEO_GROUPS/nucleos_do_projeto de core/construdata_offline.py.
2. Voltar Tatui para cidade "Tatui / SP" se quiser desfazer a visao guarda-chuva.
3. Voltar filtros de ui_construdata_modules.py, api/routes_rdo.py e api/routes_campo.py de `.in_(nucleos)` para nucleo unico.
4. Remover api/routes_frontend_local.py e a importacao/include em api/server.py.
5. Voltar abrir_construdata_frontend_gui.py para Vite 5173 sem API local 8787.
```

---

## Evolucao 2026-04-26 - Preencher com Texto Operacional

Motivo: o RDO criado pelo frontend estava chegando no backend como observacao/importacao, sem virar producao estruturada, custo, planejamento e desvio.

Arquivos criados/alterados:

- `campo/texto_operacional.py`
- `api/routes_frontend_local.py`
- `MODELO_PREENCHER_TEXTO_OPERACIONAL.md`
- `C:\Users\felip\Downloads\construdatamaxv2-clean\frontend\src\lib\api.ts`
- `C:\Users\felip\Downloads\construdatamaxv2-clean\frontend\src\store\rdoStore.ts`
- `C:\Users\felip\Downloads\construdatamaxv2-clean\frontend\src\features\rdo\components\TextParseModal.tsx`
- `C:\Users\felip\Downloads\construdatamaxv2-clean\frontend\src\features\rdo\components\NovoRdoPanel.tsx`

Comportamento novo:

```text
RDO > Preencher com Texto > Criar direto
```

O texto colado agora grava:

- `rdo`
- `rdo_apontamento`
- `rdo_equipe`
- `cdm_custo`
- `cdm_mao_obra`
- `cdm_equipamento`
- `cdm_suprimento`
- `planejamento_semanal`
- `planejamento_item`
- `desvio_planejamento`
- `ml_execucao` / `replanejamento` quando houver desvio suficiente

Validacao:

```text
py_compile OK
npm run build OK
Endpoint /api/projetos/{id}/preencher-texto OK
Teste criado e removido:
  RDO em SAO_ROQUE
  1 apontamento
  1 equipe
  custo total R$ 500,00
  1 planejamento
  2 desvios gerados
  ML/fallback executado
Frontend real: http://127.0.0.1:5174/app/gestao-360 -> 200
API local: http://127.0.0.1:8787 -> 200
```

Rollback:

```text
1. Remover campo/texto_operacional.py.
2. Remover endpoint /api/projetos/{project_id}/preencher-texto em api/routes_frontend_local.py.
3. Voltar api_frontend_criar_rdo para chamada direta engine.criar_rdo_completo.
4. Remover apiProjetoPreencherTexto de frontend/src/lib/api.ts.
5. Remover createRdoTextForProject de frontend/src/store/rdoStore.ts.
6. Remover botao Criar direto de TextParseModal.tsx e prop onCreate em NovoRdoPanel.tsx.
```

---

## Evolucao 2026-04-26 - Preencher com Texto Controle/Fluxo

Motivo: o controle financeiro RK tem lancamentos, fluxo de caixa, folha, custos fixos e variaveis. O sistema precisava receber texto do engenheiro e transformar em controle de obra + fluxo projetado.

Arquivos criados/alterados:

- `financeiro/controle_fluxo_texto.py`
- `financeiro/__init__.py`
- `api/routes_frontend_local.py`
- `MODELO_PREENCHER_TEXTO_CONTROLE_FLUXO.md`
- `C:\Users\felip\Downloads\construdatamaxv2-clean\frontend\src\lib\api.ts`
- `C:\Users\felip\Downloads\construdatamaxv2-clean\frontend\src\features\gestao-360\components\ControleFinanceiroPanel.tsx`

Comportamento novo:

```text
POST /api/projetos/{project_id}/controle-fluxo/preencher-texto
GET  /api/projetos/{project_id}/controle-fluxo
```

O texto colado agora grava:

- `cdm_custo` para custos fixos, diretos, indiretos, variaveis, medicao prevista e recebimento previsto.
- `cdm_agenda` para medicao/recebimento.
- `cdm_tarefa` para controle de obra e desvios.
- `cdm_lps_restricao` para riscos/desvios que precisam destravar a obra.

Rollback:

```text
1. Remover financeiro/controle_fluxo_texto.py e financeiro/__init__.py.
2. Remover endpoints /controle-fluxo e /controle-fluxo/preencher-texto de api/routes_frontend_local.py.
3. Voltar api_frontend_financeiro para retornar lancamentos sem fluxo_projetado.
4. Remover MODELO_PREENCHER_TEXTO_CONTROLE_FLUXO.md.
5. Remover apiProjetoControleFluxo/apiProjetoPreencherControleFluxo de frontend/src/lib/api.ts.
6. Remover o card Preencher com Texto do ControleFinanceiroPanel.tsx.
```

---

## Evolucao 2026-04-26 - Guia PDF + XGBoost Icaro/Igor

Motivo: formalizar o fluxo de uso para RDO, planejamento, controle, fluxo trimestral projetado e alimentar o modelo de predicao.

Arquivos criados:

- `analytics_operacional/xgboost_responsaveis.py`
- `analytics_operacional/__init__.py`
- `GUIA_FLUXO_OPERACIONAL_XGBOOST_20260426.md`
- `GUIA_FLUXO_OPERACIONAL_XGBOOST_20260426.pdf`
- `RELATORIO_XGBOOST_ICARO_IGOR_20260426.json`

Execucao:

```text
python -m analytics_operacional.xgboost_responsaveis
```

Resultado gravado em `ml_execucao`:

```text
ICARO_CESARIO_LANGE_PORANGABA_SAO_ROQUE -> xgboost_producao, 22 dias, confianca 0.42
IGOR_RK_SUB -> xgboost_producao, 66 dias, confianca 0.84
```

Observacao:

```text
Icaro tem baixa confianca quantitativa porque os RDOs XLSX vieram majoritariamente em texto livre.
Igor/RK_SUB tem base forte com metros e unidades estruturadas.
```

Rollback:

```text
1. Remover analytics_operacional/.
2. Remover GUIA_FLUXO_OPERACIONAL_XGBOOST_20260426.md/pdf.
3. Remover RELATORIO_XGBOOST_ICARO_IGOR_20260426.json.
4. Se quiser limpar o banco, apagar de ml_execucao os registros tipo='xgboost_producao'.
```

---

## Evolucao 2026-04-26 - Modulo BI Analytics Exportavel

Motivo: transformar o relatorio XGBoost em BI de plataforma, com dashboard navegavel e exportacao PDF/Excel.

Arquivos criados/alterados:

- `analytics_operacional/bi_dashboard.py`
- `api/routes_bi_analytics.py`
- `api/server.py`
- `html/construdata_bi_analytics.html`
- `BI_ANALYTICS_OPERACIONAL_20260426.pdf`
- `BI_ANALYTICS_OPERACIONAL_20260426.xlsx`

Rotas:

```text
GET  /bi/analytics
GET  /api/bi/analytics
POST /api/bi/analytics/recalcular
GET  /api/bi/analytics/export/pdf
GET  /api/bi/analytics/export/excel
```

Validacao:

```text
py_compile OK
BI payload OK: 99 RDOs, 2449.28 m, 831 un, previsao 7 dias 405.56
PDF OK: %PDF-1.4
Excel OK: abas BI Resumo, Comparativo, Serie Diaria
Servidor local: http://127.0.0.1:8787/bi/analytics -> 200
```

Rollback:

```text
1. Remover analytics_operacional/bi_dashboard.py.
2. Remover api/routes_bi_analytics.py e include em api/server.py.
3. Remover rota /bi/analytics de api/server.py.
4. Remover html/construdata_bi_analytics.html.
5. Remover BI_ANALYTICS_OPERACIONAL_20260426.pdf/xlsx.
```

---

## Evolucao 2026-04-26 - Enriquecimento RDO Icaro

Motivo: os RDOs do Icaro vieram majoritariamente como texto livre. O BI/XGBoost precisava transformar esse texto em producao quantificavel sem apagar o RDO original.

Arquivo criado/alterado:

- `analytics_operacional/icaro_rdo_enrichment.py`
- `analytics_operacional/xgboost_responsaveis.py`
- `analytics_operacional/bi_dashboard.py`
- `html/construdata_bi_analytics.html`
- `RELATORIO_XGBOOST_ICARO_IGOR_20260426.json`
- `BI_ANALYTICS_OPERACIONAL_20260426.pdf`
- `BI_ANALYTICS_OPERACIONAL_20260426.xlsx`

Regra aplicada:

```text
Somente apontamentos com marcador AUTO_ESTRUTURADO_ICARO sao criados/removidos pelo enriquecedor.
RDO original permanece intacto.
```

Resultado:

```text
AUTO_ESTRUTURADO_ICARO: 23 apontamentos
CESARIO_LANGE: 18.0 m
PORANGABA: 2.0 un + 1.0 etapa
SAO_ROQUE: 46.0 etapas
ICARO total: 18.0 m + 2.0 un + 47.0 etapas = 67.0 unidade equivalente
ICARO previsao 7 dias XGBoost: 9.65 unidade equivalente
```

Rollback:

```text
1. Rodar delete no banco apenas para rdo_apontamento.servico LIKE 'AUTO_ESTRUTURADO_ICARO%'.
2. Remover analytics_operacional/icaro_rdo_enrichment.py.
3. Regerar o BI/XGBoost sem etapas se quiser voltar ao modelo anterior.
```

---

## Evolucao 2026-04-27 - BI Dashboard 360 v2

Motivo: o BI anterior ainda parecia relatorio simples. Foi evoluido para dashboard operacional com leitura executiva, graficos, risco, responsaveis, serie diaria e exportacao mais forte.

Arquivos alterados:

- `html/construdata_bi_analytics.html`
- `analytics_operacional/bi_dashboard.py`
- `BI_ANALYTICS_OPERACIONAL_20260426.pdf`
- `BI_ANALYTICS_OPERACIONAL_20260426.xlsx`

Entregue:

```text
Dashboard /bi/analytics com KPIs, leitura executiva, tendencia diaria, composicao de producao, variaveis do XGBoost, cards por responsavel e tabela diaria.
PDF com resumo executivo, comparativo por responsavel, leitura do modelo e rotina de uso.
Excel com abas Dashboard, Comparativo, Serie Diaria e Serie BI, incluindo 2 graficos.
Payload BI agora inclui total_equiv, resumo_executivo e acoes_operacionais.
```

Validacao:

```text
py_compile OK
GET /api/bi/analytics -> 200
GET /bi/analytics -> 200
Cards: 99 RDOs, 2427.6 m, 833 un, 47 etapas, 3307.6 equiv., previsao 7 dias 396.71
PDF OK: %PDF-1.4, 7481 bytes
Excel OK: abas Dashboard, Comparativo, Serie Diaria, Serie BI; Dashboard com 2 graficos
```

Rollback:

```text
1. Voltar html/construdata_bi_analytics.html para a versao simples anterior.
2. Voltar analytics_operacional/bi_dashboard.py para a versao anterior do exportador.
3. Regerar BI_ANALYTICS_OPERACIONAL_20260426.pdf/xlsx.
```

---

## Evolucao 2026-04-27 - Ciclo Operacional 360 Oficial

Motivo: fechar o fluxo real de gestao:
planejamento semanal do engenheiro -> validacao do diretor -> RDO diario -> planejado x realizado -> desvios automaticos -> ML/fallback -> replanejamento rascunho -> validacao/aplicacao -> novo plano oficial.

Arquivos criados/alterados:

- `api/operational.py`
- `campo/texto_operacional.py`
- `api/routes_frontend_local.py`
- `api/server.py`
- `GUIA_CICLO_OPERACIONAL_360_20260427.md`
- `html/construdata_ciclo_operacional.html`
- `html/construdata_bi_analytics.html`

Entregue:

```text
GET  /ciclo-operacional
GET  /api/projetos/{project_id}/ciclo-operacional
POST /api/projetos/{project_id}/planejamentos-semanais/preencher-texto
POST /api/projetos/{project_id}/planejamentos-semanais/{plan_id}/validar
POST /api/projetos/{project_id}/ml/recalcular-desvios
POST /api/projetos/{project_id}/replanejamentos/{replanejamento_id}/validar
POST /api/projetos/{project_id}/replanejamentos/{replanejamento_id}/aplicar
```

Regras implementadas:

```text
Planejamento por texto entra como RASCUNHO.
Quando diretor aprova, planos ativos concorrentes da mesma semana viram SUBSTITUIDO.
RDO diario agora sempre tenta comparar contra o planejamento ATIVO da data.
Desvios alimentam ML/fallback.
Replanejamento aplicado cria novo PlanejamentoSemanal ATIVO e substitui o plano anterior.
```

Validacao:

```text
py_compile OK
GET /ciclo-operacional -> 200
GET /api/projetos/{project_id}/ciclo-operacional -> 200
Teste rollback de aplicar_replanejamento: plano anterior SUBSTITUIDO, novo plano ATIVO, meta ajustada 100 -> 140
```

Rollback:

```text
1. Remover html/construdata_ciclo_operacional.html.
2. Remover rota /ciclo-operacional de api/server.py.
3. Remover endpoints ciclo-operacional/preencher-texto/aplicar de api/routes_frontend_local.py.
4. Voltar campo/texto_operacional.py para nao chamar gerar_desvios_rdo quando nao ha plano novo no texto.
5. Remover aplicar_replanejamento de api/operational.py.
```

---

## Evolucao 2026-04-27 - NS com Cartografia em vez de Satelite

Motivo: a Nota de Servico nao deve mais sair com imagem de satelite. A planta deve usar cartografia/mapa correspondente e exibir a linha da rede projetada por cima.

Arquivos alterados:

- `gerar_ns.py`
- `gerar_ns_todos_nucleos.py`
- `gerar_ns_sao_manuel_joao_carlos.py`
- `gerar_exemplo_ns.py`

Entregue:

```text
Base Esri.WorldImagery removida dos geradores principais.
HTML da NS saiu de tile ArcGIS World Imagery para OpenStreetMap.
PDF da NS agora tenta CartoDB Positron e OpenStreetMap Mapnik.
Se a cartografia online falhar, a planta fica em base clara UTM com grade, sem satelite.
Linha da rede projetada e PVs sao redesenhados acima da cartografia com zorder alto.
Arquivos novos em lote passam a chamar "Cartografia NS ..." em vez de "Satelite NS ...".
```

Validacao:

```text
py_compile OK:
gerar_ns.py
gerar_ns_todos_nucleos.py
gerar_ns_sao_manuel_joao_carlos.py
gerar_exemplo_ns.py

Busca OK: sem WorldImagery/server.arcgisonline/Esri.World nos geradores alterados.
```

Rollback:

```text
1. Voltar provider de adicionar_base_cartografica/CartoDB para Esri.WorldImagery.
2. Voltar tileLayer HTML da NS para ArcGIS World_Imagery.
3. Voltar nomes "Cartografia NS" para "Satelite NS" se precisar compatibilidade antiga.
```

---

## Evolucao 2026-04-27 - GUI Standalone NS v5

Motivo: criar um aplicativo separado somente para Nota de Servico v5, sem misturar com a plataforma ConstruData.

Arquivos criados:

- `ns_v5_gui.py`
- `ABRIR_NS_V5_GUI.bat`
- `GUIA_NS_V5_GUI_STANDALONE_20260427.md`

Entregue:

```text
GUI desktop independente em Tkinter.
Carrega JSON com pvs+trechos.
Carrega DXF usando o motor v5.
Permite preencher uma NS manual.
Gera A4, desenho, cartografia/perfil, HTML mapa, GeoJSON e DADOS.json.
Nao sobe FastAPI, nao abre frontend, nao depende do ConstruData GUI.
```

Validacao:

```text
python -m py_compile ns_v5_gui.py -> OK
python -c "import ns_v5_gui; print(ns_v5_gui.APP_TITLE)" -> OK
```

Rollback:

```text
1. Apagar ns_v5_gui.py.
2. Apagar ABRIR_NS_V5_GUI.bat.
3. Apagar GUIA_NS_V5_GUI_STANDALONE_20260427.md.
```

---

## Evolucao 2026-04-27 - Pacote NS v5 para Funcionario

Motivo: separar apenas os arquivos necessarios para gerar Nota de Servico v5 e enviar para um funcionario.

Pasta criada:

```text
PACOTE_NS_V5_FUNCIONARIO_20260427
```

Conteudo:

```text
ABRIR_NS_V5_GUI.bat
INSTALAR_DEPENDENCIAS.bat
requirements.txt
LEIA_ME_FUNCIONARIO.md
EXEMPLO_NS_V5.json
ns_v5_gui.py
gerar_ns.py
ler_dxf_gdal.py
ler_landxml.py
GUIA_NS_V5_GUI_STANDALONE_20260427.md
```

Validacao:

```text
py_compile OK dentro da pasta do pacote.
import ns_v5_gui OK dentro da pasta do pacote.
__pycache__ removido do pacote.
```

Rollback:

```text
Apagar a pasta PACOTE_NS_V5_FUNCIONARIO_20260427.
```
