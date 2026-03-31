import { Wrench, Clock, Pencil, Check, X } from 'lucide-react'
import { useState } from 'react'
import { formatCurrency, formatHours } from '@/lib/utils'
import { useCurrentReport } from '@/hooks/useRelatorio360'
import { useRelatorio360Store } from '@/store/relatorio360Store'

export function EquipmentPanel() {
  const report = useCurrentReport()
  const logs   = report?.equipmentLogs ?? []
  const updateEquipmentLog = useRelatorio360Store((s) => s.updateEquipmentLog)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState(0)

  function startEdit(logId: string, hours: number) {
    setEditingId(logId)
    setEditHours(hours)
  }

  function saveEdit(logId: string) {
    updateEquipmentLog(logId, { utilizationHours: editHours })
    setEditingId(null)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3] flex items-center gap-2">
          <Wrench size={13} />
          Equipamentos Utilizados
        </h2>
        <span className="text-xs font-mono text-[#6b6b6b]">{logs.length} itens</span>
      </div>

      <div className="rounded-xl border border-[#20406a] bg-[#14294e] overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#6b6b6b]">Nenhum equipamento registrado</div>
        ) : (
          <div className="divide-y divide-[#20406a]">
            <div className="grid grid-cols-5 px-4 py-2 text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold">
              <span>ID / Tipo</span>
              <span>Atividade</span>
              <span className="text-right">Horas</span>
              <span className="text-right">Custo</span>
              <span />
            </div>
            {logs.map((log) => {
              const activity = report?.activities.find((a) => a.id === log.activityId)
              const isEditing = editingId === log.id
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-5 px-4 py-3 text-sm items-center hover:bg-[#1a3662] transition-colors"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-xs text-[#2abfdc] font-semibold">{log.equipmentId}</span>
                    <span className="text-[#e4f2f8] text-xs font-medium">{log.type}</span>
                  </div>
                  <span className="text-[#a3a3a3] text-xs truncate pr-2">{activity?.name ?? '—'}</span>
                  <div className="flex items-center justify-end gap-1 text-xs text-[#a3a3a3]">
                    {isEditing ? (
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={editHours}
                        onChange={(e) => setEditHours(Math.max(0, Number(e.target.value)))}
                        className="w-16 bg-[#0d2040] border border-[#2abfdc]/60 rounded px-1.5 py-0.5 text-xs text-[#e4f2f8] text-center focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <>
                        <Clock size={11} />
                        <span className="font-mono">{formatHours(log.utilizationHours)}</span>
                      </>
                    )}
                  </div>
                  <span className="text-right font-mono text-xs text-[#2abfdc] font-semibold">
                    {formatCurrency((isEditing ? editHours : log.utilizationHours) * log.hourlyRate)}
                  </span>
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
                        onClick={() => startEdit(log.id, log.utilizationHours)}
                        className="text-[#5a8caa] hover:text-[#2abfdc] transition-colors"
                        title="Editar horas"
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
