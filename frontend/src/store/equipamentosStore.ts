import { create } from 'zustand'
import type { EquipmentAlert, EquipmentProfile } from '@/types'
import { mockEquipamentos } from '@/data/mockEquipamentos'

interface EquipamentosState {
  equipamentos: EquipmentProfile[]
  selectedId: string | null
  editingId: string | null   // 'new' | equipamento.id | null

  addEquipamento: (eq: Omit<EquipmentProfile, 'id' | 'alerts'>) => void
  updateEquipamento: (id: string, updates: Partial<Omit<EquipmentProfile, 'id' | 'alerts'>>) => void
  deleteEquipamento: (id: string) => void
  updateLocation: (id: string, lat: number, lng: number) => void
  acknowledgeAlert: (equipmentId: string, alertId: string) => void
  addAlert: (equipmentId: string, alert: Omit<EquipmentAlert, 'id' | 'equipmentId' | 'timestamp' | 'acknowledged'>) => void
  selectEquipamento: (id: string | null) => void
  setEditing: (id: string | null) => void
  loadDemoData: () => void
  clearData: () => void
}

export const useEquipamentosStore = create<EquipamentosState>((set) => ({
  equipamentos: mockEquipamentos,
  selectedId: null,
  editingId: null,

  addEquipamento: (eq) =>
    set((s) => ({
      equipamentos: [...s.equipamentos, { ...eq, id: crypto.randomUUID(), alerts: [] }],
    })),

  updateEquipamento: (id, updates) =>
    set((s) => ({
      equipamentos: s.equipamentos.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),

  deleteEquipamento: (id) =>
    set((s) => ({
      equipamentos: s.equipamentos.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      editingId: s.editingId === id ? null : s.editingId,
    })),

  // Called when a marker is dragged on the map
  updateLocation: (id, lat, lng) =>
    set((s) => ({
      equipamentos: s.equipamentos.map((e) => (e.id === id ? { ...e, lat, lng } : e)),
    })),

  acknowledgeAlert: (equipmentId, alertId) =>
    set((s) => ({
      equipamentos: s.equipamentos.map((e) =>
        e.id !== equipmentId
          ? e
          : {
              ...e,
              alerts: e.alerts.map((a) =>
                a.id === alertId ? { ...a, acknowledged: true } : a
              ),
            }
      ),
    })),

  addAlert: (equipmentId, alert) =>
    set((s) => ({
      equipamentos: s.equipamentos.map((e) =>
        e.id !== equipmentId
          ? e
          : {
              ...e,
              alerts: [
                ...e.alerts,
                {
                  ...alert,
                  id: crypto.randomUUID(),
                  equipmentId,
                  timestamp: new Date().toISOString(),
                  acknowledged: false,
                },
              ],
            }
      ),
    })),

  selectEquipamento: (id) => set({ selectedId: id }),
  setEditing: (id) => set({ editingId: id }),

  loadDemoData: () =>
    set({ equipamentos: mockEquipamentos }),

  clearData: () =>
    set({ equipamentos: [], selectedId: null }),
}))
