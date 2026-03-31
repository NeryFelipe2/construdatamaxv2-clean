/**
 * NovoRdoPanel — 8-section collapsible form for creating a new RDO.
 * Sections: Informações Gerais, Condições Climáticas, Mão de Obra,
 *           Equipamentos, Serviços Executados, Avanço por Trecho,
 *           Georreferenciamento, Observações e Ocorrências.
 * Plus: photo upload (base64, max 20 files, 5 MB each).
 */
import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ChevronDown, ChevronRight, Plus, Trash2, MapPin, Upload, X,
  CloudSun, Users, Wrench, ClipboardList, Route, Camera, Pencil,
} from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { rdoSchema } from '../schemas'
import type { RdoFormData } from '../schemas'
import type { RdoEquipmentEntry, RdoServiceEntry, RdoTrechoEntry, RdoPhoto, RdoTrechoStatus } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEATHER_OPTIONS = [
  { value: 'good',   label: 'Bom' },
  { value: 'cloudy', label: 'Nublado' },
  { value: 'rain',   label: 'Chuva' },
  { value: 'storm',  label: 'Tempestade' },
] as const

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_PHOTOS   = 20
const MAX_SIZE_MB  = 5

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ─── Section component ────────────────────────────────────────────────────────

interface SectionProps {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}

