import type {
  CostAccountEntry,
  EvmMetrics,
  SCurveMultiPoint,
  WeightedMeasurement,
  WorkPackage,
} from '@/types'

// ---------------------------------------------------------------------------
// Cost Account Entries (shared pool, also referenced inside work packages)
// ---------------------------------------------------------------------------

export const MOCK_COST_ACCOUNTS: CostAccountEntry[] = [
  // Material
  {
    id: 'ca-mat-01',
    activityId: 'ma-sm-eg',
    pillar: 'material',
    description: 'Tubo PVC DN200 JEI — barra 6 m',
    unitCostBRL: 142.5,
    quantity: 1200,
    totalCostBRL: 171000,
  },
  {
    id: 'ca-mat-02',
    activityId: 'ma-tt-eg',
    pillar: 'material',
    description: 'Conexões PVC DN200 (curva, tê, cap)',
    unitCostBRL: 87.3,
    quantity: 350,
    totalCostBRL: 30555,
  },
  {
    id: 'ca-mat-03',
    activityId: 'ma-vc-eg',
    pillar: 'material',
    description: 'Conjunto motobomba submersível 30 CV',
    unitCostBRL: 48500,
    quantity: 2,
    totalCostBRL: 97000,
  },
  {
    id: 'ca-mat-04',
    activityId: 'ma-sm-eg',
    pillar: 'material',
    description: 'Poço de visita pré-moldado D=1000 mm',
    unitCostBRL: 3250,
    quantity: 18,
    totalCostBRL: 58500,
  },
  // Equipamento
  {
    id: 'ca-eqp-01',
    activityId: 'ma-tt-eg',
    pillar: 'equipamento',
    description: 'Retroescavadeira CAT 416F2 — locação mensal',
    unitCostBRL: 18500,
    quantity: 6,
    totalCostBRL: 111000,
  },
  {
    id: 'ca-eqp-02',
    activityId: 'ma-vc-eg',
    pillar: 'equipamento',
    description: 'Caminhão basculante 10 m³ — locação mensal',
    unitCostBRL: 14200,
    quantity: 6,
    totalCostBRL: 85200,
  },
  {
    id: 'ca-eqp-03',
    activityId: 'ma-sm-eg',
    pillar: 'equipamento',
    description: 'Compactador de solo vibratório tipo sapo',
    unitCostBRL: 4800,
    quantity: 4,
    totalCostBRL: 19200,
  },
  // Mão de obra
  {
    id: 'ca-mdo-01',
    activityId: 'ma-sm-eg',
    pillar: 'mao_de_obra',
    description: 'Encanador especializado (mês)',
    unitCostBRL: 7800,
    quantity: 12,
    totalCostBRL: 93600,
  },
  {
    id: 'ca-mdo-02',
    activityId: 'ma-tt-eg',
    pillar: 'mao_de_obra',
    description: 'Servente de obras (mês)',
    unitCostBRL: 4200,
    quantity: 24,
    totalCostBRL: 100800,
  },
  {
    id: 'ca-mdo-03',
    activityId: 'ma-vc-eg',
    pillar: 'mao_de_obra',
    description: 'Eletricista industrial (mês)',
    unitCostBRL: 9600,
    quantity: 6,
    totalCostBRL: 57600,
  },
  {
    id: 'ca-mdo-04',
    activityId: 'ma-vc-eg',
    pillar: 'mao_de_obra',
    description: 'Operador de equipamentos pesados (mês)',
    unitCostBRL: 8400,
    quantity: 6,
    totalCostBRL: 50400,
  },
  // Impostos indiretos
  {
    id: 'ca-imp-01',
    activityId: 'ma-sm-eg',
    pillar: 'impostos_indiretos',
    description: 'ISS sobre serviços (5%)',
    unitCostBRL: 1,
    quantity: 46230,
    totalCostBRL: 46230,
  },
  {
    id: 'ca-imp-02',
    activityId: 'ma-tt-eg',
    pillar: 'impostos_indiretos',
    description: 'PIS/COFINS sobre insumos (9,25%)',
    unitCostBRL: 1,
    quantity: 85840,
    totalCostBRL: 85840,
  },
  {
    id: 'ca-imp-03',
    activityId: 'ma-vc-eg',
    pillar: 'impostos_indiretos',
    description: 'INSS patronal — encargos sobre folha (20%)',
    unitCostBRL: 1,
    quantity: 60360,
    totalCostBRL: 60360,
  },
  {
    id: 'ca-imp-04',
    activityId: 'ma-sm-eg',
    pillar: 'impostos_indiretos',
    description: 'FGTS sobre folha (8%)',
    unitCostBRL: 1,
    quantity: 15552,
    totalCostBRL: 15552,
  },
]

