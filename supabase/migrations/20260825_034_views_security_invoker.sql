-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 034 — VIEWS COM security_invoker (fecha a PORTA DOS FUNDOS)
-- ConstruData · 25/08/2026 · colar DEPOIS da 033
--
-- POR QUÊ: hoje as views rodam como `postgres` (security definer) — por mais
-- que as tabelas estejam trancadas com RLS, vw_producao_longa, folha_por_obra
-- etc. continuariam devolvendo TUDO para qualquer um. Com security_invoker,
-- a view passa a respeitar o RLS de quem consulta.
-- SEM ESTA MIGRATION, TODO O FECHAMENTO ANTERIOR É TEATRO.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'v'
      -- a view de compatibilidade equipe_membros fica como DEFINER de
      -- propósito enquanto o app anônimo existir; entra aqui depois
      and c.relname <> 'equipe_membros'
  loop
    execute format('alter view public.%I set (security_invoker = true)', r.relname);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select c.relname as view,
  coalesce((select option_value from pg_options_to_table(c.reloptions)
             where option_name = 'security_invoker'), 'false') as invoker
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='v'
order by 2, 1;
-- Esperado: todas 'true' exceto equipe_membros.
-- TESTE ANON: select count(*) from vw_producao_longa → 0 linhas.
