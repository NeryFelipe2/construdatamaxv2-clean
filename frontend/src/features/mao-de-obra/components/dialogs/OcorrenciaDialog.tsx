import { useState } from 'react'
import { X } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { occurrenceSchema, type OccurrenceFormData } from '../../schemas'

interface Props {
  onClose: () => void
}

const TYPE_OPTIONS: Array<{ value: import('@/types').OccurrenceType; label: string }> = [
  { value: 'weather',           label: 'Clima adverso' },
  { value: 'material_delay',    label: 'Atraso de material' },
  { value: 'equipment_failure', label: 'Falha de equipamento' },
  { value: 'holiday',           label: 'Feriado / paralisação' },
  { value: 'accident',          label: 'Acidente' },
  { value: 'other',             label: 'Outro' },
]

const emptyForm: OccurrenceFormData = {
  date:            new Date().toISOString().slice(0, 10),
  type:            'other',
  description:     '',
  impactHours:     0,
  affectedCrewIds: [],
}

export function OcorrenciaDialog({ onClose }: Props) {
  const { crews, addOccurrence } = useMaoDeObraStore((s) => ({ crews: s.crews, addOccurrence: s.addOccurrence }))
  const [form, setForm]     = useState<OccurrenceFormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof OccurrenceFormData, string>>>({})

  function handleField<K extends keyof OccurrenceFormData>(key: K, val: OccurrenceFormData[K]) {
    setForm((f) => ({ ...f, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  function toggleCrew(crewId: string) {
    setForm((f) => ({
      ...f,
      affectedCrewIds: f.affectedCrewIds.includes(crewId)
        ? f.affectedCrewIds.filter((id) => id !== crewId)
        : [...f.affectedCrewIds, crewId],
    }))
    setErrors((e) => ({ ...e, affectedCrewIds: undefined }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = occurrenceSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof OccurrenceFormData, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof OccurrenceFormData
        if (key) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    addOccurrence(parsed.data)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#333333] border border-[#525252] rounded-xl w-full max-w-md p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[#f5f5f5] text-base font-semibold">Registrar Ocorrência</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Date + Type row */}
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
              <span className="text-[#6b6b6b] text-xs font-medium">Tipo *</span>
              <select
                value={form.type}
                onChange={(e) => handleField('type', e.target.value as import('@/types').OccurrenceType)}
                className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {/* Description */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Descrição *</span>
            <textarea
              maxLength={500}
              rows={3}
              value={form.description}
              onChange={(e) => handleField('description', e.target.value)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316] resize-none"
              placeholder="Descreva a ocorrência e seu impacto..."
            />
            {errors.description && <span className="text-[#ef4444] text-xs">{errors.description}</span>}
          </label>

          {/* Impact hours */}
          <label className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Horas impactadas *</span>
            <input
              type="number"
              min={0}
              max={999}
              step={1}
              value={form.impactHours}
              onChange={(e) => handleField('impactHours', parseFloat(e.target.value) || 0)}
              className="bg-[#3d3d3d] border border-[#1f3c5e] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] focus:outline-none focus:border-[#f97316]"
            />
            {errors.impactHours && <span className="text-[#ef4444] text-xs">{errors.impactHours}</span>}
          </label>

          {/* Affected crews */}
          <div className="flex flex-col gap-1">
            <span className="text-[#6b6b6b] text-xs font-medium">Equipes afetadas *</span>
            <div className="flex flex-col gap-1.5">
              {crews.map((crew) => (
                <label key={crew.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.affectedCrewIds.includes(crew.id)}
                    onChange={() => toggleCrew(crew.id)}
                    className="rounded border-[#1f3c5e] bg-[#3d3d3d] accent-[#f97316]"
                  />
                  <span className="text-[#f5f5f5] text-sm">{crew.name}</span>
                </label>
              ))}
            </div>
            {errors.affectedCrewIds && (
              <span className="text-[#ef4444] text-xs">{errors.affectedCrewIds}</span>
            )}
          </div>

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
              Registrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
