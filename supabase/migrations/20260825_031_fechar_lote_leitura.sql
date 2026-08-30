-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 031 — FECHAMENTO · LOTE DE LEITURA (tabelas que o app só lê)
-- ConstruData · 25/08/2026 · colar DEPOIS da 030 validada no app
-- Pré-requisito: LOGIN NO AR (ver aviso da 030). Kill switch à mão.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('precos_contrato','logradouros','planilhas_modelo',
                        'produtividade_padrao','servico_codigo_map',
                        'medicao_oficial','medicao_receita','rede_planejada',
                        'whatsapp_midia','equipe_aliases','equipe_alias_membros')
      and policyname not in ('org_read','org_insert','org_update','org_delete',
                             'org_write','cat_read','cat_write')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select tablename, policyname, cmd from pg_policies
where schemaname='public'
  and tablename in ('precos_contrato','logradouros','planilhas_modelo',
                    'produtividade_padrao','servico_codigo_map','medicao_oficial',
                    'medicao_receita','rede_planejada','whatsapp_midia',
                    'equipe_aliases','equipe_alias_membros')
order by 1,2;
-- Esperado: só org_* e cat_*. TESTE NO APP LOGADO: Medição, Apontamento
-- (preços carregam), Programação da Semana. TESTE ANON: precos_contrato
-- não retorna mais nada.
