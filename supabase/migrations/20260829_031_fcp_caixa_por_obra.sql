-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 031 — FCP E CONTROLE DE CAIXA POR OBRA
-- ConstruData · 29/08/2026 · APLICADA em produção
--
-- BUG (reportado com print): com o seletor em "WCR — Sakura" (consórcio ZN,
-- CT 13.546/25-00), a aba Fluxo de Caixa Projetado mostrava o FCP de
-- BERTIOGA + SANTOS — outra operação, outro contrato. O documento estava
-- pendurado direto na organização, sem obra dona, e Bertioga/Santos nem
-- existiam em `projetos`.
--
-- DECISÃO DO PRODUTO: FCP e Controle de Caixa são DO SISTEMA — qualquer obra
-- tem o seu, escopado pelo seletor de obra, como o resto do módulo DRE.
--
-- O QUE FAZ:
--   1. Cria as obras "WCR — Bertioga" e "WCR — Santos" (contrato em branco,
--      editável na tela de Projetos — o número não estava à mão).
--   2. fcp_obra.projeto_id → cada obra do FCP aponta para o projeto dono.
--      Backfill: BERTIOGA → WCR — Bertioga, SANTOS → WCR — Santos.
--   3. Backfill de caixa_lancamento.projeto_id e horas_extras.projeto_id
--      casando obra_texto com projetos.nome via norm_txt (aceita
--      "BOI MALHADO" e "WCR — Boi Malhado").
--
-- O frontend (useFcp/useCaixa) passou a receber o projeto ativo e filtrar
-- por ele; o webhook resolve a coluna "obra" para projeto_id do mesmo jeito.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. As obras da Baixada, que não existiam no seletor ────────────────────
insert into public.projetos (nome, contrato, cliente, cidade, tipo, data_inicio, status)
select 'WCR — Bertioga', '', 'Consórcio / Sabesp — Baixada Santista', 'Bertioga (SP)', 'agua', '2026-08-24', 'ativo'
where not exists (select 1 from public.projetos where public.norm_txt(nome) = public.norm_txt('WCR — Bertioga'));

insert into public.projetos (nome, contrato, cliente, cidade, tipo, data_inicio, status)
select 'WCR — Santos', '', 'Consórcio / Sabesp — Baixada Santista', 'Santos (SP)', 'misto', '2026-08-24', 'ativo'
where not exists (select 1 from public.projetos where public.norm_txt(nome) = public.norm_txt('WCR — Santos'));

-- ── 2. Cada obra do FCP aponta para o projeto dono ─────────────────────────
alter table public.fcp_obra add column if not exists projeto_id uuid references public.projetos(id);
create index if not exists fcp_obra_projeto_idx on public.fcp_obra (projeto_id);

update public.fcp_obra o set projeto_id = p.id
  from public.projetos p
 where o.projeto_id is null
   and public.norm_txt(p.nome) = public.norm_txt('WCR — ' || o.nome);

-- ── 3. Lançamentos e horas extras ganham o projeto pela obra_texto ─────────
update public.caixa_lancamento l set projeto_id = p.id
  from public.projetos p
 where l.projeto_id is null and l.obra_texto is not null
   and (public.norm_txt(p.nome) = public.norm_txt(l.obra_texto)
     or public.norm_txt(p.nome) = public.norm_txt('WCR — ' || l.obra_texto));

update public.horas_extras h set projeto_id = p.id
  from public.projetos p
 where h.projeto_id is null and h.obra_texto is not null
   and (public.norm_txt(p.nome) = public.norm_txt(h.obra_texto)
     or public.norm_txt(p.nome) = public.norm_txt('WCR — ' || h.obra_texto));

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Esperado: toda fcp_obra com projeto preenchido.
select o.nome as obra_fcp, coalesce(p.nome, '— SEM PROJETO (!)') as projeto
  from public.fcp_obra o left join public.projetos p on p.id = o.projeto_id
 order by o.nome;
