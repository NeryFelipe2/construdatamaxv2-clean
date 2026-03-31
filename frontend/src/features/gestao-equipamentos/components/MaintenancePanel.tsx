import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useShallow } from 'zustand/react/shallow'
import { Plus, Pencil, Trash2, AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useGestaoEquipamentosStore, filterByStatus } from '@/store/gestaoEquipamentosStore'
import { workOrderSchema, type WorkOrderFormValues } from '../schemas'
import type { WorkOrderStatus, MaintenanceOrder } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS: { key: WorkOrderStatus | 'all'; label: string }[] = [
  { key: 'all',         label: 'Todas' },
  { key: 'scheduled',   label: 'Agendada' },
  { key: 'in_progress', label: 'Em Execução' },
  { key: 'completed',   label: 'Concluída' },
  { key: 'cancelled',   label: 'Cancelada' },
]

const STATUS_BADGE: Record<WorkOrderStatus, string> = {
  scheduled:   'bg-[#1d4ed8]/20 text-[#60a5fa]',
  in_progress: 'bg-[#2abfdc]/20 text-[#2abfdc]',
  completed:   'bg-[#16a34a]/20 text-[#4ade80]',
  cancelled:   'bg-[#1f3c5e] text-[#6b6b6b]',
}

const STATUS_LABEL: Record<WorkOrderStatus, string> = {
  scheduled:   'Agendada',
  in_progress: 'Em Execução',
  completed:   'Concluída',
  cancelled:   'Cancelada',
}

const TYPE_LABEL: Record<string, string> = {
  preventive:  'Preventiva',
  corrective:  'Corretiva',
  predictive:  'Preditiva',
}

const TYPE_BADGE: Record<string, string> = {
  preventive:  'bg-[#1d4ed8]/20 text-[#60a5fa]',
  corrective:  'bg-[#ef4444]/20 text-[#f87171]',
  predictive:  'bg-[#ca8a04]/20 text-[#fbbf24]',
}

// ─── Field / input helpers ────────────────────────────────────────────────────

