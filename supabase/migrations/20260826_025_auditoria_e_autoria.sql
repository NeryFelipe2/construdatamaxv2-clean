-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 025 — RASTREABILIDADE DE AUTORIA + AUDIT LOG (item 3)
--                 + correção do UNIQUE do Kanban (perda entre empresas)
-- ConstruData · 26/08/2026
--
-- POR QUE: hoje o banco tem ZERO colunas de autoria em 100+ tabelas, nenhuma
-- tabela de log, e 42 foreign keys em CASCADE. Não há como saber quem fez o
-- quê, e todo DELETE é destrutivo de verdade.
--
-- O QUE FAZ:
--   1. wcr_kanban_dia: troca UNIQUE(data) por UNIQUE(data, org_id). Hoje a
--      segunda empresa que salvasse o mesmo dia APAGARIA o dia da primeira.
--   2. audit_log: quem, quando, o quê, antes e depois (jsonb), origem e IP.
--   3. Colunas de autoria em toda tabela de negócio:
--      created_by/created_at/updated_by/updated_at/deleted_by/deleted_at.
--   4. Dois triggers genéricos aplicados a TODAS essas tabelas:
--      - fn_carimbo()  BEFORE INSERT/UPDATE → preenche autoria sozinho
--      - fn_auditoria() AFTER INSERT/UPDATE/DELETE → grava no audit_log
--      Feito no Postgres, não no app: nada escapa, nem script, nem integração,
--      nem alteração feita direto no SQL Editor.
--   5. O audit_log guarda dados_antes no DELETE — ou seja, mesmo um DELETE
--      destrutivo (incluindo os 42 CASCADE) passa a ser RECUPERÁVEL.
--
-- SEGURANÇA DE OPERAÇÃO: os triggers NUNCA levantam exceção. Uma falha de log
-- não pode derrubar a gravação do usuário nem o bot do WhatsApp.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. KANBAN: unicidade por empresa ───────────────────────────────────────
alter table public.wcr_kanban_dia drop constraint if exists wcr_kanban_dia_data_key;
do $$ begin
  alter table public.wcr_kanban_dia
    add constraint wcr_kanban_dia_data_org_key unique (data, org_id);
exception when duplicate_table or duplicate_object then null; end $$;

-- ── 2. A TABELA DE AUDITORIA ───────────────────────────────────────────────
create table if not exists public.audit_log (
  id           bigserial primary key,
  tabela       text        not null,
  registro_id  text,
  acao         text        not null check (acao in ('INSERT','UPDATE','DELETE')),
  usuario_id   uuid,
  usuario_nome text,
  origem       text,                      -- 'app' | 'integracao' | 'sistema'
  ip           text,
  dados_antes  jsonb,
  dados_depois jsonb,
  campos       text[],                    -- só os campos que mudaram (UPDATE)
  org_id       uuid,
  criado_em    timestamptz not null default now()
);
comment on table public.audit_log is
  'Trilha de auditoria. Alimentada por trigger no Postgres — nada escapa, nem '
  'script, nem integração, nem alteração feita no SQL Editor.';

create index if not exists audit_log_tabela_idx   on public.audit_log (tabela, criado_em desc);
create index if not exists audit_log_registro_idx on public.audit_log (tabela, registro_id);
create index if not exists audit_log_usuario_idx  on public.audit_log (usuario_id, criado_em desc);
create index if not exists audit_log_data_idx     on public.audit_log (criado_em desc);
create index if not exists audit_log_org_idx      on public.audit_log (org_id, criado_em desc);

alter table public.audit_log enable row level security;
-- o log é somente leitura pela API: quem escreve é o trigger (SECURITY DEFINER)
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select
  using ( public.is_global_admin()
          or (org_id is not null and public.is_org_admin(org_id)) );

-- ── 3. QUEM É O USUÁRIO DA VEZ ─────────────────────────────────────────────
create or replace function public.audit_usuario()
returns table (uid uuid, nome text, origem text)
language plpgsql stable security definer set search_path = public as $fn$
declare v_uid uuid; v_nome text; v_origem text;
begin
  begin v_uid := auth.uid(); exception when others then v_uid := null; end;
  if v_uid is not null then
    select p.full_name into v_nome from public.profiles p where p.id = v_uid;
    v_origem := 'app';
  else
    -- sem sessão: service_role (Edge Function, bot do WhatsApp, script Python)
    v_origem := 'integracao';
  end if;
  return query select v_uid, coalesce(v_nome,'(sem nome)'), v_origem;
end $fn$;

