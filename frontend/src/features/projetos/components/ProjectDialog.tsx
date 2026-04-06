import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Trash2, AlertTriangle, MapPin, Search, Loader2 } from 'lucide-react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import { projectInfoSchema, type ProjectInfoFormValues } from '../schemas'
import type { ProjectStatus } from '@/types'

// Fix Leaflet default icon
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: 'active',    label: 'Ativo' },
  { value: 'planning',  label: 'Planejamento' },
  { value: 'completed', label: 'Concluído' },
  { value: 'on_hold',   label: 'Em Espera' },
]

// Brazil center as default
const DEFAULT_CENTER: [number, number] = [-14.235, -51.925]

interface ClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void
}
function MapClickHandler({ onMapClick }: ClickHandlerProps) {
  useMapEvents({
    click(e) { onMapClick(e.latlng.lat, e.latlng.lng) },
  })
  return null
}

interface MapFlyToProps { pos: [number, number] | null }
function MapFlyTo({ pos }: MapFlyToProps) {
  const map = useMap()
  useEffect(() => {
    if (pos) map.flyTo(pos, 14, { duration: 1 })
  }, [pos, map])
  return null
}

function blankDefaults(): ProjectInfoFormValues {
  return {
    code: '', name: '', owner: '', manager: '',
    description: '', status: 'active',
    startDate: '', endDate: '',
    contractNumber: '', clientName: '', projectManager: '',
    riskLevel: undefined, priority: undefined,
    address: '', lat: undefined, lng: undefined,
  }
}

