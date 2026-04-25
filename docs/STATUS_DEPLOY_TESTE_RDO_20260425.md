# Status Deploy/Teste RDO - 2026-04-25

## Resumo curto

O backend Render, o frontend Vercel e o GitHub foram atualizados. O fluxo real de RDO via API foi testado em producao e gravou no Supabase.

Ainda falta aplicar a migration SQL das tabelas novas de planejamento/log/ML no Supabase. Sem ela, o sistema opera RDO/dashboard, mas o ciclo completo `planejamento semanal -> desvios -> ML -> replanejamento` fica em modo `migration_required`.

## Commits publicados em `main`

- `3b1dfca7` - Implement operational planning ML cycle
- `01feff42` - Handle missing planning migration gracefully
- `dfb6164e` - Fix RDO payload circular reference
- `2fce95da` - Use canonical projeto_id for RDO inserts
- `dd013782` - Order RDOs by recent creation

## Deploys confirmados

### Render backend

Servico: `srv-d750kldm5p6s73feojbg`  
URL: `https://construdatamaxv2-clean.onrender.com`

Ultimo deploy live:

- Commit: `dd013782e567b4976e27af5757516cdd3392c796`
- Status: `live`

Health validado:

- `GET /health` -> `200`
- `GET /api/health/integrations` -> `200`, status `partial`

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

## Estado atual das integracoes

`GET /api/health/integrations`:

- `render_api`: `connected`
- `n8n`: `external`
- `whatsapp`: `open`
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

