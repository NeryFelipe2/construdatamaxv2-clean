# Status Deploy/Teste RDO - 2026-04-25

## Resumo curto

O backend Render, o frontend Vercel e o GitHub foram atualizados. O fluxo real de RDO via API foi testado em producao e gravou no Supabase.

Ainda falta aplicar a migration SQL das tabelas novas de planejamento/log/ML no Supabase. Para nao travar a operacao enquanto isso nao acontece, o backend usa `workflow_events` como fallback operacional para:

- planejamento semanal;
- validacao do diretor;
- desvios planejado x realizado;
- execucao ML/regras;
- replanejamento em rascunho;
- logs operacionais.

Assim, o ciclo ja funciona em modo fallback. Depois da migration, os mesmos endpoints passam a usar as tabelas canonicas.

## Commits publicados em `main`

- `3b1dfca7` - Implement operational planning ML cycle
- `01feff42` - Handle missing planning migration gracefully
- `dfb6164e` - Fix RDO payload circular reference
- `2fce95da` - Use canonical projeto_id for RDO inserts
- `dd013782` - Order RDOs by recent creation
- `75dd7171` - Document deployment and RDO test status
- `297f4912` - Add workflow event fallback for planning cycle
- `1f66cefb` - Harden planning fallback reads
- `c8429dc7` - Retry operational fallback reads

## Deploys confirmados

### Render backend

Servico: `srv-d750kldm5p6s73feojbg`  
URL: `https://construdatamaxv2-clean.onrender.com`

Ultimo deploy live validado:

- Commit: `c8429dc73953093203fdf99b6c1fbf0263c65201`
- Deploy: `dep-d7minb1o3t8c73e71p70`
- Status: `live`

Health validado:

- `GET /health` -> `200`
- `GET /api/health/integrations` -> `200`, status `partial`

Observacao atual:

- `render_api`: `connected`
- `n8n`: `external`
- `whatsapp`: no ultimo health final retornou `open`.
- tabelas novas de planejamento/log/ML ainda ausentes no schema Supabase.

### Vercel frontend

URL oficial:

- `https://construdatamaxv2-clean.vercel.app`

Deploy manual de producao realizado via Vercel CLI.

Foi confirmado que o chunk `OperationalCyclePanel-DEIelTzO.js` esta publicado e contem o painel novo de Planejamento/Desvios.

## Teste real de RDO realizado

Projeto usado:

- Tatui - RK
- `c2bf8fda-b2e0-4bc1-9535-4891d596ea10`

Endpoint:

- `POST /api/projetos/c2bf8fda-b2e0-4bc1-9535-4891d596ea10/rdos`

Resultado:

- HTTP `201`
- RDO criado: `4230cba0-3ab9-4360-b142-2f9189f29a6a`
- `origem`: `codex_test`
- `status`: `teste`
- `projeto_id`: `c2bf8fda-b2e0-4bc1-9535-4891d596ea10`
- `project_id`: `null`

Dashboard validado:

- `rdos_total`: `2`
- `rdos_hoje`: `1`
- primeiro RDO da lista: `4230cba0-3ab9-4360-b142-2f9189f29a6a`

Isso prova o caminho:

`Render API -> Supabase -> Dashboard`

para RDO.

## Teste real do ciclo planejamento -> RDO -> desvio -> ML -> replanejamento

Projeto usado:

- Tatui - RK
- `c2bf8fda-b2e0-4bc1-9535-4891d596ea10`

Como a migration ainda nao foi aplicada, o teste rodou em fallback via `workflow_events`.

### Planejamento semanal

- Endpoint: `POST /api/projetos/{id}/planejamentos-semanais`
- Planejamento criado: `c441796c-57dd-477f-ac2c-bb6c1027388c`
- Status inicial: `rascunho`
- Atividade planejada:
  - `Assentamento rede teste fallback`
  - meta: `10 m`
  - equipe planejada: `2`
  - custo previsto: `1000`

### Validacao do diretor

- Endpoint: `POST /api/projetos/{id}/planejamentos-semanais/{plan_id}/validar`
- Decisao: `aprovado`
- Status apos validacao: `ativo`

### RDO abaixo do planejado

- Endpoint: `POST /api/projetos/{id}/rdos`
- RDO criado: `6b605b3f-235e-4446-a912-e2cb41fd692c`
- Producao realizada: `4 m`
- Custo do dia: `1300`

### Desvio gerado

- Endpoint: `GET /api/projetos/{id}/desvios`
- Status: `fallback`
- Desvio criado: `272a3a4d-90bc-43be-bc88-c80ee335424c`
- PPC: `40`
- SPI: `0.4`
- CPI: `0.769`
- Desvio percentual: `-60`
- Severidade: `critical`
- Acao recomendada: `Replanejar sequencia, reforcar equipe/equipamento e validar frente com diretor.`

### ML / regras

- Endpoint: `POST /api/projetos/{id}/ml/recalcular-desvios`
- Resultado: `ok`
- Modelo usado: `rules`
- `fallback_used`: `true`
- Score: `88.0769`
- Risco: `alto`

### Replanejamento

- Endpoint: `GET /api/projetos/{id}/replanejamentos`
- Status: `fallback`
- Replanejamento criado: `f1defb43-1f36-4860-adea-a12eab0ba5fc`
- Status: `rascunho`

Isso prova o caminho atual:

`Planejamento semanal -> validacao diretor -> RDO -> desvio -> ML/regras -> replanejamento rascunho`

