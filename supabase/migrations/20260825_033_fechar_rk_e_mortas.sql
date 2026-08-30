-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 033 — FECHAMENTO · UNIVERSO RK/LEGADO + TABELAS MORTAS
-- ConstruData · 25/08/2026 · colar DEPOIS da 032 validada
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. universo RK: só as policies org_* sobrevivem ────────────────────────
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('obras','funcionarios','lancamentos','fluxo_caixa',
        'centros_custo','custos_fixos','expectativa_medicao','rk_rdo_diario',
        'rk_rdo_itens','projects','files','file_relationships','ifc_models',
        'planning_tasks','team_allocations','notas_servico','tarefas',
        'whatsapp_logs','workflow_events','workflow_status','ml_execucoes')
      and policyname not in ('org_read','org_insert','org_update','org_delete','org_write')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── 2. tabelas mortas (0 linhas, 0 uso): REVOKE, nunca DROP ────────────────
-- DROP é irreversível; REVOKE fecha o buraco e volta com um GRANT.
do $$
declare t text;
begin
  foreach t in array array['equipes','rdo','rdo_apontamento','rdo_equipe',
    'rdo_foto','rdo_ocorrencia','logs_rdo','whatsapp_session',
    'ia_extraction_logs','ia_supervisor_logs','user_state'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select p.tablename, count(*) policies_restantes,
       count(*) filter (where p.qual='true' or p.with_check='true') abertas
from pg_policies p
where p.schemaname='public'
  and p.tablename in ('obras','funcionarios','lancamentos','fluxo_caixa','tarefas','whatsapp_logs')
group by 1 order by 1;
-- Esperado: abertas = 0 em todas.
-- TESTE: logado como admin global você AINDA vê funcionarios/lancamentos
-- (ele vê tudo); um usuário só-WCR NÃO vê (isolamento provado).
