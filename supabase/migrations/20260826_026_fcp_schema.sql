-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 026 — FLUXO DE CAIXA PROJETADO (FCP) · schema + fórmulas
-- ConstruData · 26/08/2026
--
-- Espelha a planilha FLUXO_CAIXA_PROJETADO_BERTIOGA_SANTOS_v4.xlsx (11 abas).
--
-- PRINCÍPIO DESTE SCHEMA: guarda-se apenas ENTRADA (premissas, custos, produção
-- realizada). Tudo que é derivado — produção prevista, medição, imposto, saldo,
-- capital recomendado — é CALCULADO por função SQL na hora da leitura.
-- Por quê: se o número derivado fosse gravado, uma premissa alterada deixaria
-- o valor velho no banco, e ninguém saberia qual dos dois está certo. Aqui só
-- existe uma fonte da verdade, e ela é o cálculo.
--
-- As fórmulas ficam AQUI, no Postgres, e não no frontend — assim a planilha
-- importada, o formulário da tela e o webhook do n8n produzem exatamente o
-- mesmo número.
--
-- FLUXO DE APROVAÇÃO: rascunho → enviado → aprovado | devolvido.
-- Depois de aprovado, a edição trava (só admin reabre; o audit_log registra).
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. O DOCUMENTO ─────────────────────────────────────────────────────────
do $$ begin
  create type public.fcp_status as enum ('rascunho','enviado','aprovado','devolvido');
exception when duplicate_object then null; end $$;

create table if not exists public.fcp (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default '11111111-1111-4111-8111-111111111111'
                  references public.organizations(id) on delete cascade,
  nome          text not null,
  semana_ref    date not null,                    -- segunda-feira da semana do FCP
  status        public.fcp_status not null default 'rascunho',
  observacao    text,                             -- devolução da diretoria
  enviado_em    timestamptz, enviado_por    uuid,
  aprovado_em   timestamptz, aprovado_por   uuid,
  devolvido_em  timestamptz, devolvido_por  uuid,
  reaberto_em   timestamptz, reaberto_por   uuid,
  versao        int not null default 1
);
-- "um FCP por obra por semana": o documento é semanal e cada obra aparece uma
-- única vez dentro dele (unique em fcp_obra), então a regra fica garantida.
create unique index if not exists fcp_semana_uidx on public.fcp (org_id, semana_ref);
create index if not exists fcp_status_idx on public.fcp (org_id, status, semana_ref desc);

-- ── 2. PREMISSAS (o painel de controle da aba PREMISSAS) ───────────────────
create table if not exists public.fcp_premissas (
  fcp_id             uuid primary key references public.fcp(id) on delete cascade,
  -- calendário e contrato
  inicio_obra        date    not null,
  fim_operacao       date    not null,
  dias_mes           int     not null default 30   check (dias_mes between 1 and 31),
  defasagem_dias     int     not null default 20   check (defasagem_dias >= 0),
  imposto_aliquota   numeric not null default 0.22 check (imposto_aliquota >= 0 and imposto_aliquota < 1),
  -- cenário
  cenario            text    not null default 'ÓTIMA'
                       check (cenario in ('MÍNIMA','MÉDIA','BOA','ÓTIMA')),
  margem_minima      numeric not null default 0.00,
  margem_media       numeric not null default 0.10,
  margem_boa         numeric not null default 0.15,
  margem_otima       numeric not null default 0.20,
  -- capital e risco
  contingencia       numeric not null default 0.15 check (contingencia >= 0),
  fator_primeiro_mes numeric not null default 0.5  check (fator_primeiro_mes between 0 and 1),
  -- QUEM PAGA O QUÊ (regime com o consórcio)
  paga_folha         text not null default 'CONSÓRCIO' check (paga_folha       in ('CONSÓRCIO','WCR')),
  paga_engenheiro    text not null default 'CONSÓRCIO' check (paga_engenheiro  in ('CONSÓRCIO','WCR')),
  paga_estrutura     text not null default 'CONSÓRCIO' check (paga_estrutura   in ('CONSÓRCIO','WCR')),
  paga_indiretos     text not null default 'WCR'       check (paga_indiretos   in ('CONSÓRCIO','WCR')),
  paga_mobilizacao   text not null default 'CONSÓRCIO' check (paga_mobilizacao in ('CONSÓRCIO','WCR')),
  desconta_medicao   boolean not null default true,
  base_imposto       text not null default 'MEDIÇÃO CHEIA'
                       check (base_imposto in ('MEDIÇÃO CHEIA','LÍQUIDA DO DESCONTO')),
  check (fim_operacao >= inicio_obra)
);

