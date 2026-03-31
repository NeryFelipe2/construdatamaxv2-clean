import {
  parseISO,
  format,
  addWeeks,
  addDays,
  differenceInDays,
  getISOWeek,
  isAfter,
  isBefore,
  startOfWeek,
  getMonth,
  getYear,
  getQuarter,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AgendaTask, AgendaViewMode } from '@/types'

export const COLUMN_WIDTH = 140  // px per week (legacy constant, kept for drag math)
export const ROW_HEIGHT   = 72   // px per resource row
export const SIDEBAR_W    = 240  // px for sticky name column
export const HEADER_H     = 68   // px for the two-row time header

// ─── ViewMode params ──────────────────────────────────────────────────────────

export interface ViewParams {
  pixelsPerDay: number   // px for 1 calendar day
  totalDays:    number   // total days in visible window
  columnDays:   number   // days per header column
  panDays:      number   // days per pan action
}

export function getViewParams(mode: AgendaViewMode): ViewParams {
  switch (mode) {
    case 'day':      return { pixelsPerDay: 40,   totalDays: 14,  columnDays: 1,   panDays: 7   }
    case 'week':     return { pixelsPerDay: 20,   totalDays: 70,  columnDays: 7,   panDays: 28  }
    case 'month':    return { pixelsPerDay: 3.33, totalDays: 180, columnDays: 30,  panDays: 90  }
    case 'quarter':  return { pixelsPerDay: 1.1,  totalDays: 365, columnDays: 91,  panDays: 91  }
    case 'semester': return { pixelsPerDay: 0.55, totalDays: 548, columnDays: 182, panDays: 182 }
    case 'year':     return { pixelsPerDay: 0.28, totalDays: 730, columnDays: 365, panDays: 365 }
  }
}

/** Label for a column starting at `date` in a given viewMode */
export function getColumnLabel(date: Date, mode: AgendaViewMode): string {
  switch (mode) {
    case 'day':
      return format(date, 'EEE d', { locale: ptBR })
    case 'week':
      return `Sem ${getISOWeek(date)}`
    case 'month':
      return format(date, 'MMM yyyy', { locale: ptBR })
    case 'quarter': {
      const q = getQuarter(date)
      return `T${q} ${getYear(date)}`
    }
    case 'semester': {
      const s = getMonth(date) < 6 ? 1 : 2
      return `S${s} ${getYear(date)}`
    }
    case 'year':
      return String(getYear(date))
  }
}

/** Top header row label (month name for day/week modes, year for others) */
export function getTopHeaderLabel(date: Date, mode: AgendaViewMode): string {
  switch (mode) {
    case 'day':
    case 'week':
      return format(date, 'MMMM yyyy', { locale: ptBR })
    case 'month':
    case 'quarter':
    case 'semester':
      return String(getYear(date))
    case 'year':
      return format(date, 'yyyy')
  }
}

// ─── Week list (legacy — used by old weekly header) ──────────────────────────

export function getVisibleWeeks(viewStart: string, visibleWeeks: number): Date[] {
  const start = parseISO(viewStart)
  return Array.from({ length: visibleWeeks }, (_, i) => addWeeks(start, i))
}

// ─── Month header segments ────────────────────────────────────────────────────

export interface MonthSegment {
  label: string
  spanWeeks: number
}

export function getMonthSegments(weeks: Date[]): MonthSegment[] {
  const segments: MonthSegment[] = []
  for (const week of weeks) {
    const label = format(week, 'MMMM yyyy', { locale: ptBR })
    const last = segments[segments.length - 1]
    if (last && last.label === label) {
      last.spanWeeks += 1
    } else {
      segments.push({ label, spanWeeks: 1 })
    }
  }
  return segments
}

// ─── Bar positioning ──────────────────────────────────────────────────────────

export interface BarStyle {
  left: number
  width: number
  visible: boolean
}

export function getBarStyle(
  task: AgendaTask,
  viewStart: string,
  visibleWeeks: number,
  previewOffsetWeeks: number = 0,
  pixelsPerDay: number = COLUMN_WIDTH / 7
): BarStyle {
  const start        = parseISO(viewStart)
  const taskStart    = addWeeks(parseISO(task.startDate), previewOffsetWeeks)
  const taskEnd      = parseISO(task.endDate)

  const dayOffset       = differenceInDays(taskStart, start)
  const taskDurationDays = Math.max(1, differenceInDays(taskEnd, taskStart))
  const totalDays       = visibleWeeks * 7

  const left  = dayOffset * pixelsPerDay + 4
  const width = Math.max(20, taskDurationDays * pixelsPerDay - 8)

  const visible = dayOffset < totalDays && dayOffset + taskDurationDays > 0

  return { left, width, visible }
}

