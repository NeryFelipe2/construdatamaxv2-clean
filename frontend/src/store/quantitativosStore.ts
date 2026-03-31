/**
 * quantitativosStore.ts — Zustand store for the Quantitativos e Orçamento module.
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - PDF/Excel parsing: text extraction only, no eval
 *  - Cross-store reads are lazy and read-only
 *  - No dangerouslySetInnerHTML
 */
import { create } from 'zustand'
import type {
  QuantTab, CostBaseSource,
  OrcamentoItem, OrcamentoBudget, CustomBaseEntry,
} from '@/types'
import {
  MOCK_CURRENT_ITEMS,
  MOCK_BUDGETS,
  MOCK_CUSTOM_BASE,
} from '@/data/mockQuantitativos'

// ─── State interface ──────────────────────────────────────────────────────────

interface QuantitativosState {
  activeTab:    QuantTab
  costBase:     CostBaseSource
  currentItems: OrcamentoItem[]
  bdiGlobal:    number
  customBase:   CustomBaseEntry[]
  savedBudgets: OrcamentoBudget[]

  // Navigation
  setActiveTab(tab: QuantTab): void
  setCostBase(base: CostBaseSource): void

  // Items CRUD
  addItem(item: Omit<OrcamentoItem, 'id' | 'totalCost'>): void
  addItems(items: Omit<OrcamentoItem, 'id' | 'totalCost'>[]): void
  updateItem(id: string, updates: Partial<OrcamentoItem>): void
  removeItem(id: string): void
  resetItems(): void

  // Cross-module import (lazy, read-only)
  importFromPreConstrucao(): Promise<void>
  importFromSuprimentos(): Promise<void>

  // Custom base management
  importCustomBase(entries: Omit<CustomBaseEntry, 'id'>[]): void
  addCustomEntry(entry: Omit<CustomBaseEntry, 'id'>): void
  removeCustomEntry(id: string): void

  // Budget history
  saveBudget(name: string, description?: string): void
  loadBudget(id: string): void
  deleteBudget(id: string): void

  // BDI
  setBdiGlobal(pct: number): void

