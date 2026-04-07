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

// Demo data when Supabase is not connected
const DEMO_PROJETOS: DbProjeto[] = [
  {
    id: 'demo-1', nome: 'SLNR Santos', contrato: 'CT 11481051', cidade: 'Santos',
    cliente: 'Sabesp', tipo: 'esgoto', data_inicio: '2024-01-15', data_fim: '2025-12-31',
    orcamento_total: 45000000, status: 'ativo', responsavel_nome: 'Felipe Nery',
    responsavel_telefone: '5513999999999', created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'demo-2', nome: 'Osasco Saneamento Norte', contrato: 'CT 2024-OSC', cidade: 'Osasco',
    cliente: 'Prefeitura Osasco', tipo: 'misto', data_inicio: '2024-06-01', data_fim: '2026-06-01',
    orcamento_total: 28000000, status: 'ativo', responsavel_nome: 'Bruno Silva',
    responsavel_telefone: '5511988888888', created_at: '2024-06-01T00:00:00Z',
  },
  {
    id: 'pardinho-1', nome: 'Pardinho — Consórcio Itapetininga', contrato: 'CT-PARDINHO-2026', cidade: 'Pardinho',
    cliente: 'Consórcio Itapetininga', tipo: 'esgoto', data_inicio: '2026-04-01', data_fim: '2027-12-31',
    orcamento_total: 32000000, status: 'ativo', responsavel_nome: 'Luiz Fernando',
    responsavel_telefone: '5537999425397', created_at: '2026-04-07T00:00:00Z',
  },
]

const DEMO_FRENTES: DbFrente[] = [
  { id: 'f-1', projeto_id: 'demo-1', nome: 'Verde e Teteu', setor: 'Zona Norte', tipo_rede: 'esgoto', extensao_total: 12500, pvs_total: 85, status: 'ativa' },
  { id: 'f-2', projeto_id: 'demo-1', nome: 'Pantanal', setor: 'Zona Leste', tipo_rede: 'esgoto', extensao_total: 8700, pvs_total: 62, status: 'ativa' },
  { id: 'f-3', projeto_id: 'demo-1', nome: 'Sao Manoel', setor: 'Centro', tipo_rede: 'esgoto', extensao_total: 5400, pvs_total: 38, status: 'pausada' },
  { id: 'f-4', projeto_id: 'demo-2', nome: 'Frente Norte A', setor: 'Norte', tipo_rede: 'agua', extensao_total: 6000, pvs_total: 42, status: 'ativa' },
  { id: 'f-5', projeto_id: 'demo-2', nome: 'Frente Norte B', setor: 'Norte', tipo_rede: 'esgoto', extensao_total: 7200, pvs_total: 51, status: 'ativa' },
  // ─── Pardinho — Consórcio Itapetininga ───
  { id: 'f-pard-1', projeto_id: 'pardinho-1', nome: 'Frente Rede Principal', setor: 'Centro Pardinho', tipo_rede: 'esgoto', extensao_total: 9500, pvs_total: 68, status: 'ativa' },
  { id: 'f-pard-2', projeto_id: 'pardinho-1', nome: 'Frente Ligações Prediais', setor: 'Bairros', tipo_rede: 'esgoto', extensao_total: 4200, pvs_total: 0, status: 'ativa' },
  { id: 'f-pard-3', projeto_id: 'pardinho-1', nome: 'Frente ETE / Emissário', setor: 'Área Rural', tipo_rede: 'esgoto', extensao_total: 3100, pvs_total: 22, status: 'planejada' },
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
        if (!active || !data.find((p: any) => p.id === active)) {
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
