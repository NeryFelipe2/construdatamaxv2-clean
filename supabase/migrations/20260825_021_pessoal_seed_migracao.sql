-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 021 — PESSOAL: SEED DE CARGOS + MIGRAÇÃO DOS CADASTROS EXISTENTES
-- ConstruData · WCR · 25/08/2026 · colar DEPOIS da 020
--
-- O QUE FAZ:
--   1. Semeia o catálogo de cargos (planilha WCR + cargos vistos no RDO).
--   2. Migra os 34 `funcionarios` → `pessoas` (com remuneração), congelando
--      a tabela original como snapshot (NADA é alterado nela).
--   3. Migra os 162 nomes de `equipe_membros` → pessoas + apelidos, com
--      clusterização por tokens ('Almir' ⊂ 'Almir Junior' ⊂ 'Almir Gomes
--      dos Santos Junior' viram UMA pessoa com 3 apelidos). Homônimos
--      ambíguos NÃO são fundidos: viram pessoas separadas com revisar=true.
--   4. Materializa `pessoa_equipe`: vínculos vigentes p/ equipes ativas,
--      histórico fechado p/ inativas. Os UUIDs originais são preservados.
--
-- NENHUMA LINHA DAS TABELAS ORIGINAIS É ALTERADA OU APAGADA. Idempotente
-- (protegido por ON CONFLICT e por marcador de origem).
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. SEED DE CARGOS ──────────────────────────────────────────────────────
insert into public.cargos (nome, familia, nivel, categoria_rdo) values
  ('AJUDANTE GERAL I',        'AJUDANTE',       'I',   'ajudante'),
  ('AJUDANTE',                'AJUDANTE',       null,  'ajudante'),
  ('AUX DE CADASTRO',         'ADMINISTRATIVO', null,  'indireto'),
  ('AUX DE CADASTRO II',      'ADMINISTRATIVO', 'II',  'indireto'),
  ('ENCANADOR DE ESGOTO I',   'ENCANADOR',      'I',   'oficial'),
  ('ENCANADOR DE ESGOTO III', 'ENCANADOR',      'III', 'oficial'),
  ('ENCANADOR IV',            'ENCANADOR',      'IV',  'oficial'),
  ('ENCANADOR',               'ENCANADOR',      null,  'oficial'),
  ('PEDREIRO I',              'PEDREIRO',       'I',   'oficial'),
  ('PEDREIRO',                'PEDREIRO',       null,  'oficial'),
  ('ENCARREGADO',             'ENCARREGADO',    null,  'encarregado'),
  ('LÍDER',                   'ENCARREGADO',    null,  'encarregado'),
  ('OPERADOR',                'OPERADOR',       null,  'operador'),
  ('OPERADOR DE RETRO',       'OPERADOR',       null,  'operador'),
  ('MOTORISTA',               'OPERADOR',       null,  'operador'),
  ('SOLDADOR',                'PEDREIRO',       null,  'oficial')
on conflict (org_id, nome_norm) do nothing;

-- apelidos que resolvem as grafias sujas conhecidas
insert into public.cargo_apelidos (cargo_id, alias_raw, alias_norm, fonte)
select c.id, v.alias, public.norm_txt(v.alias), 'seed'
from (values
  ('ENCANADOR ESGOTO III', 'ENCANADOR DE ESGOTO III'),  -- sem o "DE" (planilha DESLIGADOS)
  ('Lider',                'LÍDER'),                     -- sem acento (rdo_mao_obra: 28 linhas)
  ('Encarregado de Obra',  'ENCARREGADO'),
  ('Encarregado de Obras', 'ENCARREGADO'),
  ('Ajudante de Obra',     'AJUDANTE'),
  ('Ajudante de Obras',    'AJUDANTE')
) as v(alias, canonico)
join public.cargos c on c.nome_norm = public.norm_txt(v.canonico)
on conflict (org_id, alias_norm) do nothing;

-- ── 2. FUNCIONARIOS (34, legado RK) → PESSOAS ──────────────────────────────
insert into public.pessoas
  (org_id, nome_completo, cargo_texto, status, data_admissao,
   venc_experiencia_1, venc_experiencia_2, obra_id, funcionario_legacy_id,
   observacoes, origem)
select
  coalesce(f.org_id, '22222222-2222-4222-8222-222222222222'),  -- RK
  btrim(f.nome), f.funcao,
  case when coalesce(f.status,'ativo') = 'ativo' then 'ativo' else 'desligado' end,
  f.admissao, f.venc_experiencia_1, f.venc_experiencia_2,
  f.obra_id, f.id,
  nullif('departamento original: ' || coalesce(f.departamento,''), 'departamento original: '),
  'funcionarios'
from public.funcionarios f
on conflict (funcionario_legacy_id) do nothing;

-- remuneração dos 34 (salário/CPF vão para a tabela FECHADA)
insert into public.pessoa_remuneracao (pessoa_id, cpf, salario_bruto, salario_encargos)
select p.id, nullif(btrim(f.cpf),''), f.salario, f.salario_encargos
from public.funcionarios f
join public.pessoas p on p.funcionario_legacy_id = f.id
on conflict (pessoa_id) do nothing;

-- o nome completo de cada um vira alias confirmado
insert into public.pessoa_apelidos (org_id, pessoa_id, alias_raw, alias_norm, fonte, revisado)
select p.org_id, p.id, p.nome_completo, p.nome_norm, 'funcionarios', true
from public.pessoas p
where p.origem = 'funcionarios'
on conflict (pessoa_id, alias_norm) do nothing;

-- vincula cargo pelo catálogo quando o texto casa (direto ou via apelido)
update public.pessoas p
   set cargo_id = c.id
  from public.cargos c
 where p.cargo_id is null and p.cargo_texto is not null
   and c.nome_norm = public.norm_txt(p.cargo_texto);
update public.pessoas p
   set cargo_id = ca.cargo_id
  from public.cargo_apelidos ca
 where p.cargo_id is null and p.cargo_texto is not null
   and ca.alias_norm = public.norm_txt(p.cargo_texto);

-- ── 3. EQUIPE_MEMBROS (162 nomes) → PESSOAS + APELIDOS ─────────────────────
-- Clusterização por tokens: A pertence ao cluster de B quando os tokens de A
-- são subconjunto próprio dos de B e B é a ÚNICA "raiz" compatível.

create temp table _em on commit drop as
select em.id, em.equipe_id, em.funcao, em.ordem,
       btrim(em.nome) as nome_raw,
       public.norm_txt(regexp_replace(em.nome, '\(.*?\)', ' ', 'g')) as n1,
       nullif(btrim(substring(em.nome from '\(([^)]*)\)')), '')      as apelido_par,
       e.ativo as equipe_ativa,
       coalesce(e.updated_at::date, current_date) as equipe_data
from public.equipe_membros em
join public.wcr_equipes e on e.id = em.equipe_id
where btrim(coalesce(em.nome,'')) <> '';

create temp table _nomes on commit drop as
select n1,
       (array_agg(nome_raw order by length(nome_raw) desc))[1] as nome_canonico_raw,
       (array_agg(apelido_par) filter (where apelido_par is not null))[1] as apelido,
       bool_or(equipe_ativa) as em_equipe_ativa,
       (select array_agg(t) from unnest(string_to_array(n1,' ')) t
         where t not in ('da','de','do','dos','das','e')) as tokens
from _em
group by n1;

-- raízes = nomes que não são subconjunto de nenhum outro
create temp table _roots on commit drop as
select n.* from _nomes n
where not exists (select 1 from _nomes m
                   where m.n1 <> n.n1 and n.tokens <@ m.tokens);

-- para cada nome: quantas raízes o contêm?
create temp table _resolucao on commit drop as
select n.n1, n.nome_canonico_raw, n.apelido, n.em_equipe_ativa, n.tokens,
       (select count(distinct r.n1) from _roots r
         where r.n1 <> n.n1 and n.tokens <@ r.tokens)                 as n_raizes,
       (select r.n1 from _roots r
         where r.n1 <> n.n1 and n.tokens <@ r.tokens limit 1)          as raiz_unica
from _nomes n;

-- 3a. cria UMA pessoa por raiz que ainda não existe (nem veio de funcionarios)
insert into public.pessoas (nome_completo, apelido, cargo_texto, status, origem, revisar)
select r.nome_canonico_raw,
       r.apelido,
       (select (array_agg(funcao) filter (where funcao is not null))[1]
          from _em where _em.n1 = r.n1),
       case when r.em_equipe_ativa then 'ativo' else 'desconhecido' end,
       'equipe_membros',
       -- revisar quando: nome de token único (pode ser homônimo) ou marcado no organograma
       (array_length(r.tokens,1) <= 1 or r.nome_canonico_raw ilike '%homônimo%'
        or r.nome_canonico_raw ilike 'equipe %')
from _roots r
where not exists (select 1 from public.pessoas p
                   where p.nome_norm = r.n1
                      or exists (select 1 from public.pessoa_apelidos a
                                  where a.alias_norm = r.n1))
;

-- 3b. aliases: cada variante aponta para a pessoa da sua raiz
--     · n_raizes = 0  → o nome É a própria raiz (pessoa criada em 3a ou já existente)
--     · n_raizes = 1  → alias confirmado da raiz única
--     · n_raizes >= 2 → AMBÍGUO: cria pessoa própria com revisar=true, alias NÃO confirmado
insert into public.pessoas (nome_completo, apelido, status, origem, revisar, observacoes)
select res.nome_canonico_raw, res.apelido,
       case when res.em_equipe_ativa then 'ativo' else 'desconhecido' end,
       'equipe_membros', true,
       'AMBÍGUO: o nome cabe em ' || res.n_raizes || ' pessoas diferentes — resolver na fila de duplicatas'
from _resolucao res
where res.n_raizes >= 2
  and not exists (select 1 from public.pessoas p where p.nome_norm = res.n1);

insert into public.pessoa_apelidos (pessoa_id, alias_raw, alias_norm, fonte, confianca, revisado)
select p.id, res.nome_canonico_raw, res.n1, 'equipe_membros',
       case when res.n_raizes >= 2 then 0.50 else 1.00 end,
       res.n_raizes < 2
from _resolucao res
join public.pessoas p
  on p.nome_norm = coalesce(
       case when res.n_raizes = 1 then res.raiz_unica end,  -- aponta pra raiz única
       res.n1)                                              -- senão, pra si mesmo
on conflict (pessoa_id, alias_norm) do nothing;

-- variantes cruas ('Cristian (Coveiro)') também viram alias da mesma pessoa
insert into public.pessoa_apelidos (pessoa_id, alias_raw, alias_norm, fonte, revisado)
select distinct a.pessoa_id, em.nome_raw, public.norm_txt(em.nome_raw), 'equipe_membros', false
from _em em
join public.pessoa_apelidos a on a.alias_norm = em.n1
where public.norm_txt(em.nome_raw) <> em.n1
on conflict (pessoa_id, alias_norm) do nothing;

-- ── 4. MATERIALIZA pessoa_equipe (PRESERVANDO os UUIDs originais) ──────────
insert into public.pessoa_equipe
  (id, pessoa_id, equipe_id, funcao, ordem, desde, ate, observacao)
select em.id,
       a.pessoa_id,
       em.equipe_id,
       em.funcao,
       coalesce(em.ordem, 0),
       em.equipe_data,
       case when em.equipe_ativa then null else em.equipe_data end,  -- inativa = histórico fechado
       em.apelido_par
from _em em
join lateral (
  select pa.pessoa_id from public.pessoa_apelidos pa
   where pa.alias_norm = em.n1
   order by pa.revisado desc, pa.confianca desc
   limit 1
) a on true
on conflict (id) do nothing;

commit;

-- ── CONFERÊNCIA (invariantes de "nada se perdeu") ──────────────────────────
-- 1) TODO funcionário legado virou pessoa — esperado: 0
select '1. funcionarios sem pessoa (esperado 0)' item,
       count(*)::text valor
  from public.funcionarios f
 where not exists (select 1 from public.pessoas p where p.funcionario_legacy_id = f.id)
