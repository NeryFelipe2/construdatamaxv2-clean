/**
 * Gestão e Calendário de Ausências.
 * Three view modes: Calendário | Timeline | Lista
 * + Dashboard row + Charts + Advanced filters + CSV export.
 */
import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek,
  format, isSameMonth, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import type { AbsenceType, WorkerAbsence } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const ABSENCE_LABELS: Record<AbsenceType, string> = {
  sick_leave:  'Atestado',
  justified:   'Justificada',
  unjustified: 'Injustificada',
  vacation:    'Férias',
  accident:    'Acidente',
  other:       'Outro',
}

const ABSENCE_DOT_COLORS: Record<AbsenceType, string> = {
  sick_leave:  '#3b82f6',
  justified:   '#f59e0b',
  unjustified: '#ef4444',
  vacation:    '#22c55e',
  accident:    '#8b5cf6',
  other:       '#6b7280',
}

const ABSENCE_BG: Record<AbsenceType, string> = {
  sick_leave:  'bg-[#3b82f6]/15 text-[#3b82f6]',
  justified:   'bg-[#f59e0b]/15 text-[#f59e0b]',
  unjustified: 'bg-[#ef4444]/15 text-[#ef4444]',
  vacation:    'bg-[#22c55e]/15 text-[#22c55e]',
  accident:    'bg-[#8b5cf6]/15 text-[#8b5cf6]',
  other:       'bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

function csvCell(v: string | number): string {
  const s    = String(v)
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

// ─── Calendar view ────────────────────────────────────────────────────────────

function CalendarView({
  month, absences,
  onDayClick,
}: {
  month: Date
  absences: WorkerAbsence[]
  onDayClick: (date: string) => void
}) {
  const start  = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const end    = endOfMonth(month)
  const days   = eachDayOfInterval({ start, end: end })

  // Pad to full weeks
  const lastDow = days[days.length - 1].getDay()
  const padEnd  = lastDow === 0 ? 0 : 7 - lastDow
  for (let i = 0; i < padEnd; i++) {
    const d = new Date(days[days.length - 1])
    d.setDate(d.getDate() + 1)
    days.push(d)
  }

  const absByDate: Record<string, WorkerAbsence[]> = {}
  for (const a of absences) {
    if (!absByDate[a.date]) absByDate[a.date] = []
    absByDate[a.date].push(a)
  }

  const dayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-[var(--color-text-muted)] py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const dateStr  = format(day, 'yyyy-MM-dd')
          const dayAbs   = absByDate[dateStr] ?? []
          const inMonth  = isSameMonth(day, month)
          const today    = isToday(day)
          return (
            <div key={idx}
              onClick={() => inMonth && onDayClick(dateStr)}
              className={`min-h-[64px] p-1 rounded-xl border transition-colors ${
                !inMonth ? 'opacity-30 pointer-events-none border-transparent' :
                today    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5' :
                           'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 cursor-pointer'
              }`}>
              <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${today ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-secondary)]'}`}>
                {day.getDate()}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {dayAbs.slice(0, 5).map(a => (
                  <span key={a.id} className="w-2 h-2 rounded-full inline-block" style={{ background: ABSENCE_DOT_COLORS[a.type] }} title={ABSENCE_LABELS[a.type]} />
                ))}
                {dayAbs.length > 5 && (
                  <span className="text-[9px] text-[var(--color-text-muted)]">+{dayAbs.length - 5}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Day popover ──────────────────────────────────────────────────────────────

function DayPopover({ date, absences, workerName, onClose }: {
  date: string
  absences: WorkerAbsence[]
  workerName: (id: string) => string
  onClose: () => void
}) {
  if (absences.length === 0) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-[var(--color-surface-elevated)] rounded-2xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">✕</button>
        </div>
        <div className="space-y-2">
          {absences.map(a => (
            <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div>
                <div className="text-sm font-medium text-[var(--color-text-primary)]">{workerName(a.workerId)}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ABSENCE_BG[a.type]}`}>{ABSENCE_LABELS[a.type]}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                a.status === 'covered'   ? 'bg-[#22c55e]/15 text-[#22c55e]' :
                a.status === 'uncovered' ? 'bg-[#ef4444]/15 text-[#ef4444]' :
                                           'bg-[#f59e0b]/15 text-[#f59e0b]'
              }`}>
                {a.status === 'covered' ? 'Coberta' : a.status === 'uncovered' ? 'Descoberta' : 'Aberta'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Timeline view ────────────────────────────────────────────────────────────

function TimelineView({ month, absences, workers }: {
  month: Date
  absences: WorkerAbsence[]
  workers: Array<{ id: string; name: string }>
}) {
  const days     = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const activeWorkers = workers.filter(w => absences.some(a => a.workerId === w.id))

  const absByWorkerDate: Record<string, Record<string, WorkerAbsence>> = {}
  for (const a of absences) {
    if (!absByWorkerDate[a.workerId]) absByWorkerDate[a.workerId] = {}
    absByWorkerDate[a.workerId][a.date] = a
  }

  return (
    <div className="overflow-x-auto">
      <table className="text-xs border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-surface-elevated)] px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)] min-w-[160px] border-b border-[var(--color-border)]">
              Colaborador
            </th>
            {days.map(d => {
              const dow = d.getDay()
              return (
                <th key={d.toISOString()} className={`px-1 py-2 text-center font-medium border-b border-[var(--color-border)] min-w-[28px] ${dow === 0 ? 'text-[#ef4444]/70' : 'text-[var(--color-text-muted)]'}`}>
                  {d.getDate()}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {activeWorkers.length === 0 ? (
            <tr><td colSpan={days.length + 1} className="px-3 py-8 text-center text-[var(--color-text-muted)]">Nenhuma ausência encontrada</td></tr>
          ) : activeWorkers.map(w => (
            <tr key={w.id} className="hover:bg-[var(--color-surface)]/50 transition-colors">
              <td className="sticky left-0 z-10 bg-[var(--color-surface-elevated)] px-3 py-2 font-medium text-[var(--color-text-primary)] whitespace-nowrap">
                {w.name.split(' ').slice(0, 2).join(' ')}
              </td>
              {days.map(d => {
                const dateStr = format(d, 'yyyy-MM-dd')
                const absence = absByWorkerDate[w.id]?.[dateStr]
                if (!absence) return <td key={dateStr} className="px-1 py-2 text-center" />
                return (
                  <td key={dateStr} className="px-0.5 py-1">
                    <div
                      className="w-full h-5 rounded-sm"
                      style={{ background: ABSENCE_DOT_COLORS[absence.type], opacity: 0.8 }}
                      title={`${ABSENCE_LABELS[absence.type]} — ${w.name}`}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--color-border)]">
        {(Object.entries(ABSENCE_DOT_COLORS) as Array<[AbsenceType, string]>).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ background: color }} />
            <span className="text-xs text-[var(--color-text-muted)]">{ABSENCE_LABELS[type]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Charts ───────────────────────────────────────────────────────────────────

function AbsenceBarChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2">
      {data.filter(d => d.value > 0).map(d => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-text-secondary)] w-24 shrink-0">{d.label}</span>
          <div className="flex-1 h-3 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: d.color }} />
          </div>
          <span className="text-xs font-semibold text-[var(--color-text-primary)] w-5 text-right">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type ViewMode = 'calendar' | 'timeline' | 'list'

export function AusenciasCalendarioPanel() {
  const { absences, workers } = useMaoDeObraStore(
    useShallow(s => ({ absences: s.absences, workers: s.workers }))
  )

  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay]   = useState<string | null>(null)
  const [showCharts, setShowCharts]     = useState(true)

  // Filters
  const [filterWorker,  setFilterWorker]  = useState('all')
  const [filterDept,    setFilterDept]    = useState('all')
  const [filterType,    setFilterType]    = useState<AbsenceType | 'all'>('all')
  const [filterStatus,  setFilterStatus]  = useState<WorkerAbsence['status'] | 'all'>('all')
  const [startDate,     setStartDate]     = useState('')
  const [endDate,       setEndDate]       = useState('')

  // Derived lists
  const workerMap = useMemo(() => {
    const m: Record<string, typeof workers[0]> = {}
    workers.forEach(w => { m[w.id] = w })
    return m
  }, [workers])

  const departments = useMemo(() => [...new Set(workers.map(w => w.department ?? 'Sem Depto').filter(Boolean))], [workers])

  const monthAbsences = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    return absences.filter(a => a.date.startsWith(monthStr))
  }, [absences, currentMonth])

  const filteredAbsences = useMemo(() => {
    return absences.filter(a => {
      if (filterWorker !== 'all' && a.workerId !== filterWorker) return false
      if (filterType   !== 'all' && a.type     !== filterType)   return false
      if (filterStatus !== 'all' && a.status   !== filterStatus) return false
      if (startDate && a.date < startDate) return false
      if (endDate   && a.date > endDate)   return false
      if (filterDept !== 'all') {
        const w = workerMap[a.workerId]
        if (!w || (w.department ?? 'Sem Depto') !== filterDept) return false
      }
      return true
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [absences, filterWorker, filterType, filterStatus, startDate, endDate, filterDept, workerMap])

  // Calendar uses month-filtered + user filters (except date range)
  const calendarAbsences = useMemo(() => {
    return monthAbsences.filter(a => {
      if (filterWorker !== 'all' && a.workerId !== filterWorker) return false
      if (filterType   !== 'all' && a.type     !== filterType)   return false
      if (filterStatus !== 'all' && a.status   !== filterStatus) return false
      if (filterDept !== 'all') {
        const w = workerMap[a.workerId]
        if (!w || (w.department ?? 'Sem Depto') !== filterDept) return false
      }
      return true
    })
  }, [monthAbsences, filterWorker, filterType, filterStatus, filterDept, workerMap])

  // Dashboard stats
  const now = new Date()
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1))
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekStr   = (d: Date) => format(d, 'yyyy-MM-dd')

  const absencesThisWeek  = absences.filter(a => a.date >= weekStr(weekStart) && a.date <= weekStr(weekEnd)).length
  const absencesThisMonth = monthAbsences.length
  const activeCount       = workers.filter(w => w.status === 'active').length
  const workingDaysMonth  = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) })
    .filter(d => d.getDay() !== 0).length
  const expectedDays      = activeCount * workingDaysMonth
  const absenceRate       = expectedDays > 0 ? ((absencesThisMonth / expectedDays) * 100).toFixed(1) : '0.0'
  const avgPerWorker      = activeCount > 0 ? (absencesThisMonth / activeCount).toFixed(1) : '0.0'

  // Chart data — absences by type (last 30d)
  const last30Start = new Date(); last30Start.setDate(last30Start.getDate() - 30)
  const last30Str   = format(last30Start, 'yyyy-MM-dd')
  const chartData   = (Object.keys(ABSENCE_LABELS) as AbsenceType[]).map(t => ({
    label: ABSENCE_LABELS[t],
    value: absences.filter(a => a.type === t && a.date >= last30Str).length,
    color: ABSENCE_DOT_COLORS[t],
  }))

  // Top 5 absent workers (last 30d)
  const top5 = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of absences.filter(a => a.date >= last30Str)) {
      counts[a.workerId] = (counts[a.workerId] ?? 0) + 1
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5)
      .map(([wId, count]) => ({ worker: workerMap[wId], count }))
      .filter(({ worker }) => !!worker)
  }, [absences, last30Str, workerMap])

  function handlePrevMonth() {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }
  function handleNextMonth() {
    setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }

  function handleExportCSV() {
    const headers = ['Data', 'Colaborador', 'Departamento', 'Tipo', 'Status', 'Substituto', 'Observações']
    const rows = filteredAbsences.map(a => {
      const w   = workerMap[a.workerId]
      const sub = a.substituteWorkerId ? (workerMap[a.substituteWorkerId]?.name ?? a.substituteWorkerId) : '—'
      return [
        a.date, w?.name ?? a.workerId, w?.department ?? '—',
        ABSENCE_LABELS[a.type], a.status, sub, a.description ?? '',
      ].map(csvCell).join(',')
    })
    const csv = [headers.map(csvCell).join(','), ...rows].join('\n')
    downloadCSV(csv, `ausencias-${format(new Date(), 'yyyy-MM-dd')}.csv`)
  }

  const workerList = workers.filter(w => w.status === 'active')
  const dayAbsences = selectedDay ? absences.filter(a => a.date === selectedDay) : []

  return (
    <div className="space-y-5">
      {/* Dashboard row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Taxa de Ausência',       value: `${absenceRate}%`,     color: parseFloat(absenceRate) > 5 ? 'text-[#ef4444]' : 'text-[#22c55e]' },
          { label: 'Ausências esta Semana',  value: absencesThisWeek,      color: absencesThisWeek > 0 ? 'text-[#f59e0b]' : 'text-[var(--color-text-primary)]' },
          { label: 'Ausências este Mês',     value: absencesThisMonth,     color: 'text-[var(--color-text-primary)]' },
          { label: 'Média por Colaborador',  value: `${avgPerWorker}d`,    color: 'text-[var(--color-text-secondary)]' },
        ].map(stat => (
          <div key={stat.label}
            className="flex flex-col items-center py-3 px-2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
            <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-[var(--color-text-muted)] text-center mt-0.5">{stat.label}</span>
          </div>
        ))}
      </div>

      {/* Charts (collapsible) */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
        <button onClick={() => setShowCharts(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors">
          <span>Análise de Ausências (30 dias)</span>
          <span className="text-xs text-[var(--color-text-muted)]">{showCharts ? '▲' : '▼'}</span>
        </button>
        {showCharts && (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase mb-3">Por Tipo</p>
              <AbsenceBarChart data={chartData} />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase mb-3">Top 5 Ausentes</p>
              {top5.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">Sem ausências nos últimos 30 dias</p>
              ) : (
                <div className="space-y-2">
                  {top5.map(({ worker, count }, i) => (
                    <div key={worker!.id} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--color-accent)]/10 text-[var(--color-accent)]">{i + 1}</span>
                      <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate">{worker!.name.split(' ').slice(0, 2).join(' ')}</span>
                      <span className="text-xs font-semibold text-[#ef4444]">{count}x</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
          <option value="all">Todos os colaboradores</option>
          {workerList.map(w => <option key={w.id} value={w.id}>{w.name.split(' ').slice(0, 2).join(' ')}</option>)}
        </select>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="px-2 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
          <option value="all">Todos os depto.</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value as AbsenceType | 'all')}
          className="px-2 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
          <option value="all">Todos os tipos</option>
          {(Object.keys(ABSENCE_LABELS) as AbsenceType[]).map(t => <option key={t} value={t}>{ABSENCE_LABELS[t]}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as WorkerAbsence['status'] | 'all')}
          className="px-2 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]">
          <option value="all">Todos os status</option>
          <option value="open">Em aberto</option>
          <option value="covered">Coberta</option>
          <option value="uncovered">Descoberta</option>
        </select>
        {viewMode === 'list' && (
          <>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
          </>
        )}
        <div className="ml-auto flex gap-2">
          <button onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">
            Exportar CSV
          </button>
          <button onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors">
            PDF
          </button>
        </div>
      </div>

      {/* View mode toggle + navigation */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
          {(['calendar', 'timeline', 'list'] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === v ? 'bg-[var(--color-accent)] text-white shadow-sm' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}>
              {v === 'calendar' ? 'Calendário' : v === 'timeline' ? 'Timeline' : 'Lista'}
            </button>
          ))}
        </div>
        {viewMode !== 'list' && (
          <div className="flex items-center gap-2">
            <button onClick={handlePrevMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors text-lg">
              ‹
            </button>
            <span className="min-w-[140px] text-center text-sm font-semibold text-[var(--color-text-primary)] capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <button onClick={handleNextMonth}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-secondary)] transition-colors text-lg">
              ›
            </button>
          </div>
        )}
      </div>

      {/* View content */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        {viewMode === 'calendar' && (
          <CalendarView
            month={currentMonth}
            absences={calendarAbsences}
            onDayClick={setSelectedDay}
          />
        )}
        {viewMode === 'timeline' && (
          <TimelineView
            month={currentMonth}
            absences={calendarAbsences}
            workers={workerList.map(w => ({ id: w.id, name: w.name }))}
          />
        )}
        {viewMode === 'list' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  {['Data', 'Colaborador', 'Departamento', 'Tipo', 'Status', 'Substituto'].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredAbsences.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]">Nenhuma ausência encontrada</td></tr>
                ) : filteredAbsences.map(a => {
                  const w   = workerMap[a.workerId]
                  const sub = a.substituteWorkerId ? (workerMap[a.substituteWorkerId]?.name ?? '—') : '—'
                  return (
                    <tr key={a.id} className="hover:bg-[var(--color-surface)] transition-colors">
                      <td className="px-3 py-2 text-[var(--color-text-secondary)] whitespace-nowrap">{new Date(a.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{w?.name ?? a.workerId}</td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{w?.department ?? '—'}</td>
                      <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ABSENCE_BG[a.type]}`}>{ABSENCE_LABELS[a.type]}</span></td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          a.status === 'covered'   ? 'bg-[#22c55e]/15 text-[#22c55e]' :
                          a.status === 'uncovered' ? 'bg-[#ef4444]/15 text-[#ef4444]' :
                                                     'bg-[#f59e0b]/15 text-[#f59e0b]'
                        }`}>
                          {a.status === 'covered' ? 'Coberta' : a.status === 'uncovered' ? 'Descoberta' : 'Aberta'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[var(--color-text-muted)]">{sub}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Day popover */}
      {selectedDay && (
        <DayPopover
          date={selectedDay}
          absences={dayAbsences}
          workerName={id => workerMap[id]?.name ?? id}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {/* Print-only layout */}
      <div className="hidden print:block mt-4">
        <h1 className="text-lg font-bold mb-1">Relatório de Ausências</h1>
        <p className="text-xs text-[#6b6b6b] mb-1">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
        <div className="flex gap-6 text-xs mb-3">
          <span>Total: <strong>{filteredAbsences.length}</strong></span>
          <span>Atestado: <strong>{filteredAbsences.filter(a => a.type === 'sick_leave').length}</strong></span>
          <span>Férias: <strong>{filteredAbsences.filter(a => a.type === 'vacation').length}</strong></span>
          <span>Injustificadas: <strong>{filteredAbsences.filter(a => a.type === 'unjustified').length}</strong></span>
          <span>Cobertas: <strong>{filteredAbsences.filter(a => a.status === 'covered').length}</strong></span>
          <span>Descobertas: <strong>{filteredAbsences.filter(a => a.status === 'uncovered').length}</strong></span>
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Data', 'Colaborador', 'Departamento', 'Tipo', 'Status', 'Substituto'].map((h) => (
                <th key={h} className="border border-gray-400 px-2 py-1 text-left bg-gray-100">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAbsences.map((a, i) => {
              const w = workerMap[a.workerId]
              const sub = a.substituteWorkerId ? workerMap[a.substituteWorkerId]?.name ?? '—' : '—'
              return (
                <tr key={i}>
                  <td className="border border-gray-300 px-2 py-1">{a.date}</td>
                  <td className="border border-gray-300 px-2 py-1">{w?.name ?? a.workerId}</td>
                  <td className="border border-gray-300 px-2 py-1">{w?.department ?? '—'}</td>
                  <td className="border border-gray-300 px-2 py-1">{ABSENCE_LABELS[a.type]}</td>
                  <td className="border border-gray-300 px-2 py-1">{a.status}</td>
                  <td className="border border-gray-300 px-2 py-1">{sub}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
