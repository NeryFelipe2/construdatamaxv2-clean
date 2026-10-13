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
  // última definição canônica conhecida (do useFrota/Supabase, ou WCR_FROTA
  // como fallback) — usada por reset().
  frotaDef: FrotaItem[]
  moveItem: (id: string, status: FrotaStatus) => void
  setEquipe: (id: string, equipe: string) => void
  reset: () => void
  // troca a base pela definição canônica do banco (chamado pela página quando
  // `useFrota()` resolve/atualiza) — preserva o que ainda não foi persistido
  // localmente só na primeira carga; depois disso o banco manda.
  setDefinicoes: (veiculosData: FrotaItem[]) => void
}

export const useFrotaKanbanStore = create<FrotaKanbanState>((set) => ({
  items: hydrate(),
  frotaDef: WCR_FROTA,

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
    set((state) => {
      persist(state.frotaDef)
      return { items: state.frotaDef }
    }),

  setDefinicoes: (veiculosData) =>
    set(() => {
      persist(veiculosData)
      return { items: veiculosData, frotaDef: veiculosData }
    }),
}))
