-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 005 — POLICIES POR ORGANIZAÇÃO (EM PARALELO — NADA FECHA AINDA)
-- ConstruData · 25/08/2026 · colar DEPOIS da 004
--
-- Cria as policies org_read/org_insert/org_update/org_delete em TODA tabela
-- que tem org_id. As policies allow_all/temp_open/anon_* CONTINUAM EXISTINDO
-- (RLS é OR entre policies — adicionar nunca restringe). O app segue igual.
-- O fechamento de verdade acontece nas migrations 030-033, por lotes.
--
-- Toda policy tem `public.rls_liberado() or ...` como primeiro termo:
-- é o kill switch da migration 002.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  r record;
begin
  for r in
    select col.table_name as t
    from information_schema.columns col
    join pg_class c on c.relname = col.table_name
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where col.table_schema = 'public' and col.column_name = 'org_id'
      and c.relkind = 'r'
      and col.table_name not in ('organization_members','user_org_ativa','organizations')
  loop
    execute format('alter table public.%I enable row level security', r.t);

    execute format('drop policy if exists org_read on public.%I', r.t);
    execute format(
      'create policy org_read on public.%I for select
         using ( public.rls_liberado() or org_id = any (public.orgs_visiveis()) )', r.t);

    execute format('drop policy if exists org_insert on public.%I', r.t);
    execute format(
      'create policy org_insert on public.%I for insert
         with check ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )', r.t);

    execute format('drop policy if exists org_update on public.%I', r.t);
    execute format(
      'create policy org_update on public.%I for update
         using      ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )
         with check ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )', r.t);

    execute format('drop policy if exists org_delete on public.%I', r.t);
    execute format(
      'create policy org_delete on public.%I for delete
         using ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )', r.t);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Esperado: cada tabela com org_id tem as 4 policies org_* (e as antigas ainda lá)
select tablename,
       count(*) filter (where policyname like 'org\_%' escape '\') as policies_org,
       count(*) filter (where policyname not like 'org\_%' escape '\') as policies_antigas
from pg_policies
where schemaname = 'public'
  and tablename in (select table_name from information_schema.columns
                     where table_schema = 'public' and column_name = 'org_id')
group by 1
having count(*) filter (where policyname like 'org\_%' escape '\') < 4
order by 1;
-- Esperado: ZERO linhas (todas têm as 4). Se aparecer alguma, ela ficou incompleta.
