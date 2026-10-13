-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 027 — FCP ⇄ LPS: integração de mão dupla
-- ConstruData · 28/08/2026 · APLICADA em produção
--
-- IDA:   aprovar o FCP cria as tarefas da semana no LPS, já com a meta de
--        produção/dia que veio da aba Viabilidade.
-- VOLTA: o realizado lançado no LPS alimenta o PLANEJADO × REALIZADO do FCP.
--
-- Objetivo do pedido: acabar com a digitação duplicada. O engenheiro lança a
-- produção UMA vez, no LPS, e o fluxo de caixa se atualiza sozinho.
--
-- NÃO HÁ LAÇO INFINITO: fcp_realizado não escreve de volta no LPS, e a grade
-- do FCP é FUNÇÃO (não tabela), então recalcular não dispara trigger nenhum.
--
-- PROVA (rodada em produção):
--   0. antes de aprovar ....... 0 tarefas do FCP no LPS
--   1. FCP aprovado ........... 2 tarefas criadas (uma por obra)
--      "BERTIOGA — meta 13,81/dia (FCP, cenário ÓTIMA)" | planejado 96,67
--   2. lancei 72 no LPS ....... chegou no FCP como 72
--   3. grade do FCP ........... producao_realizada da S1 = 72
-- ═══════════════════════════════════════════════════════════════════════════

begin;

alter table public.lps_tasks add column if not exists fcp_obra_id uuid
  references public.fcp_obra(id) on delete set null;
alter table public.lps_tasks add column if not exists fcp_semana int;

comment on column public.lps_tasks.fcp_obra_id is
  'Preenchido quando a tarefa nasceu da aprovação de um FCP. É por aqui que o '
  'realizado volta para o FCP — sem isso, a mão dupla não sabe a quem responder.';

create index if not exists lps_tasks_fcp_idx on public.lps_tasks (fcp_obra_id, fcp_semana)
  where fcp_obra_id is not null;
-- uma tarefa por obra/semana: reaprovar ATUALIZA, não duplica
create unique index if not exists lps_tasks_fcp_uidx on public.lps_tasks (fcp_obra_id, fcp_semana)
  where fcp_obra_id is not null and deleted_at is null;

-- ── IDA ────────────────────────────────────────────────────────────────────
create or replace function public.fcp_gerar_tarefas_lps(p_fcp_id uuid)
returns int language plpgsql security definer set search_path = public as $fn$
declare
  r record; v_sem_iso text; v_n int := 0; v_cenario text; v_dia numeric;
  v_semana_ref date; v_org uuid; v_proj uuid;
begin
  select f.semana_ref, f.org_id into v_semana_ref, v_org
    from public.fcp f where f.id = p_fcp_id;
  if v_semana_ref is null then return 0; end if;

  select p.cenario into v_cenario from public.fcp_premissas p where p.fcp_id = p_fcp_id;
  select id into v_proj from public.projetos limit 1;
  v_sem_iso := to_char(v_semana_ref, 'IYYY"-W"IW');

  for r in select s.obra_id, s.obra, s.producao_prevista
             from public.fcp_semanas(p_fcp_id, 1) s
  loop
    select v.servicos_dia into v_dia
      from public.fcp_viabilidade(p_fcp_id) v
     where v.obra = r.obra and v.cenario = v_cenario;

    insert into public.lps_tasks
      (org_id, project_id, semana_iso, task_name, comprometida, concluida,
       metros_planejados, fcp_obra_id, fcp_semana)
    values (v_org, v_proj, v_sem_iso,
      format('%s — meta %s/dia (FCP, cenário %s)',
             r.obra, to_char(coalesce(v_dia,0), 'FM999G990D99'), coalesce(v_cenario,'—')),
      true, false, round(r.producao_prevista, 2), r.obra_id, 1)
    on conflict (fcp_obra_id, fcp_semana) where fcp_obra_id is not null and deleted_at is null
    do update set task_name = excluded.task_name,
                  metros_planejados = excluded.metros_planejados,
                  semana_iso = excluded.semana_iso, updated_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end $fn$;

-- uma falha aqui NUNCA pode derrubar a aprovação do FCP
create or replace function public.fcp_ao_aprovar()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if NEW.status = 'aprovado' and OLD.status is distinct from 'aprovado' then
    begin
      perform public.fcp_gerar_tarefas_lps(NEW.id);
    exception when others then
      raise warning 'fcp_gerar_tarefas_lps falhou para %: %', NEW.id, sqlerrm;
    end;
  end if;
  return null;
end $fn$;

drop trigger if exists trg_fcp_aprovar_lps on public.fcp;
create trigger trg_fcp_aprovar_lps after update on public.fcp
  for each row execute function public.fcp_ao_aprovar();

-- ── VOLTA ──────────────────────────────────────────────────────────────────
create or replace function public.lps_realizado_para_fcp()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if NEW.fcp_obra_id is null or NEW.fcp_semana is null then return null; end if;
  if NEW.metros_executados is null then return null; end if;
  -- realizado não mudou: não mexe no FCP (evita escrita e log inúteis)
  if TG_OP = 'UPDATE' and OLD.metros_executados is not distinct from NEW.metros_executados then
    return null;
  end if;

  begin
    insert into public.fcp_realizado (fcp_obra_id, n_semana, producao, observacao)
    values (NEW.fcp_obra_id, NEW.fcp_semana, NEW.metros_executados,
            'Veio do LPS — ' || coalesce(NEW.task_name,''))
    on conflict (fcp_obra_id, n_semana) do update
      set producao = excluded.producao, observacao = excluded.observacao, deleted_at = null;
  exception when others then
    raise warning 'lps_realizado_para_fcp falhou (task %): %', NEW.id, sqlerrm;
  end;
  return null;
end $fn$;

drop trigger if exists trg_lps_realizado_fcp on public.lps_tasks;
create trigger trg_lps_realizado_fcp after insert or update on public.lps_tasks
  for each row execute function public.lps_realizado_para_fcp();

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'colunas de vinculo em lps_tasks' item, count(*)::text valor
  from information_schema.columns
 where table_name='lps_tasks' and column_name in ('fcp_obra_id','fcp_semana')
union all select 'triggers da mao dupla', count(*)::text
  from pg_trigger where tgname in ('trg_fcp_aprovar_lps','trg_lps_realizado_fcp') and not tgisinternal;
