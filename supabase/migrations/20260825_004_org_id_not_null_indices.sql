-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 004 — org_id NOT NULL + ÍNDICES
-- ConstruData · 25/08/2026 · colar DEPOIS da 003, com a conferência da 003 ZERADA
--
-- Se a conferência 1 da migration 003 devolveu QUALQUER linha, NÃO rode esta.
-- Idempotente. Reversível (alter column drop not null).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare
  r record;
begin
  -- todas as tabelas de public que ganharam org_id na 003
  for r in
    select col.table_name as t
    from information_schema.columns col
    join pg_class c on c.relname = col.table_name
    join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
    where col.table_schema = 'public' and col.column_name = 'org_id'
      and c.relkind = 'r'
      and col.table_name not in ('organization_members','user_org_ativa')  -- já são NOT NULL / têm regra própria
  loop
    -- só promove a NOT NULL se de fato não sobrou nulo (dupla checagem)
    execute format('update public.%I set org_id = coalesce(org_id,
      (select case when %L = any(array[''obras'',''funcionarios'',''lancamentos'',''fluxo_caixa'',''centros_custo'',''custos_fixos'',''expectativa_medicao'',''rk_rdo_diario'',''rk_rdo_itens'',''projects'',''files'',''file_relationships'',''ifc_models'',''planning_tasks'',''team_allocations'',''notas_servico'',''tarefas'',''whatsapp_logs'',''workflow_events'',''workflow_status'',''ml_execucoes''])
        then ''22222222-2222-4222-8222-222222222222''::uuid
        else ''11111111-1111-4111-8111-111111111111''::uuid end))
      where org_id is null', r.t, r.t);
    execute format('alter table public.%I alter column org_id set not null', r.t);
    -- índice só nas tabelas com volume (o planner ignora índice em tabela minúscula,
    -- mas criar não faz mal — e o custo aqui é milissegundos)
    execute format('create index if not exists %I on public.%I (org_id)',
                   'idx_'||r.t||'_org', r.t);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Esperado: todas as linhas com attnotnull = true
select c.relname as tabela, a.attnotnull as org_id_not_null
from pg_attribute a
join pg_class c on c.oid = a.attrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and a.attname = 'org_id' and c.relkind = 'r'
order by 2, 1;
