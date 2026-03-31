import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import { budgetLineSchema, type BudgetLineFormValues } from '../schemas'
import type { BudgetLineType } from '@/types'

const TYPE_OPTIONS: Array<{ value: BudgetLineType; label: string }> = [
  { value: 'labor',       label: 'Mão de Obra' },
  { value: 'equipment',   label: 'Equipamentos' },
  { value: 'materials',   label: 'Materiais' },
  { value: 'subcontract', label: 'Subcontratado' },
  { value: 'overhead',    label: 'Custos Fixos' },
  { value: 'other',       label: 'Outros' },
]

function blankDefaults(): BudgetLineFormValues {
  return { type: 'labor', description: '', budgeted: 0, projected: 0, spent: 0 }
}

export function BudgetDialog() {
  const projects             = useProjetosStore((s) => s.projects)
  const editingBudgetLine    = useProjetosStore((s) => s.editingBudgetLine)
  const setEditingBudgetLine = useProjetosStore((s) => s.setEditingBudgetLine)
  const addBudgetLine        = useProjetosStore((s) => s.addBudgetLine)
  const updateBudgetLine     = useProjetosStore((s) => s.updateBudgetLine)
  const deleteBudgetLine     = useProjetosStore((s) => s.deleteBudgetLine)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const project = editingBudgetLine
    ? projects.find((p) => p.id === editingBudgetLine.projectId) ?? null
    : null

  const isNew   = editingBudgetLine?.lineId === 'new'
  const existing = isNew || !editingBudgetLine
    ? null
    : project?.budgetLines.find((l) => l.id === editingBudgetLine.lineId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BudgetLineFormValues>({
    resolver: zodResolver(budgetLineSchema),
    defaultValues: blankDefaults(),
  })

  useEffect(() => {
    if (existing) {
      reset({
        type:        existing.type,
        description: existing.description,
        budgeted:    existing.budgeted,
        projected:   existing.projected,
        spent:       existing.spent,
      })
    } else if (isNew) {
      reset(blankDefaults())
    }
    setConfirmDelete(false)
  }, [editingBudgetLine, existing, isNew, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() {
    setEditingBudgetLine(null)
    setConfirmDelete(false)
  }

  function onSubmit(values: BudgetLineFormValues) {
    if (!editingBudgetLine) return
    if (isNew) {
      addBudgetLine(editingBudgetLine.projectId, values)
    } else if (existing) {
      updateBudgetLine(editingBudgetLine.projectId, existing.id, values)
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (editingBudgetLine && existing) {
      deleteBudgetLine(editingBudgetLine.projectId, existing.id)
    }
    close()
  }

  if (!editingBudgetLine) return null

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
          <h2 className="text-[#f5f5f5] font-bold text-sm">
            {isNew ? 'Nova Linha Orçamentária' : 'Editar Linha Orçamentária'}
          </h2>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#1a3662] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Type */}
            <Field label="Tipo *" error={errors.type?.message}>
              <select {...register('type')} className={inp(!!errors.type)}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>

            {/* Description */}
            <Field label="Descrição *" error={errors.description?.message}>
              <input
                {...register('description')}
                placeholder="Ex: Mão de obra civil e especializada"
                className={inp(!!errors.description)}
              />
            </Field>

            {/* Currency fields */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Orçado (R$) *" error={errors.budgeted?.message}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('budgeted', { valueAsNumber: true })}
                  placeholder="0.00"
                  className={inp(!!errors.budgeted)}
                />
              </Field>
              <Field label="Projetado (R$) *" error={errors.projected?.message}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('projected', { valueAsNumber: true })}
                  placeholder="0.00"
                  className={inp(!!errors.projected)}
                />
              </Field>
              <Field label="Gasto (R$) *" error={errors.spent?.message}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('spent', { valueAsNumber: true })}
                  placeholder="0.00"
                  className={inp(!!errors.spent)}
                />
              </Field>
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
                    type="button"
                    onClick={handleDelete}
                    className="text-xs px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 font-semibold"
                  >
                    Sim
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="text-xs px-2 py-1 rounded bg-[#1a3662] text-[#a3a3a3] hover:bg-[#20406a]"
                  >
                    Não
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#ef4444] transition-colors"
                >
                  <Trash2 size={13} />
                  Excluir
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
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
                {isNew ? 'Adicionar' : 'Salvar'}
              </button>
            </div>
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
