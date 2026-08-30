/**
 * useUsuarios.ts — ponte entre a tela "Usuários & Acessos" e a Edge Function
 * `admin-usuarios` (contrato acordado com as frentes de backend).
 *
 * Tudo que escreve em auth.users / organization_members passa pela função
 * (service_role no servidor). O navegador só carrega a ANON key, então aqui
 * NUNCA há Admin API — só `supabase.functions.invoke`, que já anexa o
 * Authorization do usuário logado.
 *
 * Degradação (a tela nunca quebra):
 *  - `semSupabase`    → app rodando sem as envs (modo local).
 *  - `funcaoAusente`  → função ainda não deployada (404 / preflight falhou).
 *  - `semPermissao`   → 403 da função, ou o próprio usuário não é admin global
 *                       nem owner/admin de nenhuma organização.
 *  - `sessaoExpirada` → 401.
 * Em qualquer um deles: listas vazias, `erro` com texto explicativo e a UI
 * mostra aviso — nunca tela de erro.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useOrgStore, type Org } from '@/store/orgStore'

// ─── Domínio ────────────────────────────────────────────────────────────────

/** enum public.org_role */
export const ORG_ROLES = ['owner', 'admin', 'gestor', 'membro', 'leitor'] as const
export type OrgRole = (typeof ORG_ROLES)[number]

/** Papéis que podem administrar acessos DENTRO da própria organização. */
export const ROLES_ADMINISTRADORES: OrgRole[] = ['owner', 'admin']

export const ROLE_META: Record<OrgRole, { label: string; resumo: string }> = {
  owner: {
    label: 'Dono',
    resumo: 'Controle total da empresa, inclusive dar e tirar acesso de outros administradores.',
  },
  admin: {
    label: 'Administrador',
    resumo: 'Gerencia acessos e todos os dados da empresa.',
  },
  gestor: {
    label: 'Gestor',
    resumo: 'Cria e edita dados de obra (planejamento, medição, RDO). Não mexe em acessos.',
  },
  membro: {
    label: 'Membro',
    resumo: 'Uso diário: lança apontamento, RDO e produção. Não mexe em acessos.',
  },
  leitor: {
    label: 'Leitor',
    resumo: 'Só visualiza. Não altera nada.',
  },
}

export function ehOrgRole(valor: unknown): valor is OrgRole {
  return typeof valor === 'string' && (ORG_ROLES as readonly string[]).includes(valor)
}

export interface VinculoOrg {
  orgId: string
  orgNome: string
  role: OrgRole
  ativo: boolean
}

export interface UsuarioAcesso {
  userId: string
  email: string
  nome: string | null
  isGlobalAdmin: boolean
  ativo: boolean
  ultimoLogin: string | null
  criadoEm: string | null
  orgs: VinculoOrg[]
}

export interface ConvitePendente {
  email: string
  nome: string | null
  orgId: string
  orgNome: string
  role: OrgRole
  isGlobalAdmin: boolean
  criadoEm: string | null
}

/** Resultado devolvido às ações da UI (nunca lança). */
export interface ResultadoAcao {
  ok: boolean
  erro?: string
  /** 'criar' com e-mail que já existia no Auth: o vínculo foi garantido. */
  jaExistia?: boolean
}

// ─── Chamada à Edge Function ────────────────────────────────────────────────

const NOME_FUNCAO = 'admin-usuarios'

const MSG_FUNCAO_AUSENTE =
  'A função admin-usuarios ainda não está no ar neste projeto Supabase — nenhum acesso pode ser criado por aqui até o deploy.'
const MSG_SEM_SUPABASE =
  'App rodando sem as variáveis do Supabase (modo local) — a gestão de acessos precisa do banco.'
const MSG_SESSAO =
  'Sua sessão expirou. Saia e entre novamente para continuar gerenciando acessos.'
const MSG_SEM_PERMISSAO =
  'Você não tem permissão para gerenciar acessos.'

type Falha =
  | { tipo: 'sem-supabase'; mensagem: string }
  | { tipo: 'funcao-ausente'; mensagem: string }
  | { tipo: 'sessao'; mensagem: string }
  | { tipo: 'sem-permissao'; mensagem: string }
  | { tipo: 'erro'; mensagem: string }

type Resultado<T> = { ok: true; dados: T } | { ok: false; falha: Falha }

function textoDoErro(e: unknown): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string') return e
  return 'Falha inesperada ao falar com a função admin-usuarios.'
}

