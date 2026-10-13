# Mudanca - Estabilizacao ConstruData e Agentes - 2026-05-17

## Objetivo

Estabilizar o ConstruDataMax em uma branch limpa, sem tocar no `main` local divergido, e versionar a primeira base segura de agentes operacionais.

## Diagnostico

- Branch limpa criada a partir de `origin/main` no commit `5aad4b543777749601a31d5adbd47d5baea1bf49`.
- O frontend publico em Vercel respondeu `200`, mas `/health` via Vercel retornava HTML do SPA.
- O backend Render em `https://construdatamaxv2-clean.onrender.com/health` deu timeout em verificacao externa.
- O `main` local antigo estava `ahead 4`, `behind 26`, com muitos arquivos modificados e untracked.
- A pasta de planejamento SLNR tem fontes valiosas, mas deve virar motor central, nao mais scripts soltos.

## Arquivos alterados

- `api/agents_operacional.py`
- `api/routes_agentes_orquestrador.py`
- `api/tests/test_agentes_inbox.py`
- `api/server.py`
- `api/startup_migrations.py`
- `core/database.py`
- `frontend/src/lib/api.ts`
- `docs/MUDANCA_ESTABILIZACAO_AGENTES_20260517.md`

## O que foi implementado

- `POST /api/agentes/inbox` como entrada unica para mensagens operacionais.
- `POST /api/agentes/orquestrador` delegando evento `mensagem` para o inbox operacional.
- Startup do backend tolerante a falha/lentidao de banco para manter `/health` disponivel.
- Timeout curto para conexoes PostgreSQL/Supabase no startup.
- `/health` passa a expor o estado do bootstrap e da migracao operacional.
- Frontend passa a exigir JSON real nas chamadas API, evitando aceitar HTML do SPA como backend saudavel.
- Testes do inbox operacional adicionados.

## Validacao

Executado em 2026-05-17:

```text
python -m pytest api\tests\test_agentes_inbox.py api\tests\test_pmbok_decision_engine.py api\tests\test_rk_scope.py
17 passed

npm run build
build OK

python -m py_compile api\agents_operacional.py api\routes_agentes_orquestrador.py api\server.py api\startup_migrations.py core\database.py
OK
```

Tambem foram validados com `TestClient`:

- `GET /health`
- `GET /api/health/integrations`
- `POST /api/agentes/inbox`
- `POST /api/agentes/orquestrador`

Observacao local: o mount Flask opcional informou ausencia de `flask`, e a migracao operacional informou ausencia de `psycopg2` no Python local. Ambos sao tolerados no startup e estao cobertos pelo `backend/requirements.txt` no deploy.


Config desejada para esta fase:

- modo local;
- workspace restrito;
- web/search/browser desativados por padrao;
- acoes externas futuras somente via allowlist explicita para Supabase, n8n, Render, Vercel e WhatsApp.


Backup criado:

```text
```

## Rollback

Para desfazer a estabilizacao desta branch:

1. Remover os arquivos novos:
   - `api/agents_operacional.py`
   - `api/routes_agentes_orquestrador.py`
   - `api/tests/test_agentes_inbox.py`
   - `docs/MUDANCA_ESTABILIZACAO_AGENTES_20260517.md`
2. Em `api/server.py`, remover:
   - import de `routes_agentes_orquestrador`;
   - `app.include_router(orquestrador_router)`;
   - `STARTUP_STATUS`;
   - tratamento resiliente do startup;
   - campo `startup` do `/health`.
3. Em `api/startup_migrations.py`, remover `connect_timeout` e `statement_timeout`.
4. Em `core/database.py`, remover `DATABASE_CONNECT_TIMEOUT_SECONDS`.
5. Em `frontend/src/lib/api.ts`, remover a validacao de `content-type` JSON e de `health.app`.

Nenhuma limpeza foi feita na pasta antiga. Ela continua como arquivo historico e fonte de comparacao.
