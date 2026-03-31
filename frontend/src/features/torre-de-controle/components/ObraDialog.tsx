import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTorreStore } from '@/store/torreDeControleStore'
import { siteSchema, type SiteFormValues } from '../schemas'
import type { ObraStatus } from '@/types'

const STATUS_OPTIONS: Array<{ value: ObraStatus; label: string }> = [
  { value: 'active',    label: 'Ativa' },
  { value: 'planning',  label: 'Planejamento' },
  { value: 'paused',    label: 'Pausada' },
  { value: 'completed', label: 'Concluída' },
]

const BUILDING_TYPES = [
  'Residencial Alto Padrão', 'Residencial Popular', 'Comercial / Corporativo',
  'Galpão Industrial / Logístico', 'Shopping / Varejo', 'Hotel / Hospitality',
  'Infraestrutura / Obras Viárias', 'Reforma / Retrofit', 'Outro',
]

function blankDefaults(): SiteFormValues {
  return {
    code: '', name: '', company: '', owner: '', manager: '',
    description: '', status: 'active',
    street: '', number: '', district: '', city: 'São Paulo', state: 'SP', cep: '',
    buildingType: '', totalArea: 0, floors: 1,
    startDate: '', expectedEnd: '',
    lat: '', lng: '',
  }
}

