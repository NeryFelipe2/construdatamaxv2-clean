-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 023 — CONVITES: AUTORIZAÇÃO PRÉVIA DE ACESSO
-- ConstruData · WCR Saneamento · 25/08/2026 · colar DEPOIS da 022
--
-- O PROBLEMA QUE ISTO RESOLVE:
--   Quem NÃO está em global_admin_emails nasce hoje com org_padrao_id = null e
--   ZERO linhas em organization_members. Ao logar cai na tela "sua conta não
--   está vinculada a nenhuma empresa" e não consegue fazer mais nada — vincular
--   exigia abrir o Dashboard do Supabase na mão. Era o que estava travando o
--   pessoal de obra (Willian, Bruno, Sérgio).
--
-- O QUE FAZ:
--   1. convites_acesso — a lista de e-mails AUTORIZADOS ANTES de a conta
--      existir (empresa + papel + se é admin global). É onde a tela de usuários
--      e a Edge Function admin-usuarios (ação 'convidar') escrevem.
--   2. aplicar_convite(user_id, email) — a REGRA num lugar só: decide se é
--      global, cria/ajusta o profile, cria o vínculo na empresa e marca o
--      convite como usado. Chamada pelo trigger E pelo bloco retroativo.
--   3. handle_new_user_v2() reescrita: passa a consultar os convites e NUNCA
--      levanta exceção (erro aqui vira "Database error creating new user" e o
--      Supabase se recusa a criar a conta).
--   4. Semeia os 5 e-mails combinados (2 admins globais + 3 da obra da WCR).
--   5. Aplica retroativamente em quem já existe no Auth.
--
-- CORRIGE 2 FUROS DE SEGURANÇA do rascunho que já está no banco:
--   (a) aplicar_convite() está com EXECUTE liberado para PUBLIC/anon/
--       authenticated. Como é SECURITY DEFINER e não checa quem chamou,
--       qualquer um com a anon key (que vai no bundle do frontend) podia fazer
--         POST /rest/v1/rpc/aplicar_convite
--         {"p_user_id":"<eu>","p_email":"joaodsouzanery@gmail.com"}
--       e virar admin global de TODAS as empresas. Aqui ela passa a ser
--       executável só pelo dono (o trigger) e pelo service_role (Edge Function).
--   (b) A policy de convites_acesso estava em can_write_org(), que inclui
--       'gestor' e 'membro' — o pessoal de obra podia LER a lista inteira de
--       e-mails autorizados e INSERIR convite com is_global_admin = true.
--       Passa a ser só admin global ou owner/admin da própria empresa, igual
--       à orgmem_write da 001.
--   (c) Mesmo restrita a owner/admin, a policy não olhava a COLUNA
--       is_global_admin: um owner/admin de UMA empresa gravava um convite para
--       um e-mail próprio com is_global_admin = true, pedia o magic link na
--       tela de login (signInWithOtp cria a conta) e virava owner de TODAS as
--       empresas. O WITH CHECK agora exige ser admin global para marcar
--       is_global_admin = true. Latente hoje (todo owner/admin também é
--       global), vira real na primeira vez que a ação 'papel' promover
--       alguém da obra a admin da WCR.
--
-- SEGURO: só cria/ajusta. Não apaga usuário, vínculo nem convite existente.
-- Idempotente: roda igual num banco limpo e no banco de hoje (que já tem a
-- tabela e os 5 convites criados à mão).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. A TABELA DE CONVITES ────────────────────────────────────────────────
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

-- se a tabela veio de uma versão anterior, garante as colunas que faltarem
alter table public.convites_acesso add column if not exists nome       text;
alter table public.convites_acesso add column if not exists observacao text;
alter table public.convites_acesso add column if not exists criado_por uuid
  references auth.users(id) on delete set null;
alter table public.convites_acesso add column if not exists criado_em  timestamptz not null default now();
alter table public.convites_acesso add column if not exists usado_em   timestamptz;

comment on table public.convites_acesso is
  'Autorização PRÉVIA de acesso: e-mail liberado ANTES de a conta existir. '
  'Quando a pessoa aparece em auth.users, o trigger on_auth_user_created_v2 '
  'aplica o vínculo sozinho. Convite usado NÃO é apagado — vira o histórico '
  'de quem autorizou quem.';

