/**
 * admin-usuarios — a ÚNICA porta de gestão de contas do ConstruData.
 *
 * Hoje só dá pra criar gente pelo Dashboard do Supabase, e o pior: um usuário
 * NÃO-global criado "na mão" nasce sem nenhuma linha em organization_members,
 * então ao logar cai na tela "sua conta não está vinculada a nenhuma empresa" e
 * trava. Esta função resolve o ciclo inteiro (criar conta + vínculo + papel)
 * numa chamada só, e é a porta que a tela de Usuários do app consome.
 *
 * É a função MAIS PERIGOSA do sistema — ela cria contas e reseta senhas. Por
 * isso a autorização é feita com DOIS clients, e nunca se confunde um com o
 * outro:
 *
 *   sbAnon   → SÓ pra validar o JWT do chamador (auth.getUser(jwt)). É o
 *              GoTrue quem diz quem é a pessoa; nós não "acreditamos" em
 *              nenhum campo do body.
 *   sbAdmin  → service_role, SÓ pra executar o que já foi autorizado. NUNCA
 *              se usa service_role pra DECIDIR permissão (com service_role
 *              toda RLS é ignorada e qualquer select "dá certo").
 *
 * Contrato (POST JSON, verify_jwt = false — a auth é própria):
 *   header  Authorization: Bearer <jwt do usuário logado>
 *   'listar'   {}                                                → { ok, usuarios[], convites[] }
 *   'criar'    { email, nome?, orgId, role, isGlobalAdmin?, senhaTemporaria }
 *   'convidar' { email, nome?, orgId, role, isGlobalAdmin? }
 *   'papel'    { userId, orgId, role }
 *   'revogar'  { userId, orgId }        → ativo=false (NUNCA apaga o usuário)
 *   'senha'    { userId, novaSenha }
 *
 * Regras de ouro:
 *   - Sem JWT válido → 401. Sem permissão → 403. Sempre { ok: boolean, ... }.
 *   - Não-global só age na org onde é 'owner'/'admin' (vínculo ATIVO), e NUNCA
 *     concede/altera acesso global nem mexe na conta de um admin global.
 *   - Ninguém se tranca pra fora: não dá pra revogar/rebaixar a si mesmo, nem
 *     derrubar o ÚLTIMO owner ativo de uma organização.
 *   - 'criar' com e-mail que já existe NÃO falha e NÃO troca a senha do dono
 *     (senão um admin de obra sequestrava conta alheia "criando" de novo):
 *     só garante o vínculo e devolve jaExistia:true.
 *   - Senha/hash/service_role NUNCA aparecem na resposta nem no log.
 *
 * Molde: apontamento-webhook / importar-funcionarios (mesmo json(), CORS,
 * Deno.serve, imports jsr:@supabase/supabase-js@2).
 */
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── ENV ─────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

// ─── CORS / resposta ─────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  // x-region e x-supabase-api-version não são enviados na configuração atual do
  // supabase-js, mas um preflight recusado por header desconhecido chega no
  // frontend como "função não deployada" — diagnóstico errado. Liberar é grátis.
  'access-control-allow-headers':
    'authorization, apikey, content-type, x-client-info, x-region, x-supabase-api-version',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

/**
 * Erro com status HTTP. Toda validação/negativa lança isto e o handler
 * converte em { ok:false, error }. Assim nenhuma checagem de permissão pode
 * ser "esquecida" no caminho de volta — ou lança, ou a ação executou.
 */
class ErroHttp extends Error {
  status: number
  extra: Record<string, unknown>
  constructor(status: number, mensagem: string, extra: Record<string, unknown> = {}) {
    super(mensagem)
    this.name = 'ErroHttp'
    this.status = status
    this.extra = extra
  }
}

/**
 * Loga o detalhe REAL (só no log da função) e devolve um erro de mensagem
 * curada pro cliente. Mensagem de banco vaza nome de tabela/coluna/constraint
 * — não é pra chegar no navegador.
 */
function mascarar(contexto: string, e: unknown, mensagem: string, status = 400): ErroHttp {
  console.error(`[admin-usuarios] ${contexto}:`, e instanceof Error ? e.message : String(e))
  return new ErroHttp(status, mensagem)
}

/**
 * A TABELA não existe (migration ainda não aplicada) — não é erro de código.
 * Proposital: NÃO casa "column ... does not exist" (42703 / PGRST204), que é um
 * schema divergente e merece outra mensagem.
 */
function tabelaAusente(e: { code?: string; message?: string } | null | undefined): boolean {
  if (!e) return false
  const code = e.code ?? ''
  const msg = (e.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    msg.includes('could not find the table')
  )
}

// ─── validação de entrada ────────────────────────────────────────────────────

const ROLES = ['owner', 'admin', 'gestor', 'membro', 'leitor'] as const
type OrgRole = (typeof ROLES)[number]

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SENHA_MIN = 8
const SENHA_MAX = 72 // o bcrypt do GoTrue trunca acima de 72 bytes — melhor recusar do que enganar

const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/** e-mail sempre normalizado (trim + minúsculas) — é a chave de busca e do convite. */
function validarEmail(v: unknown): string {
  const email = txt(v).toLowerCase()
  if (!email) throw new ErroHttp(400, 'Informe o e-mail.')
  if (email.length > 254 || !RE_EMAIL.test(email)) throw new ErroHttp(400, `E-mail inválido: "${email}".`)
  return email
}

function validarUuid(v: unknown, campo: string): string {
  const s = txt(v)
  if (!s) throw new ErroHttp(400, `Informe ${campo}.`)
  if (!RE_UUID.test(s)) throw new ErroHttp(400, `${campo} inválido (esperado um UUID).`)
  return s
}

function validarRole(v: unknown): OrgRole {
  const r = txt(v).toLowerCase()
  if ((ROLES as readonly string[]).includes(r)) return r as OrgRole
  throw new ErroHttp(400, `Papel inválido. Use um destes: ${ROLES.join(', ')}.`)
}

/**
 * Senha: mínimo 8, máximo 72 BYTES. Nunca logamos nem devolvemos o valor —
 * daqui pra frente ela só viaja pro GoTrue.
 */
