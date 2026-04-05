import type { OrcamentoItem, OrcamentoBudget, CustomBaseEntry } from '@/types'

const items1: OrcamentoItem[] = []

export const MOCK_BUDGET_1: OrcamentoBudget = {
  id: '',
  name: '',
  description: '',
  costBase: 'sinapi',
  items: items1,
  bdiGlobal: 0,
  totalBRL: 0,
  referenceDate: '',
  createdAt: '',
  updatedAt: '',
}

const items2: OrcamentoItem[] = []

export const MOCK_BUDGET_2: OrcamentoBudget = {
  id: '',
  name: '',
  description: '',
  costBase: 'sinapi',
  items: items2,
  bdiGlobal: 0,
  totalBRL: 0,
  referenceDate: '',
  createdAt: '',
  updatedAt: '',
}

export const MOCK_CUSTOM_BASE: CustomBaseEntry[] = []

export const MOCK_BUDGETS = [MOCK_BUDGET_1, MOCK_BUDGET_2]

export const MOCK_CURRENT_ITEMS: OrcamentoItem[] = []
