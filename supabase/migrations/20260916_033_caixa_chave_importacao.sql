-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 033 — CONTROLE DE CAIXA: IDENTIDADE DA LINHA IMPORTADA
-- ConstruData · 16/09/2026 · APLICADA em produção em 16/09/2026 (conector Supabase, autorizada pelo Felipe)
--
-- CONTEXTO: o importador do Controle de Caixa passou a usar o motor do pacote
-- (frontend/src/features/dre-financeiro/utils/controleDeCaixa*.ts). A identidade
-- de cada linha da planilha é `tipo|data|DESCRIÇÃO#ordem` — a ordem é o que
-- separa dois Ubers iguais no mesmo dia. O id do lançamento já nasce dessa chave
-- (seededId), então reimportar NÃO duplica mesmo sem esta migration.
--
-- O QUE ESTA MIGRATION ACRESCENTA:
--   1. chave_importacao — guarda a chave. Serve para auditoria ("de que linha da
--      planilha veio isto?") e para o motor casar linha antiga que ganhou coluna ID.
--   2. solicitantes_texto — o nome como está na planilha ("DAMIÃO/WELLINGTON").
--      O vínculo com `pessoas` (caixa_lancamento_solicitante) só é gravado quando
--      o casamento é seguro; sem o texto cru, a reimportação não tinha com o que
--      comparar e acusaria "cadastro alterado" em toda linha.
--   3. Índice único (projeto, chave) — trava no banco contra duplicata, além do id.
--
-- Estado verificado em 16/09/2026 (leitura): caixa_lancamento com 0 linhas,
-- então não há backfill nem conflito possível no índice.
-- Idempotente. Sem DROP.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.caixa_lancamento add column if not exists chave_importacao text;
alter table public.caixa_lancamento add column if not exists solicitantes_texto text[];

comment on column public.caixa_lancamento.chave_importacao is
  'Identidade da linha na planilha: tipo|data|DESCRIÇÃO#ordem (motor controleDeCaixaPlanilha.chaveDeConteudo).';
comment on column public.caixa_lancamento.solicitantes_texto is
  'Solicitantes como escritos na planilha. O vínculo com pessoas fica em caixa_lancamento_solicitante.';

-- Parcial: lançamento digitado na tela (sem chave) e excluído (soft delete) ficam fora.
create unique index if not exists caixa_lancamento_chave_uidx
  on public.caixa_lancamento (projeto_id, chave_importacao)
  where deleted_at is null and chave_importacao is not null;

commit;

-- ── CONFERÊNCIA (rodar depois; só leitura) ─────────────────────────────────
-- 1) As duas colunas existem:
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='caixa_lancamento'
--    and column_name in ('chave_importacao','solicitantes_texto');          -- esperado: 2 linhas
--
-- 2) O id aceita valor vindo do app (o importador grava o id determinístico):
-- select column_default from information_schema.columns
--  where table_schema='public' and table_name='caixa_lancamento' and column_name='id';  -- gen_random_uuid()
--
-- 3) Índice criado:
-- select indexname from pg_indexes where tablename='caixa_lancamento' and indexname='caixa_lancamento_chave_uidx';
--
-- 4) Órfãos (lançamento sem obra — o importador antigo gravava projeto_id nulo sem coluna OBRA):
-- select import_lote, count(*) from public.caixa_lancamento
--  where projeto_id is null and deleted_at is null group by 1;               -- esperado: 0 linhas
