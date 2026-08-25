-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 003 — COLUNA org_id + BACKFILL EM TODAS AS TABELAS DE NEGÓCIO
-- ConstruData · 25/08/2026 · colar DEPOIS da 002
--
-- O QUE FAZ:
--   1. Cria a 2ª organização "RK / Legado" (os dados antigos de Osasco,
--      Teófilo Otoni, Cesário Lange etc. NÃO são da WCR — vão para ela,
--      senão a WCR veria folha de pagamento de outra empresa).
--   2. Adiciona org_id (nullable, com DEFAULT da empresa certa) em ~80
--      tabelas de negócio e faz o backfill.
--   3. Triggers nos filhos de rdos/metas/planejamentos: herdam o org_id
--      do pai automaticamente (protege também o bot e o backend Python,
--      que nem sabem que org_id existe).
--
-- NENHUMA POLICY É ALTERADA AQUI. O app continua funcionando igual.
-- Idempotente: pode rodar 2x.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. ORGANIZAÇÃO "RK / LEGADO" ───────────────────────────────────────────
insert into public.organizations (id, slug, nome, razao_social, ativo)
values ('22222222-2222-4222-8222-222222222222', 'rk-legado', 'RK / Legado',
        'Dados legados RK Engenharia (Osasco, Teófilo Otoni, Cesário Lange, São Roque, Pardinho)', true)
on conflict (id) do update set nome = excluded.nome, ativo = true;

-- ── 2. org_id NAS TABELAS WCR (default = WCR) ──────────────────────────────
do $$
declare
  t text;
  wcr constant text := '11111111-1111-4111-8111-111111111111';
  tabelas_wcr text[] := array[
    'projetos','frentes','contatos','rdos','producao_diaria','ns','pv','trecho',
    'rede_planejada','rede_status_campo','cadastro_ligacoes','medicao_itens',
    'medicao_oficial','medicao_receita','lps_tasks','lps_restricoes','replanejamentos',
    'pente_fino_cronograma','agenda_tasks','ocorrencias_obra','metas_campanha',
    'meta_corredor','meta_ruas','meta_baixas','metas_producao','metas_mensais',
    'ligacoes_os_mes','ligacoes_pendencias','equipe_cronograma_itens','fluxo_projecao',
    'guia_progresso','plan_teams','plan_trechos','viabilidade_estudos','punch_list_items',
    'arquivos_projeto','automacao_regras','automacao_logs','planejamento_mestre_programacao',
    'planejamentos_semanais','planejamento_itens','planejamento_validacoes',
    'desvios_planejamento','bota_fora_viagens','lancamentos_financeiros','operational_logs',
    'rdo_equipes','rdo_mao_obra','rdo_materiais','rdo_equipamentos','rdo_ocorrencias',
    'rdo_atividades','checklist_ns','apontamento_conversa',
    'wcr_equipes','equipe_membros','equipe_aliases','equipe_alias_membros',
    'wcr_veiculos','wcr_kanban_dia','frota_veiculos','programacao_semana',
    'precos_contrato','logradouros','trechos_custo','whatsapp_midia'
  ];
