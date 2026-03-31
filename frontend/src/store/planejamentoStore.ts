/**
 * planejamentoStore.ts — Zustand store for the Planejamento module.
 *
 * Security:
 *  - All IDs via crypto.randomUUID()
 *  - No external calls, no localStorage
 *  - Input mutations set isScheduleDirty; runSchedule() clears it
 *  - Platform imports are read-only (never mutate source stores)
 */
import { create } from 'zustand'
import type {
  PlanTrecho,
  PlanTeam,
  PlanProductivityTable,
  PlanScheduleConfig,
  PlanHoliday,
  GanttRow,
  SCurvePoint,
  HistogramPoint,
  AbcItem,
  ServiceNote,
  PlanScenario,
  TechnicalRule,
} from '@/types'
import {
  MOCK_TRECHOS,
  MOCK_TEAMS,
  MOCK_PRODUCTIVITY,
  MOCK_SCHEDULE_CONFIG,
  MOCK_HOLIDAYS,
  MOCK_NOTES,
  MOCK_BASE_SCENARIO,
} from '@/data/mockPlanejamento'
import { generateSchedule } from '@/features/planejamento/utils/scheduleEngine'
import {
  computeAbcCurve,
  computeSCurve,
  computeHistogram,
} from '@/features/planejamento/utils/analysisEngine'

// ─── Tab type ─────────────────────────────────────────────────────────────────

export type PlanejamentoTab =
  | 'config'
  | 'trechos'
  | 'gantt'
  | 'scurve'
  | 'abc'
  | 'histogram'
  | 'daily'
  | 'notes'
  | 'scenarios'

// ─── State interface ──────────────────────────────────────────────────────────

interface PlanejamentoState {
  // Navigation
  activeTab: PlanejamentoTab

  // Inputs (mutations set isScheduleDirty)
  trechos:           PlanTrecho[]
  teams:             PlanTeam[]
  productivityTable: PlanProductivityTable
  scheduleConfig:    PlanScheduleConfig
  holidays:          PlanHoliday[]

  // Computed (set by runSchedule)
  ganttRows:        GanttRow[]
  workDays:         string[]
  totalCostBRL:     number
  totalMeters:      number
  projectEndDate:   string | null
  isScheduleDirty:  boolean
  scurvePoints:     SCurvePoint[]
  histogramPoints:  HistogramPoint[]
  abcItems:         AbcItem[]

  // Notes + Scenarios
  notes:     ServiceNote[]
  scenarios: PlanScenario[]

  // Technical Rules
  technicalRules: TechnicalRule[]

  // Project budget
  projectBudget: number

  // ── Actions ──────────────────────────────────────────────────────────────────

  setActiveTab: (tab: PlanejamentoTab) => void
  setProjectBudget: (budget: number) => void

  // Trechos
  addTrecho:    (t: Omit<PlanTrecho, 'id'>) => void
  updateTrecho: (id: string, updates: Partial<Omit<PlanTrecho, 'id'>>) => void
  removeTrecho: (id: string) => void
  reorderTrechos: (trechos: PlanTrecho[]) => void
  importTrechosFromPlatform: () => void

  // Teams
  addTeam:    (t: Omit<PlanTeam, 'id'>) => void
  updateTeam: (id: string, updates: Partial<Omit<PlanTeam, 'id'>>) => void
  removeTeam: (id: string) => void

  // Productivity
  setProductivityTable: (p: PlanProductivityTable) => void

  // Schedule config
  setScheduleConfig: (c: PlanScheduleConfig) => void

  // Holidays
  addHoliday:    (h: PlanHoliday) => void
  removeHoliday: (date: string) => void

  // Schedule execution
  runSchedule: () => void

  // Notes
  addNote:    (n: Omit<ServiceNote, 'id' | 'createdAt'>) => void
  updateNote: (id: string, updates: Partial<Omit<ServiceNote, 'id'>>) => void
  removeNote: (id: string) => void

  // Scenarios
  saveScenario:   (name: string, description?: string) => void
  loadScenario:   (id: string) => void
  renameScenario: (id: string, name: string, description?: string) => void
  removeScenario: (id: string) => void

  // Technical Rules
  addTechnicalRule:    (rule: Omit<TechnicalRule, 'id'>) => void
  updateTechnicalRule: (id: string, updates: Partial<Omit<TechnicalRule, 'id'>>) => void
  removeTechnicalRule: (id: string) => void

  // RDO sync — receives execution data from RDO module
  syncExecutionFromRdo: (entries: Array<{ trechoCode: string; executedMeters: number; date: string }>) => void

