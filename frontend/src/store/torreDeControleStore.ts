import { create } from 'zustand'
import { MOCK_OBRAS } from '@/data/mockTorreDeControle'
import type { ConstructionSite, ConstructionRisk } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface EditingRisk {
  siteId: string
  riskId: string | 'new'
}

interface TorreState {
  sites: ConstructionSite[]
  selectedId: string | null
  editingId: string | null      // 'new' | site.id | null
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
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useTorreStore = create<TorreState & TorreActions>((set) => ({
  // ── Initial state ──────────────────────────────────────────────────────────
  sites: MOCK_OBRAS,
  selectedId: MOCK_OBRAS[0]?.id ?? null,
  editingId: null,
  editingRisk: null,

  // ── Site CRUD ──────────────────────────────────────────────────────────────
  addSite: (payload) =>
    set((s) => {
      const id = `obr-${Date.now()}`
      return { sites: [...s.sites, { ...payload, id }], selectedId: id }
    }),

  updateSite: (id, patch) =>
    set((s) => ({
      sites: s.sites.map((site) => (site.id === id ? { ...site, ...patch } : site)),
    })),

  deleteSite: (id) =>
    set((s) => {
      const remaining = s.sites.filter((site) => site.id !== id)
      return {
        sites: remaining,
        selectedId: remaining[0]?.id ?? null,
        editingId: null,
      }
    }),

  updateLocation: (id, lat, lng) =>
    set((s) => ({
      sites: s.sites.map((site) => (site.id === id ? { ...site, lat, lng } : site)),
    })),

  // ── Selection ──────────────────────────────────────────────────────────────
  selectSite: (id) => set({ selectedId: id }),

  // ── Dialog state ───────────────────────────────────────────────────────────
  setEditing: (id) => set({ editingId: id }),
  setEditingRisk: (args) => set({ editingRisk: args }),

  // ── Risk CRUD ──────────────────────────────────────────────────────────────
  addRisk: (siteId, risk) =>
    set((s) => ({
      sites: s.sites.map((site) =>
        site.id === siteId
          ? { ...site, risks: [...site.risks, { ...risk, id: `risk-${Date.now()}` }] }
          : site
      ),
    })),

  updateRisk: (siteId, riskId, patch) =>
    set((s) => ({
      sites: s.sites.map((site) =>
        site.id === siteId
          ? { ...site, risks: site.risks.map((r) => (r.id === riskId ? { ...r, ...patch } : r)) }
          : site
      ),
    })),

  deleteRisk: (siteId, riskId) =>
    set((s) => ({
      sites: s.sites.map((site) =>
        site.id === siteId
          ? { ...site, risks: site.risks.filter((r) => r.id !== riskId) }
          : site
      ),
    })),

  loadDemoData: () =>
    set({ sites: MOCK_OBRAS, selectedId: MOCK_OBRAS[0]?.id ?? null }),

  clearData: () =>
    set({ sites: [], selectedId: null }),

  /**
   * Carrega dados do pipelineStore central (integração ConstruData).
   * Cria um site na Torre de Controle para cada núcleo com dados do pipeline.
   */
  loadFromPipeline: () => {
    import('./pipelineStore').then(({ usePipelineStore }) => {
      const { nodes, summary, nsList, hasRealData, dashboard } = usePipelineStore.getState()
      if (!hasRealData || !summary) return

      // Centro geográfico dos nós
      const avgLat = nodes.length > 0 ? nodes.reduce((s, n) => s + n.lat, 0) / nodes.length : -23.55
      const avgLng = nodes.length > 0 ? nodes.reduce((s, n) => s + n.lng, 0) / nodes.length : -46.63

      const dash = dashboard as Record<string, unknown> | null
      const pctFisico = dash?.pct_fisico != null ? Number(dash.pct_fisico) : 0

      const newSite: ConstructionSite = {
        id: `pipeline-${summary.nucleo || Date.now()}`,
        code: `REDE-${summary.nucleo || 'PIPELINE'}`,
        name: `Rede ${summary.nucleo || 'Pipeline'}`,
        company: 'FCN Construções e Saneamento',
        owner: 'SABESP',
        manager: '',
        description: `Rede de saneamento - ${summary.nucleo || 'Pipeline'}`,
        status: pctFisico >= 100 ? 'completed' : pctFisico > 0 ? 'active' : 'planning',
        street: '',
        number: '',
        district: '',
        city: 'São Paulo',
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

      set((s) => {
        // Atualiza se já existe, adiciona se não
        const exists = s.sites.some(site => site.id === newSite.id)
        return {
          sites: exists
            ? s.sites.map(site => site.id === newSite.id ? { ...site, ...newSite, risks: site.risks } : site)
            : [...s.sites, newSite],
          selectedId: newSite.id,
        }
      })
    })
  },
}))