comment on column public.convites_acesso.email is
  'DECISÃO: o e-mail é guardado SEMPRE em lower(btrim()) e a normalização é '
  'feita na ESCRITA (trigger trg_convites_normalizar), com um CHECK que '
  'rejeita o que escapar. Não é coluna gerada de propósito: assim a própria PK '
  'já é o valor normalizado, "on conflict (email)" funciona direto e as '
  'consultas não precisam de lower() (que descartaria o índice único).';

comment on column public.convites_acesso.role is
  'Papel INICIAL na empresa. Depois que o vínculo existe, quem manda é '
  'organization_members (ação "papel" da Edge Function) — reaplicar o convite '
  'não rebaixa nem promove ninguém.';

comment on column public.convites_acesso.usado_em is
  'Preenchido na primeira vez que a conta é criada/vinculada. null = convite '
  'ainda pendente (a pessoa nunca logou).';

-- ── 2. NORMALIZAÇÃO DO E-MAIL (a PK É o e-mail normalizado) ────────────────
-- Sem isto 'Sergio@WCR...' e 'sergio@wcr...' viram DUAS linhas, e o convite
-- "some" quando a pessoa digita o e-mail com outra caixa no login.
create or replace function public.convites_normalizar()
returns trigger language plpgsql set search_path = public as $$
begin
  new.email      := lower(btrim(coalesce(new.email, '')));
  new.nome       := nullif(btrim(coalesce(new.nome, '')), '');
  new.observacao := nullif(btrim(coalesce(new.observacao, '')), '');
  return new;
end $$;

drop trigger if exists trg_convites_normalizar on public.convites_acesso;
create trigger trg_convites_normalizar
  before insert or update on public.convites_acesso
  for each row execute function public.convites_normalizar();

-- arruma o que porventura já esteja torto ANTES de criar o CHECK.
-- (primeiro joga fora a duplicata torta que colidiria com a versão certa —
--  senão o update abaixo estouraria a chave primária)
delete from public.convites_acesso a
 where a.email <> lower(btrim(a.email))
   and exists (select 1 from public.convites_acesso b
                where b.email = lower(btrim(a.email)));

update public.convites_acesso
   set email = lower(btrim(email))
 where email <> lower(btrim(email));

do $$ begin
  alter table public.convites_acesso
    add constraint convites_email_normalizado
    check (email = lower(btrim(email)) and position('@' in email) > 1);
exception when duplicate_object then null; end $$;

-- ── 3. ÍNDICES ─────────────────────────────────────────────────────────────
-- a policy filtra por org_id; a tela de usuários lista os pendentes por empresa
create index if not exists convites_acesso_org_idx on public.convites_acesso (org_id);
create index if not exists convites_acesso_pendentes_idx
  on public.convites_acesso (org_id) where usado_em is null;

-- ── 4. SEGURANÇA: quem enxerga e quem mexe na lista ────────────────────────
alter table public.convites_acesso enable row level security;

-- A lista de e-mails autorizados é dado de ACESSO, não dado de operação:
-- gestão de acesso é owner/admin, exatamente como a orgmem_write da 001 já
-- faz em organization_members. can_write_org() NÃO serve aqui porque inclui
-- 'gestor' e 'membro' (era o furo (b) do cabeçalho).
drop policy if exists convites_admin  on public.convites_acesso;
drop policy if exists convites_select on public.convites_acesso;
drop policy if exists convites_write  on public.convites_acesso;
drop policy if exists allow_all_temp  on public.convites_acesso;
drop policy if exists allow_all       on public.convites_acesso;

