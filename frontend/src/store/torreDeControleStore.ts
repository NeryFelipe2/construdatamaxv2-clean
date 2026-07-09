import { create } from 'zustand'
import { MOCK_OBRAS } from '@/data/mockTorreDeControle'
import { apiProjetoDashboard, apiProjetoTorre } from '@/lib/api'
import { mapDbProjetoToConstructionSite } from '@/lib/canonicalProject'
import type { DbProjeto } from '@/lib/supabase'
import type { ConstructionRisk, ConstructionSite } from '@/types'

const ALLOW_DEMO_DATA = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEMO_DATA === 'true'

interface EditingRisk {
  siteId: string
  riskId: string | 'new'
}

interface TorreState {
  sites: ConstructionSite[]
  selectedId: string | null
  editingId: string | null
  editingRisk: EditingRisk | null
}

interface TorreActions {
  addSite: (payload: Omit<ConstructionSite, 'id'>) => void
  updateSite: (id: string, patch: Partial<Omit<ConstructionSite, 'id'>>) => void
  deleteSite: (id: string) => void
  updateLocation: (id: string, lat: number, lng: number) => void
  selectSite: (id: string | null) => void
  setEditing: (id: string | null) => void
  setEditingRisk: (args: EditingRisk | null) => void
  addRisk: (siteId: string, risk: Omit<ConstructionRisk, 'id'>) => void
  updateRisk: (siteId: string, riskId: string, patch: Partial<Omit<ConstructionRisk, 'id'>>) => void
  deleteRisk: (siteId: string, riskId: string) => void
  loadDemoData: () => void
  clearData: () => void
  loadFromPipeline: () => void
  loadFromProjectContext: () => Promise<void>
}

function mergeSite(existing: ConstructionSite | undefined, incoming: ConstructionSite): ConstructionSite {
  if (!existing) return incoming
  return {
    ...existing,
    ...incoming,
    risks: incoming.risks.length > 0 ? incoming.risks : existing.risks,
    budgetLines: incoming.budgetLines?.length ? incoming.budgetLines : existing.budgetLines,
    planningMilestones: incoming.planningMilestones?.length ? incoming.planningMilestones : existing.planningMilestones,
    executionMilestones: incoming.executionMilestones?.length ? incoming.executionMilestones : existing.executionMilestones,
  }
}