-- ── 3. AS OBRAS DENTRO DO FCP (Bertioga, Santos, …) ────────────────────────
create table if not exists public.fcp_obra (
  id           uuid primary key default gen_random_uuid(),
  fcp_id       uuid not null references public.fcp(id) on delete cascade,
  nome         text not null,
  ordem        int  not null default 0,
  -- ticket: obra sem mix usa ticket_unico; com mix (Santos) usa água/esgoto/%
  ticket_unico  numeric,
  ticket_agua   numeric,
  ticket_esgoto numeric,
  pct_esgoto    numeric check (pct_esgoto is null or (pct_esgoto >= 0 and pct_esgoto <= 1)),
  mobilizacao   numeric not null default 0,
  unique (fcp_id, nome),
  -- ou o ticket é único, ou é o par água/esgoto com o mix — nunca nenhum dos dois
  check (ticket_unico is not null or (ticket_agua is not null and ticket_esgoto is not null and pct_esgoto is not null))
);

-- ── 4. CUSTOS (aba CUSTOS <OBRA>) ──────────────────────────────────────────
-- categoria decide QUEM PAGA (cruza com as premissas paga_*)
do $$ begin
  create type public.fcp_categoria as enum ('folha','engenheiro','estrutura','indiretos');
exception when duplicate_object then null; end $$;

-- quadro nominal da equipe
create table if not exists public.fcp_custo_pessoa (
  id          uuid primary key default gen_random_uuid(),
  fcp_obra_id uuid not null references public.fcp_obra(id) on delete cascade,
  pessoa_id   uuid references public.pessoas(id) on delete set null, -- opcional: liga ao RH
  equipe      text,
  nome        text not null,
  cargo       text,
  salario     numeric not null default 0,
  encargos    numeric not null default 0,
  beneficios  numeric not null default 0,
  ordem       int not null default 0
);
comment on column public.fcp_custo_pessoa.pessoa_id is
  'Opcional. Quando preenchido, liga ao cadastro do módulo Recursos Humanos. '
  'Fica nulo para equipe que ainda não está cadastrada (ex.: Bertioga/Santos), '
  'sem impedir o FCP de existir.';

-- custos gerais (engenheiro, carros, alojamento, indiretos…)
create table if not exists public.fcp_custo_geral (
  id              uuid primary key default gen_random_uuid(),
  fcp_obra_id     uuid not null references public.fcp_obra(id) on delete cascade,
  item            text not null,
  categoria       public.fcp_categoria not null default 'estrutura',
  quantidade      numeric not null default 1,
  valor_unitario  numeric not null default 0,
  observacao      text,
  ordem           int not null default 0
);

-- ── 5. PRODUÇÃO REALIZADA (o PLANEJADO × REALIZADO) ────────────────────────
-- Só o REALIZADO é gravado. O previsto é calculado. Semana sem linha aqui
-- usa o planejado — é exatamente a regra da planilha.
create table if not exists public.fcp_realizado (
  id          uuid primary key default gen_random_uuid(),
  fcp_obra_id uuid not null references public.fcp_obra(id) on delete cascade,
  n_semana    int  not null check (n_semana between 1 and 60),
  producao    numeric not null default 0,
  observacao  text,
  unique (fcp_obra_id, n_semana)
);

