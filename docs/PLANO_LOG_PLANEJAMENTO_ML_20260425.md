# Plano Log Operacional, Planejamento Semanal, Desvios e ML

Data: 2026-04-25
Escopo: ConstruData / RDO / Torre de Controle / Gestao 360 / WhatsApp / Supabase / Render API

## Objetivo

Transformar o ConstruData em um ciclo fechado de operacao:

```text
Planejamento semanal do engenheiro
-> banco/dashboard
-> validacao do diretor
-> RDO diario
-> comparacao planejado x realizado
-> ML/XGBoost ou fallback deterministico
-> desvios e acoes recomendadas
-> replanejamento em rascunho
-> validacao do diretor
-> novo plano oficial
```

O objetivo desta entrega e estrutural: criar o contrato de dados, os endpoints canonicos, a geracao automatica de desvios no RDO e a visualizacao inicial nos modulos principais. Nada existente deve ser apagado.

## Arquivos Alterados

- `api/operational.py`
- `api/routes_integracao_total.py`
- `api/routes_whatsapp.py`
- `api/supabase_client.py`
- `docs/supabase_log_planejamento_ml_20260425.sql`
- `frontend/src/lib/api.ts`
- `frontend/src/features/operational/components/OperationalCyclePanel.tsx`
- `frontend/src/features/rdo/components/DashboardPanel.tsx`
- `frontend/src/features/planejamento/components/PlanejamentoHeader.tsx`
- `frontend/src/features/torre-de-controle/components/ObraDetailPanel.tsx`
- `frontend/src/features/gestao-360/components/CommandCenterPanel.tsx`

## Migration Supabase

Arquivo:

```text
docs/supabase_log_planejamento_ml_20260425.sql
```

Tabelas criadas de forma incremental:

- `operational_logs`
- `planejamentos_semanais`
- `planejamento_itens`
- `planejamento_validacoes`
- `desvios_planejamento`
- `ml_execucoes`
- `replanejamentos`

Padrao usado:

- `create table if not exists`
- `alter table ... enable row level security`
- policies permissivas `for all using (true) with check (true)`
- indices por `projeto_id`, data, severidade, status e semana

## Log Operacional

O helper central fica em:

```text
api/operational.py
```

Funcao principal:

```python
log_operational_event(...)
```

Campos padronizados:

- `subsystem`: `whatsapp`, `evolution`, `supabase`, `rdo`, `planejamento`, `ml`, `dashboard`, `render`, `n8n`
- `severity`: `debug`, `info`, `warning`, `error`, `critical`
- `status`: `open`, `resolved`, `ignored`
- `project_id`
- `telefone`
- `request_id`
- `event_id`
- `error_message`
- `payload`
- `created_at`

Fallback:

Se `operational_logs` ainda nao existir no Supabase, o helper tenta gravar o evento em `workflow_events`. Isso evita quebrar a API antes da migration.

## Endpoints Canonicos

Implementados em `api/routes_integracao_total.py`:

```text
POST /api/logs
GET /api/projetos/{id}/logs

GET /api/projetos/{id}/planejamentos-semanais
POST /api/projetos/{id}/planejamentos-semanais
POST /api/projetos/{id}/planejamentos-semanais/{plan_id}/validar

GET /api/projetos/{id}/desvios
POST /api/projetos/{id}/ml/recalcular-desvios

GET /api/projetos/{id}/replanejamentos
POST /api/projetos/{id}/replanejamentos/{replanejamento_id}/validar
```

## Criacao de Planejamento Semanal

Payload esperado:

```json
{
  "semana_inicio": "2026-04-27",
  "semana_fim": "2026-05-03",
  "engenheiro": "Icaro",
  "responsavel": "Icaro",
  "observacoes": "Plano semanal Tatui",
  "itens": [
    {
      "frente_id": null,
      "atividade": "Assentamento de rede",
      "meta_quantidade": 120,
      "unidade": "m",
      "equipe_prevista": 6,
      "custo_previsto": 8500,
      "data_inicio": "2026-04-27",
      "data_fim": "2026-04-30",
      "restricoes": ["liberacao de material"]
    }
  ]
}
```

