/**
 * operacaoCampoStore.ts — Zustand store for Operação e Campo module.
 */
import { create } from 'zustand'
import type {
  OperacaoCampoTab, FieldCalendarActivity, FieldCalendarDay,
  WeeklyPpcResult, NotableServiceCurve, TrendPoint,
} from '@/types'
import { computeAllWeeklyPpc, computeTrendFromDays, computeNotableServiceData } from '@/features/operacao-campo/utils/fieldEngine'

interface OperacaoCampoState {
  activeTab: OperacaoCampoTab
  activities: FieldCalendarActivity[]
  calendarDays: FieldCalendarDay[]
  viewMode: '15d' | 'monthly'
  selectedDate: string
  weeklyPpcResults: WeeklyPpcResult[]
  notableServiceCurves: NotableServiceCurve[]
  trendPoints: TrendPoint[]

  setActiveTab: (tab: OperacaoCampoTab) => void
  setViewMode: (mode: '15d' | 'monthly') => void
  setSelectedDate: (date: string) => void
  updateCalendarDay: (date: string, activityId: string, updates: Partial<FieldCalendarDay>) => void
  recompute: () => void
  loadDemoData: () => void
  clearData: () => void
}

export const useOperacaoCampoStore = create<OperacaoCampoState>((set, get) => ({
  activeTab: 'calendario',
  activities: [],
  calendarDays: [],
  viewMode: '15d',
  selectedDate: new Date().toISOString().slice(0, 10),
  weeklyPpcResults: [],
  notableServiceCurves: [],
  trendPoints: [],

  setActiveTab: (tab) => set({ activeTab: tab }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedDate: (date) => set({ selectedDate: date }),

  updateCalendarDay: (date, activityId, updates) => {
    set((s) => ({
      calendarDays: s.calendarDays.map((d) =>
        d.date === date && d.activityId === activityId ? { ...d, ...updates } : d
      ),
    }))
    get().recompute()
  },

  recompute: () => {
    const { calendarDays, activities } = get()
    set({
      weeklyPpcResults: computeAllWeeklyPpc(calendarDays),
      trendPoints: computeTrendFromDays(calendarDays),
      notableServiceCurves: computeNotableServiceData(calendarDays, activities),
    })
  },

  loadDemoData: () => {
    import('@/data/mockOperacaoCampo').then((m) => {
      set({
        activities: structuredClone(m.MOCK_FIELD_ACTIVITIES),
        calendarDays: structuredClone(m.MOCK_CALENDAR_DAYS),
        notableServiceCurves: structuredClone(m.MOCK_NOTABLE_CURVES),
        trendPoints: structuredClone(m.MOCK_TREND_POINTS),
      })
      // Recompute PPC from loaded data
      const { calendarDays, activities } = get()
      set({
        weeklyPpcResults: computeAllWeeklyPpc(calendarDays),
        trendPoints: computeTrendFromDays(calendarDays),
        notableServiceCurves: computeNotableServiceData(calendarDays, activities),
      })
    })
  },

  clearData: () => set({
    activities: [],
    calendarDays: [],
    weeklyPpcResults: [],
    notableServiceCurves: [],
    trendPoints: [],
  }),
}))
