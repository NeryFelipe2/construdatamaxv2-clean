/**
 * Mock data for the Planejamento module.
 * Represents a realistic water network installation project in São Paulo.
 */
import type {
  PlanTrecho, PlanTeam, PlanProductivityTable,
  PlanScheduleConfig, PlanHoliday, ServiceNote, PlanScenario,
} from '@/types'

export const MOCK_TRECHOS: PlanTrecho[] = [
  { id: 'trecho-01', code: 'T01', description: 'Av. Paulista — entre Consolação e Paraíso', lengthM: 120, depthM: 1.5, diameterMm: 300, soilType: 'normal', requiresShoring: false, unitCostBRL: 350 },
  { id: 'trecho-02', code: 'T02', description: 'Rua Augusta — sentido Centro', lengthM: 85,  depthM: 1.8, diameterMm: 200, soilType: 'normal', requiresShoring: false, unitCostBRL: 280 },
  { id: 'trecho-03', code: 'T03', description: 'Rua da Consolação — trecho norte', lengthM: 210, depthM: 2.2, diameterMm: 400, soilType: 'mixed',  requiresShoring: true,  unitCostBRL: 520 },
  { id: 'trecho-04', code: 'T04', description: 'Av. Rebouças — sob a avenida', lengthM: 175, depthM: 2.8, diameterMm: 400, soilType: 'rocky',  requiresShoring: true,  unitCostBRL: 680 },
  { id: 'trecho-05', code: 'T05', description: 'Rua Pamplona — residencial', lengthM: 95,  depthM: 1.2, diameterMm: 200, soilType: 'normal', requiresShoring: false, unitCostBRL: 260 },
  { id: 'trecho-06', code: 'T06', description: 'Alameda Jaú — calçada leste', lengthM: 140, depthM: 1.6, diameterMm: 300, soilType: 'normal', requiresShoring: false, unitCostBRL: 330 },
  { id: 'trecho-07', code: 'T07', description: 'Rua Haddock Lobo — trecho sul', lengthM: 250, depthM: 1.4, diameterMm: 200, soilType: 'normal', requiresShoring: false, unitCostBRL: 290 },
  { id: 'trecho-08', code: 'T08', description: 'Av. Faria Lima — interseção', lengthM: 80,  depthM: 2.5, diameterMm: 300, soilType: 'rocky',  requiresShoring: true,  unitCostBRL: 590 },
]

export const MOCK_TEAMS: PlanTeam[] = [
  {
    id: 'team-01',
    name: 'Equipe A',
    foremanCount:      1,
    workerCount:       4,
    helperCount:       2,
    operatorCount:     1,
    retroescavadeira:  1,
    compactador:       1,
    caminhaoBasculante: 0,
    laborHourlyRateBRL:    45,
    equipmentDailyRateBRL: 800,
    maxManualExcavDepthM:  1.5,
  },
  {
    id: 'team-02',
    name: 'Equipe B',
    foremanCount:      1,
    workerCount:       4,
    helperCount:       2,
    operatorCount:     1,
    retroescavadeira:  1,
    compactador:       1,
    caminhaoBasculante: 0,
    laborHourlyRateBRL:    45,
    equipmentDailyRateBRL: 800,
    maxManualExcavDepthM:  1.5,
  },
]

export const MOCK_PRODUCTIVITY: PlanProductivityTable = {
  escavacao:    30,
  assentamento: 35,
  reaterro:     25,
  escoramento:  15,
  pavimentacao: 20,
}

export const MOCK_SCHEDULE_CONFIG: PlanScheduleConfig = {
  startDate:       '2026-04-01',
  workHoursPerDay: 8,
  workWeekMode:    'mon_fri',
}

export const MOCK_HOLIDAYS: PlanHoliday[] = [
  { date: '2026-04-21', description: 'Tiradentes' },
  { date: '2026-05-01', description: 'Dia do Trabalho' },
]

export const MOCK_NOTES: ServiceNote[] = [
  {
    id: 'note-01',
    date: '2026-04-01',
    trechoId: 'trecho-01',
    teamId: 'team-01',
    type: 'instruction',
    title: 'Desvio de tráfego obrigatório',
    body: 'Solicitar desvio de tráfego à Prefeitura antes do início das obras na Av. Paulista. Coordenar com a CET para sinalização adequada.',
    createdAt: '2026-03-20T10:00:00.000Z',
    createdBy: 'Eng. Carlos Silva',
  },
  {
    id: 'note-02',
    date: '2026-04-03',
    trechoId: 'trecho-03',
    teamId: 'team-02',
    type: 'safety',
    title: 'Atenção: solo misto com risco de desmoronamento',
    body: 'O trecho T03 apresenta solo misto com alternância de argila e areia. Escoramento obrigatório a partir de 1,5m de profundidade. Verificar estabilidade diariamente antes de retomar escavação.',
    createdAt: '2026-03-22T14:30:00.000Z',
    createdBy: 'Técnico de Segurança João Mendes',
  },
  {
    id: 'note-03',
    date: '2026-04-08',
    trechoId: 'trecho-04',
    teamId: 'team-01',
    type: 'material',
    title: 'Requisição de material adicional — T04',
    body: 'Solicitar 50 metros adicionais de tubo PVC DN400 PN6 para estoque de reserva no T04. Prazo de entrega do fornecedor: 5 dias úteis. Confirmar pedido até 31/03.',
    createdAt: '2026-03-25T09:15:00.000Z',
    createdBy: 'Almoxarife Pedro Nunes',
  },
]

export const MOCK_BASE_SCENARIO: PlanScenario = {
  id:          'scenario-base',
  name:        'Cenário Base',
  description: 'Planejamento original com 2 equipes e produtividade padrão SINAPI/SEINFRA.',
  createdAt:   '2026-03-15T08:00:00.000Z',
  updatedAt:   '2026-03-15T08:00:00.000Z',
  trechos:          MOCK_TRECHOS,
  teams:            MOCK_TEAMS,
  productivityTable: MOCK_PRODUCTIVITY,
  scheduleConfig:   MOCK_SCHEDULE_CONFIG,
  holidays:         MOCK_HOLIDAYS,
}