begin
  foreach t in array tabelas_wcr loop
    if to_regclass('public.'||t) is null then
      raise notice 'tabela % não existe — pulando', t; continue;
    end if;
    execute format(
      'alter table public.%I add column if not exists org_id uuid
         references public.organizations(id)', t);
    execute format(
      'alter table public.%I alter column org_id set default %L::uuid', t, wcr);
    execute format(
      'update public.%I set org_id = %L::uuid where org_id is null', t, wcr);
  end loop;
end $$;

-- ── 3. org_id NAS TABELAS RK/LEGADO (default = RK) ─────────────────────────
do $$
declare
  t text;
  rk constant text := '22222222-2222-4222-8222-222222222222';
  tabelas_rk text[] := array[
    'obras','funcionarios','lancamentos','fluxo_caixa','centros_custo','custos_fixos',
    'expectativa_medicao','rk_rdo_diario','rk_rdo_itens','projects','files',
    'file_relationships','ifc_models','planning_tasks','team_allocations',
    'notas_servico','tarefas','whatsapp_logs','workflow_events','workflow_status',
    'ml_execucoes'
  ];
begin
  foreach t in array tabelas_rk loop
    if to_regclass('public.'||t) is null then
      raise notice 'tabela % não existe — pulando', t; continue;
    end if;
    execute format(
      'alter table public.%I add column if not exists org_id uuid
         references public.organizations(id)', t);
    execute format(
      'alter table public.%I alter column org_id set default %L::uuid', t, rk);
    execute format(
      'update public.%I set org_id = %L::uuid where org_id is null', t, rk);
  end loop;
end $$;

-- Catálogo GLOBAL (sem org_id, de propósito): produtividade_padrao,
-- planilhas_modelo, plano_contas, servico_codigo_map, bot_config, rotina_slots.

-- ── 4. TRIGGER GENÉRICO: filho herda org_id do pai ─────────────────────────
-- Roda ANTES do insert. O DEFAULT já preencheu org_id; se o pai apontar para
-- outra organização, o pai VENCE. Protege consumidores service_role que nem
-- mandam org_id (bot do WhatsApp, backend Python).
create or replace function public.set_org_id_do_pai()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_pai uuid;
  v_org uuid;
begin
  -- tg_argv[0] = tabela pai · tg_argv[1] = coluna do filho que aponta pro pai
  v_pai := nullif(to_jsonb(new)->>tg_argv[1], '')::uuid;
  if v_pai is not null then
    execute format('select org_id from public.%I where id = $1', tg_argv[0])
      into v_org using v_pai;
    if v_org is not null then
      new.org_id := v_org;
    end if;
  end if;
  return new;
end $$;

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('rdo_equipes',       'rdos',                  'rdo_id'),
      ('rdo_mao_obra',      'rdos',                  'rdo_id'),
      ('rdo_materiais',     'rdos',                  'rdo_id'),
      ('rdo_equipamentos',  'rdos',                  'rdo_id'),
      ('rdo_ocorrencias',   'rdos',                  'rdo_id'),
      ('rdo_atividades',    'rdo_equipes',           'equipe_id'),
      ('meta_ruas',         'metas_campanha',        'campanha_id'),
      ('meta_baixas',       'metas_campanha',        'campanha_id'),
      ('planejamento_itens','planejamentos_semanais','planejamento_id'),
      ('planejamento_validacoes','planejamentos_semanais','planejamento_id'),
      ('automacao_logs',    'automacao_regras',      'regra_id'),
      ('equipe_membros',    'wcr_equipes',           'equipe_id'),
      ('equipe_alias_membros','wcr_equipes',         'equipe_id'),
      ('checklist_ns',      'ns',                    'ns_id'),
      ('rdos',              'projetos',              'projeto_id'),
      ('funcionarios',      'obras',                 'obra_id'),
      ('lancamentos',       'obras',                 'obra_id')
    ) as v(filho, pai, coluna)
  loop
    if to_regclass('public.'||r.filho) is null then continue; end if;
    execute format('drop trigger if exists trg_org_do_pai on public.%I', r.filho);
    execute format(
      'create trigger trg_org_do_pai before insert on public.%I
         for each row execute function public.set_org_id_do_pai(%L, %L)',
      r.filho, r.pai, r.coluna);
  end loop;
end $$;

commit;

-- ── CONFERÊNCIA (a mais importante do pacote) ──────────────────────────────
-- 1) NENHUMA tabela pode ter org_id nulo. Esperado: zero linhas no resultado.
select c.relname as tabela_com_org_id_nulo,
  (xpath('/row/cnt/text()', query_to_xml(
     format('select count(*) as cnt from public.%I where org_id is null', c.relname),
     false, true, '')))[1]::text::bigint as nulos
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
join information_schema.columns col
  on col.table_schema = 'public' and col.table_name = c.relname and col.column_name = 'org_id'
where n.nspname = 'public' and c.relkind = 'r'
  and (xpath('/row/cnt/text()', query_to_xml(
     format('select count(*) as cnt from public.%I where org_id is null', c.relname),
     false, true, '')))[1]::text::bigint > 0
order by 2 desc;

-- 2) Distribuição por empresa — os números devem bater com o esperado:
--    producao_diaria 168 WCR · precos_contrato 4788 WCR · funcionarios 34 RK
select 'producao_diaria' t, o.nome, count(*) from public.producao_diaria x join public.organizations o on o.id = x.org_id group by 1,2
union all
select 'precos_contrato', o.nome, count(*) from public.precos_contrato x join public.organizations o on o.id = x.org_id group by 1,2
union all
select 'funcionarios', o.nome, count(*) from public.funcionarios x join public.organizations o on o.id = x.org_id group by 1,2
union all
select 'rdos', o.nome, count(*) from public.rdos x join public.organizations o on o.id = x.org_id group by 1,2
order by 1, 2;
