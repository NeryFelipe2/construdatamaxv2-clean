/**
 * CLT Compliance Engine — pure functions, no side effects, no Zustand imports.
 *
 * Encodes Brazilian CLT labor law rules:
 *  - Art. 58: max 8h/day regular work
 *  - Art. 59: max 2h/day overtime, agreement required
 *  - Art. 66: minimum 11h rest between consecutive shifts
 *  - Art. 71: mandatory break ≥1h if >6h worked, ≥15min if 4–6h worked
 *  - Art. 67/68: DSR — at least 1 full day off per 7-day period
 *  - Art. 73: night shift hours (22h–5h) with configurable differential
 *  - Max 44h/week (Art. 7, CF/88)
 *  - 12x36 schedule: 12h shift + 36h minimum rest
 */

import type { Shift, Worker, WorkPost, CLTSettings, CLTViolation, CLTViolationType, CMOSummary, CMORoleItem } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "HH:mm" to total minutes since midnight */
function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Duration in minutes from startTime to endTime (handles overnight shifts) */
function clockMinutes(startTime: string, endTime: string): number {
  const s = parseTime(startTime)
  const e = parseTime(endTime)
  return e > s ? e - s : 24 * 60 - s + e
}

/** Worked minutes = clockMinutes - breakMinutes */
export function calcShiftMinutes(shift: Shift): number {
  if (shift.type === 'day_off' || shift.type === 'holiday') return 0
  return Math.max(0, clockMinutes(shift.startTime, shift.endTime) - shift.breakMinutes)
}

/** Worked hours (float) */
export function calcShiftHours(shift: Shift): number {
  return calcShiftMinutes(shift) / 60
}

/** Returns minutes of worked time that fall in the night window */
export function calcNightMinutes(shift: Shift, settings: CLTSettings): number {
  if (shift.type === 'day_off' || shift.type === 'holiday') return 0
  const { nightStart, nightEnd } = settings
  const ns = nightStart * 60
  const ne = nightEnd  * 60 + (nightEnd < nightStart ? 24 * 60 : 0)

  let start = parseTime(shift.startTime)
  let end   = parseTime(shift.endTime)
  if (end <= start) end += 24 * 60

  // Overlap of [start,end] with [ns, ne]
  const overlapStart = Math.max(start, ns)
  const overlapEnd   = Math.min(end,   ne)
  const raw = Math.max(0, overlapEnd - overlapStart)

  // Also check if end wraps and the start of next day is within window
  const overlapStart2 = Math.max(start, ns + 24 * 60)
  const overlapEnd2   = Math.min(end,   ne + 24 * 60)
  const raw2 = Math.max(0, overlapEnd2 - overlapStart2)

  const totalNightMinutes = raw + raw2 - shift.breakMinutes
  return Math.max(0, Math.min(totalNightMinutes, calcShiftMinutes(shift)))
}

export function isNightShift(shift: Shift, settings: CLTSettings): boolean {
  return calcNightMinutes(shift, settings) > 0
}