create policy convites_admin on public.convites_acesso for all
  using ( public.is_global_admin()
          or exists (select 1 from public.organization_members m
                      where m.user_id = auth.uid()
                        and m.org_id  = convites_acesso.org_id
                        and m.ativo and m.role in ('owner','admin')) )
  with check ( ( public.is_global_admin()
          or exists (select 1 from public.organization_members m
                      where m.user_id = auth.uid()
                        and m.org_id  = convites_acesso.org_id
                        and m.ativo and m.role in ('owner','admin')) )
          -- FURO (c): só admin GLOBAL pode MARCAR um convite como admin global.
          -- Sem esta linha, um owner/admin de UMA empresa (papel que a ação
          -- 'papel' da Edge Function vai distribuir) grava um convite para um
          -- e-mail próprio com is_global_admin = true, pede o magic link na
          -- tela de login (signInWithOtp cria a conta), o trigger aplica o
          -- convite e ele vira owner de TODAS as empresas — inclusive da
          -- RK / Legado, que não é dele. Rebaixar (true -> false) continua
          -- liberado: não é escalada.
          and ( convites_acesso.is_global_admin = false
                or public.is_global_admin() ) );

-- DE PROPÓSITO sem public.rls_liberado(): o botão de pânico reabre as tabelas
-- de OPERAÇÃO. A lista de quem tem acesso ao sistema não vaza nem durante um
-- incidente — e ninguém precisa dela para tocar obra.

-- anon é a chave publicada no bundle do frontend: não tem NADA aqui.
revoke all on public.convites_acesso from anon;
-- authenticated até tem os verbos, mas a policy acima é quem decide de verdade
grant select, insert, update, delete on public.convites_acesso to authenticated;
-- service_role = a Edge Function admin-usuarios (passa por cima do RLS)
grant all on public.convites_acesso to service_role;

-- ── 5. A REGRA, NUM LUGAR SÓ ───────────────────────────────────────────────
-- Concentrar aqui evita a regra de vínculo existir em 2 versões (trigger e
-- bloco retroativo) e sair de sincronia na primeira manutenção.
create or replace function public.aplicar_convite(p_user_id uuid, p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_wcr     uuid := '11111111-1111-4111-8111-111111111111';
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_tem     boolean := false;      -- existe convite para este e-mail?
  v_org     uuid;
  v_role    text;                  -- org_role lido como texto e recastado no
                                   -- insert: evita depender do enum aqui
  v_cglob   boolean := false;      -- o convite marca admin global?
  v_nome    text;
  v_global  boolean := false;      -- decisão final
begin
  if p_user_id is null or v_email = '' then
    return;
  end if;

  select c.org_id, c.role::text, c.is_global_admin, c.nome
    into v_org, v_role, v_cglob, v_nome
    from public.convites_acesso c
   where c.email = v_email;
  v_tem := found;

  -- global = está na lista fixa (global_admin_emails) OU o convite diz que é
  v_global := exists (select 1 from public.global_admin_emails g
                       where lower(btrim(g.email)) = v_email)
              or coalesce(v_cglob, false);

  -- 1) PERFIL — upsert: serve tanto para quem acabou de nascer (o trigger já
  --    inseriu) quanto para o retroativo em conta antiga sem profile.
  --    NUNCA rebaixa: is_global_admin só sobe, org_padrao_id e full_name só
  --    preenchem o que estiver vazio (não pisa em escolha do usuário).
  begin
    insert into public.profiles (id, email, full_name, is_global_admin, org_padrao_id, ativo)
    values (p_user_id, v_email,
            coalesce(nullif(btrim(v_nome), ''), split_part(v_email, '@', 1)),
            v_global,
            case when v_global then v_wcr else v_org end,
            true)
    on conflict (id) do update
       set is_global_admin = profiles.is_global_admin or excluded.is_global_admin,
           org_padrao_id   = coalesce(profiles.org_padrao_id, excluded.org_padrao_id),
           full_name       = coalesce(nullif(btrim(profiles.full_name), ''), excluded.full_name),
           updated_at      = now();
  exception when unique_violation then
    -- profiles.email é UNIQUE: se o e-mail já pertence a OUTRA linha (conta
    -- recriada com uuid novo), o on conflict (id) não pega. O perfil não dá
    -- para criar, mas o VÍNCULO — que é o ponto — ainda tem que sair.
    update public.profiles
       set is_global_admin = is_global_admin or v_global,
           org_padrao_id   = coalesce(org_padrao_id, case when v_global then v_wcr else v_org end),
           updated_at      = now()
     where id = p_user_id;
    raise warning 'aplicar_convite: e-mail % já está em outro profile — vínculo aplicado assim mesmo', v_email;
  end;

  -- 2) VÍNCULO COM A(S) EMPRESA(S)
  if v_global then
    -- admin global entra como owner em TODAS as organizações (regra da 001)
    insert into public.organization_members (org_id, user_id, role)
    select o.id, p_user_id, 'owner' from public.organizations o
    on conflict (org_id, user_id) do update set role = 'owner', ativo = true;

  elsif v_tem and v_org is not null then
    -- convidado comum: SÓ a empresa do convite, com o papel do convite.
    -- No conflito só REATIVA — não sobrescreve papel já ajustado na tela.
    insert into public.organization_members (org_id, user_id, role)
    values (v_org, p_user_id, coalesce(nullif(btrim(v_role), ''), 'membro')::public.org_role)
    on conflict (org_id, user_id) do update set ativo = true;
  end if;
  -- sem convite e sem lista fixa: nada acontece. Continua FALHANDO FECHADO
  -- (nasce sem empresa) — mas agora isso é exceção, não a regra.

  -- 3) marca o convite como usado (só a primeira vez: usado_em é histórico)
  if v_tem then
    update public.convites_acesso
       set usado_em = coalesce(usado_em, now())
     where email = v_email;
  end if;
