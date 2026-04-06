import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { equipamentoSchema, type EquipamentoFormValues } from '../schemas'
import { STATUS_CONFIG } from '../constants'
import type { EquipmentStatus } from '@/types'

const STATUS_OPTIONS: EquipmentStatus[] = ['active', 'idle', 'maintenance', 'alert', 'offline']

export function EquipmentDialog() {
  const equipamentos      = useEquipamentosStore((s) => s.equipamentos)
  const editingId         = useEquipamentosStore((s) => s.editingId)
  const setEditing        = useEquipamentosStore((s) => s.setEditing)
  const addEquipamento    = useEquipamentosStore((s) => s.addEquipamento)
  const updateEquipamento = useEquipamentosStore((s) => s.updateEquipamento)
  const deleteEquipamento = useEquipamentosStore((s) => s.deleteEquipamento)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNew    = editingId === 'new'
  const existing = isNew ? null : equipamentos.find((e) => e.id === editingId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipamentoFormValues>({
    resolver: zodResolver(equipamentoSchema),
    defaultValues: blankDefaults(),
  })

  useEffect(() => {
    if (existing) {
      reset({
        code:            existing.code,
        name:            existing.name,
        type:            existing.type,
        brand:           existing.brand,
        model:           existing.model,
        year:            existing.year,
        serialNumber:    existing.serialNumber,
        status:          existing.status,
        description:     existing.description,
        maxLoad:         existing.maxLoad,
        lastMaintenance: existing.lastMaintenance,
        nextMaintenance: existing.nextMaintenance,
        operator:        existing.operator ?? '',
        engineHours:     existing.engineHours,
        lat:             existing.lat !== null ? String(existing.lat) : '',
        lng:             existing.lng !== null ? String(existing.lng) : '',
        siteName:        existing.siteName ?? '',
      })
    } else if (isNew) {
      reset(blankDefaults())
    }
    setConfirmDelete(false)
  }, [editingId, existing, isNew, reset])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() {
    setEditing(null)
    setConfirmDelete(false)
  }

  function onSubmit(values: EquipamentoFormValues) {
    const lat = values.lat ? Number(values.lat) : null
    const lng = values.lng ? Number(values.lng) : null

    const payload = {
      code:            values.code,
      name:            values.name,
      type:            values.type,
      brand:           values.brand,
      model:           values.model,
      year:            values.year,
      serialNumber:    values.serialNumber,
      status:          values.status,
      description:     values.description ?? '',
      maxLoad:         values.maxLoad ?? '',
      lastMaintenance: values.lastMaintenance,
      nextMaintenance: values.nextMaintenance,
      operator:        values.operator || null,
      engineHours:     values.engineHours,
      lat,
      lng,
      siteName:        values.siteName || null,
    }

    if (isNew) {
      addEquipamento(payload)
    } else if (existing) {
      updateEquipamento(existing.id, payload)
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (existing) deleteEquipamento(existing.id)
    close()
  }

  if (!editingId) return null

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252] shrink-0">
          <h2 className="text-[#f5f5f5] font-bold text-base">
            {isNew ? 'Novo Equipamento' : `Editar — ${existing?.name ?? ''}`}
          </h2>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable form body */}
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5" style={{ maxHeight: '72vh' }}>

            {/* ── Identificação ── */}
            <Section title="Identificação">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Código *" error={errors.code?.message}>
                  <input {...register('code')} placeholder="EQ-001" className={inp(!!errors.code)} />
                </Field>
                <Field label="Status *" error={errors.status?.message}>
                  <select {...register('status')} className={inp(!!errors.status)}>
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Nome *" error={errors.name?.message}>
                <input {...register('name')} placeholder="Tesoura Aérea" className={inp(!!errors.name)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Tipo *" error={errors.type?.message}>
                  <input {...register('type')} placeholder="Plataforma" className={inp(!!errors.type)} />
                </Field>
                <Field label="Marca *" error={errors.brand?.message}>
                  <input {...register('brand')} placeholder="JLG" className={inp(!!errors.brand)} />
                </Field>
                <Field label="Modelo *" error={errors.model?.message}>
                  <input {...register('model')} placeholder="660SJ" className={inp(!!errors.model)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Ano de Fabricação *" error={errors.year?.message}>
                  <input
                    type="number"
                    {...register('year', { valueAsNumber: true })}
                    placeholder="2020"
                    className={inp(!!errors.year)}
                  />
                </Field>
                <Field label="Nº de Série *" error={errors.serialNumber?.message}>
                  <input
                    {...register('serialNumber')}
                    placeholder="SN-JLG-017-2021"
                    className={inp(!!errors.serialNumber)}
                  />
                </Field>
              </div>
            </Section>

            {/* ── Operação ── */}
            <Section title="Operação">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Operador Responsável" error={errors.operator?.message}>
                  <input
                    {...register('operator')}
                    placeholder="Nome do operador"
                    className={inp(false)}
                  />
                </Field>
                <Field label="Horas de Motor *" error={errors.engineHours?.message}>
                  <input
                    type="number"
                    {...register('engineHours', { valueAsNumber: true })}
                    placeholder="0"
                    className={inp(!!errors.engineHours)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Capacidade / Carga Máx." error={errors.maxLoad?.message}>
                  <input
                    {...register('maxLoad')}
                    placeholder="500 kg"
                    className={inp(false)}
                  />
                </Field>
                <Field label="Descrição Técnica" error={errors.description?.message}>
                  <input
                    {...register('description')}
                    placeholder="Informações técnicas e observações"
                    className={inp(false)}
                  />
                </Field>
              </div>
            </Section>

            {/* ── Manutenção ── */}
            <Section title="Manutenção">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Última Manutenção *" error={errors.lastMaintenance?.message}>
                  <input type="date" {...register('lastMaintenance')} className={inp(!!errors.lastMaintenance)} />
                </Field>
                <Field label="Próxima Manutenção *" error={errors.nextMaintenance?.message}>
                  <input type="date" {...register('nextMaintenance')} className={inp(!!errors.nextMaintenance)} />
                </Field>
              </div>
            </Section>

            {/* ── Localização ── */}
            <Section
              title={
                <span className="flex items-center gap-1.5">
                  <MapPin size={9} />
                  Localização no Mapa
                </span>
              }
            >
              <p className="text-[10px] text-[#3f3f3f] -mt-1">
                Preencha as coordenadas geográficas decimais. Após salvar, o marcador aparecerá no mapa e poderá ser arrastado para ajuste fino.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Latitude" error={errors.lat?.message as string | undefined}>
                  <input
                    type="number"
                    step="any"
                    {...register('lat')}
                    placeholder="-23.5505"
                    className={inp(!!errors.lat)}
                  />
                </Field>
                <Field label="Longitude" error={errors.lng?.message as string | undefined}>
                  <input
                    type="number"
                    step="any"
                    {...register('lng')}
                    placeholder="-46.6333"
                    className={inp(!!errors.lng)}
                  />
                </Field>
              </div>
              <Field label="Nome da Obra / Site" error={errors.siteName?.message}>
                <input
                  {...register('siteName')}
                  placeholder="Construção Torre Premium"
                  className={inp(false)}
                />
              </Field>
            </Section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-t border-[#525252] shrink-0">
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
                    className="text-xs px-2 py-1 rounded bg-[#484848] text-[#a3a3a3] hover:bg-[#525252]"
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
                  Excluir Equipamento
                </button>
              )
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={close}
                className="px-4 py-2 rounded-lg border border-[#525252] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] transition-colors"
              >
                {isNew ? 'Adicionar Equipamento' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blankDefaults(): EquipamentoFormValues {
  return {
    code: '', name: '', type: '', brand: '', model: '',
    year: new Date().getFullYear(),
    serialNumber: '',
    status: 'active',
    description: '', maxLoad: '',
    lastMaintenance: '', nextMaintenance: '',
    operator: '', engineHours: 0,
    lat: '', lng: '', siteName: '',
  }
}

function inp(hasError: boolean) {
  return cn(
    'w-full bg-[#2c2c2c] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError
      ? 'border-[#ef4444] focus:border-[#ef4444]'
      : 'border-[#525252] focus:border-[#f97316]'
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: React.ReactNode
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

function Section({
  title,
  children,
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-0.5 w-full pb-1 border-b border-[#525252]">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}
