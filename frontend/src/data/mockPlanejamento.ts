import type {
  PlanTrecho, PlanTeam, PlanProductivityTable,
  PlanScheduleConfig, PlanHoliday, ServiceNote, PlanScenario,
} from '@/types'

export const MOCK_TRECHOS: PlanTrecho[] = []

export const MOCK_TEAMS: PlanTeam[] = []

export const MOCK_PRODUCTIVITY: PlanProductivityTable = {
  escavacao:    0,
  assentamento: 0,
  reaterro:     0,
  escoramento:  0,
  pavimentacao: 0,
}

export const MOCK_SCHEDULE_CONFIG: PlanScheduleConfig = {
  startDate:       '',
  workHoursPerDay: 0,
  workWeekMode:    'mon_fri',
}

export const MOCK_HOLIDAYS: PlanHoliday[] = []

export const MOCK_NOTES: ServiceNote[] = []

export const MOCK_BASE_SCENARIO: PlanScenario = {
  id:          '',
  name:        '',
  description: '',
  createdAt:   '',
  updatedAt:   '',
  trechos:          MOCK_TRECHOS,
  teams:            MOCK_TEAMS,
  productivityTable: MOCK_PRODUCTIVITY,
  scheduleConfig:   MOCK_SCHEDULE_CONFIG,
  holidays:         MOCK_HOLIDAYS,
}
