/**
 * orgStore.ts - Zustand store do seletor de organizacao (multi-empresa).
 *
 * `orgAtivaId === null` significa "Todas as empresas" (visao do admin global).
 * A org ativa persiste em localStorage (sobrevive ao reload disparado por
 * trocarOrg) e, quando a tabela `user_org_ativa` existir, tambem no Supabase.
 *
 * Degradacao: se `organizations` ainda nao foi migrada (ou o select falhar),
 * orgs = [] com `erroCarregamento: true` - o AuthGate trata esse caso como
 * modo degradado e libera o app como hoje.
 */
import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export interface Org {
  id: string
  nome: string
  slug: string | null
  cor_primaria: string | null
}

const ORG_KEY = 'cdata-org-ativa'

interface OrgState {
  orgs: Org[]
  /** null = "Todas as empresas" (admin global) */
  orgAtivaId: string | null
  carregando: boolean
  /** true depois que carregarOrgs terminou (com sucesso ou erro) */
  carregado: boolean
  /** true quando o select falhou (tabela ainda nao migrada / sem acesso) */
  erroCarregamento: boolean
  carregarOrgs: () => Promise<void>
  trocarOrg: (id: string | null) => Promise<void>
}

function lerOrgPersistida(): string | null {
  try { return localStorage.getItem(ORG_KEY) } catch { return null }
}

export const useOrgStore = create<OrgState>((set, get) => ({
  orgs: [],
  orgAtivaId: lerOrgPersistida(),
  carregando: false,
  carregado: false,
  erroCarregamento: false,

  carregarOrgs: async () => {
    if (get().carregando || get().carregado) return
    if (!supabase) {
      set({ orgs: [], carregado: true, erroCarregamento: false })
      return
    }
    set({ carregando: true })
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, nome, slug, cor_primaria')
        .order('nome')
      if (error) {
        set({ orgs: [], carregando: false, carregado: true, erroCarregamento: true })
        return
      }
      const orgs = (data ?? []) as Org[]
      // Valida a org persistida contra a lista atual (o acesso pode ter mudado).
      let orgAtivaId = get().orgAtivaId
      if (orgAtivaId && !orgs.some((o) => o.id === orgAtivaId)) orgAtivaId = null
      // Nao-admin com uma unica org: ela e sempre a ativa.
      const isAdmin = useAuthStore.getState().profile?.is_global_admin === true
      if (!orgAtivaId && !isAdmin && orgs.length === 1) orgAtivaId = orgs[0].id
      set({ orgs, orgAtivaId, carregando: false, carregado: true, erroCarregamento: false })
    } catch {
      set({ orgs: [], carregando: false, carregado: true, erroCarregamento: true })
    }
  },

  trocarOrg: async (id) => {
    try {
      if (id) localStorage.setItem(ORG_KEY, id)
      else localStorage.removeItem(ORG_KEY)
    } catch { /* localStorage indisponivel - segue */ }

    const user = useAuthStore.getState().user
    if (supabase && user) {
      // Tabela pode nao existir ainda - erro e tolerado (upsert nao lanca; o
      // try/catch cobre falha de rede).
      try {
        await supabase
          .from('user_org_ativa')
          .upsert({ user_id: user.id, org_id: id }, { onConflict: 'user_id' })
      } catch { /* tolerado */ }
    }

    set({ orgAtivaId: id })
    // Reload completo: os ~50 hooks de dados leem contexto no mount; recarregar
    // garante que todos re-consultem com a nova org.
    window.location.reload()
  },
}))