-- ── 6. PREÇOS DO CONTRATO (abas PREÇOS <OBRA>) ─────────────────────────────
create table if not exists public.fcp_preco (
  id                 uuid primary key default gen_random_uuid(),
  fcp_obra_id        uuid not null references public.fcp_obra(id) on delete cascade,
  item_codigo        text,
  descricao          text not null,
  numero_preco       text,
  unidade            text,
  valor_unitario     numeric,
  observacao         text,
  requer_conferencia boolean not null default false,
  ordem              int not null default 0
);
comment on column public.fcp_preco.requer_conferencia is
  'Marcado pelo importador quando o valor é duvidoso (ausente, zero, negativo '
  'ou fora de ordem de grandeza) — a tela destaca para conferência humana.';

create index if not exists fcp_obra_fcp_idx      on public.fcp_obra(fcp_id);
create index if not exists fcp_cpessoa_obra_idx  on public.fcp_custo_pessoa(fcp_obra_id);
create index if not exists fcp_cgeral_obra_idx   on public.fcp_custo_geral(fcp_obra_id);
create index if not exists fcp_realizado_obra_idx on public.fcp_realizado(fcp_obra_id);
create index if not exists fcp_preco_obra_idx    on public.fcp_preco(fcp_obra_id);

-- ═══════════════════════ AS FÓRMULAS ═══════════════════════════════════════
-- Implementadas exatamente como especificado, no backend.

-- ticket_ponderado = ticket_esgoto × %esgoto + ticket_agua × (1 − %esgoto)
create or replace function public.fcp_ticket(p_obra public.fcp_obra)
returns numeric language sql immutable as $$
  select coalesce(
    p_obra.ticket_unico,
    p_obra.ticket_esgoto * p_obra.pct_esgoto + p_obra.ticket_agua * (1 - p_obra.pct_esgoto)
  );
$$;

-- margem do cenário adotado
create or replace function public.fcp_margem(p_prem public.fcp_premissas)
returns numeric language sql immutable as $$
  select case p_prem.cenario
    when 'MÍNIMA' then p_prem.margem_minima
    when 'MÉDIA'  then p_prem.margem_media
    when 'BOA'    then p_prem.margem_boa
    else               p_prem.margem_otima end;
$$;

-- custo mensal da obra, separado por quem paga
create or replace function public.fcp_custo_obra(p_obra_id uuid)
returns table (total numeric, folha numeric, engenheiro numeric, estrutura numeric, indiretos numeric)
language sql stable as $$
  with pes as (
    select coalesce(sum(salario + encargos + beneficios),0) v
      from public.fcp_custo_pessoa where fcp_obra_id = p_obra_id and deleted_at is null
  ), ger as (
    select categoria, coalesce(sum(quantidade * valor_unitario),0) v
      from public.fcp_custo_geral where fcp_obra_id = p_obra_id and deleted_at is null
     group by categoria
  )
  select
    (select v from pes) + coalesce((select sum(v) from ger),0),
    (select v from pes) + coalesce((select v from ger where categoria='folha'),0),
    coalesce((select v from ger where categoria='engenheiro'),0),
    coalesce((select v from ger where categoria='estrutura'),0),
    coalesce((select v from ger where categoria='indiretos'),0);
$$;

-- quanto do custo mensal o CONSÓRCIO banca (e portanto desconta da medição)
create or replace function public.fcp_desconto_consorcio(p_obra_id uuid, p_prem public.fcp_premissas)
returns numeric language sql stable as $$
  select case when not p_prem.desconta_medicao then 0 else
    (case when p_prem.paga_folha      = 'CONSÓRCIO' then c.folha      else 0 end) +
    (case when p_prem.paga_engenheiro = 'CONSÓRCIO' then c.engenheiro else 0 end) +
    (case when p_prem.paga_estrutura  = 'CONSÓRCIO' then c.estrutura  else 0 end) +
    (case when p_prem.paga_indiretos  = 'CONSÓRCIO' then c.indiretos  else 0 end)
  end from public.fcp_custo_obra(p_obra_id) c;