end $$;

comment on function public.aplicar_convite(uuid, text) is
  'Aplica a autorização prévia de acesso a um usuário do Auth. Chamada pelo '
  'trigger on_auth_user_created_v2 e pelo bloco retroativo da migration 023. '
  'NÃO checa quem chamou (é chamada pelo dono e pelo service_role) — por isso '
  'o EXECUTE é revogado de PUBLIC/anon/authenticated logo abaixo.';

-- ⚠ FURO (a) DO CABEÇALHO — a correção que importa:
-- esta função é SECURITY DEFINER e não valida o chamador. Exposta ao PostgREST,
-- qualquer um com a anon key vira admin global em uma chamada. Ninguém mais
-- executa: o trigger roda como o dono (postgres) e a Edge Function usa
-- service_role.
revoke execute on function public.aplicar_convite(uuid, text) from public, anon, authenticated;
grant  execute on function public.aplicar_convite(uuid, text) to service_role;

-- ── 6. TRIGGER DE CRIAÇÃO DE USUÁRIO (à prova de bala) ─────────────────────
-- REGRA DE OURO: esta função NÃO pode levantar exceção em NENHUM caminho.
-- Ela roda dentro da transação que insere em auth.users; qualquer erro faz o
-- Supabase devolver "Database error creating new user" e a conta simplesmente
-- não nasce. Por isso cada etapa vai no seu begin/exception/end: o pior caso
-- vira um WARNING no log do Postgres (recuperável rodando aplicar_convite),
-- nunca uma conta que não pôde ser criada.
create or replace function public.handle_new_user_v2()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_wcr    uuid := '11111111-1111-4111-8111-111111111111';
  v_email  text := lower(btrim(coalesce(new.email, '')));
  v_global boolean := false;
  v_nome   text;
begin
  -- (a) é admin global? lista fixa OU convite marcado como global
  begin
    v_global := exists (select 1 from public.global_admin_emails g
                         where lower(btrim(g.email)) = v_email)
             or exists (select 1 from public.convites_acesso c
                         where c.email = v_email and c.is_global_admin);
  exception when others then
    v_global := false;   -- catálogo indisponível não pode impedir a conta
  end;

  -- (b) nome do convite (usado só se o signup não trouxer full_name)
  begin
    select c.nome into v_nome from public.convites_acesso c where c.email = v_email;
  exception when others then
    v_nome := null;
  end;

  -- (c) PERFIL — a parte essencial, ainda assim protegida: conta sem profile
  --     é recuperável (aplicar_convite conserta); conta que não nasce, não.
  begin
    insert into public.profiles (id, email, full_name, is_global_admin, org_padrao_id, ativo)
    values (new.id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name',
                     nullif(btrim(v_nome), ''),
                     split_part(coalesce(new.email, 'usuario@'), '@', 1)),
            v_global,
            case when v_global then v_wcr else null end,
            true)
    on conflict (id) do update
       set email           = excluded.email,
           is_global_admin = profiles.is_global_admin or excluded.is_global_admin,
           updated_at      = now();
  exception when others then
    raise warning 'handle_new_user_v2: profile de % (%) não criado: %',
                  new.email, new.id, sqlerrm;
  end;

  -- (d) VÍNCULO (convite ou admin global). Nunca bloqueia a criação da conta.
  begin
    perform public.aplicar_convite(new.id, new.email);
  exception when others then
    raise warning 'handle_new_user_v2: aplicar_convite falhou para % (%): %',
                  new.email, new.id, sqlerrm;
  end;

  return new;
