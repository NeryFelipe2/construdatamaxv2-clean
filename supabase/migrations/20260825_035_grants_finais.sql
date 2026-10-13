-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 035 — HIGIENE FINAL: GRANTS + search_path
-- ConstruData · 25/08/2026 · colar DEPOIS da 034 · o pacote termina aqui
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- funções SECURITY DEFINER com search_path fixo (advisor do Supabase)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}'::text[])) cfg
                       where cfg like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', r.fn);
  end loop;
end $$;

-- futuro: nada novo nasce aberto para anon
alter default privileges in schema public revoke insert, update, delete on tables from anon;

commit;

-- ── CONFERÊNCIA FINAL — O TESTE QUE PROVA O PROJETO ────────────────────────
-- (rodar no SQL Editor; troque <uuid-teste-wcr> por um usuário vinculado SÓ à WCR)
--
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<uuid-teste-wcr>","role":"authenticated"}';
--   select 'producao_diaria (esperado 168)' t, count(*) from producao_diaria
--   union all select 'precos_contrato (esperado 4788)', count(*) from precos_contrato
--   union all select 'lancamentos RK (esperado 0)',     count(*) from lancamentos
--   union all select 'funcionarios RK (esperado 0)',    count(*) from funcionarios
--   union all select 'fluxo_caixa RK (esperado 0)',     count(*) from fluxo_caixa;
-- rollback;
--
-- begin;
--   set local role anon;
--   select 'precos_contrato anon (esperado 0)' t, count(*) from precos_contrato
--   union all select 'vw_producao_longa anon (esperado 0)', count(*) from vw_producao_longa;
-- rollback;
--
-- Enquanto esses números não baterem, o multi-empresa NÃO está pronto —
-- por mais que a tela pareça certa.

select 'advisor: funções sem search_path (esperado 0)' item, count(*)::text valor
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig,'{}'::text[])) cfg
                   where cfg like 'search_path=%');
