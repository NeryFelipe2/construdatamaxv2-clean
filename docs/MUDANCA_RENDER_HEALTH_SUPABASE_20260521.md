# Mudanca 2026-05-21: Health do Render independente do Supabase

## Motivo

O backend Render estava dando timeout em `/health` enquanto tentava abrir conexao PostgreSQL/Supabase no startup. O log indicou falha no pooler Supabase para o projeto `vblfdikfobsirwpdnybw`, mas o health check precisa subir mesmo quando o banco estiver indisponivel.

## Alteracao

- `api/server.py`
  - Startup de tarefas de banco agora e controlado por `CONSTRUDATA_RUN_STARTUP_DB_TASKS`.
  - Valor padrao: `false`.
  - Com `false`, `/health` sobe sem executar bootstrap/migracao de banco.
  - Se qualquer migracao quebrar com `true`, o erro fica em `startup` e o servidor segue vivo.

- `render.yaml`
  - `CONSTRUDATA_RUN_STARTUP_DB_TASKS=false`
  - `DATABASE_CONNECT_TIMEOUT_SECONDS=5`
  - `DATABASE_STARTUP_STATEMENT_TIMEOUT_MS=5000`

## Como validar

```powershell
Invoke-WebRequest -Uri "https://construdatamaxv2-clean.onrender.com/health" -UseBasicParsing -TimeoutSec 30
Invoke-WebRequest -Uri "https://construdatamaxv2-clean.onrender.com/api/health/integrations" -UseBasicParsing -TimeoutSec 30
```

O `/health` deve responder rapido. Problemas de Supabase ficam concentrados em `/api/health/integrations` ou nos endpoints que realmente usam banco.

## Rollback

Para voltar ao comportamento antigo:

1. Remover `_startup_db_tasks_enabled()` e o bloco que pula tarefas de banco em `api/server.py`.
2. Remover as tres variaveis novas do `render.yaml`.
3. Fazer redeploy.

Rollback rapido sem mudar codigo:

```text
CONSTRUDATA_RUN_STARTUP_DB_TASKS=true
```

Use esse rollback rapido so depois de confirmar que o `DATABASE_URL` do Render esta correto.
