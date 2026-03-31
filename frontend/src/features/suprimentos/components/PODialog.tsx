import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { PurchaseOrder, POItem } from '@/types'

interface Props {
  po?: PurchaseOrder
  onClose: () => void
}

function emptyItem(): POItem {
  return {
    id:          `poi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    description: '',
    quantity:    1,
    unit:        'un',
    unitPrice:   0,
    totalPrice:  0,
  }
}

export function PODialog({ po, onClose }: Props) {
  const { addPO, updatePO } = useSuprimentosStore((s) => ({
    addPO:    s.addPO,
    updatePO: s.updatePO,
  }))

  const [form, setForm] = useState({
    code:             po?.code             ?? `OC-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
    supplier:         po?.supplier         ?? '',
    responsible:      po?.responsible      ?? '',
    issuedDate:       po?.issuedDate       ?? new Date().toISOString().slice(0, 10),
    expectedDelivery: po?.expectedDelivery ?? '',
    projectRef:       po?.projectRef       ?? '',
  })
  const [items, setItems] = useState<POItem[]>(po?.items ?? [emptyItem()])

  function setItemField(id: string, field: keyof POItem, raw: string) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const updated = { ...it, [field]: field === 'quantity' || field === 'unitPrice' ? parseFloat(raw) || 0 : raw }
        updated.totalPrice = updated.quantity * updated.unitPrice
        return updated
      })
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const totalItems = items.filter((i) => i.description.trim())
    if (!form.supplier || !form.responsible || totalItems.length === 0) return

    if (po) {
      updatePO(po.id, { ...form, items: totalItems })
    } else {
      addPO({
        id:     `po-${Date.now()}`,
        status: 'open',
        items:  totalItems,
        ...form,
      })
    }
    onClose()
  }

  const inputCls = 'w-full bg-[#112645] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#2abfdc]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1e1e1e] border border-[#20406a] rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#20406a]">
          <h2 className="text-[#f5f5f5] font-semibold">{po ? 'Editar Ordem de Compra' : 'Nova Ordem de Compra'}</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
            {/* Fields grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[#a3a3a3] text-xs">Código OC</label>
                <input className={inputCls} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#a3a3a3] text-xs">Fornecedor</label>
                <input className={inputCls} value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#a3a3a3] text-xs">Responsável</label>
                <input className={inputCls} value={form.responsible} onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#a3a3a3] text-xs">Projeto</label>
                <input className={inputCls} value={form.projectRef} onChange={(e) => setForm((f) => ({ ...f, projectRef: e.target.value }))} placeholder="Ex: PRJ-001" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#a3a3a3] text-xs">Data de Emissão</label>
                <input type="date" className={inputCls} value={form.issuedDate} onChange={(e) => setForm((f) => ({ ...f, issuedDate: e.target.value }))} required />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[#a3a3a3] text-xs">Prazo de Entrega</label>
                <input type="date" className={inputCls} value={form.expectedDelivery} onChange={(e) => setForm((f) => ({ ...f, expectedDelivery: e.target.value }))} required />
              </div>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[#f5f5f5] text-sm font-semibold">Itens</p>
                <button
                  type="button"
                  onClick={() => setItems((prev) => [...prev, emptyItem()])}
                  className="flex items-center gap-1 px-3 py-1 rounded bg-[#2abfdc] hover:bg-[#ea6c0a] text-white text-xs font-semibold transition-colors"
                >
                  <Plus size={12} /> Adicionar Item
                </button>
              </div>
              <div className="bg-[#112645] border border-[#20406a] rounded-lg overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#1a3662]">
                      <th className="text-left text-[#6b6b6b] font-medium px-3 py-2">Descrição</th>
                      <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-20">Qtd</th>
                      <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-16">Un</th>
                      <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-24">Preço Unit.</th>
                      <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-24">Total</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-[#20406a]">
                        <td className="px-2 py-1.5">
                          <input className="w-full bg-transparent border border-[#1f3c5e] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-[#2abfdc]"
                            value={item.description}
                            onChange={(e) => setItemField(item.id, 'description', e.target.value)}
                            required placeholder="Descrição do item" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min={0} step={0.01}
                            className="w-full bg-transparent border border-[#1f3c5e] rounded px-2 py-1 text-[#f5f5f5] text-right focus:outline-none focus:border-[#2abfdc]"
                            value={item.quantity}
                            onChange={(e) => setItemField(item.id, 'quantity', e.target.value)} />
                        </td>
                        <td className="px-2 py-1.5">
                          <input className="w-full bg-transparent border border-[#1f3c5e] rounded px-2 py-1 text-[#f5f5f5] focus:outline-none focus:border-[#2abfdc]"
                            value={item.unit}
                            onChange={(e) => setItemField(item.id, 'unit', e.target.value)} placeholder="un" />
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" min={0} step={0.01}
                            className="w-full bg-transparent border border-[#1f3c5e] rounded px-2 py-1 text-[#f5f5f5] text-right focus:outline-none focus:border-[#2abfdc]"
                            value={item.unitPrice}
                            onChange={(e) => setItemField(item.id, 'unitPrice', e.target.value)} />
                        </td>
                        <td className="px-3 py-1.5 text-right text-[#f5f5f5] tabular-nums">
                          {item.totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button type="button" onClick={() => setItems((p) => p.filter((i) => i.id !== item.id))}
                            className="text-[#6b6b6b] hover:text-[#ef4444] transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-5 py-4 border-t border-[#20406a]">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#2abfdc] hover:bg-[#ea6c0a] text-white transition-colors">
              {po ? 'Salvar Alterações' : 'Criar Ordem de Compra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