union all
-- 2) TODO nome do equipe_membros é alcançável por alias — esperado: 0
select '2. nomes de equipe_membros sem alias (esperado 0)',
       count(distinct public.norm_txt(regexp_replace(em.nome,'\(.*?\)',' ','g')))::text
  from public.equipe_membros em
 where btrim(coalesce(em.nome,'')) <> ''
   and not exists (select 1 from public.pessoa_apelidos a
                    where a.alias_norm = public.norm_txt(regexp_replace(em.nome,'\(.*?\)',' ','g')))
union all
-- 3) TODA linha física virou vínculo — esperado: 0
select '3. linhas de equipe_membros sem pessoa_equipe (esperado 0)',
       count(*)::text
  from public.equipe_membros em
 where btrim(coalesce(em.nome,'')) <> ''
   and not exists (select 1 from public.pessoa_equipe pe where pe.id = em.id)
union all
-- 4) nenhum alias CONFIRMADO aponta para 2 pessoas — esperado: 0
select '4. alias confirmado duplicado (esperado 0)',
       count(*)::text
  from (select org_id, alias_norm from public.pessoa_apelidos
         where revisado group by 1,2 having count(distinct pessoa_id) > 1) x
union all
-- 5) números gerais
select '5. total de pessoas', count(*)::text from public.pessoas
union all
select '6. pessoas a revisar (fila de duplicatas)', count(*)::text from public.pessoas where revisar
union all
select '7. vínculos vigentes (equipes ativas)', count(*)::text from public.pessoa_equipe where ate is null
union all
select '8. vínculos históricos (equipes inativas)', count(*)::text from public.pessoa_equipe where ate is not null;
