import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgendaStore } from '@/store/agendaStore'
import { useProjetosStore } from '@/store/projetosStore'
import { taskSchema, type TaskFormValues } from '../schemas'
import type { TaskColor, AgendaPriority } from '@/types'

const COLOR_OPTIONS: { value: TaskColor; bg: string; border: string; label: string }[] = [
  { value: 'blue',   bg: '#3b82f6', border: '#2563eb', label: 'Azul'     },
  { value: 'orange', bg: '#2abfdc', border: '#ea580c', label: 'Laranja'  },
  { value: 'green',  bg: '#22c55e', border: '#16a34a', label: 'Verde'    },
  { value: 'red',    bg: '#ef4444', border: '#dc2626', label: 'Vermelho' },
  { value: 'purple', bg: '#a855f7', border: '#9333ea', label: 'Roxo'     },
]

const STATUS_OPTIONS = [
  { value: 'scheduled',   label: 'Agendado'     },
  { value: 'unscheduled', label: 'Não agendado' },
  { value: 'completed',   label: 'Concluído'    },
] as const

const PRIORITY_OPTIONS: { value: AgendaPriority; label: string; color: string }[] = [
  { value: 'low',      label: 'Baixa',   color: '#6b6b6b' },
  { value: 'medium',   label: 'Média',   color: '#3b82f6' },
  { value: 'high',     label: 'Alta',    color: '#f97316' },
  { value: 'critical', label: 'Crítica', color: '#ef4444' },
]

