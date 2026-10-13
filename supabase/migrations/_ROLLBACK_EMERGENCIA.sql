-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK DE EMERGÊNCIA — NÃO É PARA RODAR. É O EXTINTOR DE INCÊNDIO.
-- Guarde este arquivo. Cada bloco é independente — rode SÓ o que precisar.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── NÍVEL 1 · KILL SWITCH (3 segundos, do celular) ─────────────────────────
-- Reabre TODAS as policies do plano na hora, sem redeploy:
-- update public.rls_kill_switch set modo_aberto = true, motivo = 'incidente', atualizado_em = now();
-- Religar depois:
-- update public.rls_kill_switch set modo_aberto = false, atualizado_em = now();

-- ── NÍVEL 2 · UMA TABELA SÓ TRAVOU ─────────────────────────────────────────
-- alter table public.NOME_DA_TABELA disable row level security;
-- (religar: enable row level security)

-- ── NÍVEL 3 · VOLTAR equipe_membros PARA A TABELA FÍSICA ───────────────────
-- begin;
-- drop trigger if exists equipe_membros_ins on public.equipe_membros;
-- drop trigger if exists equipe_membros_upd on public.equipe_membros;
-- drop trigger if exists equipe_membros_del on public.equipe_membros;
-- drop view if exists public.equipe_membros;
-- alter table public.equipe_membros_legacy rename to equipe_membros;
-- commit;

-- ── NÍVEL 4 · RECRIAR UMA POLICY ABERTA (último recurso, por tabela) ───────
-- create policy allow_all_emergencia on public.NOME_DA_TABELA
--   for all using (true) with check (true);
-- (remover quando o incidente passar: drop policy allow_all_emergencia on ...)

-- ── NÍVEL 5 · REMOVER org_id (desfaz a 003 — NÃO PERDE DADO) ───────────────
-- alter table public.NOME_DA_TABELA alter column org_id drop not null;
-- alter table public.NOME_DA_TABELA drop column org_id;

-- ── O QUE NUNCA FAZER ──────────────────────────────────────────────────────
-- DROP TABLE de qualquer coisa. As tabelas legadas (funcionarios,
-- equipe_membros_legacy, rdo_mao_obra) são o backup auditável do sistema.