function inp(hasError: boolean) {
  return cn(
    'w-full bg-[#0d2040] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError
      ? 'border-[#ef4444] focus:border-[#ef4444]'
      : 'border-[#20406a] focus:border-[#2abfdc]',
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-widest text-[#a3a3a3] font-semibold">
        {label}
      </label>
      {children}
      {error && <span className="text-[11px] text-[#ef4444]">{error}</span>}
    </div>
  )
}

// ─── Work Order Dialog ────────────────────────────────────────────────────────

function WorkOrderDialog() {
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const { orders, editingOrderId, setEditingOrder, addOrder, updateOrder } =
    useGestaoEquipamentosStore(
      useShallow((s) => ({
        orders:          s.orders,
        editingOrderId:  s.editingOrderId,
        setEditingOrder: s.setEditingOrder,
        addOrder:        s.addOrder,
        updateOrder:     s.updateOrder,
      })),
    )

  const isNew     = editingOrderId === 'new'
  const existing: MaintenanceOrder | null = isNew
    ? null
    : (orders.find((o) => o.id === editingOrderId) ?? null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<WorkOrderFormValues>({
    resolver: zodResolver(workOrderSchema),
    defaultValues: blankDefaults(),
  })

  useEffect(() => {
    if (existing) {
      reset({
        equipmentId:   existing.equipmentId,
        type:          existing.type,
        description:   existing.description,
        scheduledDate: existing.scheduledDate,
        responsible:   existing.responsible,
        estimatedCost: existing.estimatedCost,
        notes:         existing.notes ?? '',
      })
    } else if (isNew) {
      reset(blankDefaults())
    }
  }, [editingOrderId, existing, isNew, reset])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditingOrder(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setEditingOrder])

  function onSubmit(values: WorkOrderFormValues) {
    const payload = {
      equipmentId:   values.equipmentId,
      type:          values.type,
      description:   values.description,
      scheduledDate: values.scheduledDate,
      responsible:   values.responsible,
      estimatedCost: values.estimatedCost,
      notes:         values.notes || undefined,
      status:        (existing?.status ?? 'scheduled') as WorkOrderStatus,
      completedDate: existing?.completedDate,
      actualCost:    existing?.actualCost,
    }

    if (isNew) {
      addOrder(payload)
    } else if (existing) {
      updateOrder(existing.id, payload)
    }
    setEditingOrder(null)
  }

  if (!editingOrderId) return null

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setEditingOrder(null) }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#20406a] bg-[#112645] flex flex-col shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20406a] shrink-0">
          <h2 className="text-[#f5f5f5] font-bold text-base">
            {isNew ? 'Nova Ordem de Serviço' : `Editar OS — ${existing?.description?.slice(0, 30) ?? ''}…`}
          </h2>
          <button
            onClick={() => setEditingOrder(null)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#1a3662] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4" style={{ maxHeight: '70vh' }}>

            {/* Equipment select */}
            <Field label="Equipamento *" error={errors.equipmentId?.message}>
              <select {...register('equipmentId')} className={inp(!!errors.equipmentId)}>
                <option value="">Selecione um equipamento…</option>
                {equipamentos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.code} — {eq.name}
                  </option>
                ))}
              </select>
            </Field>

            {/* Type + scheduledDate */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo *" error={errors.type?.message}>
                <select {...register('type')} className={inp(!!errors.type)}>
                  <option value="preventive">Preventiva</option>
                  <option value="corrective">Corretiva</option>
                  <option value="predictive">Preditiva</option>
                </select>
              </Field>
              <Field label="Data Agendada *" error={errors.scheduledDate?.message}>
                <input
                  type="date"
                  {...register('scheduledDate')}
                  className={inp(!!errors.scheduledDate)}
                />
              </Field>
            </div>

            {/* Description */}
            <Field label="Descrição *" error={errors.description?.message}>
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Descreva o serviço a ser realizado…"
                className={cn(inp(!!errors.description), 'resize-none')}
              />
            </Field>

            {/* Responsible + estimatedCost */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Responsável *" error={errors.responsible?.message}>
                <input
                  {...register('responsible')}
                  placeholder="Nome do responsável"
                  className={inp(!!errors.responsible)}
                />
              </Field>
              <Field label="Custo Estimado (R$) *" error={errors.estimatedCost?.message}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('estimatedCost', { valueAsNumber: true })}
                  placeholder="0,00"
                  className={inp(!!errors.estimatedCost)}
                />
              </Field>
            </div>

            {/* Notes */}
            <Field label="Observações" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                rows={2}
                placeholder="Observações opcionais…"
                className={cn(inp(!!errors.notes), 'resize-none')}
              />
            </Field>

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#20406a] shrink-0">
            <button
              type="button"
              onClick={() => setEditingOrder(null)}
              className="px-4 py-2 rounded-lg border border-[#20406a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors"
            >
              {isNew ? 'Criar OS' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function blankDefaults(): WorkOrderFormValues {
  return {
    equipmentId:   '',
    type:          'preventive',
    description:   '',
    scheduledDate: '',
    responsible:   '',
    estimatedCost: 0,
    notes:         '',
  }
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function MaintenancePanel() {
  const [filter, setFilter]               = useState<WorkOrderStatus | 'all'>('all')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const { orders, editingOrderId, setEditingOrder, deleteOrder } =
    useGestaoEquipamentosStore(
      useShallow((s) => ({
        orders:          s.orders,
        editingOrderId:  s.editingOrderId,
        setEditingOrder: s.setEditingOrder,
        deleteOrder:     s.deleteOrder,
      })),
    )

  const filtered = filterByStatus(orders, filter)

  function equipmentLabel(id: string) {
    const eq = equipamentos.find((e) => e.id === id)
    return eq ? `${eq.code} — ${eq.name}` : id
  }

  function handleDeleteClick(id: string) {
    if (confirmDeleteId === id) {
      deleteOrder(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#20406a] shrink-0 bg-[#112645]">
        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setConfirmDeleteId(null) }}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                filter === tab.key
                  ? 'bg-[#2abfdc] text-white'
                  : 'bg-[#14294e] text-[#6b6b6b] hover:text-[#a3a3a3] border border-[#20406a]',
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-[10px] opacity-70">
                ({filterByStatus(orders, tab.key).length})
              </span>
            </button>
          ))}
        </div>

        {/* New OS button */}
        <button
          onClick={() => setEditingOrder('new')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors"
        >
          <Plus size={14} />
          Nova OS
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto overflow-x-auto px-6 py-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm text-[#6b6b6b]">Nenhuma ordem de serviço encontrada.</p>
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#20406a]">
                {['Equipamento', 'Tipo', 'Data', 'Responsável', 'Custo Est.', 'Status', 'Ações'].map(
                  (col) => (
                    <th
                      key={col}
                      className="text-left text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold pb-2 pr-4 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#14294e]">
              {filtered.map((order) => (
                <tr
                  key={order.id}
                  className="hover:bg-[#14294e]/50 transition-colors"
                >
                  {/* Equipamento */}
                  <td className="py-3 pr-4">
                    <span className="text-[#f5f5f5] font-medium">
                      {equipmentLabel(order.equipmentId)}
                    </span>
                  </td>

                  {/* Tipo */}
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        TYPE_BADGE[order.type] ?? 'bg-[#20406a] text-[#a3a3a3]',
                      )}
                    >
                      {TYPE_LABEL[order.type] ?? order.type}
                    </span>
                  </td>

                  {/* Data */}
                  <td className="py-3 pr-4 whitespace-nowrap text-[#a3a3a3] font-mono">
                    {new Date(order.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>

                  {/* Responsável */}
                  <td className="py-3 pr-4 text-[#a3a3a3] max-w-[140px] truncate">
                    {order.responsible}
                  </td>

                  {/* Custo Est. */}
                  <td className="py-3 pr-4 whitespace-nowrap text-[#f5f5f5]">
                    {order.estimatedCost.toLocaleString('pt-BR', {
                      style:    'currency',
                      currency: 'BRL',
                    })}
                  </td>

                  {/* Status */}
                  <td className="py-3 pr-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                        STATUS_BADGE[order.status],
                      )}
                    >
                      {STATUS_LABEL[order.status]}
                    </span>
                  </td>

                  {/* Ações */}
                  <td className="py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {/* Edit */}
                      <button
                        onClick={() => {
                          setConfirmDeleteId(null)
                          setEditingOrder(order.id)
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#2abfdc] hover:bg-[#2abfdc]/10 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>

                      {/* Delete with inline confirm */}
                      {confirmDeleteId === order.id ? (
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle size={12} className="text-[#ef4444]" />
                          <button
                            onClick={() => handleDeleteClick(order.id)}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 font-semibold"
                          >
                            Sim
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-[10px] px-2 py-0.5 rounded bg-[#1a3662] text-[#a3a3a3] hover:bg-[#20406a]"
                          >
                            Não
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleDeleteClick(order.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Dialog — always in DOM, shown when editingOrderId is set */}
      {editingOrderId && <WorkOrderDialog />}
    </div>
  )
}
