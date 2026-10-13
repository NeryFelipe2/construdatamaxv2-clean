-- ConstruData - Log Operacional + Planejamento Semanal + Desvios + ML
-- Seguro para rodar mais de uma vez no Supabase.

create extension if not exists pgcrypto;

create table if not exists public.operational_logs (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid null,
  subsystem text not null,
  severity text not null default 'info',
  status text not null default 'open',
  telefone text null,
  request_id text null,
  event_id text null,
  error_message text null,
  payload jsonb not null default '{}'::jsonb,
  origem text not null default 'api',
  resolved_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists public.planejamentos_semanais (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null,
  semana_inicio date not null,
  semana_fim date not null,
  engenheiro_nome text null,
  engenheiro_telefone text null,
  status text not null default 'rascunho',
  origem text not null default 'web',
  versao integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planejamento_itens (
  id uuid primary key default gen_random_uuid(),
  planejamento_id uuid not null references public.planejamentos_semanais(id) on delete cascade,
  projeto_id uuid not null,
  frente_id uuid null,
  atividade text not null,
  descricao text null,
  unidade text not null default 'm',
  quantidade_planejada numeric not null default 0,
  equipe_planejada integer not null default 0,
  custo_previsto numeric not null default 0,
  data_inicio date null,
  data_fim date null,
  restricoes jsonb not null default '[]'::jsonb,
  status text not null default 'planejado',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planejamento_validacoes (
  id uuid primary key default gen_random_uuid(),
  planejamento_id uuid not null references public.planejamentos_semanais(id) on delete cascade,
  projeto_id uuid not null,
  diretor_nome text null,
  diretor_telefone text null,
  decisao text not null,
  observacao text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.desvios_planejamento (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null,
  planejamento_id uuid null references public.planejamentos_semanais(id) on delete set null,
  planejamento_item_id uuid null references public.planejamento_itens(id) on delete set null,
  rdo_id uuid null,
  data date not null default current_date,
  atividade text not null,
  quantidade_planejada numeric not null default 0,
  quantidade_realizada numeric not null default 0,
  desvio_quantidade numeric not null default 0,
  desvio_percentual numeric not null default 0,
  custo_previsto numeric not null default 0,
  custo_real numeric not null default 0,
  cpi numeric not null default 1,
  spi numeric not null default 1,
  ppc numeric not null default 0,
  produtividade_prevista numeric not null default 0,
  produtividade_real numeric not null default 0,
  equipe_planejada integer not null default 0,
  equipe_real integer not null default 0,
  severidade text not null default 'low',
  acao_recomendada text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ml_execucoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null,
  tipo text not null default 'desvio_planejamento',
  model_name text not null default 'xgboost',
  model_version text not null default 'v1',
  fallback_used boolean not null default false,
  features_count integer not null default 0,
  score numeric null,
  resultado jsonb not null default '{}'::jsonb,
  status text not null default 'ok',
  error_message text null,
  created_at timestamptz not null default now()
);

create table if not exists public.replanejamentos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid not null,
  planejamento_origem_id uuid null references public.planejamentos_semanais(id) on delete set null,
  ml_execucao_id uuid null references public.ml_execucoes(id) on delete set null,
  status text not null default 'rascunho',
  motivo text null,
  sugestoes jsonb not null default '[]'::jsonb,
  metricas jsonb not null default '{}'::jsonb,
  validado_por text null,
  validado_em timestamptz null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_operational_logs_project_created on public.operational_logs(projeto_id, created_at desc);
create index if not exists idx_operational_logs_subsystem_status on public.operational_logs(subsystem, status, severity);
create index if not exists idx_plan_sem_project_week on public.planejamentos_semanais(projeto_id, semana_inicio, status);
create index if not exists idx_plan_itens_plan on public.planejamento_itens(planejamento_id);
create index if not exists idx_desvios_project_data on public.desvios_planejamento(projeto_id, data desc);
create index if not exists idx_ml_project_created on public.ml_execucoes(projeto_id, created_at desc);
create index if not exists idx_replan_project_status on public.replanejamentos(projeto_id, status, created_at desc);

alter table public.operational_logs enable row level security;
alter table public.planejamentos_semanais enable row level security;
alter table public.planejamento_itens enable row level security;
alter table public.planejamento_validacoes enable row level security;
alter table public.desvios_planejamento enable row level security;
alter table public.ml_execucoes enable row level security;
alter table public.replanejamentos enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'operational_logs',
    'planejamentos_semanais',
    'planejamento_itens',
    'planejamento_validacoes',
    'desvios_planejamento',
    'ml_execucoes',
    'replanejamentos'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = t
        and policyname = 'operacao_total_' || t
    ) then
      execute format('create policy %I on public.%I for all using (true) with check (true)', 'operacao_total_' || t, t);
    end if;
  end loop;
end $$;
