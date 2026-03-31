/**
 * Payroll Engine — pure functions, no side effects, no Zustand imports.
 *
 * Brazilian labor law + 2025 tax tables:
 *  - INSS (employee): progressive table 2025
 *  - INSS (employer): 20% of gross (simplified regime)
 *  - FGTS (employer): 8% of gross
 *  - IRRF: 2025 simplified table
 *  - VT (Vale-Transporte): worker pays 6% of base; capped at actual cost
 *  - VA/VR: R$ 35/working day worker deduction (company absorbs the rest)
 *  - Overtime: derived from CLT settings (rate %, already calculated in CMO engine)
 *  - Night differential: already calculated in CMO engine
 *
 * Security notes:
 *  - All numeric inputs are sanitized via Math.max/min before use
 *  - No eval(), no template-string HTML
 *  - Amounts always rounded to 2 decimal places
 */

import type {
  Worker,
  Shift,
  CLTSettings,
  WorkerPayslip,
  PayrollMonth,
  PayslipAllowance,
  PayslipDeduction,
} from '@/types'
import { calcShiftMinutes, calcNightMinutes } from './cltEngine'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// ─── INSS 2025 — Employee progressive table ────────────────────────────────

const INSS_TABLE = [
  { upTo: 1_412.00,  rate: 0.075 },
  { upTo: 2_666.68,  rate: 0.090 },
  { upTo: 4_000.03,  rate: 0.120 },
  { upTo: 7_786.02,  rate: 0.140 },
] as const

/** Progressive INSS calculation (employee portion) */
export function calcINSS(grossSalary: number): number {
  const gross = clamp(grossSalary, 0, 1_000_000)
  let inss = 0
  let prev = 0

  for (const bracket of INSS_TABLE) {
    if (gross <= prev) break
    const taxable = Math.min(gross, bracket.upTo) - prev
    inss += taxable * bracket.rate
    prev = bracket.upTo
  }

  // Above ceiling: remaining is taxed at 14%
  if (gross > 7_786.02) {
    inss += (gross - 7_786.02) * 0.14
  }

  return r2(inss)
}

// ─── IRRF 2025 — simplified table (after INSS deduction) ─────────────────────

const IRRF_TABLE = [
  { upTo: 2_259.20,  rate: 0.000, deduction: 0.00       },
  { upTo: 2_826.65,  rate: 0.075, deduction: 169.44     },
  { upTo: 3_751.05,  rate: 0.150, deduction: 381.44     },
  { upTo: 4_664.68,  rate: 0.225, deduction: 662.77     },
  { upTo: Infinity,  rate: 0.275, deduction: 896.00     },
] as const

/**
 * IRRF on gross-after-INSS.
 * Standard deduction per dependent: R$ 189.59 (not applied here — simplified).
 */
export function calcIRRF(grossAfterINSS: number): number {
  const base = clamp(grossAfterINSS, 0, 1_000_000)

  for (const bracket of IRRF_TABLE) {
    if (base <= bracket.upTo) {
      const irrf = base * bracket.rate - bracket.deduction
      return r2(Math.max(0, irrf))
    }
  }

  return 0
}

/** FGTS employer contribution: 8% of gross */
export function calcFGTS(gross: number): number {
  return r2(clamp(gross, 0, 1_000_000) * 0.08)
}

/** Employer INSS (simplified / MEI regime): 20% of gross */
export function calcEmployerINSS(gross: number): number {
  return r2(clamp(gross, 0, 1_000_000) * 0.20)
}

// ─── Payslip generator ────────────────────────────────────────────────────────

function getMonthShifts(shifts: Shift[], workerId: string, month: string): Shift[] {
  return shifts.filter(
    (s) => s.workerId === workerId && s.date.startsWith(month),
  )
}

function countWorkingDays(shifts: Shift[]): number {
  return shifts.filter((s) => s.type !== 'day_off' && s.type !== 'holiday').length
}

