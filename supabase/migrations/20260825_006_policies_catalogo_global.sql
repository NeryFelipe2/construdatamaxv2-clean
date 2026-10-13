-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 006 — POLICIES DO CATÁLOGO GLOBAL (EM PARALELO — NADA FECHA)
-- ConstruData · 25/08/2026 · colar DEPOIS da 005
--
-- Catálogo global = tabelas SEM org_id, compartilhadas por todas as empresas:
-- leitura para qualquer usuário logado, escrita só admin global.
-- As policies antigas continuam até as migrations de fechamento.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  t text;
  catalogo text[] := array[
    'produtividade_padrao','planilhas_modelo','plano_contas',
    'servico_codigo_map','bot_config','rotina_slots'
  ];
begin
  foreach t in array catalogo loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists cat_read on public.%I', t);
    execute format(
      'create policy cat_read on public.%I for select
         using ( public.rls_liberado() or auth.uid() is not null )', t);

    execute format('drop policy if exists cat_write on public.%I', t);
    execute format(
      'create policy cat_write on public.%I for all
         using ( public.rls_liberado() or public.is_global_admin() )
         with check ( public.rls_liberado() or public.is_global_admin() )', t);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select tablename, policyname, cmd from pg_policies
where schemaname = 'public'
  and tablename in ('produtividade_padrao','planilhas_modelo','plano_contas',
                    'servico_codigo_map','bot_config','rotina_slots')
  and policyname in ('cat_read','cat_write')
order by 1, 2;
-- Esperado: 2 policies (cat_read, cat_write) para cada uma das 6 tabelas.
