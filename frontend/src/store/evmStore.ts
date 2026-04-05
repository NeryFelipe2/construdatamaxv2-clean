/**
 * evmStore.ts — Zustand store for EVM (Earned Value Management) module.
 */
import { create } from 'zustand'
import type {
  EvmTab, WorkPackage, CostAccountEntry, WeightedMeasurement,
  EvmMetrics, SCurveMultiPoint, CostPillar, CostBreakdown,
  EacScenarios, PillarDeviation, StockAlert,
} from '@/types'

interface EvmState {
  activeTab: EvmTab
  workPackages: WorkPackage[]
  costAccounts: CostAccountEntry[]
  measurements: WeightedMeasurement[]
  evmMetrics: EvmMetrics
  sCurveData: SCurveMultiPoint[]

  setActiveTab: (tab: EvmTab) => void

  // Work Package CRUD
  addWorkPackage: (wp: Omit<WorkPackage, 'id' | 'createdAt'>) => void
  updateWorkPackage: (id: string, patch: Partial<WorkPackage>) => void
  removeWorkPackage: (id: string) => void

  // Cost Account CRUD
  addCostAccount: (entry: Omit<CostAccountEntry, 'id' | 'totalCostBRL'>) => void
  updateCostAccount: (id: string, patch: Partial<CostAccountEntry>) => void
  removeCostAccount: (id: string) => void

  // Measurement CRUD
  addMeasurement: (m: Omit<WeightedMeasurement, 'id' | 'compositeScore'>) => void
  updateMeasurement: (id: string, patch: Partial<WeightedMeasurement>) => void
  removeMeasurement: (id: string) => void

  // Recalculate
  recalculateMetrics: () => void

  // Data management
  loadDemoData: () => void
  clearData: () => void
}

const EMPTY_METRICS: EvmMetrics = {
  BAC: 0, PV: 0, EV: 0, AC: 0,
  CPI: 0, SPI: 0, CV: 0, SV: 0,
  EAC: 0, ETC: 0, VAC: 0, TCPI: 0,
  costBreakdown: { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 },
  eacScenarios: { optimistic: 0, trend: 0, pessimistic: 0 },
  pillarDeviations: [],
  stockAlerts: [],
  healthStatus: 'blue' as const,
}

const PILLAR_LABELS: Record<CostPillar, string> = {
  material: 'Material',
  equipamento: 'Equipamento',
  mao_de_obra: 'Mao de Obra',
  impostos_indiretos: 'Impostos Indiretos',
}

function computeCompositeScore(m: Omit<WeightedMeasurement, 'id' | 'compositeScore'>): number {
  return (
    m.financialWeight * 0.3 +
    m.durationWeight * 0.25 +
    m.economicWeight * 0.3 +
    m.specificWeight * 0.15
  )
}