$$;

-- o que sai do CAIXA DA WCR por mês
create or replace function public.fcp_custo_wcr(p_obra_id uuid, p_prem public.fcp_premissas)
returns numeric language sql stable as $$
  select
    (case when p_prem.paga_folha      = 'WCR' then c.folha      else 0 end) +
    (case when p_prem.paga_engenheiro = 'WCR' then c.engenheiro else 0 end) +
    (case when p_prem.paga_estrutura  = 'WCR' then c.estrutura  else 0 end) +
    (case when p_prem.paga_indiretos  = 'WCR' then c.indiretos  else 0 end)
  from public.fcp_custo_obra(p_obra_id) c;
$$;

-- dias de obra no mês, considerando mês parcial (obra que começa dia 24)
create or replace function public.fcp_dias_no_mes(p_mes date, p_inicio date, p_fim date)
returns int language sql immutable as $$
  select greatest(0, (
    least(p_fim, (date_trunc('month', p_mes) + interval '1 month - 1 day')::date)
    - greatest(p_inicio, date_trunc('month', p_mes)::date)
  ) + 1)::int;
$$;

-- data de pagamento = último dia do mês + defasagem
create or replace function public.fcp_data_pagamento(p_mes date, p_defasagem int)
returns date language sql immutable as $$
  select ((date_trunc('month', p_mes) + interval '1 month - 1 day')::date + p_defasagem);
$$;

-- ── A GRADE SEMANAL ────────────────────────────────────────────────────────
-- producao_prevista = custo_mensal × (1+margem) / (1−imposto) / ticket × 7 / dias_mes
-- medicao           = (realizado ?? previsto) × ticket
create or replace function public.fcp_semanas(p_fcp_id uuid, p_semanas int default 12)
returns table (
  obra_id uuid, obra text, n_semana int, data_ini date, data_fim date,
  producao_prevista numeric, producao_realizada numeric, pct_planejado numeric,
  medicao numeric, recebimento numeric, imposto numeric, desconto_consorcio numeric,
  custo_wcr numeric, mobilizacao numeric, despesas numeric,
  saldo_periodo numeric, saldo_acumulado numeric
) language plpgsql stable as $fn$
declare
  pr public.fcp_premissas%rowtype; ob public.fcp_obra%rowtype;
  v_margem numeric; v_ticket numeric; v_custo numeric; v_desc numeric; v_wcr numeric;
  v_prev numeric; v_real numeric; v_med numeric; v_acum numeric; i int;
  v_receb numeric; v_imp numeric; v_mob numeric; v_desp numeric; v_saldo numeric;
  v_semanas_mes numeric;
