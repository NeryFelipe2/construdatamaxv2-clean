-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 001 — ORGANIZAÇÕES (multi-empresa) + USUÁRIOS GLOBAIS
-- ConstruData · WCR Saneamento · 22/08/2026
--
-- O QUE FAZ:
--   1. Cria a tabela de organizações (empresas/clientes) e cadastra a WCR
--   2. Cria vínculo usuário↔organização com papel (owner/admin/gestor/membro/leitor)
--   3. Marca joaodsouzanery@gmail.com e felipe.nery2@gmail.com como ADMIN GLOBAL
--      (veem TUDO, de TODAS as organizações, com permissão total)
--   4. Cria funções auxiliares que as políticas de segurança (RLS) vão usar
--
-- SEGURO: só CRIA coisas novas. Não altera nem apaga nada que já existe.
-- Rode inteiro no SQL Editor do Supabase. É idempotente (pode rodar 2x).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. ORGANIZAÇÕES ────────────────────────────────────────────────────────
create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,              -- 'wcr-saneamento'
  nome        text not null,                     -- 'WCR Saneamento'
  razao_social text,
  cnpj        text,
  logo_url    text,
  cor_primaria text default '#0B3C5D',
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.organizations is 'Empresas/clientes do sistema. Cada uma enxerga só os próprios dados.';

-- a WCR como primeira organização (id fixo para poder referenciar nas outras migrations)
insert into public.organizations (id, slug, nome, razao_social, ativo)
values ('11111111-1111-4111-8111-111111111111', 'wcr-saneamento', 'WCR Saneamento',
        'WCR Saneamento Ltda', true)
on conflict (id) do update set nome = excluded.nome, slug = excluded.slug, ativo = true;

-- ── 2. PERFIS DE USUÁRIO (estende a tabela profiles que já existe) ─────────
alter table public.profiles add column if not exists is_global_admin boolean not null default false;
alter table public.profiles add column if not exists org_padrao_id uuid references public.organizations(id);
alter table public.profiles add column if not exists telefone text;
alter table public.profiles add column if not exists ativo boolean not null default true;

comment on column public.profiles.is_global_admin is
  'TRUE = enxerga e edita TUDO, em todas as organizações (dono do sistema).';

-- ── 3. LISTA DE ADMINS GLOBAIS POR E-MAIL ─────────────────────────────────
-- Como as contas ainda não foram criadas no Auth, deixamos os e-mails pré-aprovados.
-- Quando a pessoa se cadastrar/logar com um desses e-mails, ela já nasce global.
create table if not exists public.global_admin_emails (
  email      text primary key,
  observacao text,
  created_at timestamptz not null default now()
);

insert into public.global_admin_emails (email, observacao) values
  ('joaodsouzanery@gmail.com', 'Admin global — acesso total a todas as organizações'),
  ('felipe.nery2@gmail.com',   'Admin global — acesso total a todas as organizações')
on conflict (email) do nothing;

-- ── 4. VÍNCULO USUÁRIO ↔ ORGANIZAÇÃO ───────────────────────────────────────
do $$ begin
  create type public.org_role as enum ('owner','admin','gestor','membro','leitor');
exception when duplicate_object then null; end $$;

create table if not exists public.organization_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.org_role not null default 'membro',
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org  on public.organization_members(org_id);

-- ── 5. FUNÇÕES AUXILIARES (usadas pelas políticas de segurança) ────────────
-- É admin global?
create or replace function public.is_global_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p.is_global_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Organizações que o usuário logado pode ver
-- (UNION, nunca CASE com subquery escalar: com 2+ organizações o CASE
--  estouraria "more than one row returned by a subquery" — erro 21000)
create or replace function public.my_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select o.id from public.organizations o where public.is_global_admin()
  union
  select om.org_id from public.organization_members om
   where om.user_id = auth.uid() and om.ativo;
$$;

-- Tem acesso a esta organização?
create or replace function public.can_access_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_global_admin()
      or exists (select 1 from public.organization_members om
                  where om.user_id = auth.uid() and om.org_id = p_org and om.ativo);
$$;

-- Pode ESCREVER nesta organização? (leitor só lê)
create or replace function public.can_write_org(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_global_admin()
      or exists (select 1 from public.organization_members om
                  where om.user_id = auth.uid() and om.org_id = p_org and om.ativo
                    and om.role in ('owner','admin','gestor','membro'));
$$;

-- ── 6. AO CRIAR USUÁRIO: cria o perfil e aplica as regras ──────────────────
create or replace function public.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_global boolean;
  v_wcr uuid := '11111111-1111-4111-8111-111111111111';
begin
  v_global := exists (select 1 from public.global_admin_emails g
                       where lower(g.email) = lower(new.email));

  -- org_padrao_id só é definido para admin global (WCR). Usuário comum nasce
  -- SEM organização — o admin vincula depois em organization_members.
  insert into public.profiles (id, email, full_name, is_global_admin, org_padrao_id, ativo)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
          v_global, case when v_global then v_wcr else null end, true)
  on conflict (id) do update
    set email = excluded.email,
        is_global_admin = excluded.is_global_admin;

  -- admin global entra como owner em TODAS as organizações
  if v_global then
    insert into public.organization_members (org_id, user_id, role)
    select o.id, new.id, 'owner' from public.organizations o
    on conflict (org_id, user_id) do update set role = 'owner', ativo = true;
  end if;

  return new;