function validarSenha(v: unknown, rotulo: string): string {
  const senha = typeof v === 'string' ? v : ''
  if (senha.length < SENHA_MIN) {
    throw new ErroHttp(400, `${rotulo} precisa ter pelo menos ${SENHA_MIN} caracteres.`)
  }
  if (new TextEncoder().encode(senha).length > SENHA_MAX) {
    throw new ErroHttp(400, `${rotulo} é longa demais (limite de ${SENHA_MAX} caracteres).`)
  }
  return senha
}

/** nome é opcional em todo lugar; string vazia vira null. */
const nomeOpcional = (v: unknown): string | null => txt(v).slice(0, 200) || null

// ─── quem está chamando ──────────────────────────────────────────────────────

interface Chamador {
  userId: string
  email: string
  nome: string | null
  isGlobalAdmin: boolean
  /** org_id → papel, considerando SÓ vínculos ativos. */
  papeis: Map<string, OrgRole>
}

/**
 * Identifica o chamador. O JWT é validado pelo client ANON (é o GoTrue que
 * autentica); só DEPOIS o service_role é usado pra ler o perfil e os vínculos.
 */
async function identificarChamador(
  req: Request,
  sbAnon: SupabaseClient,
  sbAdmin: SupabaseClient,
): Promise<Chamador> {
  const header = req.headers.get('authorization') ?? ''
  const m = header.match(/^Bearer\s+(.+)$/i)
  const jwt = m ? m[1].trim() : ''
  if (!jwt) throw new ErroHttp(401, 'Faça login: token de acesso ausente na requisição.')

  // O supabase-js manda a ANON KEY no Authorization quando NÃO há sessão. Isso
  // não é uma pessoa — recusamos explicitamente pra a mensagem ser útil (o
  // getUser também recusaria, mas com erro genérico).
  if (ANON_KEY && jwt === ANON_KEY) {
    throw new ErroHttp(401, 'Nenhum usuário logado — entre com e-mail e senha antes de gerenciar contas.')
  }

  const { data: authData, error: authErr } = await sbAnon.auth.getUser(jwt)
  const user = authData?.user ?? null
  if (authErr || !user) throw new ErroHttp(401, 'Sessão inválida ou expirada — entre de novo.')

  const emailChamador = (user.email ?? '').toLowerCase()

  // Perfil (fonte da verdade do acesso global).
  const { data: perfil, error: ePerfil } = await sbAdmin
    .from('profiles')
    .select('id, email, full_name, is_global_admin, ativo')
    .eq('id', user.id)
    .maybeSingle()
  if (ePerfil) throw mascarar('perfil do chamador', ePerfil, 'Não foi possível conferir o seu perfil de acesso.', 500)

  const p = perfil as
    | { id: string; email: string | null; full_name: string | null; is_global_admin: boolean | null; ativo: boolean | null }
    | null

  if (p && p.ativo === false) throw new ErroHttp(403, 'Sua conta está desativada. Fale com um administrador.')

  let isGlobalAdmin = p?.is_global_admin === true

  // Rede de segurança ESTREITA: só quando NÃO existe linha em profiles (o
  // trigger handle_new_user_v2 não rodou, ex.: conta anterior ao trigger) é que
  // caímos na pré-aprovação global_admin_emails — a MESMA fonte que o trigger
  // lê. Se o perfil existe, profiles.is_global_admin é soberano: quem foi
  // rebaixado de propósito continua rebaixado.
  if (!p && emailChamador) {
    const { data: pre, error: ePre } = await sbAdmin.from('global_admin_emails').select('email')
    if (ePre) console.error('[admin-usuarios] global_admin_emails:', ePre.message)
    isGlobalAdmin = ((pre ?? []) as { email: string }[]).some(
      (r) => (r.email ?? '').toLowerCase() === emailChamador,
    )
  }

  const { data: vincs, error: eVinc } = await sbAdmin
    .from('organization_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('ativo', true)
  if (eVinc) throw mascarar('vínculos do chamador', eVinc, 'Não foi possível conferir as suas organizações.', 500)

  const papeis = new Map<string, OrgRole>()
  for (const v of (vincs ?? []) as { org_id: string; role: OrgRole }[]) papeis.set(v.org_id, v.role)

  return {
    userId: user.id,
    email: emailChamador,
    nome: p?.full_name ?? null,
    isGlobalAdmin,
    papeis,
  }
}

// ─── autorização (as travas) ─────────────────────────────────────────────────

/** Rótulo humano do chamador, pro histórico em convites/pré-aprovações. */
function identidade(c: Chamador): string {
  const contato = c.email || c.userId
  return c.nome ? `${c.nome} <${contato}>` : contato
}

/** orgs onde o chamador é owner/admin — o escopo de tudo que ele pode fazer. */
function orgsQueAdministra(c: Chamador): string[] {
  return [...c.papeis.entries()].filter(([, p]) => p === 'owner' || p === 'admin').map(([id]) => id)
}

function exigirAdminDaOrg(c: Chamador, orgId: string): void {
  if (c.isGlobalAdmin) return
  const p = c.papeis.get(orgId)
  if (p === 'owner' || p === 'admin') return
  throw new ErroHttp(403, 'Você não administra esta organização.')
}

/** owner é o topo da org: só outro owner (ou admin global) cria owner. */
function exigirPodeConcederOwner(c: Chamador, orgId: string, role: OrgRole): void {
  if (role !== 'owner') return
  if (c.isGlobalAdmin || c.papeis.get(orgId) === 'owner') return
  throw new ErroHttp(403, 'Somente um owner da organização (ou um admin global) pode definir outro owner.')
}

/** acesso global só é concedido por quem já é global. */
function exigirPodeConcederGlobal(c: Chamador, pedido: boolean): void {
  if (!pedido || c.isGlobalAdmin) return
  throw new ErroHttp(403, 'Somente um admin global pode conceder acesso global (isGlobalAdmin).')
}

/**
 * Um admin de organização NÃO mexe na conta de um admin global (papel, revoga,
 * senha). Senão o admin de uma obra resetaria a senha do dono do sistema e
 * assumiria tudo.
 */
function exigirPodeMexerEmGlobal(c: Chamador, alvoEhGlobal: boolean): void {
  if (!alvoEhGlobal || c.isGlobalAdmin) return
  throw new ErroHttp(403, 'Somente um admin global pode alterar a conta de outro admin global.')
}

/**
 * Dentro da organização, 'owner' está ACIMA de 'admin': só outro owner (ou um
 * admin global) mexe na conta de um owner. Sem isto o 'admin' da WCR reseta a
 * senha do owner, entra na conta dele e assume a empresa — a mesma escalada
 * que exigirPodeConcederOwner já barra na hora de CRIAR um owner.
 */
function exigirPodeMexerEmOwner(c: Chamador, orgId: string, papelAtivoDoAlvo: OrgRole | null): void {
  if (papelAtivoDoAlvo !== 'owner') return
  if (c.isGlobalAdmin || c.papeis.get(orgId) === 'owner') return
  throw new ErroHttp(403, 'Somente um owner da organização (ou um admin global) pode alterar a conta de outro owner.')
}

/**
 * Antitranca: ninguém se revoga nem se rebaixa a ponto de perder a
 * administração — não há outro caminho de volta dentro do app. Admin global
 * está livre: o acesso dele não vem do vínculo.
 */
function exigirNaoSeTrancarFora(c: Chamador, alvoUserId: string, novoPapel: OrgRole | null): void {
  if (alvoUserId !== c.userId || c.isGlobalAdmin) return
  if (novoPapel === 'owner' || novoPapel === 'admin') return
  throw new ErroHttp(
    409,
    novoPapel === null
      ? 'Você não pode revogar o seu próprio acesso — peça a outro administrador.'
      : 'Você não pode rebaixar o seu próprio papel e perder a administração — peça a outro administrador.',
  )
}

async function contarOwnersAtivos(sb: SupabaseClient, orgId: string): Promise<number> {
  const { count, error } = await sb
    .from('organization_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('role', 'owner')
    .eq('ativo', true)
  if (error) throw mascarar('contar owners', error, 'Não foi possível conferir os owners da organização.')
  return count ?? 0
}

/**
 * Uma organização não pode ficar SEM owner ativo — seria uma org órfã, que só
 * um admin global consegue destravar. `papelAtual` só é 'owner' quando o
 * vínculo está ATIVO (um owner já revogado não conta).
 */
async function exigirNaoRemoveUltimoOwner(
  sb: SupabaseClient,
  orgId: string,
  papelAtual: OrgRole | null,
  novoPapel: OrgRole | null,
): Promise<void> {
  if (papelAtual !== 'owner' || novoPapel === 'owner') return
  if ((await contarOwnersAtivos(sb, orgId)) <= 1) {
    throw new ErroHttp(
      409,
      'Esta pessoa é o último owner ativo da organização — promova outro owner antes de rebaixar ou revogar.',
    )
  }
}

// ─── leituras auxiliares ─────────────────────────────────────────────────────

interface Org {
  id: string
  nome: string
  ativo: boolean | null
}

async function buscarOrg(sb: SupabaseClient, orgId: string): Promise<Org> {
  const { data, error } = await sb.from('organizations').select('id, nome, ativo').eq('id', orgId).maybeSingle()
  if (error) throw mascarar('buscar organização', error, 'Não foi possível consultar a organização.')
  // 422, e não 404, DE PROPÓSITO: o hook useUsuarios trata QUALQUER 404 como
  // "a função ainda não está no ar" (é assim que o gateway responde a uma
  // função não deployada). Um 404 de negócio faria a tela mentir sobre o deploy.
  if (!data) throw new ErroHttp(422, 'Organização não encontrada.')
  return data as Org
}

interface Vinculo {
  id: string
  role: OrgRole
  ativo: boolean
}

async function buscarVinculo(sb: SupabaseClient, orgId: string, userId: string): Promise<Vinculo | null> {
  const { data, error } = await sb
    .from('organization_members')
    .select('id, role, ativo')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw mascarar('buscar vínculo', error, 'Não foi possível consultar o vínculo com a organização.')
  return (data as Vinculo | null) ?? null
}

interface Perfil {
  id: string
  email: string | null
  full_name: string | null
  is_global_admin: boolean | null
  ativo: boolean | null
}

async function buscarPerfil(sb: SupabaseClient, userId: string): Promise<Perfil | null> {
  const { data, error } = await sb
    .from('profiles')
    .select('id, email, full_name, is_global_admin, ativo')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw mascarar('buscar perfil', error, 'Não foi possível consultar o perfil da pessoa.')
  return (data as Perfil | null) ?? null
}

/** O e-mail está pré-aprovado como admin global? (mesma fonte que o trigger lê) */
async function emailPreAprovadoGlobal(sb: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await sb.from('global_admin_emails').select('email')
  if (error) {
    console.error('[admin-usuarios] global_admin_emails (alvo):', error.message)
    return false
  }
  return ((data ?? []) as { email: string | null }[]).some((r) => (r.email ?? '').trim().toLowerCase() === email)
}

/** Existe convite marcando este e-mail como admin global? (só admin global consegue gravar isso) */
async function emailConvidadoComoGlobal(sb: SupabaseClient, email: string): Promise<boolean> {
  const { data, error } = await sb
    .from('convites_acesso')
    .select('email, is_global_admin')
    .eq('email', email)
    .eq('is_global_admin', true)
    .limit(1)
  if (error) {
    if (!tabelaAusente(error)) console.error('[admin-usuarios] convites_acesso (alvo):', error.message)
    return false
  }
  return (data ?? []).length > 0
}

/**
 * O ALVO é admin global?
 *
 * profiles.is_global_admin é a fonte soberana, MAS ela pode simplesmente NÃO
 * EXISTIR: o trigger handle_new_user_v2 engole (de propósito) a falha ao criar
 * o profile pra não impedir o nascimento da conta, e o vínculo de owner sai
 * mesmo assim. Nesse buraco, `perfil?.is_global_admin === true` dava FALSE para
 * o dono do sistema e um admin de obra podia resetar a senha dele.
 *
 * Então, quando não há perfil (ou ele diz que não), conferimos as MESMAS fontes
 * que o trigger usa pra decidir global: global_admin_emails e um convite
 * marcado como global (que só um admin global consegue gravar). Só é apurado
 * quando o chamador NÃO é global — pra um chamador global a resposta não muda
 * nada e não vale a viagem ao banco.
 */
async function alvoEhGlobalAdmin(
  sb: SupabaseClient,
  c: Chamador,
  perfilAlvo: Perfil | null,
  userId: string | null,
  emailConhecido?: string | null,
): Promise<boolean> {
  if (c.isGlobalAdmin) return false
  if (perfilAlvo?.is_global_admin === true) return true

  let email = (perfilAlvo?.email ?? emailConhecido ?? '').trim().toLowerCase()
  if (!email && userId) {
    // Sem perfil e sem e-mail em mãos: o Auth é o único lugar que sabe.
    const u = (await listarUsuariosAuth(sb)).find((x) => x.id === userId)
    email = u?.email ?? ''
  }
  if (!email) return false

  if (await emailPreAprovadoGlobal(sb, email)) return true
  return await emailConvidadoComoGlobal(sb, email)
}

const MAX_PAGINAS_AUTH = 20
const AUTH_PAGE_SIZE = 1000

interface UsuarioAuth {
  id: string
  email: string
  criadoEm: string | null
  ultimoLogin: string | null
}

/** Varre auth.users (paginado). Só id/e-mail/datas — nunca senha nem hash. */
async function listarUsuariosAuth(sb: SupabaseClient): Promise<UsuarioAuth[]> {
  const out: UsuarioAuth[] = []
  for (let page = 1; page <= MAX_PAGINAS_AUTH; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: AUTH_PAGE_SIZE })
    if (error) throw mascarar('listUsers', error, 'Não foi possível listar as contas de acesso.')
    const users = data?.users ?? []
    for (const u of users) {
      out.push({
        id: u.id,
        email: (u.email ?? '').toLowerCase(),
        criadoEm: u.created_at ?? null,
        ultimoLogin: (u as { last_sign_in_at?: string | null }).last_sign_in_at ?? null,
      })
    }
    if (users.length < AUTH_PAGE_SIZE) break
  }
  return out
}

