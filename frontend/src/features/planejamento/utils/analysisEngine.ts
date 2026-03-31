/**
 * analysisEngine.ts — Pure analysis functions for the Planejamento module.
 * Computes ABC curve, S-curve, and resource histogram from schedule results.
 *
 * No side effects, no Zustand.
 */
import type {
  GanttRow,
  PlanTeam,
  AbcItem,
  AbcZone,
  SCurvePoint,
  HistogramPoint,
} from '@/types'
import { teamHeadcount, teamEquipmentUnits, teamDailyCost } from './scheduleEngine'
import type { PlanScheduleConfig } from '@/types'

// ─── ABC / Pareto Curve ──────────────────────────────────────────────────────

/**
 * Compute ABC Pareto curve items sorted by total cost descending.
 * Zone A: ≤75% cumulative; Zone B: ≤95%; Zone C: above 95%.
 */
export function computeAbcCurve(ganttRows: GanttRow[]): AbcItem[] {
  if (ganttRows.length === 0) return []

  const grandTotal = ganttRows.reduce((sum, r) => sum + r.totalCostBRL, 0)
  if (grandTotal === 0) return []

  const sorted = [...ganttRows].sort((a, b) => b.totalCostBRL - a.totalCostBRL)

  let cumulative = 0
  return sorted.map((row) => {
    const sharePct = (row.totalCostBRL / grandTotal) * 100
    cumulative += sharePct
    const zone: AbcZone = cumulative <= 75 ? 'A' : cumulative <= 95 ? 'B' : 'C'
    return {
      trecho: row.trecho,
      totalCostBRL: row.totalCostBRL,
      sharePct: Math.round(sharePct * 100) / 100,
      cumulativePct: Math.round(cumulative * 100) / 100,
      zone,
    }
  })
}

// ─── S-Curve ─────────────────────────────────────────────────────────────────

/**
 * Compute physical and financial S-curve points — one per work day.
 * Physical: cumulative meters completed as % of total meters.
 * Financial: cumulative cost incurred as % of total cost.
 */
export function computeSCurve(
  ganttRows: GanttRow[],
  workDays: string[],
  totalMeters: number,
  totalCostBRL: number,
): SCurvePoint[] {
  if (workDays.length === 0 || totalMeters === 0 || totalCostBRL === 0) return []

  // Build per-day maps
  const metersByDate = new Map<string, number>()
  const costByDate = new Map<string, number>()

  for (const row of ganttRows) {
    for (const cell of row.cells) {
      if (cell.isHydroTest) continue
      metersByDate.set(cell.date, (metersByDate.get(cell.date) ?? 0) + cell.metersPlanned)
      costByDate.set(cell.date, (costByDate.get(cell.date) ?? 0) + row.dailyCostBRL)
    }
  }

  let cumMeters = 0
  let cumCost = 0

  return workDays.map((date, i) => {
    cumMeters += metersByDate.get(date) ?? 0
    cumCost   += costByDate.get(date) ?? 0

    return {
      dayIndex: i,
      date,
      cumulativePhysicalPct:   Math.min(100, Math.round((cumMeters / totalMeters) * 10000) / 100),
      cumulativeFinancialPct:  Math.min(100, Math.round((cumCost   / totalCostBRL) * 10000) / 100),
      cumulativeMeters:        Math.round(cumMeters * 100) / 100,
      cumulativeCostBRL:       Math.round(cumCost   * 100) / 100,
    }
  })
}

// ─── Resource Histogram ──────────────────────────────────────────────────────

/**
 * Compute daily resource usage: headcount, equipment units, and cost.
 * One data point per work day.
 */
export function computeHistogram(
  ganttRows: GanttRow[],
  workDays: string[],
  teams: PlanTeam[],
  config: PlanScheduleConfig,
): HistogramPoint[] {
  if (workDays.length === 0 || teams.length === 0) return []

  // Build per-date: which team indices are active
  const activeTeamsByDate = new Map<string, Set<number>>()

  for (const row of ganttRows) {
    for (const cell of row.cells) {
      if (cell.isHydroTest) continue
      if (!activeTeamsByDate.has(cell.date)) {
        activeTeamsByDate.set(cell.date, new Set())
      }
      activeTeamsByDate.get(cell.date)!.add(cell.teamIndex)
    }
  }

  return workDays.map((date, i) => {
    const activeTeamIdxs = activeTeamsByDate.get(date) ?? new Set<number>()
    let headcount = 0
    let equipmentUnits = 0
    let dailyCostBRL = 0

    for (const idx of activeTeamIdxs) {
      const team = teams[idx]
      if (!team) continue
      headcount      += teamHeadcount(team)
      equipmentUnits += teamEquipmentUnits(team)
      dailyCostBRL   += teamDailyCost(team, config.workHoursPerDay)
    }

    return {
      dayIndex: i,
      date,
      headcount,
      equipmentUnits,
      dailyCostBRL: Math.round(dailyCostBRL * 100) / 100,
    }
  })
}
