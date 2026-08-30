import { create } from 'zustand'
import { supabase, type DbProjeto, type DbFrente } from '@/lib/supabase'
import { apiCriarProjeto, apiProjetoDashboard, apiProjetos, type CanonicalIntegrationStatus } from '@/lib/api'

const STORAGE_KEY = 'cdata-active-project'
// WCR-only: sempre serve os dados reais WCR (Boi/Sakura/Retorno). O Supabase entra
// depois como fonte "live"; enquanto ele estiver fora, o app já mostra a WCR no Vercel.
const ALLOW_DEMO_DATA = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'

interface ProjectContextState {
  projetos: DbProjeto[]
  frentes: DbFrente[]
  activeProjectId: string | null
  loading: boolean
  integrationStatus: CanonicalIntegrationStatus
  setActiveProject: (id: string) => void
  fetchProjetos: () => Promise<void>
  fetchFrentes: (projetoId: string) => Promise<void>
  addProjeto: (p: Omit<DbProjeto, 'id' | 'created_at'>) => Promise<DbProjeto | null>
  updateProjeto: (id: string, patch: Partial<DbProjeto>) => Promise<boolean>
  addFrente: (f: Omit<DbFrente, 'id'>) => Promise<DbFrente | null>
}

export function selectActiveProjeto(s: ProjectContextState): DbProjeto | null {
  return s.projetos.find((p) => p.id === s.activeProjectId) ?? null
}

export function selectFrentesDoProjetoAtivo(s: ProjectContextState): DbFrente[] {
  return s.frentes.filter((f) => f.projeto_id === s.activeProjectId)
}

// WCR Saneamento — Contrato Sabesp 13.546/25-00 (Zona Norte SP). Só as frentes WCR.
const ID_BOI = 'wcr-boi-malhado'
const ID_SAKURA = 'wcr-sakura'
const ID_RETORNO = 'wcr-retorno'

const DEMO_PROJETOS: DbProjeto[] = [
  {
    id: ID_BOI,
    nome: 'WCR — Boi Malhado',
    contrato: '13.546/25-00',
    cidade: 'São Paulo (Zona Norte)',
    cliente: 'WCR Saneamento / Sabesp',
    tipo: 'água + esgoto',
    data_inicio: '2026-06-24',
    data_fim: '2026-08-15',
    orcamento_total: 0, // em branco — Felipe cadastra pelo site (lápis no seletor de projeto)
    status: 'ativo',
    responsavel_nome: 'Felipe Nery',
    responsavel_telefone: '5561981846325',
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    id: ID_SAKURA,
    nome: 'WCR — Sakura',
    contrato: '13.546/25-00',
    cidade: 'São Paulo (Zona Norte)',
    cliente: 'WCR Saneamento / Sabesp',
    tipo: 'água + esgoto',
    data_inicio: '2026-07-15',
    data_fim: '2026-09-02',
    orcamento_total: 0, // em branco — Felipe cadastra pelo site (lápis no seletor de projeto)
    status: 'ativo',
    responsavel_nome: 'Felipe Nery',
    responsavel_telefone: '5561981846325',
    created_at: '2026-06-15T00:00:00Z',
  },
  {
    id: ID_RETORNO,
    nome: 'WCR — Comunidade do Retorno',
    contrato: '13.546/25-00',
    cidade: 'São Paulo (Zona Norte)',
    cliente: 'WCR Saneamento / Sabesp',
    tipo: 'água + esgoto + EEE',
    data_inicio: '2026-06-29',
    data_fim: '2026-12-15',
    orcamento_total: 0, // em branco — Felipe cadastra pelo site (lápis no seletor de projeto)
    status: 'ativo',
    responsavel_nome: 'Felipe Nery / Jailton',
    responsavel_telefone: '5561981846325',
    created_at: '2026-06-15T00:00:00Z',
  },
]

