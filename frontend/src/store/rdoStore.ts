/**
 * rdoStore.ts — Zustand store for the RDO (Relatório Diário de Obras) module.
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - Photos stored as base64 in memory only — no external upload
 *  - No dangerouslySetInnerHTML, no eval
 *  - Cross-store reads are lazy and read-only
 */
import { create } from 'zustand'
import type {
  RDO, RdoTab, RdoFinancialEntry, RdoTrechoEntry,
} from '@/types'
import {
  MOCK_RDOS,
  MOCK_RDO_FINANCIAL_ENTRIES,
  MOCK_RDO_BUDGET_BRL,
} from '@/data/mockRdo'

// ─── State ────────────────────────────────────────────────────────────────────

interface RdoState {
  activeTab:        RdoTab
  rdos:             RDO[]
  financialEntries: RdoFinancialEntry[]
  budgetBRL:        number

  // ── Navigation ──────────────────────────────────────────────────────────────
  setActiveTab: (tab: RdoTab) => void

  // ── RDO CRUD ────────────────────────────────────────────────────────────────
  addRdo:    (rdo: Omit<RDO, 'id' | 'number' | 'createdAt' | 'updatedAt'>) => void
  updateRdo: (id: string, updates: Partial<RDO>) => void
  removeRdo: (id: string) => void

  // ── Financial ────────────────────────────────────────────────────────────────
  addFinancialEntry:    (e: Omit<RdoFinancialEntry, 'id'>) => void
  updateFinancialEntry: (id: string, updates: Partial<Omit<RdoFinancialEntry, 'id'>>) => void
  removeFinancialEntry: (id: string) => void
  setBudget:            (brl: number) => void

  // ── Platform import & sync ──────────────────────────────────────────────────
  loadTrechosFromPlanejamento: () => Promise<RdoTrechoEntry[]>
  syncExecutionToPlanejamento: () => void