export function ProjectDialog() {
  const projects          = useProjetosStore((s) => s.projects)
  const editingProjectId  = useProjetosStore((s) => s.editingProjectId)
  const setEditingProject = useProjetosStore((s) => s.setEditingProject)
  const addProject        = useProjetosStore((s) => s.addProject)
  const updateProject     = useProjetosStore((s) => s.updateProject)
  const deleteProject     = useProjetosStore((s) => s.deleteProject)

  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [showMap, setShowMap]               = useState(false)
  const [markerPos, setMarkerPos]           = useState<[number, number] | null>(null)
  const [geocoding, setGeocoding]           = useState(false)
  const [geocodeError, setGeocodeError]     = useState<string | null>(null)
  const [flyTarget, setFlyTarget]           = useState<[number, number] | null>(null)

  const isNew    = editingProjectId === 'new'
  const existing = isNew ? null : projects.find((p) => p.id === editingProjectId) ?? null

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProjectInfoFormValues>({
    resolver: zodResolver(projectInfoSchema),
    defaultValues: blankDefaults(),
  })

  const latVal = watch('lat')
  const lngVal = watch('lng')

  useEffect(() => {
    if (existing) {
      reset({
        code:           existing.code,
        name:           existing.name,
        owner:          existing.owner,
        manager:        existing.manager,
        description:    existing.description ?? '',
        status:         existing.status,
        startDate:      existing.startDate,
        endDate:        existing.endDate,
        contractNumber: existing.contractNumber ?? '',
        clientName:     existing.clientName     ?? '',
        projectManager: existing.projectManager ?? '',
        riskLevel:      existing.riskLevel,
        priority:       existing.priority,
        address:        existing.address ?? '',
        lat:            existing.lat,
        lng:            existing.lng,
      })
      if (existing.lat && existing.lng) {
        setMarkerPos([existing.lat, existing.lng])
      } else {
        setMarkerPos(null)
      }
    } else if (isNew) {
      reset(blankDefaults())
      setMarkerPos(null)
    }
    setConfirmDelete(false)
    setShowMap(false)
  }, [editingProjectId, existing, isNew, reset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function close() {
    setEditingProject(null)
    setConfirmDelete(false)
  }

  function handleMapClick(lat: number, lng: number) {
    const rLat = Math.round(lat * 1e6) / 1e6
    const rLng = Math.round(lng * 1e6) / 1e6
    setValue('lat', rLat, { shouldValidate: true })
    setValue('lng', rLng, { shouldValidate: true })
    setMarkerPos([rLat, rLng])
    setGeocodeError(null)
  }

  async function handleGeocode() {
    const addr = (document.querySelector('input[data-addr]') as HTMLInputElement | null)?.value
      ?? watch('address')
    if (!addr?.trim()) return
    setGeocoding(true)
    setGeocodeError(null)
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&countrycodes=br`
      const res = await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })
      const data: { lat: string; lon: string }[] = await res.json()
      if (data.length === 0) {
        setGeocodeError('Endereço não encontrado. Tente ser mais específico.')
        return
      }
      const rLat = Math.round(parseFloat(data[0].lat) * 1e6) / 1e6
      const rLng = Math.round(parseFloat(data[0].lon) * 1e6) / 1e6
      setValue('lat', rLat, { shouldValidate: true })
      setValue('lng', rLng, { shouldValidate: true })
      setMarkerPos([rLat, rLng])
      setFlyTarget([rLat, rLng])
      setShowMap(true)
    } catch {
      setGeocodeError('Erro ao buscar endereço. Verifique sua conexão.')
    } finally {
      setGeocoding(false)
    }
  }

  function onSubmit(values: ProjectInfoFormValues) {
    if (isNew) {
      addProject({
        ...values,
        description:    values.description    ?? '',
        contractNumber: values.contractNumber || undefined,
        clientName:     values.clientName     || undefined,
        projectManager: values.projectManager || undefined,
        address:        values.address        || undefined,
        planningPhases: [
          { id: `pp-new-1-${Date.now()}`, name: 'Engenharia e Design', status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `pp-new-2-${Date.now()}`, name: 'Pré-construção',       status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `pp-new-3-${Date.now()}`, name: 'Aquisições',           status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
        ],
        executionPhases: [
          { id: `ep-new-1-${Date.now()}`, name: 'Construção',         status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `ep-new-2-${Date.now()}`, name: 'Controle do Projeto', status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
          { id: `ep-new-3-${Date.now()}`, name: 'Encerramento',       status: 'not_started', progress: 0, startDate: values.startDate, endDate: values.endDate },
        ],
        budgetLines: [],
        demands: [],
        documents: [],
      })
    } else if (existing) {
      updateProject(existing.id, {
        ...values,
        description:    values.description    ?? '',
        contractNumber: values.contractNumber || undefined,
        clientName:     values.clientName     || undefined,
        projectManager: values.projectManager || undefined,
        address:        values.address        || undefined,
      })
    }
    close()
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    if (existing) deleteProject(existing.id)
    close()
  }

  if (!editingProjectId) return null

  const mapCenter: [number, number] = markerPos ?? DEFAULT_CENTER

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.76)' }}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-[#525252] bg-[#333333] flex flex-col shadow-2xl"
        style={{ maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252] shrink-0">
          <h2 className="text-[#f5f5f5] font-bold text-base">
            {isNew ? 'Novo Projeto' : `Editar — ${existing?.name ?? ''}`}
          </h2>
          <button
            onClick={close}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#6b6b6b] hover:text-[#f5f5f5] hover:bg-[#484848] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="overflow-y-auto px-6 py-5 flex flex-col gap-5" style={{ maxHeight: '68vh' }}>
            {/* Identificação */}
            <Section title="Identificação">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Código *" error={errors.code?.message}>
                  <input {...register('code')} placeholder="PRJ-001" className={inp(!!errors.code)} />
                </Field>
                <Field label="Status *" error={errors.status?.message}>
                  <select {...register('status')} className={inp(!!errors.status)}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Nome do Projeto *" error={errors.name?.message}>
                <input {...register('name')} placeholder="Torre Residencial Premium" className={inp(!!errors.name)} />
              </Field>
            </Section>

            {/* Responsáveis */}
            <Section title="Responsáveis">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Dono (Owner) *" error={errors.owner?.message}>
                  <input {...register('owner')} placeholder="Empresa ou pessoa" className={inp(!!errors.owner)} />
                </Field>
                <Field label="Gerente *" error={errors.manager?.message}>
                  <input {...register('manager')} placeholder="Nome do gerente" className={inp(!!errors.manager)} />
                </Field>
              </div>
            </Section>

            {/* Datas */}
            <Section title="Cronograma">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Data de Início *" error={errors.startDate?.message}>
                  <input type="date" {...register('startDate')} className={inp(!!errors.startDate)} />
                </Field>
                <Field label="Data de Término *" error={errors.endDate?.message}>
                  <input type="date" {...register('endDate')} className={inp(!!errors.endDate)} />
                </Field>
              </div>
            </Section>

            {/* Descrição */}
            <Section title="Descrição">
              <Field label="Descrição do Projeto" error={errors.description?.message}>
                <textarea
                  {...register('description')}
                  rows={3}
                  placeholder="Descreva o projeto, objetivos e escopo"
                  className={cn(inp(!!errors.description), 'resize-none')}
                />
              </Field>
            </Section>

            {/* Informações Adicionais */}
            <Section title="Informações Adicionais">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nº do Contrato" error={errors.contractNumber?.message}>
                  <input {...register('contractNumber')} placeholder="CT-2025-001" className={inp(!!errors.contractNumber)} />
                </Field>
                <Field label="Cliente / Contratante" error={errors.clientName?.message}>
                  <input {...register('clientName')} placeholder="Nome do cliente" className={inp(!!errors.clientName)} />
                </Field>
              </div>
              <Field label="Gerente de Projeto" error={errors.projectManager?.message}>
                <input {...register('projectManager')} placeholder="Nome do gerente de projeto" className={inp(!!errors.projectManager)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nível de Risco" error={errors.riskLevel?.message}>
                  <select {...register('riskLevel')} className={inp(!!errors.riskLevel)}>
                    <option value="">— Selecione —</option>
                    <option value="low">Baixo</option>
                    <option value="medium">Médio</option>
                    <option value="high">Alto</option>
                    <option value="critical">Crítico</option>
                  </select>
                </Field>
                <Field label="Prioridade" error={errors.priority?.message}>
                  <select {...register('priority')} className={inp(!!errors.priority)}>
                    <option value="">— Selecione —</option>
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                  </select>
                </Field>
              </div>
            </Section>

            {/* Localização */}
            <Section title="Localização">
              <Field label="Endereço da Obra" error={errors.address?.message}>
                <div className="flex gap-2">
                  <input
                    {...register('address')}
                    data-addr
                    placeholder="Ex: Rua Principal, 100 — São Manoel, BA"
                    className={cn(inp(!!errors.address), 'flex-1')}
                  />
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={geocoding}
                    title="Buscar endereço no mapa"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#f97316]/12 text-[#f97316] hover:bg-[#f97316]/20 disabled:opacity-50 transition-colors shrink-0"
                  >
                    {geocoding ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
                    Buscar
                  </button>
                </div>
                {geocodeError && (
                  <p className="text-[10px] text-[#ef4444] mt-1">{geocodeError}</p>
                )}
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Latitude" error={errors.lat?.message}>
                  <input
                    type="number"
                    step="any"
                    {...register('lat', { valueAsNumber: true })}
                    placeholder="-14.235"
                    className={inp(!!errors.lat)}
                  />
                </Field>
                <Field label="Longitude" error={errors.lng?.message}>
                  <input
                    type="number"
                    step="any"
                    {...register('lng', { valueAsNumber: true })}
                    placeholder="-51.925"
                    className={inp(!!errors.lng)}
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[#f97316] hover:text-[#ea580c] transition-colors"
              >
                <MapPin size={13} />
                {showMap ? 'Ocultar mapa' : 'Marcar no Mapa'}
                {latVal && lngVal ? ` (${latVal.toFixed(4)}, ${lngVal.toFixed(4)})` : ''}
              </button>
              {showMap && (
                <div className="rounded-lg overflow-hidden border border-[#525252]" style={{ height: 220 }}>
                  <MapContainer
                    center={mapCenter}
                    zoom={markerPos ? 13 : 5}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />
                    <MapClickHandler onMapClick={handleMapClick} />
                    {markerPos && <Marker position={markerPos} />}
                    <MapFlyTo pos={flyTarget} />
                  </MapContainer>
                </div>
              )}
              {showMap && (
                <p className="text-[10px] text-[#6b6b6b]">Clique no mapa para ajustar a posição exata, ou use "Buscar" para geocodificar o endereço.</p>
              )}
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
                  Excluir Projeto
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
                {isNew ? 'Criar Projeto' : 'Salvar Alterações'}
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
    'w-full bg-[#2c2c2c] border rounded-lg px-3 py-2 text-sm text-[#f5f5f5] outline-none placeholder:text-[#3f3f3f] transition-colors',
    hasError
      ? 'border-[#ef4444] focus:border-[#ef4444]'
      : 'border-[#525252] focus:border-[#f97316]'
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
      <legend className="text-[10px] uppercase tracking-widest text-[#6b6b6b] font-semibold mb-0.5 w-full pb-1 border-b border-[#525252]">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}
