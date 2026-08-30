-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 030 — FECHAMENTO · LOTE PILOTO (3 tabelas de risco zero)
-- ConstruData · 25/08/2026
--
-- ⚠️⚠️ SÓ COLE ESTA (E AS SEGUINTES 031-035) DEPOIS QUE:
--   1. o login estiver NO AR e as contas dos 2 admins criadas no Dashboard;
--   2. você tiver logado e visto o app funcionando com sessão;
--   3. fora de horário de obra (depois das 18h, nunca sexta-feira).
-- Antes disso, PARE AQUI — o pacote 001-022 já entrega tudo sem fechar nada.
--
-- Se algo quebrar: o kill switch reabre tudo na hora:
--   update rls_kill_switch set modo_aberto = true, motivo = 'incidente';
--
-- Este lote fecha só 3 tabelas pequenas para validar o mecanismo.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('guia_progresso','viabilidade_estudos','wcr_kanban_dia')
      and policyname not in ('org_read','org_insert','org_update','org_delete','org_write')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- 1) só sobraram as policies org_* — esperado: nenhuma linha fora de org_*
select tablename, policyname from pg_policies
where schemaname='public'
  and tablename in ('guia_progresso','viabilidade_estudos','wcr_kanban_dia')
order by 1,2;
-- 2) TESTE NO APP LOGADO: abrir o Guia e o Kanban do dia — devem funcionar.
-- 3) TESTE ANON (aba anônima SEM login): esses dados não aparecem mais.