Status inicial:

```text
rascunho
```

Quando o diretor valida com `aprovado=true`, o plano passa para:

```text
ativo
```

Se houver outro plano ativo para o mesmo projeto e semana, ele e encerrado automaticamente como `substituido`.

## Validacao Do Diretor

Endpoint:

```text
POST /api/projetos/{id}/planejamentos-semanais/{plan_id}/validar
```

Payload:

```json
{
  "aprovado": true,
  "diretor": "Felipe Nery",
  "observacao": "Plano aprovado"
}
```

Resultado:

- cria registro em `planejamento_validacoes`
- altera status do planejamento para `ativo` ou `rejeitado`
- grava log operacional em `operational_logs`

## RDO E Desvios Automaticos

Quando um RDO e criado em:

```text
POST /api/projetos/{id}/rdos
```

o backend agora tenta:

1. localizar o planejamento ativo da semana do RDO
2. carregar `planejamento_itens`
3. extrair atividades realizadas do RDO
4. comparar planejado x realizado
5. gravar linhas em `desvios_planejamento`
6. registrar log operacional

Metricas calculadas por item:

- `desvio_quantidade`
- `desvio_percentual`
- `desvio_custo`
- `desvio_custo_percentual`
- `desvio_equipe`
- `spi`
- `cpi`
- `ppc`
- `produtividade_real`
- `risco`
- `acao_recomendada`

Regra de severidade inicial:

- critico: desvio percentual <= -30% ou custo >= +30%
- alto: desvio percentual <= -15% ou custo >= +15%
- medio: desvio percentual <= -5% ou custo >= +5%
- baixo: demais casos

## ML / XGBoost

Endpoint:

```text
POST /api/projetos/{id}/ml/recalcular-desvios
```

Comportamento:

- se houver amostra suficiente e `xgboost` estiver disponivel, usa modelo real
- se nao houver massa historica suficiente, usa fallback deterministico transparente
- registra toda execucao em `ml_execucoes`
- gera replanejamento em `replanejamentos` com status `rascunho`

Fallback deterministico:

- calcula score por desvio fisico, custo, SPI, CPI, ocorrencias, paralisacoes e severidade
- classifica risco como `baixo`, `medio`, `alto` ou `critico`
- sugere acoes por item

## Replanejamento

Tabela:

```text
replanejamentos
```

Status permitidos:

- `rascunho`
- `aprovado`
- `rejeitado`
- `aplicado`

Endpoint de validacao:

```text
POST /api/projetos/{id}/replanejamentos/{replanejamento_id}/validar
```

Payload:

```json
{
  "aprovado": true,
  "diretor": "Felipe Nery",
  "observacao": "Aplicar na proxima semana",
  "aplicar": true
}
```

Quando `aplicar=true`, o replanejamento aprovado vira um novo `planejamentos_semanais` em status `ativo`, com itens derivados das sugestoes.

## WhatsApp

Alteracoes em `api/routes_whatsapp.py`:

- falha de Evolution grava log operacional
- falha de Supabase grava log operacional
- RDO via WhatsApp tenta gerar desvios automaticamente
- comandos adicionados:
  - `@planejamento`
  - `#planejamento`
  - `@desvios`
  - `#desvios`

Resposta de `@planejamento`:

- mostra link do planejamento semanal
- explica que o plano vira oficial apenas apos validacao do diretor

Resposta de `@desvios`:

- mostra resumo de desvios do projeto
- mostra PPC medio, criticos e ultimos desvios

Observacao:

O formulario principal de planejamento semanal continua web-first nesta fase. WhatsApp vira guia/link/resumo.

## Frontend

Componente novo:

```text
frontend/src/features/operational/components/OperationalCyclePanel.tsx
```

Ele consome:

