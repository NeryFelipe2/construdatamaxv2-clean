import { create } from 'zustand'
import { supabase, type DbProjeto, type DbFrente } from '@/lib/supabase'

const STORAGE_KEY = 'cdata-active-project'

interface ProjectContextState {
  projetos: DbProjeto[]
  frentes: DbFrente[]
  activeProjectId: string | null
  loading: boolean
  setActiveProject: (id: string) => void
  fetchProjetos: () => Promise<void>
  fetchFrentes: (projetoId: string) => Promise<void>
  addProjeto: (p: Omit<DbProjeto, 'id' | 'created_at'>) => Promise<DbProjeto | null>
  addFrente: (f: Omit<DbFrente, 'id'>) => Promise<DbFrente | null>
}

export function selectActiveProjeto(s: ProjectContextState): DbProjeto | null {
  return s.projetos.find((p) => p.id === s.activeProjectId) ?? null
}

export function selectFrentesDoProjetoAtivo(s: ProjectContextState): DbFrente[] {
  return s.frentes.filter((f) => f.projeto_id === s.activeProjectId)
}

const UUID_TATUI = 'c2bf8fda-1111-4444-8888-aaaaaaaaaaaa'
const UUID_OSASCO = 'f3c6645b-347f-4382-b9c5-d103c27ec511'
const UUID_CONSORCIO = 'abe7f66c-004b-4bb5-a245-6be67debd9f7'
const UUID_PARDINHO = 'ec112c9a-1669-4287-8079-526d6940ce82'
const UUID_BRASILIA = '2a28beec-b1f8-4b0c-8416-d0710bb35d9d'
const UUID_RKSUB = 'd4e5f6a7-1111-2222-3333-bbbbbbbbbbbb'

const DEMO_PROJETOS: DbProjeto[] = [
  {
    id: UUID_TATUI,
    nome: 'Tatui - RK',
    contrato: 'CT-TATUI-2026',
    cidade: 'Tatui',
    cliente: 'RK',
    tipo: 'esgoto',
    data_inicio: '2026-04-01',
    data_fim: '2027-12-31',
    orcamento_total: 18000000,
    status: 'ativo',
    responsavel_nome: 'Felipe Nery',
    responsavel_telefone: '5561981846325',
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: UUID_OSASCO,
    nome: 'Osasco - Rua Cuiaba',
    contrato: 'CT-CLU-OSC-2026',
    cidade: 'Osasco',
    cliente: 'RK',
    tipo: 'esgoto',
    data_inicio: '2026-04-01',
    data_fim: '2027-12-31',
    orcamento_total: 28000000,
    status: 'ativo',
    responsavel_nome: 'Mateus Santos',
    responsavel_telefone: '5561991015639',
    created_at: '2026-04-07T00:00:00Z',
  },
  {
    id: UUID_CONSORCIO,
    nome: 'Consorcio Se Liga na Rede - SLNR Santos',
    contrato: 'CT-11481051',
    cidade: 'Santos',
    cliente: 'Consorcio',
    tipo: 'esgoto',
    data_inicio: '2026-04-01',
    data_fim: '2027-12-31',
    orcamento_total: 45000000,
    status: 'ativo',
    responsavel_nome: 'Felipe Nery',
    responsavel_telefone: '5561981846325',
    created_at: '2026-04-01T00:00:00Z',
  },
  {
    id: UUID_PARDINHO,
    nome: 'Pardinho - Consorcio Itapetininga',
    contrato: 'PARD-2026',
    cidade: 'Pardinho',
    cliente: 'Consorcio Itapetininga',
    tipo: 'esgoto',
    data_inicio: '2026-04-01',
    data_fim: '2027-12-31',
    orcamento_total: 32000000,
    status: 'ativo',
    responsavel_nome: 'Fabio',
    responsavel_telefone: '5537999000001',
    created_at: '2026-04-07T00:00:00Z',
  },
  {
    id: UUID_BRASILIA,
    nome: 'ConstruData Brasilia',
    contrato: 'CD-BSB-2026',
    cidade: 'Brasilia',
    cliente: 'ConstruData',
    tipo: 'esgoto',
    data_inicio: '2026-04-01',
    data_fim: '2027-12-31',
    orcamento_total: 18750000,
    status: 'ativo',
    responsavel_nome: 'Joao',
    responsavel_telefone: '5561999996252',
    created_at: '2026-04-08T00:00:00Z',
  },
  {
    id: UUID_RKSUB,
    nome: 'RK SUB Empreita',
    contrato: 'RK-SUB-2026',
    cidade: 'Santos',
    cliente: 'RK',
    tipo: 'esgoto',
    data_inicio: '2026-04-01',
    data_fim: '2027-12-31',
    orcamento_total: 23000000,
    status: 'ativo',
    responsavel_nome: 'Felipe Nery',
    responsavel_telefone: '5561981846325',
    created_at: '2026-04-08T00:00:00Z',
  },
]

