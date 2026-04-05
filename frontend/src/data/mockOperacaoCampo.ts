/**
 * mockOperacaoCampo.ts — Mock data for Operação e Campo module.
 */
import type { FieldCalendarActivity, FieldCalendarDay, NotableServiceCurve, TrendPoint } from '@/types'

export const MOCK_FIELD_ACTIVITIES: FieldCalendarActivity[] = [
  { id: 'fa-01', name: 'Escavação mecânica', trechoCode: 'T01', responsible: 'Equipe A' },
  { id: 'fa-02', name: 'Assentamento DN300', trechoCode: 'T02', responsible: 'Equipe A' },
  { id: 'fa-03', name: 'Reaterro compactado', trechoCode: 'T03', responsible: 'Equipe B' },
  { id: 'fa-04', name: 'Escoramento de valas', trechoCode: 'T04', responsible: 'Equipe B' },
  { id: 'fa-05', name: 'Poços de visita PV', responsible: 'Equipe C' },
  { id: 'fa-06', name: 'Teste hidrostático', trechoCode: 'T01', responsible: 'Equipe A' },
]

function generateCalendarDays(): FieldCalendarDay[] {
  const days: FieldCalendarDay[] = []
  const today = new Date()
  const activities = MOCK_FIELD_ACTIVITIES

  for (let d = -15; d <= 15; d++) {
    const date = new Date(today)
    date.setDate(date.getDate() + d)
    const dow = date.getDay()
    if (dow === 0 || dow === 6) continue // skip weekends

    const isoDate = date.toISOString().slice(0, 10)

    for (const act of activities) {
      const planned = 10 + Math.round(Math.random() * 15)
      const isPast = d < 0
      const isToday = d === 0

      days.push({
        date: isoDate,
        activityId: act.id,
        plannedQty: planned,
        plannedUnit: act.name.includes('Escavação') ? 'ml' : act.name.includes('Poço') ? 'un' : 'ml',
        actualQty: isPast
          ? Math.round(planned * (0.7 + Math.random() * 0.5))
          : isToday
          ? Math.round(planned * (0.4 + Math.random() * 0.3))
          : null,
      })
    }
  }

  return days
}

export const MOCK_CALENDAR_DAYS: FieldCalendarDay[] = generateCalendarDays()

export const MOCK_NOTABLE_CURVES: NotableServiceCurve[] = [
  {
    id: 'nc-01',
    serviceName: 'Escavação',
    unit: 'ml/dia',
    dataPoints: Array.from({ length: 20 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - 19 + i)
      return {
        date: date.toISOString().slice(0, 10),
        planned: 25,
        actual: i < 15 ? Math.round(20 + Math.random() * 10) : 0,
      }
    }),
  },
  {
    id: 'nc-02',
    serviceName: 'Concreto',
    unit: 'm³/dia',
    dataPoints: Array.from({ length: 20 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - 19 + i)
      return {
        date: date.toISOString().slice(0, 10),
        planned: 8,
        actual: i < 15 ? Math.round(5 + Math.random() * 6) : 0,
      }
    }),
  },
  {
    id: 'nc-03',
    serviceName: 'Assentamento',
    unit: 'ml/dia',
    dataPoints: Array.from({ length: 20 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - 19 + i)
      return {
        date: date.toISOString().slice(0, 10),
        planned: 30,
        actual: i < 15 ? Math.round(22 + Math.random() * 14) : 0,
      }
    }),
  },
]

export const MOCK_TREND_POINTS: TrendPoint[] = Array.from({ length: 20 }, (_, i) => {
  const date = new Date()
  date.setDate(date.getDate() - 19 + i)
  const pct = (i / 19) * 100
  return {
    date: date.toISOString().slice(0, 10),
    plannedCumulativePct: Math.min(100, pct),
    actualCumulativePct: i < 15 ? Math.min(100, pct * (0.85 + Math.random() * 0.15)) : 0,
  }
})
