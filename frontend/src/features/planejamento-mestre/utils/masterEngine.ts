/**
 * masterEngine.ts — Pure computation functions for Planejamento Mestre.
 * No side effects, no store dependencies.
 */
import type { MasterActivity, WhatIfAdjustment, LookaheadDerivedActivity } from '@/types'

// ─── S-Curve Computation ─────────────────────────────────────────────────────

export interface MasterSCurvePoint {
  date: string
  cumulativePct: number
}

/**
 * Compute a cumulative S-curve from master activities.
 * Uses each activity's `weight` and `percentComplete` to build a
 * day-by-day cumulative progress curve based on trend dates.
 */
export function computeMasterSCurve(
  activities: MasterActivity[],
  startDate: string,
  endDate: string,
): MasterSCurvePoint[] {
  const start = new Date(startDate + 'T00:00:00')
  const end   = new Date(endDate + 'T00:00:00')
  if (start >= end) return []

  const totalWeight = activities.reduce((s, a) => s + (a.weight ?? 1), 0)
  if (totalWeight === 0) return []

  const points: MasterSCurvePoint[] = []
  const dayCount = Math.min(730, Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1)

  for (let d = 0; d < dayCount; d++) {
    const date = new Date(start)
    date.setDate(date.getDate() + d)
    const isoDate = date.toISOString().slice(0, 10)

    let cumulative = 0
    for (const act of activities) {
      const w = (act.weight ?? 1) / totalWeight
      const aStart = new Date(act.trendStart + 'T00:00:00')
      const aEnd   = new Date(act.trendEnd + 'T00:00:00')
      const dur = Math.max(1, (aEnd.getTime() - aStart.getTime()) / 86_400_000)

      if (date < aStart) {
        // Not started
      } else if (date >= aEnd) {
        cumulative += w * 100
      } else {
        const elapsed = (date.getTime() - aStart.getTime()) / 86_400_000
        cumulative += w * (elapsed / dur) * 100
      }
    }
    points.push({ date: isoDate, cumulativePct: Math.min(100, cumulative) })
  }

  return points
}

// ─── What-If Adjustments ─────────────────────────────────────────────────────

function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Apply what-if adjustments to activities, returning new array (never mutates).
 */
export function applyWhatIfAdjustments(
  activities: MasterActivity[],
  adjustments: WhatIfAdjustment[],
): MasterActivity[] {
  const adjMap = new Map(adjustments.map((a) => [a.activityId, a]))

  return activities.map((act) => {
    const adj = adjMap.get(act.id)
    if (!adj) return act

    const newStart = shiftDate(act.trendStart, adj.deltaStartDays)
    const newDuration = Math.max(1, act.durationDays + adj.deltaDurationDays)
    const newEnd = shiftDate(newStart, newDuration)

    return {
      ...act,
      trendStart: newStart,
      trendEnd: newEnd,
      durationDays: newDuration,
    }
  })
}

// ─── Look-ahead Derivation ───────────────────────────────────────────────────

/**
 * Filter master activities whose trendStart falls within the next N weeks,
 * and transform them into LookaheadDerivedActivity entries.
 */
export function deriveLookahead(
  activities: MasterActivity[],
  fromDate: string,
  weeks: number,
): LookaheadDerivedActivity[] {
  const from = new Date(fromDate + 'T00:00:00')
  const to   = new Date(from)
  to.setDate(to.getDate() + weeks * 7)

  const result: LookaheadDerivedActivity[] = []

  for (const act of activities) {
    if (act.isMilestone) continue
    if (act.level < 1) continue // Only derive from deliverable-level activities

    const aStart = new Date(act.trendStart + 'T00:00:00')
    const aEnd   = new Date(act.trendEnd + 'T00:00:00')

    // Include if activity overlaps the look-ahead window
    if (aEnd < from || aStart > to) continue

    // Determine which ISO week the activity primarily falls in
    const midDate = new Date(Math.max(aStart.getTime(), from.getTime()))
    const weekIso = getIsoWeek(midDate)

    const status: LookaheadDerivedActivity['status'] =
      act.status === 'completed' ? 'completed' :
      act.percentComplete >= 50  ? 'ready' :
      act.status === 'delayed'   ? 'blocked' :
                                   'planned'

    result.push({
      id:                 `derived-${act.id}`,
      masterActivityId:   act.id,
      weekIso,
      name:               act.name,
      responsible:        act.responsibleTeam ?? 'A definir',
      status,
      networkType:        act.networkType,
    })
  }

  return result
}

function getIsoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

// ─── Date range helpers ──────────────────────────────────────────────────────

export function getProjectDateRange(activities: MasterActivity[]): { start: string; end: string } {
  if (activities.length === 0) return { start: '2026-04-01', end: '2026-10-01' }
  const starts = activities.map((a) => a.trendStart).sort()
  const ends   = activities.map((a) => a.trendEnd).sort()
  return { start: starts[0], end: ends[ends.length - 1] }
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86_400_000)
}
