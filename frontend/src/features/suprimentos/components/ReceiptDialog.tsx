import { useState } from 'react'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'
import type { PurchaseOrder, GoodsReceiptItem } from '@/types'

interface Props {
  po: PurchaseOrder
  onClose: () => void
}

export function ReceiptDialog({ po, onClose }: Props) {
  const { addReceipt } = useSuprimentosStore(useShallow((s) => ({ addReceipt: s.addReceipt })))

  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [receivedBy,   setReceivedBy]   = useState('')
  const [rcItems, setRcItems] = useState<GoodsReceiptItem[]>(
    po.items.map((i) => ({ poItemId: i.id, receivedQty: i.quantity, unit: i.unit }))
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!receivedBy.trim()) return
    addReceipt({
      id:          `rc-${Date.now()}`,
      poId:        po.id,
      code:        `RC-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`,
      receivedDate,
      receivedBy,
      items:       rcItems,
    })
    onClose()
  }

  const inputCls = 'w-full bg-[#333333] border border-[#1f3c5e] rounded px-3 py-1.5 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316]'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl w-full max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#525252]">
          <div>
            <h2 className="text-[#f5f5f5] font-semibold">Registrar Recebimento</h2>
            <p className="text-[#6b6b6b] text-xs mt-0.5">{po.code} — {po.supplier}</p>
          </div>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[#a3a3a3] text-xs">Data de Recebimento</label>
              <input type="date" className={inputCls} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[#a3a3a3] text-xs">Recebido por</label>
              <input className={inputCls} value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} placeholder="Nome do responsável" required />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[#f5f5f5] text-sm font-semibold">Quantidades Recebidas</p>
            <div className="bg-[#333333] border border-[#525252] rounded-lg overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#484848]">
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2">Item</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-20">Pedido</th>
                    <th className="text-right text-[#6b6b6b] font-medium px-3 py-2 w-24">Recebido</th>
                    <th className="text-left text-[#6b6b6b] font-medium px-3 py-2 w-10">Un</th>
                  </tr>
                </thead>
                <tbody>
                  {po.items.map((poItem, idx) => {
                    const rcItem = rcItems[idx]
                    return (
                      <tr key={poItem.id} className="border-t border-[#525252]">
                        <td className="px-3 py-2 text-[#f5f5f5]">{poItem.description}</td>
                        <td className="px-3 py-2 text-right text-[#6b6b6b] tabular-nums">{poItem.quantity.toLocaleString('pt-BR')}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className="w-full bg-transparent border border-[#1f3c5e] rounded px-2 py-1 text-[#f5f5f5] text-right focus:outline-none focus:border-[#f97316]"
                            value={rcItem?.receivedQty ?? poItem.quantity}
                            onChange={(e) =>
                              setRcItems((prev) =>
                                prev.map((it) =>
                                  it.poItemId === poItem.id
                                    ? { ...it, receivedQty: parseFloat(e.target.value) || 0 }
                                    : it
                                )
                              )
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-[#a3a3a3]">{poItem.unit}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[#1f3c5e] text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#555] transition-colors">
              Cancelar
            </button>
            <button type="submit"
              className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[#f97316] hover:bg-[#ea6c0a] text-white transition-colors">
              Registrar Recebimento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