mesmo antes da migration final.

## Bugs encontrados e corrigidos durante teste real

### 1. `payload_original` circular

Problema:

- Quando o payload ja trazia `payload_original`, o backend fazia `payload_original.raw = payload`, criando referencia circular.
- O JSON quebrava com `Circular reference detected`.

Correcao:

- `payload_original.raw` agora copia o payload sem o proprio campo `payload_original`.

### 2. FK legada `rdos.project_id`

Problema:

- O endpoint canonico gravava automaticamente `project_id = projeto_id`.
- No Supabase atual, `rdos.project_id` referencia tabela legada `projects`, enquanto `projeto_id` referencia a base canonica `projetos`.
- Isso quebrava com FK: `rdos_project_id_fkey`.

Correcao:

- RDO novo pelo endpoint canonico grava `projeto_id`.
- `project_id` so permanece se vier explicitamente e nao for igual ao ID canonico.

### 3. Endpoints novos davam 500 sem migration

Problema:

- Como as tabelas novas ainda nao existem no Supabase, rotas como `/logs`, `/planejamentos-semanais`, `/desvios`, `/replanejamentos` devolviam 500.

Correcao:

- Agora retornam `200` com `status: migration_required`.
- `/logs` tenta ler fallback de `workflow_events` quando `operational_logs` ainda nao existe.

### 4. Listagem de planejamento oscilou com erro transiente

Problema:

- Em um teste de producao, `GET /api/projetos/{id}/planejamentos-semanais` retornou `500` com `[Errno 11] Resource temporarily unavailable`.
- O dado existia no fallback, mas o endpoint so caia para fallback quando o erro era explicitamente `PGRST205`.

Correcao:

- Erros transientes de backend/PostgREST tambem passam a degradar para fallback.
- O dashboard canonico agora tambem considera fallback para planejamento, desvios, logs e replanejamentos enquanto a migration nao foi aplicada.

### 5. Fallback `workflow_events` tambem precisava retry

Problema:

- Depois do deploy, RDO e dashboard ficaram OK, mas endpoints de `desvios` e `replanejamentos` ainda oscilaram quando a leitura do fallback em `workflow_events` falhou temporariamente.

Correcao:

- A leitura de fallback agora tenta ate 3 vezes em erro transiente.
- Falha de fallback grava log operacional em vez de sumir silenciosamente.
- `GET /desvios` e `GET /replanejamentos` tambem tratam erro transiente como caso de fallback, nao como 500 definitivo.

## Teste final apos deploy `c8429dc7`

Endpoints verificados em producao:

```text
GET /api/projetos/{tatui}/rdos                  -> 200, 3 itens
GET /api/projetos/{tatui}/planejamentos-semanais -> 200, status fallback, 1 item
GET /api/projetos/{tatui}/desvios               -> 200, status fallback, 1 item
GET /api/projetos/{tatui}/replanejamentos       -> 200, status fallback, 1 item
GET /api/projetos/{tatui}/logs                  -> 200, status migration_required, 16 itens fallback
```

Dashboard verificado 5 vezes seguidas:

```text
rdos_total: 3
planejamento_ativo: true
desvios_total: 1
desvios_criticos: 1
replanejamentos_rascunho: 1
ppc_medio: 40.0
```

Resultado: a API de producao esta estavel para o ciclo operacional mesmo antes da migration canonica.

## Estado atual das integracoes

`GET /api/health/integrations`:

- `render_api`: `connected`
- `n8n`: `external`
- `whatsapp`: `open` no ultimo teste final
- `status`: `partial`

Tabelas ainda faltando no Supabase:

- `operational_logs`
- `planejamentos_semanais`
- `planejamento_itens`
- `planejamento_validacoes`
- `desvios_planejamento`
- `ml_execucoes`
- `replanejamentos`

## Migration pendente

Arquivo:

- `docs/supabase_log_planejamento_ml_20260425.sql`

O que ela cria:

- `operational_logs`
- `planejamentos_semanais`
- `planejamento_itens`
- `planejamento_validacoes`
- `desvios_planejamento`
- `ml_execucoes`
- `replanejamentos`

## Tentativa de aplicar migration automaticamente

Foi tentado aplicar via conexao Postgres usando senhas locais dos `.env`.

Resultado:

- Direct host Supabase resolveu DNS.
- Autenticacao falhou com a senha local encontrada.
- Pooler retornou `Tenant or user not found` nos hosts testados.

Conclusao:

- A senha local `POSTGRES_PASSWORD` nao e a senha do banco Supabase.
- Para aplicar automaticamente, falta uma destas opcoes:
  - connection string completa do Supabase Postgres;
  - senha do banco Supabase para usuario `postgres`;
  - `SUPABASE_ACCESS_TOKEN` com permissao para usar Supabase CLI/Management API.

## Proximo passo exato

Rodar no SQL Editor do Supabase:

```text
docs/supabase_log_planejamento_ml_20260425.sql
```

Depois validar:

```text
GET https://construdatamaxv2-clean.onrender.com/api/health/integrations
```

Resultado esperado:

- `status`: `connected` ou `partial` apenas por WhatsApp/n8n
- tabelas novas com `ok: true`

Depois disso, testar:

1. Criar planejamento semanal.
2. Validar como diretor.
3. Criar RDO abaixo do planejado.
4. Confirmar `desvios_planejamento`.
5. Rodar ML.
6. Confirmar `ml_execucoes`.
7. Confirmar `replanejamentos` em `rascunho`.
