/**
 * mockQuantitativos.ts — demo budgets for Quantitativos e Orçamento module.
 */
import type { OrcamentoItem, OrcamentoBudget, CustomBaseEntry } from '@/types'

// ─── Budget 1: Rede de Água Pluvial ──────────────────────────────────────────

const items1: OrcamentoItem[] = [
  { id: 'qi-01', code: 'SINAPI-73965', description: 'Escavação Mecânica de Vala em Solo Mole', unit: 'm³', quantity: 480, unitCost: 18.50, bdi: 25, totalCost: 480 * 18.50 * 1.25, category: 'Escavação', source: 'sinapi' },
  { id: 'qi-02', code: 'SINAPI-74008', description: 'Reaterro Manual de Vala com Solo Local', unit: 'm³', quantity: 380, unitCost: 12.80, bdi: 25, totalCost: 380 * 12.80 * 1.25, category: 'Reaterro', source: 'sinapi' },
  { id: 'qi-03', code: 'SINAPI-76413', description: 'Assentamento Tubo PVC DN 200mm — Rede Pluvial', unit: 'm', quantity: 420, unitCost: 85.00, bdi: 25, totalCost: 420 * 85.00 * 1.25, category: 'Tubulação', source: 'sinapi' },
  { id: 'qi-04', code: 'SINAPI-76414', description: 'Assentamento Tubo PVC DN 300mm — Rede Pluvial', unit: 'm', quantity: 180, unitCost: 140.00, bdi: 25, totalCost: 180 * 140.00 * 1.25, category: 'Tubulação', source: 'sinapi' },
  { id: 'qi-05', code: 'SINAPI-76415', description: 'Assentamento Tubo PVC DN 400mm — Rede Pluvial', unit: 'm', quantity: 90, unitCost: 210.00, bdi: 25, totalCost: 90 * 210.00 * 1.25, category: 'Tubulação', source: 'sinapi' },
  { id: 'qi-06', code: 'SINAPI-73961', description: 'Boca de Lobo Simples — Concreto Armado', unit: 'un', quantity: 12, unitCost: 1850.00, bdi: 25, totalCost: 12 * 1850.00 * 1.25, category: 'Estruturas', source: 'sinapi' },
  { id: 'qi-07', code: 'SINAPI-73966', description: 'Poço de Visita em Concreto Pré-Moldado DN 1000mm', unit: 'un', quantity: 8, unitCost: 3200.00, bdi: 25, totalCost: 8 * 3200.00 * 1.25, category: 'Estruturas', source: 'sinapi' },
  { id: 'qi-08', code: 'SINAPI-97837', description: 'Compactação de Aterro c/ Compactador de Placa', unit: 'm³', quantity: 380, unitCost: 9.20, bdi: 25, totalCost: 380 * 9.20 * 1.25, category: 'Reaterro', source: 'sinapi' },
  { id: 'qi-09', code: 'SINAPI-93358', description: 'Cama de Areia para Assentamento de Tubos', unit: 'm³', quantity: 42, unitCost: 68.00, bdi: 25, totalCost: 42 * 68.00 * 1.25, category: 'Escavação', source: 'sinapi' },
  { id: 'qi-10', code: 'SINAPI-73790', description: 'Recomposição de Pavimento Asfáltico', unit: 'm²', quantity: 310, unitCost: 145.00, bdi: 25, totalCost: 310 * 145.00 * 1.25, category: 'Pavimentação', source: 'sinapi' },
]

export const MOCK_BUDGET_1: OrcamentoBudget = {
  id: 'orc-01',
  name: 'Rede de Água Pluvial — Trecho A',
  description: 'Orçamento completo da rede pluvial do Lote A, incluindo escavação, tubulação, estruturas e pavimentação.',
  costBase: 'sinapi',
  items: items1,
  bdiGlobal: 25,
  totalBRL: items1.reduce((s, i) => s + i.totalCost, 0),
  referenceDate: '2025-01',
  createdAt: '2025-01-15T08:00:00.000Z',
  updatedAt: '2025-01-20T14:30:00.000Z',
}

// ─── Budget 2: Rede de Esgoto Sanitário ──────────────────────────────────────