function Section({ title, icon, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2.5 text-gray-100 font-medium text-sm">
          {icon}
          {title}
        </div>
        {open ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ─── Field helpers ────────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-red-400 text-xs mt-1">{msg}</p>
}

const inputCls = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500 transition-colors'
const selectCls = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-sky-500 transition-colors'

// ─── Main component ───────────────────────────────────────────────────────────

export function NovoRdoPanel() {
  const { rdos, addRdo, setActiveTab, loadTrechosFromPlanejamento } = useRdoStore()
  const nextNumber = rdos.length + 1

  // react-hook-form for core fields (rdoSchema)
  const { register, handleSubmit, reset, formState: { errors } } = useForm<RdoFormData>({
    resolver: zodResolver(rdoSchema),
    defaultValues: {
      date:        todayStr(),
      responsible: '',
      weather: { morning: 'good', afternoon: 'good', night: 'good', temperatureC: 25 },
      manpower: { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 },
      observations: '',
      incidents: '',
    },
  })

  // Dynamic arrays (not validated by rdoSchema directly — validated per-row below)
  const [equipment, setEquipment] = useState<Omit<RdoEquipmentEntry, 'id'>[]>([])
  const [services,  setServices]  = useState<Omit<RdoServiceEntry,  'id'>[]>([])
  const [trechos,   setTrechos]   = useState<Omit<RdoTrechoEntry,   'id'>[]>([])
  const [photos,    setPhotos]    = useState<Omit<RdoPhoto,         'id'>[]>([])
  const [employeeNames, setEmployeeNames] = useState<string[]>([])
  const [employeeInput, setEmployeeInput] = useState('')
  const [geolocation, setGeolocation] = useState<{ lat: string; lng: string } | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [loadingTrechos, setLoadingTrechos] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [rdoNumber, setRdoNumber] = useState(nextNumber)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Equipment helpers ──────────────────────────────────────────────────────
  function addEquipmentRow() {
    setEquipment((prev) => [...prev, { name: '', quantity: 1, hours: 8 }])
  }
  function updateEquipment(i: number, field: keyof Omit<RdoEquipmentEntry, 'id'>, val: string | number) {
    setEquipment((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }
  function removeEquipment(i: number) {
    setEquipment((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Service helpers ────────────────────────────────────────────────────────
  function addServiceRow() {
    setServices((prev) => [...prev, { description: '', quantity: 1, unit: 'm' }])
  }
  function updateService(i: number, field: keyof Omit<RdoServiceEntry, 'id'>, val: string | number) {
    setServices((prev) => prev.map((row, idx) => idx === i ? { ...row, [field]: val } : row))
  }
  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i))
  }

  // ── Trecho helpers ─────────────────────────────────────────────────────────
  function addTrechoRow() {
    setTrechos((prev) => [...prev, {
      trechoCode: '', trechoDescription: '',
      plannedMeters: 0, executedMeters: 0,
      status: 'not_started', source: 'manual',
    }])
  }
  function updateTrecho(i: number, updates: Partial<Omit<RdoTrechoEntry, 'id'>>) {
    setTrechos((prev) => prev.map((row, idx) => {
      if (idx !== i) return row
      const updated = { ...row, ...updates }
      // Auto-compute status from meters
      const exec = updated.executedMeters
      const plan = updated.plannedMeters
      if ('executedMeters' in updates || 'plannedMeters' in updates) {
        if (exec === 0) updated.status = 'not_started' as RdoTrechoStatus
        else if (plan > 0 && exec >= plan) updated.status = 'completed' as RdoTrechoStatus
        else updated.status = 'in_progress' as RdoTrechoStatus
      }
      return updated
    }))
  }
  function removeTrecho(i: number) {
    setTrechos((prev) => prev.filter((_, idx) => idx !== i))
  }
  async function handleLoadTrechos() {
    setLoadingTrechos(true)
    try {
      const loaded = await loadTrechosFromPlanejamento()
      if (loaded.length > 0) {
        setTrechos(loaded.map(({ id: _id, ...rest }) => rest))
      }
    } finally {
      setLoadingTrechos(false)
    }
  }

  // ── GPS ───────────────────────────────────────────────────────────────────
  function handleGetGps() {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não suportada pelo navegador.')
      return
    }
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocation({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        })
        setGeoLoading(false)
      },
      () => {
        setGeoError('Não foi possível obter localização. Verifique as permissões.')
        setGeoLoading(false)
      },
      { timeout: 10000 },
    )
  }

  // ── Photos ────────────────────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setPhotoError(null)

    if (photos.length + files.length > MAX_PHOTOS) {
      setPhotoError(`Máximo ${MAX_PHOTOS} fotos permitidas.`)
      return
    }

    files.forEach((file) => {
      if (!ALLOWED_MIME.includes(file.type)) {
        setPhotoError('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.')
        return
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setPhotoError(`"${file.name}" excede ${MAX_SIZE_MB} MB.`)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setPhotos((prev) => [
          ...prev,
          { base64: reader.result as string, label: file.name, uploadedAt: new Date().toISOString() },
        ])
      }
      reader.readAsDataURL(file)
    })
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  function removePhoto(i: number) {
    setPhotos((prev) => prev.filter((_, idx) => idx !== i))
  }
  function updatePhotoLabel(i: number, label: string) {
    setPhotos((prev) => prev.map((p, idx) => idx === i ? { ...p, label } : p))
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function onValid(data: RdoFormData) {
    setSubmitError(null)
    addRdo({
      date:        data.date,
      responsible: data.responsible,
      weather:     data.weather,
      manpower:    { ...data.manpower, employeeNames },
      observations: data.observations,
      incidents:   data.incidents,
      equipment:   equipment.map((e) => ({ ...e, id: crypto.randomUUID() })),
      services:    services.map((s) => ({ ...s, id: crypto.randomUUID() })),
      trechos:     trechos.map((t) => ({ ...t, id: crypto.randomUUID() })),
      photos:      photos.map((p) => ({ ...p, id: crypto.randomUUID() })),
      geolocation,
    })
    setActiveTab('historico')
  }

  function handleClear() {
    if (!confirm('Limpar todos os dados do formulário?')) return
    reset()
    setEquipment([])
    setServices([])
    setTrechos([])
    setPhotos([])
    setEmployeeNames([])
    setEmployeeInput('')
    setGeolocation(null)
    setGeoError(null)
    setPhotoError(null)
    setSubmitError(null)
    setRdoNumber(rdos.length + 1)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">Novo RDO</h2>
        <span className="text-gray-400 text-sm">RDO #{rdoNumber}</span>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="space-y-4">

        {/* 1. Informações Gerais */}
        <Section title="Informações Gerais" icon={<ClipboardList size={16} className="text-sky-400" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Data</label>
              <input type="date" {...register('date')} className={inputCls} />
              <FieldError msg={errors.date?.message} />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Nº RDO</label>
              <input
                type="number"
                value={rdoNumber}
                onChange={(e) => setRdoNumber(Number(e.target.value))}
                className={inputCls}
                min={1}
              />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Responsável</label>
              <input type="text" {...register('responsible')} placeholder="Nome do responsável" className={inputCls} />
              <FieldError msg={errors.responsible?.message} />
            </div>
          </div>
        </Section>

        {/* 2. Condições Climáticas */}
        <Section title="Condições Climáticas" icon={<CloudSun size={16} className="text-sky-400" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['morning', 'afternoon', 'night'] as const).map((period) => {
              const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
              return (
                <div key={period}>
                  <label className="block text-gray-400 text-xs mb-1">{labels[period]}</label>
                  <select {...register(`weather.${period}`)} className={selectCls}>
                    {WEATHER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
            <div>
              <label className="block text-gray-400 text-xs mb-1">Temperatura (°C)</label>
              <input
                type="number"
                step="0.1"
                {...register('weather.temperatureC', { valueAsNumber: true })}
                className={inputCls}
                placeholder="25"
              />
              <FieldError msg={errors.weather?.temperatureC?.message} />
            </div>
          </div>
        </Section>

        {/* 3. Mão de Obra */}
        <Section title="Mão de Obra" icon={<Users size={16} className="text-sky-400" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {([
              ['foremanCount',  'Encarregado'],
              ['officialCount', 'Oficial'],
              ['helperCount',   'Ajudante'],
              ['operatorCount', 'Operador'],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-gray-400 text-xs mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  {...register(`manpower.${field}`, { valueAsNumber: true })}
                  className={inputCls}
                  placeholder="0"
                />
                <FieldError msg={errors.manpower?.[field]?.message} />
              </div>
            ))}
          </div>
          {/* Employee name chips */}
          <div>
            <label className="block text-gray-400 text-xs mb-1">Funcionários Presentes</label>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {employeeNames.map((name, i) => (
                <span key={i} className="flex items-center gap-1 bg-sky-900/30 border border-sky-700/40 text-sky-300 text-xs px-2 py-0.5 rounded-full">
                  {name}
                  <button
                    type="button"
                    onClick={() => setEmployeeNames((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-sky-500 hover:text-red-400 ml-0.5"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={employeeInput}
                onChange={(e) => setEmployeeInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ',') && employeeInput.trim()) {
                    e.preventDefault()
                    const name = employeeInput.trim()
                    if (name && !employeeNames.includes(name)) {
                      setEmployeeNames((prev) => [...prev, name])
                    }
                    setEmployeeInput('')
                  }
                }}
                placeholder="Nome + Enter para adicionar"
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() => {
                  const name = employeeInput.trim()
                  if (name && !employeeNames.includes(name)) {
                    setEmployeeNames((prev) => [...prev, name])
                  }
                  setEmployeeInput('')
                }}
                className="px-3 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded-lg text-sm transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {employeeNames.length > 0 && (
              <p className="text-gray-600 text-xs mt-1">{employeeNames.length} funcionário{employeeNames.length !== 1 ? 's' : ''} registrado{employeeNames.length !== 1 ? 's' : ''}</p>
            )}
          </div>
        </Section>

        {/* 4. Equipamentos */}
        <Section title="Equipamentos" icon={<Wrench size={16} className="text-sky-400" />}>
          <div className="space-y-2">
            {equipment.length === 0 && (
              <p className="text-gray-500 text-sm italic">Nenhum equipamento adicionado.</p>
            )}
            {equipment.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateEquipment(i, 'name', e.target.value)}
                  placeholder="Nome do equipamento"
                  className={`${inputCls} flex-1`}
                />
                <input
                  type="number"
                  value={row.quantity}
                  onChange={(e) => updateEquipment(i, 'quantity', Number(e.target.value))}
                  min={0} max={99}
                  className={`${inputCls} w-20`}
                  title="Quantidade"
                />
                <input
                  type="number"
                  value={row.hours}
                  onChange={(e) => updateEquipment(i, 'hours', Number(e.target.value))}
                  min={0} max={24} step={0.5}
                  className={`${inputCls} w-20`}
                  title="Horas"
                />
                <span className="text-gray-500 text-xs">h</span>
                <button type="button" onClick={() => removeEquipment(i)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {equipment.length > 0 && (
              <p className="text-gray-500 text-xs">
                Total: {equipment.reduce((s, r) => s + r.quantity * r.hours, 0).toFixed(1)} h·equip
              </p>
            )}
            <button
              type="button"
              onClick={addEquipmentRow}
              className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-sm mt-1"
            >
              <Plus size={14} /> Adicionar Equipamento
            </button>
          </div>
        </Section>

        {/* 5. Serviços Executados */}
        <Section title="Serviços Executados" icon={<ClipboardList size={16} className="text-sky-400" />}>
          <div className="space-y-2">
            {services.length === 0 && (
              <p className="text-gray-500 text-sm italic">Nenhum serviço adicionado.</p>
            )}
            {services.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={row.description}
                  onChange={(e) => updateService(i, 'description', e.target.value)}
                  placeholder="Descrição do serviço"
                  className={`${inputCls} flex-1`}
                />
                <input
                  type="number"
                  value={row.quantity}
                  onChange={(e) => updateService(i, 'quantity', Number(e.target.value))}
                  min={0}
                  className={`${inputCls} w-24`}
                  title="Quantidade"
                />
                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateService(i, 'unit', e.target.value)}
                  placeholder="un"
                  className={`${inputCls} w-16`}
                  title="Unidade"
                />
                <button type="button" onClick={() => removeService(i)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addServiceRow}
              className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-sm mt-1"
            >
              <Plus size={14} /> Adicionar Serviço
            </button>
          </div>
        </Section>

        {/* 6. Avanço por Trecho */}
        <Section title="Avanço por Trecho" icon={<Route size={16} className="text-sky-400" />}>
          <div className="space-y-3">
            {trechos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs">
                      <th className="text-left pb-2 font-medium">Código</th>
                      <th className="text-left pb-2 font-medium">Descrição</th>
                      <th className="text-left pb-2 font-medium">Planejado (m)</th>
                      <th className="text-left pb-2 font-medium">Executado (m)</th>
                      <th className="text-left pb-2 font-medium">Sistema</th>
                      <th className="text-left pb-2 font-medium">Status</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="space-y-1">
                    {trechos.map((row, i) => (
                      <tr key={i} className="border-t border-gray-700">
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            value={row.trechoCode}
                            onChange={(e) => updateTrecho(i, { trechoCode: e.target.value })}
                            className={`${inputCls} w-20`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="text"
                            value={row.trechoDescription}
                            onChange={(e) => updateTrecho(i, { trechoDescription: e.target.value })}
                            className={`${inputCls} w-36`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            value={row.plannedMeters}
                            onChange={(e) => updateTrecho(i, { plannedMeters: Number(e.target.value) })}
                            min={0} className={`${inputCls} w-24`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            type="number"
                            value={row.executedMeters}
                            onChange={(e) => updateTrecho(i, { executedMeters: Number(e.target.value) })}
                            min={0} className={`${inputCls} w-24`}
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select
                            value={row.system ?? ''}
                            onChange={(e) => updateTrecho(i, { system: (e.target.value as RdoTrechoEntry['system']) || undefined })}
                            className="bg-[#14294e] border border-[#1f3c5e] rounded px-2 py-1 text-xs text-[#f5f5f5]"
                          >
                            <option value="">Sistema...</option>
                            <option value="agua">Água</option>
                            <option value="esgoto">Esgoto</option>
                            <option value="drenagem">Drenagem</option>
                            <option value="estrutura">Estrutura</option>
                            <option value="pavimentacao">Pavimentação</option>
                            <option value="outro">Outro</option>
                          </select>
                        </td>
                        <td className="py-1.5 pr-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                            row.status === 'completed'   ? 'bg-emerald-900/50 text-emerald-300' :
                            row.status === 'in_progress' ? 'bg-yellow-900/50 text-yellow-300'  :
                                                           'bg-gray-700 text-gray-400'
                          }`}>
                            {row.status === 'completed'   ? 'Concluído'     :
                             row.status === 'in_progress' ? 'Em Execução'  :
                                                            'Não Iniciado'}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <button type="button" onClick={() => removeTrecho(i)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {trechos.length === 0 && (
              <p className="text-gray-500 text-sm italic">Nenhum trecho adicionado.</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={addTrechoRow}
                className="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-sm"
              >
                <Plus size={14} /> Adicionar Trecho
              </button>
              <button
                type="button"
                onClick={handleLoadTrechos}
                disabled={loadingTrechos}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors disabled:opacity-50"
              >
                {loadingTrechos ? 'Carregando...' : '↓ Carregar da Rede'}
              </button>
            </div>
          </div>
        </Section>

        {/* 7. Georreferenciamento */}
        <Section title="Georreferenciamento" icon={<MapPin size={16} className="text-sky-400" />} defaultOpen={false}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-400 text-xs mb-1">Latitude</label>
                <input
                  type="text"
                  value={geolocation?.lat ?? ''}
                  onChange={(e) => setGeolocation((g) => ({ lat: e.target.value, lng: g?.lng ?? '' }))}
                  placeholder="-23.550520"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-gray-400 text-xs mb-1">Longitude</label>
                <input
                  type="text"
                  value={geolocation?.lng ?? ''}
                  onChange={(e) => setGeolocation((g) => ({ lat: g?.lat ?? '', lng: e.target.value }))}
                  placeholder="-46.633308"
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleGetGps}
              disabled={geoLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm transition-colors disabled:opacity-50"
            >
              <MapPin size={14} />
              {geoLoading ? 'Obtendo...' : 'Obter GPS'}
            </button>
            {geoError && <p className="text-red-400 text-sm">{geoError}</p>}
          </div>
        </Section>

        {/* 8. Observações e Ocorrências */}
        <Section title="Observações e Ocorrências" icon={<Pencil size={16} className="text-sky-400" />} defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-1">Observações Gerais</label>
              <textarea
                {...register('observations')}
                rows={4}
                placeholder="Descreva as atividades realizadas, condições do local, etc."
                className={`${inputCls} resize-none`}
              />
              <FieldError msg={errors.observations?.message} />
            </div>
            <div>
              <label className="block text-gray-400 text-xs mb-1">Ocorrências / Incidentes</label>
              <textarea
                {...register('incidents')}
                rows={4}
                placeholder="Registre acidentes, interrupções, ocorrências relevantes..."
                className={`${inputCls} resize-none`}
              />
              <FieldError msg={errors.incidents?.message} />
            </div>
          </div>
        </Section>

        {/* Photo upload */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-5 space-y-4">
          <div className="flex items-center gap-2.5 text-gray-100 font-medium text-sm">
            <Camera size={16} className="text-sky-400" />
            Registro Fotográfico
            <span className="text-gray-500 text-xs font-normal">({photos.length}/{MAX_PHOTOS})</span>
          </div>

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-600 hover:border-sky-500 rounded-lg p-6 text-center cursor-pointer transition-colors"
          >
            <Upload size={24} className="mx-auto text-gray-500 mb-2" />
            <p className="text-gray-400 text-sm">Clique para selecionar fotos</p>
            <p className="text-gray-600 text-xs mt-1">JPEG, PNG, WebP, GIF · máx. {MAX_SIZE_MB} MB por arquivo · {MAX_PHOTOS} fotos</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          {photoError && <p className="text-red-400 text-sm">{photoError}</p>}

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map((photo, i) => (
                <div key={i} className="relative group">
                  <img
                    src={photo.base64}
                    alt={photo.label}
                    className="w-full h-28 object-cover rounded-lg border border-gray-700"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-gray-900/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={13} className="text-red-400" />
                  </button>
                  <input
                    type="text"
                    value={photo.label}
                    onChange={(e) => updatePhotoLabel(i, e.target.value)}
                    placeholder="Legenda"
                    className="mt-1.5 w-full bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 px-2 py-1 focus:outline-none focus:border-sky-500"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {submitError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium transition-colors"
          >
            Limpar
          </button>
          <button
            type="submit"
            className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            Salvar RDO
          </button>
        </div>
      </form>
    </div>
  )
}
