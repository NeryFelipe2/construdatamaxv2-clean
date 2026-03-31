/**
 * scheduleEngine.ts — Pure scheduling functions for the Planejamento module.
 * No side effects, no Zustand. Mirrors cltEngine.ts / payrollEngine.ts pattern.
 *
 * Security:
 *  - maxDays=1000 hard cap prevents infinite loops from bad input
 *  - All numeric inputs clamped to non-negative values
 *  - No eval, no dynamic code execution
 */
import { addDays, getDay, parseISO, format } from 'date-fns'
import type {
  PlanTrecho,
  PlanTeam,
  PlanProductivityTable,
  PlanScheduleConfig,
  PlanHoliday,
  GanttCell,
  GanttRow,
  TrechoDelay,
} from '@/types'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_WORK_DAYS = 1000 // safety cap
const SOIL_SWELL_FACTOR = 0.8

// Soil-type multipliers applied to productivity and unit cost
const SOIL_PROD_MULTIPLIER: Record<string, number> = {
  normal: 1.0,
  mixed:  0.8,
  rocky:  0.6,
}
const SOIL_COST_MULTIPLIER: Record<string, number> = {
  normal: 1.0,
  mixed:  1.2,
  rocky:  1.4,
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScheduleResult {
  ganttRows: GanttRow[]
  workDays: string[]       // yyyy-MM-dd, all calendar work days in project span
  totalCostBRL: number
  totalMeters: number
  projectEndDate: string | null
}

// ─── buildWorkDays ───────────────────────────────────────────────────────────

/**
 * Generate an array of work day strings (yyyy-MM-dd) starting from startDate.
 * Skips weekends (always Sunday; Saturday if mon_fri mode) and holidays.
 * Hard-capped at MAX_WORK_DAYS to prevent runaway loops.
 */
export function buildWorkDays(
  startDate: string,
  count: number,
  config: PlanScheduleConfig,
  holidays: PlanHoliday[],
): string[] {
  const holidaySet = new Set(holidays.map((h) => h.date))
  const safeCount = Math.min(Math.max(0, count), MAX_WORK_DAYS)
  const result: string[] = []
  let cursor = parseISO(startDate)
  let iterations = 0

  while (result.length < safeCount && iterations < MAX_WORK_DAYS * 2) {
    iterations++
    const dow = getDay(cursor) // 0=Sun, 6=Sat
    const dateStr = format(cursor, 'yyyy-MM-dd')
    const isSunday = dow === 0
    const isSaturday = dow === 6
    const skipSat = config.workWeekMode === 'mon_fri'

    if (!isSunday && !(skipSat && isSaturday) && !holidaySet.has(dateStr)) {
      result.push(dateStr)
    }
    cursor = addDays(cursor, 1)
  }

  return result
}

/**
 * Build the complete work-day calendar from startDate up to maxDays work days.
 * Used to build the global calendar that all trechos reference by index.
 */
export function buildProjectCalendar(
  startDate: string,
  config: PlanScheduleConfig,
  holidays: PlanHoliday[],
): string[] {
  return buildWorkDays(startDate, MAX_WORK_DAYS, config, holidays)
}

// ─── effectiveMPerDay ────────────────────────────────────────────────────────

/**
 * Returns the bottleneck productivity in m/day for a given trecho + team.
 * All concurrent activities limit throughput; the minimum is the constraint.
 *
 * If trecho.depthM > team.maxManualExcavDepthM, excavation is mechanical-only
 * (retroescavadeira required). Mechanical mobilization reduces effective rate by 30%.
 */
export function effectiveMPerDay(
  trecho: PlanTrecho,
  prod: PlanProductivityTable,
  teamRetroCount: number,
  maxManualExcavDepthM = 1.5,
): number {
  const depth = Math.max(0.1, trecho.depthM) // prevent division by zero

  // If depth exceeds manual excavation limit, apply mechanical-only penalty (0.7×)
  const depthPenalty = depth > maxManualExcavDepthM ? 0.7 : 1.0

  // Soil type reduces productivity (rocky = 60%, mixed = 80%, normal = 100%)
  const soilMult = SOIL_PROD_MULTIPLIER[trecho.soilType] ?? 1.0

  const escMPerDay   = Math.max(1, prod.escavacao) * Math.max(1, teamRetroCount) * depthPenalty * soilMult
  const asstMPerDay  = Math.max(1, prod.assentamento) * soilMult
  const reatMPerDay  = (Math.max(1, prod.reaterro) / (depth * SOIL_SWELL_FACTOR)) * soilMult
  const escorMPerDay = trecho.requiresShoring
    ? (Math.max(1, prod.escoramento) / depth) * soilMult
    : Infinity

  return Math.max(0.1, Math.min(escMPerDay, asstMPerDay, reatMPerDay, escorMPerDay))
}

// ─── teamHeadcount ───────────────────────────────────────────────────────────

function teamHeadcount(team: PlanTeam): number {
  return (
    team.foremanCount +
    team.workerCount +
    team.helperCount +
    team.operatorCount
  )
}

function teamEquipmentUnits(team: PlanTeam): number {
  return team.retroescavadeira + team.compactador + team.caminhaoBasculante
}

function teamDailyCost(team: PlanTeam, workHoursPerDay: number): number {
  const headcount = teamHeadcount(team)
  const labor = headcount * team.laborHourlyRateBRL * workHoursPerDay
  const equip = team.equipmentDailyRateBRL
  return labor + equip
}

// ─── generateSchedule ────────────────────────────────────────────────────────

/**
 * Core scheduling algorithm.
 * Round-robin team assignment, sequential within each team.
 * Returns ganttRows (one per trecho), the global work-day array,
 * total project cost, and projected end date.
 */
export function generateSchedule(
  trechos: PlanTrecho[],
  teams: PlanTeam[],
  prod: PlanProductivityTable,
  config: PlanScheduleConfig,
  holidays: PlanHoliday[],
  delays: TrechoDelay[] = [],
): ScheduleResult {
  if (trechos.length === 0 || teams.length === 0) {
    return { ganttRows: [], workDays: [], totalCostBRL: 0, totalMeters: 0, projectEndDate: null }
  }

  // Build global calendar up to MAX_WORK_DAYS
  const calendar = buildProjectCalendar(config.startDate, config, holidays)

  // Track next available day index per team (round-robin)
  const teamNextDay = teams.map(() => 0)

  const ganttRows: GanttRow[] = []
  let maxDayIndex = 0

  for (let ti = 0; ti < trechos.length; ti++) {
    const trecho = trechos[ti]
    const teamIndex = ti % teams.length
    const team = teams[teamIndex]

    const mPerDay = effectiveMPerDay(trecho, prod, team.retroescavadeira, team.maxManualExcavDepthM ?? 1.5)
    const durationDays = Math.max(1, Math.ceil(trecho.lengthM / mPerDay))
    const delayExtra = delays
      .filter((d) => d.trechoCode === trecho.code)
      .reduce((sum, d) => sum + d.delayDays, 0)
    const startDayIndex = teamNextDay[teamIndex] + delayExtra

    // Guard: don't exceed calendar length
    if (startDayIndex >= calendar.length) break

    const cells: GanttCell[] = []
    let metersRemaining = trecho.lengthM

    for (let d = 0; d < durationDays; d++) {
      const dayIdx = startDayIndex + d
      if (dayIdx >= calendar.length) break

      const planned = Math.min(metersRemaining, mPerDay)
      metersRemaining -= planned

      cells.push({
        date: calendar[dayIdx],
        trechoId: trecho.id,
        teamIndex,
        metersPlanned: Math.round(planned * 100) / 100,
        isHydroTest: false,
      })
    }

    // Hydrostatic test: 1 day after execution
    const hydroDayIdx = startDayIndex + durationDays
    const hydroTestDate = hydroDayIdx < calendar.length
      ? calendar[hydroDayIdx]
      : ''

    if (hydroTestDate) {
      cells.push({
        date: hydroTestDate,
        trechoId: trecho.id,
        teamIndex,
        metersPlanned: 0,
        isHydroTest: true,
      })
    }

    const endDayIndex = startDayIndex + durationDays - 1
    const dailyCost = teamDailyCost(team, config.workHoursPerDay)
    const laborCost = dailyCost * durationDays
    // Soil type increases unit cost (rocky = 1.4×, mixed = 1.2×, normal = 1.0×)
    const soilCostMult = SOIL_COST_MULTIPLIER[trecho.soilType] ?? 1.0
    const materialCost = (trecho.unitCostBRL ?? 0) * trecho.lengthM * soilCostMult
    const totalCost = laborCost + materialCost

    ganttRows.push({
      trecho,
      cells,
      startDate: calendar[startDayIndex] ?? '',
      endDate: calendar[Math.min(endDayIndex, calendar.length - 1)] ?? '',
      hydroTestDate,
      durationDays,
      dailyCostBRL: Math.round(dailyCost * 100) / 100,
      totalCostBRL: Math.round(totalCost * 100) / 100,
      teamIndex,
    })

    // Advance team: execution days + 1 hydro day
    teamNextDay[teamIndex] = startDayIndex + durationDays + 1
    maxDayIndex = Math.max(maxDayIndex, startDayIndex + durationDays)
  }

  // Trim calendar to only days actually used
  const usedWorkDays = calendar.slice(0, maxDayIndex + 1)

  const totalCostBRL = ganttRows.reduce((sum, r) => sum + r.totalCostBRL, 0)
  const totalMeters = trechos.reduce((sum, t) => sum + t.lengthM, 0)
  const projectEndDate = usedWorkDays.length > 0
    ? usedWorkDays[usedWorkDays.length - 1]
    : null

  return {
    ganttRows,
    workDays: usedWorkDays,
    totalCostBRL: Math.round(totalCostBRL * 100) / 100,
    totalMeters: Math.round(totalMeters * 100) / 100,
    projectEndDate,
  }
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export { teamHeadcount, teamEquipmentUnits, teamDailyCost }