const DEMO_FRENTES: DbFrente[] = [
  { id: 'f-tatui-1', projeto_id: UUID_TATUI, nome: 'Frente Tatui Principal', setor: 'Campo', tipo_rede: 'esgoto', extensao_total: 7200, pvs_total: 40, status: 'ativa' },
  { id: 'f-osc-1', projeto_id: UUID_OSASCO, nome: 'Rua Cuiaba / CLU', setor: 'Osasco', tipo_rede: 'esgoto', extensao_total: 6800, pvs_total: 48, status: 'ativa' },
  { id: 'f-cons-1', projeto_id: UUID_CONSORCIO, nome: 'Sala Tecnica', setor: 'Tecnico', tipo_rede: 'esgoto', extensao_total: 26600, pvs_total: 185, status: 'ativa' },
  { id: 'f-cons-2', projeto_id: UUID_CONSORCIO, nome: 'Planejamento', setor: 'Planejamento', tipo_rede: 'esgoto', extensao_total: 0, pvs_total: 0, status: 'ativa' },
  { id: 'f-cons-3', projeto_id: UUID_CONSORCIO, nome: 'Producao', setor: 'Operacional', tipo_rede: 'esgoto', extensao_total: 12500, pvs_total: 85, status: 'ativa' },
  { id: 'f-pard-1', projeto_id: UUID_PARDINHO, nome: 'Frente Rede Principal', setor: 'Centro Pardinho', tipo_rede: 'esgoto', extensao_total: 9500, pvs_total: 68, status: 'ativa' },
  { id: 'f-pard-2', projeto_id: UUID_PARDINHO, nome: 'Frente Ligacoes Prediais', setor: 'Bairros', tipo_rede: 'esgoto', extensao_total: 4200, pvs_total: 0, status: 'ativa' },
  { id: 'f-bsb-1', projeto_id: UUID_BRASILIA, nome: 'Frente Principal', setor: 'Centro', tipo_rede: 'esgoto', extensao_total: 5000, pvs_total: 30, status: 'ativa' },
  { id: 'f-rksub-1', projeto_id: UUID_RKSUB, nome: 'Subempreita Santos', setor: 'Santos', tipo_rede: 'esgoto', extensao_total: 6400, pvs_total: 39, status: 'ativa' },
]

export const useProjectContext = create<ProjectContextState>((set, get) => ({
  projetos: DEMO_PROJETOS,
  frentes: DEMO_FRENTES,
  activeProjectId: (() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEMO_PROJETOS[0]?.id || null
    } catch {
      return DEMO_PROJETOS[0]?.id || null
    }
  })(),
  loading: false,

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
    if (!supabase) return
    set({ loading: true })
    try {
      const { data } = await supabase.from('projetos').select('*').order('created_at', { ascending: false })
      if (data && data.length > 0) {
        set({ projetos: data as DbProjeto[] })
        const active = get().activeProjectId
        const existsInData = active && data.find((p: any) => p.id === active)
        if (!active || !existsInData) get().setActiveProject(data[0].id)
      }
    } catch {
      // keep demo data
    }
    set({ loading: false })
  },

  fetchFrentes: async (projetoId) => {
    if (!supabase) return
    try {
      const { data } = await supabase.from('frentes').select('*').eq('projeto_id', projetoId)
      if (data) {
        set((s) => ({
          frentes: [...s.frentes.filter((f) => f.projeto_id !== projetoId), ...(data as DbFrente[])],
        }))
      }
    } catch {
      // keep demo
    }
  },

  addProjeto: async (p) => {
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
