import type { DailyReport } from '@/types'

export const mockReport: DailyReport = {
  id: '',
  date: '',
  projectName: '',
  activities: [],
  crews: [],
  equipmentLogs: [],
  materialLogs: [],
  photos: [],
}

export const initialReports: Record<string, DailyReport> = {}