- logs
- planejamentos semanais
- desvios
- replanejamentos
- endpoint de recalculo ML

Modulos onde foi ligado:

- RDO Dashboard
- Planejamento
- Torre de Controle
- Gestao 360

No modulo Planejamento, o painel tambem permite:

- criar planejamento semanal em rascunho;
- informar uma atividade por linha no formato `atividade | quantidade | unidade | equipe | custo previsto`;
- validar ou rejeitar o plano como diretor;
- transformar plano aprovado em status `ativo` pela API canonica.
- aplicar ou rejeitar replanejamentos gerados pelo ML; quando aplicado, a API cria novo plano oficial.

KPIs exibidos:

- planejamento ativo
- desvios criticos
- PPC medio
- logs abertos
- replanejamentos em rascunho

## Dashboard / Gestao 360 / Torre

`GET /api/projetos/{id}/dashboard` agora inclui:

- `planejamento`
- `desvios`
- `logs`
- `replanejamentos`
- novos KPIs de planejamento e ML

`GET /api/projetos/{id}/torre` agora inclui:

- logs operacionais
- desvios
- replanejamentos

`GET /api/projetos/{id}/gestao360` agora inclui:

- bloco `planejamento_operacional`
- status de integracao `planejamento_ml`

## Teste Manual Recomendado

1. Rodar a migration no Supabase:

```text
docs/supabase_log_planejamento_ml_20260425.sql
```

2. Criar plano semanal para Tatui:

```http
POST /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/planejamentos-semanais
```

3. Validar como diretor:

```http
POST /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/planejamentos-semanais/{plan_id}/validar
```

4. Criar RDO com producao abaixo do planejado:

```http
POST /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/rdos
```

5. Conferir desvios:

```http
GET /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/desvios
```

6. Rodar ML/fallback:

```http
POST /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/ml/recalcular-desvios
```

7. Conferir replanejamento em rascunho:

```http
GET /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/replanejamentos
```

8. Aprovar replanejamento:

```http
POST /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/replanejamentos/{id}/validar
```

9. Abrir frontend e conferir:

- RDO
- Planejamento
- Gestao 360
- Torre de Controle

## Criterios De Aceite

- Planejamento semanal criado sem quebrar dados existentes.
- Diretor consegue aprovar/rejeitar plano.
- RDO criado apos plano ativo gera desvios.
- Endpoint de ML cria execucao em `ml_execucoes`.
- Replanejamento nasce como `rascunho`.
- Diretor aprova replanejamento antes de virar plano oficial.
- Falha de Evolution/Supabase aparece em `operational_logs`.
- Torre e Gestao 360 exibem painel operacional conectado ao projeto ativo.

## Rollback Seguro

Rollback de codigo:

```bash
git revert <commit-da-entrega>
```

Rollback de banco sem apagar dados:

1. Nao remover tabelas imediatamente.
2. Desabilitar uso pelos endpoints revertendo o commit.
3. Se precisar esconder dados no painel, manter tabelas e filtrar no frontend.

Rollback destrutivo, apenas com backup validado:

```sql
drop table if exists public.replanejamentos cascade;
drop table if exists public.ml_execucoes cascade;
drop table if exists public.desvios_planejamento cascade;
drop table if exists public.planejamento_validacoes cascade;
drop table if exists public.planejamento_itens cascade;
drop table if exists public.planejamentos_semanais cascade;
drop table if exists public.operational_logs cascade;
```

## Pendencias Pos-Entrega

- Aplicar a migration no Supabase de producao se ainda nao foi aplicada.
- Redeploy Render para expor os novos endpoints.
- Redeploy Vercel para exibir o painel novo.
- Testar um RDO real contra um planejamento ativo.
- Ajustar o modelo XGBoost quando houver historico suficiente para treinamento robusto.
- Expandir persistencia em tabelas filhas quando o formulario web de RDO enviar arrays detalhados de equipes, atividades, materiais, equipamentos e mao de obra.
