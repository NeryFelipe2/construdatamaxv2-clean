-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 035 — CONTROLE OPERACIONAL (planilha CONTROLE OPERACIONAL SABESP rev16)
-- ConstruData · 16/09/2026 · APLICADA em produção em 16/09/2026 (conector Supabase, autorizada pelo Felipe;
--   conferência: 19 tabelas, 38 policies, 0 abertas). Planilha preenchida importada no mesmo dia.
--
-- ORDEM DE COLAGEM: 033 → 034 → 035. Rode sozinho, confira o bloco CONFERÊNCIA
-- no fim do resultado antes de seguir.
--
-- O QUE FAZ
--   Porta para o banco o app Python SAAS_CONTROLE_WCR ("a planilha como
--   sistema"). Uma tabela por aba DIGITADA da planilha — o que lá é fórmula,
--   aqui é calculado no frontend (features/controle-operacional/dominio/
--   calculos.ts, uma função por coluna, com a aba de origem no comentário).
--
--   01 CONFIGURAÇÕES ........ op_parametros (1 linha por obra) + op_lista
--   01A BANCO DE CUSTOS ..... op_custo_item + op_tributo
--   02 TABELA DE PREÇOS ..... op_preco            (NÃO é precos_contrato: aquela é da ZN e aplica 60%)
--   03 CADASTRO DE SERVIÇOS . op_servico
--   04 PROGRAMAÇÃO DIÁRIA ... op_programacao
--   05 ORDENS DE SERVIÇO .... op_ordem_servico
--   06 APONTAMENTO DIÁRIO ... op_apontamento
--   08 EQUIPE ............... REUSA pessoas + pessoa_remuneracao (salário, só admin)
--                             + op_equipe_membro (matrícula/equipe no contrato)
--                             + pessoa_vencimento (ASO, NR-06/10/18/33/35, CNH)
--   09 MEDIÇÃO .............. op_medicao_item
--   10 DIÁRIO DE OBRA ....... NÃO vira tabela: o RDO do sistema é /app/rdo.
--                             As linhas importadas ficam em op_importacao_pendente.
--   11 OCORRÊNCIAS .......... REUSA ocorrencias_obra + op_ocorrencia_ext
--   12 FATURAMENTO .......... op_faturamento
--   15 ATAS (5W2H) .......... op_ata
--   16 LOOKAHEAD ............ op_lookahead (+ "virar restrição" grava em lps_restricoes)
--   17 PLANO SEMANAL / PPC .. REUSA lps_tasks + op_plano_item
--   07 MATERIAIS ............ fora do escopo: linhas guardadas em op_importacao_pendente
--   13/14/18 ................ só cálculo (nada gravado)
--
-- REGRAS QUE O SCHEMA GARANTE
--   • Toda op_* tem projeto_id NOT NULL; o org_id vem do PROJETO por trigger
--     (op_org_do_projeto) e divergência é recusada — ninguém grava a obra de
--     uma empresa carimbada com outra.
--   • Chave de identidade da importação (UNIQUE) nunca inclui o que a pessoa
--     corrige (valor, quantidade, boletim, texto livre).
--   • "Sumiu da planilha" não apaga: marca ausente_na_planilha_em.
--   • Soft delete (deleted_at) + carimbo de autoria + audit_log, mesmo padrão
--     das migrations 025/026. Registro excluído no sistema não ressuscita por
--     reimportação (o importador pula; a UNIQUE continua valendo).
--   • UNIQUE simples, sem índice parcial: o upsert do PostgREST (on_conflict)
--     não aceita predicado.
--   • Serviço criado na TELA sem código recebe <PREFIXO>-S0001, -S0002…
--     (contador em op_parametros.ultimo_seq_sistema). Não colide com BER-0055
--     da planilha — o app Python usava count+1 e colidia na reimportação.
--   • Salário individual nunca sai do banco para quem não é admin:
--     op_folha_agregada() devolve só a contagem e a soma da folha do projeto.
--
-- RLS: policies org_read / org_write com rls_liberado() como primeiro termo
-- (padrão da 030). Nenhuma policy using(true).
--
-- Idempotente. Não altera tabela existente (ocorrencias_obra, lps_tasks,
-- pessoas não recebem ALTER — só FK de tabelas NOVAS apontando para elas).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 0. CHECAGEM PRÉVIA ─────────────────────────────────────────────────────
-- Falha AQUI, com mensagem clara, em vez de deixar metade criada.
do $pre$
declare
  v_txt text;
  v_col text;
begin
  -- tabelas e funções das quais este módulo depende
  if to_regclass('public.projetos') is null then
    raise exception 'PRÉ-REQUISITO: tabela public.projetos não existe.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'projetos' and column_name = 'org_id') then
    raise exception 'PRÉ-REQUISITO: projetos.org_id não existe — rode as migrations 003/004 antes.';
  end if;
  if exists (select 1 from public.projetos where org_id is null) then
    raise exception 'PRÉ-REQUISITO: há projetos com org_id nulo — o trigger op_org_do_projeto recusaria gravar neles.';
  end if;
  if to_regclass('public.ocorrencias_obra') is null then
    raise exception 'PRÉ-REQUISITO: tabela public.ocorrencias_obra não existe (a aba 11 reusa essa tabela).';
  end if;
  if to_regclass('public.lps_tasks') is null then
    raise exception 'PRÉ-REQUISITO: tabela public.lps_tasks não existe (a aba 17 reusa essa tabela).';
  end if;
  if to_regclass('public.pessoas') is null or to_regclass('public.pessoa_remuneracao') is null then
    raise exception 'PRÉ-REQUISITO: pessoas / pessoa_remuneracao não existem — rode a migration 020 antes.';
  end if;
  if to_regprocedure('public.fn_carimbo()') is null or to_regprocedure('public.fn_auditoria()') is null then
    raise exception 'PRÉ-REQUISITO: fn_carimbo()/fn_auditoria() não existem — rode a migration 025 antes.';
  end if;
  if to_regprocedure('public.rls_liberado()') is null or to_regprocedure('public.orgs_visiveis()') is null
     or to_regprocedure('public.orgs_editaveis()') is null then
    raise exception 'PRÉ-REQUISITO: funções de escopo por empresa não existem — rode a migration 002 antes.';
  end if;
  if to_regprocedure('public.norm_txt(text)') is null then
    raise exception 'PRÉ-REQUISITO: norm_txt(text) não existe — rode a migration 020 antes (as colunas *_norm dependem dela).';
  end if;

  -- as FKs novas exigem que as chaves das tabelas reusadas sejam uuid
  foreach v_txt in array array['ocorrencias_obra', 'lps_tasks', 'projetos', 'pessoas'] loop
    if coalesce((select data_type from information_schema.columns
                  where table_schema = 'public' and table_name = v_txt and column_name = 'id'), '') <> 'uuid' then
      raise exception 'PRÉ-REQUISITO: %.id não é uuid — as extensões op_* não conseguem apontar para ela.', v_txt;
    end if;
  end loop;

  -- colunas de ocorrencias_obra que o módulo LÊ/GRAVA
  foreach v_col in array array['projeto_id','data','tipo','descricao','resolvida','resolvido_em',
                               'origem','origem_fonte','org_id','deleted_at'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'ocorrencias_obra' and column_name = v_col) then
      raise exception 'PRÉ-REQUISITO: ocorrencias_obra.% não existe.', v_col;
    end if;
  end loop;
  -- ocorrencias_obra não tem DDL no repositório: confere que nenhuma coluna
  -- obrigatória SEM default ficou de fora do que o módulo preenche
  select string_agg(column_name, ', ') into v_txt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'ocorrencias_obra'
     and is_nullable = 'NO' and column_default is null
     and coalesce(is_generated, 'NEVER') = 'NEVER' and coalesce(is_identity, 'NO') = 'NO'
     and column_name not in ('id','projeto_id','data','tipo','descricao','resolvida',
                             'origem','origem_fonte','org_id');
  if v_txt is not null then
    raise exception 'PRÉ-REQUISITO: ocorrencias_obra tem coluna(s) obrigatória(s) sem default que o Controle Operacional não preenche: %', v_txt;
  end if;

  foreach v_col in array array['project_id','semana_iso','task_name','responsavel','comprometida','concluida',
                               'motivo_nao_conclusao','org_id','deleted_at'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = 'lps_tasks' and column_name = v_col) then
      raise exception 'PRÉ-REQUISITO: lps_tasks.% não existe.', v_col;
    end if;
  end loop;
  select string_agg(column_name, ', ') into v_txt
    from information_schema.columns
   where table_schema = 'public' and table_name = 'lps_tasks'
     and is_nullable = 'NO' and column_default is null
     and coalesce(is_generated, 'NEVER') = 'NEVER' and coalesce(is_identity, 'NO') = 'NO'
     and column_name not in ('id','project_id','semana_iso','task_name','responsavel','comprometida',
                             'concluida','motivo_nao_conclusao','org_id');
  if v_txt is not null then
    raise exception 'PRÉ-REQUISITO: lps_tasks tem coluna(s) obrigatória(s) sem default que o plano semanal não preenche: %', v_txt;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'lps_tasks'
                and column_name = 'concluida' and is_nullable = 'NO') then
    raise notice 'AVISO: lps_tasks.concluida é NOT NULL — compromisso com CONCLUÍDO? em branco vai falhar ao gravar (o módulo não transforma vazio em "não").';
  end if;

  if to_regclass('public.lps_restricoes') is null then
    raise notice 'AVISO: lps_restricoes não existe — o botão "virar restrição" do Lookahead vai avisar e não gravar.';
  end if;