/**
 * Acha a conta pelo e-mail. Tenta profiles primeiro (espelho barato do
 * auth.users mantido pelo trigger) e só cai na varredura do Auth se não achar
 * — assim contas antigas, sem perfil, também são encontradas.
 */
async function acharUsuarioPorEmail(sb: SupabaseClient, email: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await sb.from('profiles').select('id, email').eq('email', email).limit(1)
  if (error) console.error('[admin-usuarios] profiles por e-mail:', error.message)
  const achado = ((data ?? []) as { id: string; email: string | null }[])[0]
  if (achado) return { id: achado.id, email: (achado.email ?? email).toLowerCase() }

  const todos = await listarUsuariosAuth(sb)
  const u = todos.find((x) => x.email === email)
  return u ? { id: u.id, email: u.email } : null
}

// ─── escritas auxiliares ─────────────────────────────────────────────────────

/**
 * Garante a linha em profiles. O trigger handle_new_user_v2 já faz isso em
 * contas novas; aqui é só a rede pra conta ANTIGA (criada antes do trigger).
 * NÃO toca em is_global_admin — promoção global é decisão explícita, feita
 * separadamente por quem tem direito.
 */
async function garantirPerfil(
  sb: SupabaseClient,
  userId: string,
  email: string,
  nome: string | null,
): Promise<string | null> {
  const linha: Record<string, unknown> = { id: userId, email }
  if (nome) linha.full_name = nome
  const { error } = await sb.from('profiles').upsert(linha, { onConflict: 'id' })
  if (error) {
    console.error('[admin-usuarios] upsert profiles:', error.message)
    return 'A conta foi criada, mas o perfil (nome) não pôde ser gravado — ajuste depois na tela de usuários.'
  }
  return null
}