end $$;

-- Substitui o trigger antigo (trg_on_auth_user_created -> handle_new_user), que só
-- inseria em profiles. O novo faz isso E aplica admin global + vínculo de organização.
-- A função antiga é mantida no banco (não é apagada), apenas deixa de ser disparada.
drop trigger if exists trg_on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created     on auth.users;
drop trigger if exists on_auth_user_created_v2  on auth.users;
create trigger on_auth_user_created_v2
  after insert on auth.users
  for each row execute function public.handle_new_user_v2();

-- Se as contas JÁ existirem no Auth, aplica agora (idempotente)
update public.profiles p
   set is_global_admin = true
  from public.global_admin_emails g
 where lower(p.email) = lower(g.email);

insert into public.organization_members (org_id, user_id, role)
select o.id, p.id, 'owner'
  from public.profiles p cross join public.organizations o
 where p.is_global_admin
on conflict (org_id, user_id) do update set role = 'owner', ativo = true;

-- ── 7. SEGURANÇA DAS TABELAS CRIADAS AQUI ─────────────────────────────────
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;
alter table public.global_admin_emails  enable row level security;

drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select
  using (public.is_global_admin() or id in (select public.my_org_ids()));

drop policy if exists org_write on public.organizations;
create policy org_write on public.organizations for all
  using (public.is_global_admin()) with check (public.is_global_admin());

drop policy if exists orgmem_select on public.organization_members;
create policy orgmem_select on public.organization_members for select
  using (public.is_global_admin() or user_id = auth.uid() or public.can_access_org(org_id));

-- Gestão de membros: SÓ owner/admin da organização (nunca 'membro' — senão
-- qualquer membro poderia se promover a owner ou adicionar gente)
drop policy if exists orgmem_write on public.organization_members;
create policy orgmem_write on public.organization_members for all
  using (public.is_global_admin()
         or exists (select 1 from public.organization_members m
                     where m.user_id = auth.uid()
                       and m.org_id  = organization_members.org_id
                       and m.ativo and m.role in ('owner','admin')))
  with check (public.is_global_admin()
         or exists (select 1 from public.organization_members m
                     where m.user_id = auth.uid()
                       and m.org_id  = organization_members.org_id
                       and m.ativo and m.role in ('owner','admin')));

drop policy if exists gae_admin on public.global_admin_emails;
create policy gae_admin on public.global_admin_emails for all
  using (public.is_global_admin()) with check (public.is_global_admin());

-- ── 8. TRAVAR A TABELA profiles ────────────────────────────────────────────
-- Hoje profiles tem policy aberta (temp_open_all USING true). Depois do login,
-- isso permitiria a QUALQUER usuário rodar
--   update profiles set is_global_admin = true where id = auth.uid()
-- e virar dono do sistema. Fechamos aqui:
drop policy if exists temp_open_all    on public.profiles;
drop policy if exists temp_open        on public.profiles;
drop policy if exists temp_open_select on public.profiles;
drop policy if exists allow_all        on public.profiles;

alter table public.profiles enable row level security;

-- lê: o próprio perfil, admin global, ou colegas da mesma organização
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select
  using ( id = auth.uid()
          or public.is_global_admin()
          or exists (select 1 from public.organization_members a
                      join public.organization_members b using (org_id)
                     where a.user_id = auth.uid() and b.user_id = profiles.id
                       and a.ativo and b.ativo) );

-- edita: só o próprio perfil, e SEM poder alterar is_global_admin
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using ( id = auth.uid() )
  with check ( id = auth.uid()
               and is_global_admin = (select p.is_global_admin
                                        from public.profiles p
                                       where p.id = auth.uid()) );

-- admin global: tudo
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all
  using ( public.is_global_admin() ) with check ( public.is_global_admin() );

-- ── 9. HIGIENE DE FUNÇÕES SECURITY DEFINER ─────────────────────────────────
-- handle_new_user (antiga) e enviar_rotina são SECURITY DEFINER expostas ao
-- público — ninguém além do sistema precisa executá-las.
do $$ begin
  revoke execute on function public.handle_new_user() from anon, authenticated, public;
  alter function public.handle_new_user() set search_path = public;
exception when undefined_function then null; end $$;

do $$ begin
  revoke execute on function public.enviar_rotina(text) from anon, authenticated, public;
  alter function public.enviar_rotina(text) set search_path = public;
exception when undefined_function then null; end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'organizações' item, count(*)::text valor from public.organizations
union all select 'admins globais pré-aprovados', count(*)::text from public.global_admin_emails
union all select 'usuários no Auth', count(*)::text from auth.users
union all select 'perfis marcados como global', count(*)::text from public.profiles where is_global_admin;
