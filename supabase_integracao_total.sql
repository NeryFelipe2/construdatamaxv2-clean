-- Integracao Total ConstruData
-- Idempotente: nao apaga dados, nao derruba tabelas, apenas cria/normaliza.

create extension if not exists pgcrypto;

create table if not exists public.projetos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contrato text,
  cidade text,
  cliente text,
  tipo text default 'esgoto',
  data_inicio date,
  data_fim date,
  orcamento_total numeric default 0,
  status text default 'ativo',
  responsavel_nome text,
  responsavel_telefone text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projetos add column if not exists contrato text;
alter table public.projetos add column if not exists cidade text;
alter table public.projetos add column if not exists cliente text;
alter table public.projetos add column if not exists tipo text default 'esgoto';
alter table public.projetos add column if not exists data_inicio date;
alter table public.projetos add column if not exists data_fim date;
alter table public.projetos add column if not exists orcamento_total numeric default 0;
alter table public.projetos add column if not exists status text default 'ativo';
alter table public.projetos add column if not exists responsavel_nome text;
alter table public.projetos add column if not exists responsavel_telefone text;
alter table public.projetos add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.projetos add column if not exists created_at timestamptz default now();
alter table public.projetos add column if not exists updated_at timestamptz default now();

create table if not exists public.frentes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete cascade,
  nome text not null,
  setor text,
  tipo_rede text default 'esgoto',
  extensao_total numeric default 0,
  pvs_total integer default 0,
  status text default 'ativa',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.frentes add column if not exists projeto_id uuid;
alter table public.frentes add column if not exists setor text;
alter table public.frentes add column if not exists tipo_rede text default 'esgoto';
alter table public.frentes add column if not exists extensao_total numeric default 0;
alter table public.frentes add column if not exists pvs_total integer default 0;
alter table public.frentes add column if not exists status text default 'ativa';
alter table public.frentes add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.frentes add column if not exists created_at timestamptz default now();

create table if not exists public.contatos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete set null,
  frente_id uuid references public.frentes(id) on delete set null,
  nome text not null,
  cargo text,
  setor text,
  telefone_whatsapp text,
  alcada text,
  recebe_cobranca boolean default true,
  recebe_info boolean default true,
  ativo boolean default true,
  foto_url text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.contatos add column if not exists projeto_id uuid;
alter table public.contatos add column if not exists frente_id uuid;
alter table public.contatos add column if not exists cargo text;
alter table public.contatos add column if not exists setor text;
alter table public.contatos add column if not exists telefone_whatsapp text;
alter table public.contatos add column if not exists alcada text;
alter table public.contatos add column if not exists recebe_cobranca boolean default true;
alter table public.contatos add column if not exists recebe_info boolean default true;
alter table public.contatos add column if not exists ativo boolean default true;
alter table public.contatos add column if not exists foto_url text;
alter table public.contatos add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.contatos add column if not exists created_at timestamptz default now();

create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete set null,
  frente_id uuid references public.frentes(id) on delete set null,
  titulo text,
  descricao text not null,
  responsavel_nome text,
  responsavel_telefone text,
  delegante_nome text,
  prioridade text default 'normal',
  prazo date,
  status text default 'pendente',
  lps_id uuid,
  origem text default 'web',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tarefas add column if not exists projeto_id uuid;
alter table public.tarefas add column if not exists frente_id uuid;
alter table public.tarefas add column if not exists titulo text;
alter table public.tarefas add column if not exists descricao text;
alter table public.tarefas add column if not exists responsavel_nome text;
alter table public.tarefas add column if not exists responsavel_telefone text;
alter table public.tarefas add column if not exists delegante_nome text;
alter table public.tarefas add column if not exists prioridade text default 'normal';
alter table public.tarefas add column if not exists prazo date;
alter table public.tarefas add column if not exists status text default 'pendente';
alter table public.tarefas add column if not exists lps_id uuid;
alter table public.tarefas add column if not exists origem text default 'web';
alter table public.tarefas add column if not exists metadata jsonb default '{}'::jsonb;
alter table public.tarefas add column if not exists created_at timestamptz default now();
alter table public.tarefas add column if not exists updated_at timestamptz default now();

