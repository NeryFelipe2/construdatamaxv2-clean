import { create } from 'zustand'
import type {
  PurchaseOrder,
  GoodsReceipt,
  Invoice,
  ThreeWayMatch,
  MatchException,
  DemandForecast,
  MatchStatus,
  Discrepancy,
  Requisition,
  RequisitionStatus,
  FrameworkAgreement,
  DepositoVirtual,
  ItemEstoque,
  MovimentacaoEstoque,
  ReservaMaterial,
  LeadTimeRecord,
} from '@/types'
import {
  mockPurchaseOrders,
  mockGoodsReceipts,
  mockInvoices,
  mockMatches,
  mockExceptions,
  mockForecasts,
  mockRequisitions,
  mockFrameworkAgreements,
  mockDepositos,
  mockEstoqueItens,
  mockMovimentacoes,
  mockReservas,
  mockLeadTimeRecords,
} from '@/data/mockSuprimentos'

// ─── Three-Way Match algorithm ────────────────────────────────────────────────

const TOLERANCE = 0.02 // 2%

function runThreeWayMatch(
  po: PurchaseOrder,
  receipt?: GoodsReceipt,
  invoice?: Invoice,
): Omit<ThreeWayMatch, 'id' | 'poId'> {
  if (!receipt && !invoice) {
    return { status: 'pending', discrepancies: [] }
  }

  const discrepancies: Discrepancy[] = []

  for (const poItem of po.items) {
    const rcItem = receipt?.items.find((i) => i.poItemId === poItem.id)
    const nfItem = invoice?.items.find((i) => i.poItemId === poItem.id)

    // Quantity check: RC vs OC
    if (rcItem) {
      const diff = rcItem.receivedQty - poItem.quantity
      const pct  = diff / poItem.quantity
      if (Math.abs(pct) > TOLERANCE) {
        discrepancies.push({
          itemId:        poItem.id,
          field:         'quantity',
          poValue:       poItem.quantity,
          receivedValue: rcItem.receivedQty,
          delta:         diff,
          deltaPercent:  parseFloat((pct * 100).toFixed(1)),
        })
      }
    } else if (receipt) {
      discrepancies.push({
        itemId:      poItem.id,
        field:       'missing',
        poValue:     poItem.quantity,
        delta:       -poItem.quantity,
        deltaPercent: -100,
      })
    }

    // Price check: NF vs OC
    if (nfItem) {
      const diff = nfItem.unitPrice - poItem.unitPrice
      const pct  = diff / poItem.unitPrice
      if (Math.abs(pct) > TOLERANCE) {
        discrepancies.push({
          itemId:        poItem.id,
          field:         'price',
          poValue:       poItem.unitPrice,
          invoicedValue: nfItem.unitPrice,
          delta:         diff,
          deltaPercent:  parseFloat((pct * 100).toFixed(1)),
        })
      }
    }
  }

  let status: MatchStatus
  if (discrepancies.length === 0) {
    status = 'matched'
  } else if (discrepancies.some((d) => Math.abs(d.deltaPercent) > 5)) {
    status = 'discrepancy'
  } else {
    status = 'partial'
  }

  return { status, discrepancies, matchedAt: new Date().toISOString() }
}

// ─── What-if Logístico ─────────────────────────────────────────────────────────

export interface WhatIfItemInsuficiente {
  itemId:        string
  descricao:     string
  qtdDisponivel: number
  qtdNecessaria: number
  deficit:       number
  fornecedor?:   string
  leadTimeDias?: number
}

export interface WhatIfResult {
  resultado:          'viavel' | 'alerta' | 'inviavel'
  mensagem:           string
  itensInsuficientes: WhatIfItemInsuficiente[]
}

