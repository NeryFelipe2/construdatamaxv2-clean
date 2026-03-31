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
}))