/**
 * Define a empresa padrão SE ainda não houver nenhuma. Era metade do problema
 * original: o trigger só preenche org_padrao_id de admin global, então o
 * pessoal de obra nascia com null. Nunca sobrescreve uma escolha existente.
 */
async function definirOrgPadraoSeVazio(sb: SupabaseClient, userId: string, orgId: string): Promise<void> {
  const { data, error } = await sb.from('profiles').select('org_padrao_id').eq('id', userId).maybeSingle()
  if (error || !data) {
    if (error) console.error('[admin-usuarios] ler org_padrao_id:', error.message)
    return
  }
  if ((data as { org_padrao_id: string | null }).org_padrao_id) return
  const { error: eUp } = await sb.from('profiles').update({ org_padrao_id: orgId }).eq('id', userId)
  if (eUp) console.error('[admin-usuarios] definir org_padrao_id:', eUp.message) // cosmético, não falha a ação
}

/**
 * Promove a admin global: profiles.is_global_admin = true E a pré-aprovação em
 * global_admin_emails (é dali que o trigger lê se a conta for recriada um dia).
 * Nunca REBAIXA ninguém — despromoção não faz parte deste contrato.
 */
async function promoverGlobal(
  sb: SupabaseClient,
  userId: string,
  email: string,
  concedidoPor: string,
): Promise<string[]> {
  const avisos: string[] = []
  const { error: eProf } = await sb.from('profiles').update({ is_global_admin: true }).eq('id', userId)
  if (eProf) {
    console.error('[admin-usuarios] promover global (profiles):', eProf.message)
    avisos.push('Não foi possível marcar a conta como admin global — tente de novo.')
  }
  const { error: ePre } = await sb
    .from('global_admin_emails')
    .upsert({ email, observacao: `concedido via admin-usuarios por ${concedidoPor}` }, {
      onConflict: 'email',
      ignoreDuplicates: true,
    })
  if (ePre) {
    console.error('[admin-usuarios] promover global (global_admin_emails):', ePre.message)
    avisos.push('O acesso global foi aplicado, mas a pré-aprovação por e-mail não foi registrada.')
  }
  return avisos
}

/** Pré-aprova o e-mail como global ANTES de a conta existir (o trigger lê daqui). */
async function preAprovarGlobal(sb: SupabaseClient, email: string, concedidoPor: string): Promise<string | null> {
  const { error } = await sb
    .from('global_admin_emails')
    .upsert({ email, observacao: `pré-aprovado via admin-usuarios por ${concedidoPor}` }, {
      onConflict: 'email',
      ignoreDuplicates: true,
    })
  if (error) {
    console.error('[admin-usuarios] pré-aprovar global:', error.message)
    return 'Não foi possível registrar a pré-aprovação de acesso global para este e-mail.'
  }
  return null
}

interface ResultadoConvite {
  ausente: boolean
  aviso: string | null
}

/**
 * Registra a autorização prévia em convites_acesso (email PK). Upsert: a
 * autorização MAIS RECENTE para um e-mail vence a anterior.
 *
 * DEGRADAÇÃO ELEGANTE: a migration que cria a tabela é de outra frente. Se ela
 * ainda não estiver aplicada, isto NÃO estoura — devolve ausente:true e o
 * chamador decide (em 'criar' vira só um aviso, porque a conta e o vínculo já
 * foram feitos de verdade; em 'convidar' é fatal, porque não sobra nada).
 */
