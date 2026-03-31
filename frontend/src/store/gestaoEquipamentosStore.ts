import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type { MaintenanceOrder, WorkOrderStatus } from '@/types'
import { mockMaintenanceOrders } from '@/data/mockGestaoEquipamentos'

interface GestaoState {
  orders: MaintenanceOrder[]
  editingOrderId: string | null   // 'new' | order.id | null

  addOrder:    (payload: Omit<MaintenanceOrder, 'id'>) => void
  updateOrder: (id: string, patch: Partial<MaintenanceOrder>) => void
  deleteOrder: (id: string) => void
  setEditingOrder: (id: string | null) => void
  loadDemoData: () => void
  clearData: () => void
}

export const useGestaoEquipamentosStore = create<GestaoState>((set) => ({
  orders: mockMaintenanceOrders,
  editingOrderId: null,

  addOrder: (payload) =>
    set((s) => ({
      orders: [...s.orders, { id: nanoid(), ...payload }],
    })),

  updateOrder: (id, patch) =>
    set((s) => ({
      orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  deleteOrder: (id) =>
    set((s) => ({
      orders: s.orders.filter((o) => o.id !== id),
    })),

  setEditingOrder: (id) => set({ editingOrderId: id }),

  loadDemoData: () =>
    set({ orders: mockMaintenanceOrders }),

  clearData: () =>
    set({ orders: [] }),
}))

// ─── Selector helpers ─────────────────────────────────────────────────────────

export function filterByStatus(orders: MaintenanceOrder[], status: WorkOrderStatus | 'all') {
  return status === 'all' ? orders : orders.filter((o) => o.status === status)
}
