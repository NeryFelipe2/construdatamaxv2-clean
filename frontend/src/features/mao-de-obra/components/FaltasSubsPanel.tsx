import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { suggestSubstitutes } from '@/features/mao-de-obra/utils/cltEngine'
import type { AbsenceType, WorkerAbsence } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  sick_leave:   'Atestado Médico',
  justified:    'Justificada',
  unjustified:  'Injustificada',
  vacation:     'Férias',
  accident:     'Acidente',
  other:        'Outro',
}

const ABSENCE_COLORS: Record<AbsenceType, string> = {
  sick_leave:   'bg-[#3b82f6]/15 text-[#3b82f6]',
  justified:    'bg-[#f59e0b]/15 text-[#f59e0b]',
  unjustified:  'bg-[#ef4444]/15 text-[#ef4444]',
  vacation:     'bg-[#22c55e]/15 text-[#22c55e]',
  accident:     'bg-[#8b5cf6]/15 text-[#8b5cf6]',
  other:        'bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
}

function TypeBadge({ type }: { type: AbsenceType }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ABSENCE_COLORS[type]}`}>
      {ABSENCE_LABELS[type]}
    </span>
  )
}

function StatusBadge({ status }: { status: WorkerAbsence['status'] }) {
  const cls = status === 'covered'   ? 'bg-[#22c55e]/15 text-[#22c55e]'
            : status === 'uncovered' ? 'bg-[#ef4444]/15 text-[#ef4444]'
            : 'bg-[#f59e0b]/15 text-[#f59e0b]'
  const label = status === 'covered' ? 'Coberta' : status === 'uncovered' ? 'Descoberta' : 'Aberta'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>
}

// ─── AbsenceDialog ────────────────────────────────────────────────────────────

interface AbsenceDialogProps {
  onClose: () => void
}

function AbsenceDialog({ onClose }: AbsenceDialogProps) {
  const { workers, shifts, cltSettings, registerAbsence, assignSubstitute } =
    useMaoDeObraStore(useShallow(s => ({
      workers:          s.workers,
      shifts:           s.shifts,
      cltSettings:      s.cltSettings,
      registerAbsence:  s.registerAbsence,
      assignSubstitute: s.assignSubstitute,
    })))

  const [workerId, setWorkerId]     = useState('')
  const [date, setDate]             = useState(new Date().toISOString().split('T')[0])
  const [type, setType]             = useState<AbsenceType>('sick_leave')
  const [description, setDesc]      = useState('')
  const [registeredId, setReg]      = useState<string | null>(null)
  const [errors, setErrors]         = useState<Record<string, string>>({})

  const activeWorkers = workers.filter(w => w.status === 'active')
  const absentWorker  = workers.find(w => w.id === workerId)

  const suggestions = useMemo(() => {
    if (!absentWorker || !date) return []
    return suggestSubstitutes(absentWorker, date, workers, shifts, cltSettings)
  }, [absentWorker, date, workers, shifts, cltSettings])

  function validate() {
    const e: Record<string, string> = {}
    if (!workerId) e.workerId = 'Selecione o colaborador'
    if (!date)     e.date     = 'Informe a data'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleRegister() {
    if (!validate()) return
    const id = registerAbsence({ workerId, date, type, description: description.trim() || undefined, status: 'open' })
    setReg(id)
  }

  function handleAssign(subId: string) {
    if (!registeredId) return
    assignSubstitute(registeredId, subId)
    onClose()
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]'
  const labelCls = 'block text-xs font-medium text-[var(--color-text-secondary)] mb-1'
  const errCls   = 'text-xs text-[#ef4444] mt-1'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg bg-[var(--color-surface-elevated)] rounded-2xl shadow-2xl p-6 mb-8">
        <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-5">Registrar Falta</h2>

        {!registeredId ? (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Colaborador</label>
              <select className={inputCls} value={workerId}
                onChange={e => setWorkerId(e.target.value)}>
                <option value="">Selecione...</option>
                {activeWorkers.map(w => (
                  <option key={w.id} value={w.id}>{w.name} — {w.role}</option>
                ))}
              </select>
              {errors.workerId && <p className={errCls}>{errors.workerId}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data</label>
                <input type="date" className={inputCls} value={date}
                  onChange={e => setDate(e.target.value)} />
                {errors.date && <p className={errCls}>{errors.date}</p>}
              </div>
              <div>
                <label className={labelCls}>Tipo de Falta</label>
                <select className={inputCls} value={type}
                  onChange={e => setType(e.target.value as AbsenceType)}>
                  {(Object.keys(ABSENCE_LABELS) as AbsenceType[]).map(t => (
                    <option key={t} value={t}>{ABSENCE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={labelCls}>Observações (opcional)</label>
              <textarea className={`${inputCls} resize-none`} rows={3} value={description}
                onChange={e => setDesc(e.target.value)}
                placeholder="Informações adicionais..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">
                Cancelar
              </button>
              <button onClick={handleRegister}
                className="px-5 py-2 rounded-lg text-sm font-bold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
                Registrar Falta
              </button>
            </div>
          </div>
        ) : (
          // Substitute suggestions
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30">
              <span className="text-[#22c55e] text-lg">✓</span>
              <span className="text-sm font-medium text-[#22c55e]">Falta registrada com sucesso</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
                Sugestões de Substituto — {absentWorker?.role}
              </h3>
              {suggestions.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
                  Nenhum substituto disponível com o mesmo cargo e conformidade CLT
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {suggestions.map((sub, idx) => (
                    <div key={sub.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{sub.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {sub.role} · R$ {sub.hourlyRate.toFixed(2)}/h
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#22c55e]/15 text-[#22c55e]">
                          CLT OK
                        </span>
                        <button onClick={() => handleAssign(sub.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity">
                          Atribuir
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">
                Fechar sem atribuir
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── FaltasSubsPanel ──────────────────────────────────────────────────────────

export function FaltasSubsPanel() {
  const { absences, workers, resolveAbsence } = useMaoDeObraStore(
    useShallow(s => ({
      absences:      s.absences,
      workers:       s.workers,
      resolveAbsence: s.resolveAbsence,
    }))
  )

  const [dialogOpen, setDialogOpen] = useState(false)
  const [filterType, setFilterType] = useState<AbsenceType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<WorkerAbsence['status'] | 'all'>('all')

  // Last 30 days
  const cutoff30 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  }, [])

  const recent30 = useMemo(
    () => absences.filter(a => a.date >= cutoff30),
    [absences, cutoff30]
  )

  const filtered = useMemo(() => {
    let list = [...absences].sort((a, b) => b.date.localeCompare(a.date))
    if (filterType   !== 'all') list = list.filter(a => a.type   === filterType)
    if (filterStatus !== 'all') list = list.filter(a => a.status === filterStatus)
    return list
  }, [absences, filterType, filterStatus])

  // Type breakdown for last 30 days
  const byType = useMemo(() => {
    const counts: Partial<Record<AbsenceType, number>> = {}
    for (const a of recent30) {
      counts[a.type] = (counts[a.type] ?? 0) + 1
    }
    return counts
  }, [recent30])

  // Most absent workers (last 30d)
  const mostAbsent = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of recent30) {
      counts[a.workerId] = (counts[a.workerId] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([wId, count]) => ({ worker: workers.find(w => w.id === wId), count }))
      .filter(({ worker }) => !!worker)
  }, [recent30, workers])

  function getWorkerName(wId: string) {
    return workers.find(w => w.id === wId)?.name ?? wId
  }
  function getSubName(wId?: string) {
    if (!wId) return '—'
    return workers.find(w => w.id === wId)?.name ?? wId
  }

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Faltas (30d)',   value: recent30.length,                                           color: 'text-[var(--color-text-primary)]' },
          { label: 'Cobertas',       value: recent30.filter(a => a.status === 'covered').length,       color: 'text-[#22c55e]' },
          { label: 'Descobertas',    value: recent30.filter(a => a.status === 'uncovered').length,     color: 'text-[#ef4444]' },
          { label: 'Em Aberto',      value: recent30.filter(a => a.status === 'open').length,          color: 'text-[#f59e0b]' },
        ].map(stat => (
          <div key={stat.label}
            className="flex flex-col items-center py-3 px-2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
            <span className={`text-2xl font-bold ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Type breakdown + top absent */}
      {recent30.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* By type */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-3">Por Tipo (30d)</h3>
            <div className="space-y-2">
              {(Object.keys(byType) as AbsenceType[]).map(t => {
                const cnt = byType[t] ?? 0
                const pct = recent30.length > 0 ? (cnt / recent30.length) * 100 : 0
                return (
                  <div key={t} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-secondary)] w-28 shrink-0">{ABSENCE_LABELS[t]}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
                      <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-text-primary)] w-4 text-right">{cnt}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top absent workers */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase mb-3">Mais Ausentes (30d)</h3>
            {mostAbsent.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] text-center py-2">Nenhuma falta registrada</p>
            ) : (
              <div className="space-y-2">
                {mostAbsent.map(({ worker, count }, idx) => (
                  <div key={worker!.id} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                      {idx + 1}
                    </span>
                    <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">{worker!.name}</span>
                    <span className="text-xs font-semibold text-[#ef4444]">{count}x</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {/* Type filter */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as AbsenceType | 'all')}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
            <option value="all">Todos os tipos</option>
            {(Object.keys(ABSENCE_LABELS) as AbsenceType[]).map(t => (
              <option key={t} value={t}>{ABSENCE_LABELS[t]}</option>
            ))}
          </select>
          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as WorkerAbsence['status'] | 'all')}
            className="px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
            <option value="all">Todos os status</option>
            <option value="open">Em aberto</option>
            <option value="covered">Coberta</option>
            <option value="uncovered">Descoberta</option>
          </select>
        </div>
        <button onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm">
          <span className="text-lg leading-none">+</span> Registrar Falta
        </button>
      </div>

      {/* Absences table */}
      <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                {['Data', 'Colaborador', 'Tipo', 'Status', 'Substituto', 'Ações'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">
                    Nenhuma falta registrada
                  </td>
                </tr>
              ) : filtered.map(absence => (
                <tr key={absence.id} className="hover:bg-[var(--color-surface)] transition-colors">
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] whitespace-nowrap">
                    {new Date(absence.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                    {getWorkerName(absence.workerId)}
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={absence.type} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={absence.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {getSubName(absence.substituteWorkerId)}
                  </td>
                  <td className="px-4 py-3">
                    {absence.status === 'open' && (
                      <button onClick={() => resolveAbsence(absence.id)}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-[#22c55e]/10 text-[#22c55e] hover:bg-[#22c55e]/20 transition-colors">
                        Resolver
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {dialogOpen && <AbsenceDialog onClose={() => setDialogOpen(false)} />}
    </div>
  )
}