/** Lê o corpo JSON de um Response de erro sem consumir o original. */
async function lerCorpo(resp: Response | null): Promise<Record<string, unknown> | null> {
  if (!resp) return null
  try {
    const alvo = typeof resp.clone === 'function' ? resp.clone() : resp
    const json = await alvo.json()
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function textoDoCorpo(corpo: Record<string, unknown> | null): string | null {
  if (!corpo) return null
  for (const chave of ['erro', 'error', 'message', 'msg']) {
    const v = corpo[chave]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

async function invocar<T>(body: Record<string, unknown>): Promise<Resultado<T>> {
  if (!supabase) return { ok: false, falha: { tipo: 'sem-supabase', mensagem: MSG_SEM_SUPABASE } }

  let data: unknown = null
  let error: unknown = null
  try {
    const r = await supabase.functions.invoke(NOME_FUNCAO, { body })
    data = r.data
    error = r.error
  } catch (e) {
    // invoke não costuma lançar, mas rede caindo no meio pode.
    return { ok: false, falha: { tipo: 'funcao-ausente', mensagem: `${MSG_FUNCAO_AUSENTE} (${textoDoErro(e)})` } }
  }

  if (error) {
    const ctx = (error as { context?: unknown }).context
    const resp =
      ctx && typeof ctx === 'object' && 'status' in (ctx as Record<string, unknown>)
        ? (ctx as Response)
        : null
    const status = resp?.status ?? 0
    const corpo = await lerCorpo(resp)
    const doCorpo = textoDoCorpo(corpo)
    const nome = (error as { name?: string }).name ?? ''
    const bruto = doCorpo ?? textoDoErro(error)

    // Função não deployada: o gateway responde 404; se o preflight CORS nem
    // completa, supabase-js devolve FunctionsFetchError sem context.
    if (status === 404 || nome === 'FunctionsFetchError' || (!resp && /fetch|failed to send/i.test(bruto))) {
      return { ok: false, falha: { tipo: 'funcao-ausente', mensagem: MSG_FUNCAO_AUSENTE } }
    }
    if (status === 401) return { ok: false, falha: { tipo: 'sessao', mensagem: doCorpo ?? MSG_SESSAO } }
    if (status === 403) return { ok: false, falha: { tipo: 'sem-permissao', mensagem: doCorpo ?? MSG_SEM_PERMISSAO } }
    return { ok: false, falha: { tipo: 'erro', mensagem: bruto } }
  }

  const payload = (data ?? null) as ({ ok?: boolean } & Record<string, unknown>) | null
  if (!payload || payload.ok !== true) {
    return {
      ok: false,
      falha: {
        tipo: 'erro',
        mensagem: textoDoCorpo(payload) ?? 'A função admin-usuarios respondeu em formato inesperado.',
      },
    }
  }
  return { ok: true, dados: payload as unknown as T }
}

// ─── Normalização das respostas ─────────────────────────────────────────────

function txt(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function normalizarVinculo(raw: unknown, nomePorOrg: Map<string, string>): VinculoOrg | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const orgId = txt(o.orgId) ?? txt(o.org_id)
  if (!orgId) return null
  const role = ehOrgRole(o.role) ? o.role : 'membro'
  return {
    orgId,
    orgNome: txt(o.orgNome) ?? txt(o.org_nome) ?? nomePorOrg.get(orgId) ?? 'Empresa sem nome',
    role,
    ativo: o.ativo !== false,
  }
}

function normalizarUsuario(raw: unknown, nomePorOrg: Map<string, string>): UsuarioAcesso | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const userId = txt(o.userId) ?? txt(o.user_id) ?? txt(o.id)
  const email = txt(o.email)
  if (!userId || !email) return null
  const orgsRaw = Array.isArray(o.orgs) ? o.orgs : []
  return {
    userId,
    email,
    nome: txt(o.nome) ?? txt(o.full_name),
    isGlobalAdmin: o.isGlobalAdmin === true || o.is_global_admin === true,
    ativo: o.ativo !== false,
    ultimoLogin: txt(o.ultimoLogin) ?? txt(o.last_sign_in_at),
    criadoEm: txt(o.criadoEm) ?? txt(o.created_at),
    orgs: orgsRaw
      .map((v) => normalizarVinculo(v, nomePorOrg))
      .filter((v): v is VinculoOrg => v !== null),
  }
}

function normalizarConvite(raw: unknown, nomePorOrg: Map<string, string>): ConvitePendente | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const email = txt(o.email)
  if (!email) return null
  const orgId = txt(o.orgId) ?? txt(o.org_id) ?? ''
  return {
    email,
    nome: txt(o.nome) ?? txt(o.full_name),
    orgId,
    orgNome: txt(o.orgNome) ?? txt(o.org_nome) ?? nomePorOrg.get(orgId) ?? '—',
    role: ehOrgRole(o.role) ? o.role : 'membro',
    isGlobalAdmin: o.isGlobalAdmin === true || o.is_global_admin === true,
    criadoEm: txt(o.criadoEm) ?? txt(o.created_at),
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export interface NovoAcessoInput {
  email: string
  nome?: string
  orgId: string
  role: OrgRole
  isGlobalAdmin?: boolean
}

export interface UseUsuariosReturn {
  usuarios: UsuarioAcesso[]
  convites: ConvitePendente[]
  /**
   * Avisos que a própria função devolveu (campo `avisos`) — ex.: a tabela
   * convites_acesso ainda não existe. Sem exibi-los a tela mostraria
   * "nenhum convite pendente" para uma lista que nem pôde ser lida.
   */
  avisos: string[]
  loading: boolean
  /** true enquanto uma ação de escrita está em voo */
  salvando: boolean
  erro: string | null
  semPermissao: boolean
  funcaoAusente: boolean
  semSupabase: boolean
  sessaoExpirada: boolean
  /** admin global, ou owner/admin de pelo menos uma organização */
  podeGerenciar: boolean
  /** false enquanto ainda estamos descobrindo os papéis do usuário logado */
  permissoesCarregadas: boolean
  isGlobalAdmin: boolean
  /** organizações em que o usuário logado pode conceder acesso */
  orgsAdministraveis: Org[]
  /** todas as organizações visíveis (para os filtros da lista) */
  orgs: Org[]
  recarregar: () => Promise<void>
  criarUsuario: (input: NovoAcessoInput & { senhaTemporaria: string }) => Promise<ResultadoAcao>
  convidar: (input: NovoAcessoInput) => Promise<ResultadoAcao>
  alterarPapel: (userId: string, orgId: string, role: OrgRole) => Promise<ResultadoAcao>
  revogar: (userId: string, orgId: string) => Promise<ResultadoAcao>
  redefinirSenha: (userId: string, novaSenha: string) => Promise<ResultadoAcao>
}

export function useUsuarios(): UseUsuariosReturn {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const orgs = useOrgStore((s) => s.orgs)
  const carregarOrgs = useOrgStore((s) => s.carregarOrgs)

  const [usuarios, setUsuarios] = useState<UsuarioAcesso[]>([])
  const [convites, setConvites] = useState<ConvitePendente[]>([])
  const [avisos, setAvisos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [semPermissao, setSemPermissao] = useState(false)
  const [funcaoAusente, setFuncaoAusente] = useState(false)
  const [semSupabase, setSemSupabase] = useState(!supabase)
  const [sessaoExpirada, setSessaoExpirada] = useState(false)

  const [meusPapeis, setMeusPapeis] = useState<Record<string, OrgRole>>({})
  const [permissoesCarregadas, setPermissoesCarregadas] = useState(false)

  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  const isGlobalAdmin = profile?.is_global_admin === true

  const nomePorOrg = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of orgs) m.set(o.id, o.nome)
    return m
  }, [orgs])

  // 1. Papéis do usuário logado (define se a tela abre e quais empresas ele
  //    pode administrar). RLS permite ler as próprias linhas.
  useEffect(() => {
    let cancelado = false
    async function carregar() {
      void carregarOrgs()
      if (!supabase) {
        if (!cancelado) {
          setSemSupabase(true)
          setPermissoesCarregadas(true)
          setLoading(false)
        }
        return
      }
      if (!user) {
        if (!cancelado) {
          setMeusPapeis({})
          setPermissoesCarregadas(true)
        }
        return
      }
      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select('org_id, role, ativo')
          .eq('user_id', user.id)
        if (cancelado) return
        const mapa: Record<string, OrgRole> = {}
        if (!error && Array.isArray(data)) {
          for (const linha of data as Array<Record<string, unknown>>) {
            if (linha.ativo === false) continue
            const orgId = txt(linha.org_id)
            if (orgId && ehOrgRole(linha.role)) mapa[orgId] = linha.role
          }
        }
        setMeusPapeis(mapa)
      } catch {
        if (!cancelado) setMeusPapeis({})
      } finally {
        if (!cancelado) setPermissoesCarregadas(true)
      }
    }
    void carregar()
    return () => {
      cancelado = true
    }
  }, [user, carregarOrgs])

  const podeGerenciar = useMemo(() => {
    if (isGlobalAdmin) return true
    return Object.values(meusPapeis).some((r) => ROLES_ADMINISTRADORES.includes(r))
  }, [isGlobalAdmin, meusPapeis])

  const orgsAdministraveis = useMemo(() => {
    if (isGlobalAdmin) return orgs
    return orgs.filter((o) => ROLES_ADMINISTRADORES.includes(meusPapeis[o.id]))
  }, [isGlobalAdmin, orgs, meusPapeis])

  const aplicarFalha = useCallback((falha: Falha) => {
    setSemSupabase(falha.tipo === 'sem-supabase')
    setFuncaoAusente(falha.tipo === 'funcao-ausente')
    setSemPermissao(falha.tipo === 'sem-permissao')
    setSessaoExpirada(falha.tipo === 'sessao')
    setErro(falha.mensagem)
  }, [])

  const recarregar = useCallback(async () => {
    if (!vivo.current) return
    setLoading(true)
    const r = await invocar<{ usuarios?: unknown; convites?: unknown; avisos?: unknown }>({ acao: 'listar' })
    if (!vivo.current) return
    if (!r.ok) {
      setUsuarios([])
      setConvites([])
      setAvisos([])
      aplicarFalha(r.falha)
      setLoading(false)
      return
    }
    const brutosUsuarios = Array.isArray(r.dados.usuarios) ? r.dados.usuarios : []
    const brutosConvites = Array.isArray(r.dados.convites) ? r.dados.convites : []
    setUsuarios(
      brutosUsuarios
        .map((v) => normalizarUsuario(v, nomePorOrg))
        .filter((v): v is UsuarioAcesso => v !== null),
    )
    setConvites(
      brutosConvites
        .map((v) => normalizarConvite(v, nomePorOrg))
        .filter((v): v is ConvitePendente => v !== null),
    )
    setAvisos(
      Array.isArray(r.dados.avisos)
        ? r.dados.avisos.filter((a): a is string => typeof a === 'string' && a.trim() !== '')
        : [],
    )
    setErro(null)
    setSemPermissao(false)
    setFuncaoAusente(false)
    setSessaoExpirada(false)
    setLoading(false)
  }, [aplicarFalha, nomePorOrg])

  // 2. Primeira carga — só chama a função se o usuário puder gerenciar.
  useEffect(() => {
    if (!permissoesCarregadas) return
    if (semSupabase) {
      setLoading(false)
      return
    }
    if (!podeGerenciar) {
      setUsuarios([])
      setConvites([])
      setSemPermissao(true)
      setLoading(false)
      return
    }
    void recarregar()
    // recarregar muda quando nomePorOrg muda (orgs chegaram) — recarga barata e
    // desejada: os nomes de empresa entram no fallback dos vínculos.
  }, [permissoesCarregadas, podeGerenciar, semSupabase, recarregar])

  /** Executa uma ação de escrita e recarrega a lista quando dá certo. */
  const executar = useCallback(
    async (body: Record<string, unknown>): Promise<ResultadoAcao> => {
      setSalvando(true)
      const r = await invocar<Record<string, unknown>>(body)
      if (!r.ok) {
        if (vivo.current) {
          setSalvando(false)
          // Falha de escrita não derruba a lista já carregada: só sinaliza os
          // estados estruturais (função fora do ar / sessão / permissão).
          if (r.falha.tipo !== 'erro') aplicarFalha(r.falha)
        }
        return { ok: false, erro: r.falha.mensagem }
      }
      const jaExistia = r.dados.jaExistia === true
      await recarregar()
      if (vivo.current) setSalvando(false)
      return { ok: true, jaExistia }
    },
    [aplicarFalha, recarregar],
  )

  const criarUsuario = useCallback(
    (input: NovoAcessoInput & { senhaTemporaria: string }) =>
      executar({
        acao: 'criar',
        email: input.email.trim().toLowerCase(),
        nome: input.nome?.trim() || undefined,
        orgId: input.orgId,
        role: input.role,
        isGlobalAdmin: input.isGlobalAdmin === true,
        senhaTemporaria: input.senhaTemporaria,
      }),
    [executar],
  )

  const convidar = useCallback(
    (input: NovoAcessoInput) =>
      executar({
        acao: 'convidar',
        email: input.email.trim().toLowerCase(),
        nome: input.nome?.trim() || undefined,
        orgId: input.orgId,
        role: input.role,
        isGlobalAdmin: input.isGlobalAdmin === true,
      }),
    [executar],
  )

  const alterarPapel = useCallback(
    (userId: string, orgId: string, role: OrgRole) => executar({ acao: 'papel', userId, orgId, role }),
    [executar],
  )

  const revogar = useCallback(
    (userId: string, orgId: string) => executar({ acao: 'revogar', userId, orgId }),
    [executar],
  )

  const redefinirSenha = useCallback(
    (userId: string, novaSenha: string) => executar({ acao: 'senha', userId, novaSenha }),
    [executar],
  )

  return {
    usuarios,
    convites,
    avisos,
    loading,
    salvando,
    erro,
    semPermissao,
    funcaoAusente,
    semSupabase,
    sessaoExpirada,
    podeGerenciar,
    permissoesCarregadas,
    isGlobalAdmin,
    orgsAdministraveis,
    orgs,
    recarregar,
    criarUsuario,
    convidar,
    alterarPapel,
    revogar,
    redefinirSenha,
  }
}