export const useEvmStore = create<EvmState>((set, get) => ({
  activeTab: 'dashboard',
  workPackages: [],
  costAccounts: [],
  measurements: [],
  evmMetrics: { ...EMPTY_METRICS },
  sCurveData: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Work Package CRUD ──────────────────────────────────────────────

  addWorkPackage: (wp) =>
    set((s) => ({
      workPackages: [
        ...s.workPackages,
        { ...wp, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ],
    })),

  updateWorkPackage: (id, patch) =>
    set((s) => ({
      workPackages: s.workPackages.map((wp) => (wp.id === id ? { ...wp, ...patch } : wp)),
    })),

  removeWorkPackage: (id) =>
    set((s) => ({
      workPackages: s.workPackages.filter((wp) => wp.id !== id),
    })),

  // ── Cost Account CRUD ──────────────────────────────────────────────

  addCostAccount: (entry) =>
    set((s) => ({
      costAccounts: [
        ...s.costAccounts,
        {
          ...entry,
          id: crypto.randomUUID(),
          totalCostBRL: entry.unitCostBRL * entry.quantity,
        },
      ],
    })),

  updateCostAccount: (id, patch) =>
    set((s) => ({
      costAccounts: s.costAccounts.map((ca) => {
        if (ca.id !== id) return ca
        const updated = { ...ca, ...patch }
        updated.totalCostBRL = updated.unitCostBRL * updated.quantity
        return updated
      }),
    })),

  removeCostAccount: (id) =>
    set((s) => ({
      costAccounts: s.costAccounts.filter((ca) => ca.id !== id),
    })),

  // ── Measurement CRUD ───────────────────────────────────────────────

  addMeasurement: (m) =>
    set((s) => ({
      measurements: [
        ...s.measurements,
        { ...m, id: crypto.randomUUID(), compositeScore: computeCompositeScore(m) },
      ],
    })),

  updateMeasurement: (id, patch) =>
    set((s) => ({
      measurements: s.measurements.map((m) => {
        if (m.id !== id) return m
        const updated = { ...m, ...patch }
        updated.compositeScore = computeCompositeScore(updated)
        return updated
      }),
    })),

  removeMeasurement: (id) =>
    set((s) => ({
      measurements: s.measurements.filter((m) => m.id !== id),
    })),

  // ── Recalculate ────────────────────────────────────────────────────

  recalculateMetrics: () => {
    const { costAccounts, evmMetrics } = get()

    // Compute BAC from cost accounts
    const BAC = costAccounts.reduce((sum, ca) => sum + ca.totalCostBRL, 0)

    if (BAC === 0) {
      set({ evmMetrics: { ...EMPTY_METRICS } })
      return
    }

    // Compute AC broken down by pillar
    const pillars: CostPillar[] = ['material', 'equipamento', 'mao_de_obra', 'impostos_indiretos']
    const costBreakdown: CostBreakdown = { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 }

    for (const ca of costAccounts) {
      costBreakdown[ca.pillar] += ca.totalCostBRL
    }

    const AC = costBreakdown.material + costBreakdown.equipamento + costBreakdown.mao_de_obra + costBreakdown.impostos_indiretos

    // Scale PV/EV proportionally to the new BAC
    const oldBAC = evmMetrics.BAC || 1
    const scale = BAC / oldBAC
    const PV = evmMetrics.PV * scale
    const EV = evmMetrics.EV * scale

    // Core EVM indices
    const CPI = AC !== 0 ? EV / AC : 0
    const SPI = PV !== 0 ? EV / PV : 0
    const CV = EV - AC
    const SV = EV - PV
    const EAC = CPI !== 0 ? BAC / CPI : 0
    const ETC = EAC - AC
    const VAC = BAC - EAC
    const TCPI = (BAC - AC) !== 0 ? (BAC - EV) / (BAC - AC) : 0

    // Pillar deviations: for each pillar, compare budgeted vs actual
    const budgetedByPillar: Record<CostPillar, number> = { material: 0, equipamento: 0, mao_de_obra: 0, impostos_indiretos: 0 }
    for (const ca of costAccounts) {
      budgetedByPillar[ca.pillar] += ca.totalCostBRL
    }

    const totalDeviation = pillars.reduce((sum, p) => sum + Math.abs(costBreakdown[p] - budgetedByPillar[p]), 0)

    const pillarDeviations: PillarDeviation[] = pillars.map((p) => {
      const budgeted = budgetedByPillar[p]
      const actual = costBreakdown[p]
      const deviation = actual - budgeted
      const deviationPct = totalDeviation !== 0 ? Math.abs(deviation) / totalDeviation : 0
      return {
        pillar: p,
        label: PILLAR_LABELS[p],
        budgeted,
        actual,
        deviation,
        deviationPct,
      }
    })

    // EAC scenarios
    const eacScenarios: EacScenarios = {
      optimistic: BAC,
      trend: CPI !== 0 ? BAC / CPI : 0,
      pessimistic: CPI !== 0 ? (BAC / CPI) * 1.15 : 0,
    }

    // Health status
    let healthStatus: 'blue' | 'yellow' | 'red'
    if (CPI >= 1 && SPI >= 1) {
      healthStatus = 'blue'
    } else if (SPI < 1 && CPI >= 1) {
      healthStatus = 'yellow'
    } else {
      healthStatus = 'red'
    }

    // Stock alerts — lazy import from suprimentosStore
    import('./suprimentosStore').then(({ useSuprimentosStore }) => {
      const estoqueItens = (useSuprimentosStore.getState() as any).estoqueItens ?? []
      const stockAlerts: StockAlert[] = []

      for (const item of estoqueItens) {
        if (item.qtdDisponivel > item.estoqueMinimo * 2) {
          const qtdComprada = item.qtdDisponivel + item.qtdReservada
          const qtdInstalada = item.qtdReservada
          const qtdImobilizada = item.qtdDisponivel - item.estoqueMinimo
          const custoImobilizado = qtdImobilizada * (item.custoUnitario ?? 0)
          stockAlerts.push({
            itemId: item.id,
            description: item.descricao,
            qtdComprada,
            qtdInstalada,
            qtdImobilizada,
            custoImobilizado,
          })
        }
      }

      set({
        evmMetrics: {
          BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI,
          costBreakdown,
          eacScenarios,
          pillarDeviations,
          stockAlerts,
          healthStatus,
        },
      })
    }).catch(() => {
      // If suprimentos store is unavailable, set metrics without stock alerts
      set({
        evmMetrics: {
          BAC, PV, EV, AC, CPI, SPI, CV, SV, EAC, ETC, VAC, TCPI,
          costBreakdown,
          eacScenarios,
          pillarDeviations,
          stockAlerts: [],
          healthStatus,
        },
      })
    })
  },

  // ── Data management ────────────────────────────────────────────────

  loadDemoData: () => {
    import('@/data/mockEvm').then((m) => {
      set({
        workPackages: structuredClone(m.MOCK_WORK_PACKAGES),
        costAccounts: structuredClone(m.MOCK_COST_ACCOUNTS),
        measurements: structuredClone(m.MOCK_MEASUREMENTS),
        evmMetrics: structuredClone(m.MOCK_EVM_METRICS),
        sCurveData: structuredClone(m.MOCK_SCURVE_DATA),
      })
    })
  },

  clearData: () =>
    set({
      workPackages: [],
      costAccounts: [],
      measurements: [],
      evmMetrics: { ...EMPTY_METRICS },
      sCurveData: [],
    }),
}))
