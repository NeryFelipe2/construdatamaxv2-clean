-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 022 — COMPATIBILIDADE: equipe_membros VIRA VIEW ATUALIZÁVEL
-- ConstruData · WCR · 25/08/2026 · colar DEPOIS da 021 (com conferência OK)
--
-- ⚠️ ESTE É O ÚNICO PASSO "DE VIRADA" DO PACOTE DE PESSOAL.
--
-- O QUE FAZ:
--   1. Renomeia a tabela física equipe_membros → equipe_membros_legacy
--      (as 162 linhas ficam CONGELADAS, intactas, para sempre).
--   2. Recria o nome `equipe_membros` como VIEW sobre o modelo novo
--      (pessoas + pessoa_equipe), com triggers INSTEAD OF.
--
-- RESULTADO: todo o código existente (useEquipes.ts, kanban de equipes,
-- lpsStore, gestão 360) continua lendo e escrevendo `equipe_membros`
-- normalmente — mas por baixo passa a usar o cadastro único:
--   INSERT  → resolve/cria a pessoa e abre vínculo
--   UPDATE de equipe_id → MOVE: fecha o vínculo velho, abre o novo (histórico!)
--   DELETE  → soft-delete: fecha o vínculo; a PESSOA continua existindo
--
-- ROLLBACK (guardado no fim do arquivo, comentado): 30 segundos.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. CONGELAR A TABELA FÍSICA ────────────────────────────────────────────
do $$ begin
  if to_regclass('public.equipe_membros_legacy') is null
     and exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
                  where n.nspname='public' and c.relname='equipe_membros' and c.relkind='r') then
    alter table public.equipe_membros rename to equipe_membros_legacy;
  end if;
end $$;

comment on table public.equipe_membros_legacy is
  'CONGELADA em 25/08/2026 — snapshot das 162 linhas antes da unificação em '
  'pessoas/pessoa_equipe. NÃO escrever aqui. O nome equipe_membros agora é uma view.';

-- ── 2. A VIEW (mesmas 5 colunas que todo o frontend usa) ───────────────────
create or replace view public.equipe_membros as
  select pe.id,
         pe.equipe_id,
         p.nome_completo as nome,
         pe.funcao,
         pe.ordem
    from public.pessoa_equipe pe
    join public.pessoas p on p.id = pe.pessoa_id
   where pe.ate is null;          -- só vínculos VIGENTES

-- ── 3. TRIGGERS INSTEAD OF ─────────────────────────────────────────────────
create or replace function public.tg_equipe_membros_ins() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_pessoa uuid;
  v_norm   text := public.norm_txt(regexp_replace(new.nome, '\(.*?\)', ' ', 'g'));
begin
  -- 1º: alias confirmado; 2º: nome exato; 3º: cria pessoa nova (nada se perde)
  select pessoa_id into v_pessoa
    from public.pessoa_apelidos
   where revisado and alias_norm = v_norm
   limit 1;

  if v_pessoa is null then
    select id into v_pessoa from public.pessoas
     where nome_norm = v_norm
     order by (status = 'ativo') desc
     limit 1;
  end if;

  if v_pessoa is null then
    insert into public.pessoas (nome_completo, cargo_texto, origem, revisar)
    values (btrim(new.nome), new.funcao, 'equipe_membros_compat', true)
    returning id into v_pessoa;
    insert into public.pessoa_apelidos (pessoa_id, alias_raw, alias_norm, fonte, revisado)
    values (v_pessoa, new.nome, v_norm, 'compat', true)
    on conflict do nothing;
  end if;

  insert into public.pessoa_equipe (id, pessoa_id, equipe_id, funcao, ordem)
  values (coalesce(new.id, gen_random_uuid()), v_pessoa, new.equipe_id,
          new.funcao, coalesce(new.ordem, 0))
  on conflict (pessoa_id, equipe_id) where ate is null
    do update set funcao = excluded.funcao, ordem = excluded.ordem;

  return new;
end $$;

create or replace function public.tg_equipe_membros_upd() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.equipe_id is distinct from old.equipe_id then
    -- MOVER DE EQUIPE: fecha o vínculo antigo, abre o novo — histórico de graça
    insert into public.pessoa_equipe (pessoa_id, equipe_id, funcao, ordem)
    select pe.pessoa_id, new.equipe_id, coalesce(new.funcao, pe.funcao), coalesce(new.ordem, 0)
      from public.pessoa_equipe pe
     where pe.id = old.id
    on conflict (pessoa_id, equipe_id) where ate is null
      do update set funcao = excluded.funcao, ordem = excluded.ordem;
    update public.pessoa_equipe set ate = current_date where id = old.id and ate is null;
  else
    update public.pessoa_equipe
       set funcao = coalesce(new.funcao, funcao),
           ordem  = coalesce(new.ordem,  ordem)
     where id = old.id;
  end if;
  return new;
end $$;

create or replace function public.tg_equipe_membros_del() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- DELETE lógico: some da view, mas o histórico E a pessoa continuam
  update public.pessoa_equipe set ate = current_date where id = old.id and ate is null;
  return old;
end $$;

drop trigger if exists equipe_membros_ins on public.equipe_membros;
drop trigger if exists equipe_membros_upd on public.equipe_membros;
drop trigger if exists equipe_membros_del on public.equipe_membros;
create trigger equipe_membros_ins instead of insert on public.equipe_membros
  for each row execute function public.tg_equipe_membros_ins();
create trigger equipe_membros_upd instead of update on public.equipe_membros
  for each row execute function public.tg_equipe_membros_upd();
create trigger equipe_membros_del instead of delete on public.equipe_membros
  for each row execute function public.tg_equipe_membros_del();

grant select, insert, update, delete on public.equipe_membros to anon, authenticated;

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select '1. tabela física congelada' item,
       (to_regclass('public.equipe_membros_legacy') is not null)::text valor
union all
select '2. linhas físicas preservadas (esperado 162)',
       count(*)::text from public.equipe_membros_legacy
union all
select '3. a view responde (membros VIGENTES de equipes ativas)',
       count(*)::text from public.equipe_membros
union all
select '4. view = vínculos vigentes (mesmos números)',
       count(*)::text from public.pessoa_equipe where ate is null;

-- ── TESTE MANUAL OBRIGATÓRIO DEPOIS DESTA MIGRATION ────────────────────────
-- Na tela de Equipes (kanban): criar equipe → adicionar 2 membros → editar a
-- função de 1 → mover 1 para outra equipe → remover 1 → excluir a equipe.
-- Depois conferir no banco:
--   select * from pessoa_equipe order by criado_em desc limit 10;
--   (o movido tem 1 vínculo fechado + 1 aberto; o removido tem ate preenchido;
--    as pessoas continuam todas em `pessoas`)

-- ── ROLLBACK DE EMERGÊNCIA (só se a UI de equipes quebrar) ─────────────────
-- begin;
-- drop trigger if exists equipe_membros_ins on public.equipe_membros;
-- drop trigger if exists equipe_membros_upd on public.equipe_membros;
-- drop trigger if exists equipe_membros_del on public.equipe_membros;
-- drop view if exists public.equipe_membros;
-- alter table public.equipe_membros_legacy rename to equipe_membros;
-- commit;
-- (volta EXATAMENTE ao estado anterior — as 162 linhas nunca foram tocadas)
