-- 20260904_032_fcp_lps_projeto_certo.sql — APLICADA em produção em 16/09/2026 (conector Supabase)
--
-- CORRIGE: aprovar um FCP despejava as tarefas do Last Planner no quadro de
-- uma obra ARBITRÁRIA.
--
-- A função fcp_gerar_tarefas_lps() escolhia o projeto assim:
--
--     select id into v_proj from public.projetos limit 1;
--
-- Sem where, sem order by, sem org_id e — o principal — sem nenhuma relação
-- com a obra de que a tarefa trata. Rodando essa expressão exata em produção
-- hoje ela devolve 'WCR — Boi Malhado', que tem tarefas reais de campo no
-- quadro. Ou seja: aprovar o FCP de Bertioga, de Santos ou de qualquer outra
-- obra criaria tarefas com a meta DELAS dentro do board do Boi Malhado, para
-- a equipe errada ler.
--
-- A coluna certa já existe desde a migration 031: fcp_obra.projeto_id. Ela foi
-- criada justamente para escopar o FCP por obra, mas esta função não foi
-- atualizada junto. Aqui cada tarefa passa a nascer no projeto da SUA obra.
--
-- POR QUE NÃO CAUSOU ESTRAGO AINDA: nenhum FCP foi aprovado até agora
-- (select count(*) from lps_tasks where fcp_obra_id is not null = 0), e os
-- FCPs existentes estão todos em rascunho. Esta migration fecha o buraco antes
-- da primeira aprovação.
--
-- OBRA SEM PROJETO: lps_tasks.project_id aceita nulo. Uma obra sem projeto_id
-- grava a tarefa com project_id nulo (ela aparece como não atribuída) em vez de
-- cair no quadro de outra obra. Errar para o lado de "sem dono" é recuperável;
-- errar para o lado de "dono errado" contamina o trabalho de outra equipe.
-- Hoje todas as fcp_obra têm projeto_id preenchido, então na prática nenhum
-- caso cai nesse ramo.

create or replace function public.fcp_gerar_tarefas_lps(p_fcp_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  r record; v_sem_iso text; v_n int := 0; v_cenario text; v_dia numeric;
  v_semana_ref date; v_org uuid;
begin
  select f.semana_ref, f.org_id into v_semana_ref, v_org
    from public.fcp f where f.id = p_fcp_id;
  if v_semana_ref is null then return 0; end if;

  select p.cenario into v_cenario from public.fcp_premissas p where p.fcp_id = p_fcp_id;

  -- a semana 1 do FCP é a semana do documento (um FCP por semana)
  v_sem_iso := to_char(v_semana_ref, 'IYYY"-W"IW');

  for r in
    -- o projeto vem da PRÓPRIA obra (fcp_obra.projeto_id), não de um
    -- "projeto ativo" global: um mesmo documento de FCP pode ter várias obras
    -- (Bertioga + Santos moram no mesmo fcp) e cada uma tem o seu quadro.
    select s.obra_id, s.obra, s.producao_prevista, s.data_ini, s.data_fim,
           ob.projeto_id
      from public.fcp_semanas(p_fcp_id, 1) s
      join public.fcp_obra ob on ob.id = s.obra_id
  loop
    -- serviços/dia do cenário adotado, para o texto da tarefa
    select v.servicos_dia into v_dia
      from public.fcp_viabilidade(p_fcp_id) v
     where v.obra = r.obra and v.cenario = v_cenario;

    insert into public.lps_tasks
      (org_id, project_id, semana_iso, task_name, comprometida, concluida,
       metros_planejados, fcp_obra_id, fcp_semana)
    values (
      v_org, r.projeto_id, v_sem_iso,
      format('%s — meta %s/dia (FCP, cenário %s)',
             r.obra, to_char(coalesce(v_dia,0), 'FM999G990D99'), coalesce(v_cenario,'—')),
      true, false, round(r.producao_prevista, 2), r.obra_id, 1)
    on conflict (fcp_obra_id, fcp_semana) where fcp_obra_id is not null and deleted_at is null
    do update set
      task_name = excluded.task_name,
      metros_planejados = excluded.metros_planejados,
      semana_iso = excluded.semana_iso,
      project_id = excluded.project_id,
      updated_at = now();
    v_n := v_n + 1;
  end loop;
  return v_n;
end $function$;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Depois de colar, rode isto. Esperado: nenhuma linha (nenhuma tarefa de FCP
-- num projeto que não é o da obra dela).
--
--   select t.id, t.task_name, t.project_id, ob.projeto_id as projeto_da_obra
--     from public.lps_tasks t
--     join public.fcp_obra ob on ob.id = t.fcp_obra_id
--    where t.fcp_obra_id is not null
--      and t.deleted_at is null
--      and t.project_id is distinct from ob.projeto_id;
--
-- E isto deve devolver a definição já com "join public.fcp_obra":
--
--   select pg_get_functiondef(oid) from pg_proc where proname='fcp_gerar_tarefas_lps';