export function TaskEditDialog() {
  const { editingTaskId, tasks, resources, addTask, updateTask, deleteTask, setEditingTask } =
    useAgendaStore()
  const projects = useProjetosStore((s) => s.projects)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNew        = editingTaskId === 'new'
  const existingTask = isNew ? null : tasks.find((t) => t.id === editingTaskId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '', resourceId: resources[0]?.id ?? '',
      startDate: '', endDate: '',
      color: 'blue', status: 'scheduled', priority: 'medium',
      assignedTo: '', teamLeadName: '', location: '',
      estimatedHours: undefined, completionPct: undefined,
      linkedProjectId: '', notes: '',
    },
  })

  useEffect(() => {
    if (existingTask) {
      reset({
        title:           existingTask.title,
        resourceId:      existingTask.resourceId,
        startDate:       existingTask.startDate,
        endDate:         existingTask.endDate,
        color:           existingTask.color,
        status:          existingTask.status,
        priority:        existingTask.priority,
        assignedTo:      existingTask.assignedTo     ?? '',
        teamLeadName:    existingTask.teamLeadName   ?? '',
        location:        existingTask.location       ?? '',
        estimatedHours:  existingTask.estimatedHours,
        completionPct:   existingTask.completionPct,
        linkedProjectId: existingTask.linkedProjectId ?? '',
        notes:           existingTask.notes          ?? '',
      })
    } else if (isNew) {
      reset({
        title: '', resourceId: resources[0]?.id ?? '',
        startDate: '', endDate: '',
        color: 'blue', status: 'scheduled', priority: 'medium',
        assignedTo: '', teamLeadName: '', location: '',
        estimatedHours: undefined, completionPct: undefined,
        linkedProjectId: '', notes: '',
      })
    }
    setConfirmDelete(false)
  }, [editingTaskId, isNew, existingTask, resources, reset])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() {
    setEditingTask(null)
    setConfirmDelete(false)
  }

  function onSubmit(values: TaskFormValues) {
    const payload = {
      ...values,
      assignedTo:      values.assignedTo      || undefined,
      teamLeadName:    values.teamLeadName     || undefined,
      location:        values.location         || undefined,
      linkedProjectId: values.linkedProjectId  || undefined,
      notes:           values.notes            || undefined,
    }
    if (isNew) {
      addTask(payload)
    } else if (existingTask) {
      updateTask(existingTask.id, payload)
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (existingTask) deleteTask(existingTask.id)
    close()
  }

  const watchedColor    = watch('color')
  const watchedPriority = watch('priority')
  const priorityCfg     = PRIORITY_OPTIONS.find((p) => p.value === watchedPriority)

  if (!editingTaskId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#20406a] bg-[#112645] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20406a]">
          <h2 className="text-[#f5f5f5] font-bold text-base flex items-center gap-2">
            {isNew ? 'Nova Tarefa' : 'Editar Tarefa'}
            {priorityCfg && !isNew && (
              <span
                className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest"
                style={{ background: `${priorityCfg.color}20`, color: priorityCfg.color }}
              >
                {priorityCfg.label}
              </span>
            )}
          </h2>
          <button
            onClick={close}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#1a3662] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-4 px-6 py-5 max-h-[72vh] overflow-y-auto">

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Título <span className="text-[#ef4444]">*</span></label>
              <input
                {...register('title')}
                placeholder="Ex: Escavação Fase 1"
                className={fieldCls(!!errors.title)}
              />
              {errors.title && <span className={ERR}>{errors.title.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Recurso <span className="text-[#ef4444]">*</span></label>
                <select {...register('resourceId')} className={fieldCls(!!errors.resourceId)}>
                  <option value="">Selecione um recurso</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
                  ))}
                </select>
                {errors.resourceId && <span className={ERR}>{errors.resourceId.message}</span>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Prioridade <span className="text-[#ef4444]">*</span></label>
                <select
                  {...register('priority')}
                  className={fieldCls(!!errors.priority)}
                  style={{ color: priorityCfg?.color ?? '#f5f5f5' }}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p.value} value={p.value} style={{ color: p.color }}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Data Início <span className="text-[#ef4444]">*</span></label>
                <input type="date" {...register('startDate')} className={fieldCls(!!errors.startDate)} />
                {errors.startDate && <span className={ERR}>{errors.startDate.message}</span>}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Data Fim <span className="text-[#ef4444]">*</span></label>
                <input type="date" {...register('endDate')} className={fieldCls(!!errors.endDate)} />
                {errors.endDate && <span className={ERR}>{errors.endDate.message}</span>}
              </div>
            </div>

            {/* Status + Color */}
            <div className="grid grid-cols-2 gap-3 items-start">
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>Status</label>
                <select {...register('status')} className={fieldCls(false)}>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className={LABEL}>Cor</label>
                <div className="flex items-center gap-2 mt-1">
                  {COLOR_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setValue('color', opt.value)}
                      title={opt.label}
                      className="transition-transform hover:scale-110"
                      style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: opt.bg,
                        border: watchedColor === opt.value ? `3px solid ${opt.border}` : '2px solid transparent',
                        outline: watchedColor === opt.value ? `2px solid ${opt.bg}` : 'none',
                        outlineOffset: 2,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* ── Detalhes ── */}
            <fieldset className="border-t border-[#20406a] pt-3">
              <legend className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-3 px-1">
                Detalhes
              </legend>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>Responsável</label>
                  <input
                    {...register('assignedTo')}
                    placeholder="Nome do responsável"
                    className={fieldCls(false)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>Encarregado</label>
                  <input
                    {...register('teamLeadName')}
                    placeholder="Nome do encarregado"
                    className={fieldCls(false)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-3">
                <label className={LABEL}>Localização</label>
                <input
                  {...register('location')}
                  placeholder="Ex: Bloco A – Fundação"
                  className={fieldCls(false)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>Horas Estimadas</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    {...register('estimatedHours', { valueAsNumber: true })}
                    placeholder="0"
                    className={fieldCls(false)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={LABEL}>% de Conclusão</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    {...register('completionPct', { valueAsNumber: true })}
                    placeholder="0"
                    className={fieldCls(false)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 mt-3">
                <label className={LABEL}>Projeto Vinculado</label>
                <select {...register('linkedProjectId')} className={fieldCls(false)}>
                  <option value="">— Nenhum —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>
            </fieldset>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>Observações</label>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Informações adicionais..."
                className="bg-[#0d2040] border border-[#20406a] rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none focus:border-[#2abfdc] transition-colors resize-none placeholder:text-[#3f3f3f]"
              />
              {errors.notes && <span className={ERR}>{errors.notes.message}</span>}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#20406a]">
            {!isNew ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-[#ef4444]" />
                  <span className="text-xs text-[#ef4444]">Confirmar exclusão?</span>
                  <button
                    type="button" onClick={handleDelete}
                    className="text-xs px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 font-semibold"
                  >
                    Sim
                  </button>
                  <button
                    type="button" onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 rounded bg-[#1a3662] text-[#a3a3a3] hover:bg-[#20406a]"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button" onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#ef4444] transition-colors"
                >
                  <Trash2 size={13} />
                  Excluir
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button" onClick={close}
                className="px-4 py-2 rounded-lg border border-[#20406a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] disabled:opacity-50 transition-colors"
              >
                {isNew ? 'Criar Tarefa' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────
const LABEL = 'text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold'
const ERR   = 'text-[11px] text-[#ef4444]'
function fieldCls(hasError: boolean) {
  return cn(
    'w-full bg-[#0d2040] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError ? 'border-[#ef4444]' : 'border-[#20406a] focus:border-[#2abfdc]'
  )
}