  loadDemoData(): void
  clearData(): void
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function calcTotal(item: Omit<OrcamentoItem, 'id' | 'totalCost'>): number {
  return item.quantity * item.unitCost * (1 + item.bdi / 100)
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useQuantitativosStore = create<QuantitativosState>((set, get) => ({
  activeTab:    'composicao',
  costBase:     'sinapi',
  currentItems: MOCK_CURRENT_ITEMS,
  bdiGlobal:    25,
  customBase:   MOCK_CUSTOM_BASE,
  savedBudgets: MOCK_BUDGETS,

  // ── Navigation ────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setCostBase:  (base) => set({ costBase: base }),

  // ── Items CRUD ────────────────────────────────────────────────────────────────

  addItem: (item) =>
    set((s) => ({
      currentItems: [
        ...s.currentItems,
        { ...item, id: crypto.randomUUID(), totalCost: calcTotal(item) },
      ],
    })),

  addItems: (items) =>
    set((s) => ({
      currentItems: [
        ...s.currentItems,
        ...items.map((item) => ({ ...item, id: crypto.randomUUID(), totalCost: calcTotal(item) })),
      ],
    })),

  updateItem: (id, updates) =>
    set((s) => ({
      currentItems: s.currentItems.map((it) => {
        if (it.id !== id) return it
        const merged = { ...it, ...updates }
        merged.totalCost = merged.quantity * merged.unitCost * (1 + merged.bdi / 100)
        return merged
      }),
    })),

  removeItem: (id) =>
    set((s) => ({ currentItems: s.currentItems.filter((it) => it.id !== id) })),

  resetItems: () => set({ currentItems: [] }),

  // ── Cross-module import ───────────────────────────────────────────────────────

  importFromPreConstrucao: async () => {
    try {
      const { usePreConstrucaoStore } = await import('./preConstrucaoStore')
      const state = usePreConstrucaoStore.getState() as {
        takeoffItems: { id: string; description: string; normalizedQuantity?: number; quantity: number; normalizedUnit?: string; unit: string }[]
        costMatches: { takeoffItemId: string; code: string; description: string; unit: string; unitCost: number; selected: boolean; source: string }[]
        customBase: { code: string; description: string; unit: string; unitCost: number; category: string }[]
      }

      const bdi = get().bdiGlobal
      const selectedMatches = (state.costMatches ?? []).filter((m) => m.selected)

      const newItems: OrcamentoItem[] = selectedMatches.map((m) => {
        const takeoff = (state.takeoffItems ?? []).find((t) => t.id === m.takeoffItemId)
        const qty = takeoff?.normalizedQuantity ?? takeoff?.quantity ?? 1
        const totalCost = qty * m.unitCost * (1 + bdi / 100)
        return {
          id:          crypto.randomUUID(),
          code:        m.code,
          description: m.description,
          unit:        m.unit,
          quantity:    qty,
          unitCost:    m.unitCost,
          bdi,
          totalCost,
          category:    'Pré-Construção',
          source:      (m.source as CostBaseSource) ?? 'sinapi',
        }
      })

      if (newItems.length > 0) {
        set((s) => ({ currentItems: [...s.currentItems, ...newItems] }))
      }
    } catch {
      // silently ignore if preConstrucaoStore not available
    }
  },

  importFromSuprimentos: async () => {
    try {
      const { useSuprimentosStore } = await import('./suprimentosStore')
      const state = useSuprimentosStore.getState() as {
        purchaseOrders: { items: { id: string; description: string; quantity: number; unit: string; unitPrice: number }[] }[]
      }

      const bdi = get().bdiGlobal
      const allItems = (state.purchaseOrders ?? []).flatMap((po) => po.items ?? [])

      const newItems: OrcamentoItem[] = allItems.map((poi) => {
        const totalCost = poi.quantity * poi.unitPrice * (1 + bdi / 100)
        return {
          id:          crypto.randomUUID(),
          code:        `PO-${poi.id.slice(0, 6).toUpperCase()}`,
          description: poi.description,
          unit:        poi.unit,
          quantity:    poi.quantity,
          unitCost:    poi.unitPrice,
          bdi,
          totalCost,
          category:    'Suprimentos',
          source:      'manual' as CostBaseSource,
        }
      })

      if (newItems.length > 0) {
        set((s) => ({ currentItems: [...s.currentItems, ...newItems] }))
      }
    } catch {
      // silently ignore
    }
  },

  // ── Custom base ───────────────────────────────────────────────────────────────

  importCustomBase: (entries) =>
    set((s) => ({
      customBase: [
        ...s.customBase,
        ...entries.map((e) => ({ ...e, id: crypto.randomUUID() })),
      ],
    })),

  addCustomEntry: (entry) =>
    set((s) => ({
      customBase: [...s.customBase, { ...entry, id: crypto.randomUUID() }],
    })),

  removeCustomEntry: (id) =>
    set((s) => ({ customBase: s.customBase.filter((e) => e.id !== id) })),

  // ── Budget history ────────────────────────────────────────────────────────────

  saveBudget: (name, description) => {
    const { currentItems, costBase, bdiGlobal } = get()
    const now = new Date().toISOString()
    const totalBRL = currentItems.reduce((s, i) => s + i.totalCost, 0)
    const budget: OrcamentoBudget = {
      id:            crypto.randomUUID(),
      name,
      description,
      costBase,
      items:         currentItems.map((i) => ({ ...i })),
      bdiGlobal,
      totalBRL,
      referenceDate: new Date().toISOString().slice(0, 7),
      createdAt:     now,
      updatedAt:     now,
    }
    set((s) => ({ savedBudgets: [budget, ...s.savedBudgets] }))
  },

  loadBudget: (id) => {
    const budget = get().savedBudgets.find((b) => b.id === id)
    if (!budget) return
    set({
      currentItems: budget.items.map((i) => ({ ...i })),
      costBase:     budget.costBase,
      bdiGlobal:    budget.bdiGlobal,
    })
  },

  deleteBudget: (id) =>
    set((s) => ({ savedBudgets: s.savedBudgets.filter((b) => b.id !== id) })),

  // ── BDI ──────────────────────────────────────────────────────────────────────

  setBdiGlobal: (pct) => set({ bdiGlobal: Math.max(0, Math.min(100, pct)) }),

  // ── Demo / Clear ─────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      currentItems: MOCK_CURRENT_ITEMS.map((i) => ({ ...i })),
      savedBudgets: MOCK_BUDGETS,
      customBase:   MOCK_CUSTOM_BASE,
      costBase:     'sinapi',
      bdiGlobal:    25,
    }),

  clearData: () =>
    set({
      currentItems: [],
      savedBudgets: [],
      customBase:   [],
      bdiGlobal:    25,
    }),
}))