end $pre$;

-- ── 1. HISTÓRICO DE IMPORTAÇÕES ────────────────────────────────────────────
create table if not exists public.op_importacao (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'planilha',
  chave_import           text,
  importacao_id          uuid,                        -- sem uso aqui; mantém o molde comum das op_*
  ausente_na_planilha_em timestamptz,
  arquivo                text not null,
  sha256                 text,
  modelo                 text not null default 'rev16',
  resumo                 jsonb not null default '{}'::jsonb
);
comment on table public.op_importacao is
  'Uma linha por (arquivo importado × obra). resumo = contagens NOVO/MUDOU/IGUAL/AUSENTE/… por aba e a lista do que o importador não entendeu.';

-- molde comum das tabelas de dados (colunas repetidas de propósito, legível no Table Editor)
-- id · org_id · projeto_id · origem · chave_import · importacao_id · ausente_na_planilha_em

create table if not exists public.op_importacao_pendente (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'planilha',
  chave_import           text not null,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  aba                    text not null,              -- '07' materiais | '10' RDO
  linha                  int,
  dados                  jsonb not null default '{}'::jsonb,
  constraint op_importacao_pendente_chave_uk unique (projeto_id, aba, chave_import)
);
comment on table public.op_importacao_pendente is
  'Linhas de abas que o sistema ainda não modela (07 MATERIAIS) ou que têm módulo próprio (10 RDO → /app/rdo). Guardadas para não se perderem.';