async function registrarConvite(
  sb: SupabaseClient,
  args: {
    email: string
    nome: string | null
    orgId: string
    role: OrgRole
    isGlobalAdmin: boolean
    criadoPor: string
    observacao: string
    usado: boolean
  },
): Promise<ResultadoConvite> {
  const { error } = await sb.from('convites_acesso').upsert(
    {
      email: args.email,
      nome: args.nome,
      org_id: args.orgId,
      role: args.role,
      is_global_admin: args.isGlobalAdmin,
      observacao: args.observacao,
      criado_por: args.criadoPor,
      usado_em: args.usado ? new Date().toISOString() : null,
    },
    { onConflict: 'email' },
  )
  if (!error) return { ausente: false, aviso: null }
  if (tabelaAusente(error)) {
    console.error('[admin-usuarios] convites_acesso ausente:', error.message)
    return {
      ausente: true,
      aviso: 'A tabela convites_acesso ainda não existe no banco (migration pendente).',
    }
  }
  console.error('[admin-usuarios] gravar convite:', error.message)
  return { ausente: false, aviso: 'A autorização prévia não pôde ser registrada em convites_acesso.' }
}

/** Cria ou reativa o vínculo com o papel pedido. Assume que as travas já rodaram. */
async function aplicarVinculo(
  sb: SupabaseClient,
  orgId: string,
  userId: string,
  role: OrgRole,
  atual: Vinculo | null,
): Promise<void> {
  if (atual) {
    const { error } = await sb.from('organization_members').update({ role, ativo: true }).eq('id', atual.id)
    if (error) throw mascarar('atualizar vínculo', error, 'Não foi possível atualizar o vínculo com a organização.')
    return
  }
  const { error } = await sb.from('organization_members').insert({ org_id: orgId, user_id: userId, role, ativo: true })
  if (error) throw mascarar('criar vínculo', error, 'Não foi possível vincular a pessoa à organização.')
}

// ─── ação: listar ────────────────────────────────────────────────────────────

/**
 * Panorama pra tela de Usuários. Admin global vê todo mundo; admin de org vê
 * SÓ quem tem vínculo nas orgs que ele administra — e mesmo desses, só os
 * vínculos DESSAS orgs (não vazamos em que outras empresas a pessoa está).
 */
async function acaoListar(sb: SupabaseClient, c: Chamador): Promise<Response> {
  const escopo = c.isGlobalAdmin ? null : orgsQueAdministra(c)
  if (escopo && escopo.length === 0) {
    throw new ErroHttp(403, 'Você não administra nenhuma organização.')
  }

  const { data: orgsRows, error: eOrgs } = await sb.from('organizations').select('id, nome')
  if (eOrgs) throw mascarar('listar organizações', eOrgs, 'Não foi possível carregar as organizações.')
  const nomeOrg = new Map<string, string>()
  for (const o of (orgsRows ?? []) as { id: string; nome: string }[]) nomeOrg.set(o.id, o.nome)

  let qVinc = sb.from('organization_members').select('user_id, org_id, role, ativo')
  if (escopo) qVinc = qVinc.in('org_id', escopo)
  const { data: vincRows, error: eVinc } = await qVinc
  if (eVinc) throw mascarar('listar vínculos', eVinc, 'Não foi possível carregar os vínculos.')

  const porUsuario = new Map<string, { orgId: string; orgNome: string; role: OrgRole; ativo: boolean }[]>()
  for (const v of (vincRows ?? []) as { user_id: string; org_id: string; role: OrgRole; ativo: boolean }[]) {
    const lista = porUsuario.get(v.user_id) ?? []
    lista.push({
      orgId: v.org_id,
      orgNome: nomeOrg.get(v.org_id) ?? '(organização desconhecida)',
      role: v.role,
      ativo: v.ativo !== false,
    })
    porUsuario.set(v.user_id, lista)
  }

  // Escopo de organização sem nenhum vínculo: não há o que buscar (e um
  // `.in('id', [])` é um filtro degenerado que nem vale a viagem ao banco).
  const perfis = new Map<string, Perfil>()
  if (!escopo || porUsuario.size > 0) {
    let qPerfis = sb.from('profiles').select('id, email, full_name, is_global_admin, ativo')
    if (escopo) qPerfis = qPerfis.in('id', [...porUsuario.keys()])
    const { data: perfilRows, error: ePerfis } = await qPerfis
    if (ePerfis) throw mascarar('listar perfis', ePerfis, 'Não foi possível carregar os perfis.')
    for (const p of (perfilRows ?? []) as Perfil[]) perfis.set(p.id, p)
  }

  // datas de conta/último login só existem no Auth (varredura só se há alvo)
  const auth = new Map<string, UsuarioAuth>()
  if (!escopo || porUsuario.size > 0) {
    for (const u of await listarUsuariosAuth(sb)) auth.set(u.id, u)
  }

  // universo: no escopo global é todo mundo (Auth ∪ profiles); senão, só quem
  // tem vínculo nas orgs administradas.
  const alvos = new Set<string>(
    escopo ? [...porUsuario.keys()] : [...auth.keys(), ...perfis.keys()],
  )

  const usuarios = [...alvos].map((id) => {
    const p = perfis.get(id)
    const a = auth.get(id)
    return {
      userId: id,
      email: (p?.email ?? a?.email ?? '').toLowerCase(),
      nome: p?.full_name ?? null,
      isGlobalAdmin: p?.is_global_admin === true,
      ativo: p?.ativo !== false,
      ultimoLogin: a?.ultimoLogin ?? null,
      criadoEm: a?.criadoEm ?? null,
      orgs: porUsuario.get(id) ?? [],
    }
  })
  usuarios.sort((x, y) => (x.nome ?? x.email).localeCompare(y.nome ?? y.email, 'pt-BR'))

  // convites pendentes (ainda não usados)
  const avisos: string[] = []
  let convites: {
    email: string
    nome: string | null
    orgId: string | null
    orgNome: string | null
    role: OrgRole
    isGlobalAdmin: boolean
    criadoEm: string | null
  }[] = []

  let qConv = sb
    .from('convites_acesso')
    .select('email, nome, org_id, role, is_global_admin, criado_em, usado_em')
    .is('usado_em', null)
  if (escopo) qConv = qConv.in('org_id', escopo)
  const { data: convRows, error: eConv } = await qConv
  if (eConv) {
    if (tabelaAusente(eConv)) {
      avisos.push('A tabela convites_acesso ainda não existe (migration pendente) — a lista de convites veio vazia.')
    } else {
      console.error('[admin-usuarios] listar convites:', eConv.message)
      avisos.push('Não foi possível carregar os convites pendentes.')
    }
  } else {
    convites = ((convRows ?? []) as {
      email: string
      nome: string | null
      org_id: string | null
      role: OrgRole
      is_global_admin: boolean | null
      criado_em: string | null
    }[]).map((r) => ({
      email: r.email,
      nome: r.nome,
      orgId: r.org_id,
      orgNome: r.org_id ? nomeOrg.get(r.org_id) ?? null : null,
      role: r.role,
      isGlobalAdmin: r.is_global_admin === true,
      criadoEm: r.criado_em,
    }))
  }

  return json({
    ok: true,
    escopo: escopo ? 'organizacao' : 'global',
    usuarios,
    convites,
    ...(avisos.length ? { avisos } : {}),
  })
}