end $$;

-- recria o trigger (idempotente — a 001 já criou este mesmo nome)
drop trigger if exists on_auth_user_created_v2 on auth.users;
create trigger on_auth_user_created_v2
  after insert on auth.users
  for each row execute function public.handle_new_user_v2();

-- ── 7. SEMEIA OS E-MAILS COMBINADOS ────────────────────────────────────────
-- Os 2 globais entram TAMBÉM como convite (redundante com global_admin_emails,
-- que a 001 já semeou) só para a tela de usuários mostrar todo mundo numa
-- lista só. 'do nothing': rodar de novo NÃO desfaz ajuste feito pela tela.
insert into public.convites_acesso (email, org_id, role, is_global_admin, nome, observacao) values
  ('felipe.nery2@gmail.com',               '11111111-1111-4111-8111-111111111111',
   'owner',  true,  'Felipe Nery',        'Admin global — enxerga todas as empresas'),
  ('joaodsouzanery@gmail.com',             '11111111-1111-4111-8111-111111111111',
   'owner',  true,  'Joao de Souza Nery', 'Admin global — enxerga todas as empresas'),
  ('williansrezende@wcrsaneamento.com.br', '11111111-1111-4111-8111-111111111111',
   'membro', false, 'Willian Rezende',    'Pessoal de obra WCR'),
  ('bruno.guimaraes@wcrsaneamento.com.br', '11111111-1111-4111-8111-111111111111',
   'membro', false, 'Bruno Guimaraes',    'Pessoal de obra WCR'),
  ('sergio@wcrsaneamento.com.br',          '11111111-1111-4111-8111-111111111111',
   'membro', false, 'Sergio',             'Pessoal de obra WCR')
on conflict (email) do nothing;

-- ── 8. APLICAÇÃO RETROATIVA ────────────────────────────────────────────────
-- Se a conta JÁ existe no Auth (criada à mão no Dashboard, ou pela Edge
-- Function antes desta migration), aplica o vínculo agora. Hoje o banco tem
-- os 5 usuários criados — mas isto tem que continuar funcionando em qualquer
-- re-execução, inclusive num banco com 0 usuários.
-- CUIDADO com a condição: NÃO pode ser "sem vínculo ATIVO". aplicar_convite faz
-- "on conflict do update set ativo = true", então quem foi REVOGADO na tela
-- (ativo = false) seria RESSUSCITADO em silêncio a cada re-execução — e este
-- arquivo é anunciado como "rodar 2x não estraga nada". Por isso o filtro é
-- "nunca teve vínculo nenhum": conserta quem nasceu órfão sem desfazer revogação.
do $$
declare r record; n int := 0;
begin
  for r in
    select u.id as user_id, u.email
      from auth.users u
      join public.convites_acesso c on c.email = lower(btrim(u.email))
     where not exists (select 1 from public.organization_members m
                        where m.user_id = u.id)
  loop
    begin
      perform public.aplicar_convite(r.user_id, r.email);
      n := n + 1;
    exception when others then
      raise warning 'retroativo (convite): % — %', r.email, sqlerrm;
    end;
  end loop;
  raise notice 'convites aplicados retroativamente: %', n;
end $$;

-- Quem já tinha vínculo não passa pelo laço acima, então o usado_em dele não
-- seria carimbado. A conta EXISTE, logo o convite foi consumido: marca aqui.
-- (coalesce preserva o carimbo original — usado_em é histórico, não contador.)
update public.convites_acesso c
   set usado_em = coalesce(c.usado_em, now())
 where c.usado_em is null
   and exists (select 1 from auth.users u where lower(btrim(u.email)) = c.email);