begin
  select * into pr from public.fcp_premissas where fcp_id = p_fcp_id;
  if not found then return; end if;
  v_margem := public.fcp_margem(pr);

  for ob in select * from public.fcp_obra where fcp_id = p_fcp_id order by ordem, nome loop
    v_ticket := public.fcp_ticket(ob);
    if coalesce(v_ticket,0) = 0 then continue; end if;          -- sem ticket não há como projetar
    select total into v_custo from public.fcp_custo_obra(ob.id);
    v_desc_mes := public.fcp_desconto_consorcio(ob.id, pr);
    v_wcr  := public.fcp_custo_wcr(ob.id, pr);
    v_semanas_mes := pr.dias_mes::numeric / 7;                  -- rateio mensal → semanal
    v_acum := 0;

    for i in 1..p_semanas loop
      v_prev := v_custo * (1 + v_margem) / (1 - pr.imposto_aliquota) / v_ticket * 7 / pr.dias_mes;
      select r.producao into v_real from public.fcp_realizado r
        where r.fcp_obra_id = ob.id and r.n_semana = i and r.deleted_at is null;
      v_med   := coalesce(v_real, v_prev) * v_ticket;
      -- recebimento entra defasado: a semana i recebe o que foi medido antes
      v_receb := case when i * 7 > pr.defasagem_dias then v_med else 0 end;
      -- o consórcio desconta da MEDIÇÃO o que ele banca. Sem recebimento na
      -- semana (ainda dentro da defasagem) não há de onde descontar, e o valor
      -- não vira saída de caixa da WCR — senão o fluxo mostra um negativo que
      -- não existe.
      v_desc  := least(v_desc_mes / v_semanas_mes, v_receb);
      v_imp   := case when pr.base_imposto = 'MEDIÇÃO CHEIA'
                      then v_receb else greatest(0, v_receb - v_desc) end * pr.imposto_aliquota;
      v_mob   := case when i = 1 and pr.paga_mobilizacao = 'WCR' then ob.mobilizacao else 0 end;
      v_desp  := v_imp + v_desc + (v_wcr / v_semanas_mes) + v_mob;
      v_saldo := v_receb - v_desp;
      v_acum  := v_acum + v_saldo;

      obra_id := ob.id; obra := ob.nome; n_semana := i;
      data_ini := pr.inicio_obra + ((i - 1) * 7);
      data_fim := data_ini + 6;
      producao_prevista := round(v_prev, 2);
      producao_realizada := v_real;
      pct_planejado := case when v_real is null or v_prev = 0 then null else round(v_real / v_prev, 4) end;
      medicao := round(v_med, 2);
      recebimento := round(v_receb, 2);
      imposto := round(v_imp, 2);
      desconto_consorcio := round(v_desc, 2);
      custo_wcr := round(v_wcr / v_semanas_mes, 2);
      mobilizacao := round(v_mob, 2);
      despesas := round(v_desp, 2);
      saldo_periodo := round(v_saldo, 2);
      saldo_acumulado := round(v_acum, 2);
      return next;
    end loop;
  end loop;
end $fn$;

-- capital_recomendado = max(0, −min(saldo acumulado)) × (1 + contingencia)
create or replace function public.fcp_capital(p_fcp_id uuid, p_semanas int default 12)
returns table (pior_saldo numeric, necessidade numeric, contingencia numeric, capital_recomendado numeric)
language sql stable as $$
  with s as (
    select n_semana, sum(saldo_periodo) sp
      from public.fcp_semanas(p_fcp_id, p_semanas) group by n_semana
  ), ac as (
    select sum(sp) over (order by n_semana) acum from s
  ), a as (
    select min(acum) pior from ac
  ), p as (select * from public.fcp_premissas where fcp_id = p_fcp_id)
  select round(a.pior,2), round(greatest(0, -a.pior),2), p.contingencia,
         round(greatest(0, -a.pior) * (1 + p.contingencia), 2)
    from a, p;
$$;

-- VIABILIDADE: produção necessária por cenário (serviços/mês, /semana, /dia)
create or replace function public.fcp_viabilidade(p_fcp_id uuid)
returns table (obra text, cenario text, margem numeric, receita_liquida_mes numeric,
               medicao_bruta_mes numeric, servicos_mes numeric, servicos_semana numeric,
               servicos_dia numeric, agua_dia numeric, esgoto_dia numeric)
language plpgsql stable as $fn$
declare pr public.fcp_premissas%rowtype; ob public.fcp_obra%rowtype;
        c text; m numeric; v_custo numeric; v_ticket numeric; v_bruta numeric; v_serv numeric;