// ─── ação: criar ─────────────────────────────────────────────────────────────

interface CorpoCriar {
  email?: unknown
  nome?: unknown
  orgId?: unknown
  role?: unknown
  isGlobalAdmin?: unknown
  senhaTemporaria?: unknown
}

/**
 * Cria a conta JÁ CONFIRMADA (email_confirm: true — nada de link de e-mail que
 * o pessoal de obra não abre) e o vínculo, numa tacada só.
 *
 * E-mail já existente NÃO é erro: garantimos o vínculo e devolvemos
 * jaExistia:true. E de propósito NÃO trocamos a senha nesse caso — trocar seria
 * um sequestro de conta disfarçado de "criar". Pra isso existe a ação 'senha',
 * que tem as suas próprias travas.
 */
async function acaoCriar(sb: SupabaseClient, c: Chamador, body: CorpoCriar): Promise<Response> {
  const email = validarEmail(body.email)
  const nome = nomeOpcional(body.nome)
  const orgId = validarUuid(body.orgId, 'a organização (orgId)')
  const role = validarRole(body.role)
  const querGlobal = body.isGlobalAdmin === true
  const senha = validarSenha(body.senhaTemporaria, 'A senha temporária')

  exigirPodeConcederGlobal(c, querGlobal)
  exigirAdminDaOrg(c, orgId)
  exigirPodeConcederOwner(c, orgId, role)
  const org = await buscarOrg(sb, orgId)

  // ANTES de tocar no Auth: o e-mail pode ser o de um admin global (com ou sem
  // perfil). Um admin de obra não "cria de novo" a conta do dono do sistema —
  // e o registro do convite abaixo rebaixaria a pré-aprovação global dele.
  if (!c.isGlobalAdmin && (await alvoEhGlobalAdmin(sb, c, null, null, email))) {
    throw new ErroHttp(403, 'Somente um admin global pode alterar a conta de outro admin global.')
  }

  const avisos: string[] = []
  if (org.ativo === false) avisos.push(`Atenção: a organização ${org.nome} está marcada como inativa.`)
  let userId: string
  let jaExistia = false

  const { data: criado, error: eCriar } = await sb.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: nome ? { full_name: nome } : {},
  })

  if (eCriar || !criado?.user?.id) {
    // Pode ser "e-mail já cadastrado" (caminho feliz do contrato) ou uma falha
    // de verdade. Só sabemos procurando a conta.
    const existente = await acharUsuarioPorEmail(sb, email)
    if (!existente) {
      throw mascarar(
        'createUser',
        eCriar ?? new Error('createUser sem usuário'),
        'Não foi possível criar a conta. Confira o e-mail e a senha temporária e tente de novo.',
      )
    }
    userId = existente.id
    jaExistia = true
  } else {
    userId = criado.user.id
  }

  // Conta pré-existente pode ser de um admin global — um admin de org não mexe.
  if (jaExistia) {
    const perfilAlvo = await buscarPerfil(sb, userId)
    exigirPodeMexerEmGlobal(c, await alvoEhGlobalAdmin(sb, c, perfilAlvo, userId, email))
  }

  const avisoPerfil = await garantirPerfil(sb, userId, email, nome)
  if (avisoPerfil) avisos.push(avisoPerfil)

  if (querGlobal) avisos.push(...(await promoverGlobal(sb, userId, email, identidade(c))))

  // Travas do vínculo (o alvo pode já ser owner desta org).
  const atual = await buscarVinculo(sb, orgId, userId)
  const papelAtivoAtual = atual && atual.ativo ? atual.role : null
  exigirPodeMexerEmOwner(c, orgId, papelAtivoAtual)
  await exigirNaoRemoveUltimoOwner(sb, orgId, papelAtivoAtual, role)
  exigirNaoSeTrancarFora(c, userId, role)
  await aplicarVinculo(sb, orgId, userId, role, atual)
  await definirOrgPadraoSeVazio(sb, userId, orgId)

  // Registro da autorização (já usada: a conta existe agora).
  const conv = await registrarConvite(sb, {
    email,
    nome,
    orgId,
    role,
    isGlobalAdmin: querGlobal,
    criadoPor: c.userId,
    observacao: `criado por ${identidade(c)}`,
    usado: true,
  })
  if (conv.aviso) {
    avisos.push(
      conv.ausente
        ? `${conv.aviso} A conta e o vínculo FORAM criados normalmente — só o histórico de convite não foi gravado.`
        : conv.aviso,
    )
  }

  return json({
    ok: true,
    jaExistia,
    userId,
    email,
    nome,
    orgId,
    orgNome: org.nome,
    role,
    isGlobalAdmin: querGlobal,
    mensagem: jaExistia
      ? `Esta conta já existia — o acesso a ${org.nome} foi garantido como ${role}. A senha atual dela NÃO foi alterada.`
      : `Conta criada e vinculada a ${org.nome} como ${role}. Entregue a senha temporária pessoalmente e peça a troca no primeiro acesso.`,
    ...(avisos.length ? { avisos } : {}),
  })
}

// ─── ação: convidar ──────────────────────────────────────────────────────────

interface CorpoConvidar {
  email?: unknown
  nome?: unknown
  orgId?: unknown
  role?: unknown
  isGlobalAdmin?: unknown
}