-- rede de segurança: admin global da lista fixa que ficou sem vínculo ativo
do $$
declare r record;
begin
  for r in
    select u.id as user_id, u.email
      from auth.users u
     where exists (select 1 from public.global_admin_emails g
                    where lower(btrim(g.email)) = lower(btrim(u.email)))
       and not exists (select 1 from public.organization_members m
                        where m.user_id = u.id and m.ativo)
  loop
    begin
      perform public.aplicar_convite(r.user_id, r.email);
    exception when others then
      raise warning 'retroativo (global): % — %', r.email, sqlerrm;
    end;
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'convites cadastrados (esperado 5)' item, count(*)::text valor
  from public.convites_acesso
union all select 'convites globais (esperado 2)', count(*)::text
  from public.convites_acesso where is_global_admin
union all select 'convites de obra WCR (esperado 3)', count(*)::text
  from public.convites_acesso where not is_global_admin
union all select 'e-mail fora do padrão lower/btrim (esperado 0)', count(*)::text
  from public.convites_acesso where email <> lower(btrim(email))
union all select 'e-mails autorizados',
  coalesce(string_agg(email, ', ' order by email), '(nenhum)') from public.convites_acesso
union all select 'usuários no Auth', count(*)::text from auth.users
union all select 'usuário COM convite e SEM vínculo ativo (esperado 0)', count(*)::text
  from auth.users u
  join public.convites_acesso c on c.email = lower(btrim(u.email))
 where not exists (select 1 from public.organization_members m
                    where m.user_id = u.id and m.ativo)
union all select 'convites ainda pendentes (ninguém logou)', count(*)::text
  from public.convites_acesso where usado_em is null
union all select 'policies em convites_acesso (esperado 1)', count(*)::text
  from pg_policies where schemaname = 'public' and tablename = 'convites_acesso'
-- o WITH CHECK tem a trava extra do furo (c), então ele é OBRIGATORIAMENTE
-- diferente (e maior) que o USING. Comparar os dois é mais robusto do que
-- procurar um texto exato, que depende de como o Postgres reimprime a expressão.
union all select 'policy trava is_global_admin p/ não-global? (esperado true)',
  coalesce((select pg_get_expr(p.polwithcheck, p.polrelid)
                is distinct from pg_get_expr(p.polqual, p.polrelid)
              from pg_policy p
             where p.polrelid = to_regclass('public.convites_acesso')
               and p.polname = 'convites_admin'), false)::text
union all select 'CHECK de e-mail normalizado (esperado 1)', count(*)::text
  from pg_constraint where conrelid = to_regclass('public.convites_acesso')
   and conname = 'convites_email_normalizado'
union all select 'trigger de normalização ativo (esperado true)',
  exists (select 1 from pg_trigger where tgrelid = to_regclass('public.convites_acesso')
           and tgname = 'trg_convites_normalizar' and not tgisinternal)::text
union all select 'trigger on_auth_user_created_v2 ativo (esperado true)',
  exists (select 1 from pg_trigger where tgrelid = to_regclass('auth.users')
           and tgname = 'on_auth_user_created_v2' and not tgisinternal)::text
union all select 'anon LÊ convites? (esperado false)',
  has_table_privilege('anon', 'public.convites_acesso', 'select')::text
union all select 'anon EXECUTA aplicar_convite? (esperado false)',
  has_function_privilege('anon', 'public.aplicar_convite(uuid,text)', 'execute')::text
union all select 'authenticated EXECUTA aplicar_convite? (esperado false)',
  has_function_privilege('authenticated', 'public.aplicar_convite(uuid,text)', 'execute')::text
union all select 'service_role EXECUTA aplicar_convite? (esperado true)',
  has_function_privilege('service_role', 'public.aplicar_convite(uuid,text)', 'execute')::text;

-- Se "usuário COM convite e SEM vínculo ativo" NÃO for 0, alguém vai bater na
-- tela "conta não vinculada a nenhuma empresa" — investigar antes de avisar
-- o pessoal que pode logar.