-- ── 4. CARIMBO DE AUTORIA (BEFORE) ─────────────────────────────────────────
create or replace function public.fn_carimbo()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_uid uuid;
begin
  begin v_uid := auth.uid(); exception when others then v_uid := null; end;
  if TG_OP = 'INSERT' then
    begin
      if to_jsonb(NEW) ? 'created_by' and NEW.created_by is null then NEW.created_by := v_uid; end if;
      if to_jsonb(NEW) ? 'created_at' and NEW.created_at is null then NEW.created_at := now(); end if;
    exception when others then null; end;
  elsif TG_OP = 'UPDATE' then
    begin
      if to_jsonb(NEW) ? 'updated_by' then NEW.updated_by := v_uid; end if;
      if to_jsonb(NEW) ? 'updated_at' then NEW.updated_at := now(); end if;
      -- soft delete: marcou deleted_at, registra quem marcou
      if to_jsonb(NEW) ? 'deleted_at' and NEW.deleted_at is not null
         and (OLD.deleted_at is null) and to_jsonb(NEW) ? 'deleted_by' then
        NEW.deleted_by := v_uid;
      end if;
    exception when others then null; end;
  end if;
  return NEW;
end $fn$;

-- ── 5. O LOG (AFTER) ───────────────────────────────────────────────────────
create or replace function public.fn_auditoria()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  v_antes jsonb; v_depois jsonb; v_id text; v_org uuid;
  v_uid uuid; v_nome text; v_origem text; v_campos text[];
begin
  -- log NUNCA pode derrubar a operação do usuário
  begin
    select u.uid, u.nome, u.origem into v_uid, v_nome, v_origem from public.audit_usuario() u;

    if TG_OP = 'DELETE' then v_antes := to_jsonb(OLD);
    elsif TG_OP = 'INSERT' then v_depois := to_jsonb(NEW);
    else v_antes := to_jsonb(OLD); v_depois := to_jsonb(NEW);
      select array_agg(k) into v_campos from jsonb_each(v_depois) e(k,v)
       where v_antes->e.k is distinct from e.v
         and e.k not in ('updated_at','updated_by');
      -- update que não mudou nada de fato: não polui o log
      if v_campos is null or array_length(v_campos,1) is null then return null; end if;
    end if;

    v_id  := coalesce(v_depois->>'id', v_antes->>'id',
                      v_depois->>'email', v_antes->>'email');
    begin
      v_org := coalesce((v_depois->>'org_id')::uuid, (v_antes->>'org_id')::uuid);
    exception when others then v_org := null; end;

    insert into public.audit_log
      (tabela, registro_id, acao, usuario_id, usuario_nome, origem,
       ip, dados_antes, dados_depois, campos, org_id)
    values
      (TG_TABLE_NAME, v_id, TG_OP, v_uid, v_nome, v_origem,
       nullif(current_setting('request.headers', true)::jsonb->>'x-forwarded-for',''),
       v_antes, v_depois, v_campos, v_org);
  exception when others then
    raise warning 'audit_log falhou em %.%: %', TG_TABLE_NAME, TG_OP, sqlerrm;
  end;
  return null;
end $fn$;

-- ── 6. APLICAR EM TODAS AS TABELAS DE NEGÓCIO ──────────────────────────────
do $aplica$
declare
  t record; v_n int := 0;
  -- fora: o próprio log, catálogo de acesso e tabelas de sessão/config
  excluidas text[] := array['audit_log','rls_kill_switch','user_org_ativa',
                            'global_admin_emails','whatsapp_session'];
begin
  for t in
    select c.relname
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'
       and not (c.relname = any (excluidas))
     order by c.relname
  loop
    begin
      -- colunas de autoria (só cria o que faltar)
      execute format('alter table public.%I add column if not exists created_by uuid', t.relname);
      execute format('alter table public.%I add column if not exists created_at timestamptz default now()', t.relname);
      execute format('alter table public.%I add column if not exists updated_by uuid', t.relname);
      execute format('alter table public.%I add column if not exists updated_at timestamptz', t.relname);
      execute format('alter table public.%I add column if not exists deleted_at timestamptz', t.relname);
      execute format('alter table public.%I add column if not exists deleted_by uuid', t.relname);

      execute format('drop trigger if exists trg_carimbo on public.%I', t.relname);
      execute format('create trigger trg_carimbo before insert or update on public.%I
                        for each row execute function public.fn_carimbo()', t.relname);

      execute format('drop trigger if exists trg_auditoria on public.%I', t.relname);
      execute format('create trigger trg_auditoria after insert or update or delete on public.%I
                        for each row execute function public.fn_auditoria()', t.relname);
      v_n := v_n + 1;
    exception when others then
      raise warning 'tabela % ignorada: %', t.relname, sqlerrm;
    end;
  end loop;
  raise notice 'auditoria aplicada em % tabelas', v_n;
end $aplica$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'tabelas com autoria'  item, count(distinct table_name)::text valor
  from information_schema.columns where table_schema='public' and column_name='created_by'
union all select 'tabelas com soft delete', count(distinct table_name)::text
  from information_schema.columns where table_schema='public' and column_name='deleted_at'
union all select 'triggers de auditoria', count(*)::text
  from pg_trigger where tgname='trg_auditoria' and not tgisinternal
union all select 'unique do kanban', string_agg(indexdef,' ')
  from pg_indexes where tablename='wcr_kanban_dia' and indexname like '%data%';