export const useTorreStore = create<TorreState & TorreActions>((set, get) => ({
  sites: [],
  selectedId: null,
  editingId: null,
  editingRisk: null,

  addSite: (payload) =>
    set((state) => {
      const id = `obr-${Date.now()}`
      return { sites: [...state.sites, { ...payload, id }], selectedId: id }
    }),

  updateSite: (id, patch) =>
    set((state) => ({
      sites: state.sites.map((site) => (site.id === id ? { ...site, ...patch } : site)),
    })),

  deleteSite: (id) =>
    set((state) => {
      const remaining = state.sites.filter((site) => site.id !== id)
      return {
        sites: remaining,
        selectedId: remaining[0]?.id ?? null,
        editingId: null,
      }
    }),

  updateLocation: (id, lat, lng) =>
    set((state) => ({
      sites: state.sites.map((site) => (site.id === id ? { ...site, lat, lng } : site)),
    })),

  selectSite: (id) => set({ selectedId: id }),
  setEditing: (id) => set({ editingId: id }),
  setEditingRisk: (args) => set({ editingRisk: args }),

  addRisk: (siteId, risk) =>
    set((state) => ({
      sites: state.sites.map((site) =>
        site.id === siteId
          ? { ...site, risks: [...site.risks, { ...risk, id: `risk-${Date.now()}` }] }
          : site,
      ),
    })),

  updateRisk: (siteId, riskId, patch) =>
    set((state) => ({
      sites: state.sites.map((site) =>
        site.id === siteId
          ? { ...site, risks: site.risks.map((risk) => (risk.id === riskId ? { ...risk, ...patch } : risk)) }
          : site,
      ),
    })),

  deleteRisk: (siteId, riskId) =>
    set((state) => ({
      sites: state.sites.map((site) =>
        site.id === siteId
          ? { ...site, risks: site.risks.filter((risk) => risk.id !== riskId) }
          : site,
      ),
    })),

  loadDemoData: () => set({ sites: MOCK_OBRAS, selectedId: MOCK_OBRAS[0]?.id ?? null }),
  clearData: () => set({ sites: [], selectedId: null }),

  loadFromPipeline: () => {
    import('./pipelineStore').then(({ usePipelineStore }) => {
      const { nodes, summary, hasRealData, dashboard } = usePipelineStore.getState()
      if (!hasRealData || !summary) return

      const avgLat = nodes.length > 0 ? nodes.reduce((sum, node) => sum + node.lat, 0) / nodes.length : -23.55
      const avgLng = nodes.length > 0 ? nodes.reduce((sum, node) => sum + node.lng, 0) / nodes.length : -46.63
      const dash = dashboard as Record<string, unknown> | null
      const pctFisico = dash?.pct_fisico != null ? Number(dash.pct_fisico) : 0

      const newSite: ConstructionSite = {
        id: `pipeline-${summary.nucleo || Date.now()}`,
        code: `REDE-${summary.nucleo || 'PIPELINE'}`,
        name: `Rede ${summary.nucleo || 'Pipeline'}`,
        company: 'FCN Construcoes e Saneamento',
        owner: 'SABESP',
        manager: '',
        description: `Rede de saneamento - ${summary.nucleo || 'Pipeline'}`,
        status: pctFisico >= 100 ? 'completed' : pctFisico > 0 ? 'active' : 'planning',
        street: '',
        number: '',
        district: '',
        city: 'Sao Paulo',
        state: 'SP',
        cep: '',
        buildingType: 'saneamento',
        totalArea: dash?.ext_m_total != null ? Number(dash.ext_m_total) : 0,
        floors: 1,
        startDate: new Date().toISOString().slice(0, 10),
        expectedEnd: '',
        lat: avgLat,
        lng: avgLng,
        risks: [],
      }

      set((state) => {
        const exists = state.sites.some((site) => site.id === newSite.id)
        return {
          sites: exists
            ? state.sites.map((site) => (site.id === newSite.id ? { ...site, ...newSite, risks: site.risks } : site))
            : [...state.sites, newSite],
          selectedId: newSite.id,
        }
      })
    })
  },

  loadFromProjectContext: async () => {
    // WCR demo mode: skip backend (uses static wcr_db.json data)
    if (import.meta.env.VITE_ENABLE_DEMO_DATA === 'true') {
      set({ sites: MOCK_OBRAS, selectedId: MOCK_OBRAS[0]?.id ?? null })
      return
    }
    try {
      const [{ useProjectContext }] = await Promise.all([import('./projectContext')])
      const { projetos, activeProjectId } = useProjectContext.getState()
      if (!projetos.length) {
        if (ALLOW_DEMO_DATA) set({ sites: MOCK_OBRAS, selectedId: MOCK_OBRAS[0]?.id ?? null })
        return
      }

      const dashboard = activeProjectId ? await apiProjetoDashboard(activeProjectId).catch(() => null) : null
      const torre = activeProjectId ? await apiProjetoTorre(activeProjectId).catch(() => null) : null

      const nextSites = projetos.map((projeto) => {
        const existing = get().sites.find((site) => site.id === projeto.id)
        const isActive = projeto.id === activeProjectId
        const mapped = mapDbProjetoToConstructionSite(projeto as DbProjeto, {
          existing,
          dashboard: isActive ? dashboard : null,
          torre: isActive ? torre : null,
        })
        return mergeSite(existing, mapped)
      })

      set({
        sites: nextSites,
        selectedId: activeProjectId && nextSites.some((site) => site.id === activeProjectId)
          ? activeProjectId
          : nextSites[0]?.id ?? null,
      })
    } catch {
      if (ALLOW_DEMO_DATA) set({ sites: MOCK_OBRAS, selectedId: MOCK_OBRAS[0]?.id ?? null })
      else set({ sites: [], selectedId: null })
    }
  },
}))