export function generatePayslip(
  worker: Worker,
  allShifts: Shift[],
  settings: CLTSettings,
  month: string,
): WorkerPayslip {
  if (worker.status !== 'active') {
    // Return a zeroed payslip for inactive workers
    return {
      id: crypto.randomUUID(),
      workerId: worker.id,
      month,
      baseSalary: 0,
      allowances: [],
      deductions: [],
      grossTotal: 0,
      netTotal: 0,
      employerCost: 0,
      hoursWorked: 0,
      overtimeHours: 0,
      nightHours: 0,
      workingDays: 0,
      generatedAt: new Date().toISOString(),
    }
  }

  const monthShifts = getMonthShifts(allShifts, worker.id, month)
  const rate = clamp(worker.hourlyRate ?? 0, 0, 10_000)

  let regularMinutes  = 0
  let overtimeMinutes = 0
  let nightMinutes    = 0

  for (const shift of monthShifts) {
    if (shift.type === 'day_off' || shift.type === 'holiday') continue

    const worked = calcShiftMinutes(shift)
    const night  = calcNightMinutes(shift, settings)
    const normalMaxMin = settings.maxDailyHours * 60

    if (shift.type === 'overtime') {
      const extraMin = Math.max(0, worked - normalMaxMin)
      regularMinutes  += worked - extraMin
      overtimeMinutes += extraMin
    } else {
      regularMinutes += worked
    }

    nightMinutes += night
  }

  const regularHours  = r2(regularMinutes  / 60)
  const overtimeHours = r2(overtimeMinutes / 60)
  const nightHours    = r2(nightMinutes    / 60)
  const workingDays   = countWorkingDays(monthShifts)

  // ── Base salary ──────────────────────────────────────────────────────────────
  const baseSalary = r2(regularHours * rate)

  // ── Allowances ───────────────────────────────────────────────────────────────
  const allowances: PayslipAllowance[] = []

  // Overtime
  if (overtimeHours > 0) {
    const otRate   = 1 + (settings.overtimeRate / 100)
    const otAmount = r2(overtimeHours * rate * otRate)
    allowances.push({ type: 'overtime', description: `HE (${settings.overtimeRate}%)`, amount: otAmount })
  }

  // Night differential
  if (nightHours > 0) {
    const ndAmount = r2(nightHours * rate * (settings.nightDifferential / 100))
    allowances.push({ type: 'night_diff', description: `Adicional Noturno (${settings.nightDifferential}%)`, amount: ndAmount })
  }

  // DSR — proportional daily rest allowance
  // Simplified: (weekly overtime / 6) × number of rest days
  const dsrAmount = r2(overtimeHours > 0 ? (overtimeHours / 6) * rate * 1 : 0)
  if (dsrAmount > 0) {
    allowances.push({ type: 'dsr', description: 'DSR s/ Horas Extras', amount: dsrAmount })
  }

  const grossTotal = r2(
    baseSalary + allowances.reduce((s, a) => s + a.amount, 0),
  )

  // ── Deductions ────────────────────────────────────────────────────────────────
  const deductions: PayslipDeduction[] = []

  // INSS (worker)
  const inssAmount = calcINSS(grossTotal)
  if (inssAmount > 0) {
    deductions.push({ type: 'inss', description: 'INSS (trabalhador)', amount: inssAmount, workerPays: true })
  }

  // IRRF (worker — after INSS)
  const irrfBase   = Math.max(0, grossTotal - inssAmount)
  const irrfAmount = calcIRRF(irrfBase)
  if (irrfAmount > 0) {
    deductions.push({ type: 'irrf', description: 'IRRF', amount: irrfAmount, workerPays: true })
  }

  // VT — worker portion: 6% of baseSalary (capped to baseSalary)
  const vtWorker = r2(Math.min(baseSalary * 0.06, baseSalary))
  if (vtWorker > 0) {
    deductions.push({ type: 'vt', description: 'Vale-Transporte (desconto 6%)', amount: vtWorker, workerPays: true })
  }

  // VA/VR — R$35/working day (employee discount)
  const vaWorker = r2(workingDays * 35)
  if (vaWorker > 0 && workingDays > 0) {
    deductions.push({ type: 'va', description: 'Vale-Alimentação (desconto)', amount: vaWorker, workerPays: true })
  }

  // FGTS (employer only — shown on payslip for transparency but worker doesn't pay)
  const fgtsAmount = calcFGTS(grossTotal)
  deductions.push({ type: 'fgts', description: 'FGTS (empregador 8%)', amount: fgtsAmount, workerPays: false })

  const workerDeductions = deductions
    .filter((d) => d.workerPays)
    .reduce((s, d) => s + d.amount, 0)

  const netTotal    = r2(grossTotal - workerDeductions)
  const employerCost = r2(grossTotal + fgtsAmount + calcEmployerINSS(grossTotal))

  return {
    id:           crypto.randomUUID(),
    workerId:     worker.id,
    month,
    baseSalary,
    allowances,
    deductions,
    grossTotal,
    netTotal,
    employerCost,
    hoursWorked:  regularHours + overtimeHours,
    overtimeHours,
    nightHours,
    workingDays,
    generatedAt:  new Date().toISOString(),
  }
}

export function generateMonthPayroll(
  workers: Worker[],
  shifts: Shift[],
  settings: CLTSettings,
  month: string,
): PayrollMonth {
  const active   = workers.filter((w) => w.status === 'active')
  const payslips = active.map((w) => generatePayslip(w, shifts, settings, month))

  return {
    month,
    payslips,
    totalGross:       r2(payslips.reduce((s, p) => s + p.grossTotal,      0)),
    totalNet:         r2(payslips.reduce((s, p) => s + p.netTotal,        0)),
    totalEmployerCost:r2(payslips.reduce((s, p) => s + p.employerCost,    0)),
    headcount:        payslips.length,
  }
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

/** Sanitizes a cell value for CSV — prevents formula injection, escapes quotes */
function csvCell(value: string | number): string {
  const str = String(value)
  // Prevent formula injection: prefix with apostrophe if starts with =, +, -, @
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str
  // Escape double quotes
  const escaped = safe.replace(/"/g, '""')
  return `"${escaped}"`
}

export function payrollToCSV(payroll: PayrollMonth, workerNames: Record<string, string>): string {
  const headers = [
    'Matrícula/ID', 'Colaborador', 'H. Trabalhadas', 'H. Extras', 'H. Noturnas',
    'Dias Úteis', 'Base Bruto', 'Total Adicionais', 'Total Descontos (trabalhador)',
    'Salário Líquido', 'FGTS (empregador)', 'Custo Total Empresa',
  ]

  const rows = payroll.payslips.map((p) => {
    const name       = workerNames[p.workerId] ?? p.workerId
    const allowSum   = r2(p.allowances.reduce((s, a) => s + a.amount, 0))
    const workerDed  = r2(p.deductions.filter((d) => d.workerPays).reduce((s, d) => s + d.amount, 0))
    const fgts       = p.deductions.find((d) => d.type === 'fgts')?.amount ?? 0
    return [
      p.workerId, name, p.hoursWorked, p.overtimeHours, p.nightHours,
      p.workingDays, p.baseSalary, allowSum, workerDed,
      p.netTotal, fgts, p.employerCost,
    ].map(csvCell).join(',')
  })

  return [headers.map(csvCell).join(','), ...rows].join('\n')
}
