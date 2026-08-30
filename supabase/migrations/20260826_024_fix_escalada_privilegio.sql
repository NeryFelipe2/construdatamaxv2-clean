-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION 024 — CORREÇÃO DE ESCALADA DE PRIVILÉGIO + RECURSÃO DE RLS
-- ConstruData · 26/08/2026 · APLICADA em produção em 26/08/2026
--
-- Corrige 4 defeitos introduzidos na 023 (e 1 que vinha desde a 001), todos
-- encontrados na revisão adversarial logo depois de aplicar. Os três primeiros
-- estavam VIVOS em produção com 5 contas já criadas.
--
-- ── (a) ESCALADA VIA RPC — crítico ─────────────────────────────────────────
--   aplicar_convite(uuid,text) é SECURITY DEFINER, não checa quem chamou, e
--   nasceu com EXECUTE para PUBLIC (default do Postgres). A anon key vai no
--   bundle do frontend, então qualquer pessoa na internet podia:
--     POST /rest/v1/rpc/aplicar_convite
--     {"p_user_id":"<id dela>","p_email":"joaodsouzanery@gmail.com"}
--   e virar admin global de todas as empresas, sem nem estar logada.
--   Correção: EXECUTE só para o dono (o trigger roda como dono) e service_role.
--
-- ── (b) LEITURA E ESCRITA DA LISTA DE ACESSOS POR QUEM NÃO DEVIA ───────────
--   A policy de convites_acesso usava can_write_org(), que inclui 'gestor' e
--   'membro'. Willian/Bruno/Sérgio liam a lista inteira de e-mails autorizados
--   e podiam inserir convite para si com is_global_admin = true.
--   Correção: gestão de acesso é owner/admin, igual à orgmem_write da 001.
--
-- ── (c) OWNER DE UMA EMPRESA CRIANDO ADMIN GLOBAL ──────────────────────────
--   Mesmo restrita a owner/admin, a policy não olhava a COLUNA is_global_admin.
--   Um owner de UMA empresa gravava convite com is_global_admin = true, pedia
--   magic link (signInWithOtp cria a conta) e virava owner de TODAS.
--   Correção: WITH CHECK exige ser admin global para marcar is_global_admin.
--
-- ── (d) RECURSÃO INFINITA DE RLS (42P17) ───────────────────────────────────
--   Consultar organization_members com EXISTS DENTRO de uma policy dispara a
--   policy da própria tabela → recursão infinita. A orgmem_write da 001 já
--   tinha esse defeito; só não estourava porque nunca houve usuário logado.
--   Sintoma: QUALQUER usuário autenticado tomaria erro 42P17 ao mexer em
--   membros — o app inteiro quebraria no primeiro login real.
--   Correção: helper is_org_admin(uuid) SECURITY DEFINER, que ignora RLS.
--   É o mesmo motivo pelo qual can_access_org/can_write_org já eram DEFINER.
--
-- PROVA (rodada em produção com JWT simulado do Willian, membro da WCR):
--   ataque 1 — RPC aplicar_convite direta ....... BLOQUEADO (42501)
--   ataque 2 — inserir convite is_global_admin .. BLOQUEADO (42501)
--   ataque 3 — auto-promoção a owner ............ BLOQUEADO (0 linhas)
--   controle — ler a lista de e-mails ........... 0 linhas
--   controle — operar normalmente ............... 1 empresa, 100 pessoas ✓
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── (a) fechar a RPC ───────────────────────────────────────────────────────
revoke execute on function public.aplicar_convite(uuid, text) from public, anon, authenticated;

-- ── (d) helper que não recursa ─────────────────────────────────────────────
create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $fn$
  select public.is_global_admin()
      or exists (select 1 from public.organization_members m
                  where m.user_id = auth.uid() and m.org_id = p_org
                    and m.ativo and m.role in ('owner','admin'));
$fn$;
comment on function public.is_org_admin(uuid) is
  'É owner/admin desta empresa (ou admin global)? SECURITY DEFINER de propósito: '
  'chamar organization_members de dentro de uma policy sem isto causa recursão '
  'infinita (42P17).';
revoke execute on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to anon, authenticated, service_role;

-- ── (b) + (c) gestão de acesso é só owner/admin, e só global cria global ───
drop policy if exists convites_admin on public.convites_acesso;
create policy convites_admin on public.convites_acesso for all
  using ( public.is_org_admin(org_id) )
  with check ( public.is_org_admin(org_id)
               and (not is_global_admin or public.is_global_admin()) );

-- ── (d) mesma recursão na policy que vinha da 001 ──────────────────────────
drop policy if exists orgmem_write on public.organization_members;
create policy orgmem_write on public.organization_members for all
  using ( public.is_org_admin(org_id) ) with check ( public.is_org_admin(org_id) );

commit;

-- ── CONFERÊNCIA ────────────────────────────────────────────────────────────
-- Esperado: anon e authenticated NÃO executam aplicar_convite; service_role sim.
select 'anon executa aplicar_convite (esperado false)' item,
       has_function_privilege('anon','public.aplicar_convite(uuid,text)','execute')::text valor
union all select 'authenticated executa (esperado false)',
       has_function_privilege('authenticated','public.aplicar_convite(uuid,text)','execute')::text
union all select 'service_role executa (esperado true)',
       has_function_privilege('service_role','public.aplicar_convite(uuid,text)','execute')::text;

-- Teste de isolamento — troque o uuid por um usuário 'membro' e rode:
-- begin;
--   set local role authenticated;
--   set local request.jwt.claims to '{"sub":"<uuid do membro>","role":"authenticated"}';
--   select count(*) from public.convites_acesso;   -- esperado: 0
--   select count(*) from public.organizations;     -- esperado: só as dele
-- rollback;
