/**
 * projectContext.ts — Global project selector store.
 * Every module reads activeProjectId to filter data.
 */
import { create } from 'zustand'
import { supabase, type DbProjeto, type DbFrente } from '@/lib/supabase'

const STORAGE_KEY = 'cdata-active-project'

interface ProjectContextState {
  projetos: DbProjeto[]
  frentes: DbFrente[]
  activeProjectId: string | null
  loading: boolean

  // actions
  setActiveProject: (id: string) => void
  fetchProjetos: () => Promise<void>
  fetchFrentes: (projetoId: string) => Promise<void>
  addProjeto: (p: Omit<DbProjeto, 'id' | 'created_at'>) => Promise<DbProjeto | null>
  addFrente: (f: Omit<DbFrente, 'id'>) => Promise<DbFrente | null>
}

// Derived selectors (use outside of store to avoid infinite loops)
export function selectActiveProjeto(s: ProjectContextState): DbProjeto | null {
  return s.projetos.find(p => p.id === s.activeProjectId) ?? null
}
export function selectFrentesDoProjetoAtivo(s: ProjectContextState): DbFrente[] {
  return s.frentes.filter(f => f.projeto_id === s.activeProjectId)
}

// UUIDs reais dos projetos no Supabase (mesmos usados pelo Router WhatsApp)
// Essa sincronia permite que dados vindos do WhatsApp apareçam nos dashboards.
const DEMO_PROJETOS: DbProjeto[] = [
  {
    id: 'abe7f66c-004b-4bb5-a245-6be67debd9f7', nome: 'Consórcio Se Liga na Rede — SLNR Santos', contrato: 'CT 11481051', cidade: 'Santos',
    cliente: 'SABESP', tipo: 'esgoto', data_inicio: '2024-01-15', data_fim: '2025-12-31',
    orcamento_total: 45000000, status: 'ativo', responsavel_nome: 'Fabrizzio',
    responsavel_telefone: '5574999076534', created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'f3c6645b-347f-4382-b9c5-d103c27ec511', nome: 'Osasco — Rua Cuiabá', contrato: 'CAPEX Osasco', cidade: 'Osasco',
    cliente: 'CAPEX', tipo: 'esgoto', data_inicio: '2026-04-01', data_fim: '2028-03-31',
    orcamento_total: 28000000, status: 'ativo', responsavel_nome: 'Mateus Santos',
    responsavel_telefone: '5561991015639', created_at: '2026-04-07T00:00:00Z',
  },
  {
    id: 'ec112c9a-1669-4287-8079-526d6940ce82', nome: 'Pardinho — Itapetininga', contrato: 'Consórcio Itapetininga', cidade: 'Pardinho',
    cliente: 'Consórcio Itapetininga', tipo: 'esgoto', data_inicio: '2026-04-01', data_fim: '2027-12-31',
    orcamento_total: 32000000, status: 'ativo', responsavel_nome: 'Ícaro',
    responsavel_telefone: '5537998268576', created_at: '2026-04-07T00:00:00Z',
  },
  {
    id: '2a28beec-b1f8-4b0c-8416-d0710bb35d9d', nome: 'ConstruData Brasília', contrato: '-', cidade: 'Brasília',
    cliente: 'ConstruData', tipo: 'esgoto', data_inicio: '2024-01-15', data_fim: '2025-12-31',
    orcamento_total: 18750000, status: 'ativo', responsavel_nome: 'João',
    responsavel_telefone: '5561999996252', created_at: '2026-04-08T00:00:00Z',
  },
]

const UUID_CONSORCIO = 'abe7f66c-004b-4bb5-a245-6be67debd9f7'
const UUID_OSASCO    = 'f3c6645b-347f-4382-b9c5-d103c27ec511'
const UUID_PARDINHO  = 'ec112c9a-1669-4287-8079-526d6940ce82'
const UUID_BRASILIA  = '2a28beec-b1f8-4b0c-8416-d0710bb35d9d'

