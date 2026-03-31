import { parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import type { AgendaTask } from '@/types'

const COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6',
  orange: '#f97316',
  green: '#22c55e',
  red: '#ef4444',
  purple: '#a855f7',
}

export function getTaskColor(color: string): string {
  return COLOR_HEX[color] ?? '#3b82f6'
}

export function getTasksForDate(tasks: AgendaTask[], date: Date): AgendaTask[] {
  return tasks.filter((t) => {
    if (t.status === 'unscheduled') return false
    const start = startOfDay(parseISO(t.startDate))
    const end = endOfDay(parseISO(t.endDate))
    return isWithinInterval(startOfDay(date), { start, end })
  })
}