interface WhatIfParams {
  activityId:     string
  semanaOriginal: number
  semanaSimulada: number
  depositoId:     string
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface SuprimentosState {
  purchaseOrders:     PurchaseOrder[]
  receipts:           GoodsReceipt[]
  invoices:           Invoice[]
  matches:            ThreeWayMatch[]
  exceptions:         MatchException[]
  forecasts:          DemandForecast[]
  requisitions:       Requisition[]
  frameworkAgreements: FrameworkAgreement[]

  // Materiais & Estoque
  depositos:          DepositoVirtual[]
  estoqueItens:       ItemEstoque[]
  movimentacoes:      MovimentacaoEstoque[]
  reservas:           ReservaMaterial[]
  leadTimeRecords:    LeadTimeRecord[]
  selectedDepositoId: string | null

  // CRUD — POs
  addPO:    (po: PurchaseOrder) => void
  updatePO: (id: string, patch: Partial<PurchaseOrder>) => void
  deletePO: (id: string) => void

  // Receipts + Invoices
  addReceipt: (receipt: GoodsReceipt) => void
  addInvoice: (invoice: Invoice)       => void

  // Match
  runMatch: (poId: string) => void

  // Exceptions
  addException:    (ex: MatchException) => void
  updateException: (id: string, patch: Partial<MatchException>) => void

  // Forecasts
  addForecast:    (forecast: Omit<DemandForecast, 'id'>) => void
  updateForecast: (id: string, status: DemandForecast['status']) => void

  // Requisitions
  addRequisition:           (req: Requisition)                  => void
  updateRequisition:        (id: string, patch: Partial<Requisition>) => void
  advanceRequisitionStatus: (id: string)                        => void

  // Framework Agreements
  addFrameworkAgreement:    (fa: Omit<FrameworkAgreement, 'id'>) => void
  updateFrameworkAgreement: (id: string, patch: Partial<FrameworkAgreement>) => void

  // Materiais & Estoque — actions
  setSelectedDeposito: (id: string) => void
  addItemEstoque:      (item: Omit<ItemEstoque, 'id'>) => void
  addMovimentacao:     (mov: Omit<MovimentacaoEstoque, 'id'>) => void
  consumirMaterial:    (itemId: string, quantidade: number, extra?: Partial<MovimentacaoEstoque>) => void
  calcSemaforo:        (depositoId: string, lpsActivityId: string, semana: number) => 'verde' | 'amarelo' | 'vermelho'
  updateReserva:       (id: string, patch: Partial<ReservaMaterial>) => void
  runWhatIf:           (params: WhatIfParams) => WhatIfResult

  // Demo mode
  loadDemoData: () => void
  clearData: () => void
}

const REQUISITION_FLOW: RequisitionStatus[] = [
  'submitted',
  'parsing',
  'ontology_matched',
  'proposals',
  'ordered',
]

export const useSuprimentosStore = create<SuprimentosState>((set, get) => ({
  purchaseOrders:      mockPurchaseOrders,
  receipts:            mockGoodsReceipts,
  invoices:            mockInvoices,
  matches:             mockMatches,
  exceptions:          mockExceptions,
  forecasts:           mockForecasts,
  requisitions:        mockRequisitions,
  frameworkAgreements: mockFrameworkAgreements,

  depositos:           mockDepositos,
  estoqueItens:        mockEstoqueItens,
  movimentacoes:       mockMovimentacoes,
  reservas:            mockReservas,
  leadTimeRecords:     mockLeadTimeRecords,
  selectedDepositoId:  null,

  addPO: (po) =>
    set((s) => ({ purchaseOrders: [...s.purchaseOrders, po] })),

  updatePO: (id, patch) =>
    set((s) => ({
      purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  deletePO: (id) =>
    set((s) => ({ purchaseOrders: s.purchaseOrders.filter((p) => p.id !== id) })),

  addReceipt: (receipt) => {
    set((s) => ({ receipts: [...s.receipts, receipt] }))
    get().runMatch(receipt.poId)
  },

  addInvoice: (invoice) => {
    set((s) => ({ invoices: [...s.invoices, invoice] }))
    get().runMatch(invoice.poId)
  },

  runMatch: (poId) => {
    const { purchaseOrders, receipts, invoices, matches } = get()
    const po      = purchaseOrders.find((p) => p.id === poId)
    if (!po) return

    const receipt = receipts.find((r) => r.poId === poId)
    const invoice = invoices.find((i) => i.poId === poId)
    const result  = runThreeWayMatch(po, receipt, invoice)

    const existing = matches.find((m) => m.poId === poId)
    if (existing) {
      set((s) => ({
        matches: s.matches.map((m) =>
          m.poId === poId ? { ...m, ...result } : m
        ),
      }))
    } else {
      const newMatch: ThreeWayMatch = {
        id:        `twm-${Date.now()}`,
        poId,
        receiptId: receipt?.id,
        invoiceId: invoice?.id,
        ...result,
      }
      set((s) => ({ matches: [...s.matches, newMatch] }))
    }
  },

  addException: (ex) =>
    set((s) => ({ exceptions: [...s.exceptions, ex] })),

  updateException: (id, patch) =>
    set((s) => ({
      exceptions: s.exceptions.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    })),

  addForecast: (forecast) =>
    set((s) => ({
      forecasts: [...s.forecasts, { ...forecast, id: crypto.randomUUID() }],
    })),

  updateForecast: (id, status) =>
    set((s) => ({
      forecasts: s.forecasts.map((f) => (f.id === id ? { ...f, status } : f)),
    })),

  addRequisition: (req) =>
    set((s) => ({ requisitions: [...s.requisitions, req] })),

  updateRequisition: (id, patch) =>
    set((s) => ({
      requisitions: s.requisitions.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  advanceRequisitionStatus: (id) =>
    set((s) => ({
      requisitions: s.requisitions.map((r) => {
        if (r.id !== id) return r
        const idx  = REQUISITION_FLOW.indexOf(r.status)
        const next = REQUISITION_FLOW[idx + 1]
        return next ? { ...r, status: next } : r
      }),
    })),

  addFrameworkAgreement: (fa) =>
    set((s) => ({
      frameworkAgreements: [...s.frameworkAgreements, { ...fa, id: `fa-${Date.now()}` }],
    })),

  updateFrameworkAgreement: (id, patch) =>
    set((s) => ({
      frameworkAgreements: s.frameworkAgreements.map((fa) => (fa.id === id ? { ...fa, ...patch } : fa)),
    })),

  setSelectedDeposito: (id) => set({ selectedDepositoId: id }),

  addItemEstoque: (item) =>
    set((s) => ({
      estoqueItens: [...s.estoqueItens, { ...item, id: `ie-${Date.now()}` }],
    })),

  addMovimentacao: (mov) => {
    set((s) => ({
      movimentacoes: [...s.movimentacoes, { ...mov, id: `mov-${Date.now()}` }],
    }))
    if (mov.tipo === 'entrada') {
      set((s) => ({
        estoqueItens: s.estoqueItens.map((i) =>
          i.id === mov.itemId ? { ...i, qtdDisponivel: i.qtdDisponivel + mov.quantidade } : i
        ),
      }))
    }
  },

  consumirMaterial: (itemId, quantidade, extra) => {
    set((s) => ({
      estoqueItens: s.estoqueItens.map((i) =>
        i.id === itemId ? { ...i, qtdDisponivel: Math.max(0, i.qtdDisponivel - quantidade) } : i
      ),
    }))
    const item = get().estoqueItens.find((i) => i.id === itemId)
    if (item) {
      set((s) => ({
        movimentacoes: [
          ...s.movimentacoes,
          {
            id:            `mov-${Date.now()}`,
            itemId,
            depositoId:    item.depositoId,
            tipo:          'saida',
            quantidade,
            dataMovimento: new Date().toISOString().slice(0, 10),
            ...extra,
          },
        ],
      }))
    }
  },

  calcSemaforo: (depositoId, lpsActivityId, semana) => {
    const { reservas, estoqueItens } = get()
    const reserva = reservas.find(
      (r) => r.depositoId === depositoId && r.lpsActivityId === lpsActivityId && r.semana === semana
    )
    if (!reserva) return 'verde'
    const item = estoqueItens.find((i) => i.id === reserva.itemId)
    if (!item) return reserva.status
    if (item.qtdDisponivel >= reserva.qtdNecessaria) return 'verde'
    if (item.qtdTransito > 0) return 'amarelo'
    return 'vermelho'
  },

  updateReserva: (id, patch) =>
    set((s) => ({
      reservas: s.reservas.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  runWhatIf: ({ activityId, depositoId }) => {
    const { reservas, estoqueItens, leadTimeRecords } = get()
    const itensDaAtividade = reservas.filter(
      (r) => r.depositoId === depositoId && r.lpsActivityId === activityId
    )

    const itensInsuficientes: WhatIfItemInsuficiente[] = []
    for (const r of itensDaAtividade) {
      const item = estoqueItens.find((i) => i.id === r.itemId)
      if (!item) continue
      const deficit = r.qtdNecessaria - item.qtdDisponivel
      if (deficit > 0) {
        const lt = leadTimeRecords.find((l) => l.fornecedor === item.fornecedorPrincipal)
        itensInsuficientes.push({
          itemId:        item.id,
          descricao:     item.descricao,
          qtdDisponivel: item.qtdDisponivel,
          qtdNecessaria: r.qtdNecessaria,
          deficit,
          fornecedor:    item.fornecedorPrincipal,
          leadTimeDias:  lt?.leadTimeDias,
        })
      }
    }

    if (itensInsuficientes.length === 0) {
      return {
        resultado: 'viavel',
        mensagem:  'Cenário viável — estoque suficiente para a nova data.',
        itensInsuficientes: [],
      }
    }

    const critico = itensInsuficientes.some((i) => (i.leadTimeDias ?? 0) > 7)
    return {
      resultado: critico ? 'inviavel' : 'alerta',
      mensagem:  critico
        ? 'Cenário inviável — déficit de materiais com lead time alto.'
        : 'Cenário com alerta — déficit de materiais a resolver antes da data simulada.',
      itensInsuficientes,
    }
  },

  loadDemoData: () =>
    set({
      purchaseOrders:      mockPurchaseOrders,
      receipts:            mockGoodsReceipts,
      invoices:            mockInvoices,
      matches:             mockMatches,
      exceptions:          mockExceptions,
      forecasts:           mockForecasts,
      requisitions:        mockRequisitions,
      frameworkAgreements: mockFrameworkAgreements,
      depositos:           mockDepositos,
      estoqueItens:        mockEstoqueItens,
      movimentacoes:       mockMovimentacoes,
      reservas:            mockReservas,
      leadTimeRecords:     mockLeadTimeRecords,
    }),

  clearData: () =>
    set({
      purchaseOrders:      [],
      receipts:            [],
      invoices:            [],
      matches:             [],
      exceptions:          [],
      forecasts:           [],
      requisitions:        [],
      frameworkAgreements: [],
      depositos:           [],
      estoqueItens:        [],
      movimentacoes:       [],
      reservas:            [],
      leadTimeRecords:     [],
      selectedDepositoId:  null,
    }),
}))
