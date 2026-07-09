import type {
  RoutingRecommendation,
  PredictiveHealth,
  BuyLeaseAnalysis,
} from '@/types'

export const mockRoutingRecs: RoutingRecommendation[] = []

export const mockHealthScores: PredictiveHealth[] = []

export const mockBuyLeaseAnalyses: BuyLeaseAnalysis[] = [
  {
    id: 'bl-001',
    equipmentType: 'Escavadeira Hidráulica',
    currentStatus: 'rented',
    monthlyRentalCostBRL: 28500,
    purchasePriceBRL: 780000,
    annualMaintenanceCostBRL: 42000,
    residualValueBRL: 260000,
    projectedUsageDays: 210,
    annualRentalCostBRL: 342000,
    annualOwnershipCostBRL: 94000,
    breakEvenMonths: 31,
    recommendation: 'buy',
    reasoning: 'Análise baseada em 210 dias projetados de uso na carteira WCR (Boi Malhado, Sakura e Comunidade do Retorno).',
    bimPhases: ['Escavação de Vala — Rede Coletora'],
    relatedProjects: ['WCR — Boi Malhado', 'WCR — Sakura', 'WCR — Comunidade do Retorno'],
  },
  {
    id: 'bl-002',
    equipmentType: 'Caminhão Munck 8T',
    currentStatus: 'rented',
    monthlyRentalCostBRL: 14200,
    purchasePriceBRL: 410000,
    annualMaintenanceCostBRL: 26000,
    residualValueBRL: 150000,
    projectedUsageDays: 65,
    annualRentalCostBRL: 170400,
    annualOwnershipCostBRL: 52000,
    breakEvenMonths: 34,
    recommendation: 'lease',
    reasoning: 'Análise baseada em 65 dias projetados de uso — demanda pontual não justifica aquisição no momento.',
    bimPhases: ['Movimentação de Tubulações'],
    relatedProjects: ['SLNR Santos — Rede Esgoto'],
  },
  {
    id: 'bl-003',
    equipmentType: 'Rolo Compactador',
    currentStatus: 'owned',
    monthlyRentalCostBRL: 9800,
    purchasePriceBRL: 320000,
    annualMaintenanceCostBRL: 18000,
    residualValueBRL: 110000,
    projectedUsageDays: 140,
    annualRentalCostBRL: 117600,
    annualOwnershipCostBRL: 39000,
    breakEvenMonths: 29,
    recommendation: 'neutral',
    reasoning: 'Análise baseada em 140 dias projetados de uso — custo de posse e locação equivalentes no ciclo atual.',
    bimPhases: ['Compactação de Reaterro'],
    relatedProjects: ['WCR — Comunidade do Retorno', 'Osasco — Consórcio CLU Osasco'],
  },
]
