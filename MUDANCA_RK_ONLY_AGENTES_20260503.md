# Mudanca RK-Only Agentes - 2026-05-03

## Objetivo

Travou estruturalmente os agentes e rotinas automaticas no escopo RK:

- Tatui - RK
- Osasco - Rua Cuiaba
- RK SUB Empreita

Ficaram fora dos agentes automaticos:

- Consorcio Se Liga na Rede - SLNR Santos
- Pardinho - Consorcio Itapetininga
- ConstruData Brasilia

## Arquivos Alterados

- `api/supabase_client.py`
  - Criou `RK_PROJECT_IDS`, `EXCLUDED_AGENT_PROJECT_IDS`, `is_rk_project`, `rk_project_ids`, `canonical_project_id`, `related_project_ids` e `filter_rk_rows`.
- `api/routes_whatsapp.py`
  - `/api/whatsapp/numeros` agora retorna somente contatos ativos RK.
  - Cadastro legado em `/api/whatsapp/numeros` exige `projeto_id` RK e, quando possivel, grava em `contatos`.
  - `/api/whatsapp/send` bloqueia projeto fora de RK e telefone que nao esteja em contatos ativos RK.
  - Webhook de entrada ignora projeto fora de RK.
  - Cobranca RDO dry-run filtra somente RK.
  - Dispatch de tarefa usa Evolution protegido pelo mesmo filtro RK.
- `api/routes_integracao_total.py`
  - Rotas de logs/agendamentos WhatsApp por projeto exigem projeto RK.
- `api/routes_notificacoes.py`
  - Pendencias e contatos sao consultados somente por `projeto_id` RK.
  - Disparo usa o endpoint/funcao de WhatsApp protegida, nao motor solto.
- `api/routes_pmbok.py`
  - Analises/cobrancas PMBOK exigem ou filtram projeto RK.
- `api/pmbok_decision_engine.py`
  - Itens de cobranca diaria carregam `projeto_id`.
- `api/tests/test_rk_scope.py`
  - Testes de allowlist, bloqueio SLNR, filtro de contatos e PMBOK RK.

## Pontos De Rollback

Para voltar esta mudanca:

1. Remover os helpers RK de `api/supabase_client.py`.
2. Voltar `api/routes_whatsapp.py` para consultar `contatos` sem `rk_project_ids`.
3. Trocar `_rk_project_or_404` por `_project_or_404` nas rotas WhatsApp de `api/routes_integracao_total.py`.
4. Remover filtros `projeto_id=in.(...)` de `api/routes_notificacoes.py`.
5. Remover `_scoped_rk_payload` e `_scoped_rk_items` de `api/routes_pmbok.py`.
6. Remover `api/tests/test_rk_scope.py`.

## Validacao Esperada

- `/api/whatsapp/numeros?scope=rk` nao retorna SLNR/Santos.
- `/api/whatsapp/send` com `projeto_id` SLNR retorna `blocked_non_rk`.
- Cobranca PMBOK ignora engenheiro de projeto fora da allowlist RK.
- Logs de disparo real de WhatsApp carregam `projeto_id` RK quando o envio passa.

## Atualizacao 2026-05-03 - Health Integrations

- Adicionado `api/startup_migrations.py` para aplicar automaticamente, no boot do Render, a migration idempotente `docs/supabase_log_planejamento_ml_20260425.sql`.
- Objetivo: criar/garantir `operational_logs`, `planejamentos_semanais`, `planejamento_itens`, `planejamento_validacoes`, `desvios_planejamento`, `ml_execucoes` e `replanejamentos` sem depender de etapa manual.
- Health de Evolution passou a mostrar `whatsapp_state`, `evolution_url` e `evolution_instance`, inclusive quando faltar API key.
- Variaveis `EVOLUTION_*` sao higienizadas com `strip()` antes de montar headers/URLs, evitando falso `unreachable` por whitespace em segredo ou instancia.
