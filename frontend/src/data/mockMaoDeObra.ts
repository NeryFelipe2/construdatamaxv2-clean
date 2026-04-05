import type {
  Worker,
  LaborCrew,
  TimecardEntry,
  PhysicalProgress,
  LaborOccurrence,
  RiskArea,
  ReallocationSuggestion,
  Shift,
  WorkPost,
  WorkerAbsence,
  CLTSettings,
} from '@/types'

export const mockWorkers: Worker[] = []

export const mockLaborCrews: LaborCrew[] = []

export const mockTimecards: TimecardEntry[] = []

export const mockPhysicalProgress: PhysicalProgress[] = []

export const mockOccurrences: LaborOccurrence[] = []

export const mockRiskAreas: RiskArea[] = []

export const mockReallocationSuggestions: ReallocationSuggestion[] = []

export const MOCK_CLT_SETTINGS: CLTSettings = {
  maxDailyHours:    0,
  maxOvertimeHours: 0,
  maxWeeklyHours:   0,
  minRestMinutes:   0,
  nightStart:       0,
  nightEnd:         0,
  nightDifferential: 0,
  overtimeRate:     0,
}

export const MOCK_WORK_POSTS: WorkPost[] = []

export const MOCK_SHIFTS: Shift[] = []

export const MOCK_ABSENCES: WorkerAbsence[] = []