/** ISO date string of the Monday of the week containing `date` */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun,1=Mon,...6=Sat
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/** Get all dates in the same Mon–Sun week as dateStr */
function weekDates(dateStr: string): string[] {
  const monday = new Date(mondayOf(dateStr) + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

/** Add minutes to an ISO datetime string, return new ISO string */
function addMinutesToDateTime(date: string, startTime: string, extraMinutes: number): Date {
  const d = new Date(date + 'T' + startTime + ':00')
  d.setMinutes(d.getMinutes() + extraMinutes)
  return d
}

/** End datetime of a shift (handles overnight) */
function shiftEndDate(shift: Shift): Date {
  const start = new Date(shift.date + 'T' + shift.startTime + ':00')
  const totalClockMinutes = clockMinutes(shift.startTime, shift.endTime)
  return new Date(start.getTime() + totalClockMinutes * 60_000)
}

function makeId(): string {
  return 'viol-' + Math.random().toString(36).slice(2, 10)
}

// ─── Individual validators ────────────────────────────────────────────────────

export function validateDailyHours(shift: Shift, workerName: string, settings: CLTSettings): CLTViolation[] {
  if (shift.type === 'day_off' || shift.type === 'holiday') return []
  const workedH = calcShiftHours(shift)
  const maxTotal = settings.maxDailyHours + settings.maxOvertimeHours
  const violations: CLTViolation[] = []

  if (workedH > maxTotal) {
    violations.push({
      id: makeId(),
      workerId: shift.workerId,
      workerName,
      type: 'max_daily_hours' as CLTViolationType,
      severity: 'blocking',
      description: `${workerName}: ${workedH.toFixed(1)}h no dia ${shift.date} — máximo ${maxTotal}h (${settings.maxDailyHours}h + ${settings.maxOvertimeHours}h HE)`,
      date: shift.date,
    })
  } else if (workedH > settings.maxDailyHours) {
    violations.push({
      id: makeId(),
      workerId: shift.workerId,
      workerName,
      type: 'max_overtime' as CLTViolationType,
      severity: 'warning',
      description: `${workerName}: ${(workedH - settings.maxDailyHours).toFixed(1)}h de HE em ${shift.date} — máximo configurado: ${settings.maxOvertimeHours}h/dia`,
      date: shift.date,
    })
  }
  return violations
}

export function validateBreaks(shift: Shift, workerName: string): CLTViolation[] {
  if (shift.type === 'day_off' || shift.type === 'holiday') return []
  const workedH = calcShiftHours(shift)
  const violations: CLTViolation[] = []

  if (workedH > 6 && shift.breakMinutes < 60) {
    violations.push({
      id: makeId(),
      workerId: shift.workerId,
      workerName,
      type: 'break_required' as CLTViolationType,
      severity: 'blocking',
      description: `${workerName}: turno de ${workedH.toFixed(1)}h em ${shift.date} requer intervalo ≥1h (CLT Art. 71). Intervalo registrado: ${shift.breakMinutes}min.`,
      date: shift.date,
    })
  } else if (workedH > 4 && workedH <= 6 && shift.breakMinutes < 15) {
    violations.push({
      id: makeId(),
      workerId: shift.workerId,
      workerName,
      type: 'break_required' as CLTViolationType,
      severity: 'warning',
      description: `${workerName}: turno de ${workedH.toFixed(1)}h em ${shift.date} requer intervalo ≥15min (CLT Art. 71). Intervalo registrado: ${shift.breakMinutes}min.`,
      date: shift.date,
    })
  }
  return violations
}

export function validateRestBetweenShifts(workerShifts: Shift[], workerName: string, settings: CLTSettings): CLTViolation[] {
  const violations: CLTViolation[] = []
  const workShifts = workerShifts
    .filter((s) => s.type !== 'day_off' && s.type !== 'holiday')
    .sort((a, b) => {
      const ae = shiftEndDate(a).getTime()
      const be = shiftEndDate(b).getTime()
      return ae - be
    })

  for (let i = 0; i < workShifts.length - 1; i++) {
    const curr = workShifts[i]
    const next = workShifts[i + 1]

    const currEnd   = shiftEndDate(curr)
    const nextStart = new Date(next.date + 'T' + next.startTime + ':00')
    const restMinutes = (nextStart.getTime() - currEnd.getTime()) / 60_000

    if (restMinutes < settings.minRestMinutes) {
      const restH = (restMinutes / 60).toFixed(1)
      const requiredH = (settings.minRestMinutes / 60).toFixed(0)
      violations.push({
        id: makeId(),
        workerId: curr.workerId,
        workerName,
        type: 'min_rest' as CLTViolationType,
        severity: 'blocking',
        description: `${workerName}: apenas ${restH}h de descanso entre turno de ${curr.date} e ${next.date} — mínimo exigido: ${requiredH}h (CLT Art. 66)`,
        date: next.date,
      })
    }
  }
  return violations
}

export function validateWeeklyHours(workerShifts: Shift[], workerName: string, weekOf: string, settings: CLTSettings): CLTViolation[] {
  const dates = new Set(weekDates(weekOf))
  const weekShifts = workerShifts.filter((s) => dates.has(s.date))
  const totalH = weekShifts.reduce((acc, s) => acc + calcShiftHours(s), 0)
  const violations: CLTViolation[] = []

  if (totalH > settings.maxWeeklyHours) {
    violations.push({
      id: makeId(),
      workerId: workerShifts[0]?.workerId ?? '',
      workerName,
      type: 'max_weekly_hours' as CLTViolationType,
      severity: 'warning',
      description: `${workerName}: ${totalH.toFixed(1)}h na semana de ${weekOf} — máximo ${settings.maxWeeklyHours}h/semana (CLT Art. 58)`,
      date: weekOf,
    })
  }
  return violations
}

export function validateDSR(workerShifts: Shift[], workerName: string, weekOf: string): CLTViolation[] {
  const dates = new Set(weekDates(weekOf))
  const weekShifts = workerShifts.filter((s) => dates.has(s.date))
  const hasDayOff = weekShifts.some((s) => s.type === 'day_off' || s.type === 'holiday')
  const violations: CLTViolation[] = []

  if (!hasDayOff) {
    violations.push({
      id: makeId(),
      workerId: workerShifts[0]?.workerId ?? '',
      workerName,
      type: 'missing_dsr' as CLTViolationType,
      severity: 'blocking',
      description: `${workerName}: sem DSR na semana de ${weekOf} — obrigatório 1 dia de descanso por semana (CLT Art. 67)`,
      date: weekOf,
    })
  }
  return violations
}

// ─── Full check pass ──────────────────────────────────────────────────────────

export function runAllCLTChecks(workers: Worker[], shifts: Shift[], settings: CLTSettings): CLTViolation[] {
  const violations: CLTViolation[] = []

  for (const worker of workers) {
    const workerShifts = shifts.filter((s) => s.workerId === worker.id)
    if (workerShifts.length === 0) continue

    // Daily checks
    for (const shift of workerShifts) {
      violations.push(...validateDailyHours(shift, worker.name, settings))
      violations.push(...validateBreaks(shift, worker.name))
    }

    // Rest between shifts
    violations.push(...validateRestBetweenShifts(workerShifts, worker.name, settings))

    // Weekly checks — collect all unique weeks
    const weeks = new Set(workerShifts.map((s) => mondayOf(s.date)))
    for (const weekStart of weeks) {
      violations.push(...validateWeeklyHours(workerShifts, worker.name, weekStart, settings))
      violations.push(...validateDSR(workerShifts, worker.name, weekStart))
    }
  }

  return violations
}

// ─── Auto-generate schedule ───────────────────────────────────────────────────

/**
 * Generates a CLT-compliant monthly schedule.
 * Strategy:
 *  1. For each working day of the month (Mon–Sat):
 *     - For each work post, assign min-required workers matching the role
 *     - Prefer workers with fewer hours assigned so far
 *     - Skip workers that would violate rest constraints
 *  2. Assign Sunday as day_off for all workers
 *  3. Return array of Shift objects (no IDs — store will assign them)
 */
export function autoGenerateSchedule(
  workers: Worker[],
  posts: WorkPost[],
  month: string,             // "YYYY-MM"
  settings: CLTSettings,
): Omit<Shift, 'id'>[] {
  const [year, mon] = month.split('-').map(Number)
  const daysInMonth = new Date(year, mon, 0).getDate()
  const result: Omit<Shift, 'id'>[] = []

  // Track hours per worker for weekly check
  const weeklyHours: Record<string, number> = {}
  const lastShiftEnd: Record<string, Date | null> = {}
  workers.forEach((w) => { weeklyHours[w.id] = 0; lastShiftEnd[w.id] = null })

  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    const dow = new Date(date + 'T00:00:00').getDay() // 0=Sun

    // DSR: Sunday = day off for all workers
    if (dow === 0) {
      workers.forEach((w) => {
        result.push({ workerId: w.id, date, startTime: '00:00', endTime: '00:00', breakMinutes: 0, type: 'day_off', status: 'scheduled' })
      })
      // Reset weekly hours on Sunday
      workers.forEach((w) => { weeklyHours[w.id] = 0 })
      continue
    }

    const assignedToday = new Set<string>()

    for (const post of posts) {
      // Find eligible workers for this post
      const eligible = workers.filter((w) =>
        w.status === 'active' &&
        w.role === post.role &&
        !assignedToday.has(w.id)
      )

      // Sort by least weekly hours first
      eligible.sort((a, b) => (weeklyHours[a.id] ?? 0) - (weeklyHours[b.id] ?? 0))

      let assigned = 0
      for (const worker of eligible) {
        if (assigned >= post.minWorkers) break

        // Check rest constraint
        const prevEnd = lastShiftEnd[worker.id]
        if (prevEnd) {
          const nextStart = new Date(date + 'T07:00:00')
          const restMs = nextStart.getTime() - prevEnd.getTime()
          const restMin = restMs / 60_000
          if (restMin < settings.minRestMinutes) continue // skip — would violate rest
        }

        // Check weekly hours
        if ((weeklyHours[worker.id] ?? 0) + settings.maxDailyHours > settings.maxWeeklyHours) continue

        const shift: Omit<Shift, 'id'> = {
          workerId:     worker.id,
          date,
          startTime:    '07:00',
          endTime:      '16:00',
          breakMinutes: 60,
          type:         'regular',
          workFront:    post.workFront,
          status:       'scheduled',
        }
        result.push(shift)
        assignedToday.add(worker.id)
        weeklyHours[worker.id] = (weeklyHours[worker.id] ?? 0) + settings.maxDailyHours
        lastShiftEnd[worker.id] = new Date(date + 'T16:00:00')
        assigned++
      }
    }
  }

  return result
}

// ─── Monthly cost projection ──────────────────────────────────────────────────

export function projectMonthlyCost(workers: Worker[], shifts: Shift[], settings: CLTSettings): CMOSummary {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const byRole: Record<string, CMORoleItem> = {}

  let totalBase = 0, totalOT = 0, totalNight = 0, totalDSR = 0
  let totalRegH = 0, totalOTH = 0, totalNightH = 0

  for (const worker of workers) {
    if (worker.status !== 'active') continue
    const workerShifts = shifts.filter((s) => s.workerId === worker.id && s.type !== 'day_off' && s.type !== 'holiday')
    const rate = worker.hourlyRate

    let regH = 0, otH = 0, nightH = 0

    for (const shift of workerShifts) {
      const worked = calcShiftHours(shift)
      const night  = calcNightMinutes(shift, settings) / 60
      if (worked > settings.maxDailyHours) {
        regH  += settings.maxDailyHours
        otH   += worked - settings.maxDailyHours
      } else {
        regH  += worked
      }
      nightH += night
    }

    // DSR: proportional to worked days (simplification: workedDays / 6 * 1 day pay)
    const workedDays = workerShifts.length
    const dsrDays    = Math.floor(workedDays / 6)
    const dsrCost    = dsrDays * rate * settings.maxDailyHours

    const baseCost   = regH  * rate
    const otCost     = otH   * rate * (1 + settings.overtimeRate / 100)
    const nightCost  = nightH * rate * (settings.nightDifferential / 100)

    totalBase  += baseCost
    totalOT    += otCost
    totalNight += nightCost
    totalDSR   += dsrCost
    totalRegH  += regH
    totalOTH   += otH
    totalNightH += nightH

    const role = worker.role
    if (!byRole[role]) {
      byRole[role] = { role, workerCount: 0, regularHours: 0, overtimeHours: 0, nightHours: 0, baseCost: 0, overtimeCost: 0, nightCost: 0, dsrCost: 0, totalCost: 0 }
    }
    byRole[role].workerCount++
    byRole[role].regularHours  += regH
    byRole[role].overtimeHours += otH
    byRole[role].nightHours    += nightH
    byRole[role].baseCost      += baseCost
    byRole[role].overtimeCost  += otCost
    byRole[role].nightCost     += nightCost
    byRole[role].dsrCost       += dsrCost
    byRole[role].totalCost     += baseCost + otCost + nightCost + dsrCost
  }

  const totalCost = totalBase + totalOT + totalNight + totalDSR

  return {
    month,
    regularHours: totalRegH,
    overtimeHours: totalOTH,
    nightHours: totalNightH,
    baseCost: totalBase,
    overtimeCost: totalOT,
    nightCost: totalNight,
    dsrCost: totalDSR,
    totalCost,
    roleBreakdown: Object.values(byRole).sort((a, b) => b.totalCost - a.totalCost),
  }
}

// ─── Substitute suggestion ────────────────────────────────────────────────────

/**
 * Returns workers ranked by suitability to substitute an absent worker on a given date.
 * Ranking criteria (descending priority):
 *  1. Same role as absent worker
 *  2. CLT compliance (not already scheduled that day, rest constraint met)
 *  3. Lower hourly rate preferred (base scenario cost optimization)
 */
export function suggestSubstitutes(
  absentWorker: Worker,
  date: string,
  allWorkers: Worker[],
  shifts: Shift[],
  settings: CLTSettings,
): Worker[] {
  const dayShifts = shifts.filter((s) => s.date === date)
  const alreadyScheduledIds = new Set(dayShifts.map((s) => s.workerId))

  return allWorkers
    .filter((w) => {
      if (w.id === absentWorker.id) return false
      if (w.status !== 'active') return false
      if (w.role !== absentWorker.role) return false
      if (alreadyScheduledIds.has(w.id)) return false

      // Check rest constraint: find worker's last shift before this date
      const prevShifts = shifts
        .filter((s) => s.workerId === w.id && s.date < date && s.type !== 'day_off' && s.type !== 'holiday')
        .sort((a, b) => shiftEndDate(b).getTime() - shiftEndDate(a).getTime())

      if (prevShifts.length > 0) {
        const lastEnd = shiftEndDate(prevShifts[0])
        const nextStart = new Date(date + 'T07:00:00')
        const restMin = (nextStart.getTime() - lastEnd.getTime()) / 60_000
        if (restMin < settings.minRestMinutes) return false
      }

      return true
    })
    .sort((a, b) => a.hourlyRate - b.hourlyRate)
}

// ─── Post coverage check ──────────────────────────────────────────────────────

export interface PostCoverageResult {
  postId: string
  postName: string
  date: string
  required: number
  scheduled: number
  isCovered: boolean
  workerNames: string[]
}

export function checkPostCoverage(
  posts: WorkPost[],
  shifts: Shift[],
  workers: Worker[],
  dates: string[],
): PostCoverageResult[] {
  const results: PostCoverageResult[] = []
  const workerMap = new Map(workers.map((w) => [w.id, w]))

  for (const date of dates) {
    for (const post of posts) {
      const dayShifts = shifts.filter(
        (s) => s.date === date && s.workFront === post.workFront && s.type !== 'day_off'
      )
      const matchingWorkers = dayShifts
        .map((s) => workerMap.get(s.workerId))
        .filter((w): w is Worker => w !== undefined && w.role === post.role)

      results.push({
        postId:      post.id,
        postName:    post.name,
        date,
        required:    post.minWorkers,
        scheduled:   matchingWorkers.length,
        isCovered:   matchingWorkers.length >= post.minWorkers,
        workerNames: matchingWorkers.map((w) => w.name),
      })
    }
  }

  return results
}

// Re-export addMinutesToDateTime for use in components if needed
export { addMinutesToDateTime }
