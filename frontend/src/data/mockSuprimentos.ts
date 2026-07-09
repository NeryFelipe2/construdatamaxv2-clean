import type {
  PurchaseOrder,
  GoodsReceipt,
  Invoice,
  ThreeWayMatch,
  MatchException,
  DemandForecast,
  FrameworkAgreement,
  Requisition,
  DepositoVirtual,
  ItemEstoque,
  MovimentacaoEstoque,
  ReservaMaterial,
  LeadTimeRecord,
} from '@/types'

export const mockPurchaseOrders: PurchaseOrder[] = []

export const mockGoodsReceipts: GoodsReceipt[] = []

export const mockInvoices: Invoice[] = []

export const mockMatches: ThreeWayMatch[] = []

export const mockExceptions: MatchException[] = []

export const mockForecasts: DemandForecast[] = []

export const mockFrameworkAgreements: FrameworkAgreement[] = []

export const mockRequisitions: Requisition[] = []

// ─── Materiais & Estoque (WCR Boi Malhado / Sakura / Retorno) ────────────────

export const mockDepositos: DepositoVirtual[] = [
  { id: 'dep-boi-malhado', frente: 'Boi Malhado', descricao: 'Frente de obra — Boi Malhado', ativo: true },
  { id: 'dep-sakura',      frente: 'Sakura',       descricao: 'Frente de obra — Sakura',       ativo: true },
  { id: 'dep-retorno',     frente: 'Retorno',      descricao: 'Frente de obra — Retorno',      ativo: true },
  { id: 'dep-escritorio',  frente: 'Escritório',   descricao: 'Almoxarifado central',           ativo: true },
]

export const mockEstoqueItens: ItemEstoque[] = [
  { id: 'ie-001', depositoId: 'dep-boi-malhado', descricao: 'Tubo PVC 100mm JE 6m',       unidade: 'br', qtdDisponivel: 42,  qtdReservada: 12, qtdTransito: 20, estoqueMinimo: 30, custoUnitario: 68.5,  categoria: 'Tubulação e Saneamento', fornecedorPrincipal: 'TIGRE' },
  { id: 'ie-002', depositoId: 'dep-boi-malhado', descricao: 'Cimento CP-II 50kg',         unidade: 'sc', qtdDisponivel: 0,   qtdReservada: 40, qtdTransito: 0,  estoqueMinimo: 50, custoUnitario: 34.9,  categoria: 'Cimento e Argamassa',    fornecedorPrincipal: 'Votorantim' },
  { id: 'ie-003', depositoId: 'dep-boi-malhado', descricao: 'Vergalhão CA-50 10mm',       unidade: 'br', qtdDisponivel: 180, qtdReservada: 60, qtdTransito: 0,  estoqueMinimo: 100, custoUnitario: 42.3, categoria: 'Aço / Vergalhão',        fornecedorPrincipal: 'Gerdau' },
  { id: 'ie-004', depositoId: 'dep-sakura',      descricao: 'Tubo PVC 150mm JE 6m',       unidade: 'br', qtdDisponivel: 15,  qtdReservada: 15, qtdTransito: 30, estoqueMinimo: 25, custoUnitario: 112.0, categoria: 'Tubulação e Saneamento', fornecedorPrincipal: 'TIGRE' },
  { id: 'ie-005', depositoId: 'dep-sakura',      descricao: 'Areia média lavada',         unidade: 'm³', qtdDisponivel: 8,   qtdReservada: 4,  qtdTransito: 0,  estoqueMinimo: 10, custoUnitario: 85.0,  categoria: 'Outros',                 fornecedorPrincipal: 'Areial São José' },
  { id: 'ie-006', depositoId: 'dep-retorno',     descricao: 'Junta elástica PVC 100mm',   unidade: 'un', qtdDisponivel: 0,   qtdReservada: 24, qtdTransito: 0,  estoqueMinimo: 20, custoUnitario: 9.8,   categoria: 'Tubulação e Saneamento', fornecedorPrincipal: 'TIGRE' },
  { id: 'ie-007', depositoId: 'dep-retorno',     descricao: 'Concreto usinado FCK 25',    unidade: 'm³', qtdDisponivel: 22,  qtdReservada: 10, qtdTransito: 0,  estoqueMinimo: 15, custoUnitario: 420.0, categoria: 'Concreto Usinado',       fornecedorPrincipal: 'Supermix' },
  { id: 'ie-008', depositoId: 'dep-escritorio',  descricao: 'EPI — Capacete de segurança', unidade: 'un', qtdDisponivel: 60,  qtdReservada: 0,  qtdTransito: 0,  estoqueMinimo: 20, custoUnitario: 24.5,  categoria: 'Outros',                 fornecedorPrincipal: '3M' },
]

