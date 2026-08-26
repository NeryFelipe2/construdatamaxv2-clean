-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 023 — AUTORIZAÇÃO PRÉVIA DE ACESSO (convites) + VÍNCULO AUTOMÁTICO
-- ConstruData · 26/08/2026 · APLICADA em produção em 26/08/2026
--
-- PROBLEMA QUE RESOLVE (relatado pelo João em 25/08 à noite):
--   Ele criou as 5 contas no Dashboard do Supabase. As 2 globais
--   (felipe.nery2@ e joaodsouzanery@) funcionaram, porque estavam em
--   global_admin_emails. Mas os 3 logins da obra (Willian, Bruno, Sergio)
--   nasceram com org_padrao_id NULL e ZERO linhas em organization_members —
--   ou seja, entrariam e cairiam na tela "sua conta não está vinculada a
--   nenhuma empresa", sem conseguir fazer nada.
--
--   Causa: handle_new_user_v2 só sabia vincular ADMIN GLOBAL. Não havia
--   nenhum lugar para dizer "este e-mail entra na empresa X com o papel Y".
--
-- O QUE FAZ:
--   1. convites_acesso — a autorização prévia: e-mail → empresa + papel.
--   2. aplicar_convite() — concentra a regra num lugar só (usada pelo trigger
--      E pela aplicação retroativa; evita a regra divergir em dois lugares).
--   3. handle_new_user_v2 blindada: o vínculo roda dentro de begin/exception,
--      porque uma exceção aqui faz o Supabase RECUSAR a criação do usuário
--      com "Database error creating new user" — falha difícil de diagnosticar.
--   4. Semeia os 5 e-mails e aplica retroativamente em quem já existe.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. QUEM PODE ENTRAR, ONDE, COM QUAL PAPEL ──────────────────────────────
create table if not exists public.convites_acesso (
  email           text primary key,
  org_id          uuid not null references public.organizations(id) on delete cascade,
  role            public.org_role not null default 'membro',
  is_global_admin boolean not null default false,
  nome            text,
  observacao      text,
  criado_por      uuid references auth.users(id) on delete set null,
  criado_em       timestamptz not null default now(),
  usado_em        timestamptz
);
comment on table public.convites_acesso is
  'E-mails autorizados a entrar. Ao criar a conta, o trigger lê daqui e já vincula empresa/papel.';

-- a lista de e-mails autorizados não pode vazar para anônimo
alter table public.convites_acesso enable row level security;
drop policy if exists convites_admin on public.convites_acesso;
create policy convites_admin on public.convites_acesso for all
  using ( public.is_global_admin() or public.can_write_org(org_id) )
  with check ( public.is_global_admin() or public.can_write_org(org_id) );

-- ── 2. A REGRA, NUM LUGAR SÓ ───────────────────────────────────────────────
create or replace function public.aplicar_convite(p_user_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $fn$
declare v_conv record; v_global boolean;
begin
  v_global := exists (select 1 from public.global_admin_emails g
                       where lower(btrim(g.email)) = lower(btrim(p_email)));
  select * into v_conv from public.convites_acesso
   where lower(btrim(email)) = lower(btrim(p_email));
  if v_conv.email is not null and v_conv.is_global_admin then v_global := true; end if;

  if v_global then
    -- admin global: owner em TODAS as organizações, inclusive as futuras
    update public.profiles set is_global_admin = true,
           org_padrao_id = coalesce(org_padrao_id,'11111111-1111-4111-8111-111111111111')
     where id = p_user_id;
    insert into public.organization_members (org_id, user_id, role)
    select o.id, p_user_id, 'owner' from public.organizations o
    on conflict (org_id, user_id) do update set role='owner', ativo=true;
  elsif v_conv.email is not null then
    insert into public.organization_members (org_id, user_id, role)
    values (v_conv.org_id, p_user_id, v_conv.role)
    on conflict (org_id, user_id) do update set role=excluded.role, ativo=true;
    update public.profiles set org_padrao_id = coalesce(org_padrao_id, v_conv.org_id)
     where id = p_user_id;
  end if;
  -- sem convite e sem ser global: nasce sem organização (falha fechada, de propósito)

  if v_conv.email is not null then
    update public.convites_acesso set usado_em = coalesce(usado_em, now())
     where lower(btrim(email)) = lower(btrim(p_email));
  end if;
end $fn$;

-- ── 3. TRIGGER BLINDADO ────────────────────────────────────────────────────
create or replace function public.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, email, full_name, ativo)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name',
                   (select nome from public.convites_acesso
                     where lower(btrim(email)) = lower(btrim(new.email))),
                   split_part(new.email,'@',1)), true)
  on conflict (id) do update set email = excluded.email;

  -- o vínculo NUNCA pode derrubar a criação da conta
  begin
    perform public.aplicar_convite(new.id, new.email);
  exception when others then
    raise warning 'aplicar_convite falhou para % (%): %', new.email, new.id, sqlerrm;
  end;
  return new;
end $fn$;

-- ── 4. OS 5 ACESSOS DA WCR ─────────────────────────────────────────────────
insert into public.convites_acesso (email, org_id, role, is_global_admin, nome, observacao) values
  ('felipe.nery2@gmail.com',              '11111111-1111-4111-8111-111111111111','owner', true,  'Felipe Nery',       'Admin global — todas as empresas'),
  ('joaodsouzanery@gmail.com',            '11111111-1111-4111-8111-111111111111','owner', true,  'Joao de Souza Nery','Admin global — todas as empresas'),
  ('williansrezende@wcrsaneamento.com.br','11111111-1111-4111-8111-111111111111','membro',false,'Willian Rezende',   'Equipe de obra WCR'),
  ('bruno.guimaraes@wcrsaneamento.com.br','11111111-1111-4111-8111-111111111111','membro',false,'Bruno Guimaraes',   'Equipe de obra WCR'),
  ('sergio@wcrsaneamento.com.br',         '11111111-1111-4111-8111-111111111111','membro',false,'Sergio',            'Equipe de obra WCR')
on conflict (email) do update set org_id=excluded.org_id, role=excluded.role,
  is_global_admin=excluded.is_global_admin, nome=excluded.nome, observacao=excluded.observacao;

-- ── 5. RETROATIVO: quem já existe no Auth ganha o vínculo agora ────────────
do $mig$
declare u record;
begin
  for u in select id, email from auth.users loop
    perform public.aplicar_convite(u.id, u.email);
  end loop;
end $mig$;

update public.profiles p set full_name = c.nome
  from public.convites_acesso c
 where lower(btrim(p.email)) = lower(btrim(c.email)) and c.nome is not null;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Esperado: 2 admins globais com as 2 empresas (owner) e 3 com WCR (membro).
-- NINGUÉM pode aparecer com "SEM ACESSO".
select p.email, p.full_name, p.is_global_admin as admin_global,
       coalesce(string_agg(o.nome || ' (' || m.role || ')', ', ' order by o.nome), 'SEM ACESSO') as empresas
from public.profiles p
left join public.organization_members m on m.user_id = p.id and m.ativo
left join public.organizations o on o.id = m.org_id
group by p.email, p.full_name, p.is_global_admin
order by p.is_global_admin desc, p.email;
