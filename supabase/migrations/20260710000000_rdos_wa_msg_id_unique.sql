-- Idempotência ATÔMICA do apontamento-webhook.
--
-- PROBLEMA: o bot fazia check-then-insert (SELECT em payload->>'wa_msg_id'
-- seguido de INSERT) sem nenhuma constraint no banco. Sob concorrência — a
-- Evolution reenvia o MESMO data.key.id enquanto a 1ª request ainda não
-- commitou — as duas entregas viam o SELECT vazio e gravavam dois RDOs. O
-- trigger sync_rdo_to_medicao precificava a medição (60%) DUAS VEZES = dinheiro
-- dobrado, em silêncio.
--
-- SOLUÇÃO: índice UNIQUE na expressão (payload->>'wa_msg_id'). A segunda
-- gravação concorrente passa a falhar com 23505, que a Edge Function trata como
-- "já processado" (idempotente). É a garantia real; o SELECT vira só um atalho.
--
-- NULLs são DISTINTOS em índice único no Postgres, e o índice é parcial
-- (WHERE ... IS NOT NULL), então RDOs de outras origens (sem wa_msg_id) não
-- colidem entre si nem entram no índice. Todo RDO do apontamento-webhook sempre
-- grava uma chave não-nula (id da Evolution, ou 'nokey:<sha256>' de fallback).

-- ATENÇÃO — duplicatas pré-existentes do bug antigo fazem o CREATE UNIQUE INDEX
-- abaixo FALHAR. Rode este diagnóstico ANTES e resolva manualmente (não
-- apagamos automaticamente: RDO tem medição/dinheiro associado):
--
--   select payload->>'wa_msg_id' as wa_msg_id, count(*) as n, array_agg(id) as rdo_ids
--   from public.rdos
--   where payload->>'wa_msg_id' is not null
--   group by 1
--   having count(*) > 1;
--
-- Para cada grupo, mantenha o RDO correto e apague os RDOs duplicados (o
-- cascade/trigger acerta os medicao_itens). Só então crie o índice.

create unique index if not exists rdos_wa_msg_id_uidx
  on public.rdos ((payload->>'wa_msg_id'))
  where payload->>'wa_msg_id' is not null;