export const mockMovimentacoes: MovimentacaoEstoque[] = [
  { id: 'mov-001', itemId: 'ie-001', depositoId: 'dep-boi-malhado', tipo: 'entrada', quantidade: 42, dataMovimento: '2026-06-10', dataCompra: '2026-06-04', fornecedor: 'TIGRE',   nf: 'NF-88213', leadTimeDias: 6 },
  { id: 'mov-002', itemId: 'ie-002', depositoId: 'dep-boi-malhado', tipo: 'saida',   quantidade: 50, dataMovimento: '2026-06-20', observacoes: 'Consumo — concretagem base' },
  { id: 'mov-003', itemId: 'ie-003', depositoId: 'dep-boi-malhado', tipo: 'entrada', quantidade: 180, dataMovimento: '2026-06-15', dataCompra: '2026-06-11', fornecedor: 'Gerdau',  nf: 'NF-55210', leadTimeDias: 4 },
  { id: 'mov-004', itemId: 'ie-004', depositoId: 'dep-sakura',      tipo: 'entrada', quantidade: 15, dataMovimento: '2026-06-18', dataCompra: '2026-06-09', fornecedor: 'TIGRE',   nf: 'NF-88340', leadTimeDias: 9 },
  { id: 'mov-005', itemId: 'ie-006', depositoId: 'dep-retorno',     tipo: 'saida',   quantidade: 24, dataMovimento: '2026-06-25', observacoes: 'Consumo — junta de tubos' },
  { id: 'mov-006', itemId: 'ie-007', depositoId: 'dep-retorno',     tipo: 'entrada', quantidade: 22, dataMovimento: '2026-06-27', dataCompra: '2026-06-24', fornecedor: 'Supermix', nf: 'NF-11987', leadTimeDias: 3 },
]

export const mockReservas: ReservaMaterial[] = [
  { id: 'res-001', itemId: 'ie-001', depositoId: 'dep-boi-malhado', lpsActivityId: 'Assentamento de Tubulação', semana: 12, qtdNecessaria: 25, status: 'verde',    criadoEm: '2026-06-01T10:00:00.000Z' },
  { id: 'res-002', itemId: 'ie-002', depositoId: 'dep-boi-malhado', lpsActivityId: 'Concretagem de Base',       semana: 13, qtdNecessaria: 40, status: 'vermelho', alertaGerado: false, criadoEm: '2026-06-02T10:00:00.000Z' },
  { id: 'res-003', itemId: 'ie-004', depositoId: 'dep-sakura',      lpsActivityId: 'Assentamento de Tubulação', semana: 14, qtdNecessaria: 30, status: 'amarelo',  nfsEmTransito: ['NF-88340'], criadoEm: '2026-06-05T10:00:00.000Z' },
  { id: 'res-004', itemId: 'ie-006', depositoId: 'dep-retorno',     lpsActivityId: 'Junção e Vedação',          semana: 12, qtdNecessaria: 24, status: 'vermelho', alertaGerado: false, criadoEm: '2026-06-06T10:00:00.000Z' },
  { id: 'res-005', itemId: 'ie-007', depositoId: 'dep-retorno',     lpsActivityId: 'Concretagem de Base',       semana: 13, qtdNecessaria: 15, status: 'verde',    criadoEm: '2026-06-08T10:00:00.000Z' },
]

export const mockLeadTimeRecords: LeadTimeRecord[] = [
  { id: 'lt-001', fornecedor: 'TIGRE',    dataCompra: '2026-06-04', dataMovimento: '2026-06-10', nf: 'NF-88213', leadTimeDias: 6, itemDescricao: 'Tubo PVC 100mm JE 6m',     categoria: 'Tubulação e Saneamento' },
  { id: 'lt-002', fornecedor: 'Gerdau',   dataCompra: '2026-06-11', dataMovimento: '2026-06-15', nf: 'NF-55210', leadTimeDias: 4, itemDescricao: 'Vergalhão CA-50 10mm',      categoria: 'Aço / Vergalhão' },
  { id: 'lt-003', fornecedor: 'TIGRE',    dataCompra: '2026-06-09', dataMovimento: '2026-06-18', nf: 'NF-88340', leadTimeDias: 9, itemDescricao: 'Tubo PVC 150mm JE 6m',     categoria: 'Tubulação e Saneamento' },
  { id: 'lt-004', fornecedor: 'Supermix', dataCompra: '2026-06-24', dataMovimento: '2026-06-27', nf: 'NF-11987', leadTimeDias: 3, itemDescricao: 'Concreto usinado FCK 25',   categoria: 'Concreto Usinado' },
]
