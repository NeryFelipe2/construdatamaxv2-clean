-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 030 — FASE B: FECHAR O RLS POR EMPRESA
-- ConstruData · 28/08/2026 · APLICADA em produção
--
-- Até aqui, 145 policies estavam ABERTAS (USING true). O RLS existia só para
-- calar o advisor do Supabase: qualquer pessoa com a anon key — que vai dentro
-- do bundle do site — lia e escrevia o banco inteiro, folha de pagamento e
-- preços de contrato inclusive.
--
-- ORDEM SEGUIDA (cada passo verificado antes do seguinte):
--   1. Conferir que NENHUMA tabela de negócio tem org_id nulo — linha com
--      org_id nulo some para todo mundo no instante em que o RLS fecha.
--   2. Testar o kill switch ANTES de precisar dele → 16 / 16 / 0.
--   3. Criar as policies que faltavam: 30 tabelas não tinham substituta e
--      ficariam inacessíveis.
--   4. Remover as abertas PELO PREDICADO, não pelo nome.
--   5. Fechar as views — a porta dos fundos.
--
-- DOIS ACHADOS DURANTE A APLICAÇÃO:
--
--   (a) Os nomes das policies abertas VARIAM: 'allow_all', 'allow_all_<tabela>',
--       'temp_open', 'anon_select_*', 'operacao_total_*'. Um DROP por nome
--       adivinhado errou o alvo e deixou wcr_kanban_dia ABERTA sem que nada
--       indicasse — só o teste com role anon revelou. Por isso o fechamento
--       final é por PREDICADO (qual = 'true'), com trava que só remove a
--       policy aberta se JÁ existir outra no lugar.
--
--   (b) As 21 views rodavam como DONO e ignoravam o RLS das tabelas-base. Com
--       TODAS as tabelas fechadas, o anônimo ainda lia 161 linhas de produção
--       e a folha por obra — bastava consultar a view em vez da tabela. Sem
--       security_invoker, o fechamento inteiro seria decorativo.
--
-- RESULTADO MEDIDO EM PRODUÇÃO (JWT simulado):
--                          ANON   WILLIAN (membro)   FELIPE (admin global)
--   pessoas ..............    0          66                  100
--   preços do contrato ...    0        4788                 4788
--   RDOs .................    0          42                   42
--   lançamentos da RK ....    0           0                  134
--   folha de pagamento ...    0           0                   34
--   auditoria ............    0           0                   71
--   views (produção) .....    0         161                  161
--
--   Willian CRIA um RDO ............. OK
--   Willian LANÇA no caixa .......... OK
--   Willian tenta mexer na folha .... BLOQUEADO (0 linhas)
--   ANON tenta gravar ............... BLOQUEADO (42501)
--
-- Nenhum dado perdido: rdos 42 e pessoas 100, iguais ao antes.
--
-- ROLLBACK EM 3 SEGUNDOS, sem redeploy:
--   update public.rls_kill_switch set modo_aberto = true, motivo = 'incidente';
-- Toda policy tem rls_liberado() como primeiro termo, então o banco volta ao
-- comportamento aberto na hora. Para religar: modo_aberto = false.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public._rls_fechamento_log (
  id serial primary key, tabela text, policy_removida text, quando timestamptz default now()
);

-- ── 1. AS POLICIES QUE FALTAVAM ───────────────────────────────────────────
-- Sem elas, o passo 2 deixaria a tabela inacessível para todo mundo.

-- 1a. escopo direto por org_id
do $a$
declare t text;
begin
  foreach t in array array['pessoa_apelidos','caixa_categoria','he_valor_cargo',
                           'fcp','caixa_lancamento','horas_extras'] loop
    execute format('drop policy if exists org_read on public.%I', t);
    execute format('create policy org_read on public.%I for select
                      using ( public.rls_liberado() or org_id = any (public.orgs_visiveis()) )', t);
    execute format('drop policy if exists org_write on public.%I', t);
    execute format('create policy org_write on public.%I for all
                      using      ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )
                      with check ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )', t);
  end loop;
end $a$;

-- 1b. filhas herdam o escopo do pai (não têm org_id próprio)
drop policy if exists org_read on public.fcp_premissas;
create policy org_read on public.fcp_premissas for all
  using ( public.rls_liberado() or exists (select 1 from public.fcp f
    where f.id = fcp_premissas.fcp_id and f.org_id = any (public.orgs_visiveis())) )
  with check ( public.rls_liberado() or exists (select 1 from public.fcp f
    where f.id = fcp_premissas.fcp_id and f.org_id = any (public.orgs_editaveis())) );

drop policy if exists org_read on public.fcp_obra;
create policy org_read on public.fcp_obra for all
  using ( public.rls_liberado() or exists (select 1 from public.fcp f
    where f.id = fcp_obra.fcp_id and f.org_id = any (public.orgs_visiveis())) )
  with check ( public.rls_liberado() or exists (select 1 from public.fcp f
    where f.id = fcp_obra.fcp_id and f.org_id = any (public.orgs_editaveis())) );