export function ObraDialog() {
  const sites      = useTorreStore((s) => s.sites)
  const editingId  = useTorreStore((s) => s.editingId)
  const setEditing = useTorreStore((s) => s.setEditing)
  const addSite    = useTorreStore((s) => s.addSite)
  const updateSite = useTorreStore((s) => s.updateSite)
  const deleteSite = useTorreStore((s) => s.deleteSite)

  const [confirmDelete, setConfirmDelete] = useState(false)

  const isNew    = editingId === 'new'
  const existing = isNew ? null : sites.find((s) => s.id === editingId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: blankDefaults(),
  })

  useEffect(() => {
    if (existing) {
      reset({
        code:         existing.code,
        name:         existing.name,
        company:      existing.company,
        owner:        existing.owner,
        manager:      existing.manager,
        description:  existing.description ?? '',
        status:       existing.status,
        street:       existing.street,
        number:       existing.number,
        district:     existing.district,
        city:         existing.city,
        state:        existing.state,
        cep:          existing.cep,
        buildingType: existing.buildingType,
        totalArea:    existing.totalArea,
        floors:       existing.floors,
        startDate:    existing.startDate,
        expectedEnd:  existing.expectedEnd,
        lat:          existing.lat  != null ? String(existing.lat)  : '',
        lng:          existing.lng  != null ? String(existing.lng)  : '',
      })
    } else if (isNew) {
      reset(blankDefaults())
    }
    setConfirmDelete(false)
  }, [editingId, existing, isNew, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() { setEditing(null); setConfirmDelete(false) }

  function onSubmit(values: SiteFormValues) {
    const lat = values.lat ? Number(values.lat) : null
    const lng = values.lng ? Number(values.lng) : null
    const payload = { ...values, description: values.description ?? '', lat, lng, risks: existing?.risks ?? [] }

    if (isNew) {
      addSite(payload)
    } else if (existing) {
      updateSite(existing.id, { ...payload })
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (existing) deleteSite(existing.id)
    close()
  }

  if (!editingId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-[#20406a] bg-[#112645] flex flex-col shadow-2xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#20406a] shrink-0">
          <h2 className="text-[#f5f5f5] font-bold text-base">
            {isNew ? 'Nova Obra' : `Editar — ${existing?.name ?? ''}`}
          </h2>
          <button onClick={close} className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#1a3662] transition-colors">
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5" style={{ maxHeight: '72vh' }}>

            {/* Identificação */}
            <Section title="Identificação">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Código *" error={errors.code?.message}>
                  <input {...register('code')} placeholder="OBR-001" className={inp(!!errors.code)} />
                </Field>
                <Field label="Status *" error={errors.status?.message}>
                  <select {...register('status')} className={inp(!!errors.status)}>
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Nome da Obra *" error={errors.name?.message}>
                <input {...register('name')} placeholder="Torre Residencial Paulista" className={inp(!!errors.name)} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de Edificação *" error={errors.buildingType?.message}>
                  <select {...register('buildingType')} className={inp(!!errors.buildingType)}>
                    <option value="">Selecione...</option>
                    {BUILDING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Área (m²) *" error={errors.totalArea?.message}>
                    <input type="number" min="1" {...register('totalArea', { valueAsNumber: true })} placeholder="0" className={inp(!!errors.totalArea)} />
                  </Field>
                  <Field label="Andares *" error={errors.floors?.message}>
                    <input type="number" min="1" {...register('floors', { valueAsNumber: true })} placeholder="1" className={inp(!!errors.floors)} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Responsáveis */}
            <Section title="Responsáveis">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Empresa *" error={errors.company?.message}>
                  <input {...register('company')} placeholder="Construtora" className={inp(!!errors.company)} />
                </Field>
                <Field label="Dono *" error={errors.owner?.message}>
                  <input {...register('owner')} placeholder="Nome ou empresa" className={inp(!!errors.owner)} />
                </Field>
                <Field label="Gerente *" error={errors.manager?.message}>
                  <input {...register('manager')} placeholder="Nome do gerente" className={inp(!!errors.manager)} />
                </Field>
              </div>
            </Section>

            {/* Endereço */}
            <Section title="Endereço">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Rua / Avenida *" error={errors.street?.message}>
                    <input {...register('street')} placeholder="Avenida Paulista" className={inp(!!errors.street)} />
                  </Field>
                </div>
                <Field label="Número *" error={errors.number?.message}>
                  <input {...register('number')} placeholder="1578" className={inp(!!errors.number)} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Bairro *" error={errors.district?.message}>
                  <input {...register('district')} placeholder="Bela Vista" className={inp(!!errors.district)} />
                </Field>
                <Field label="Cidade *" error={errors.city?.message}>
                  <input {...register('city')} placeholder="São Paulo" className={inp(!!errors.city)} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Estado *" error={errors.state?.message}>
                    <input {...register('state')} placeholder="SP" maxLength={2} className={inp(!!errors.state)} />
                  </Field>
                  <Field label="CEP *" error={errors.cep?.message}>
                    <input {...register('cep')} placeholder="01310-200" className={inp(!!errors.cep)} />
                  </Field>
                </div>
              </div>
            </Section>

            {/* Cronograma */}
            <Section title="Cronograma">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de Início *" error={errors.startDate?.message}>
                  <input type="date" {...register('startDate')} className={inp(!!errors.startDate)} />
                </Field>
                <Field label="Previsão de Término *" error={errors.expectedEnd?.message}>
                  <input type="date" {...register('expectedEnd')} className={inp(!!errors.expectedEnd)} />
                </Field>
              </div>
            </Section>

            {/* Localização */}
            <Section title={<span className="flex items-center gap-1.5"><MapPin size={9} />Coordenadas no Mapa</span>}>
              <p className="text-[10px] text-[#3f3f3f] -mt-1">
                Preencha para posicionar o marcador no mapa. Pode ser ajustado arrastando o marcador depois.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude" error={errors.lat?.message as string | undefined}>
                  <input type="number" step="any" {...register('lat')} placeholder="-23.5649" className={inp(!!errors.lat)} />
                </Field>
                <Field label="Longitude" error={errors.lng?.message as string | undefined}>
                  <input type="number" step="any" {...register('lng')} placeholder="-46.6527" className={inp(!!errors.lng)} />
                </Field>
              </div>
            </Section>

            {/* Descrição */}
            <Section title="Descrição">
              <Field label="Descrição do Projeto" error={errors.description?.message}>
                <textarea {...register('description')} rows={3} placeholder="Descreva o projeto, objetivos e escopo da obra" className={cn(inp(!!errors.description), 'resize-none')} />
              </Field>
            </Section>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#20406a] shrink-0">
            {!isNew ? (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-[#ef4444]" />
                  <span className="text-xs text-[#ef4444]">Confirmar exclusão?</span>
                  <button type="button" onClick={handleDelete} className="text-xs px-2 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 font-semibold">Sim</button>
                  <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded bg-[#1a3662] text-[#a3a3a3] hover:bg-[#20406a]">Não</button>
                </div>
              ) : (
                <button type="button" onClick={handleDelete} className="flex items-center gap-1.5 text-xs text-[#6b6b6b] hover:text-[#ef4444] transition-colors">
                  <Trash2 size={13} />Excluir Obra
                </button>
              )
            ) : <div />}

            <div className="flex items-center gap-2">
              <button type="button" onClick={close} className="px-4 py-2 rounded-lg border border-[#20406a] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors">Cancelar</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#1a9ab8] transition-colors">
                {isNew ? 'Adicionar Obra' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function inp(hasError: boolean) {
  return cn(
    'w-full bg-[#0d2040] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError ? 'border-[#ef4444] focus:border-[#ef4444]' : 'border-[#20406a] focus:border-[#2abfdc]'
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

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-0.5 w-full pb-1 border-b border-[#20406a]">{title}</legend>
      {children}
    </fieldset>
  )
}
