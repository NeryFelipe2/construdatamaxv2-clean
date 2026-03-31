import { create } from 'zustand'
import type {
  Worker,
  LaborCrew,
  TimecardEntry,
  PhysicalProgress,
  LaborOccurrence,
  RiskArea,
  ReallocationSuggestion,
  Shift,
  CLTViolation,
  WorkPost,
  WorkerAbsence,
  CLTSettings,
  PayrollMonth,
} from '@/types'
import {
  mockWorkers,
  mockLaborCrews,
  mockTimecards,
  mockPhysicalProgress,
  mockOccurrences,
  mockRiskAreas,
  mockReallocationSuggestions,
  MOCK_SHIFTS,
  MOCK_WORK_POSTS,
  MOCK_ABSENCES,
  MOCK_CLT_SETTINGS,
} from '@/data/mockMaoDeObra'
import {
  runAllCLTChecks,
  autoGenerateSchedule,
} from '@/features/mao-de-obra/utils/cltEngine'
import { generateMonthPayroll } from '@/features/mao-de-obra/utils/payrollEngine'

// ─── Access Check Result ───────────────────────────────────────────────────────

export interface AccessCheckResult {
  allowed: boolean
  worker: Worker
  riskArea: RiskArea
  missingCerts: string[]
  expiredCerts: string[]
}

// ─── Tab type ──────────────────────────────────────────────────────────────────

export type MaoDeObraTab =
  | 'dashboard'
  | 'funcionarios'
  | 'escala'
  | 'postos'
  | 'cmo'
  | 'faltas'
  | 'folha'
  | 'rh-financeiro'
  | 'frotas'
  | 'ausencias'
  | 'apontamentos'
  | 'escalamento'
  | 'seguranca'

// ─── State ─────────────────────────────────────────────────────────────────────

interface MaoDeObraState {
  workers:     Worker[]
  crews:       LaborCrew[]
  timecards:   TimecardEntry[]
  progress:    PhysicalProgress[]
  occurrences: LaborOccurrence[]
  riskAreas:   RiskArea[]
  suggestions: ReallocationSuggestion[]

  // New HR state
  shifts:         Shift[]
  violations:     CLTViolation[]
  workPosts:      WorkPost[]
  absences:       WorkerAbsence[]
  cltSettings:    CLTSettings
  activeTab:      MaoDeObraTab
  payrollHistory: PayrollMonth[]

  // Worker CRUD
  addWorker:    (worker: Omit<Worker, 'id'>) => void
  updateWorker: (id: string, updates: Partial<Omit<Worker, 'id'>>) => void

  // Crew CRUD
  addCrew:    (crew: Omit<LaborCrew, 'id'>) => void
  updateCrew: (id: string, updates: Partial<Omit<LaborCrew, 'id'>>) => void

  // Timecard actions
  addTimecard:     (entry: Omit<TimecardEntry, 'id'>) => void
  importTimecards: (entries: Array<Omit<TimecardEntry, 'id'>>) => void

  // Progress & occurrences
  addProgress:   (entry: Omit<PhysicalProgress, 'id'>) => void
  addOccurrence: (occ: Omit<LaborOccurrence, 'id'>) => void

  // Reallocation engine
  runReallocationEngine: () => void
  acceptSuggestion:      (id: string) => void
  dismissSuggestion:     (id: string) => void

  // Safety — access check (pure computation, no state mutation)
  checkAccess: (workerId: string, riskAreaId: string) => AccessCheckResult | null

  // ── New HR actions ──────────────────────────────────────────────────────────

  // Navigation
  setActiveTab: (tab: MaoDeObraTab) => void

  // Shifts
  addShift:       (shift: Omit<Shift, 'id'>) => string
  updateShift:    (id: string, updates: Partial<Omit<Shift, 'id'>>) => void
  removeShift:    (id: string) => void
  bulkAddShifts:  (shifts: Omit<Shift, 'id'>[]) => void
  generateSchedule: (month: string) => void

  // CLT validation
  revalidateCLT: () => void

  // Work posts
  addWorkPost:    (post: Omit<WorkPost, 'id'>) => void
  updateWorkPost: (id: string, updates: Partial<Omit<WorkPost, 'id'>>) => void
  removeWorkPost: (id: string) => void

  // Absences
  registerAbsence:   (absence: Omit<WorkerAbsence, 'id' | 'registeredAt'>) => string
  assignSubstitute:  (absenceId: string, substituteWorkerId: string) => void
  resolveAbsence:    (absenceId: string) => void

