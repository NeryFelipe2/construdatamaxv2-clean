-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 002 — CONTEXTO DE ORGANIZAÇÃO + INTERRUPTOR DE EMERGÊNCIA
-- ConstruData · 25/08/2026 · colar DEPOIS da 001
--
-- O QUE FAZ:
--   1. rls_kill_switch — o botão de pânico: 1 UPDATE reabre o sistema inteiro
--      na hora, sem redeploy, se o RLS travar a operação.
--   2. user_org_ativa — qual empresa o usuário está "olhando" agora
--      (admin global pode alternar; null = todas).
--   3. orgs_visiveis()/orgs_editaveis() — as funções que TODAS as policies
--      de RLS por empresa vão usar (forma de array: 1 avaliação por consulta,
--      não por linha — importante em tabelas de 4.788 linhas).
--
-- SEGURO: só cria coisas novas. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. KILL SWITCH ─────────────────────────────────────────────────────────
create table if not exists public.rls_kill_switch (
  id            boolean primary key default true check (id),
  modo_aberto   boolean not null default false,
  motivo        text,
  atualizado_em timestamptz not null default now()
);
insert into public.rls_kill_switch (id, modo_aberto)
values (true, false) on conflict (id) do nothing;

alter table public.rls_kill_switch enable row level security;
-- nenhuma policy: a tabela é INVISÍVEL pela API — só as funções
-- SECURITY DEFINER abaixo (e o SQL Editor) conseguem ler/escrever.

create or replace function public.rls_liberado()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select modo_aberto from public.rls_kill_switch where id), false);
$$;

comment on function public.rls_liberado() is
  'EMERGÊNCIA: update rls_kill_switch set modo_aberto = true → todas as '
  'policies do plano voltam ao comportamento aberto na hora. '
  'Religar: set modo_aberto = false.';

-- ── 2. EMPRESA ATIVA POR USUÁRIO ───────────────────────────────────────────
create table if not exists public.user_org_ativa (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  org_id     uuid references public.organizations(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.user_org_ativa enable row level security;

drop policy if exists uoa_self on public.user_org_ativa;
create policy uoa_self on public.user_org_ativa for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.org_ativa()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.user_org_ativa where user_id = auth.uid();
$$;

-- ── 3. FUNÇÕES DE ESCOPO (usadas por todas as policies por empresa) ────────
-- Devolvem ARRAY para o Postgres avaliar UMA vez por consulta (InitPlan),
-- em vez de uma subquery por linha.

create or replace function public.orgs_visiveis()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(o.id), '{}')
  from public.organizations o
  where ( public.is_global_admin()
          or exists (select 1 from public.organization_members m
                      where m.user_id = auth.uid() and m.org_id = o.id and m.ativo) )
    -- se o usuário escolheu uma empresa ativa, restringe a ela ("Todas" = null)
    and ( public.org_ativa() is null or o.id = public.org_ativa() );
$$;

create or replace function public.orgs_editaveis()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(o.id), '{}')
  from public.organizations o
  where ( public.is_global_admin()
          or exists (select 1 from public.organization_members m
                      where m.user_id = auth.uid() and m.org_id = o.id and m.ativo
                        and m.role in ('owner','admin','gestor','membro')) )  -- leitor NÃO edita
    and ( public.org_ativa() is null or o.id = public.org_ativa() );
$$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'kill switch existe (1)'          item, count(*)::text valor from public.rls_kill_switch
union all select 'kill switch DESLIGADO (esperado: f)', modo_aberto::text from public.rls_kill_switch
union all select 'rls_liberado() (esperado: f)', public.rls_liberado()::text
union all select 'orgs_visiveis() sem sessão (esperado: {})', public.orgs_visiveis()::text;