export function getResizeLeftStyle(
  task: AgendaTask,
  viewStart: string,
  visibleWeeks: number,
  previewStartDeltaWeeks: number,
  pixelsPerDay: number = COLUMN_WIDTH / 7
): BarStyle {
  const modifiedTask: AgendaTask = {
    ...task,
    startDate: format(
      addWeeks(parseISO(task.startDate), previewStartDeltaWeeks),
      'yyyy-MM-dd'
    ),
  }
  if (!isBefore(parseISO(modifiedTask.startDate), parseISO(task.endDate))) {
    modifiedTask.startDate = format(addDays(parseISO(task.endDate), -7), 'yyyy-MM-dd')
  }
  return getBarStyle(modifiedTask, viewStart, visibleWeeks, 0, pixelsPerDay)
}

export function getResizeRightStyle(
  task: AgendaTask,
  viewStart: string,
  visibleWeeks: number,
  previewEndDeltaWeeks: number,
  pixelsPerDay: number = COLUMN_WIDTH / 7
): BarStyle {
  const modifiedTask: AgendaTask = {
    ...task,
    endDate: format(
      addWeeks(parseISO(task.endDate), previewEndDeltaWeeks),
      'yyyy-MM-dd'
    ),
  }
  if (!isAfter(parseISO(modifiedTask.endDate), parseISO(task.startDate))) {
    modifiedTask.endDate = format(addDays(parseISO(task.startDate), 7), 'yyyy-MM-dd')
  }
  return getBarStyle(modifiedTask, viewStart, visibleWeeks, 0, pixelsPerDay)
}

// ─── Today indicator ──────────────────────────────────────────────────────────

export function getTodayOffset(
  viewStart: string,
  visibleWeeks: number,
  pixelsPerDay: number = COLUMN_WIDTH / 7
): number | null {
  const start   = parseISO(viewStart)
  const today   = startOfWeek(new Date(), { weekStartsOn: 1 })
  const dayOff  = differenceInDays(today, start)
  const totalDays = visibleWeeks * 7
  if (dayOff < 0 || dayOff >= totalDays) return null
  return dayOff * pixelsPerDay + pixelsPerDay / 2
}

// ─── Date range display ───────────────────────────────────────────────────────

export function formatViewRange(viewStart: string, visibleWeeks: number): string {
  const start = parseISO(viewStart)
  const end   = addWeeks(start, visibleWeeks)
  const startStr = format(start, 'dd/MM/yyyy', { locale: ptBR })
  const endStr   = format(end,   'dd/MM/yyyy', { locale: ptBR })
  return `${startStr} — ${endStr}`
}

// ─── Week number label ────────────────────────────────────────────────────────

export function getWeekLabel(date: Date): string {
  return String(getISOWeek(date))
}

// ─── Task move/resize calculation (week-snap) ─────────────────────────────────

export function applyDragDelta(task: AgendaTask, deltaWeeks: number): { newStart: string; newEnd: string } {
  const newStart   = format(addWeeks(parseISO(task.startDate), deltaWeeks), 'yyyy-MM-dd')
  const duration   = differenceInDays(parseISO(task.endDate), parseISO(task.startDate))
  const newEnd     = format(addDays(parseISO(newStart), duration), 'yyyy-MM-dd')
  return { newStart, newEnd }
}

export function applyResizeLeft(task: AgendaTask, deltaWeeks: number): string {
  const newStart = format(addWeeks(parseISO(task.startDate), deltaWeeks), 'yyyy-MM-dd')
  if (!isBefore(parseISO(newStart), parseISO(task.endDate))) {
    return format(addDays(parseISO(task.endDate), -7), 'yyyy-MM-dd')
  }
  return newStart
}

export function applyResizeRight(task: AgendaTask, deltaWeeks: number): string {
  const newEnd = format(addWeeks(parseISO(task.endDate), deltaWeeks), 'yyyy-MM-dd')
  if (!isAfter(parseISO(newEnd), parseISO(task.startDate))) {
    return format(addDays(parseISO(task.startDate), 7), 'yyyy-MM-dd')
  }
  return newEnd
}

// ─── Week-snap column width for drag calculation ──────────────────────────────

/** Returns 1 week's pixel width for the given pixelsPerDay */
export function weekPx(pixelsPerDay: number): number {
  return pixelsPerDay * 7
}
