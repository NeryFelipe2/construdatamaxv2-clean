/**
 * Mock data for the RDO (Relatório Diário de Obras) module.
 * Realistic demo data for a water/sewer network construction project.
 */
import type {
  RDO, RdoFinancialEntry,
} from '@/types'

// ─── Tiny 1×1 transparent PNG as base64 placeholder ─────────────────────────
// Safe placeholder — no real user data, no external URL
const PLACEHOLDER_PHOTO_1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const PLACEHOLDER_PHOTO_2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=='

export const MOCK_RDOS: RDO[] = [
  {
    id: 'rdo-01',
    number: 1,
    date: '2026-04-01',
    responsible: 'Eng. Carlos Silva',
    weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 28 },
    manpower: { foremanCount: 1, officialCount: 3, helperCount: 3, operatorCount: 1 },
    equipment: [
      { id: 'eq-01-1', name: 'Retroescavadeira', quantity: 1, hours: 8 },
      { id: 'eq-01-2', name: 'Compactador',       quantity: 1, hours: 6 },
    ],
    services: [
      { id: 'svc-01-1', description: 'Escavação de vala',   quantity: 37.43, unit: 'm' },
      { id: 'svc-01-2', description: 'Assentamento DN300',  quantity: 37.43, unit: 'm' },
      { id: 'svc-01-3', description: 'Reaterro compactado', quantity: 37.43, unit: 'm' },
    ],
    trechos: [
      {
        id: 'rt-01-1',
        trechoCode: 'T01',
        trechoDescription: 'Av. Paulista — entre Consolação e Paraíso',
        plannedMeters: 120,
        executedMeters: 120,
        status: 'completed',
        source: 'rdo',
      },
    ],
    geolocation: { lat: '-23.5615', lng: '-46.6560' },
    observations: 'Serviços executados conforme projeto. Sem intercorrências.',
    incidents: '',
    photos: [
      { id: 'ph-01-1', base64: PLACEHOLDER_PHOTO_1, label: 'Vista geral da vala — T01', uploadedAt: '2026-04-01T16:00:00.000Z' },
      { id: 'ph-01-2', base64: PLACEHOLDER_PHOTO_2, label: 'Assentamento da tubulação',   uploadedAt: '2026-04-01T16:05:00.000Z' },
    ],
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
  },
  {
    id: 'rdo-02',
    number: 2,
    date: '2026-04-03',
    responsible: 'Técnico João Mendes',
    weather: { morning: 'cloudy', afternoon: 'rain', night: 'good', temperatureC: 22 },
    manpower: { foremanCount: 1, officialCount: 4, helperCount: 2, operatorCount: 1 },
    equipment: [
      { id: 'eq-02-1', name: 'Retroescavadeira', quantity: 1, hours: 6 },
      { id: 'eq-02-2', name: 'Caminhão Basculante', quantity: 1, hours: 4 },
    ],
    services: [
      { id: 'svc-02-1', description: 'Escavação de vala',   quantity: 25,  unit: 'm' },
      { id: 'svc-02-2', description: 'Escoramento metálico', quantity: 25, unit: 'm' },
      { id: 'svc-02-3', description: 'Assentamento DN400',  quantity: 25,  unit: 'm' },
    ],
    trechos: [
      {
        id: 'rt-02-1',
        trechoCode: 'T02',
        trechoDescription: 'Rua Augusta — sentido Centro',
        plannedMeters: 85,
        executedMeters: 25,
        status: 'in_progress',
        source: 'rdo',
      },
      {
        id: 'rt-02-2',
        trechoCode: 'T03',
        trechoDescription: 'Rua da Consolação — trecho norte',
        plannedMeters: 210,
        executedMeters: 0,
        status: 'not_started',
        source: 'rdo',
      },
    ],
    geolocation: { lat: '-23.5530', lng: '-46.6580' },
    observations: 'Chuva à tarde interrompeu serviços por 2h. Retomados às 16h.',
    incidents: 'Interferência com rede de gás identificada no trecho T02, km 0+045. Notificado setor de projetos para adequação.',
    photos: [
      { id: 'ph-02-1', base64: PLACEHOLDER_PHOTO_1, label: 'Escoramento metálico T02', uploadedAt: '2026-04-03T17:00:00.000Z' },
    ],
    createdAt: '2026-04-03T18:30:00.000Z',
    updatedAt: '2026-04-03T18:30:00.000Z',
  },
]

export const MOCK_RDO_FINANCIAL_ENTRIES: RdoFinancialEntry[] = [
  {
    id: 'fin-01',
    date: '2026-04-01',
    category: 'Material',
    description: 'Tubo PVC DN300 PN6 — 120m',
    valueBRL: 18600,
    type: 'expense',
  },
  {
    id: 'fin-02',
    date: '2026-04-01',
    category: 'Mão de Obra',
    description: 'Equipe A — diária completa',
    valueBRL: 3520,
    type: 'expense',
  },
  {
    id: 'fin-03',
    date: '2026-04-03',
    category: 'Equipamento',
    description: 'Aluguel retroescavadeira + caminhão',
    valueBRL: 2800,
    type: 'expense',
  },
]

export const MOCK_RDO_BUDGET_BRL = 800000
