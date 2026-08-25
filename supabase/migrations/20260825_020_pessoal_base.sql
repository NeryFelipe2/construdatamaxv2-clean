-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 020 — PESSOAL: CADASTRO ÚNICO DE PESSOAS (schema base)
-- ConstruData · WCR · 25/08/2026 · colar DEPOIS da 006
--
-- O QUE FAZ: cria o modelo unificado de pessoal que conecta os 3 cadastros
-- hoje desconectados (funcionarios / equipe_membros / rdo_mao_obra):
--   cargos + cargo_apelidos      → catálogo de cargos (mata 'Lider' vs 'Líder')
--   pessoas                      → o cadastro único
--   pessoa_remuneracao           → CPF/salário SEPARADOS (RLS fechada — folha
--                                  de pagamento nunca fica atrás da anon key)
--   pessoa_apelidos              → 'Almir' ↔ 'Almir Gomes dos Santos Junior'
--   pessoa_equipe                → vínculo pessoa↔equipe COM HISTÓRICO
--   rdo_presenca                 → presença NOMINAL no RDO
--
-- SEGURO: só cria coisas novas. Nada existente é alterado. Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. PRÉ-REQUISITOS ──────────────────────────────────────────────────────
create extension if not exists pg_trgm;

-- norm_txt() já existe neste banco (usada por vw_producao_equipe). Se algum
-- dia rodar num banco limpo, cria a equivalente:
do $$ begin
  if to_regprocedure('public.norm_txt(text)') is null then
    create function public.norm_txt(t text) returns text
    language sql immutable as $f$
      select btrim(regexp_replace(lower(translate(coalesce(t,''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')),
        '\s+', ' ', 'g'))
    $f$;
  end if;
end $$;

-- ── 1. CATÁLOGO DE CARGOS ──────────────────────────────────────────────────
create table if not exists public.cargos (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null default '11111111-1111-4111-8111-111111111111',
  nome          text not null,
  nome_norm     text generated always as (public.norm_txt(nome)) stored,
  familia       text,                       -- ENCANADOR | AJUDANTE | PEDREIRO | OPERADOR | ADMINISTRATIVO
  nivel         text,                       -- I | II | III | IV
  categoria_rdo text not null default 'ajudante'
                check (categoria_rdo in ('encarregado','oficial','ajudante','operador','indireto')),
  salario_ref   numeric(12,2),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);
create unique index if not exists cargos_org_nome_uidx on public.cargos (org_id, nome_norm);
comment on column public.cargos.categoria_rdo is
  'Ponte com os 4 contadores legados do RDO (Encarregado/Oficial/Ajudante/Operador).';

create table if not exists public.cargo_apelidos (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '11111111-1111-4111-8111-111111111111',
  cargo_id   uuid not null references public.cargos(id) on delete cascade,
  alias_raw  text not null,
  alias_norm text not null,
  fonte      text,
  criado_em  timestamptz not null default now()
);
-- invariante (igual a equipe_aliases): um alias resolve UM cargo só
create unique index if not exists cargo_apelidos_uidx on public.cargo_apelidos (org_id, alias_norm);

-- ── 2. PESSOAS (o cadastro único) ──────────────────────────────────────────
create table if not exists public.pessoas (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null default '11111111-1111-4111-8111-111111111111',
  nome_completo   text not null,
  nome_norm       text generated always as (public.norm_txt(nome_completo)) stored,
  apelido         text,                       -- 'Mazinho', 'Coveiro', 'Léo'
  cargo_id        uuid references public.cargos(id) on delete set null,
  cargo_texto     text,                       -- literal da fonte quando não catalogado
  status          text not null default 'ativo'
                  check (status in ('ativo','desligado','em_contratacao','afastado','desconhecido')),
  vinculo         text,                       -- 'WCR' | 'JWL' | 'terceiro'
  encarregado_id  uuid references public.pessoas(id) on delete set null,
  encarregado_texto text,                     -- literal com trim aplicado — nunca se perde
  telefone        text,
  telefone_digits text generated always as (regexp_replace(coalesce(telefone,''),'\D','','g')) stored,
  data_admissao         date,
  venc_experiencia_1    date,
  venc_experiencia_2    date,
  data_desligamento     date,
  desligamento_previsto boolean not null default false,
  motivo_desligamento   text,
  epi_calca   text,
  epi_camisa  text,
  epi_botina  text,
  obra_id     uuid references public.obras(id) on delete set null,
  funcionario_legacy_id uuid unique references public.funcionarios(id) on delete set null,
  observacoes text,
  origem      text not null default 'manual',  -- planilha_abr2026#efetivos | equipe_membros | funcionarios | manual | rdo
  import_lote_id uuid,
  revisar     boolean not null default false,  -- criado por heurística → precisa olho humano
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pessoas_nome_norm_idx  on public.pessoas (nome_norm);
create index if not exists pessoas_org_status_idx on public.pessoas (org_id, status);
create index if not exists pessoas_cargo_idx      on public.pessoas (cargo_id);
create index if not exists pessoas_revisar_idx    on public.pessoas (org_id) where revisar;
create index if not exists pessoas_nome_trgm_idx  on public.pessoas using gin (nome_norm gin_trgm_ops);
-- SEM unique(org_id, nome_norm) de propósito: homônimos reais existem
-- (dois Leonardo, dois Anderson). Duplicata de nome é AVISO na UI, não erro.

-- ── 3. DADOS SENSÍVEIS (CPF, salário) — separados por causa do RLS ─────────
create table if not exists public.pessoa_remuneracao (
  pessoa_id        uuid primary key references public.pessoas(id) on delete cascade,
  cpf              text,
  cpf_digits       text generated always as (regexp_replace(coalesce(cpf,''),'\D','','g')) stored,
  salario_bruto    numeric(12,2),
  salario_encargos numeric(12,2),
  vale_refeicao    numeric(12,2),
  vale_refeicao_formula text,     -- '=31.8*22' como veio da planilha
  vigencia_inicio  date,
  atualizado_em    timestamptz not null default now()
);
create unique index if not exists pessoa_remuneracao_cpf_uidx
  on public.pessoa_remuneracao (cpf_digits) where cpf_digits <> '';

-- ── 4. APELIDOS DE PESSOA (o coração do casamento de nomes) ────────────────
create table if not exists public.pessoa_apelidos (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '11111111-1111-4111-8111-111111111111',
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  alias_raw  text not null,        -- 'Cristian (Coveiro)', ' JESSÉ', 'Almir'
  alias_norm text not null,        -- norm_txt(sem parênteses)
  fonte      text,                 -- equipe_membros | planilha | rdo | whatsapp | manual
  confianca  numeric(3,2) not null default 1.00,
  revisado   boolean not null default false,
  criado_em  timestamptz not null default now(),
  unique (pessoa_id, alias_norm)
);
-- INVARIANTE: um alias CONFIRMADO resolve exatamente UMA pessoa
create unique index if not exists pessoa_apelidos_resolvido_uidx
  on public.pessoa_apelidos (org_id, alias_norm) where revisado;
create index if not exists pessoa_apelidos_norm_idx on public.pessoa_apelidos (org_id, alias_norm);

create or replace view public.vw_pessoa_por_alias as
  select a.org_id, a.alias_norm, a.pessoa_id, p.nome_completo, a.confianca, a.revisado
    from public.pessoa_apelidos a
    join public.pessoas p on p.id = a.pessoa_id;

-- ── 5. VÍNCULO PESSOA ↔ EQUIPE (com histórico) ─────────────────────────────
create table if not exists public.pessoa_equipe (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null default '11111111-1111-4111-8111-111111111111',
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  equipe_id  text not null references public.wcr_equipes(id) on delete cascade,
  funcao     text,
  papel      text not null default 'membro'
             check (papel in ('lider','encarregado','membro','apoio')),
  ordem      int  not null default 0,
  desde      date not null default current_date,
  ate        date,                 -- null = vínculo VIGENTE. Mover = fechar + abrir.
  observacao text,
  criado_em  timestamptz not null default now()
);
create unique index if not exists pessoa_equipe_vigente_uidx
  on public.pessoa_equipe (pessoa_id, equipe_id) where ate is null;
create index if not exists pessoa_equipe_equipe_idx on public.pessoa_equipe (equipe_id) where ate is null;
create index if not exists pessoa_equipe_pessoa_idx on public.pessoa_equipe (pessoa_id);

-- ── 6. PRESENÇA NOMINAL NO RDO ─────────────────────────────────────────────
create table if not exists public.rdo_presenca (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null default '11111111-1111-4111-8111-111111111111',
  rdo_id         uuid not null references public.rdos(id) on delete cascade,
  pessoa_id      uuid references public.pessoas(id) on delete set null,
  nome_snapshot  text not null,          -- SEMPRE preenchido: excluir a pessoa NUNCA corrompe RDO passado
  equipe_id      text references public.wcr_equipes(id) on delete set null,
  equipe_nome_snapshot text,
  cargo_id       uuid references public.cargos(id) on delete set null,
  funcao_no_dia  text,
  presente       boolean not null default true,
  motivo_ausencia text check (motivo_ausencia in
                   ('falta','atestado','folga','ferias','transferido','acidente','outro')),
  horas_normais  numeric(5,2) not null default 8  check (horas_normais between 0 and 24),
  horas_extras   numeric(5,2) not null default 0  check (horas_extras  between 0 and 12),
  observacao     text,
  origem         text not null default 'web',      -- web | bot | backend | importado
  criado_em      timestamptz not null default now(),
  constraint rdo_presenca_ausente_tem_motivo
    check (presente or motivo_ausencia is not null)
);
create unique index if not exists rdo_presenca_pessoa_uidx
  on public.rdo_presenca (rdo_id, pessoa_id) where pessoa_id is not null;
create index if not exists rdo_presenca_rdo_idx    on public.rdo_presenca (rdo_id);
create index if not exists rdo_presenca_pessoa_idx on public.rdo_presenca (pessoa_id, criado_em desc);

-- ── 7. LEITURA UNIFICADA DO RDO (nominal quando existe, legado senão) ──────
create or replace view public.vw_rdo_mao_obra_nominal as
select p.rdo_id,
       coalesce(c.categoria_rdo, 'ajudante')                          as categoria,
       coalesce(c.nome, nullif(p.funcao_no_dia,''), 'NAO INFORMADO')  as cargo,
       count(*) filter (where p.presente)                             as quantidade,
       sum(p.horas_normais + p.horas_extras) filter (where p.presente) as horas
  from public.rdo_presenca p
  left join public.cargos c on c.id = p.cargo_id
 group by 1, 2, 3;

create or replace view public.vw_rdo_mao_obra as
select n.rdo_id, n.categoria, n.cargo, n.quantidade, n.horas, 'nominal'::text as fonte
  from public.vw_rdo_mao_obra_nominal n
union all
select mo.rdo_id, null::text, mo.cargo, mo.quantidade, null::numeric, 'legado'
  from public.rdo_mao_obra mo
 where not exists (select 1 from public.rdo_presenca rp where rp.rdo_id = mo.rdo_id);
-- nunca conta em dobro: o legado só aparece quando o RDO não tem presença nominal

-- ── 8. RLS ─────────────────────────────────────────────────────────────────
-- Enquanto o login não estiver LIGADO, o app continua anônimo — então as
-- tabelas de pessoal (SEM dado sensível) ficam abertas como as demais, e
-- serão fechadas junto com o resto nas migrations 030+.
do $$
declare t text;
begin
  foreach t in array array['cargos','cargo_apelidos','pessoas','pessoa_equipe','rdo_presenca'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allow_all_temp on public.%I', t);
    execute format('create policy allow_all_temp on public.%I for all using (true) with check (true)', t);
    -- e já nascem com as policies org_* definitivas em paralelo:
    execute format('drop policy if exists org_read on public.%I', t);
    execute format('create policy org_read on public.%I for select
      using ( public.rls_liberado() or org_id = any (public.orgs_visiveis()) )', t);
    execute format('drop policy if exists org_write on public.%I', t);
    execute format('create policy org_write on public.%I for all
      using ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )
      with check ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )', t);
  end loop;
end $$;

-- pessoa_apelidos idem (aberta temporariamente — o resolvedor precisa dela)
alter table public.pessoa_apelidos enable row level security;
drop policy if exists allow_all_temp on public.pessoa_apelidos;
create policy allow_all_temp on public.pessoa_apelidos for all using (true) with check (true);

-- pessoa_remuneracao: FECHADA DESDE O DIA 1. Salário e CPF de 62 pessoas
-- NÃO ficam atrás de uma anon key publicada num bundle. Só admin global
-- (via login) ou service_role (Edge Function de import) acessam.
alter table public.pessoa_remuneracao enable row level security;
drop policy if exists remuneracao_admin on public.pessoa_remuneracao;
create policy remuneracao_admin on public.pessoa_remuneracao for all
  using ( public.is_global_admin() ) with check ( public.is_global_admin() );

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'cargos' t, count(*)::text from public.cargos
union all select 'pessoas',            count(*)::text from public.pessoas
union all select 'pessoa_apelidos',    count(*)::text from public.pessoa_apelidos
union all select 'pessoa_equipe',      count(*)::text from public.pessoa_equipe
union all select 'rdo_presenca',       count(*)::text from public.rdo_presenca
union all select 'remuneracao FECHADA (esperado: 1 policy admin)',
  count(*)::text from pg_policies where tablename = 'pessoa_remuneracao';
-- Esperado: tudo 0 (schema vazio, dados entram na 021) e 1 policy na remuneração.
