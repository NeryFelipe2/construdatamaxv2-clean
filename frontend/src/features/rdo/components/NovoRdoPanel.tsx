/**
 * NovoRdoPanel — 8-section collapsible form for creating a new RDO.
 * Sections: Informações Gerais, Condições Climáticas, Mão de Obra,
 *           Equipamentos, Serviços Executados, Avanço por Trecho,
 *           Georreferenciamento, Observações e Ocorrências.
 * Plus: photo upload (base64, max 20 files, 5 MB each).
 */
import { useEffect, useMemo, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ChevronDown, ChevronRight, Plus, Trash2, MapPin, Upload, X,
  CloudSun, Users, Wrench, ClipboardList, Route, Camera, Pencil, ClipboardPaste, FileText, DollarSign,
} from 'lucide-react'
import { useRdoStore, type RdoPresencaInput } from '@/store/rdoStore'
import { useCompanySettingsStore } from '@/store/companySettingsStore'
import { useProjectContext } from '@/store/projectContext'
import { useEquipes } from '@/hooks/useEquipes'
import { usePessoas, type CategoriaRdo } from '@/hooks/usePessoas'
import { supabase } from '@/lib/supabase'
import { matchPessoa, type PessoaCandidata } from '@/lib/matching/pessoaMatch'
import { AutocompletePessoa } from '@/features/pessoal/components/AutocompletePessoa'
import { rdoSchema } from '../schemas'
import type { RdoFormData } from '../schemas'
import type { RdoEquipmentEntry, RdoServiceEntry, RdoTrechoEntry, RdoPhoto, RdoTrechoStatus } from '@/types'
import { TextParseModal } from './TextParseModal'
import { parseRdoText, type ParsedRdoData } from '../utils/parseRdoText'

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

// ─── Presença nominal (módulo Pessoal) ───────────────────────────────────────

/** linha da lista nominal, com a categoria do cargo pra derivar os contadores. */
interface PresencaRow extends RdoPresencaInput {
  cargoCategoria: CategoriaRdo | null
}

const MOTIVOS_AUSENCIA: { value: string; label: string }[] = [
  { value: 'falta',       label: 'Falta' },
  { value: 'atestado',    label: 'Atestado' },
  { value: 'folga',       label: 'Folga' },
  { value: 'ferias',      label: 'Férias' },
  { value: 'transferido', label: 'Transferido' },
  { value: 'acidente',    label: 'Acidente' },
  { value: 'outro',       label: 'Outro' },
]

