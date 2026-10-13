/**
 * authStore.ts - Zustand store de autenticacao (Supabase Auth).
 *
 * Fluxo: main.tsx dispara `inicializar()` antes do render; o AuthGate apenas
 * espera o status sair de 'carregando' (inicializar e idempotente - o AuthGate
 * chama de novo como rede de seguranca, sem efeito duplicado).
 *
 * Degradacao: se as envs do Supabase nao existirem (`supabase === null`),
 * status vira 'deslogado' com `semSupabase: true` e o AuthGate libera o app
 * em modo local. Se a tabela `profiles` ainda nao tiver sido migrada, o erro
 * e engolido e seguimos com profile = null.
 */
import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type AuthStatus = 'carregando' | 'logado' | 'deslogado'

export interface AuthProfile {
  id: string
  email: string | null
  full_name: string | null
  is_global_admin: boolean
  org_padrao_id: string | null
}

interface AuthState {
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  status: AuthStatus
  /** true quando as envs do Supabase nao existem - app segue em modo local */
  semSupabase: boolean
  inicializado: boolean
  inicializar: () => Promise<void>
  entrar: (email: string, senha: string) => Promise<{ ok: boolean; erro?: string }>
  sair: () => Promise<void>
}

async function carregarProfile(userId: string): Promise<AuthProfile | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, is_global_admin, full_name, email, org_padrao_id')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    return {
      id: String(data.id),
      email: data.email ?? null,
      full_name: data.full_name ?? null,
      is_global_admin: data.is_global_admin === true,
      org_padrao_id: data.org_padrao_id ?? null,
    }
  } catch {
    // Tabela/colunas ainda nao migradas - segue sem profile.
    return null
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  status: 'carregando',
  semSupabase: false,
  inicializado: false,

  inicializar: async () => {
    if (get().inicializado) return
    set({ inicializado: true })

    if (!supabase) {
      set({ status: 'deslogado', semSupabase: true })
      return
    }

    // Reage a login/logout/refresh de token vindos de fora (outra aba, expiracao).
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
        set({ session: null, user: null, profile: null, status: 'deslogado' })
        return
      }
      if (!session) return
      const prevUserId = get().user?.id
      set({ session, user: session.user, status: 'logado' })
      if (session.user.id !== prevUserId || !get().profile) {
        // setTimeout: nunca fazer await de chamada supabase DENTRO do callback
        // de onAuthStateChange (deadlock conhecido do supabase-js v2).
        setTimeout(() => {
          carregarProfile(session.user.id).then((profile) => set({ profile }))
        }, 0)
      }
    })

    try {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        set({ status: 'deslogado' })
        return
      }
      const session = data.session
      // Carrega o profile ANTES de virar 'logado' para o AuthGate ja decidir
      // com is_global_admin resolvido (evita flash da tela "sem vinculo").
      const profile = await carregarProfile(session.user.id)
      set({ session, user: session.user, profile, status: 'logado' })
    } catch {
      set({ status: 'deslogado' })
    }
  },

  entrar: async (email, senha) => {
    if (!supabase) return { ok: false, erro: 'Supabase nao configurado (modo local).' }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })
      if (error || !data.session) {
        return { ok: false, erro: error?.message ?? 'Falha no login.' }
      }
      const profile = await carregarProfile(data.session.user.id)
      set({ session: data.session, user: data.session.user, profile, status: 'logado' })
      return { ok: true }
    } catch (e) {
      return { ok: false, erro: e instanceof Error ? e.message : 'Falha no login.' }
    }
  },

  sair: async () => {
    if (supabase) {
      try { await supabase.auth.signOut() } catch { /* estado local e limpo mesmo assim */ }
    }
    set({ session: null, user: null, profile: null, status: 'deslogado' })
  },
}))
