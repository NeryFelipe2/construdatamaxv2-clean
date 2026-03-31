import { Package, Pencil, Check, X } from 'lucide-react'
import { useState } from 'react'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import { useRelatorio360Store } from '@/store/relatorio360Store'

export function MaterialsPanel() {
  const report = useCurrentReport()
  const logs   = report?.materialLogs ?? []
  const updateMaterialLog = useRelatorio360Store((s) => s.updateMaterialLog)

  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState(0)

  function startEdit(logId: string, qty: number) {
    setEditingId(logId)
    setEditQuantity(qty)
  }

  function saveEdit(logId: string) {
    updateMaterialLog(logId, { quantity: editQuantity })
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Package size={13} />
          Materiais Utilizados
        </h2>
        <span className="text-xs font-mono text-[#6b6b6b]">{logs.length} itens</span>
      </div>

      <div className="rounded-xl border border-[#20406a] bg-[#14294e] overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#6b6b6b]">Nenhum material registrado</div>
        ) : (
          <div className="divide-y divide-[#20406a]">
            <div className="grid grid-cols-5 px-4 py-2 text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
              <span>ID</span>
              <span>Atividade</span>
              <span className="text-right">Quantidade</span>
              <span className="text-right">Unidade</span>
              <span />
            </div>
            {logs.map((log) => {
              const activity  = report?.activities.find((a) => a.id === log.activityId)
              const isEditing = editingId === log.id
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-5 px-4 py-3 text-sm items-center hover:bg-[#1a3662] transition-colors"
                >
                  <span className="font-mono text-xs text-[#2abfdc] font-semibold">{log.materialId}</span>
                  <span className="text-[#a3a3a3] text-xs truncate pr-2">{activity?.name ?? '—'}</span>
                  <div className="flex items-center justify-end">
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(Math.max(0, Number(e.target.value)))}
                        className="w-20 bg-[#0d2040] border border-[#2abfdc]/60 rounded px-1.5 py-0.5 text-xs text-[#e4f2f8] text-center focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <span className="font-mono text-[#e4f2f8] text-sm font-semibold">
                        {log.quantity.toLocaleString('pt-BR')}
                      </span>
                    )}
                  </div>
                  <span className="text-right font-mono text-xs text-[#a3a3a3] uppercase">{log.unit}</span>
                  <div className="flex items-center justify-end gap-1">
                    {isEditing ? (
                      <>
                        <button onClick={() => saveEdit(log.id)} className="text-[#22c55e] hover:text-[#22c55e]/80 transition-colors" title="Salvar">
                          <Check size={13} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-[#6b6b6b] hover:text-[#e4f2f8] transition-colors" title="Cancelar">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(log.id, log.quantity)}
                        className="text-[#5a8caa] hover:text-[#2abfdc] transition-colors"
                        title="Editar quantidade"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