/**
 * Autorização prévia SEM criar conta: quando a pessoa aparecer no Auth (magic
 * link, convite do Dashboard, etc.), o trigger aplica o vínculo sozinho.
 *
 * Se a conta JÁ existe, um convite não faria nada (o trigger só roda em INSERT)
 * — então aplicamos o vínculo na hora e devolvemos aplicadoAgora:true.
 */
async function acaoConvidar(sb: SupabaseClient, c: Chamador, body: CorpoConvidar): Promise<Response> {
  const email = validarEmail(body.email)
  const nome = nomeOpcional(body.nome)
  const orgId = validarUuid(body.orgId, 'a organização (orgId)')
  const role = validarRole(body.role)
  const querGlobal = body.isGlobalAdmin === true

  exigirPodeConcederGlobal(c, querGlobal)
  exigirAdminDaOrg(c, orgId)
  exigirPodeConcederOwner(c, orgId, role)
  const org = await buscarOrg(sb, orgId)

  const avisos: string[] = []
  if (org.ativo === false) avisos.push(`Atenção: a organização ${org.nome} está marcada como inativa.`)

  // Mesmo raciocínio do 'criar': o e-mail pode ser o de um admin global (com ou
  // sem perfil), e o convite gravado abaixo rebaixaria a pré-aprovação dele.
  if (!c.isGlobalAdmin && (await alvoEhGlobalAdmin(sb, c, null, null, email))) {
    throw new ErroHttp(403, 'Somente um admin global pode alterar a conta de outro admin global.')
  }

  const existente = await acharUsuarioPorEmail(sb, email)

  if (existente) {
    const perfilAlvo = await buscarPerfil(sb, existente.id)
    exigirPodeMexerEmGlobal(c, await alvoEhGlobalAdmin(sb, c, perfilAlvo, existente.id, email))

    if (querGlobal) avisos.push(...(await promoverGlobal(sb, existente.id, email, identidade(c))))

    const atual = await buscarVinculo(sb, orgId, existente.id)
    const papelAtivoAtual = atual && atual.ativo ? atual.role : null
    exigirPodeMexerEmOwner(c, orgId, papelAtivoAtual)
    await exigirNaoRemoveUltimoOwner(sb, orgId, papelAtivoAtual, role)
    exigirNaoSeTrancarFora(c, existente.id, role)
    await aplicarVinculo(sb, orgId, existente.id, role, atual)
    await definirOrgPadraoSeVazio(sb, existente.id, orgId)

    const conv = await registrarConvite(sb, {
      email,
      nome,
      orgId,
      role,
      isGlobalAdmin: querGlobal,
      criadoPor: c.userId,
      observacao: `vínculo aplicado na hora por ${identidade(c)} (conta já existia)`,
      usado: true,
    })
    if (conv.aviso) avisos.push(conv.aviso)

    return json({
      ok: true,
      aplicadoAgora: true,
      userId: existente.id,
      email,
      orgId,
      orgNome: org.nome,
      role,
      isGlobalAdmin: querGlobal,
      mensagem: `Esta conta já existe — o acesso a ${org.nome} como ${role} foi aplicado imediatamente.`,
      ...(avisos.length ? { avisos } : {}),
    })
  }

  // Conta ainda não existe: o convite É o produto. Gravamos ANTES de tocar em
  // global_admin_emails — se a tabela não existir, nada foi alterado.
  const conv = await registrarConvite(sb, {
    email,
    nome,
    orgId,
    role,
    isGlobalAdmin: querGlobal,
    criadoPor: c.userId,
    observacao: `convidado por ${identidade(c)}`,
    usado: false,
  })
  if (conv.ausente) {
    throw new ErroHttp(
      503,
      'Convites ainda não estão disponíveis: a tabela convites_acesso não existe no banco. Aplique a migration de convites, ou use a ação "criar" (que cria a conta com senha temporária na hora).',
    )
  }
  // Aqui o convite É o produto: se a gravação falhou, NÃO devolvemos ok:true
  // (seria um "convidado com sucesso" que não convidou ninguém).
  if (conv.aviso) {
    throw new ErroHttp(500, 'Não foi possível registrar a autorização prévia. Tente de novo em instantes.')
  }

  if (querGlobal) {
    const a = await preAprovarGlobal(sb, email, identidade(c))
    if (a) avisos.push(a)
  }

  return json({
    ok: true,
    aplicadoAgora: false,
    convite: { email, nome, orgId, orgNome: org.nome, role, isGlobalAdmin: querGlobal },
    mensagem: `Autorização registrada para ${email}. Assim que a conta for criada, o acesso a ${org.nome} como ${role} é aplicado automaticamente.`,
    ...(avisos.length ? { avisos } : {}),
  })
}

// ─── ação: papel ─────────────────────────────────────────────────────────────

async function acaoPapel(
  sb: SupabaseClient,
  c: Chamador,
  body: { userId?: unknown; orgId?: unknown; role?: unknown },
): Promise<Response> {
  const userId = validarUuid(body.userId, 'a pessoa (userId)')
  const orgId = validarUuid(body.orgId, 'a organização (orgId)')
  const role = validarRole(body.role)

  exigirAdminDaOrg(c, orgId)
  exigirPodeConcederOwner(c, orgId, role)
  const org = await buscarOrg(sb, orgId)

  const perfilAlvo = await buscarPerfil(sb, userId)
  exigirPodeMexerEmGlobal(c, await alvoEhGlobalAdmin(sb, c, perfilAlvo, userId))

  const atual = await buscarVinculo(sb, orgId, userId)
  // 422 pelo mesmo motivo de buscarOrg: 404 é lido pelo frontend como "função não deployada".
  if (!atual) throw new ErroHttp(422, `Esta pessoa não faz parte de ${org.nome}. Use "criar" ou "convidar" primeiro.`)

  const papelAtivoAtual = atual.ativo ? atual.role : null
  exigirPodeMexerEmOwner(c, orgId, papelAtivoAtual)
  await exigirNaoRemoveUltimoOwner(sb, orgId, papelAtivoAtual, role)
  exigirNaoSeTrancarFora(c, userId, role)

  // Definir papel também REATIVA o vínculo (dar papel = dar acesso).
  await aplicarVinculo(sb, orgId, userId, role, atual)

  return json({
    ok: true,
    userId,
    orgId,
    orgNome: org.nome,
    role,
    roleAnterior: atual.role,
    reativado: atual.ativo === false,
    mensagem: `Papel atualizado para ${role} em ${org.nome}.`,
  })
}

