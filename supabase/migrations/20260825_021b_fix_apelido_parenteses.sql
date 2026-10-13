-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 021b — CORREÇÃO: apelido entre parênteses quebrava o casamento
-- ConstruData · WCR · 25/08/2026 · APLICADA em produção em 25/08/2026
--
-- BUG ENCONTRADO AO APLICAR A 021:
--   norm_txt() NÃO remove parênteses. Quando o nome canônico de um cluster era
--   a variante com apelido — 'Cristian (Coveiro)' — a pessoa nascia com
--   nome_norm = 'cristian (coveiro)', e o join `p.nome_norm = res.n1`
--   ('cristian') falhava silenciosamente.
--   Sintoma: 8 nomes sem alias e 10 das 162 linhas sem vínculo.
--   Afetou: Cristian, Maelson/Mazinho, Edson Olímpio, Pedro Silva da Fonseca.
--
-- CORREÇÃO: separa o apelido do nome. Depois disso os 4 invariantes da 021
-- zeram e os 162 vínculos aparecem (42 vigentes + 120 históricos).
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

update public.pessoas
   set apelido = coalesce(apelido, nullif(btrim(substring(nome_completo from '\(([^)]*)\)')),'')),
       nome_completo = btrim(regexp_replace(regexp_replace(nome_completo,'\(.*?\)',' ','g'), '\s+', ' ', 'g'))
 where origem = 'equipe_membros' and nome_completo like '%(%';

-- reexecutar em seguida os blocos 3b e 4 da migration 021 (aliases + vínculos).

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
select 'nomes sem alias (esperado 0)' item, count(distinct public.norm_txt(regexp_replace(em.nome,'\(.*?\)',' ','g')))::text v
  from public.equipe_membros_legacy em where btrim(coalesce(em.nome,'')) <> ''
   and not exists (select 1 from public.pessoa_apelidos a
     where a.alias_norm = public.norm_txt(regexp_replace(em.nome,'\(.*?\)',' ','g')))
union all select 'linhas sem vinculo (esperado 0)', count(*)::text
  from public.equipe_membros_legacy em where btrim(coalesce(em.nome,'')) <> ''
   and not exists (select 1 from public.pessoa_equipe pe where pe.id = em.id);