  // CLT settings
  updateCLTSettings: (settings: Partial<CLTSettings>) => void

  // Payroll
  generatePayroll: (month: string) => void

  // Demo / clear
  loadDemoData: () => void
  clearData:    () => void
}

// ─── Reallocation Engine ───────────────────────────────────────────────────────

function computeSuggestions(
  progress: PhysicalProgress[],
  crews: LaborCrew[],
  existingSuggestions: ReallocationSuggestion[],
): ReallocationSuggestion[] {
  const activityMap = new Map<string, { planned: number; reported: number; unit: string; activityName: string }>()

  for (const p of progress) {
    const key = `${p.phaseId}|${p.activityName}`
    const existing = activityMap.get(key)
    if (existing) {
      existing.planned  += p.plannedQty
      existing.reported += p.reportedQty
    } else {
      activityMap.set(key, {
        planned:      p.plannedQty,
        reported:     p.reportedQty,
        unit:         p.unit,
        activityName: p.activityName,
      })
    }
  }

  const delayed: Array<{ key: string; activityName: string; deviation: number; unit: string }> = []
  const onTrack: Array<{ key: string; activityName: string }> = []

  for (const [key, val] of activityMap.entries()) {
    if (val.planned === 0) continue
    const ratio = val.reported / val.planned
    if (ratio < 0.70) {
      delayed.push({ key, activityName: val.activityName, deviation: Math.round((1 - ratio) * 100), unit: val.unit })
    } else if (ratio >= 0.95) {
      onTrack.push({ key, activityName: val.activityName })
    }
  }

  const suggestions: ReallocationSuggestion[] = []

  for (const del of delayed) {
    const already = existingSuggestions.find(
      (s) => s.delayedTaskName === del.activityName && (s.accepted === true || s.accepted === false)
    )
    if (already) continue

    const sourceTask = onTrack.find((t) => t.key !== del.key)
    if (!sourceTask) continue

    const sourceCrew = crews[Math.floor(Math.random() * crews.length)]
    const floatDays  = 7 + Math.floor(Math.random() * 8)
    const delayDays  = Math.max(1, Math.round(del.deviation / 15))

    suggestions.push({
      id:               `rs-gen-${del.key.replace(/[^a-z0-9]/gi, '-')}`,
      delayedTaskId:    del.key,
      delayedTaskName:  del.activityName,
      delayDays,
      sourceCrew:       sourceCrew?.name ?? 'Equipe Disponível',
      sourceTaskId:     sourceTask.key,
      sourceTaskName:   sourceTask.activityName,
      sourceTaskFloat:  floatDays,
      reason:           `"${sourceTask.activityName}" tem folga de ${floatDays} dias — realocar equipe para reforçar "${del.activityName}" (${del.deviation}% abaixo do planejado, ~${delayDays}d de atraso estimado).`,
      accepted:         undefined,
    })
  }

  return suggestions
}

// ─── Store ─────────────────────────────────────────────────────────────────────