-- ── 2. ABA 01 — PARÂMETROS E LISTAS ────────────────────────────────────────
create table if not exists public.op_parametros (
  projeto_id             uuid primary key references public.projetos(id),
  org_id                 uuid not null references public.organizations(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  empresa                text,
  responsavel            text,
  coordenador            text,
  contrato_nome          text,          -- BERTIOGA (C8 / C10)
  contrato_descricao     text,
  prefixo                text,          -- BER (LEFT do nome, como a fórmula do ID)
  inicio_operacao        date,          -- C12 → SEMANA "S1"
  mes_referencia         date,          -- C13
  desconto_consorcio     numeric,       -- C17 (fração)
  dia_fechamento         numeric,       -- C18
  defasagem_recebimento  numeric,       -- C19 (dias)
  dias_uteis_mes         numeric,       -- C20
  jornada_h              numeric,       -- C21
  prazo_padrao_dias      numeric,       -- C22
  alerta_prazo_dias      numeric,       -- C23
  margem_alvo            numeric,       -- C33 / D33 — 0 é 0, vazio é "não informado"
  fator_encargos         numeric,       -- 01A C34
  beneficios_pessoa      numeric,       -- 01A C35
  ultimo_seq_sistema     int  not null default 0,
  fonte_custo            text not null default 'op' check (fonte_custo in ('op','fcp'))
);
comment on column public.op_parametros.ultimo_seq_sistema is
  'Contador do código gerado para serviço criado na tela (<PREFIXO>-S0001). Só o trigger op_servico_codigo mexe.';
comment on column public.op_parametros.fonte_custo is
  'De onde vem custo mensal/imposto/margem das metas: op (tabelas op_*) ou fcp (Fluxo de Caixa Projetado — ainda não ligado no frontend).';

create table if not exists public.op_lista (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  nome                   text not null,       -- TIPO, BAIRRO, MOTIVO_NE…
  valor                  text not null,
  ordem                  int,
  constraint op_lista_uk unique (projeto_id, nome, valor)
);

-- ── 3. ABA 01A — CUSTOS E TRIBUTOS ─────────────────────────────────────────
create table if not exists public.op_custo_item (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  item                   text not null,
  item_norm              text generated always as (public.norm_txt(item)) stored,
  qtd                    numeric,
  valor_unit             numeric,
  fonte                  text,
  ordem                  int,
  constraint op_custo_item_uk unique (projeto_id, item_norm)
);

create table if not exists public.op_tributo (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  nome                   text not null,
  nome_norm              text generated always as (public.norm_txt(nome)) stored,
  aliquota               numeric,             -- fração: 0,05 = 5%
  memoria                text,
  fonte                  text,
  ordem                  int,
  constraint op_tributo_uk unique (projeto_id, nome_norm)
);

-- ── 4. ABA 02 — PREÇOS DO CONTRATO ─────────────────────────────────────────
create table if not exists public.op_preco (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  chave                  text not null,       -- BER-72000044
  contrato               text,
  grupo                  text,
  item_sabesp            text,
  descricao              text,
  n_preco                text,
  un                     text,                -- un | M | M3 — metro não soma com unidade
  preco                  numeric,
  constraint op_preco_uk unique (projeto_id, chave)
);

-- ── 5. ABA 03 — CADASTRO DE SERVIÇOS ───────────────────────────────────────
create table if not exists public.op_servico (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  codigo                 text not null,       -- BER-0001 (planilha) | BER-S0001 (tela)
  n_os_sabesp            text,
  data_solicitacao       date,
  prazo_dias             numeric,
  prioridade             text,
  tipo                   text,
  endereco               text,
  numero                 text,
  bairro                 text,
  cidade                 text,
  referencia             text,
  pavimento              text,
  descricao              text,
  tratativa_manual       text,
  observacao             text,
  data_execucao_digitada date,               -- 03 R é fórmula (conclusão da OS); só preenchida quando alguém digitou por cima
  constraint op_servico_uk unique (projeto_id, codigo)
);
comment on column public.op_servico.data_execucao_digitada is
  'Aba 03, coluna R (DATA DE EXECUÇÃO) digitada por cima da fórmula. Vazio = vale a conclusão da OS (como a fórmula).';

-- ── 6. ABA 04 — PROGRAMAÇÃO DIÁRIA ─────────────────────────────────────────
create table if not exists public.op_programacao (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  servico_id             uuid not null references public.op_servico(id),
  data                   date not null,
  equipe                 text,
  seq                    int,
  h_previstas            numeric,
  executou               text check (executou is null or executou in ('SIM','NÃO')),
  data_execucao          date,
  motivo_nao_execucao    text,
  reprogramar_para       date,
  observacao             text,
  constraint op_programacao_uk unique (servico_id, data)
);

-- ── 7. ABA 05 — ORDENS DE SERVIÇO ──────────────────────────────────────────
create table if not exists public.op_ordem_servico (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  servico_id             uuid not null references public.op_servico(id),
  equipe                 text,
  encarregado            text,
  data_inicio            date,
  data_conclusao         date,
  profundidade_m         numeric,
  extensao_m             numeric,
  pavimento_reposto      text,
  foto_antes             text,
  foto_depois            text,
  n_rdo                  text,
  pendencia              text,
  constraint op_ordem_servico_uk unique (servico_id)
);

-- ── 8. ABA 06 — APONTAMENTO DIÁRIO ─────────────────────────────────────────
create table if not exists public.op_apontamento (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  data                   date not null,
  equipe                 text,
  equipe_norm            text generated always as (coalesce(upper(btrim(equipe)), '')) stored,
  n_pessoas              numeric,
  h_normais              numeric,
  h_extras               numeric,
  retro_h                numeric,
  cam34_munck_h          numeric,
  caminhao_hr_h          numeric,
  compressor_h           numeric,
  rompedor_h             numeric,
  bomba_h                numeric,
  km_rodado              numeric,
  status_dia             text,
  motivo_parada          text,
  observacao             text,
  constraint op_apontamento_uk unique (projeto_id, data, equipe_norm)
);

-- ── 9. ABA 09 — MEDIÇÃO ────────────────────────────────────────────────────
create table if not exists public.op_medicao_item (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,               -- código serviço | código preço | ordem
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  servico_id             uuid not null references public.op_servico(id),
  cod_preco              text not null,
  ordem                  int,
  n_boletim              text,
  qtd                    numeric,
  status                 text,
  data_apresentacao      date,
  valor_glosado          numeric,
  motivo_glosa           text,
  reapresentar           text,
  observacao             text,
  data_execucao_digitada date,               -- 09 G é fórmula (conclusão da OS); só preenchida quando alguém digitou por cima
  constraint op_medicao_item_uk unique (projeto_id, chave_import)
);
comment on column public.op_medicao_item.data_execucao_digitada is
  'Aba 09, coluna G (DATA DE EXECUÇÃO) digitada por cima da fórmula. Vazio = vale a conclusão da OS. É esta data que decide o MÊS DE MEDIÇÃO.';

-- ── 10. ABA 12 — FATURAMENTO ───────────────────────────────────────────────
create table if not exists public.op_faturamento (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  mes                    date not null check (extract(day from mes) = 1),   -- 1º dia do mês
  n_nf                   text,
  data_nf                date,
  data_recebimento       date,
  valor_recebido         numeric,
  constraint op_faturamento_uk unique (projeto_id, mes)
);

-- ── 11. ABA 15 — ATAS DE REUNIÃO (5W2H) ────────────────────────────────────
create table if not exists public.op_ata (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,               -- data | hora | assunto | ordem
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  data                   date not null,
  hora                   text,
  tipo                   text,
  local                  text,
  participantes_wcr      text,
  participantes_ext      text,
  assunto                text,
  falado                 text,
  decisao                text,
  pendencia              text,               -- O QUÊ
  responsavel            text,               -- QUEM
  prazo                  date,               -- QUANDO
  prioridade             text,
  status                 text,
  gera_pleito            text,
  link_gravacao          text,
  transcricao            text,
  porque                 text,               -- POR QUÊ
  onde                   text,               -- ONDE
  como                   text,               -- COMO
  quanto                 numeric,            -- QUANTO CUSTA
  ordem                  int,
  constraint op_ata_uk unique (projeto_id, chave_import)
);

-- ── 12. ABA 16 — LOOKAHEAD E RESTRIÇÕES ────────────────────────────────────
create table if not exists public.op_lookahead (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  servico_id             uuid not null references public.op_servico(id),
  semana                 date not null,      -- 2ª feira
  material_ok            text,
  equipamento_ok         text,
  mao_de_obra_ok         text,
  os_emitida             text,
  licenca_ok             text,
  acesso_ok              text,
  responsavel            text,
  prazo                  date,
  lps_restricao_id       uuid,               -- preenchido pelo botão "virar restrição" (sem FK: lps_restricoes não tem DDL no repo)
  constraint op_lookahead_uk unique (servico_id, semana)
);

-- ── 13. ABA 08 — EQUIPE (reusa pessoas) ────────────────────────────────────
create table if not exists public.op_equipe_membro (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  pessoa_id              uuid not null references public.pessoas(id),
  matricula              text not null,      -- BER-001
  equipe                 text,               -- BER-A | APOIO
  funcao                 text,
  admissao               date,
  ativo                  boolean,            -- null = não informado (a planilha só conta "SIM")
  constraint op_equipe_membro_uk unique (projeto_id, matricula)
);
comment on table public.op_equipe_membro is
  'Quem trabalha em qual equipe NESTE contrato. Nome/cargo moram em pessoas; salário em pessoa_remuneracao (só admin).';

create table if not exists public.pessoa_vencimento (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references public.organizations(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  pessoa_id              uuid not null references public.pessoas(id) on delete cascade,
  tipo                   text not null check (tipo in ('ASO','NR06','NR10','NR18','NR33','NR35','CNH')),
  vence_em               date,
  constraint pessoa_vencimento_uk unique (pessoa_id, tipo)
);

-- ── 14. ABA 11 — OCORRÊNCIAS (reusa ocorrencias_obra) ──────────────────────
create table if not exists public.op_ocorrencia_ext (
  ocorrencia_id          uuid primary key references public.ocorrencias_obra(id) on delete cascade,
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,               -- data | ordem no dia
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  servico_id             uuid references public.op_servico(id),
  equipe                 text,
  gravidade              text,
  impacto_h              numeric,
  custo_estimado         numeric,
  acao                   text,
  responsavel            text,
  prazo                  text,               -- a planilha aceita texto livre ("imediato")
  status                 text,
  data_encerramento      date,
  gera_pleito            text,
  constraint op_ocorrencia_ext_uk unique (projeto_id, chave_import)
);

-- ── 15. ABA 17 — PLANO SEMANAL (reusa lps_tasks) ───────────────────────────
create table if not exists public.op_plano_item (
  lps_task_id            uuid primary key references public.lps_tasks(id) on delete cascade,
  org_id                 uuid not null references public.organizations(id),
  projeto_id             uuid not null references public.projetos(id),
  origem                 text not null default 'manual',
  chave_import           text,
  importacao_id          uuid references public.op_importacao(id) on delete set null,
  ausente_na_planilha_em timestamptz,
  op_servico_id          uuid not null references public.op_servico(id),
  semana                 date not null,      -- 2ª feira (lps_tasks.semana_iso guarda a ISO)
  data_conclusao         date,
  reprogramado_para      date,
  observacao             text,
  constraint op_plano_item_uk unique (op_servico_id, semana)
);

-- ── 16. AUTORIA, SOFT DELETE, AUDITORIA, RLS, GRANTS (loop padrão 026/030) ─
do $rls$
declare t text;
begin
  foreach t in array array[
    'op_importacao','op_importacao_pendente','op_parametros','op_lista','op_custo_item','op_tributo',
    'op_preco','op_servico','op_programacao','op_ordem_servico','op_apontamento','op_medicao_item',
    'op_faturamento','op_ata','op_lookahead','op_equipe_membro','pessoa_vencimento',
    'op_ocorrencia_ext','op_plano_item'
  ] loop
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
    execute format('drop policy if exists org_read on public.%I', t);
    execute format('create policy org_read on public.%I for select
                      using ( public.rls_liberado() or org_id = any (public.orgs_visiveis()) )', t);
    execute format('drop policy if exists org_write on public.%I', t);
    execute format('create policy org_write on public.%I for all
                      using      ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )
                      with check ( public.rls_liberado() or org_id = any (public.orgs_editaveis()) )', t);

    execute format('revoke insert, update, delete on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create index if not exists %I on public.%I (org_id)', 'idx_' || t || '_org', t);
  end loop;
end $rls$;

-- ── 17. org_id VEM DO PROJETO (e divergência é recusada) ───────────────────
create or replace function public.op_org_do_projeto()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_org uuid;
begin
  if TG_OP = 'UPDATE'
     and new.projeto_id is not distinct from old.projeto_id
     and new.org_id is not distinct from old.org_id then
    return new;
  end if;
  select p.org_id into v_org from public.projetos p where p.id = new.projeto_id;
  if v_org is null then
    raise exception 'Controle Operacional: o projeto % não existe ou está sem empresa (org_id).', new.projeto_id
      using errcode = 'foreign_key_violation';
  end if;
  if new.org_id is null then
    new.org_id := v_org;
  elsif new.org_id <> v_org then
    raise exception 'Controle Operacional: org_id % não é a empresa do projeto % (esperado %).',
      new.org_id, new.projeto_id, v_org
      using errcode = 'check_violation';
  end if;
  return new;
end $fn$;

create or replace function public.op_org_da_pessoa()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_org uuid;
begin
  if TG_OP = 'UPDATE'
     and new.pessoa_id is not distinct from old.pessoa_id
     and new.org_id is not distinct from old.org_id then
    return new;
  end if;
  select p.org_id into v_org from public.pessoas p where p.id = new.pessoa_id;
  if v_org is null then
    raise exception 'Controle Operacional: a pessoa % não existe.', new.pessoa_id using errcode = 'foreign_key_violation';
  end if;
  if new.org_id is null then
    new.org_id := v_org;
  elsif new.org_id <> v_org then
    raise exception 'Controle Operacional: org_id % não é a empresa da pessoa % (esperado %).',
      new.org_id, new.pessoa_id, v_org using errcode = 'check_violation';
  end if;
  return new;
end $fn$;

do $org$
declare t text;
begin
  foreach t in array array[
    'op_importacao','op_importacao_pendente','op_parametros','op_lista','op_custo_item','op_tributo',
    'op_preco','op_servico','op_programacao','op_ordem_servico','op_apontamento','op_medicao_item',
    'op_faturamento','op_ata','op_lookahead','op_equipe_membro','op_ocorrencia_ext','op_plano_item'
  ] loop
    -- nome com "00" para rodar antes do gerador de código (triggers BEFORE disparam em ordem alfabética)
    execute format('drop trigger if exists trg_op_00_org on public.%I', t);
    execute format('create trigger trg_op_00_org before insert or update on public.%I
                      for each row execute function public.op_org_do_projeto()', t);
  end loop;
end $org$;

drop trigger if exists trg_op_00_org on public.pessoa_vencimento;
create trigger trg_op_00_org before insert or update on public.pessoa_vencimento
  for each row execute function public.op_org_da_pessoa();

-- ── 18. CÓDIGO DO SERVIÇO CRIADO NA TELA ───────────────────────────────────
create or replace function public.op_servico_codigo()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare v_seq int; v_prefixo text;
begin
  if new.codigo is not null and btrim(new.codigo) <> '' then
    return new;                        -- veio da planilha (BER-0001) ou foi digitado
  end if;
  -- prefixo sugerido: 3 primeiras letras do nome da obra sem o "WCR —"
  select upper(left(regexp_replace(
           public.norm_txt(regexp_replace(p.nome, '^\s*WCR\s*[—–-]\s*', '', 'i')),
           '[^a-z0-9]', '', 'g'), 3))
    into v_prefixo
    from public.projetos p where p.id = new.projeto_id;

  insert into public.op_parametros (projeto_id, org_id, prefixo, ultimo_seq_sistema, origem)
  values (new.projeto_id, new.org_id, nullif(v_prefixo, ''), 1, 'sistema')
  on conflict (projeto_id) do update
     set ultimo_seq_sistema = public.op_parametros.ultimo_seq_sistema + 1,
         prefixo = coalesce(public.op_parametros.prefixo, excluded.prefixo)
  returning ultimo_seq_sistema, prefixo into v_seq, v_prefixo;

  new.codigo := coalesce(nullif(v_prefixo, ''), 'SRV') || '-S' || lpad(v_seq::text, 4, '0');
  return new;
end $fn$;

-- a coluna é NOT NULL, mas o trigger BEFORE preenche antes da checagem
drop trigger if exists trg_op_10_codigo on public.op_servico;
create trigger trg_op_10_codigo before insert on public.op_servico
  for each row execute function public.op_servico_codigo();

-- ── 19. FOLHA AGREGADA (membro vê custo, nunca salário individual) ─────────
create or replace function public.op_folha_agregada(p_projeto uuid)
returns table (n_com_salario int, soma_salario numeric)
language plpgsql stable security definer set search_path = public as $fn$
declare v_org uuid;
begin
  select p.org_id into v_org from public.projetos p where p.id = p_projeto;
  if v_org is null then
    raise exception 'Controle Operacional: projeto % não encontrado.', p_projeto using errcode = 'no_data_found';
  end if;
  -- de propósito SEM rls_liberado(): folha não abre nem com o kill switch
  -- (mesma regra de pessoa_remuneracao, que só admin global lê)
  if auth.uid() is null or not (v_org = any (public.orgs_visiveis())) then
    raise exception 'Controle Operacional: sem acesso a este projeto.' using errcode = 'insufficient_privilege';
  end if;
  return query
    select count(r.salario_bruto)::int,
           coalesce(sum(r.salario_bruto), 0)::numeric
      from (select distinct m.pessoa_id
              from public.op_equipe_membro m
             where m.projeto_id = p_projeto
               and m.deleted_at is null
               and m.ativo is true) a
      join public.pessoa_remuneracao r on r.pessoa_id = a.pessoa_id;
end $fn$;
comment on function public.op_folha_agregada(uuid) is
  'Soma e contagem dos salários dos membros ATIVOS do projeto. Nunca devolve salário individual.';
revoke all on function public.op_folha_agregada(uuid) from public, anon;
grant execute on function public.op_folha_agregada(uuid) to authenticated, service_role;

-- ── 20. ÍNDICES DE LEITURA ─────────────────────────────────────────────────
create index if not exists op_servico_proj_data_idx      on public.op_servico (projeto_id, data_solicitacao);
create index if not exists op_programacao_proj_data_idx  on public.op_programacao (projeto_id, data);
create index if not exists op_programacao_servico_idx    on public.op_programacao (servico_id);
create index if not exists op_ordem_servico_proj_idx     on public.op_ordem_servico (projeto_id, data_conclusao);
create index if not exists op_apontamento_proj_data_idx  on public.op_apontamento (projeto_id, data);
create index if not exists op_medicao_item_servico_idx   on public.op_medicao_item (servico_id);
create index if not exists op_medicao_item_proj_idx      on public.op_medicao_item (projeto_id, n_boletim);
create index if not exists op_faturamento_proj_mes_idx   on public.op_faturamento (projeto_id, mes);
create index if not exists op_ata_proj_data_idx          on public.op_ata (projeto_id, data);
create index if not exists op_lookahead_proj_semana_idx  on public.op_lookahead (projeto_id, semana);
create index if not exists op_equipe_membro_pessoa_idx   on public.op_equipe_membro (pessoa_id);
create index if not exists op_ocorrencia_ext_proj_idx    on public.op_ocorrencia_ext (projeto_id);
create index if not exists op_plano_item_proj_semana_idx on public.op_plano_item (projeto_id, semana);
create index if not exists op_importacao_proj_idx        on public.op_importacao (projeto_id, created_at desc);
create index if not exists op_lista_proj_nome_idx        on public.op_lista (projeto_id, nome);

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Esperado: 19 tabelas · 38 policies (2 por tabela) · 0 policies abertas ·
-- 19 tabelas com RLS ligado · 4 funções · 1 trigger de código · 19 triggers de org.
select 'tabelas do Controle Operacional (esperado 19)' as item, count(*)::text as valor
  from information_schema.tables
 where table_schema = 'public'
   and (table_name like 'op\_%' escape '\' or table_name = 'pessoa_vencimento')
   and table_type = 'BASE TABLE'
union all
select 'policies nas tabelas (esperado 38)', count(*)::text
  from pg_policies
 where schemaname = 'public'
   and (tablename like 'op\_%' escape '\' or tablename = 'pessoa_vencimento')
union all
select 'policies ABERTAS using(true) (esperado 0)', count(*)::text
  from pg_policies
 where schemaname = 'public'
   and (tablename like 'op\_%' escape '\' or tablename = 'pessoa_vencimento')
   and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
union all
select 'tabelas com RLS ligado (esperado 19)', count(*)::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
   and (c.relname like 'op\_%' escape '\' or c.relname = 'pessoa_vencimento')
union all
select 'funções op_* (esperado 4)', count(*)::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('op_org_do_projeto','op_org_da_pessoa','op_servico_codigo','op_folha_agregada')
union all
select 'trigger de código do serviço (esperado 1)', count(*)::text
  from pg_trigger where tgname = 'trg_op_10_codigo' and not tgisinternal
union all
select 'triggers de org_id (esperado 19)', count(*)::text
  from pg_trigger where tgname = 'trg_op_00_org' and not tgisinternal
union all
select 'anon executa op_folha_agregada? (esperado false)',
       has_function_privilege('anon', 'public.op_folha_agregada(uuid)', 'execute')::text;

-- Teste manual do gerador de código (rode dentro de begin/rollback):
-- begin;
--   insert into public.op_servico (projeto_id, tipo)
--   select id, 'teste' from public.projetos where public.norm_txt(nome) = public.norm_txt('WCR — Bertioga')
--   returning codigo;        -- esperado: BER-S0001
-- rollback;
