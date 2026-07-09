/**
 * Kanban de Frota WCR — alocação equipe × equipamento e fluxo "pedir saída".
 * Dados reais de CONTROLE DE FROTA.xlsx (src/data/wcrFrota.ts).
 * Persiste o estado do quadro em localStorage (sobrevive ao reload).
 */
import { create } from 'zustand'
import { WCR_FROTA, type FrotaItem, type FrotaStatus } from '@/data/wcrFrota'

const STORAGE_KEY = 'wcr-frota-kanban'

function hydrate(): FrotaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return WCR_FROTA
    const saved = JSON.parse(raw) as Partial<FrotaItem>[]
    const byId = new Map(saved.map((s) => [s.id, s]))
    // Base sempre é WCR_FROTA (fonte da verdade); aplica só status/equipe salvos.
    return WCR_FROTA.map((item) => {
      const s = byId.get(item.id)
      return s ? { ...item, status: (s.status as FrotaStatus) ?? item.status, equipe: s.equipe ?? item.equipe } : item
    })
  } catch {
    return WCR_FROTA
  }
}

function persist(items: FrotaItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map((i) => ({ id: i.id, status: i.status, equipe: i.equipe }))))
  } catch {
    // sem persistência — segue em memória
  }
}

interface FrotaKanbanState {
  items: FrotaItem[]
  moveItem: (id: string, status: FrotaStatus) => void
  setEquipe: (id: string, equipe: string) => void
  reset: () => void
}

export const useFrotaKanbanStore = create<FrotaKanbanState>((set) => ({
  items: hydrate(),

  moveItem: (id, status) =>
    set((state) => {
      const items = state.items.map((i) => (i.id === id ? { ...i, status } : i))
      persist(items)
      return { items }
    }),

  setEquipe: (id, equipe) =>
    set((state) => {
      const items = state.items.map((i) => (i.id === id ? { ...i, equipe } : i))
      persist(items)
      return { items }
    }),

  reset: () =>
    set(() => {
      persist(WCR_FROTA)
      return { items: WCR_FROTA }
    }),
}))
