import { create } from 'zustand'
import { addDays, format, parseISO } from 'date-fns'
import type { DailyReport, ActivityStatus, ReportPhoto, Activity, Crew, Timecard, EquipmentLog, MaterialLog } from '@/types'
import { initialReports } from '@/data/mockRelatorio360'

interface Relatorio360State {
  reports: Record<string, DailyReport>
  currentDate: string

  // Navigation
  goToDate: (date: string) => void
  goToPrevDay: () => void
  goToNextDay: () => void

  // Activity / Kanban
  moveActivity: (activityId: string, newStatus: ActivityStatus) => void
  reorderActivity: (activeId: string, overId: string) => void
  updateActivity: (activityId: string, patch: Partial<Omit<Activity, 'id'>>) => void

  // Crews & timecards
  updateCrew: (crewId: string, patch: Partial<Pick<Crew, 'foremanName' | 'crewType'>>) => void
  addTimecard: (crewId: string, tc: Omit<Timecard, 'id'>) => void
  updateTimecard: (crewId: string, timecardId: string, patch: Partial<Omit<Timecard, 'id'>>) => void
  deleteTimecard: (crewId: string, timecardId: string) => void

  // Equipment & materials
  updateEquipmentLog: (logId: string, patch: Partial<Pick<EquipmentLog, 'utilizationHours'>>) => void
  updateMaterialLog: (logId: string, patch: Partial<Pick<MaterialLog, 'quantity'>>) => void

  // Photos
  addPhoto: (photo: ReportPhoto) => void
  removePhoto: (photoId: string) => void
  updatePhotoLabel: (photoId: string, label: string) => void
  loadDemoData: () => void
  clearData: () => void
}

export const useRelatorio360Store = create<Relatorio360State>((set, get) => ({
  reports: initialReports,
  currentDate: Object.keys(initialReports)[0],

  goToDate: (date) => set({ currentDate: date }),

  goToPrevDay: () => {
    const prev = format(addDays(parseISO(get().currentDate), -1), 'yyyy-MM-dd')
    set({ currentDate: prev })
  },

  goToNextDay: () => {
    const next = format(addDays(parseISO(get().currentDate), 1), 'yyyy-MM-dd')
    set({ currentDate: next })
  },

  moveActivity: (activityId, newStatus) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            activities: report.activities.map((a) =>
              a.id === activityId ? { ...a, status: newStatus } : a
            ),
          },
        },
      }
    })
  },

  reorderActivity: (activeId, overId) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      const activities = [...report.activities]
      const activeIndex = activities.findIndex((a) => a.id === activeId)
      const overIndex = activities.findIndex((a) => a.id === overId)
      if (activeIndex === -1 || overIndex === -1) return state
      const [moved] = activities.splice(activeIndex, 1)
      activities.splice(overIndex, 0, moved)
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: { ...report, activities },
        },
      }
    })
  },

  updateActivity: (activityId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            activities: report.activities.map((a) =>
              a.id === activityId ? { ...a, ...patch } : a
            ),
          },
        },
      }
    }),

  updateCrew: (crewId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) => c.id === crewId ? { ...c, ...patch } : c),
          },
        },
      }
    }),

  addTimecard: (crewId, tc) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) =>
              c.id === crewId
                ? { ...c, timecards: [...c.timecards, { ...tc, id: crypto.randomUUID() }] }
                : c
            ),
          },
        },
      }
    }),

  updateTimecard: (crewId, timecardId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) =>
              c.id === crewId
                ? {
                    ...c,
                    timecards: c.timecards.map((t) =>
                      t.id === timecardId ? { ...t, ...patch } : t
                    ),
                  }
                : c
            ),
          },
        },
      }
    }),

  deleteTimecard: (crewId, timecardId) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            crews: report.crews.map((c) =>
              c.id === crewId
                ? { ...c, timecards: c.timecards.filter((t) => t.id !== timecardId) }
                : c
            ),
          },
        },
      }
    }),

  updateEquipmentLog: (logId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            equipmentLogs: report.equipmentLogs.map((l) =>
              l.id === logId ? { ...l, ...patch } : l
            ),
          },
        },
      }
    }),

  updateMaterialLog: (logId, patch) =>
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            materialLogs: report.materialLogs.map((l) =>
              l.id === logId ? { ...l, ...patch } : l
            ),
          },
        },
      }
    }),

  addPhoto: (photo) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            photos: [...report.photos, photo],
          },
        },
      }
    })
  },

  removePhoto: (photoId) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            photos: report.photos.filter((p) => p.id !== photoId),
          },
        },
      }
    })
  },

  updatePhotoLabel: (photoId, label) => {
    set((state) => {
      const report = state.reports[state.currentDate]
      if (!report) return state
      return {
        reports: {
          ...state.reports,
          [state.currentDate]: {
            ...report,
            photos: report.photos.map((p) =>
              p.id === photoId ? { ...p, label } : p
            ),
          },
        },
      }
    })
  },

  loadDemoData: () =>
    set({ reports: initialReports, currentDate: Object.keys(initialReports)[0] }),

  clearData: () =>
    set({ reports: {} }),
}))
