import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, ClipboardList, FileText, Package, Receipt, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { PODialog } from './PODialog'
import { ReceiptDialog } from './ReceiptDialog'
import type { PurchaseOrder, MatchStatus } from '@/types'

function MatchBadge({ status }: { status: MatchStatus | undefined }) {
  if (status === 'matched') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#16a34a]/20 text-[#4ade80] text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
        Conciliado
      </span>
    )
  }
  if (status === 'discrepancy') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#dc2626]/20 text-[#f87171] text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />
        Divergência
      </span>
    )
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ca8a04]/20 text-[#fbbf24] text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]" />
        Parcial
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#2563eb]/20 text-[#93c5fd] text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#93c5fd]" />
      Aguardando RC
    </span>
  )
}

function POStatusBadge({ status }: { status: PurchaseOrder['status'] }) {
  const map = {
    open:      'bg-[#2563eb]/20 text-[#93c5fd]',
    partial:   'bg-[#ca8a04]/20 text-[#fbbf24]',
    closed:    'bg-[#16a34a]/20 text-[#4ade80]',
    cancelled: 'bg-[#6b6b6b]/20 text-[#6b6b6b]',
  }
  const labels = { open: 'Aberta', partial: 'Parcial', closed: 'Encerrada', cancelled: 'Cancelada' }
  return (
    <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', map[status])}>
      {labels[status]}
    </span>
  )
}

interface PORowProps {
  po: PurchaseOrder
  matchStatus: MatchStatus | undefined
  onRegisterReceipt: () => void
  onEditPO: () => void
  onRunMatch: () => void
}

