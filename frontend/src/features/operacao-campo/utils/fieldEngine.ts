/**
 * fieldEngine.ts — Pure computation functions for Operação e Campo.
 */
import type { FieldCalendarDay, WeeklyPpcResult, TrendPoint, FieldCalendarActivity, NotableServiceCurve } from '@/types'

function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Compute PPC for a specific ISO week from calendar day entries.
 */
export function computeFieldPpc(days: FieldCalendarDay[], weekIso: string): WeeklyPpcResult {
  const weekDays = days.filter((d) => {
    const date = new Date(d.date + 'T00:00:00')
    return getIsoWeek(date) === weekIso && d.actualQty !== null
  })

  const totalPlanned = weekDays.reduce((s, d) => s + d.plannedQty, 0)
  const totalCompleted = weekDays.reduce((s, d) => s + (d.actualQty ?? 0), 0)
  const ppc = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0

  return { weekIso, totalPlanned, totalCompleted, ppc }
}

/**
 * Compute all weekly PPCs from calendar data.
 */
export function computeAllWeeklyPpc(days: FieldCalendarDay[]): WeeklyPpcResult[] {
  const weeks = new Set<string>()
  for (const d of days) {
    if (d.actualQty !== null) {
      weeks.add(getIsoWeek(new Date(d.date + 'T00:00:00')))
    }
  }
  return Array.from(weeks).sort().map((w) => computeFieldPpc(days, w))
}

/**
 * Compute cumulative trend from calendar days.
 */
export function computeTrendFromDays(days: FieldCalendarDay[]): TrendPoint[] {
  const dates = [...new Set(days.map((d) => d.date))].sort()
  const totalPlanned = days.reduce((s, d) => s + d.plannedQty, 0)

  let cumPlanned = 0
  let cumActual = 0
  const points: TrendPoint[] = []

  for (const date of dates) {
    const dayEntries = days.filter((d) => d.date === date)
    cumPlanned += dayEntries.reduce((s, d) => s + d.plannedQty, 0)
    cumActual += dayEntries.reduce((s, d) => s + (d.actualQty ?? 0), 0)

    points.push({
      date,
      plannedCumulativePct: totalPlanned > 0 ? Math.min(100, (cumPlanned / totalPlanned) * 100) : 0,
      actualCumulativePct: totalPlanned > 0 ? Math.min(100, (cumActual / totalPlanned) * 100) : 0,
    })
  }

  return points
}

/**
 * Build notable service curve data from calendar days grouped by activity.
 */
export function computeNotableServiceData(
  days: FieldCalendarDay[],
  activities: FieldCalendarActivity[],
): NotableServiceCurve[] {
  return activities.slice(0, 3).map((act) => {
    const actDays = days.filter((d) => d.activityId === act.id)
    const dates = [...new Set(actDays.map((d) => d.date))].sort()

    return {
      id: `curve-${act.id}`,
      serviceName: act.name,
      unit: actDays[0]?.plannedUnit ?? 'un',
      dataPoints: dates.map((date) => {
        const entry = actDays.find((d) => d.date === date)
        return {
          date,
          planned: entry?.plannedQty ?? 0,
          actual: entry?.actualQty ?? 0,
        }
      }),
    }
  })
}