// ---------------------------------------------------------------------------
// Weighted Measurements
// ---------------------------------------------------------------------------

export const MOCK_MEASUREMENTS: WeightedMeasurement[] = [
  {
    id: 'wm-01',
    activityId: 'ma-sm-eg',
    activityName: 'Escavação de vala p/ rede DN200',
    financialWeight: 0.25,
    durationWeight: 0.30,
    economicWeight: 0.20,
    specificWeight: 0.25,
    compositeScore: 0.248,
  },
  {
    id: 'wm-02',
    activityId: 'ma-sm-eg',
    activityName: 'Assentamento de tubulação DN200',
    financialWeight: 0.30,
    durationWeight: 0.25,
    economicWeight: 0.25,
    specificWeight: 0.20,
    compositeScore: 0.252,
  },
  {
    id: 'wm-03',
    activityId: 'ma-tt-eg',
    activityName: 'Reaterro compactado de vala',
    financialWeight: 0.15,
    durationWeight: 0.20,
    economicWeight: 0.30,
    specificWeight: 0.35,
    compositeScore: 0.258,
  },
  {
    id: 'wm-04',
    activityId: 'ma-tt-eg',
    activityName: 'Teste de estanqueidade da rede',
    financialWeight: 0.10,
    durationWeight: 0.15,
    economicWeight: 0.35,
    specificWeight: 0.40,
    compositeScore: 0.272,
  },
  {
    id: 'wm-05',
    activityId: 'ma-vc-eg',
    activityName: 'Montagem de conjunto motobomba',
    financialWeight: 0.35,
    durationWeight: 0.20,
    economicWeight: 0.25,
    specificWeight: 0.20,
    compositeScore: 0.254,
  },
  {
    id: 'wm-06',
    activityId: 'ma-vc-eg',
    activityName: 'Instalação elétrica da estação',
    financialWeight: 0.20,
    durationWeight: 0.25,
    economicWeight: 0.30,
    specificWeight: 0.25,
    compositeScore: 0.252,
  },
  {
    id: 'wm-07',
    activityId: 'ma-pv-eg',
    activityName: 'Execução de poço de visita',
    financialWeight: 0.18,
    durationWeight: 0.22,
    economicWeight: 0.28,
    specificWeight: 0.32,
    compositeScore: 0.256,
  },
  {
    id: 'wm-08',
    activityId: 'ma-rp-eg',
    activityName: 'Reposição de pavimento asfáltico',
    financialWeight: 0.22,
    durationWeight: 0.18,
    economicWeight: 0.32,
    specificWeight: 0.28,
    compositeScore: 0.254,
  },
  {
    id: 'wm-09',
    activityId: 'ma-sm-eg',
    activityName: 'Escoramento de vala — pontual',
    financialWeight: 0.12,
    durationWeight: 0.28,
    economicWeight: 0.35,
    specificWeight: 0.25,
    compositeScore: 0.260,
  },
  {
    id: 'wm-10',
    activityId: 'ma-vc-eg',
    activityName: 'Comissionamento e partida da EBE',
    financialWeight: 0.08,
    durationWeight: 0.12,
    economicWeight: 0.40,
    specificWeight: 0.40,
    compositeScore: 0.284,
  },
]

// ---------------------------------------------------------------------------
// Work Packages
// ---------------------------------------------------------------------------