export const useMaoDeObraStore = create<MaoDeObraState>((set, get) => ({
  workers:     mockWorkers,
  crews:       mockLaborCrews,
  timecards:   mockTimecards,
  progress:    mockPhysicalProgress,
  occurrences: mockOccurrences,
  riskAreas:   mockRiskAreas,
  suggestions: mockReallocationSuggestions,

  shifts:         MOCK_SHIFTS,
  violations:     [],
  workPosts:      MOCK_WORK_POSTS,
  absences:       MOCK_ABSENCES,
  cltSettings:    MOCK_CLT_SETTINGS,
  activeTab:      'dashboard',
  payrollHistory: [],

  // ── Navigation ──────────────────────────────────────────────────────────────

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Worker CRUD ─────────────────────────────────────────────────────────────

  addWorker: (worker) =>
    set((s) => ({
      workers: [...s.workers, { ...worker, id: `w-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  updateWorker: (id, updates) =>
    set((s) => ({
      workers: s.workers.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),

  // ── Crew CRUD ───────────────────────────────────────────────────────────────

  addCrew: (crew) =>
    set((s) => ({
      crews: [...s.crews, { ...crew, id: `lc-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  updateCrew: (id, updates) =>
    set((s) => ({
      crews: s.crews.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),

  // ── Timecards ───────────────────────────────────────────────────────────────

  addTimecard: (entry) =>
    set((s) => ({
      timecards: [...s.timecards, { ...entry, id: `tc-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  importTimecards: (entries) =>
    set((s) => ({
      timecards: [
        ...s.timecards,
        ...entries.map((e) => ({ ...e, id: `tc-${crypto.randomUUID().slice(0, 8)}` })),
      ],
    })),

  // ── Progress & Occurrences ───────────────────────────────────────────────────

  addProgress: (entry) =>
    set((s) => ({
      progress: [...s.progress, { ...entry, id: `pp-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  addOccurrence: (occ) =>
    set((s) => ({
      occurrences: [...s.occurrences, { ...occ, id: `occ-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  // ── Reallocation Engine ──────────────────────────────────────────────────────

  runReallocationEngine: () => {
    const { progress, crews, suggestions } = get()
    const generated = computeSuggestions(progress, crews, suggestions)
    const acted = suggestions.filter((s) => s.accepted === true || s.accepted === false)
    set({ suggestions: [...acted, ...generated] })
  },

  acceptSuggestion: (id) =>
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id ? { ...sg, accepted: true } : sg
      ),
    })),

  dismissSuggestion: (id) =>
    set((s) => ({
      suggestions: s.suggestions.map((sg) =>
        sg.id === id ? { ...sg, accepted: false } : sg
      ),
    })),

  // ── Safety — Access Check ────────────────────────────────────────────────────

  checkAccess: (workerId, riskAreaId) => {
    const { workers, riskAreas } = get()
    const worker   = workers.find((w) => w.id === workerId)
    const riskArea = riskAreas.find((r) => r.id === riskAreaId)
    if (!worker || !riskArea) return null

    const missingCerts: string[] = []
    const expiredCerts: string[] = []

    for (const required of riskArea.requiredCertTypes) {
      const cert = worker.certifications.find((c) => c.type === required)
      if (!cert) {
        missingCerts.push(required)
      } else if (cert.status === 'expired') {
        expiredCerts.push(required)
      }
    }

    return {
      allowed:      worker.status === 'active' && missingCerts.length === 0 && expiredCerts.length === 0,
      worker,
      riskArea,
      missingCerts,
      expiredCerts,
    }
  },

  // ── Shifts ──────────────────────────────────────────────────────────────────

  addShift: (shift) => {
    const id = `sh-${crypto.randomUUID().slice(0, 8)}`
    set((s) => ({ shifts: [...s.shifts, { ...shift, id }] }))
    return id
  },

  updateShift: (id, updates) =>
    set((s) => ({
      shifts: s.shifts.map((sh) => (sh.id === id ? { ...sh, ...updates } : sh)),
    })),

  removeShift: (id) =>
    set((s) => ({ shifts: s.shifts.filter((sh) => sh.id !== id) })),

  bulkAddShifts: (newShifts) =>
    set((s) => ({
      shifts: [
        ...s.shifts,
        ...newShifts.map((sh) => ({ ...sh, id: `sh-${crypto.randomUUID().slice(0, 8)}` })),
      ],
    })),

  generateSchedule: (month) => {
    const { workers, workPosts, cltSettings } = get()
    const generated = autoGenerateSchedule(workers, workPosts, month, cltSettings)
    // Replace existing scheduled (not confirmed) shifts for the month
    set((s) => ({
      shifts: [
        ...s.shifts.filter((sh) => !sh.date.startsWith(month) || sh.status !== 'scheduled'),
        ...generated.map((sh) => ({ ...sh, id: `sh-${crypto.randomUUID().slice(0, 8)}` })),
      ],
    }))
    // Re-run CLT validation
    get().revalidateCLT()
  },

  // ── CLT Validation ──────────────────────────────────────────────────────────

  revalidateCLT: () => {
    const { workers, shifts, cltSettings } = get()
    const violations = runAllCLTChecks(workers, shifts, cltSettings)
    set({ violations })
  },

  // ── Work Posts ──────────────────────────────────────────────────────────────

  addWorkPost: (post) =>
    set((s) => ({
      workPosts: [...s.workPosts, { ...post, id: `wp-${crypto.randomUUID().slice(0, 8)}` }],
    })),

  updateWorkPost: (id, updates) =>
    set((s) => ({
      workPosts: s.workPosts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  removeWorkPost: (id) =>
    set((s) => ({ workPosts: s.workPosts.filter((p) => p.id !== id) })),

  // ── Absences ────────────────────────────────────────────────────────────────

  registerAbsence: (absence) => {
    const id = `abs-${crypto.randomUUID().slice(0, 8)}`
    set((s) => ({
      absences: [...s.absences, { ...absence, id, registeredAt: new Date().toISOString() }],
    }))
    return id
  },

  assignSubstitute: (absenceId, substituteWorkerId) =>
    set((s) => ({
      absences: s.absences.map((a) =>
        a.id === absenceId ? { ...a, substituteWorkerId, status: 'covered' as const } : a
      ),
    })),

  resolveAbsence: (absenceId) =>
    set((s) => ({
      absences: s.absences.map((a) =>
        a.id === absenceId ? { ...a, status: 'covered' as const } : a
      ),
    })),

  // ── CLT Settings ─────────────────────────────────────────────────────────────

  updateCLTSettings: (settings) =>
    set((s) => ({ cltSettings: { ...s.cltSettings, ...settings } })),

  // ── Payroll ──────────────────────────────────────────────────────────────────

  generatePayroll: (month) => {
    const { workers, shifts, cltSettings, payrollHistory } = get()
    const result = generateMonthPayroll(workers, shifts, cltSettings, month)
    // Replace existing entry for this month, or append
    const existing = payrollHistory.findIndex((p) => p.month === month)
    const updated  = existing >= 0
      ? payrollHistory.map((p, i) => i === existing ? result : p)
      : [...payrollHistory, result]
    set({ payrollHistory: updated })
  },

  // ── Demo / Clear ─────────────────────────────────────────────────────────────

  loadDemoData: () => {
    const violations = runAllCLTChecks(mockWorkers, MOCK_SHIFTS, MOCK_CLT_SETTINGS)
    set({
      workers:     mockWorkers,
      crews:       mockLaborCrews,
      timecards:   mockTimecards,
      progress:    mockPhysicalProgress,
      occurrences: mockOccurrences,
      riskAreas:   mockRiskAreas,
      suggestions: mockReallocationSuggestions,
      shifts:      MOCK_SHIFTS,
      violations,
      workPosts:   MOCK_WORK_POSTS,
      absences:    MOCK_ABSENCES,
      cltSettings: MOCK_CLT_SETTINGS,
    })
  },

  clearData: () =>
    set({
      workers:     [],
      crews:       [],
      timecards:   [],
      progress:    [],
      occurrences: [],
      riskAreas:   mockRiskAreas,
      suggestions: [],
      shifts:         [],
      violations:     [],
      workPosts:      [],
      absences:       [],
      payrollHistory: [],
    }),
}))

// ─── Derived helpers ──────────────────────────────────────────────────────────

export function calcWeeklyHH(timecards: TimecardEntry[]): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  return timecards
    .filter((tc) => new Date(tc.date) >= cutoff)
    .reduce((sum, tc) => sum + tc.hoursWorked, 0)
}

export function calcProductivity(timecards: TimecardEntry[]): number {
  const relevant = timecards.filter((tc) => tc.unit === 'm²' && tc.reportedQty > 0)
  if (relevant.length === 0) return 0
  const totalHH = relevant.reduce((s, tc) => s + tc.hoursWorked, 0)
  const totalM2 = relevant.reduce((s, tc) => s + tc.reportedQty, 0)
  return totalM2 > 0 ? parseFloat((totalHH / totalM2).toFixed(2)) : 0
}

export function calcComplianceRate(workers: Worker[]): number {
  const active = workers.filter((w) => w.status === 'active')
  if (active.length === 0) return 0
  const compliant = active.filter(
    (w) => w.certifications.every((c) => c.status === 'valid' || c.status === 'expiring')
  )
  return Math.round((compliant.length / active.length) * 100)
}

export function calcActiveOccurrences(occurrences: LaborOccurrence[]): number {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  return occurrences.filter((o) => new Date(o.date) >= cutoff).length
}

export function getCertExpiringSoon(
  workers: Worker[],
  days = 30,
): Array<{ worker: Worker; certType: string; daysLeft: number; expiryDate: string }> {
  const now    = new Date()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + days)

  const results: Array<{ worker: Worker; certType: string; daysLeft: number; expiryDate: string }> = []

  for (const w of workers) {
    for (const cert of w.certifications) {
      const expiry = new Date(cert.expiryDate)
      if (expiry >= now && expiry <= cutoff) {
        const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000)
        results.push({ worker: w, certType: cert.type, daysLeft, expiryDate: cert.expiryDate })
      }
    }
  }

  return results.sort((a, b) => a.daysLeft - b.daysLeft)
}
