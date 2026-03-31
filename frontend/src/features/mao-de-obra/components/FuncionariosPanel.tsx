import { useState, useMemo } from 'react'
import { Plus, Download, Search, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useShallow } from 'zustand/react/shallow'
import type { Worker, ContractType, ScheduleType } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:    '#22c55e',
  inactive:  '#6b6b6b',
  suspended: '#ef4444',
}
const STATUS_LABEL: Record<string, string> = {
  active: 'Ativo', inactive: 'Inativo', suspended: 'Suspenso',
}
const CONTRACT_LABEL: Record<ContractType, string> = {
  clt: 'CLT', pj: 'PJ', freelancer: 'Freelancer', apprentice: 'Aprendiz',
}
const SCHEDULE_LABEL: Record<ScheduleType, string> = {
  standard: 'Padrão (5x2)', '6x1': '6x1', '5x2': '5x2', '12x36': '12x36', daily: 'Diarista', custom: 'Customizado',
}

// ─── Worker Form Modal ────────────────────────────────────────────────────────

interface WorkerFormProps {
  initial?: Worker
  crews: { id: string; name: string }[]
  onSave: (data: Omit<Worker, 'id'>) => void
  onClose: () => void
}

function WorkerFormModal({ initial, crews, onSave, onClose }: WorkerFormProps) {
  const [form, setForm] = useState<Partial<Omit<Worker, 'id'>>>({
    name:               initial?.name ?? '',
    role:               initial?.role ?? '',
    cpfMasked:          initial?.cpfMasked ?? '***.***.**-**',
    crewId:             initial?.crewId ?? '',
    status:             initial?.status ?? 'active',
    hourlyRate:         initial?.hourlyRate ?? 0,
    certifications:     initial?.certifications ?? [],
    biometricToken:     initial?.biometricToken ?? '',
    registrationNumber: initial?.registrationNumber ?? '',
    department:         initial?.department ?? '',
    email:              initial?.email ?? '',
    phone:              initial?.phone ?? '',
    admissionDate:      initial?.admissionDate ?? '',
    contractType:       initial?.contractType ?? 'clt',
    scheduleType:       initial?.scheduleType ?? 'standard',
    workFront:          initial?.workFront ?? '',
  })
  const [error, setError] = useState('')

  function set(field: string, value: unknown) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) { setError('Nome é obrigatório'); return }
    if (!form.role?.trim()) { setError('Função é obrigatória'); return }
    // crewId is optional — can be assigned later
    setError('')
    onSave(form as Omit<Worker, 'id'>)
  }

  const fieldClass = 'w-full bg-[#112645] border border-[#1f3c5e] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#2abfdc]'
  const labelClass = 'block text-[#6b6b6b] text-xs mb-1'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#112645] border border-[#20406a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-[#20406a]">
          <h2 className="text-[#f5f5f5] text-base font-semibold">{initial ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 grid grid-cols-2 gap-4">
          {/* Col 1 */}
          <div className="col-span-2">
            <label className={labelClass}>Nome completo *</label>
            <input className={fieldClass} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Função / Cargo *</label>
            <input className={fieldClass} value={form.role ?? ''} onChange={(e) => set('role', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Matrícula</label>
            <input className={fieldClass} value={form.registrationNumber ?? ''} onChange={(e) => set('registrationNumber', e.target.value)} placeholder="MAT-0001" />
          </div>
          <div>
            <label className={labelClass}>Departamento / Setor</label>
            <input className={fieldClass} value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Frente de Trabalho</label>
            <input className={fieldClass} value={form.workFront ?? ''} onChange={(e) => set('workFront', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input type="email" className={fieldClass} value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Telefone</label>
            <input className={fieldClass} value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="(11) 9 9999-9999" />
          </div>
          <div>
            <label className={labelClass}>Data de Admissão</label>
            <input type="date" className={fieldClass} value={form.admissionDate ?? ''} onChange={(e) => set('admissionDate', e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Tipo de Contrato</label>
            <select className={fieldClass} value={form.contractType ?? 'clt'} onChange={(e) => set('contractType', e.target.value as ContractType)}>
              {Object.entries(CONTRACT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Regime de Trabalho</label>
            <select className={fieldClass} value={form.scheduleType ?? 'standard'} onChange={(e) => set('scheduleType', e.target.value as ScheduleType)}>
              {Object.entries(SCHEDULE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Equipe</label>
            <select className={fieldClass} value={form.crewId ?? ''} onChange={(e) => set('crewId', e.target.value)}>
              <option value="">— Sem equipe (definir depois) —</option>
              {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={fieldClass} value={form.status ?? 'active'} onChange={(e) => set('status', e.target.value as Worker['status'])}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
              <option value="suspended">Suspenso</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Taxa Horária (R$)</label>
            <input type="number" step="0.01" min="0" className={fieldClass} value={form.hourlyRate ?? 0} onChange={(e) => set('hourlyRate', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className={labelClass}>CPF (mascarado)</label>
            <input className={fieldClass} value={form.cpfMasked ?? ''} onChange={(e) => set('cpfMasked', e.target.value)} placeholder="***.***.***-XX" />
          </div>

          {error && <p className="col-span-2 text-[#ef4444] text-xs">{error}</p>}

          <div className="col-span-2 flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-[#20406a] text-[#6b6b6b] text-sm hover:text-[#f5f5f5] hover:border-[#1f3c5e]">
              Cancelar
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#2abfdc] text-white text-sm font-semibold hover:bg-[#ea6c10]">
              {initial ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Expanded row detail ───────────────────────────────────────────────────────

function ExpandedRow({ worker, crews }: { worker: Worker; crews: { id: string; name: string }[] }) {
  const crewName = crews.find((c) => c.id === worker.crewId)?.name ?? '—'
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 bg-[#112645] border-t border-[#20406a] text-xs">
      <div>
        <p className="text-[#6b6b6b] mb-0.5">E-mail</p>
        <p className="text-[#f5f5f5]">{worker.email ?? '—'}</p>
      </div>
      <div>
        <p className="text-[#6b6b6b] mb-0.5">Telefone</p>
        <p className="text-[#f5f5f5]">{worker.phone ?? '—'}</p>
      </div>
      <div>
        <p className="text-[#6b6b6b] mb-0.5">Equipe</p>
        <p className="text-[#f5f5f5]">{crewName}</p>
      </div>
      <div>
        <p className="text-[#6b6b6b] mb-0.5">Frente de Trabalho</p>
        <p className="text-[#f5f5f5]">{worker.workFront ?? '—'}</p>
      </div>
      <div>
        <p className="text-[#6b6b6b] mb-0.5">Admissão</p>
        <p className="text-[#f5f5f5]">
          {worker.admissionDate ? new Date(worker.admissionDate + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
        </p>
      </div>
      <div>
        <p className="text-[#6b6b6b] mb-0.5">Contrato</p>
        <p className="text-[#f5f5f5]">{worker.contractType ? CONTRACT_LABEL[worker.contractType] : '—'}</p>
      </div>
      <div>
        <p className="text-[#6b6b6b] mb-0.5">Regime</p>
        <p className="text-[#f5f5f5]">{worker.scheduleType ? SCHEDULE_LABEL[worker.scheduleType] : '—'}</p>
      </div>
      <div>
        <p className="text-[#6b6b6b] mb-0.5">Taxa Horária</p>
        <p className="text-[#f5f5f5]">R${worker.hourlyRate.toFixed(2)}/h</p>
      </div>
      {worker.certifications.length > 0 && (
        <div className="col-span-2 md:col-span-4">
          <p className="text-[#6b6b6b] mb-1">Certificações</p>
          <div className="flex flex-wrap gap-1.5">
            {worker.certifications.map((cert) => {
              const c = cert.status === 'valid' ? '#22c55e' : cert.status === 'expiring' ? '#f59e0b' : '#ef4444'
              return (
                <span key={cert.id} className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: `${c}18`, color: c }}>
                  {cert.type} · {cert.status === 'valid' ? 'Válida' : cert.status === 'expiring' ? 'Vencendo' : 'Expirada'}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Worker table row ─────────────────────────────────────────────────────────

function WorkerRow({ worker: w, crews, expandedId, onToggle, onEdit }: {
  worker: Worker
  crews: { id: string; name: string }[]
  expandedId: string | null
  onToggle: (id: string | null) => void
  onEdit: (w: Worker) => void
}) {
  const isExpanded = expandedId === w.id
  const sc = STATUS_COLOR[w.status]
  const crewName = crews.find((c) => c.id === w.crewId)?.name
  return (
    <>
      <tr
        className="border-b border-[#20406a] hover:bg-[#1a3662] cursor-pointer"
        onClick={() => onToggle(isExpanded ? null : w.id)}
      >
        <td className="px-3 py-2.5 text-[#6b6b6b] font-mono">{w.registrationNumber ?? '—'}</td>
        <td className="px-3 py-2.5 text-[#f5f5f5] font-medium max-w-[160px] truncate">{w.name}</td>
        <td className="px-3 py-2.5 text-[#a3a3a3] max-w-[140px] truncate">{w.role}</td>
        <td className="px-3 py-2.5">
          {crewName
            ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#2abfdc]/15 text-[#2abfdc]">{crewName}</span>
            : <span className="text-[#6b6b6b] italic text-[10px]">Sem equipe</span>}
        </td>
        <td className="px-3 py-2.5 text-[#6b6b6b] hidden md:table-cell">{w.department ?? '—'}</td>
        <td className="px-3 py-2.5 text-[#f5f5f5] font-mono hidden md:table-cell">R${w.hourlyRate.toFixed(2)}</td>
        <td className="px-3 py-2.5">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: `${sc}18`, color: sc }}>
            {STATUS_LABEL[w.status]}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(w) }}
              className="text-[#6b6b6b] hover:text-[#2abfdc] text-[10px] font-semibold"
            >
              Editar
            </button>
            {isExpanded ? <ChevronUp size={12} className="text-[#6b6b6b]" /> : <ChevronDown size={12} className="text-[#6b6b6b]" />}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <ExpandedRow worker={w} crews={crews} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function FuncionariosPanel() {
  const { workers, crews, addWorker, updateWorker } = useMaoDeObraStore(
    useShallow((s) => ({ workers: s.workers, crews: s.crews, addWorker: s.addWorker, updateWorker: s.updateWorker }))
  )

  const [search,      setSearch]      = useState('')
  const [filterRole,  setFilterRole]  = useState('')
  const [filterDept,  setFilterDept]  = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCrew,  setFilterCrew]  = useState('')
  const [groupByCrew, setGroupByCrew] = useState(false)
  const [expandedId,  setExpandedId]  = useState<string | null>(null)
  const [showForm,    setShowForm]    = useState(false)
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null)

  const roles = useMemo(() => [...new Set(workers.map((w) => w.role))].sort(), [workers])
  const depts = useMemo(() => [...new Set(workers.map((w) => w.department).filter(Boolean))].sort() as string[], [workers])

  const filtered = useMemo(() => workers.filter((w) => {
    if (search && !w.name.toLowerCase().includes(search.toLowerCase()) && !w.registrationNumber?.toLowerCase().includes(search.toLowerCase())) return false
    if (filterRole   && w.role !== filterRole)       return false
    if (filterDept   && w.department !== filterDept) return false
    if (filterStatus && w.status !== filterStatus)   return false
    if (filterCrew === '__none__' && w.crewId)       return false
    if (filterCrew && filterCrew !== '__none__' && w.crewId !== filterCrew) return false
    return true
  }), [workers, search, filterRole, filterDept, filterStatus, filterCrew])

  const groupedByCrew = useMemo(() => {
    if (!groupByCrew) return null
    const groups: { crew: { id: string; name: string } | null; workers: Worker[] }[] = []
    const crewMap = new Map<string, Worker[]>()
    const noCrewWorkers: Worker[] = []
    for (const w of filtered) {
      if (!w.crewId) { noCrewWorkers.push(w); continue }
      const arr = crewMap.get(w.crewId) ?? []
      arr.push(w)
      crewMap.set(w.crewId, arr)
    }
    for (const c of crews) {
      const ws = crewMap.get(c.id)
      if (ws && ws.length > 0) groups.push({ crew: c, workers: ws })
    }
    if (noCrewWorkers.length > 0) groups.push({ crew: null, workers: noCrewWorkers })
    return groups
  }, [groupByCrew, filtered, crews])

  function handleSave(data: Omit<Worker, 'id'>) {
    if (editingWorker) {
      updateWorker(editingWorker.id, data)
    } else {
      addWorker(data)
    }
    setShowForm(false)
    setEditingWorker(null)
  }

  function handleEdit(worker: Worker) {
    setEditingWorker(worker)
    setShowForm(true)
  }

  function exportCSV() {
    const header = ['Matrícula', 'Nome', 'Função', 'Departamento', 'Contrato', 'Admissão', 'Taxa/h', 'Status']
    const rows = filtered.map((w) => [
      w.registrationNumber ?? '',
      w.name,
      w.role,
      w.department ?? '',
      w.contractType ? CONTRACT_LABEL[w.contractType] : '',
      w.admissionDate ?? '',
      w.hourlyRate.toFixed(2),
      STATUS_LABEL[w.status],
    ])
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'funcionarios.csv' })
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const selectClass = 'bg-[#112645] border border-[#20406a] rounded-lg px-3 py-1.5 text-[#f5f5f5] text-xs focus:outline-none focus:border-[#2abfdc]'

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6b6b6b]" />
          <input
            className="w-full bg-[#112645] border border-[#20406a] rounded-lg pl-8 pr-3 py-1.5 text-[#f5f5f5] text-xs focus:outline-none focus:border-[#2abfdc]"
            placeholder="Buscar por nome ou matrícula…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className={selectClass} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Todas as funções</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className={selectClass} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
          <option value="">Todos os setores</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
          <option value="suspended">Suspenso</option>
        </select>
        <select className={selectClass} value={filterCrew} onChange={(e) => setFilterCrew(e.target.value)}>
          <option value="">Todas as equipes</option>
          <option value="__none__">Sem equipe</option>
          {crews.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setGroupByCrew(!groupByCrew)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            groupByCrew
              ? 'bg-[#2abfdc]/20 border-[#2abfdc] text-[#2abfdc]'
              : 'border-[#20406a] text-[#6b6b6b] hover:text-[#f5f5f5]'
          }`}
        >
          Agrupar por Equipe
        </button>
        <span className="text-[#6b6b6b] text-xs ml-auto">{filtered.length} colaborador{filtered.length !== 1 ? 'es' : ''}</span>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#20406a] text-[#6b6b6b] text-xs hover:text-[#f5f5f5] hover:border-[#1f3c5e]">
          <Download size={12} /> CSV
        </button>
        <button onClick={() => { setEditingWorker(null); setShowForm(true) }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2abfdc] text-white text-xs font-semibold hover:bg-[#ea6c10]">
          <Plus size={13} /> Novo Funcionário
        </button>
      </div>

      {/* Table */}
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#20406a]">
                {['Matrícula', 'Nome', 'Função', 'Equipe', 'Departamento', 'Taxa/h', 'Status', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[#6b6b6b] font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedByCrew ? (
                groupedByCrew.map((group) => (
                  <>{/* Crew group header */}
                    <tr key={`grp-${group.crew?.id ?? 'none'}`} className="bg-[#0d1f3c]">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${group.crew ? 'bg-[#2abfdc]' : 'bg-[#6b6b6b]'}`} />
                          <span className="text-[#f5f5f5] text-xs font-semibold">
                            {group.crew?.name ?? 'Sem equipe definida'}
                          </span>
                          <span className="text-[#6b6b6b] text-[10px]">({group.workers.length})</span>
                        </div>
                      </td>
                    </tr>
                    {group.workers.map((w) => (
                      <WorkerRow key={w.id} worker={w} crews={crews} expandedId={expandedId} onToggle={setExpandedId} onEdit={handleEdit} />
                    ))}
                  </>
                ))
              ) : (
                filtered.map((w) => (
                  <WorkerRow key={w.id} worker={w} crews={crews} expandedId={expandedId} onToggle={setExpandedId} onEdit={handleEdit} />
                ))
              )}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#6b6b6b]">Nenhum colaborador encontrado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <WorkerFormModal
          initial={editingWorker ?? undefined}
          crews={crews}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingWorker(null) }}
        />
      )}
    </div>
  )
}