begin
  select * into pr from public.fcp_premissas where fcp_id = p_fcp_id;
  if not found then return; end if;
  for ob in select * from public.fcp_obra where fcp_id = p_fcp_id order by ordem, nome loop
    v_ticket := public.fcp_ticket(ob);
    if coalesce(v_ticket,0) = 0 then continue; end if;
    select total into v_custo from public.fcp_custo_obra(ob.id);
    foreach c in array array['MÍNIMA','MÉDIA','BOA','ÓTIMA'] loop
      m := case c when 'MÍNIMA' then pr.margem_minima when 'MÉDIA' then pr.margem_media
                  when 'BOA' then pr.margem_boa else pr.margem_otima end;
      v_bruta := v_custo * (1 + m) / (1 - pr.imposto_aliquota);
      v_serv  := v_bruta / v_ticket;
      obra := ob.nome; cenario := c; margem := m;
      receita_liquida_mes := round(v_custo * (1 + m), 2);
      medicao_bruta_mes   := round(v_bruta, 2);
      servicos_mes        := round(v_serv, 2);
      servicos_semana     := round(v_serv * 7 / pr.dias_mes, 2);
      servicos_dia        := round(v_serv / pr.dias_mes, 2);
      -- obra com mix separa o que é água e o que é esgoto por dia
      agua_dia   := case when ob.pct_esgoto is null then null
                         else round(v_serv / pr.dias_mes * (1 - ob.pct_esgoto), 2) end;
      esgoto_dia := case when ob.pct_esgoto is null then null
                         else round(v_serv / pr.dias_mes * ob.pct_esgoto, 2) end;
      return next;
    end loop;
  end loop;
end $fn$;

-- ── 7. SEGURANÇA + AUDITORIA + TRAVA DE APROVAÇÃO ──────────────────────────
do $rls$
declare t text;
begin
  foreach t in array array['fcp','fcp_premissas','fcp_obra','fcp_custo_pessoa',
                           'fcp_custo_geral','fcp_realizado','fcp_preco'] loop
    -- autoria + soft delete + audit_log (mesmo padrão da migration 025)
    execute format('alter table public.%I add column if not exists created_by uuid', t);
    execute format('alter table public.%I add column if not exists created_at timestamptz default now()', t);
    execute format('alter table public.%I add column if not exists updated_by uuid', t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz', t);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists deleted_by uuid', t);
    execute format('drop trigger if exists trg_carimbo on public.%I', t);
    execute format('create trigger trg_carimbo before insert or update on public.%I
                      for each row execute function public.fn_carimbo()', t);
    execute format('drop trigger if exists trg_auditoria on public.%I', t);
    execute format('create trigger trg_auditoria after insert or update or delete on public.%I
                      for each row execute function public.fn_auditoria()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'allow_all_'||t, t);
    execute format('create policy %I on public.%I for all using (true) with check (true)',
                   'allow_all_'||t, t);
  end loop;
end $rls$;

-- Depois de APROVADO, o documento trava. Só admin global reabre (status volta
-- a 'rascunho'), e o audit_log registra quem reabriu.
create or replace function public.fcp_trava_aprovado()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if OLD.status = 'aprovado' and NEW.status = 'aprovado' then
    raise exception 'Este FCP está aprovado e não pode ser editado. Peça a um administrador para reabrir.'
      using errcode = 'check_violation';
  end if;
  if OLD.status = 'aprovado' and NEW.status <> 'aprovado' then
    if not public.is_global_admin() then
      raise exception 'Somente um administrador pode reabrir um FCP aprovado.'
        using errcode = 'insufficient_privilege';
    end if;
    NEW.reaberto_em := now();
    NEW.reaberto_por := auth.uid();
    NEW.versao := OLD.versao + 1;
  end if;
  return NEW;
end $fn$;

drop trigger if exists trg_fcp_trava on public.fcp;
create trigger trg_fcp_trava before update on public.fcp
  for each row execute function public.fcp_trava_aprovado();

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'tabelas do FCP' item, count(*)::text valor
  from information_schema.tables where table_schema='public' and table_name like 'fcp%'
union all select 'funcoes de calculo', count(*)::text
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'fcp_%';