function PORow({ po, matchStatus, onRegisterReceipt, onEditPO, onRunMatch }: PORowProps) {
  const [open, setOpen] = useState(false)
  const { receipts, invoices } = useSuprimentosStore(
    useShallow((s) => ({ receipts: s.receipts, invoices: s.invoices }))
  )

  const receipt = receipts.find((r) => r.poId === po.id)
  const invoice = invoices.find((nf) => nf.poId === po.id)
  const total   = po.items.reduce((acc, i) => acc + i.totalPrice, 0)

  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-[#484848] transition-colors text-left"
      >
        {open ? <ChevronUp size={14} className="text-[#6b6b6b] shrink-0" /> : <ChevronDown size={14} className="text-[#6b6b6b] shrink-0" />}
        <span className="font-mono text-[#a3a3a3] text-xs shrink-0">{po.code}</span>
        <span className="text-[#f5f5f5] text-sm font-medium flex-1 truncate">{po.supplier}</span>
        <span className="text-[#f5f5f5] text-sm tabular-nums shrink-0">
          {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
        <POStatusBadge status={po.status} />
        <MatchBadge status={matchStatus} />
      </button>

      {open && (
        <div className="border-t border-[#525252] p-4 flex flex-col gap-4">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><span className="text-[#6b6b6b]">Responsável: </span><span className="text-[#f5f5f5]">{po.responsible}</span></div>
            <div><span className="text-[#6b6b6b]">Emissão: </span><span className="text-[#f5f5f5]">{new Date(po.issuedDate).toLocaleDateString('pt-BR')}</span></div>
            <div><span className="text-[#6b6b6b]">Entrega prev.: </span><span className="text-[#f5f5f5]">{new Date(po.expectedDelivery).toLocaleDateString('pt-BR')}</span></div>
          </div>

          {/* Items table */}
          <div className="bg-[#333333] border border-[#525252] rounded-lg overflow-x-auto overflow-hidden">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#484848]">
                  <th className="text-left text-[#6b6b6b] font-medium px-3 py-2">Descrição</th>
                  <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-16">Qtd OC</th>
                  <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-16">Qtd RC</th>
                  <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-20">Preço OC</th>
                  <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-20">Preço NF</th>
                  <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-10">Un</th>
                  <th className="text-center text-[#6b6b6b] font-medium px-3 py-2 w-14">Status</th>
                </tr>
              </thead>
              <tbody>
                {po.items.map((item) => {
                  const rcItem = receipt?.items.find((r) => r.poItemId === item.id)
                  const nfItem = invoice?.items.find((n) => n.poItemId === item.id)
                  const qtyOk  = !rcItem || Math.abs(rcItem.receivedQty - item.quantity) / item.quantity <= 0.02
                  const priceOk = !nfItem || Math.abs(nfItem.unitPrice - item.unitPrice) / item.unitPrice <= 0.02
                  const rowOk  = qtyOk && priceOk
                  return (
                    <tr key={item.id} className="border-t border-[#525252]">
                      <td className="px-3 py-2 text-[#f5f5f5]">{item.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">{item.quantity.toLocaleString('pt-BR')}</td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', rcItem ? (qtyOk ? 'text-[#4ade80]' : 'text-[#f87171]') : 'text-[#1f3c5e]')}>
                        {rcItem ? rcItem.receivedQty.toLocaleString('pt-BR') : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[#f5f5f5]">
                        {item.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', nfItem ? (priceOk ? 'text-[#4ade80]' : 'text-[#f87171]') : 'text-[#1f3c5e]')}>
                        {nfItem ? nfItem.unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </td>
                      <td className="px-3 py-2 text-[#a3a3a3]">{item.unit}</td>
                      <td className="px-3 py-2 text-center">
                        {rcItem || nfItem ? (
                          <span className={rowOk ? 'text-[#4ade80]' : 'text-[#f87171]'}>
                            {rowOk ? '✓' : '✗'}
                          </span>
                        ) : (
                          <span className="text-[#1f3c5e]">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* RC / NF status */}
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', receipt ? 'bg-[#4ade80]' : 'bg-[#1f3c5e]')} />
              <span className="text-[#a3a3a3]">RC:</span>
              <span className="text-[#f5f5f5]">{receipt ? `${receipt.code} (${new Date(receipt.receivedDate).toLocaleDateString('pt-BR')})` : 'Não registrado'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', invoice ? 'bg-[#4ade80]' : 'bg-[#1f3c5e]')} />
              <span className="text-[#a3a3a3]">NF:</span>
              <span className="text-[#f5f5f5]">{invoice ? `${invoice.number} (${invoice.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})` : 'Não registrada'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {!receipt && (
              <button
                onClick={onRegisterReceipt}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563eb]/20 hover:bg-[#2563eb]/30 text-[#93c5fd] text-xs font-semibold transition-colors"
              >
                <ClipboardList size={12} />
                Registrar RC
              </button>
            )}
            <button
              onClick={onEditPO}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] text-xs font-medium transition-colors"
            >
              Editar OC
            </button>
            <button
              onClick={onRunMatch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f766e]/20 hover:bg-[#0f766e]/30 text-[#2dd4bf] text-xs font-semibold transition-colors"
            >
              <RefreshCw size={12} />
              Executar Match
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Three-Way-Match Summary ──────────────────────────────────────────────────

function ThreeWayMatchSummary() {
  const { purchaseOrders, receipts, invoices, matches } = useSuprimentosStore(
    useShallow((s) => ({ purchaseOrders: s.purchaseOrders, receipts: s.receipts, invoices: s.invoices, matches: s.matches }))
  )

  const matched     = matches.filter((m) => m.status === 'matched').length
  const discrepancy = matches.filter((m) => m.status === 'discrepancy').length
  const partial     = matches.filter((m) => m.status === 'partial').length
  const pending     = purchaseOrders.length - matches.length

  const totalOC  = purchaseOrders.reduce((s, po) => s + po.items.reduce((a, i) => a + i.totalPrice, 0), 0)
  const totalNF  = invoices.reduce((s, nf) => s + nf.totalAmount, 0)

  const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl p-4 shrink-0">
      {/* Title */}
      <p className="text-[#f5f5f5] text-xs font-bold uppercase tracking-widest mb-3">
        Three-Way Match — OC · RC · NF
      </p>

      {/* 3 document columns */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { Icon: FileText,  label: 'Ordens de Compra',  count: purchaseOrders.length, color: '#3b82f6', sub: fmtBRL(totalOC) },
          { Icon: Package,   label: 'Recibos (RC)',       count: receipts.length,       color: '#f97316', sub: `${receipts.length} entradas` },
          { Icon: Receipt,   label: 'Notas Fiscais (NF)', count: invoices.length,        color: '#22c55e', sub: fmtBRL(totalNF) },
        ].map(({ Icon, label, count, color, sub }) => (
          <div key={label} className="bg-[#333333] rounded-lg p-3 flex flex-col items-center text-center">
            <Icon size={18} style={{ color }} className="mb-1.5" />
            <span className="text-[#6b6b6b] text-[10px] font-medium leading-tight">{label}</span>
            <span className="text-lg font-bold mt-0.5" style={{ color }}>{count}</span>
            <span className="text-[#6b6b6b] text-[10px] mt-0.5">{sub}</span>
          </div>
        ))}
      </div>

      {/* Match status row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Conciliado',  value: matched,     color: '#4ade80' },
          { label: 'Parcial',     value: partial,     color: '#fbbf24' },
          { label: 'Divergência', value: discrepancy, color: '#f87171' },
          { label: 'Aguardando',  value: pending,     color: '#93c5fd' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#3d3d3d] rounded-lg px-2 py-2 text-center">
            <span className="block text-[10px] text-[#6b6b6b]">{label}</span>
            <span className="block text-base font-bold mt-0.5" style={{ color }}>{value}</span>
          </div>
        ))}
      </div>

      <p className="text-[#3f3f3f] text-[10px] mt-2">
        ↓ Clique em cada OC abaixo para ver o detalhamento linha por linha
      </p>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ConciliacaoPanel() {
  const { purchaseOrders, matches, runMatch } = useSuprimentosStore(
    useShallow((s) => ({ purchaseOrders: s.purchaseOrders, matches: s.matches, runMatch: s.runMatch }))
  )

  const [showNewPO,     setShowNewPO]     = useState(false)
  const [editPO,        setEditPO]        = useState<PurchaseOrder | undefined>()
  const [registerRcFor, setRegisterRcFor] = useState<PurchaseOrder | undefined>()

  return (
    <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
      {/* Three-Way Match Summary */}
      <ThreeWayMatchSummary />

      {/* Toolbar */}
      <div className="flex items-center justify-between shrink-0">
        <span className="text-[#6b6b6b] text-xs">{purchaseOrders.length} ordens de compra — expanda para ver o match linha por linha</span>
        <button
          onClick={() => setShowNewPO(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-semibold transition-colors"
        >
          <Plus size={12} />
          Nova OC
        </button>
      </div>

      {/* PO list */}
      {purchaseOrders.map((po) => {
        const match = matches.find((m) => m.poId === po.id)
        return (
          <PORow
            key={po.id}
            po={po}
            matchStatus={match?.status}
            onRegisterReceipt={() => setRegisterRcFor(po)}
            onEditPO={() => setEditPO(po)}
            onRunMatch={() => runMatch(po.id)}
          />
        )
      })}

      {showNewPO && <PODialog onClose={() => setShowNewPO(false)} />}
      {editPO    && <PODialog po={editPO} onClose={() => setEditPO(undefined)} />}
      {registerRcFor && <ReceiptDialog po={registerRcFor} onClose={() => setRegisterRcFor(undefined)} />}
    </div>
  )
}
