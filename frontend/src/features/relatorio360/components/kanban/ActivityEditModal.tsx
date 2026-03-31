import { useState } from 'react'
import { X } from 'lucide-react'
import type { Activity, ActivityStatus, Crew } from '@/types'

interface ActivityEditModalProps {
  activity: Activity
  crews: Crew[]
  onClose: () => void
  onSave: (patch: Partial<Omit<Activity, 'id'>>) => void
}

export function ActivityEditModal({ activity, crews, onClose, onSave }: ActivityEditModalProps) {
  const [name, setName]               = useState(activity.name)
  const [plannedQty, setPlannedQty]   = useState(activity.plannedQty)
  const [actualQty, setActualQty]     = useState(activity.actualQty)
  const [unit, setUnit]               = useState(activity.unit)
  const [crewId, setCrewId]           = useState(activity.crewId)
  const [status, setStatus]           = useState<ActivityStatus>(activity.status)

  const isValid = name.trim().length > 0 && plannedQty >= 0 && actualQty >= 0

  function handleSave() {
    if (!isValid) return
    onSave({ name: name.trim(), plannedQty, actualQty, unit: unit.trim(), crewId, status })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-lg bg-[#14294e] border border-[#20406a] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#20406a]">
          <h3 className="text-[#e4f2f8] font-semibold text-sm">Editar Atividade</h3>
          <button onClick={onClose} className="text-[#5a8caa] hover:text-[#e4f2f8] transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#8fb3c8] text-xs font-medium">Nome da Atividade *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60 transition-colors"
              placeholder="Nome da atividade"
            />
          </div>

          {/* Qtd row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[#8fb3c8] text-xs font-medium">Qtd Planejada</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={plannedQty}
                onChange={(e) => setPlannedQty(Math.max(0, Number(e.target.value)))}
                className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[#8fb3c8] text-xs font-medium">Qtd Realizada</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={actualQty}
                onChange={(e) => setActualQty(Math.max(0, Number(e.target.value)))}
                className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2 text-[#2abfdc] text-sm focus:outline-none focus:border-[#2abfdc]/60 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[#8fb3c8] text-xs font-medium">Unidade</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60 transition-colors"
                placeholder="m², kg…"
              />
            </div>
          </div>

          {/* Crew */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#8fb3c8] text-xs font-medium">Equipe Responsável</label>
            <select
              value={crewId}
              onChange={(e) => setCrewId(e.target.value)}
              className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60 transition-colors"
            >
              <option value="">— Sem equipe —</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.foremanName} ({c.crewType})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[#8fb3c8] text-xs font-medium">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ActivityStatus)}
              className="bg-[#112645] border border-[#20406a] rounded-lg px-3 py-2 text-[#e4f2f8] text-sm focus:outline-none focus:border-[#2abfdc]/60 transition-colors"
            >
              <option value="planned">Planejado</option>
              <option value="in_progress">Em Andamento</option>
              <option value="completed">Concluído</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-[#20406a]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#20406a] text-[#8fb3c8] text-sm hover:border-[#5a8caa] transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="px-4 py-2 rounded-lg bg-[#2abfdc]/20 border border-[#2abfdc]/50 text-[#2abfdc] text-sm font-semibold hover:bg-[#2abfdc]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
