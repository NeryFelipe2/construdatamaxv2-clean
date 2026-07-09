import { useState } from 'react'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { timecardSchema, type TimecardFormData } from '../../schemas'

interface Props {
  onClose: () => void
}

const emptyForm: TimecardFormData = {
  workerId:            '',
  date:                new Date().toISOString().slice(0, 10),
  hoursWorked:         8,
  projectRef:          'PRJ-001',
  phaseRef:            'Construção',
  activityDescription: '',
  reportedQty:         0,
  unit:                'm²',
  notes:               '',
}

const UNITS = ['m²', 'm³', 'kg', 'un', 'm', 'serv']

export function TimecardDialog({ onClose }: Props) {
  const { workers, addTimecard } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, addTimecard: s.addTimecard }))
  )
  const [form, setForm]     = useState<TimecardFormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof TimecardFormData, string>>>({})

  function handleField<K extends keyof TimecardFormData>(key: K, val: TimecardFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = timecardSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof TimecardFormData, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof TimecardFormData
        if (key) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    addTimecard(parsed.data)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#333333] border border-[#525252] rounded-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[#f5f5f5] text-base font-semibold">Novo Apontamento</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Worker */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Funcionário *</span>
            <select
              value={form.workerId}
              onChange={(e) => handleField('workerId', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            >
              <option value="">Selecionar...</option>
              {workers
                .filter((w) => w.status === 'active')
                .map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
            </select>
            {errors.workerId && <span className="text-[#ef4444] text-xs">{errors.workerId}</span>}
          </label>

          {/* Date + HH row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[#6b6b6b] text-xs font-medium">Data *</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => handleField('date', e.target.value)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              />
              {errors.date && <span className="text-[#ef4444] text-xs">{errors.date}</span>}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[#6b6b6b] text-xs font-medium">Horas trabalhadas *</span>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={form.hoursWorked}
                onChange={(e) => handleField('hoursWorked', parseFloat(e.target.value) || 0)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              />
              {errors.hoursWorked && <span className="text-[#ef4444] text-xs">{errors.hoursWorked}</span>}
            </label>
          </div>

          {/* Activity */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Atividade *</span>
            <input
              type="text"
              maxLength={200}
              value={form.activityDescription}
              onChange={(e) => handleField('activityDescription', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              placeholder="Ex: Elevação de alvenaria bloco A"
            />
            {errors.activityDescription && (
              <span className="text-[#ef4444] text-xs">{errors.activityDescription}</span>
            )}
          </label>

          {/* Qty + Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[#6b6b6b] text-xs font-medium">Quantidade produzida</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={form.reportedQty}
                onChange={(e) => handleField('reportedQty', parseFloat(e.target.value) || 0)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[#6b6b6b] text-xs font-medium">Unidade</span>
              <select
                value={form.unit}
                onChange={(e) => handleField('unit', e.target.value)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              >
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>

          {/* Notes */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Observações</span>
            <textarea
              maxLength={500}
              rows={2}
              value={form.notes}
              onChange={(e) => handleField('notes', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316] resize-none"
              placeholder="Opcional..."
            />
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#1f3c5e] text-[#f5f5f5] text-sm hover:bg-[#484848] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6c0a] text-white text-sm font-semibold transition-colors"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