const DEMO_FRENTES: DbFrente[] = [
  // ─── Consórcio Se Liga na Rede ───
  { id: 'f-cons-1', projeto_id: UUID_CONSORCIO, nome: 'Sala Técnica', setor: 'Técnico', tipo_rede: 'esgoto', extensao_total: 26600, pvs_total: 185, status: 'ativa' },
  { id: 'f-cons-2', projeto_id: UUID_CONSORCIO, nome: 'Planejamento', setor: 'Planejamento', tipo_rede: 'esgoto', extensao_total: 0, pvs_total: 0, status: 'ativa' },
  { id: 'f-cons-3', projeto_id: UUID_CONSORCIO, nome: 'Produção', setor: 'Operacional', tipo_rede: 'esgoto', extensao_total: 12500, pvs_total: 85, status: 'ativa' },
  // ─── Osasco — Rua Cuiabá ───
  { id: 'f-osc-1', projeto_id: UUID_OSASCO, nome: 'Rua Cuiabá / Capex', setor: 'Centro Osasco', tipo_rede: 'esgoto', extensao_total: 6800, pvs_total: 48, status: 'ativa' },
  // ─── Pardinho — Itapetininga ───
  { id: 'f-pard-1', projeto_id: UUID_PARDINHO, nome: 'Frente Rede Principal', setor: 'Centro Pardinho', tipo_rede: 'esgoto', extensao_total: 9500, pvs_total: 68, status: 'ativa' },
  { id: 'f-pard-2', projeto_id: UUID_PARDINHO, nome: 'Frente Ligações Prediais', setor: 'Bairros', tipo_rede: 'esgoto', extensao_total: 4200, pvs_total: 0, status: 'ativa' },
  { id: 'f-pard-3', projeto_id: UUID_PARDINHO, nome: 'Frente ETE / Emissário', setor: 'Área Rural', tipo_rede: 'esgoto', extensao_total: 3100, pvs_total: 22, status: 'pausada' },
  // ─── ConstruData Brasília ───
  { id: 'f-bsb-1', projeto_id: UUID_BRASILIA, nome: 'Frente Principal', setor: 'Centro', tipo_rede: 'esgoto', extensao_total: 5000, pvs_total: 30, status: 'ativa' },
]

export const useProjectContext = create<ProjectContextState>((set, get) => ({
  projetos: DEMO_PROJETOS,
  frentes: DEMO_FRENTES,
  activeProjectId: (() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEMO_PROJETOS[0]?.id || null } catch { return DEMO_PROJETOS[0]?.id || null }
  })(),
  loading: false,

  setActiveProject: (id) => {
    try { localStorage.setItem(STORAGE_KEY, id) } catch { /* noop */ }
    set({ activeProjectId: id })
    get().fetchFrentes(id)
  },

  fetchProjetos: async () => {
    if (!supabase) return
    set({ loading: true })
    try {
      const { data } = await supabase.from('projetos').select('*').order('created_at', { ascending: false })
      if (data && data.length > 0) {
        set({ projetos: data as DbProjeto[] })
        const active = get().activeProjectId
        // Force reset if stored ID is a demo ID (not a valid UUID) or doesn't exist in real data
        const isValidUuid = active && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(active)
        const existsInData = isValidUuid && data.find((p: any) => p.id === active)
        if (!active || !existsInData) {
          get().setActiveProject(data[0].id)
        }
      }
    } catch { /* keep demo data */ }
    set({ loading: false })
  },

  fetchFrentes: async (projetoId) => {
    if (!supabase) return
    try {
      const { data } = await supabase.from('frentes').select('*').eq('projeto_id', projetoId)
      if (data) {
        set(s => ({
          frentes: [
            ...s.frentes.filter(f => f.projeto_id !== projetoId),
            ...(data as DbFrente[]),
          ]
        }))
      }
    } catch { /* keep demo */ }
  },

  addProjeto: async (p) => {
    if (!supabase) {
      // offline mode
      const novo: DbProjeto = { ...p, id: `prj-${Date.now()}`, created_at: new Date().toISOString() } as DbProjeto
      set(s => ({ projetos: [novo, ...s.projetos] }))
      return novo
    }
    const { data, error } = await supabase.from('projetos').insert(p).select().single()
    if (error) throw error
    set(s => ({ projetos: [data as DbProjeto, ...s.projetos] }))
    return data as DbProjeto
  },

  addFrente: async (f) => {
    if (!supabase) {
      const nova: DbFrente = { ...f, id: `fr-${Date.now()}` }
      set(s => ({ frentes: [...s.frentes, nova] }))
      return nova
    }
    const { data, error } = await supabase.from('frentes').insert(f).select().single()
    if (error) throw error
    set(s => ({ frentes: [...s.frentes, data as DbFrente] }))
    return data as DbFrente
  },
}))