const items2: OrcamentoItem[] = [
  { id: 'qi-11', code: 'SINAPI-73965', description: 'Escavação Mecânica de Vala em Solo Mole', unit: 'm³', quantity: 620, unitCost: 18.50, bdi: 28, totalCost: 620 * 18.50 * 1.28, category: 'Escavação', source: 'sinapi' },
  { id: 'qi-12', code: 'SINAPI-74008', description: 'Reaterro Manual de Vala com Solo Local', unit: 'm³', quantity: 510, unitCost: 12.80, bdi: 28, totalCost: 510 * 12.80 * 1.28, category: 'Reaterro', source: 'sinapi' },
  { id: 'qi-13', code: 'SINAPI-76420', description: 'Assentamento Tubo PVC DN 150mm — Rede Esgoto', unit: 'm', quantity: 580, unitCost: 72.00, bdi: 28, totalCost: 580 * 72.00 * 1.28, category: 'Tubulação', source: 'sinapi' },
  { id: 'qi-14', code: 'SINAPI-76421', description: 'Assentamento Tubo PVC DN 200mm — Rede Esgoto', unit: 'm', quantity: 240, unitCost: 98.00, bdi: 28, totalCost: 240 * 98.00 * 1.28, category: 'Tubulação', source: 'sinapi' },
  { id: 'qi-15', code: 'SINAPI-73968', description: 'Poço de Visita em Concreto Pré-Moldado — Esgoto', unit: 'un', quantity: 14, unitCost: 2800.00, bdi: 28, totalCost: 14 * 2800.00 * 1.28, category: 'Estruturas', source: 'sinapi' },
  { id: 'qi-16', code: 'SINAPI-74112', description: 'Caixa de Inspeção em Concreto Pré-Moldado', unit: 'un', quantity: 22, unitCost: 680.00, bdi: 28, totalCost: 22 * 680.00 * 1.28, category: 'Estruturas', source: 'sinapi' },
  { id: 'qi-17', code: 'SINAPI-97840', description: 'Teste de Estanqueidade em Trecho de Rede', unit: 'un', quantity: 18, unitCost: 380.00, bdi: 28, totalCost: 18 * 380.00 * 1.28, category: 'Ensaios', source: 'sinapi' },
]

export const MOCK_BUDGET_2: OrcamentoBudget = {
  id: 'orc-02',
  name: 'Rede de Esgoto Sanitário — Setor Norte',
  description: 'Rede de coleta e afastamento de esgoto sanitário do setor norte, com 580m de tubulação DN150.',
  costBase: 'sinapi',
  items: items2,
  bdiGlobal: 28,
  totalBRL: items2.reduce((s, i) => s + i.totalCost, 0),
  referenceDate: '2025-01',
  createdAt: '2025-02-01T09:00:00.000Z',
  updatedAt: '2025-02-10T16:00:00.000Z',
}

// ─── Custom base (user-uploaded example) ─────────────────────────────────────

export const MOCK_CUSTOM_BASE: CustomBaseEntry[] = [
  { id: 'cb-01', code: 'ATL-001', description: 'Escavação Mecanizada Solo Argiloso', unit: 'm³', unitCost: 22.00, category: 'Escavação', source: 'Manual' },
  { id: 'cb-02', code: 'ATL-002', description: 'Transporte de Material Excedente', unit: 'm³·km', unitCost: 4.50, category: 'Transporte', source: 'Manual' },
  { id: 'cb-03', code: 'ATL-003', description: 'Tubo PEAD DN 200mm PN 10', unit: 'm', unitCost: 92.00, category: 'Tubulação', source: 'Importado Excel' },
  { id: 'cb-04', code: 'ATL-004', description: 'Tubo PEAD DN 315mm PN 10', unit: 'm', unitCost: 185.00, category: 'Tubulação', source: 'Importado Excel' },
  { id: 'cb-05', code: 'ATL-005', description: 'Concreto Estrutural fck=25MPa Usinado', unit: 'm³', unitCost: 390.00, category: 'Concreto', source: 'Importado PDF' },
]

export const MOCK_BUDGETS = [MOCK_BUDGET_1, MOCK_BUDGET_2]

// ─── Current demo items (active session) ─────────────────────────────────────

export const MOCK_CURRENT_ITEMS: OrcamentoItem[] = items1.map((i) => ({ ...i }))
