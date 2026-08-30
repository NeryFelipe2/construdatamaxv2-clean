-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 032 — FECHAMENTO · LOTE DE ESCRITA WCR (o lote que importa)
-- ConstruData · 25/08/2026 · colar DEPOIS da 031 validada
--
-- ⚠️ ESTE É O MOMENTO DE MAIOR RISCO DO PLANO INTEIRO.
-- Pré-requisitos OBRIGATÓRIOS:
--   · login validado no app (RDO criado com sessão, apontamento gravado)
--   · whatsapp-motor já trocado para SERVICE_ROLE (senão para de gravar)
--   · fora de horário de obra · kill switch aberto numa aba do SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare r record;
begin
  for r in
    select p.tablename, p.policyname
    from pg_policies p
    join information_schema.columns c
      on c.table_schema = 'public' and c.table_name = p.tablename
     and c.column_name = 'org_id'
    where p.schemaname = 'public'
      -- todas as tabelas WCR com org_id, exceto as já fechadas e as RK (033)
      and p.tablename not in ('obras','funcionarios','lancamentos','fluxo_caixa',
        'centros_custo','custos_fixos','expectativa_medicao','rk_rdo_diario',
        'rk_rdo_itens','projects','files','file_relationships','ifc_models',
        'planning_tasks','team_allocations','notas_servico','tarefas',
        'whatsapp_logs','workflow_events','workflow_status','ml_execucoes')
      and p.policyname not in ('org_read','org_insert','org_update','org_delete',
                               'org_write','cat_read','cat_write','remuneracao_admin',
                               'uoa_self','org_select','orgmem_select','orgmem_write',
                               'gae_admin','profiles_self_read','profiles_self_update',
                               'profiles_admin_all')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- 1) nenhuma policy aberta (USING true) sobrou em tabela com org_id:
select p.tablename, p.policyname, p.qual
from pg_policies p
join information_schema.columns c
  on c.table_schema='public' and c.table_name = p.tablename and c.column_name='org_id'
where p.schemaname='public' and (p.qual = 'true' or p.with_check = 'true')
order by 1,2;
-- Esperado: ZERO linhas.

-- 2) nenhuma tabela com RLS ficou SEM policy (senão morre para todo mundo):
select c.relname from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p
                   where p.schemaname='public' and p.tablename = c.relname);
-- Esperado: só rls_kill_switch (invisível de propósito).

-- 3) TESTE COMPLETO NO APP LOGADO: criar RDO · apontamento · LPS · produção
--    diária · medição · equipes. TESTE ANON: nada retorna, nada grava.
-- 4) BOT: mandar apontamento de teste no grupo — tem que gravar (service_role).