export const MOCK_WORK_PACKAGES: WorkPackage[] = [
  {
    id: 'wp-ebb-01',
    code: 'WP-EBB-01',
    name: 'Estação de Bombeamento Padrão',
    description:
      'Pacote de trabalho modelo para estações elevatórias de esgoto, incluindo obras civis, montagem eletromecânica e comissionamento.',
    costAccounts: [
      MOCK_COST_ACCOUNTS[2],  // motobomba — material
      MOCK_COST_ACCOUNTS[5],  // basculante — equipamento
      MOCK_COST_ACCOUNTS[9],  // eletricista — mão de obra
      MOCK_COST_ACCOUNTS[10], // operador — mão de obra
      MOCK_COST_ACCOUNTS[12], // INSS — impostos
    ],
    measurements: [
      MOCK_MEASUREMENTS[4], // montagem motobomba
      MOCK_MEASUREMENTS[5], // instalação elétrica
      MOCK_MEASUREMENTS[9], // comissionamento
    ],
    totalBudgetBRL: 350560,
    createdAt: '2026-01-15T10:00:00Z',
    isTemplate: true,
  },
  {
    id: 'wp-red-01',
    code: 'WP-RED-01',
    name: 'Rede de Esgoto DN200 — Padrão',
    description:
      'Pacote de trabalho modelo para implantação de rede coletora de esgoto DN200, cobrindo escavação, assentamento, reaterro e testes.',
    costAccounts: [
      MOCK_COST_ACCOUNTS[0],  // tubo PVC — material
      MOCK_COST_ACCOUNTS[1],  // conexões — material
      MOCK_COST_ACCOUNTS[3],  // poço de visita — material
      MOCK_COST_ACCOUNTS[4],  // retroescavadeira — equipamento
      MOCK_COST_ACCOUNTS[7],  // encanador — mão de obra
      MOCK_COST_ACCOUNTS[11], // ISS — impostos
    ],
    measurements: [
      MOCK_MEASUREMENTS[0], // escavação
      MOCK_MEASUREMENTS[1], // assentamento
      MOCK_MEASUREMENTS[2], // reaterro
    ],
    totalBudgetBRL: 510885,
    createdAt: '2026-01-20T14:30:00Z',
    isTemplate: true,
  },
  {
    id: 'wp-vc-01',
    code: 'WP-VC-01',
    name: 'Rede Esgoto Vila dos Criadores',
    description:
      'Instância aplicada — implantação de 2.400 m de rede coletora DN200, 18 PVs e 1 EBE no bairro Vila dos Criadores, incluindo reposição asfáltica.',
    costAccounts: [
      MOCK_COST_ACCOUNTS[0],  // tubo PVC
      MOCK_COST_ACCOUNTS[1],  // conexões
      MOCK_COST_ACCOUNTS[2],  // motobomba
      MOCK_COST_ACCOUNTS[3],  // PV pré-moldado
      MOCK_COST_ACCOUNTS[4],  // retroescavadeira
      MOCK_COST_ACCOUNTS[6],  // compactador
      MOCK_COST_ACCOUNTS[7],  // encanador
      MOCK_COST_ACCOUNTS[8],  // servente
      MOCK_COST_ACCOUNTS[9],  // eletricista
      MOCK_COST_ACCOUNTS[11], // ISS
      MOCK_COST_ACCOUNTS[13], // FGTS
    ],
    measurements: [
      MOCK_MEASUREMENTS[0], // escavação
      MOCK_MEASUREMENTS[1], // assentamento
      MOCK_MEASUREMENTS[6], // PV
      MOCK_MEASUREMENTS[7], // reposição pavimento
      MOCK_MEASUREMENTS[8], // escoramento
    ],
    totalBudgetBRL: 863637,
    createdAt: '2026-02-10T09:00:00Z',
    isTemplate: false,
  },
]

// ---------------------------------------------------------------------------
// EVM Metrics (snapshot — status date 2026-04-01)
// ---------------------------------------------------------------------------