const DEMO_FRENTES: DbFrente[] = [
  { id: 'f-boi-esg', projeto_id: ID_BOI, nome: 'Esgoto — Israel + Wellington', setor: 'Boi Malhado', tipo_rede: 'esgoto', extensao_total: 700, pvs_total: 60, status: 'ativa' },
  { id: 'f-boi-agua', projeto_id: ID_BOI, nome: 'Água — Jesse / Ediel', setor: 'Boi Malhado', tipo_rede: 'agua', extensao_total: 500, pvs_total: 0, status: 'ativa' },
  { id: 'f-sak-esg', projeto_id: ID_SAKURA, nome: 'Esgoto — Robert', setor: 'Sakura', tipo_rede: 'esgoto', extensao_total: 700, pvs_total: 45, status: 'ativa' },
  { id: 'f-sak-agua', projeto_id: ID_SAKURA, nome: 'Água — Jesse', setor: 'Sakura', tipo_rede: 'agua', extensao_total: 550, pvs_total: 0, status: 'ativa' },
  { id: 'f-ret-esg', projeto_id: ID_RETORNO, nome: 'Esgoto — rede + coletor', setor: 'Comunidade do Retorno', tipo_rede: 'esgoto', extensao_total: 1065, pvs_total: 17, status: 'planejada' },
  { id: 'f-ret-agua', projeto_id: ID_RETORNO, nome: 'Água MND — Jailton', setor: 'Comunidade do Retorno', tipo_rede: 'agua', extensao_total: 1000, pvs_total: 0, status: 'planejada' },
  { id: 'f-ret-eee', projeto_id: ID_RETORNO, nome: 'EEE — Estação Elevatória', setor: 'Comunidade do Retorno', tipo_rede: 'esgoto', extensao_total: 180, pvs_total: 1, status: 'planejada' },
]

