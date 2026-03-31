/**
 * Gestão de Projeto 360 — Command Centre store.
 *
 * Security: all inputs are TypeScript-typed; IDs generated with crypto.randomUUID();
 * no sensitive data persisted to localStorage; no external API calls.
 */
import { create } from 'zustand'
import type { ChangeOrder, ChangeOrderPhoto, ChangeOrderStatus, ChangeOrderType } from '@/types'
import { MOCK_CHANGE_ORDERS } from '@/data/mockGestao360'
import {
  apiDashboard,
  apiCurvaS,
  apiCronograma,
  apiNsList,
  apiRdoList,
  apiManageRede,
} from '@/lib/api'

export type Gestao360Tab = 'dashboard' | 'jobacosting' | 'changeorders' | 'command' | 'simulation'

// Backend data shapes (loosely typed to avoid coupling to API internals)
type DashboardData  = Awaited<ReturnType<typeof apiDashboard>>
type CurvaSData     = Awaited<ReturnType<typeof apiCurvaS>>
type CronogramaData = Awaited<ReturnType<typeof apiCronograma>>
type RedeData       = Awaited<ReturnType<typeof apiManageRede>>

interface Gestao360State {
  changeOrders:      ChangeOrder[]
  selectedProjectId: string | null
  activeTab:         Gestao360Tab

  // Backend flag & live data
  useBackend:    boolean
  backendLoading: boolean
  backendError:  string | null
  dashboard:     DashboardData | null
  curvaS:        CurvaSData | null
  cronograma:    CronogramaData | null
  nsList:        Array<Record<string, unknown>>
  rdoList:       Array<Record<string, unknown>>
  rede:          RedeData | null

  fetchFromBackend: (nucleo?: string) => Promise<void>

  // Navigation
  selectProject: (id: string | null) => void
  setActiveTab:  (tab: Gestao360Tab) => void

  // Change order actions
  addChangeOrder: (co: {
    projectId: string
    projectCode: string
    title: string
    type: ChangeOrderType
    description: string
    impactCostBRL: number
    impactDays: number
    submittedBy: string
    linkedModule?: string
    linkedEntityId?: string
  }) => string   // returns new id

  submitChangeOrder:  (id: string) => void
  reviewChangeOrder:  (id: string, decision: 'approved' | 'rejected', reviewer: string, notes: string) => void
  addPhoto:           (orderId: string, photo: Omit<ChangeOrderPhoto, 'id'>) => void
  deleteChangeOrder:  (id: string) => void

  // Demo
  loadDemoData: () => void
  clearData:    () => void
}

export const useGestao360Store = create<Gestao360State>((set, get) => ({
  changeOrders:      [],
  selectedProjectId: null,
  activeTab:         'dashboard',

  useBackend:     true,
  backendLoading: false,
  backendError:   null,
  dashboard:      null,
  curvaS:         null,
  cronograma:     null,
  nsList:         [],
  rdoList:        [],
  rede:           null,

  fetchFromBackend: async (nucleo?: string) => {
    if (!get().useBackend) return
    set({ backendLoading: true, backendError: null })
    try {
      const [dashboard, curvaS, cronograma, nsResp, rdoResp, rede] = await Promise.all([
        apiDashboard(nucleo),
        apiCurvaS(nucleo),
        apiCronograma(nucleo),
        apiNsList(nucleo),
        apiRdoList(nucleo),
        apiManageRede(nucleo),
      ])
      set({
        dashboard,
        curvaS,
        cronograma,
        nsList:  nsResp.items,
        rdoList: rdoResp.items,
        rede,
        backendLoading: false,
      })
    } catch (err) {
      // Graceful fallback: keep whatever data is already in the store (mock or previous fetch)
      set({ backendLoading: false, backendError: err instanceof Error ? err.message : String(err) })
    }
  },

  selectProject: (id) => set({ selectedProjectId: id }),
  setActiveTab:  (tab) => set({ activeTab: tab }),

  addChangeOrder: (payload) => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const co: ChangeOrder = {
      ...payload,
      id,
      status: 'draft' as ChangeOrderStatus,
      photos: [],
      submittedAt: now,
    }
    set((s) => ({ changeOrders: [co, ...s.changeOrders] }))
    return id
  },

  submitChangeOrder: (id) =>
    set((s) => ({
      changeOrders: s.changeOrders.map((co) =>
        co.id === id ? { ...co, status: 'submitted' } : co
      ),
    })),

  reviewChangeOrder: (id, decision, reviewer, notes) => {
    const now = new Date().toISOString()
    set((s) => ({
      changeOrders: s.changeOrders.map((co) =>
        co.id === id
          ? { ...co, status: decision, reviewedBy: reviewer, reviewedAt: now, reviewNotes: notes }
          : co
      ),
    }))
  },

  addPhoto: (orderId, photo) => {
    const photoWithId: ChangeOrderPhoto = { ...photo, id: crypto.randomUUID() }
    set((s) => ({
      changeOrders: s.changeOrders.map((co) =>
        co.id === orderId ? { ...co, photos: [...co.photos, photoWithId] } : co
      ),
    }))
  },

  deleteChangeOrder: (id) =>
    set((s) => ({ changeOrders: s.changeOrders.filter((co) => co.id !== id) })),

  loadDemoData: () => {
    // Set selectedProjectId to first project in projetosStore
    import('./projetosStore').then(({ useProjetosStore }) => {
      const projects = useProjetosStore.getState().projects
      const firstId  = projects[0]?.id ?? null
      set({ changeOrders: MOCK_CHANGE_ORDERS, selectedProjectId: firstId })
    })
  },

  clearData: () => set({ changeOrders: [], selectedProjectId: null }),
}))