-- netas: passam por fcp_obra → fcp
do $b$
declare t text;
begin
  foreach t in array array['fcp_custo_pessoa','fcp_custo_geral','fcp_realizado','fcp_preco'] loop
    execute format('drop policy if exists org_read on public.%I', t);
    execute format('create policy org_read on public.%I for all
        using ( public.rls_liberado() or exists (select 1 from public.fcp_obra o
          join public.fcp f on f.id = o.fcp_id
          where o.id = %I.fcp_obra_id and f.org_id = any (public.orgs_visiveis())) )
        with check ( public.rls_liberado() or exists (select 1 from public.fcp_obra o
          join public.fcp f on f.id = o.fcp_id
          where o.id = %I.fcp_obra_id and f.org_id = any (public.orgs_editaveis())) )', t, t, t);
  end loop;
end $b$;

drop policy if exists org_read on public.caixa_lancamento_solicitante;
create policy org_read on public.caixa_lancamento_solicitante for all
  using ( public.rls_liberado() or exists (select 1 from public.caixa_lancamento l
    where l.id = caixa_lancamento_solicitante.lancamento_id
      and l.org_id = any (public.orgs_visiveis())) )
  with check ( public.rls_liberado() or exists (select 1 from public.caixa_lancamento l
    where l.id = caixa_lancamento_solicitante.lancamento_id
      and l.org_id = any (public.orgs_editaveis())) );

-- 1c. catálogo global: benchmark e configuração não são de nenhuma empresa
do $c$
declare t text;
begin
  foreach t in array array['planilhas_modelo','plano_contas','produtividade_padrao',
                           'servico_codigo_map','rotina_slots','bot_config'] loop
    execute format('drop policy if exists cat_read on public.%I', t);
    execute format('create policy cat_read on public.%I for select
                      using ( public.rls_liberado() or auth.uid() is not null )', t);
    execute format('drop policy if exists cat_write on public.%I', t);
    execute format('create policy cat_write on public.%I for all
                      using ( public.rls_liberado() or public.is_global_admin() )
                      with check ( public.rls_liberado() or public.is_global_admin() )', t);
  end loop;
end $c$;

drop policy if exists user_state_self on public.user_state;
create policy user_state_self on public.user_state for all
  using ( public.rls_liberado() or public.is_global_admin() )
  with check ( public.rls_liberado() or public.is_global_admin() );

-- ── 2. FECHAR — pelo predicado, com trava de segurança ────────────────────
do $fecha$
declare r record; v_substitutas int; v_puladas text := '';
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public' and (qual = 'true' or with_check = 'true')
       and tablename not in ('rls_kill_switch','_rls_fechamento_log')
     order by tablename, policyname
  loop
    -- só remove se a tabela JÁ tiver outra policy assumindo o lugar
    select count(*) into v_substitutas from pg_policies p
     where p.schemaname = 'public' and p.tablename = r.tablename
       and p.policyname <> r.policyname
       and coalesce(p.qual,'') <> 'true' and coalesce(p.with_check,'') <> 'true';

    if v_substitutas > 0 then
      execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
      insert into public._rls_fechamento_log (tabela, policy_removida)
      values (r.tablename, r.policyname);
    else
      v_puladas := v_puladas || r.tablename || ' ';
    end if;
  end loop;
  if v_puladas <> '' then
    raise notice 'PULADAS (seguem abertas, sem substituta): %', v_puladas;
  end if;
end $fecha$;

-- ── 3. A PORTA DOS FUNDOS: views passam a herdar o RLS de baixo ──────────
do $v$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'v' order by c.relname
  loop
    begin
      execute format('alter view public.%I set (security_invoker = true)', r.relname);
    exception when others then
      raise warning 'view %: %', r.relname, sqlerrm;
    end;
  end loop;
end $v$;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Esperado: 9 abertas (só tabelas mortas, 0 linhas), 21 views fechadas e
-- 1 tabela com RLS sem policy (rls_kill_switch, de propósito).
select 'policies abertas restantes' item, count(*)::text v
  from pg_policies where schemaname='public' and (qual='true' or with_check='true')
union all select 'views com security_invoker', count(*)::text
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='v'
   and coalesce((select option_value from pg_options_to_table(c.reloptions)
                  where option_name='security_invoker'),'false')='true'
union all select 'tabelas com RLS e SEM policy (esperado 1)', count(*)::text
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relkind='r' and c.relrowsecurity
   and not exists (select 1 from pg_policies p
                    where p.schemaname='public' and p.tablename=c.relname);

-- Teste de isolamento — troque o uuid por um membro e rode:
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims to '{"sub":"<uuid do membro>","role":"authenticated"}';
--   select count(*) from public.pessoa_remuneracao;   -- membro: 0
--   select count(*) from public.lancamentos;          -- membro: 0
--   select count(*) from public.pessoas;              -- membro: só as da empresa dele
-- rollback;
