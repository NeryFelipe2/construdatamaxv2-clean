import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import { riskSchema, type RiskFormValues } from '../schemas'
import type { RiskLevel, RiskStatus } from '@/types'

const LEVEL_OPTIONS: Array<{ value: RiskLevel; label: string; color: string }> = [
  { value: 'critical', label: 'Crítico',  color: '#ef4444' },
  { value: 'high',     label: 'Alto',     color: '#f97316' },
  { value: 'medium',   label: 'Médio',    color: '#eab308' },
  { value: 'low',      label: 'Baixo',    color: '#22c55e' },
]

const STATUS_OPTIONS: Array<{ value: RiskStatus; label: string }> = [
  { value: 'identified', label: 'Identificado' },
  { value: 'active',     label: 'Ativo' },
  { value: 'mitigated',  label: 'Mitigado' },
  { value: 'resolved',   label: 'Resolvido' },
]

function blankDefaults(): RiskFormValues {
  return { title: '', description: '', level: 'medium', status: 'identified', notes: '' }
}

export function RiskDialog() {
  const sites          = useTorreStore((s) => s.sites)
  const editingRisk    = useTorreStore((s) => s.editingRisk)
  const setEditingRisk = useTorreStore((s) => s.setEditingRisk)
  const addRisk        = useTorreStore((s) => s.addRisk)
  const updateRisk     = useTorreStore((s) => s.updateRisk)

  const site = editingRisk ? sites.find((s) => s.id === editingRisk.siteId) ?? null : null
  const isNew = editingRisk?.riskId === 'new'
  const existing = isNew || !editingRisk
    ? null
    : site?.risks.find((r) => r.id === editingRisk.riskId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RiskFormValues>({
    resolver: zodResolver(riskSchema),
    defaultValues: blankDefaults(),
  })

  useEffect(() => {
    if (existing) {
      reset({
        title:       existing.title,
        description: existing.description,
        level:       existing.level,
        status:      existing.status,
        notes:       existing.notes ?? '',
      })
    } else if (isNew) {
      reset(blankDefaults())
    }
  }, [editingRisk, existing, isNew, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() { setEditingRisk(null) }

  function onSubmit(values: RiskFormValues) {
    if (!editingRisk) return
    if (isNew) {
      addRisk(editingRisk.siteId, {
        ...values,
        notes: values.notes ?? undefined,
        identifiedAt: new Date().toISOString(),
      })
    } else if (existing) {
      updateRisk(editingRisk.siteId, existing.id, { ...values, notes: values.notes ?? undefined })
    }
    close()
  }

  if (!editingRisk) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252]">
          <div>
            <h2 className="text-[#f5f5f5] font-bold text-sm">
              {isNew ? 'Novo Risco' : 'Editar Risco'}
            </h2>
            {site && <p className="text-[11px] text-[#6b6b6b] mt-0.5">{site.name}</p>}
          </div>
          <button onClick={close} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Title */}
            <Field label="Título *" error={errors.title?.message}>
              <input {...register('title')} placeholder="Ex: Infiltração na Fundação" className={inp(!!errors.title)} />
            </Field>

            {/* Level + Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nível *" error={errors.level?.message}>
                <select {...register('level')} className={inp(!!errors.level)}>
                  {LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status *" error={errors.status?.message}>
                <select {...register('status')} className={inp(!!errors.status)}>
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Level color swatches */}
            <div className="flex items-center gap-3 -mt-1">
              {LEVEL_OPTIONS.map((o) => (
                <div key={o.value} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: o.color }} />
                  <span className="text-[9px] text-[#6b6b6b]">{o.label}</span>
                </div>
              ))}
            </div>

            {/* Description */}
            <Field label="Descrição *" error={errors.description?.message}>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Descreva o risco detalhadamente — causa, impacto e contexto"
                className={cn(inp(!!errors.description), 'resize-none')}
              />
            </Field>

            {/* Notes */}
            <Field label="Notas / Plano de Ação" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Ações tomadas, responsáveis, prazo..."
                className={cn(inp(!!errors.notes), 'resize-none')}
              />
            </Field>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#525252]">
            <button type="button" onClick={close} className="px-4 py-2 rounded-lg border border-[#525252] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors">
              {isNew ? 'Adicionar Risco' : 'Salvar Risco'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function inp(hasError: boolean) {
  return cn(
    'w-full bg-[#2c2c2c] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError ? 'border-[#ef4444] focus:border-[#ef4444]' : 'border-[#525252] focus:border-[#f97316]'
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