/** chave de deduplicação de linha (pessoa cadastrada por id; avulso por nome). */
function chavePresenca(p: { pessoaId: string | null; nome: string }): string {
  return p.pessoaId ?? `nome:${p.nome.trim().toLowerCase()}`
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
    <div className="bg-[#3d3d3d] rounded-xl overflow-hidden border border-[#525252]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-750 transition-colors"
      >
        <div className="flex items-center gap-2.5 text-gray-100 font-medium text-sm">
          {icon}
          {title}
        </div>
        {open ? <ChevronDown size={16} className="text-[#a3a3a3]" /> : <ChevronRight size={16} className="text-[#a3a3a3]" />}
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

const inputCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors'
const selectCls = 'w-full bg-[#484848] border border-[#5e5e5e] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-[#f97316]/50 transition-colors'

// ─── Main component ───────────────────────────────────────────────────────────

export function NovoRdoPanel() {
  const { rdos, addRdo, createRdoForProject, createRdoTextForProject, setActiveTab, loadTrechosFromPlanejamento, isSaving } = useRdoStore()
  const logos = useCompanySettingsStore((s) => s.logos)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const nextNumber = rdos.length + 1

  // react-hook-form for core fields (rdoSchema)
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<RdoFormData>({
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
  const [submitError, setSubmitError]     = useState<string | null>(null)
  const [rdoNumber, setRdoNumber]         = useState(nextNumber)
  const [showTextParse, setShowTextParse]   = useState(false)
  const [selectedLogoId, setSelectedLogoId] = useState<string | undefined>(undefined)

  // ── Extra identification fields (not in rdoSchema Zod) ────────────────────
  const [rdoLocal,            setRdoLocal]            = useState('')
  const [rdoGerenteContrato,  setRdoGerenteContrato]  = useState('')
  const [rdoTecnicoSeg,       setRdoTecnicoSeg]       = useState('')
  const [rdoEmpreiteira,      setRdoEmpreiteira]      = useState('')
  const [rdoServico,          setRdoServico]          = useState('')
  const [rdoOcorrencias,      setRdoOcorrencias]      = useState('')
  const [rdoFuncDiretos,      setRdoFuncDiretos]      = useState(0)
  const [rdoFuncIndiretos,    setRdoFuncIndiretos]    = useState(0)
  const [rdoQtdEquip,         setRdoQtdEquip]         = useState(0)
  const [rdoNumeroOS,         setRdoNumeroOS]         = useState('')
  const [rdoContrato,         setRdoContrato]         = useState('')
  const [rdoClimaManha,       setRdoClimaManha]       = useState('')
  const [rdoClimaTarde,       setRdoClimaTarde]       = useState('')
  const [rdoClimaNoite,       setRdoClimaNoite]       = useState('')
  const [machineCostBRL,      setMachineCostBRL]      = useState(0)
  const [equipmentCostBRL,    setEquipmentCostBRL]    = useState(0)
  const [rentalCostBRL,       setRentalCostBRL]       = useState(0)
  const [directCostBRL,       setDirectCostBRL]       = useState(0)
  const [indirectCostBRL,     setIndirectCostBRL]     = useState(0)
  const [stoppageNotes,       setStoppageNotes]       = useState('')
  const [productionNotes,     setProductionNotes]     = useState('')
  const [lpsLinked,           setLpsLinked]           = useState(true)

  // ── Presença NOMINAL (módulo Pessoal — aditivo, lista vazia = fluxo antigo) ─
  const { equipes } = useEquipes()
  const pessoal = usePessoas()
  const [presencas, setPresencas]           = useState<PresencaRow[]>([])
  const [equipeDoDia, setEquipeDoDia]       = useState('')
  const [carregandoEquipe, setCarregandoEquipe] = useState(false)
  const [manpowerManual, setManpowerManual] = useState(false)
  const [avulsoNome, setAvulsoNome]         = useState('')
  const [outraNomeLivre, setOutraNomeLivre] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // candidatos do matcher: cada pessoa + cada alias apontando pro mesmo id
  const candidatosPessoa = useMemo<PessoaCandidata[]>(() => {
    const out: PessoaCandidata[] = pessoal.pessoas.map((p) => ({ pessoaId: p.id, nome: p.nome_completo }))
    for (const a of pessoal.apelidos) out.push({ pessoaId: a.pessoa_id, nome: a.alias_raw })
    return out
  }, [pessoal.pessoas, pessoal.apelidos])

  /** casa um nome livre com o cadastro (R1/R2/R4) e devolve a pessoa, se achou. */
  function resolverPessoaPorNome(nome: string) {
    const m = matchPessoa(nome, candidatosPessoa)
    if (!m) return null
    return pessoal.pessoas.find((p) => p.id === m.pessoaId) ?? null
  }

  function adicionarPresenca(row: PresencaRow) {
    setPresencas((prev) => {
      const chaves = new Set(prev.map(chavePresenca))
      if (chaves.has(chavePresenca(row))) return prev
      return [...prev, row]
    })
  }

  /** Carrega os membros VIGENTES da equipe (view equipe_membros) na lista. */
  async function handleCarregarEquipe() {
    if (!equipeDoDia) return
    setCarregandoEquipe(true)
    try {
      let membros: { nome: string; funcao: string | null }[] = []
      if (supabase) {
        const { data, error } = await supabase
          .from('equipe_membros')
          .select('id, equipe_id, nome, funcao, ordem')
          .eq('equipe_id', equipeDoDia)
          .order('ordem')
        if (!error && data) membros = data as { nome: string; funcao: string | null }[]
      }
      if (membros.length === 0) {
        // fallback: membros já carregados no hook de equipes (cache/estático)
        const card = equipes.find((e) => e.id === equipeDoDia)
        membros = (card?.membros ?? []).map((m) => ({ nome: m.nome, funcao: m.funcao }))
      }
      const equipeNome = equipes.find((e) => e.id === equipeDoDia)?.equipe ?? null
      for (const m of membros) {
        const pessoa = resolverPessoaPorNome(m.nome)
        adicionarPresenca({
          pessoaId: pessoa?.id ?? null,
          nome: m.nome,
          equipeId: equipeDoDia,
          equipeNome,
          cargoId: pessoa?.cargo?.id ?? null,
          cargoCategoria: pessoa?.cargo?.categoria_rdo ?? null,
          funcao: m.funcao || pessoa?.cargo?.nome || null,
          presente: true,
          motivoAusencia: null,
          horasNormais: 8,
          horasExtras: 0,
        })
      }
    } finally {
      setCarregandoEquipe(false)
    }
  }

  function atualizarPresenca(i: number, patch: Partial<PresencaRow>) {
    setPresencas((prev) =>
      prev.map((row, idx) => {
        if (idx !== i) return row
        const next = { ...row, ...patch }
        // desmarcado → motivo obrigatório (default 'falta'); marcado → limpa motivo
        if (patch.presente === false && !next.motivoAusencia) next.motivoAusencia = 'falta'
        if (patch.presente === true) next.motivoAusencia = null
        return next
      }),
    )
  }

  function removerPresenca(i: number) {
    setPresencas((prev) => prev.filter((_, idx) => idx !== i))
  }

  function adicionarAvulso() {
    const nome = avulsoNome.trim()
    if (!nome) return
    adicionarPresenca({
      pessoaId: null,
      nome,
      equipeId: null,
      equipeNome: null,
      cargoId: null,
      cargoCategoria: null,
      funcao: null,
      presente: true,
      motivoAusencia: null,
      horasNormais: 8,
      horasExtras: 0,
    })
    setAvulsoNome('')
  }

  // contadores DERIVADOS da lista (presentes): encarregado/oficial/operador;
  // ajudante, indireto e SEM CARGO caem em ajudante (soma sempre = presentes).
  const contadoresDerivados = useMemo(() => {
    const c = { foremanCount: 0, officialCount: 0, helperCount: 0, operatorCount: 0 }
    for (const p of presencas) {
      if (!p.presente) continue
      if (p.cargoCategoria === 'encarregado') c.foremanCount++
      else if (p.cargoCategoria === 'oficial') c.officialCount++
      else if (p.cargoCategoria === 'operador') c.operatorCount++
      else c.helperCount++
    }
    return c
  }, [presencas])

  const contadoresDerivadosAtivos = presencas.length > 0 && !manpowerManual

  useEffect(() => {
    if (!contadoresDerivadosAtivos) return
    setValue('manpower.foremanCount',  contadoresDerivados.foremanCount)
    setValue('manpower.officialCount', contadoresDerivados.officialCount)
    setValue('manpower.helperCount',   contadoresDerivados.helperCount)
    setValue('manpower.operatorCount', contadoresDerivados.operatorCount)
  }, [contadoresDerivadosAtivos, contadoresDerivados, setValue])

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

  // ── Text paste auto-fill ─────────────────────────────────────────────────
  const NI = 'Não informado'

  function handleApplyParsed(data: ParsedRdoData) {
    if (data.date)                       setValue('date', data.date)
    if (data.responsible)                setValue('responsible', data.responsible)
    if (data.manpower.foremanCount)      setValue('manpower.foremanCount',  data.manpower.foremanCount)
    if (data.manpower.officialCount)     setValue('manpower.officialCount', data.manpower.officialCount)
    if (data.manpower.helperCount)       setValue('manpower.helperCount',   data.manpower.helperCount)
    if (data.manpower.operatorCount)     setValue('manpower.operatorCount', data.manpower.operatorCount)
    if (data.observations)               setValue('observations', data.observations)
    if (data.ocorrencias && data.ocorrencias !== NI) setValue('incidents', data.ocorrencias)
    setEquipment((prev) => [...prev, ...data.equipment])
    setServices((prev)  => [...prev, ...data.services])
    setTrechos((prev)   => [...prev, ...data.trechos])
    setEmployeeNames((prev) => [...new Set([...prev, ...data.employeeNames])])
    // Extra fields
    if (data.local !== NI)              setRdoLocal(data.local)
    if (data.gerenteContrato !== NI)    setRdoGerenteContrato(data.gerenteContrato)
    if (data.tecnicoSeguranca !== NI)   setRdoTecnicoSeg(data.tecnicoSeguranca)
    if (data.nomeEmpreiteira !== NI)    setRdoEmpreiteira(data.nomeEmpreiteira)
    if (data.servicoExecutar !== NI)    setRdoServico(data.servicoExecutar)
    if (data.ocorrencias !== NI)        setRdoOcorrencias(data.ocorrencias)
    if (data.funcionariosDiretos > 0)   setRdoFuncDiretos(data.funcionariosDiretos)
    if (data.funcionariosIndiretos > 0) setRdoFuncIndiretos(data.funcionariosIndiretos)
    if (data.qtdEquipamentosFerramentas > 0) setRdoQtdEquip(data.qtdEquipamentosFerramentas)
    if (data.numeroOS !== NI)           setRdoNumeroOS(data.numeroOS)
    if (data.numeroContrato !== NI)     setRdoContrato(data.numeroContrato)
    if (data.climaManha !== NI)         setRdoClimaManha(data.climaManha)
    if (data.climaTarde !== NI)         setRdoClimaTarde(data.climaTarde)
    if (data.climaNoite !== NI)         setRdoClimaNoite(data.climaNoite)
    setShowTextParse(false)
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
  async function onValid(data: RdoFormData) {
    if (!activeProjectId) {
      setSubmitError('Nenhum projeto selecionado. Por favor, selecione um projeto antes de salvar.')
      return
    }

    setSubmitError(null)
    // lista nominal ativa → nomes derivados dela; vazia → chips legados intactos
    const nomesPresentes = presencas.length > 0
      ? presencas.filter((p) => p.presente).map((p) => p.nome)
      : employeeNames
    const payload = {
      date:        data.date,
      responsible: data.responsible,
      weather:     data.weather,
      manpower:    { ...data.manpower, employeeNames: nomesPresentes },
      presencas:   presencas.length > 0
        ? presencas.map(({ cargoCategoria: _cat, ...rest }) => rest)
        : undefined,
      observations: data.observations,
      incidents:   data.incidents,
      equipment:   equipment.map((e) => ({ ...e, id: crypto.randomUUID() })),
      services:    services.map((s) => ({ ...s, id: crypto.randomUUID() })),
      trechos:     trechos.map((t) => ({ ...t, id: crypto.randomUUID() })),
      photos:      photos.map((p) => ({ ...p, id: crypto.randomUUID() })),
      geolocation,
      logoId:      selectedLogoId,
      // Identification fields
      local:                      rdoLocal || undefined,
      gerenteContrato:            rdoGerenteContrato || undefined,
      tecnicoSeguranca:           rdoTecnicoSeg || undefined,
      nomeEmpreiteira:            rdoEmpreiteira || undefined,
      servicoExecutar:            rdoServico || undefined,
      ocorrencias:                rdoOcorrencias || undefined,
      funcionariosDiretos:        rdoFuncDiretos || undefined,
      funcionariosIndiretos:      rdoFuncIndiretos || undefined,
      qtdEquipamentosFerramentas: rdoQtdEquip || undefined,
      numeroOS:                   rdoNumeroOS || undefined,
      numeroContrato:             rdoContrato || undefined,
      climaManha:                 rdoClimaManha || undefined,
      climaTarde:                 rdoClimaTarde || undefined,
      climaNoite:                 rdoClimaNoite || undefined,
      machineCostBRL,
      equipmentCostBRL,
      rentalCostBRL,
      directCostBRL,
      indirectCostBRL,
      dailyCostBRL: machineCostBRL + equipmentCostBRL + rentalCostBRL + directCostBRL + indirectCostBRL,
      stoppageNotes,
      productionNotes,
      lpsLinked,
    }

    try {
      const created = await createRdoForProject(activeProjectId, payload)
      if (created) {
        alert('RDO enviado com sucesso!')
        setActiveTab('historico')
      } else {
        addRdo(payload)
        alert('Backend indisponível: RDO salvo localmente.')
        setActiveTab('historico')
      }
    } catch (err: any) {
      console.error('Save error:', err)
      addRdo(payload)
      alert('Backend indisponível: RDO salvo localmente.')
      setActiveTab('historico')
    }
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
    setPresencas([])
    setEquipeDoDia('')
    setManpowerManual(false)
    setAvulsoNome('')
    setOutraNomeLivre('')
    setGeolocation(null)
    setGeoError(null)
    setPhotoError(null)
    setSubmitError(null)
    setSelectedLogoId(undefined)
    setRdoLocal(''); setRdoGerenteContrato(''); setRdoTecnicoSeg('')
    setRdoEmpreiteira(''); setRdoServico(''); setRdoOcorrencias('')
    setRdoFuncDiretos(0); setRdoFuncIndiretos(0); setRdoQtdEquip(0)
    setRdoNumeroOS(''); setRdoContrato('')
    setRdoClimaManha(''); setRdoClimaTarde(''); setRdoClimaNoite('')
    setMachineCostBRL(0); setEquipmentCostBRL(0); setRentalCostBRL(0)
    setDirectCostBRL(0); setIndirectCostBRL(0); setStoppageNotes(''); setProductionNotes(''); setLpsLinked(true)
    setRdoNumber(rdos.length + 1)
  }

  async function handleCreateFromText(text: string) {
    if (!activeProjectId) {
      setSubmitError('Nenhum projeto selecionado. Por favor, selecione um projeto antes de salvar.')
      return
    }
    const created = await createRdoTextForProject(activeProjectId, text)
    if (created) {
      alert('Texto processado: RDO, custos, planejamento e desvios gravados.')
      setActiveTab('historico')
    } else {
      const parsed = parseRdoText(text)
      addRdo({
        date: parsed.date || new Date().toISOString().slice(0, 10),
        responsible: parsed.responsible || '',
        weather: { morning: 'good', afternoon: 'good', night: 'good' },
        manpower: { ...parsed.manpower, employeeNames: parsed.employeeNames },
        equipment: parsed.equipment.map((e) => ({ ...e, id: crypto.randomUUID() })),
        services: parsed.services.map((s) => ({ ...s, id: crypto.randomUUID() })),
        trechos: parsed.trechos.map((t) => ({ ...t, id: crypto.randomUUID() })),
        geolocation: null,
        observations: parsed.observations,
        incidents: parsed.ocorrencias !== 'Não informado' ? parsed.ocorrencias : '',
        photos: [],
        local: parsed.local !== 'Não informado' ? parsed.local : undefined,
        gerenteContrato: parsed.gerenteContrato !== 'Não informado' ? parsed.gerenteContrato : undefined,
        tecnicoSeguranca: parsed.tecnicoSeguranca !== 'Não informado' ? parsed.tecnicoSeguranca : undefined,
        nomeEmpreiteira: parsed.nomeEmpreiteira !== 'Não informado' ? parsed.nomeEmpreiteira : undefined,
        servicoExecutar: parsed.servicoExecutar !== 'Não informado' ? parsed.servicoExecutar : undefined,
        ocorrencias: parsed.ocorrencias !== 'Não informado' ? parsed.ocorrencias : undefined,
        funcionariosDiretos: parsed.funcionariosDiretos || undefined,
        funcionariosIndiretos: parsed.funcionariosIndiretos || undefined,
        qtdEquipamentosFerramentas: parsed.qtdEquipamentosFerramentas || undefined,
        numeroOS: parsed.numeroOS !== 'Não informado' ? parsed.numeroOS : undefined,
        numeroContrato: parsed.numeroContrato !== 'Não informado' ? parsed.numeroContrato : undefined,
        climaManha: parsed.climaManha !== 'Não informado' ? parsed.climaManha : undefined,
        climaTarde: parsed.climaTarde !== 'Não informado' ? parsed.climaTarde : undefined,
        climaNoite: parsed.climaNoite !== 'Não informado' ? parsed.climaNoite : undefined,
        origem: 'texto-local',
      })
      alert('Backend indisponível: RDO salvo localmente a partir do texto.')
      setActiveTab('historico')
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-white font-semibold text-lg">Novo RDO</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTextParse(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#f97316]/40 bg-[#f97316]/10 text-[#f97316] hover:bg-[#f97316]/20 transition-colors"
          >
            <ClipboardPaste size={13} />
            Preencher com Texto
          </button>
          <span className="text-[#a3a3a3] text-sm">RDO #{rdoNumber}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onValid)} className="space-y-4">

        {/* 1. Informações Gerais */}
        <Section title="Informações Gerais" icon={<ClipboardList size={16} className="text-[#f97316]" />}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Data</label>
              <input type="date" {...register('date')} className={inputCls} />
              <FieldError msg={errors.date?.message} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Nº RDO</label>
              <input
                type="number"
                value={rdoNumber}
                onChange={(e) => setRdoNumber(Number(e.target.value))}
                className={inputCls}
                min={1}
              />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Responsável</label>
              <input type="text" {...register('responsible')} placeholder="Nome do responsável" className={inputCls} />
              <FieldError msg={errors.responsible?.message} />
            </div>
          </div>

          {/* Logo selector */}
          {logos.length > 0 && (
            <div className="mt-4">
              <label className="block text-[10px] font-semibold tracking-widest uppercase text-[#6b6b6b] mb-2">
                Logo para o PDF
              </label>
              <div className="flex flex-wrap gap-2">
                {/* No logo option */}
                <button
                  type="button"
                  onClick={() => setSelectedLogoId(undefined)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                    selectedLogoId === undefined
                      ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                      : 'border-[#525252] text-[#6b6b6b] hover:border-[#404040]'
                  }`}
                >
                  Sem logo
                </button>
                {logos.map((logo) => (
                  <button
                    key={logo.id}
                    type="button"
                    onClick={() => setSelectedLogoId(logo.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                      selectedLogoId === logo.id
                        ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                        : 'border-[#525252] text-[#a3a3a3] hover:border-[#404040] hover:text-[#f5f5f5]'
                    }`}
                  >
                    <div className="w-8 h-5 bg-white rounded flex items-center justify-center overflow-hidden shrink-0">
                      <img src={logo.base64} alt={logo.name} className="max-h-4 max-w-full object-contain" />
                    </div>
                    {logo.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* 1b. Identificação do Contrato */}
        <Section title="Identificação do Contrato" icon={<FileText size={16} className="text-[#f97316]" />} defaultOpen={false}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Local / Obra</label>
              <input type="text" value={rdoLocal} onChange={(e) => setRdoLocal(e.target.value)} placeholder="Ex: Rua das Palmeiras, 100 — Centro" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Nº Ordem de Serviço</label>
              <input type="text" value={rdoNumeroOS} onChange={(e) => setRdoNumeroOS(e.target.value)} placeholder="Ex: 2024/0587" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">N° do Contrato</label>
              <input type="text" value={rdoContrato} onChange={(e) => setRdoContrato(e.target.value)} placeholder="Ex: CT-2024-123" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Nome da Empreiteira</label>
              <input type="text" value={rdoEmpreiteira} onChange={(e) => setRdoEmpreiteira(e.target.value)} placeholder="Ex: Construtora ABC Ltda" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Gerente de Contrato</label>
              <input type="text" value={rdoGerenteContrato} onChange={(e) => setRdoGerenteContrato(e.target.value)} placeholder="Nome do gerente" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Técnico de Segurança</label>
              <input type="text" value={rdoTecnicoSeg} onChange={(e) => setRdoTecnicoSeg(e.target.value)} placeholder="Nome do técnico de segurança" className={inputCls} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Func. Diretos</label>
              <input type="number" value={rdoFuncDiretos} onChange={(e) => setRdoFuncDiretos(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Func. Indiretos</label>
              <input type="number" value={rdoFuncIndiretos} onChange={(e) => setRdoFuncIndiretos(Number(e.target.value))} min={0} className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Qtd. Equipamentos</label>
              <input type="number" value={rdoQtdEquip} onChange={(e) => setRdoQtdEquip(Number(e.target.value))} min={0} className={inputCls} />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-[#a3a3a3] text-xs mb-1">Serviço a ser Executado</label>
            <textarea value={rdoServico} onChange={(e) => setRdoServico(e.target.value)} placeholder="Descrição do serviço principal a executar" rows={2} className={`${inputCls} resize-y`} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Clima Manhã</label>
              <input type="text" value={rdoClimaManha} onChange={(e) => setRdoClimaManha(e.target.value)} placeholder="Ex: Ensolarado" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Clima Tarde</label>
              <input type="text" value={rdoClimaTarde} onChange={(e) => setRdoClimaTarde(e.target.value)} placeholder="Ex: Nublado" className={inputCls} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Clima Noite</label>
              <input type="text" value={rdoClimaNoite} onChange={(e) => setRdoClimaNoite(e.target.value)} placeholder="Ex: Limpo" className={inputCls} />
            </div>
          </div>
        </Section>

        {/* 2. Condições Climáticas */}
        <Section title="Condições Climáticas" icon={<CloudSun size={16} className="text-[#f97316]" />}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(['morning', 'afternoon', 'night'] as const).map((period) => {
              const labels = { morning: 'Manhã', afternoon: 'Tarde', night: 'Noite' }
              return (
                <div key={period}>
                  <label className="block text-[#a3a3a3] text-xs mb-1">{labels[period]}</label>
                  <select {...register(`weather.${period}`)} className={selectCls}>
                    {WEATHER_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              )
            })}
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Temperatura (°C)</label>
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
        <Section title="Mão de Obra" icon={<Users size={16} className="text-[#f97316]" />}>
          {/* Equipe do dia → carrega os membros vigentes na lista nominal */}
          <div className="mb-4">
            <label className="block text-[#a3a3a3] text-xs mb-1">Equipe do dia</label>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={equipeDoDia}
                onChange={(e) => setEquipeDoDia(e.target.value)}
                className={`${selectCls} flex-1 min-w-[200px]`}
              >
                <option value="">— selecionar equipe —</option>
                {equipes.map((e) => (
                  <option key={e.id} value={e.id}>{e.equipe}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCarregarEquipe}
                disabled={!equipeDoDia || carregandoEquipe}
                className="px-3 py-2 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {carregandoEquipe ? 'Carregando…' : '↓ Carregar equipe'}
              </button>
            </div>
          </div>

          {/* Lista NOMINAL de presença */}
          {presencas.length > 0 && (
            <div className="mb-4 space-y-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#525252]/50">
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-2">Pres.</th>
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-2">Nome</th>
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-2">Função</th>
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-2">HN</th>
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-2">HE</th>
                      <th className="text-left text-[#a3a3a3] text-xs font-medium px-2 py-2">Ausência</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {presencas.map((p, i) => (
                      <tr key={chavePresenca(p)} className="border-b border-[#525252]/30">
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={p.presente}
                            onChange={(e) => atualizarPresenca(i, { presente: e.target.checked })}
                            className="accent-[#f97316]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={p.presente ? 'text-[#f5f5f5]' : 'text-[#6b6b6b] line-through'}>{p.nome}</span>
                          {!p.pessoaId && (
                            <span className="ml-1.5 text-[10px] text-[#eab308]" title="Sem cadastro no módulo Pessoal — vai pro RDO como snapshot de nome">
                              avulso
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-[#a3a3a3] text-xs">{p.funcao ?? '—'}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0} max={24} step={0.5}
                            value={p.horasNormais}
                            disabled={!p.presente}
                            onChange={(e) => atualizarPresenca(i, { horasNormais: Number(e.target.value) })}
                            className={`${inputCls} w-16 disabled:opacity-40`}
                            title="Horas normais"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0} max={12} step={0.5}
                            value={p.horasExtras}
                            disabled={!p.presente}
                            onChange={(e) => atualizarPresenca(i, { horasExtras: Number(e.target.value) })}
                            className={`${inputCls} w-16 disabled:opacity-40`}
                            title="Horas extras"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          {!p.presente ? (
                            <select
                              value={p.motivoAusencia ?? 'falta'}
                              onChange={(e) => atualizarPresenca(i, { motivoAusencia: e.target.value })}
                              className="bg-[#484848] border border-[#5e5e5e] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
                            >
                              {MOTIVOS_AUSENCIA.map((m) => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-[#6b6b6b] text-xs">—</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => removerPresenca(i)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[#6b6b6b] text-xs">
                {presencas.filter((p) => p.presente).length} presente{presencas.filter((p) => p.presente).length !== 1 ? 's' : ''} ·{' '}
                {presencas.filter((p) => !p.presente).length} ausente{presencas.filter((p) => !p.presente).length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* + pessoa de outra equipe / + avulso sem cadastro */}
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">+ pessoa de outra equipe</label>
              {!pessoal.tabelasAusentes && pessoal.pessoas.length > 0 ? (
                <AutocompletePessoa
                  pessoas={pessoal.pessoas}
                  apelidos={pessoal.apelidos}
                  placeholder="Buscar no cadastro por nome/apelido…"
                  onSelecionar={(p) =>
                    adicionarPresenca({
                      pessoaId: p.id,
                      nome: p.nome_completo,
                      equipeId: p.equipeAtual?.equipeId ?? null,
                      equipeNome: equipes.find((e) => e.id === p.equipeAtual?.equipeId)?.equipe ?? null,
                      cargoId: p.cargo?.id ?? null,
                      cargoCategoria: p.cargo?.categoria_rdo ?? null,
                      funcao: p.equipeAtual?.funcao ?? p.cargo?.nome ?? null,
                      presente: true,
                      motivoAusencia: null,
                      horasNormais: 8,
                      horasExtras: 0,
                    })
                  }
                />
              ) : (
                // cadastro indisponível (migrations pendentes) → input livre
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outraNomeLivre}
                    onChange={(e) => setOutraNomeLivre(e.target.value)}
                    placeholder="Nome (cadastro indisponível)"
                    className={`${inputCls} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nome = outraNomeLivre.trim()
                      if (!nome) return
                      adicionarPresenca({
                        pessoaId: null, nome, equipeId: null, equipeNome: null, cargoId: null,
                        cargoCategoria: null, funcao: null, presente: true, motivoAusencia: null,
                        horasNormais: 8, horasExtras: 0,
                      })
                      setOutraNomeLivre('')
                    }}
                    className="px-3 py-2 bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] rounded-lg text-sm transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">+ avulso sem cadastro</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={avulsoNome}
                  onChange={(e) => setAvulsoNome(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && avulsoNome.trim()) {
                      e.preventDefault()
                      adicionarAvulso()
                    }
                  }}
                  placeholder="Nome + Enter (vira linha com pessoa_id nulo)"
                  className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={adicionarAvulso}
                  className="px-3 py-2 bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] rounded-lg text-sm transition-colors"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Os 4 contadores: derivados da lista quando ela tem itens */}
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[#a3a3a3] text-xs">
              {contadoresDerivadosAtivos
                ? 'Contadores derivados da lista de presença (categoria do cargo; sem cargo → ajudante).'
                : presencas.length > 0
                  ? 'Contadores em modo manual (a lista não os sobrescreve).'
                  : 'Contadores manuais (fluxo antigo — sem lista de presença).'}
            </p>
            {presencas.length > 0 && !manpowerManual && (
              <button
                type="button"
                onClick={() => setManpowerManual(true)}
                className="flex items-center gap-1 text-[#f97316] hover:text-[#ea580c] text-xs"
                title="Destrava os 4 contadores para edição manual"
              >
                <Pencil size={11} /> editar manualmente
              </button>
            )}
            {presencas.length > 0 && manpowerManual && (
              <button
                type="button"
                onClick={() => setManpowerManual(false)}
                className="flex items-center gap-1 text-[#f97316] hover:text-[#ea580c] text-xs"
              >
                voltar ao automático
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {([
              ['foremanCount',  'Encarregado'],
              ['officialCount', 'Oficial'],
              ['helperCount',   'Ajudante'],
              ['operatorCount', 'Operador'],
            ] as const).map(([field, label]) => (
              <div key={field}>
                <label className="block text-[#a3a3a3] text-xs mb-1">{label}</label>
                <input
                  type="number"
                  min={0}
                  disabled={contadoresDerivadosAtivos}
                  {...register(`manpower.${field}`, { valueAsNumber: true })}
                  className={`${inputCls} disabled:opacity-60`}
                  placeholder="0"
                />
                <FieldError msg={errors.manpower?.[field]?.message} />
              </div>
            ))}
          </div>

          {/* Chips legados — só quando a lista nominal está vazia (fluxo antigo intacto) */}
          {presencas.length === 0 && (
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Funcionários Presentes</label>
              <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
                {employeeNames.map((name, i) => (
                  <span key={i} className="flex items-center gap-1 bg-sky-900/30 border border-sky-700/40 text-[#ea580c] text-xs px-2 py-0.5 rounded-full">
                    {name}
                    <button
                      type="button"
                      onClick={() => setEmployeeNames((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-[#f97316] hover:text-red-400 ml-0.5"
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
          )}
        </Section>

        {/* 4. Equipamentos */}
        <Section title="Equipamentos" icon={<Wrench size={16} className="text-[#f97316]" />}>
          <div className="space-y-2">
            {equipment.length === 0 && (
              <p className="text-[#6b6b6b] text-sm italic">Nenhum equipamento adicionado.</p>
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
                <span className="text-[#6b6b6b] text-xs">h</span>
                <button type="button" onClick={() => removeEquipment(i)} className="text-red-400 hover:text-red-300 p-1">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {equipment.length > 0 && (
              <p className="text-[#6b6b6b] text-xs">
                Total: {equipment.reduce((s, r) => s + r.quantity * r.hours, 0).toFixed(1)} h·equip
              </p>
            )}
            <button
              type="button"
              onClick={addEquipmentRow}
              className="flex items-center gap-1.5 text-[#f97316] hover:text-[#ea580c] text-sm mt-1"
            >
              <Plus size={14} /> Adicionar Equipamento
            </button>
          </div>
        </Section>

        <Section title="Custos do Dia e LPS" icon={<DollarSign size={16} className="text-[#f97316]" />}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {[
                ['Maquina', machineCostBRL, setMachineCostBRL],
                ['Equipamentos', equipmentCostBRL, setEquipmentCostBRL],
                ['Locacoes', rentalCostBRL, setRentalCostBRL],
                ['Diretos', directCostBRL, setDirectCostBRL],
                ['Indiretos', indirectCostBRL, setIndirectCostBRL],
              ].map(([label, value, setter]) => (
                <div key={label as string}>
                  <label className="block text-[#a3a3a3] text-xs mb-1">{label as string}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={value as number}
                    onChange={(e) => (setter as (value: number) => void)(Number(e.target.value))}
                    className={inputCls}
                    placeholder="0,00"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Resumo da producao</label>
                <textarea
                  value={productionNotes}
                  onChange={(e) => setProductionNotes(e.target.value)}
                  rows={3}
                  placeholder="O que foi produzido, frente, rua, trecho, meta e realizado."
                  className={`${inputCls} resize-none`}
                />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Paralisacoes / restricoes</label>
                <textarea
                  value={stoppageNotes}
                  onChange={(e) => setStoppageNotes(e.target.value)}
                  rows={3}
                  placeholder="Parou? Motivo, duracao, impacto e responsavel pela remocao da restricao."
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[#f5f5f5] text-sm">
              <input
                type="checkbox"
                checked={lpsLinked}
                onChange={(e) => setLpsLinked(e.target.checked)}
                className="accent-[#f97316]"
              />
              Vincular este RDO ao LPS / Last Planner do ConstruData
            </label>
            <div className="text-[#a3a3a3] text-xs">
              Total do dia: {(machineCostBRL + equipmentCostBRL + rentalCostBRL + directCostBRL + indirectCostBRL).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>
        </Section>

        {/* 5. Serviços Executados */}
        <Section title="Serviços Executados" icon={<ClipboardList size={16} className="text-[#f97316]" />}>
          <div className="space-y-2">
            {services.length === 0 && (
              <p className="text-[#6b6b6b] text-sm italic">Nenhum serviço adicionado.</p>
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
              className="flex items-center gap-1.5 text-[#f97316] hover:text-[#ea580c] text-sm mt-1"
            >
              <Plus size={14} /> Adicionar Serviço
            </button>
          </div>
        </Section>

        {/* 6. Avanço por Trecho */}
        <Section title="Avanço por Trecho" icon={<Route size={16} className="text-[#f97316]" />}>
          <div className="space-y-3">
            {trechos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#a3a3a3] text-xs">
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
                      <tr key={i} className="border-t border-[#525252]">
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
                            className="bg-[#3d3d3d] border border-[#1f3c5e] rounded px-2 py-1 text-xs text-[#f5f5f5]"
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
                                                           'bg-[#484848] text-[#a3a3a3]'
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
              <p className="text-[#6b6b6b] text-sm italic">Nenhum trecho adicionado.</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={addTrechoRow}
                className="flex items-center gap-1.5 text-[#f97316] hover:text-[#ea580c] text-sm"
              >
                <Plus size={14} /> Adicionar Trecho
              </button>
              <button
                type="button"
                onClick={handleLoadTrechos}
                disabled={loadingTrechos}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm transition-colors disabled:opacity-50"
              >
                {loadingTrechos ? 'Carregando...' : '↓ Carregar da Rede'}
              </button>
            </div>
          </div>
        </Section>

        {/* 7. Georreferenciamento */}
        <Section title="Georreferenciamento" icon={<MapPin size={16} className="text-[#f97316]" />} defaultOpen={false}>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Latitude</label>
                <input
                  type="text"
                  value={geolocation?.lat ?? ''}
                  onChange={(e) => setGeolocation((g) => ({ lat: e.target.value, lng: g?.lng ?? '' }))}
                  placeholder="-23.550520"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-[#a3a3a3] text-xs mb-1">Longitude</label>
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm transition-colors disabled:opacity-50"
            >
              <MapPin size={14} />
              {geoLoading ? 'Obtendo...' : 'Obter GPS'}
            </button>
            {geoError && <p className="text-red-400 text-sm">{geoError}</p>}
          </div>
        </Section>

        {/* 8. Observações e Ocorrências */}
        <Section title="Observações e Ocorrências" icon={<Pencil size={16} className="text-[#f97316]" />} defaultOpen={false}>
          <div className="space-y-4">
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Observações Gerais</label>
              <textarea
                {...register('observations')}
                rows={4}
                placeholder="Descreva as atividades realizadas, condições do local, etc."
                className={`${inputCls} resize-none`}
              />
              <FieldError msg={errors.observations?.message} />
            </div>
            <div>
              <label className="block text-[#a3a3a3] text-xs mb-1">Ocorrências / Incidentes</label>
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
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-5 space-y-4">
          <div className="flex items-center gap-2.5 text-gray-100 font-medium text-sm">
            <Camera size={16} className="text-[#f97316]" />
            Registro Fotográfico
            <span className="text-[#6b6b6b] text-xs font-normal">({photos.length}/{MAX_PHOTOS})</span>
          </div>

          {/* Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#5e5e5e] hover:border-sky-500 rounded-lg p-6 text-center cursor-pointer transition-colors"
          >
            <Upload size={24} className="mx-auto text-[#6b6b6b] mb-2" />
            <p className="text-[#a3a3a3] text-sm">Clique para selecionar fotos</p>
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
                    className="w-full h-28 object-cover rounded-lg border border-[#525252]"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-[#2c2c2c]/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={13} className="text-red-400" />
                  </button>
                  <input
                    type="text"
                    value={photo.label}
                    onChange={(e) => updatePhotoLabel(i, e.target.value)}
                    placeholder="Legenda"
                    className="mt-1.5 w-full bg-[#484848] border border-[#5e5e5e] rounded text-xs text-[#f5f5f5] px-2 py-1 focus:outline-none focus:border-[#f97316]/50"
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
            className="px-4 py-2 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-sm font-medium transition-colors"
          >
            Limpar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: '#0ea5e9' }}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar RDO'
            )}
          </button>
        </div>
      </form>

      {showTextParse && (
        <TextParseModal
          onClose={() => setShowTextParse(false)}
          onApply={handleApplyParsed}
          onCreate={async (text) => handleCreateFromText(text)}
        />
      )}
    </div>
  )
}