  // ── Demo / Clear ─────────────────────────────────────────────────────────────
  loadDemoData: () => void
  clearData:    () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRdoStore = create<RdoState>((set, get) => ({
  activeTab:        'dashboard',
  rdos:             MOCK_RDOS,
  financialEntries: MOCK_RDO_FINANCIAL_ENTRIES,
  budgetBRL:        MOCK_RDO_BUDGET_BRL,

  // ── Navigation ────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── RDO CRUD ──────────────────────────────────────────────────────────────────

  addRdo: (rdo) => {
    set((s) => {
      const now = new Date().toISOString()
      const nextNumber = s.rdos.length + 1
      return {
        rdos: [
          ...s.rdos,
          { ...rdo, id: crypto.randomUUID(), number: nextNumber, createdAt: now, updatedAt: now },
        ],
      }
    })
    // Auto-sync execution data to Planejamento
    setTimeout(() => get().syncExecutionToPlanejamento(), 0)
  },

  updateRdo: (id, updates) => {
    set((s) => ({
      rdos: s.rdos.map((r) =>
        r.id === id
          ? { ...r, ...updates, updatedAt: new Date().toISOString() }
          : r,
      ),
    }))
    // Auto-sync execution data to Planejamento
    setTimeout(() => get().syncExecutionToPlanejamento(), 0)
  },

  removeRdo: (id) =>
    set((s) => ({ rdos: s.rdos.filter((r) => r.id !== id) })),

  // ── Financial ──────────────────────────────────────────────────────────────────

  addFinancialEntry: (e) =>
    set((s) => ({
      financialEntries: [
        ...s.financialEntries,
        { ...e, id: crypto.randomUUID() },
      ],
    })),

  updateFinancialEntry: (id, updates) =>
    set((s) => ({
      financialEntries: s.financialEntries.map((fe) =>
        fe.id === id ? { ...fe, ...updates } : fe,
      ),
    })),

  removeFinancialEntry: (id) =>
    set((s) => ({
      financialEntries: s.financialEntries.filter((fe) => fe.id !== id),
    })),

  setBudget: (brl) => set({ budgetBRL: Math.max(0, brl) }),

  // ── Platform import & sync ──────────────────────────────────────────────────

  loadTrechosFromPlanejamento: () =>
    import('./planejamentoStore')
      .then(({ usePlanejamentoStore }) => {
        type PlanTrecho = { id: string; code: string; description: string; lengthM: number; executedMeters?: number; executionStatus?: string }
        const state = usePlanejamentoStore.getState() as { trechos: PlanTrecho[] }
        const trechos: PlanTrecho[] = state.trechos ?? []
        return trechos.map((t): RdoTrechoEntry => ({
          id:                crypto.randomUUID(),
          trechoCode:        t.code,
          trechoDescription: t.description,
          plannedMeters:     t.lengthM,
          executedMeters:    t.executedMeters ?? 0,
          status:            (t.executionStatus as RdoTrechoEntry['status']) ?? 'not_started',
          source:            'rdo',
        }))
      })
      .catch(() => [] as RdoTrechoEntry[]),

  syncExecutionToPlanejamento: () => {
    const { rdos } = get()
    // Aggregate latest execution per trecho code (most recent RDO wins)
    const execMap = new Map<string, { executedMeters: number; date: string }>()
    const sortedRdos = [...rdos].sort((a, b) => a.date.localeCompare(b.date))
    for (const rdo of sortedRdos) {
      for (const t of rdo.trechos) {
        const prev = execMap.get(t.trechoCode)
        // Accumulate executed meters across all RDOs, or take latest
        execMap.set(t.trechoCode, {
          executedMeters: Math.max(t.executedMeters, prev?.executedMeters ?? 0),
          date: rdo.date,
        })
      }
    }
    const entries = Array.from(execMap.entries()).map(([code, data]) => ({
      trechoCode: code,
      executedMeters: data.executedMeters,
      date: data.date,
    }))
    if (entries.length === 0) return
    import('./planejamentoStore')
      .then(({ usePlanejamentoStore }) => {
        usePlanejamentoStore.getState().syncExecutionFromRdo(entries)
      })
      .catch(() => {})
  },

  // ── Demo / Clear ────────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      rdos:             MOCK_RDOS,
      financialEntries: MOCK_RDO_FINANCIAL_ENTRIES,
      budgetBRL:        MOCK_RDO_BUDGET_BRL,
    }),

  clearData: () =>
    set({
      rdos:             [],
      financialEntries: [],
      budgetBRL:        0,
    }),
}))

// ─── EVM helpers (pure, exported for components) ──────────────────────────────

export interface EvmMetrics {
  bac:  number
  ev:   number
  ac:   number
  pv:   number
  cpi:  number
  spi:  number
  cv:   number
  sv:   number
  eac:  number
  etc:  number
  vac:  number
  tcpi: number
}

export function computeEvm(
  bac: number,
  totalPlannedM: number,
  totalExecutedM: number,
  workDaysElapsed: number,
  totalWorkDays: number,
  financialEntries: RdoFinancialEntry[],
): EvmMetrics {
  const ev = totalPlannedM > 0 ? bac * (totalExecutedM / totalPlannedM) : 0
  const pv = totalWorkDays > 0 ? bac * (workDaysElapsed / totalWorkDays) : 0
  const ac = financialEntries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.valueBRL, 0)

  const cpi  = ac  > 0 ? ev / ac  : 0
  const spi  = pv  > 0 ? ev / pv  : 0
  const cv   = ev - ac
  const sv   = ev - pv
  const eac  = cpi > 0 ? bac / cpi : bac
  const etc  = eac - ac
  const vac  = bac - eac
  const denom = bac - ac
  const tcpi = denom !== 0 ? (bac - ev) / denom : 0

  return {
    bac, ev, ac, pv,
    cpi:  Math.round(cpi  * 1000) / 1000,
    spi:  Math.round(spi  * 1000) / 1000,
    cv:   Math.round(cv   * 100)  / 100,
    sv:   Math.round(sv   * 100)  / 100,
    eac:  Math.round(eac  * 100)  / 100,
    etc:  Math.round(etc  * 100)  / 100,
    vac:  Math.round(vac  * 100)  / 100,
    tcpi: Math.round(tcpi * 1000) / 1000,
  }
}
