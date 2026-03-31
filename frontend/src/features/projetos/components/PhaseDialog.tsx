import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import { phaseSchema, type PhaseFormValues } from '../schemas'
import type { ProjectPhaseStatus } from '@/types'

const STATUS_OPTIONS: Array<{ value: ProjectPhaseStatus; label: string }> = [
  { value: 'not_started', label: 'Não Iniciado' },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'completed',   label: 'Concluído' },
  { value: 'delayed',     label: 'Atrasado' },
]

export function PhaseDialog() {
  const projects        = useProjetosStore((s) => s.projects)
  const editingPhase    = useProjetosStore((s) => s.editingPhase)
  const setEditingPhase = useProjetosStore((s) => s.setEditingPhase)
  const updatePhase     = useProjetosStore((s) => s.updatePhase)

  const project = editingPhase
    ? projects.find((p) => p.id === editingPhase.projectId) ?? null
    : null

  const phases = project
    ? editingPhase!.group === 'planning'
      ? project.planningPhases
      : project.executionPhases
    : []

  const phase = editingPhase ? phases.find((ph) => ph.id === editingPhase.phaseId) ?? null : null

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<PhaseFormValues>({
    resolver: zodResolver(phaseSchema),
    defaultValues: { status: 'not_started', progress: 0, startDate: '', endDate: '', notes: '' },
  })

  const progressValue = watch('progress')

  useEffect(() => {
    if (phase) {
      reset({
        status:    phase.status,
        progress:  phase.progress,
        startDate: phase.startDate,
        endDate:   phase.endDate,
        notes:     phase.notes ?? '',
      })
    }
  }, [editingPhase, phase, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() { setEditingPhase(null) }

  function onSubmit(values: PhaseFormValues) {
    if (!editingPhase) return
    updatePhase(editingPhase.projectId, editingPhase.group, editingPhase.phaseId, {
      ...values,
      notes: values.notes ?? undefined,
    })
    close()
  }

  if (!editingPhase || !phase) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#20406a] bg-[#112645] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20406a]">
          <div>
            <h2 className="text-[#f5f5f5] font-bold text-sm">Editar Fase</h2>
            <p className="text-[11px] text-[#6b6b6b] mt-0.5">{phase.name}</p>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#1a3662] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Status */}
            <Field label="Status *" error={errors.status?.message}>
              <select {...register('status')} className={inp(!!errors.status)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {/* Progress */}
            <Field label={`Progresso — ${progressValue ?? 0}%`} error={errors.progress?.message}>
              <div className="flex flex-col gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  {...register('progress', { valueAsNumber: true })}
                  className="w-full accent-[#2abfdc] cursor-pointer"
                />
                <div className="h-2 rounded-full bg-[#1a3662] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#2abfdc] transition-all"
                    style={{ width: `${progressValue ?? 0}%` }}
                  />
                </div>
              </div>
            </Field>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data de Início *" error={errors.startDate?.message}>
                <input type="date" {...register('startDate')} className={inp(!!errors.startDate)} />
              </Field>
              <Field label="Data de Término *" error={errors.endDate?.message}>
                <input type="date" {...register('endDate')} className={inp(!!errors.endDate)} />
              </Field>
            </div>

            {/* Notes */}
            <Field label="Observações" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Notas sobre o andamento desta fase"
                className={cn(inp(!!errors.notes), 'resize-none')}
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#20406a]">
            <button
              type="button"
              onClick={close}
              className="px-4 py-2 rounded-lg border border-[#20406a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors"
            >
              Salvar Fase
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inp(hasError: boolean) {
  return cn(
    'w-full bg-[#0d2040] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError
      ? 'border-[#ef4444] focus:border-[#ef4444]'
      : 'border-[#20406a] focus:border-[#2abfdc]'
  )
}

function Field({ label, error, children }: { label: React.ReactNode; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">{label}</label>
      {children}
      {error && <span className="text-[11px] text-[#ef4444]">{error}</span>}
    </div>
  )
}