export const useProjectContext = create<ProjectContextState>((set, get) => ({
  projetos: [],
  frentes: [],
  activeProjectId: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || null
    } catch {
      return null
    }
  })(),
  loading: false,
  integrationStatus: 'local',

  setActiveProject: (id) => {
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // noop
    }
    set({ activeProjectId: id })
    get().fetchFrentes(id)
  },

  fetchProjetos: async () => {
    set({ loading: true })
    // WCR live: se o Supabase estiver configurado, carrega SÓ os projetos WCR
    // (contrato 13.546/25-00) direto do banco, com os ids reais (UUID).
    if (supabase) {
      try {
        const { data } = await supabase
          .from('projetos')
          .select('*')
          .eq('contrato', '13.546/25-00')
          .order('created_at', { ascending: true })
        if (data && data.length > 0) {
          const cur = get().activeProjectId
          const valid = !!cur && data.some((p: any) => p.id === cur)
          const nextId = valid ? cur! : (data[0] as any).id
          set({
            projetos: data as DbProjeto[],
            integrationStatus: 'connected',
            activeProjectId: nextId,
            loading: false,
          })
          get().fetchFrentes(nextId)
          return
        }
      } catch {
        // sem Supabase válido → cai no demo abaixo
      }
    }
    // DEV demo (WCR): mostra só as frentes WCR, sem depender de API/Supabase.
    if (ALLOW_DEMO_DATA) {
      const cur = get().activeProjectId
      const valid = !!cur && DEMO_PROJETOS.some((p) => p.id === cur)
      set({
        projetos: DEMO_PROJETOS,
        frentes: DEMO_FRENTES,
        integrationStatus: 'local',
        activeProjectId: valid ? cur : (DEMO_PROJETOS[0]?.id ?? null),
        loading: false,
      })
      return
    }
    try {
      const api = await apiProjetos()
      const rows = (api.items ?? []) as unknown as DbProjeto[]
      if (rows.length > 0) {
        set({ projetos: rows, integrationStatus: 'connected' })
        const active = get().activeProjectId
        const existsInData = active && rows.find((p) => p.id === active)
        const nextActiveId = !active || !existsInData ? rows[0].id : active
        if (!active || !existsInData) get().setActiveProject(rows[0].id)
        else get().fetchFrentes(nextActiveId)
        set({ loading: false })
        return
      }
    } catch {
      // fallback Supabase/local abaixo
    }
    if (!supabase) {
      if (ALLOW_DEMO_DATA) {
        set({
          projetos: DEMO_PROJETOS,
          frentes: DEMO_FRENTES,
          integrationStatus: 'local',
          activeProjectId: get().activeProjectId || DEMO_PROJETOS[0]?.id || null,
          loading: false,
        })
        return
      }
      set({ projetos: [], frentes: [], integrationStatus: 'local', loading: false })
      return
    }
    try {
      const { data } = await supabase.from('projetos').select('*').order('created_at', { ascending: false })
      if (data && data.length > 0) {
        set({ projetos: data as DbProjeto[], integrationStatus: 'partial' })
        const active = get().activeProjectId
        const existsInData = active && data.find((p: any) => p.id === active)
        const nextActiveId = !active || !existsInData ? data[0].id : active
        if (!active || !existsInData) get().setActiveProject(data[0].id)
        else get().fetchFrentes(nextActiveId)
      } else if (ALLOW_DEMO_DATA) {
        set({
          projetos: DEMO_PROJETOS,
          frentes: DEMO_FRENTES,
          integrationStatus: 'local',
        })
      } else {
        set({ projetos: [], frentes: [], integrationStatus: 'local' })
      }
    } catch {
      if (ALLOW_DEMO_DATA) {
        set({
          projetos: DEMO_PROJETOS,
          frentes: DEMO_FRENTES,
          integrationStatus: 'local',
          activeProjectId: get().activeProjectId || DEMO_PROJETOS[0]?.id || null,
        })
      } else {
        set({ projetos: [], frentes: [], integrationStatus: 'local' })
      }
    }
    set({ loading: false })
  },

  fetchFrentes: async (projetoId) => {
    if (!projetoId) {
      set({ frentes: [] })
      return
    }
    // WCR live: com Supabase configurado, lê as frentes direto do banco.
    if (supabase) {
      try {
        const { data } = await supabase.from('frentes').select('*').eq('projeto_id', projetoId)
        if (data) {
          set((s) => ({
            frentes: [...s.frentes.filter((f) => f.projeto_id !== projetoId), ...(data as DbFrente[])],
            integrationStatus: s.integrationStatus === 'connected' ? 'connected' : 'partial',
          }))
          return
        }
      } catch {
        // cai no fluxo normal abaixo
      }
    }
    try {
      const payload = await apiProjetoDashboard(projetoId)
      const rows = (payload.frentes ?? []) as unknown as DbFrente[]
      if (rows.length > 0) {
        set((s) => ({
          frentes: [...s.frentes.filter((f) => f.projeto_id !== projetoId), ...rows],
          integrationStatus: payload.status === 'connected' ? 'connected' : s.integrationStatus,
        }))
        return
      }
    } catch {
      // fallback below
    }
    if (!supabase) {
      if (ALLOW_DEMO_DATA) {
        set((s) => ({
          frentes: [
            ...s.frentes.filter((f) => f.projeto_id !== projetoId),
            ...DEMO_FRENTES.filter((f) => f.projeto_id === projetoId),
          ],
        }))
      } else {
        set((s) => ({ frentes: s.frentes.filter((f) => f.projeto_id !== projetoId) }))
      }
      return
    }
    try {
      const { data } = await supabase.from('frentes').select('*').eq('projeto_id', projetoId)
      if (data) {
        set((s) => ({
          frentes: [...s.frentes.filter((f) => f.projeto_id !== projetoId), ...(data as DbFrente[])],
          integrationStatus: s.integrationStatus === 'connected' ? 'connected' : 'partial',
        }))
      }
    } catch {
      if (ALLOW_DEMO_DATA) {
        set((s) => ({
          frentes: [
            ...s.frentes.filter((f) => f.projeto_id !== projetoId),
            ...DEMO_FRENTES.filter((f) => f.projeto_id === projetoId),
          ],
        }))
      }
    }
  },

  addProjeto: async (p) => {
    try {
      const created = await apiCriarProjeto(p as unknown as Record<string, unknown>)
      const novo = created as unknown as DbProjeto
      set((s) => ({ projetos: [novo, ...s.projetos], integrationStatus: 'connected' }))
      return novo
    } catch {
      // fallback below
    }
    if (!supabase) {
      const novo: DbProjeto = { ...p, id: `prj-${Date.now()}`, created_at: new Date().toISOString() } as DbProjeto
      set((s) => ({ projetos: [novo, ...s.projetos] }))
      return novo
    }
    const { data, error } = await supabase.from('projetos').insert(p).select().single()
    if (error) throw error
    set((s) => ({ projetos: [data as DbProjeto, ...s.projetos] }))
    return data as DbProjeto
  },

  updateProjeto: async (id, patch) => {
    const prevProjetos = get().projetos
    const target = prevProjetos.find((p) => p.id === id)
    if (!target) return false

    // Optimistic local update so the UI (e outros consumidores, ex. DRE) reflete na hora.
    set((s) => ({
      projetos: s.projetos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))

    if (!supabase) {
      // Sem Supabase configurado: degrada gracioso — fica só local.
      return false
    }

    try {
      const { data, error } = await supabase.from('projetos').update(patch).eq('id', id).select().single()
      if (error) throw error
      set((s) => ({
        projetos: s.projetos.map((p) => (p.id === id ? (data as DbProjeto) : p)),
        integrationStatus: 'connected',
      }))
      return true
    } catch {
      // Reverte o otimista em caso de erro.
      set({ projetos: prevProjetos })
      return false
    }
  },

  addFrente: async (f) => {
    if (!supabase) {
      const nova: DbFrente = { ...f, id: `fr-${Date.now()}` }
      set((s) => ({ frentes: [...s.frentes, nova] }))
      return nova
    }
    const { data, error } = await supabase.from('frentes').insert(f).select().single()
    if (error) throw error
    set((s) => ({ frentes: [...s.frentes, data as DbFrente] }))
    return data as DbFrente
  },
}))