create table if not exists public.rdos (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete set null,
  frente_id uuid references public.frentes(id) on delete set null,
  data date not null default current_date,
  engenheiro text,
  apontador text,
  clima text,
  turno text default 'dia',
  producao text,
  producao_m numeric default 0,
  equipe text,
  equipe_number integer default 0,
  maquinas jsonb default '[]'::jsonb,
  equipamentos jsonb default '[]'::jsonb,
  locacoes jsonb default '[]'::jsonb,
  mao_obra jsonb default '[]'::jsonb,
  materiais jsonb default '[]'::jsonb,
  custo_direto numeric default 0,
  custo_indireto numeric default 0,
  custo_total_dia numeric default 0,
  ocorrencias text,
  paralisacoes text,
  observacoes text,
  fotos text[] default array[]::text[],
  latitude numeric,
  longitude numeric,
  lps_id uuid,
  restricoes jsonb default '[]'::jsonb,
  origem text default 'web',
  status text default 'aberto',
  payload_original jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.rdos add column if not exists projeto_id uuid;
alter table public.rdos add column if not exists frente_id uuid;
alter table public.rdos add column if not exists data date default current_date;
alter table public.rdos add column if not exists engenheiro text;
alter table public.rdos add column if not exists apontador text;
alter table public.rdos add column if not exists clima text;
alter table public.rdos add column if not exists turno text default 'dia';
alter table public.rdos add column if not exists producao text;
alter table public.rdos add column if not exists producao_m numeric default 0;
alter table public.rdos add column if not exists equipe text;
alter table public.rdos add column if not exists equipe_number integer default 0;
alter table public.rdos add column if not exists maquinas jsonb default '[]'::jsonb;
alter table public.rdos add column if not exists equipamentos jsonb default '[]'::jsonb;
alter table public.rdos add column if not exists locacoes jsonb default '[]'::jsonb;
alter table public.rdos add column if not exists mao_obra jsonb default '[]'::jsonb;
alter table public.rdos add column if not exists materiais jsonb default '[]'::jsonb;
alter table public.rdos add column if not exists custo_direto numeric default 0;
alter table public.rdos add column if not exists custo_indireto numeric default 0;
alter table public.rdos add column if not exists custo_total_dia numeric default 0;
alter table public.rdos add column if not exists ocorrencias text;
alter table public.rdos add column if not exists paralisacoes text;
alter table public.rdos add column if not exists observacoes text;
alter table public.rdos add column if not exists fotos text[] default array[]::text[];
alter table public.rdos add column if not exists latitude numeric;
alter table public.rdos add column if not exists longitude numeric;
alter table public.rdos add column if not exists lps_id uuid;
alter table public.rdos add column if not exists restricoes jsonb default '[]'::jsonb;
alter table public.rdos add column if not exists origem text default 'web';
alter table public.rdos add column if not exists status text default 'aberto';
alter table public.rdos add column if not exists payload_original jsonb default '{}'::jsonb;
alter table public.rdos add column if not exists created_at timestamptz default now();
alter table public.rdos add column if not exists updated_at timestamptz default now();

create table if not exists public.rdo_equipes (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references public.rdos(id) on delete cascade,
  tipo text,
  lider_id uuid,
  lider_nome text,
  quantidade integer default 0,
  metadata jsonb default '{}'::jsonb
);

create table if not exists public.rdo_atividades (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references public.rdos(id) on delete cascade,
  equipe_id uuid references public.rdo_equipes(id) on delete set null,
  rua text,
  servico text,
  tubo text,
  metragem numeric default 0,
  pecas text[] default array[]::text[],
  casas text,
  observacao text
);

create table if not exists public.rdo_materiais (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references public.rdos(id) on delete cascade,
  descricao text,
  quantidade numeric default 0,
  unidade text,
  custo numeric default 0
);

create table if not exists public.rdo_equipamentos (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references public.rdos(id) on delete cascade,
  tipo text,
  descricao text,
  quantidade numeric default 0,
  horas numeric default 0,
  custo numeric default 0
);

create table if not exists public.rdo_mao_obra (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references public.rdos(id) on delete cascade,
  cargo text,
  quantidade numeric default 0,
  horas numeric default 0,
  custo numeric default 0
);

create table if not exists public.rdo_ocorrencias (
  id uuid primary key default gen_random_uuid(),
  rdo_id uuid references public.rdos(id) on delete cascade,
  tipo text,
  descricao text,
  paralisa_obra boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.punch_list_items (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete set null,
  frente_id uuid references public.frentes(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  rdo_id uuid references public.rdos(id) on delete set null,
  descricao text not null,
  localizacao text,
  responsavel text,
  prazo date,
  status text default 'aberto',
  foto_antes text,
  foto_depois text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.lps_restricoes (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete set null,
  frente_id uuid references public.frentes(id) on delete set null,
  tarefa_id uuid references public.tarefas(id) on delete set null,
  rdo_id uuid references public.rdos(id) on delete set null,
  descricao text not null,
  responsavel text,
  prazo date,
  status text default 'aberto',
  tipo text,
  impacto text,
  origem text default 'web',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.whatsapp_logs (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete set null,
  telefone text,
  nome text,
  direction text not null,
  tipo text,
  mensagem text,
  payload jsonb default '{}'::jsonb,
  status text default 'recebido',
  created_at timestamptz default now()
);

create table if not exists public.workflow_events (
  id uuid primary key default gen_random_uuid(),
  projeto_id uuid references public.projetos(id) on delete set null,
  workflow_id text,
  execution_id text,
  tipo text not null,
  origem text,
  payload jsonb default '{}'::jsonb,
  status text default 'ok',
  created_at timestamptz default now()
);

insert into public.projetos
  (id, nome, contrato, cidade, cliente, tipo, data_inicio, data_fim, orcamento_total, status, responsavel_nome, responsavel_telefone)
values
  ('c2bf8fda-1111-4444-8888-aaaaaaaaaaaa', 'Tatui - RK', 'CT-TATUI-2026', 'Tatui', 'RK', 'esgoto', '2026-04-01', '2027-12-31', 18000000, 'ativo', 'Felipe Nery', '5561981846325'),
  ('f3c6645b-347f-4382-b9c5-d103c27ec511', 'Osasco - Rua Cuiaba', 'CT-CLU-OSC-2026', 'Osasco', 'RK', 'esgoto', '2026-04-01', '2027-12-31', 28000000, 'ativo', 'Mateus Santos', '5561991015639'),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Consorcio Se Liga na Rede - SLNR Santos', 'CT-11481051', 'Santos', 'Consorcio', 'esgoto', '2026-04-01', '2027-12-31', 45000000, 'ativo', 'Felipe Nery', '5561981846325'),
  ('ec112c9a-1669-4287-8079-526d6940ce82', 'Pardinho - Consorcio Itapetininga', 'PARD-2026', 'Pardinho', 'Consorcio Itapetininga', 'esgoto', '2026-04-01', '2027-12-31', 32000000, 'ativo', 'Fabio', '5537999000001'),
  ('2a28beec-b1f8-4b0c-8416-d0710bb35d9d', 'ConstruData Brasilia', 'CD-BSB-2026', 'Brasilia', 'ConstruData', 'esgoto', '2026-04-01', '2027-12-31', 18750000, 'ativo', 'Joao', '5561999996252'),
  ('d4e5f6a7-1111-2222-3333-bbbbbbbbbbbb', 'RK SUB Empreita', 'RK-SUB-2026', 'Santos', 'RK', 'esgoto', '2026-04-01', '2027-12-31', 23000000, 'ativo', 'Felipe Nery', '5561981846325')
on conflict (id) do update set
  nome = excluded.nome,
  contrato = excluded.contrato,
  cidade = excluded.cidade,
  cliente = excluded.cliente,
  tipo = excluded.tipo,
  data_inicio = excluded.data_inicio,
  data_fim = excluded.data_fim,
  orcamento_total = excluded.orcamento_total,
  status = excluded.status,
  responsavel_nome = excluded.responsavel_nome,
  responsavel_telefone = excluded.responsavel_telefone,
  updated_at = now();

insert into public.frentes (id, projeto_id, nome, setor, tipo_rede, extensao_total, pvs_total, status)
values
  ('11111111-1111-4111-8111-111111111111', 'c2bf8fda-1111-4444-8888-aaaaaaaaaaaa', 'Frente Tatui Principal', 'Campo', 'esgoto', 7200, 40, 'ativa'),
  ('22222222-2222-4222-8222-222222222222', 'f3c6645b-347f-4382-b9c5-d103c27ec511', 'Rua Cuiaba / CLU', 'Osasco', 'esgoto', 6800, 48, 'ativa'),
  ('33333333-3333-4333-8333-333333333333', 'abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Sala Tecnica', 'Tecnico', 'esgoto', 26600, 185, 'ativa'),
  ('44444444-4444-4444-8444-444444444444', 'abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Planejamento', 'Planejamento', 'esgoto', 0, 0, 'ativa'),
  ('55555555-5555-4555-8555-555555555555', 'abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Producao', 'Operacional', 'esgoto', 12500, 85, 'ativa'),
  ('66666666-6666-4666-8666-666666666666', 'ec112c9a-1669-4287-8079-526d6940ce82', 'Frente Rede Principal', 'Centro Pardinho', 'esgoto', 9500, 68, 'ativa'),
  ('77777777-7777-4777-8777-777777777777', '2a28beec-b1f8-4b0c-8416-d0710bb35d9d', 'Frente Principal', 'Centro', 'esgoto', 5000, 30, 'ativa'),
  ('88888888-8888-4888-8888-888888888888', 'd4e5f6a7-1111-2222-3333-bbbbbbbbbbbb', 'Subempreita Santos', 'Santos', 'esgoto', 6400, 39, 'ativa')
on conflict (id) do update set
  projeto_id = excluded.projeto_id,
  nome = excluded.nome,
  setor = excluded.setor,
  tipo_rede = excluded.tipo_rede,
  extensao_total = excluded.extensao_total,
  pvs_total = excluded.pvs_total,
  status = excluded.status;

insert into public.contatos (projeto_id, nome, cargo, setor, telefone_whatsapp, alcada, recebe_cobranca, recebe_info, ativo)
values
  ('c2bf8fda-1111-4444-8888-aaaaaaaaaaaa', 'Felipe Nery', 'Diretor', 'Diretoria', '5561981846325', 'diretor', true, true, true),
  ('c2bf8fda-1111-4444-8888-aaaaaaaaaaaa', 'Luiz Fernando', 'Diretor', 'Diretoria', 'sem-telefone-luiz', 'diretor', true, true, true),
  ('c2bf8fda-1111-4444-8888-aaaaaaaaaaaa', 'Renato', 'Diretor Financeiro', 'Diretoria', 'sem-telefone-renato', 'diretor', true, true, true),
  ('f3c6645b-347f-4382-b9c5-d103c27ec511', 'Mateus Santos', 'Engenheiro', 'Osasco', '5561991015639', 'engenheiro_obra', true, true, true),
  ('c2bf8fda-1111-4444-8888-aaaaaaaaaaaa', 'Icaro Atila', 'Engenheiro', 'Tatui', 'sem-telefone-icaro', 'engenheiro_obra', true, true, true),
  ('d4e5f6a7-1111-2222-3333-bbbbbbbbbbbb', 'Igor Max', 'Engenheiro', 'RK Santos', '5531985898482', 'engenheiro_obra', true, true, true),
  ('2a28beec-b1f8-4b0c-8416-d0710bb35d9d', 'Joao', 'Diretor Brasilia', 'Brasilia', '5561999996252', 'diretor', true, true, true),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Fabrizzio', 'Gerente/Diretor', 'Consorcio / SLNR', 'sem-telefone-fabrizzio', 'info', false, true, true),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Junior', 'Planejamento', 'Consorcio / SLNR', 'sem-telefone-junior', 'planejamento', true, true, true),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Valdeans', 'Planejamento', 'Consorcio / SLNR', 'sem-telefone-valdeans', 'planejamento', true, true, true),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Gabriel', 'Sala Tecnica', 'Consorcio / SLNR', 'sem-telefone-gabriel', 'sala_tecnica', true, true, true),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Vinicius', 'Sala Tecnica', 'Consorcio / SLNR', 'sem-telefone-vinicius', 'sala_tecnica', true, true, true),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Veronica', 'Planejamento', 'Consorcio / SLNR', 'sem-telefone-veronica', 'planejamento', true, true, true),
  ('abe7f66c-004b-4bb5-a245-6be67debd9f7', 'Jose Marcio', 'Gerente Producao', 'Consorcio / SLNR', 'sem-telefone-jose-marcio', 'producao', true, true, true)
on conflict do nothing;

create index if not exists idx_frentes_projeto_id on public.frentes(projeto_id);
create index if not exists idx_contatos_projeto_id on public.contatos(projeto_id);
create index if not exists idx_tarefas_projeto_id on public.tarefas(projeto_id);
create index if not exists idx_rdos_projeto_id_data on public.rdos(projeto_id, data desc);
create index if not exists idx_whatsapp_logs_projeto_id on public.whatsapp_logs(projeto_id);
create index if not exists idx_workflow_events_projeto_id on public.workflow_events(projeto_id);

alter table public.projetos enable row level security;
alter table public.frentes enable row level security;
alter table public.contatos enable row level security;
alter table public.tarefas enable row level security;
alter table public.rdos enable row level security;
alter table public.rdo_equipes enable row level security;
alter table public.rdo_atividades enable row level security;
alter table public.rdo_materiais enable row level security;
alter table public.rdo_equipamentos enable row level security;
alter table public.rdo_mao_obra enable row level security;
alter table public.rdo_ocorrencias enable row level security;
alter table public.punch_list_items enable row level security;
alter table public.lps_restricoes enable row level security;
alter table public.whatsapp_logs enable row level security;
alter table public.workflow_events enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'projetos','frentes','contatos','tarefas','rdos','rdo_equipes','rdo_atividades',
    'rdo_materiais','rdo_equipamentos','rdo_mao_obra','rdo_ocorrencias',
    'punch_list_items','lps_restricoes','whatsapp_logs','workflow_events'
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