// ─── ação: revogar ───────────────────────────────────────────────────────────

/** Revogar = ativo:false. NUNCA apaga o usuário (histórico de RDO/medição fica). */
async function acaoRevogar(
  sb: SupabaseClient,
  c: Chamador,
  body: { userId?: unknown; orgId?: unknown },
): Promise<Response> {
  const userId = validarUuid(body.userId, 'a pessoa (userId)')
  const orgId = validarUuid(body.orgId, 'a organização (orgId)')

  exigirAdminDaOrg(c, orgId)
  const org = await buscarOrg(sb, orgId)

  const perfilAlvo = await buscarPerfil(sb, userId)
  exigirPodeMexerEmGlobal(c, await alvoEhGlobalAdmin(sb, c, perfilAlvo, userId))

  const atual = await buscarVinculo(sb, orgId, userId)
  if (!atual) throw new ErroHttp(422, `Esta pessoa não faz parte de ${org.nome}.`)
  if (!atual.ativo) {
    return json({ ok: true, userId, orgId, orgNome: org.nome, jaEstavaRevogado: true, mensagem: 'Acesso já estava revogado.' })
  }

  exigirPodeMexerEmOwner(c, orgId, atual.role)
  await exigirNaoRemoveUltimoOwner(sb, orgId, atual.role, null)
  exigirNaoSeTrancarFora(c, userId, null)

  const { error } = await sb.from('organization_members').update({ ativo: false }).eq('id', atual.id)
  if (error) throw mascarar('revogar vínculo', error, 'Não foi possível revogar o acesso.')

  return json({
    ok: true,
    userId,
    orgId,
    orgNome: org.nome,
    roleAnterior: atual.role,
    mensagem: `Acesso a ${org.nome} revogado. A conta e o histórico continuam intactos.`,
  })
}

// ─── ação: senha ─────────────────────────────────────────────────────────────

/**
 * Reset administrativo. A senha só viaja daqui pro GoTrue: não é logada, não
 * volta na resposta, não é gravada em lugar nenhum.
 */
async function acaoSenha(
  sb: SupabaseClient,
  c: Chamador,
  body: { userId?: unknown; novaSenha?: unknown },
): Promise<Response> {
  const userId = validarUuid(body.userId, 'a pessoa (userId)')
  const novaSenha = validarSenha(body.novaSenha, 'A nova senha')

  const perfilAlvo = await buscarPerfil(sb, userId)
  exigirPodeMexerEmGlobal(c, await alvoEhGlobalAdmin(sb, c, perfilAlvo, userId))

  // Não-global só reseta a senha de quem é membro ATIVO de uma org que ele
  // administra (e nunca de um admin global — barrado acima).
  if (!c.isGlobalAdmin) {
    const orgsAdmin = orgsQueAdministra(c)
    if (orgsAdmin.length === 0) throw new ErroHttp(403, 'Você não administra nenhuma organização.')
    const { data, error } = await sb
      .from('organization_members')
      .select('org_id, role')
      .eq('user_id', userId)
      .eq('ativo', true)
      .in('org_id', orgsAdmin)
    if (error) throw mascarar('checar vínculo p/ senha', error, 'Não foi possível conferir a sua permissão.')
    const compartilhadas = (data ?? []) as { org_id: string; role: OrgRole }[]
    if (compartilhadas.length === 0) {
      throw new ErroHttp(403, 'Você só pode redefinir a senha de quem faz parte de uma organização que você administra.')
    }
    // Basta UMA organização onde a mexida é legítima. Trocar a senha de um
    // owner é assumir a empresa: só outro owner (ou admin global) pode.
    const permitido = compartilhadas.some((v) => v.role !== 'owner' || c.papeis.get(v.org_id) === 'owner')
    if (!permitido) {
      throw new ErroHttp(403, 'Somente um owner da organização (ou um admin global) pode redefinir a senha de um owner.')
    }
  }

  const { error } = await sb.auth.admin.updateUserById(userId, { password: novaSenha })
  if (error) {
    // O log leva SÓ a mensagem do GoTrue — jamais a senha.
    throw mascarar('updateUserById', error, 'Não foi possível redefinir a senha. Tente uma senha mais forte.')
  }

  return json({
    ok: true,
    userId,
    email: perfilAlvo?.email ?? null,
    mensagem: 'Senha redefinida. Entregue-a pessoalmente e peça a troca no primeiro acesso.',
  })
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Método não permitido — use POST.' }, 405)

  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) {
    console.error('[admin-usuarios] env faltando (URL/SERVICE_ROLE/ANON)')
    return json({ ok: false, error: 'Função mal configurada no servidor. Avise o administrador.' }, 500)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return json({ ok: false, error: 'Corpo inválido (esperado JSON).' }, 400)
  }

  // Client ANON: SÓ pra dizer QUEM é o chamador. Client SERVICE_ROLE: SÓ pra
  // executar o que já foi autorizado. Não inverter — service_role ignora RLS.
  const sbAnon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  try {
    const chamador = await identificarChamador(req, sbAnon, sbAdmin)
    const acao = txt(body.acao).toLowerCase()

    switch (acao) {
      case 'listar':
        return await acaoListar(sbAdmin, chamador)
      case 'criar':
        return await acaoCriar(sbAdmin, chamador, body as CorpoCriar)
      case 'convidar':
        return await acaoConvidar(sbAdmin, chamador, body as CorpoConvidar)
      case 'papel':
        return await acaoPapel(sbAdmin, chamador, body)
      case 'revogar':
        return await acaoRevogar(sbAdmin, chamador, body)
      case 'senha':
        return await acaoSenha(sbAdmin, chamador, body)
      case '':
        return json({ ok: false, error: 'Informe a "acao": listar, criar, convidar, papel, revogar ou senha.' }, 400)
      default:
        return json({ ok: false, error: `Ação desconhecida: "${acao.slice(0, 40)}".` }, 400)
    }
  } catch (e) {
    if (e instanceof ErroHttp) return json({ ok: false, error: e.message, ...e.extra }, e.status)
    // Qualquer coisa não prevista: detalhe só no log, mensagem genérica pro cliente.
    console.error('[admin-usuarios] erro inesperado:', e instanceof Error ? e.stack ?? e.message : String(e))
    return json({ ok: false, error: 'Erro inesperado ao processar a solicitação.' }, 500)
  }
})