export const MOCK_EVM_METRICS: EvmMetrics = {
  BAC: 4500000,
  PV: 1620000,     // 36% planned through April
  EV: 1409400,     // earned = BAC * 0.3132
  AC: 1531957,     // actual spend slightly over EV
  CPI: 0.92,       // EV / AC
  SPI: 0.87,       // EV / PV
  CV: -122557,     // EV - AC  (over budget)
  SV: -210600,     // EV - PV  (behind schedule)
  EAC: 4891304,    // BAC / CPI
  ETC: 3359347,    // EAC - AC
  VAC: -391304,    // BAC - EAC
  TCPI: 1.04,      // (BAC - EV) / (BAC - AC)
  costBreakdown: {
    material: 820000,
    equipamento: 450000,
    mao_de_obra: 680000,
    impostos_indiretos: 230000,
  },
  eacScenarios: {
    optimistic: 4500000,   // BAC
    trend: 4891304,        // BAC / 0.92
    pessimistic: 5625000,  // BAC / 0.92 * 1.15
  },
  pillarDeviations: [
    { pillar: 'mao_de_obra', label: 'Mão de Obra', budgeted: 600000, actual: 680000, deviation: 80000, deviationPct: 52 },
    { pillar: 'material', label: 'Material', budgeted: 780000, actual: 820000, deviation: 40000, deviationPct: 26 },
    { pillar: 'equipamento', label: 'Equipamentos', budgeted: 430000, actual: 450000, deviation: 20000, deviationPct: 13 },
    { pillar: 'impostos_indiretos', label: 'Impostos/Indiretos', budgeted: 215000, actual: 230000, deviation: 15000, deviationPct: 9 },
  ],
  stockAlerts: [
    { itemId: 'est-001', description: 'Tubo PEAD DN200 (m)', qtdComprada: 2000, qtdInstalada: 800, qtdImobilizada: 1200, custoImobilizado: 96000 },
    { itemId: 'est-002', description: 'Conexões PVC DN150', qtdComprada: 500, qtdInstalada: 120, qtdImobilizada: 380, custoImobilizado: 22800 },
  ],
  healthStatus: 'red' as const,
}

// ---------------------------------------------------------------------------
// S-Curve Data — monthly snapshots Apr 2026 → Mar 2027
// ---------------------------------------------------------------------------

export const MOCK_SCURVE_DATA: SCurveMultiPoint[] = [
  {
    date: '2026-04-01',
    plannedFinancialPct: 5.0,
    actualPhysicalPct: 3.2,
    earnedValuePct: 4.0,
    actualCostPct: 9.5,
  },
  {
    date: '2026-05-01',
    plannedFinancialPct: 12.5,
    actualPhysicalPct: 8.6,
    earnedValuePct: 10.2,
    actualCostPct: 15.1,
  },
  {
    date: '2026-06-01',
    plannedFinancialPct: 23.0,
    actualPhysicalPct: 16.4,
    earnedValuePct: 19.5,
    actualCostPct: 22.8,
  },
  {
    date: '2026-07-01',
    plannedFinancialPct: 36.0,
    actualPhysicalPct: 26.8,
    earnedValuePct: 31.3,
    actualCostPct: 34.0,
  },
  {
    date: '2026-08-01',
    plannedFinancialPct: 50.0,
    actualPhysicalPct: 38.5,
    earnedValuePct: 43.8,
    actualCostPct: 45.2,
  },
  {
    date: '2026-09-01',
    plannedFinancialPct: 64.0,
    actualPhysicalPct: 51.2,
    earnedValuePct: 57.0,
    actualCostPct: 57.8,
  },
  {
    date: '2026-10-01',
    plannedFinancialPct: 76.0,
    actualPhysicalPct: 63.4,
    earnedValuePct: 69.2,
    actualCostPct: 70.6,
  },
  {
    date: '2026-11-01',
    plannedFinancialPct: 85.5,
    actualPhysicalPct: 74.0,
    earnedValuePct: 79.5,
    actualCostPct: 80.5,
  },
  {
    date: '2026-12-01',
    plannedFinancialPct: 92.0,
    actualPhysicalPct: 82.8,
    earnedValuePct: 87.0,
    actualCostPct: 89.4,
  },
  {
    date: '2027-01-01',
    plannedFinancialPct: 96.5,
    actualPhysicalPct: 89.6,
    earnedValuePct: 92.8,
    actualCostPct: 95.8,
  },
  {
    date: '2027-02-01',
    plannedFinancialPct: 99.0,
    actualPhysicalPct: 94.5,
    earnedValuePct: 96.8,
    actualCostPct: 100.2,
  },
  {
    date: '2027-03-01',
    plannedFinancialPct: 100.0,
    actualPhysicalPct: 98.2,
    earnedValuePct: 99.5,
    actualCostPct: 105.0,
  },
]