  // Demo / clear
  loadDemoData: () => void
  clearData:    () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePlanejamentoStore = create<PlanejamentoState>((set, get) => ({
  activeTab: 'config',

  trechos:           MOCK_TRECHOS,
  teams:             MOCK_TEAMS,
  productivityTable: MOCK_PRODUCTIVITY,
  scheduleConfig:    MOCK_SCHEDULE_CONFIG,
  holidays:          MOCK_HOLIDAYS,

  ganttRows:       [],
  workDays:        [],
  totalCostBRL:    0,
  totalMeters:     0,
  projectEndDate:  null,
  isScheduleDirty: true,
  scurvePoints:    [],
  histogramPoints: [],
  abcItems:        [],

  notes:     MOCK_NOTES,
  scenarios: [MOCK_BASE_SCENARIO],

  technicalRules: [
    { id: crypto.randomUUID(), name: 'Solo Rochoso — penalidade', condition: "soilType === 'rocky'", productivityMultiplier: 0.6, costMultiplier: 1.4 },
    { id: crypto.randomUUID(), name: 'Escoramento — restrição', condition: 'requiresShoring === true', productivityMultiplier: 0.75, costMultiplier: 1.25 },
  ],

  projectBudget: 0,

  // ── Navigation ────────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),
  setProjectBudget: (budget) => set({ projectBudget: Math.max(0, budget) }),

  // ── Trechos ───────────────────────────────────────────────────────────────────

  addTrecho: (t) =>
    set((s) => ({
      trechos: [...s.trechos, { ...t, id: crypto.randomUUID() }],
      isScheduleDirty: true,
    })),

  updateTrecho: (id, updates) =>
    set((s) => ({
      trechos: s.trechos.map((t) => t.id === id ? { ...t, ...updates } : t),
      isScheduleDirty: true,
    })),

  removeTrecho: (id) =>
    set((s) => ({
      trechos: s.trechos.filter((t) => t.id !== id),
      isScheduleDirty: true,
    })),

  reorderTrechos: (trechos) => set({ trechos, isScheduleDirty: true }),

  importTrechosFromPlatform: () => {
    // Lazy import to avoid circular dependency — fire-and-forget
    import('./preConstrucaoStore')
      .then(({ usePreConstrucaoStore }) => {
        type TakeoffItem = {
          id: string
          description: string
          unit: string
          quantity: number
          unitCost?: number
        }
        const state = usePreConstrucaoStore.getState() as { takeoffItems: TakeoffItem[] }
        const items: TakeoffItem[] = state.takeoffItems ?? []
        const mlItems = items.filter((item) => item.unit === 'ml' || item.unit === 'm')
        if (mlItems.length === 0) return

        const newTrechos: PlanTrecho[] = mlItems.map((item, idx) => ({
          id: crypto.randomUUID(),
          code: `T${String(idx + 1).padStart(2, '0')}`,
          description: item.description,
          lengthM: Math.max(1, item.quantity),
          depthM: 1.5,
          diameterMm: 200,
          soilType: 'normal' as const,
          requiresShoring: false,
          unitCostBRL: item.unitCost,
        }))

        set((s) => ({
          trechos: [...s.trechos, ...newTrechos],
          isScheduleDirty: true,
        }))
      })
      .catch(() => {
        // preConstrucaoStore not available — silently ignore
      })
  },

  // ── Teams ─────────────────────────────────────────────────────────────────────

  addTeam: (t) =>
    set((s) => ({
      teams: [...s.teams, { ...t, id: crypto.randomUUID() }],
      isScheduleDirty: true,
    })),

  updateTeam: (id, updates) =>
    set((s) => ({
      teams: s.teams.map((t) => t.id === id ? { ...t, ...updates } : t),
      isScheduleDirty: true,
    })),

  removeTeam: (id) =>
    set((s) => ({
      teams: s.teams.filter((t) => t.id !== id),
      isScheduleDirty: true,
    })),

  // ── Productivity ──────────────────────────────────────────────────────────────

  setProductivityTable: (p) => set({ productivityTable: p, isScheduleDirty: true }),

  // ── Schedule Config ───────────────────────────────────────────────────────────

  setScheduleConfig: (c) => set({ scheduleConfig: c, isScheduleDirty: true }),

  // ── Holidays ──────────────────────────────────────────────────────────────────

  addHoliday: (h) =>
    set((s) => ({
      holidays: [...s.holidays.filter((x) => x.date !== h.date), h]
        .sort((a, b) => a.date.localeCompare(b.date)),
      isScheduleDirty: true,
    })),

  removeHoliday: (date) =>
    set((s) => ({
      holidays: s.holidays.filter((h) => h.date !== date),
      isScheduleDirty: true,
    })),

  // ── Schedule Execution ────────────────────────────────────────────────────────

  runSchedule: () => {
    const { trechos, teams, productivityTable, scheduleConfig, holidays } = get()
    const result = generateSchedule(trechos, teams, productivityTable, scheduleConfig, holidays)

    const abcItems = computeAbcCurve(result.ganttRows)
    const scurvePoints = computeSCurve(
      result.ganttRows,
      result.workDays,
      result.totalMeters,
      result.totalCostBRL,
    )
    const histogramPoints = computeHistogram(
      result.ganttRows,
      result.workDays,
      teams,
      scheduleConfig,
    )

    // Update trecho-level derived fields
    const updatedTrechos = trechos.map((t) => {
      const row = result.ganttRows.find((r) => r.trecho.id === t.id)
      const abcItem = abcItems.find((a) => a.trecho.id === t.id)
      if (!row) return t
      return {
        ...t,
        assignedTeamIndex: row.teamIndex,
        plannedStartDate: row.startDate,
        plannedEndDate: row.endDate,
        abcZone: abcItem?.zone,
      }
    })

    set({
      ganttRows:       result.ganttRows,
      workDays:        result.workDays,
      totalCostBRL:    result.totalCostBRL,
      totalMeters:     result.totalMeters,
      projectEndDate:  result.projectEndDate,
      isScheduleDirty: false,
      scurvePoints,
      histogramPoints,
      abcItems,
      trechos:         updatedTrechos,
    })
  },

  // ── Notes ─────────────────────────────────────────────────────────────────────

  addNote: (n) =>
    set((s) => ({
      notes: [
        ...s.notes,
        { ...n, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ],
    })),

  updateNote: (id, updates) =>
    set((s) => ({
      notes: s.notes.map((n) => n.id === id ? { ...n, ...updates } : n),
    })),

  removeNote: (id) =>
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

  // ── Scenarios ─────────────────────────────────────────────────────────────────

  saveScenario: (name, description) => {
    const { trechos, teams, productivityTable, scheduleConfig, holidays } = get()
    const now = new Date().toISOString()
    const scenario: PlanScenario = {
      id: crypto.randomUUID(),
      name,
      description,
      createdAt: now,
      updatedAt: now,
      trechos:           structuredClone(trechos),
      teams:             structuredClone(teams),
      productivityTable: structuredClone(productivityTable),
      scheduleConfig:    structuredClone(scheduleConfig),
      holidays:          structuredClone(holidays),
    }
    set((s) => ({ scenarios: [...s.scenarios, scenario] }))
  },

  loadScenario: (id) => {
    const scenario = get().scenarios.find((s) => s.id === id)
    if (!scenario) return
    set({
      trechos:           structuredClone(scenario.trechos),
      teams:             structuredClone(scenario.teams),
      productivityTable: structuredClone(scenario.productivityTable),
      scheduleConfig:    structuredClone(scenario.scheduleConfig),
      holidays:          structuredClone(scenario.holidays),
      isScheduleDirty:   true,
    })
  },

  renameScenario: (id, name, description) =>
    set((s) => ({
      scenarios: s.scenarios.map((sc) =>
        sc.id === id
          ? { ...sc, name, description, updatedAt: new Date().toISOString() }
          : sc,
      ),
    })),

  removeScenario: (id) =>
    set((s) => ({ scenarios: s.scenarios.filter((sc) => sc.id !== id) })),

  // ── Technical Rules ───────────────────────────────────────────────────────────

  addTechnicalRule: (rule) =>
    set((s) => ({ technicalRules: [...s.technicalRules, { ...rule, id: crypto.randomUUID() }] })),

  updateTechnicalRule: (id, updates) =>
    set((s) => ({ technicalRules: s.technicalRules.map((r) => r.id === id ? { ...r, ...updates } : r) })),

  removeTechnicalRule: (id) =>
    set((s) => ({ technicalRules: s.technicalRules.filter((r) => r.id !== id) })),

  // ── RDO Sync ──────────────────────────────────────────────────────────────────

  syncExecutionFromRdo: (entries) =>
    set((s) => ({
      trechos: s.trechos.map((t) => {
        const match = entries.find((e) => e.trechoCode === t.code)
        if (!match) return t
        const status: 'not_started' | 'in_progress' | 'completed' =
          match.executedMeters === 0 ? 'not_started'
          : match.executedMeters >= t.lengthM ? 'completed'
          : 'in_progress'
        return {
          ...t,
          executedMeters: match.executedMeters,
          executionStatus: status,
          lastRdoDate: match.date,
        }
      }),
    })),

  // ── Demo / Clear ──────────────────────────────────────────────────────────────

  loadDemoData: () =>
    set({
      trechos:           MOCK_TRECHOS,
      teams:             MOCK_TEAMS,
      productivityTable: MOCK_PRODUCTIVITY,
      scheduleConfig:    MOCK_SCHEDULE_CONFIG,
      holidays:          MOCK_HOLIDAYS,
      notes:             MOCK_NOTES,
      scenarios:         [MOCK_BASE_SCENARIO],
      ganttRows:         [],
      workDays:          [],
      totalCostBRL:      0,
      totalMeters:       0,
      projectEndDate:    null,
      isScheduleDirty:   true,
      scurvePoints:      [],
      histogramPoints:   [],
      abcItems:          [],
    }),

  clearData: () =>
    set({
      trechos:           [],
      teams:             [],
      productivityTable: MOCK_PRODUCTIVITY,
      scheduleConfig:    MOCK_SCHEDULE_CONFIG,
      holidays:          [],
      notes:             [],
      scenarios:         [],
      ganttRows:         [],
      workDays:          [],
      totalCostBRL:      0,
      totalMeters:       0,
      projectEndDate:    null,
      isScheduleDirty:   false,
      scurvePoints:      [],
      histogramPoints:   [],
      abcItems:          [],
      projectBudget:     0,
    }),
}))
