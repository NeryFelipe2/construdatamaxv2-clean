import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import { useShallow } from 'zustand/react/shallow'
import type { FrameworkAgreement } from '@/types'
import { Copy, Check, ExternalLink, ChevronDown, ChevronUp, Pencil, X } from 'lucide-react'

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar"
      className={cn(
        'p-1 rounded transition-colors shrink-0',
        copied ? 'text-[#4ade80]' : 'text-[#6b6b6b] hover:text-[#a3a3a3]',
      )}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

// ─── FA status badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FrameworkAgreement['status'] }) {
  const map = {
    active:   { label: 'Ativo',    cls: 'bg-green-900/40 text-green-300 border-green-700/40' },
    expiring: { label: 'A vencer', cls: 'bg-amber-900/40 text-amber-300 border-amber-700/40' },
    expired:  { label: 'Expirado', cls: 'bg-[#3d3d3d] text-[#6b6b6b] border-[#525252]'       },
  }
  const { label, cls } = map[status]
  return (
    <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-semibold', cls)}>
      {label}
    </span>
  )
}

// ─── Collapsible accordion section ───────────────────────────────────────────

function AccordionSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#484848] transition-colors"
      >
        <span className="text-xs font-semibold text-[#a3a3a3] uppercase tracking-widest">{title}</span>
        {open ? <ChevronUp size={14} className="text-[#6b6b6b]" /> : <ChevronDown size={14} className="text-[#6b6b6b]" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── Shared input style ────────────────────────────────────────────────────────

const inp = 'bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-[#f5f5f5] text-xs outline-none focus:border-[#f97316]'
const sel = 'bg-[#2c2c2c] border border-[#525252] rounded px-2 py-1 text-[#f5f5f5] text-xs outline-none focus:border-[#f97316]'

// ─── Main panel ───────────────────────────────────────────────────────────────

type PaymentRow = NonNullable<FrameworkAgreement['paymentSchedule']>[number]
type DeliveryRow = NonNullable<FrameworkAgreement['deliverySchedule']>[number]

export function ContractPanel() {
  const { frameworkAgreements, updateFrameworkAgreement } = useSuprimentosStore(
    useShallow((s) => ({
      frameworkAgreements:      s.frameworkAgreements,
      updateFrameworkAgreement: s.updateFrameworkAgreement,
    }))
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editMode, setEditMode]     = useState(false)
  const [editData, setEditData]     = useState<FrameworkAgreement | null>(null)

  const selected = frameworkAgreements.find((fa) => fa.id === selectedId) ?? null

  function startEdit() {
    if (!selected) return
    setEditData({ ...selected })
    setEditMode(true)
  }

  function cancelEdit() {
    setEditMode(false)
    setEditData(null)
  }

  function saveEdit() {
    if (!editData) return
    updateFrameworkAgreement(editData.id, editData)
    setEditMode(false)
    setEditData(null)
  }

  function setED<K extends keyof FrameworkAgreement>(k: K, v: FrameworkAgreement[K]) {
    setEditData((prev) => prev ? { ...prev, [k]: v } : prev)
  }

  function updatePaymentRow(i: number, patch: Partial<PaymentRow>) {
    if (!editData?.paymentSchedule) return
    const updated = editData.paymentSchedule.map((p, idx) => idx === i ? { ...p, ...patch } : p)
    setED('paymentSchedule', updated)
  }

  function updateDeliveryRow(i: number, patch: Partial<DeliveryRow>) {
    if (!editData?.deliverySchedule) return
    const updated = editData.deliverySchedule.map((d, idx) => idx === i ? { ...d, ...patch } : d)
    setED('deliverySchedule', updated)
  }

  const display = editMode && editData ? editData : selected

  return (
    <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
      {/* ── Left: FA list ── */}
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto">
        <p className="text-[#6b6b6b] text-xs font-semibold uppercase tracking-wide px-1">
          Acordos Marco ({frameworkAgreements.length})
        </p>

        {frameworkAgreements.map((fa) => {
          const pctConsumed = Math.min(100, Math.round((Math.random() * 0.7 + 0.1) * 100))
          const isSelected  = fa.id === selectedId

          return (
            <button
              key={fa.id}
              onClick={() => { setSelectedId(isSelected ? null : fa.id); setEditMode(false); setEditData(null) }}
              className={cn(
                'text-left bg-[#3d3d3d] border rounded-xl p-3.5 flex flex-col gap-2.5 transition-all',
                isSelected
                  ? 'border-[#f97316]/60 bg-[#f97316]/5'
                  : 'border-[#525252] hover:border-[#484848]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[#f5f5f5] text-xs font-semibold leading-snug">{fa.supplier}</p>
                  <p className="text-[#6b6b6b] text-[10px] mt-0.5">{fa.category}</p>
                </div>
                <StatusBadge status={fa.status} />
              </div>

              <div className="flex gap-3 text-[10px]">
                <div>
                  <p className="text-[#6b6b6b]">Preço</p>
                  <p className="text-[#f5f5f5] tabular-nums font-medium">
                    {fa.agreedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{fa.unit}
                  </p>
                </div>
                <div>
                  <p className="text-[#6b6b6b]">Lead Time</p>
                  <p className="text-[#f5f5f5] font-medium">{fa.leadTimeDays}d</p>
                </div>
                <div>
                  <p className="text-[#6b6b6b]">Validade</p>
                  <p className="text-[#f5f5f5] font-medium">{fa.validTo}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-[#6b6b6b] mb-1">
                  <span>Volume utilizado</span>
                  <span className="tabular-nums">{pctConsumed}%</span>
                </div>
                <div className="h-1.5 bg-[#2c2c2c] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pctConsumed >= 80 ? 'bg-red-500' : pctConsumed >= 60 ? 'bg-amber-500' : 'bg-[#f97316]',
                    )}
                    style={{ width: `${pctConsumed}%` }}
                  />
                </div>
              </div>

              <span className="self-start font-mono text-[10px] text-[#6b6b6b] bg-[#2c2c2c] px-1.5 py-0.5 rounded">
                {fa.code}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Right: Contrato 360 ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {display ? (
          <div className="flex flex-col gap-4">
            {/* Header */}
            <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#f97316] font-semibold uppercase tracking-wide mb-1">
                    Contrato 360 — {display.code}
                  </p>
                  {editMode && editData ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <input className={cn(inp, 'text-sm font-bold')} value={editData.supplier} onChange={(e) => setED('supplier', e.target.value)} placeholder="Fornecedor" />
                      <div className="flex gap-2">
                        <input className={inp} value={editData.validFrom} onChange={(e) => setED('validFrom', e.target.value)} type="date" />
                        <span className="text-[#6b6b6b] text-xs self-center">→</span>
                        <input className={inp} value={editData.validTo} onChange={(e) => setED('validTo', e.target.value)} type="date" />
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-[#6b6b6b] text-xs">Confiança:</span>
                        <input className={cn(inp, 'w-20')} type="number" min="1" max="5" step="0.1" value={editData.confidenceScore} onChange={(e) => setED('confidenceScore', parseFloat(e.target.value) || 3)} />
                        <span className="text-[#6b6b6b] text-xs">Status:</span>
                        <select className={sel} value={editData.status} onChange={(e) => setED('status', e.target.value as FrameworkAgreement['status'])}>
                          <option value="active">Ativo</option>
                          <option value="expiring">A vencer</option>
                          <option value="expired">Expirado</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-[#f5f5f5] font-bold text-base">{display.supplier}</p>
                      <p className="text-[#6b6b6b] text-xs mt-0.5">{display.category}</p>
                      <div className="mt-3 flex gap-4 text-xs text-[#6b6b6b]">
                        <span>Vigência: <strong className="text-[#f5f5f5]">{display.validFrom}</strong> → <strong className="text-[#f5f5f5]">{display.validTo}</strong></span>
                        <span>Confiança: <strong className="text-[#f5f5f5]">{display.confidenceScore.toFixed(1)}/5.0</strong></span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!editMode && <StatusBadge status={display.status} />}
                  {editMode ? (
                    <>
                      <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f97316] hover:bg-[#22a8c4] text-white text-xs font-semibold transition-colors">
                        <Check size={12} /> Salvar
                      </button>
                      <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs hover:border-[#6b6b6b] transition-colors">
                        <X size={12} /> Cancelar
                      </button>
                    </>
                  ) : (
                    <button onClick={startEdit} className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#525252] text-[#a3a3a3] text-xs hover:border-[#f97316]/50 hover:text-[#f97316] transition-colors">
                      <Pencil size={12} /> Editar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section 1: Pagamentos */}
            <AccordionSection title="Pagamentos">
              {display.paymentSchedule && display.paymentSchedule.length > 0 ? (
                <div className="overflow-x-auto"><table className="w-full text-xs mt-1">
                  <thead>
                    <tr className="text-[#6b6b6b] border-b border-[#525252]">
                      <th className="text-left pb-2 font-medium">Vencimento</th>
                      <th className="text-right pb-2 font-medium">Valor</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.paymentSchedule.map((p, i) => (
                      <tr key={i} className="border-b border-[#525252] last:border-0">
                        <td className="py-2 text-[#f5f5f5]">
                          {editMode && editData?.paymentSchedule ? (
                            <input className={inp} type="date" value={editData.paymentSchedule[i]?.dueDate ?? p.dueDate} onChange={(e) => updatePaymentRow(i, { dueDate: e.target.value })} />
                          ) : (
                            new Date(p.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[#f5f5f5]">
                          {editMode && editData?.paymentSchedule ? (
                            <input className={cn(inp, 'text-right w-28')} type="number" min="0" value={editData.paymentSchedule[i]?.amount ?? p.amount} onChange={(e) => updatePaymentRow(i, { amount: parseFloat(e.target.value) || 0 })} />
                          ) : (
                            p.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {editMode && editData?.paymentSchedule ? (
                            <select className={sel} value={editData.paymentSchedule[i]?.status ?? p.status} onChange={(e) => updatePaymentRow(i, { status: e.target.value as PaymentRow['status'] })}>
                              <option value="pending">Pendente</option>
                              <option value="paid">Pago</option>
                              <option value="overdue">Vencido</option>
                            </select>
                          ) : (
                            <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold',
                              p.status === 'paid'    ? 'bg-[#16a34a]/20 text-[#4ade80]' :
                              p.status === 'overdue' ? 'bg-[#dc2626]/20 text-[#f87171]' :
                              'bg-[#ca8a04]/20 text-[#fbbf24]'
                            )}>
                              {p.status === 'paid' ? 'Pago' : p.status === 'overdue' ? 'Vencido' : 'Pendente'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                editMode && editData ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <p className="text-[#6b6b6b] text-xs">Preço/unidade:</p>
                    <div className="flex gap-2">
                      <input className={cn(inp, 'w-28')} type="number" min="0" step="0.01" value={editData.agreedUnitPrice} onChange={(e) => setED('agreedUnitPrice', parseFloat(e.target.value) || 0)} />
                      <input className={cn(inp, 'w-20')} value={editData.unit} onChange={(e) => setED('unit', e.target.value)} placeholder="un" />
                    </div>
                  </div>
                ) : (
                  <p className="text-[#6b6b6b] text-xs mt-1">
                    Preço acordado: {display.agreedUnitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/{display.unit}.
                    Vigência {display.validFrom} → {display.validTo}.
                  </p>
                )
              )}
            </AccordionSection>

            {/* Section 2: Prazos de Entrega */}
            <AccordionSection title="Prazos de Entrega">
              {display.deliverySchedule && display.deliverySchedule.length > 0 ? (
                <div className="overflow-x-auto"><table className="w-full text-xs mt-1">
                  <thead>
                    <tr className="text-[#6b6b6b] border-b border-[#525252]">
                      <th className="text-left pb-2 font-medium">Fase</th>
                      <th className="text-left pb-2 font-medium">Data</th>
                      <th className="text-right pb-2 font-medium">Qtd</th>
                      <th className="text-center pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {display.deliverySchedule.map((d, i) => (
                      <tr key={i} className="border-b border-[#525252] last:border-0">
                        <td className="py-2 text-[#f5f5f5]">
                          {editMode && editData?.deliverySchedule ? (
                            <input className={inp} value={editData.deliverySchedule[i]?.phase ?? d.phase} onChange={(e) => updateDeliveryRow(i, { phase: e.target.value })} />
                          ) : d.phase}
                        </td>
                        <td className="py-2 text-[#a3a3a3]">
                          {editMode && editData?.deliverySchedule ? (
                            <input className={inp} type="date" value={editData.deliverySchedule[i]?.dueDate ?? d.dueDate} onChange={(e) => updateDeliveryRow(i, { dueDate: e.target.value })} />
                          ) : (
                            new Date(d.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums text-[#f5f5f5]">
                          {editMode && editData?.deliverySchedule ? (
                            <input className={cn(inp, 'text-right w-20')} type="number" min="0" value={editData.deliverySchedule[i]?.quantity ?? d.quantity} onChange={(e) => updateDeliveryRow(i, { quantity: parseFloat(e.target.value) || 0 })} />
                          ) : (
                            `${d.quantity.toLocaleString('pt-BR')} ${display.unit}`
                          )}
                        </td>
                        <td className="py-2 text-center">
                          {editMode && editData?.deliverySchedule ? (
                            <select className={sel} value={editData.deliverySchedule[i]?.status ?? d.status} onChange={(e) => updateDeliveryRow(i, { status: e.target.value as DeliveryRow['status'] })}>
                              <option value="on_time">No prazo</option>
                              <option value="delayed">Atrasado</option>
                              <option value="delivered">Entregue</option>
                            </select>
                          ) : (
                            <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold',
                              d.status === 'delivered' ? 'bg-[#16a34a]/20 text-[#4ade80]' :
                              d.status === 'delayed'   ? 'bg-[#dc2626]/20 text-[#f87171]' :
                              'bg-[#2563eb]/20 text-[#93c5fd]'
                            )}>
                              {d.status === 'delivered' ? 'Entregue' : d.status === 'delayed' ? 'Atrasado' : 'No prazo'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              ) : (
                editMode && editData ? (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[#6b6b6b] text-[10px] block mb-1">Lead Time (dias)</label>
                        <input className={inp} type="number" min="0" value={editData.leadTimeDays} onChange={(e) => setED('leadTimeDays', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="flex-1">
                        <label className="text-[#6b6b6b] text-[10px] block mb-1">Qtd Máxima</label>
                        <input className={inp} type="number" min="0" value={editData.maxQuantity} onChange={(e) => setED('maxQuantity', parseFloat(e.target.value) || 0)} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[#6b6b6b] text-xs mt-1">
                    Lead time padrão de {display.leadTimeDays} dias úteis.
                    Volume máximo contratado: {display.maxQuantity.toLocaleString('pt-BR')} {display.unit}.
                  </p>
                )
              )}
            </AccordionSection>

            {/* Section 3: Rescisão */}
            <AccordionSection title="Rescisão">
              {editMode && editData ? (
                <textarea
                  className={cn(inp, 'resize-none w-full mt-1')}
                  rows={3}
                  value={editData.terminationClause ?? ''}
                  onChange={(e) => setED('terminationClause', e.target.value)}
                  placeholder="Cláusula de rescisão contratual…"
                />
              ) : (
                <div className="flex items-start gap-2 mt-1">
                  <p className="text-[#a3a3a3] text-xs leading-relaxed flex-1">
                    {display.terminationClause ?? 'Rescisão com aviso prévio mínimo de 30 dias corridos. Em caso de inadimplemento, rescisão imediata com aplicação de multa de 10% sobre o valor restante do contrato.'}
                  </p>
                  <CopyButton text={display.terminationClause ?? 'Rescisão com aviso prévio mínimo de 30 dias corridos.'} />
                </div>
              )}
            </AccordionSection>

            {/* Section 4: Reajuste de Preço */}
            <AccordionSection title="Reajuste de Preço">
              {editMode && editData ? (
                <div className="flex flex-wrap gap-3 mt-1">
                  <div>
                    <label className="text-[#6b6b6b] text-[10px] block mb-1">Índice</label>
                    <select className={sel} value={editData.priceAdjustmentIndex ?? 'INCC'} onChange={(e) => setED('priceAdjustmentIndex', e.target.value as FrameworkAgreement['priceAdjustmentIndex'])}>
                      <option value="IGP-M">IGP-M</option>
                      <option value="INCC">INCC</option>
                      <option value="IPCA">IPCA</option>
                      <option value="Fixo">Fixo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[#6b6b6b] text-[10px] block mb-1">Percentual a.a.</label>
                    <input className={cn(inp, 'w-20')} type="number" min="0" step="0.1" value={editData.priceAdjustmentPct ?? 0} onChange={(e) => setED('priceAdjustmentPct', parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Índice</span>
                    <span className="text-sm font-bold text-[#f97316]">
                      {display.priceAdjustmentIndex ?? (display.terms.includes('IGP-M') ? 'IGP-M' : 'INCC')}
                    </span>
                  </div>
                  {display.priceAdjustmentPct !== undefined && (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Percentual</span>
                      <span className="text-sm font-bold text-[#f5f5f5]">{display.priceAdjustmentPct.toFixed(1)}% a.a.</span>
                    </div>
                  )}
                  <p className="text-xs text-[#6b6b6b] flex-1">
                    {display.priceAdjustmentIndex === 'Fixo'
                      ? 'Preço fixo durante toda a vigência do contrato.'
                      : 'Reajuste conforme índice definido, aplicado semestralmente.'}
                  </p>
                </div>
              )}
            </AccordionSection>

            {/* Full document link */}
            <div className="bg-[#2c2c2c] border border-dashed border-[#525252] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[#6b6b6b] text-xs font-medium">Documento Completo</p>
                <p className="text-[#3f3f3f] text-[10px] mt-0.5">
                  {display.code}-contrato-marco.pdf
                </p>
              </div>
              <button
                className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#f97316] transition-colors border border-[#525252] hover:border-[#f97316]/40 rounded-lg px-3 py-1.5"
                onClick={() => undefined}
              >
                <ExternalLink size={12} />
                Abrir ↗
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-[#6b6b6b] min-h-[200px]">
            <span className="text-4xl">📄</span>
            <p className="text-sm font-medium text-[#6b6b6b]">Selecione um Acordo Marco</p>
            <p className="text-xs max-w-xs">
              Clique em um contrato à esquerda para ver o resumo Contrato 360
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
