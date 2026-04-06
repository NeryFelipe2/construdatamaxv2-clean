import { useState, useMemo, useCallback } from 'react'
import { Calendar, LayoutGrid, List, Settings, Zap, X, Plus } from 'lucide-react'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { useShallow } from 'zustand/react/shallow'
import type { Shift, CLTViolationLevel, CLTSettings } from '@/types'
import { calcShiftHours } from '../utils/cltEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIFT_TYPE_COLOR: Record<string, string> = {
  regular:  '#3b82f6',
  overtime: '#f97316',
  night:    '#8b5cf6',
  holiday:  '#22c55e',
  day_off:  '#6b6b6b',
  absent:   '#ef4444',
}
const SHIFT_TYPE_LABEL: Record<string, string> = {
  regular: 'Regular', overtime: 'HE', night: 'Noturno',
  holiday: 'Feriado', day_off: 'DSR', absent: 'Falta',
}
const SEVERITY_COLOR: Record<CLTViolationLevel, string> = {
  blocking: '#ef4444', warning: '#f59e0b', info: '#6b6b6b',
}
const SEVERITY_LABEL: Record<CLTViolationLevel, string> = {
  blocking: 'Bloqueante', warning: 'Aviso', info: 'Info',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthDates(year: number, month: number): Date[] {
  const count = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) => new Date(year, month, i + 1))
}

function weekOf(date: Date): Date[] {
  const d = new Date(date)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return dd
  })
}

function toYMD(d: Date): string { return d.toISOString().slice(0, 10) }

// ─── Shift Dialog (add/edit) ──────────────────────────────────────────────────

interface ShiftDialogProps {
  initial?: Partial<Shift>
  workers: { id: string; name: string; role: string }[]
  onSave: (shift: Omit<Shift, 'id'>) => void
  onDelete?: () => void
  onClose: () => void
}

function ShiftDialog({ initial, workers, onSave, onDelete, onClose }: ShiftDialogProps) {
  const [form, setForm] = useState({
    workerId:     initial?.workerId ?? (workers[0]?.id ?? ''),
    date:         initial?.date ?? toYMD(new Date()),
    startTime:    initial?.startTime ?? '07:00',
    endTime:      initial?.endTime ?? '16:00',
    breakMinutes: initial?.breakMinutes ?? 60,
    type:         initial?.type ?? 'regular',
    workFront:    initial?.workFront ?? '',
    status:       initial?.status ?? 'scheduled',
    overtimeReason: initial?.overtimeReason ?? '',
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave(form as Omit<Shift, 'id'>)
  }

  const fieldClass = 'w-full bg-[#333333] border border-[#1f3c5e] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316]'
  const labelClass = 'block text-[#6b6b6b] text-xs mb-1'

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#333333] border border-[#525252] rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-[#525252]">
          <h3 className="text-[#f5f5f5] text-sm font-semibold">{initial?.id ? 'Editar Turno' : 'Novo Turno'}</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div>
            <label className={labelClass}>Colaborador</label>
            <select className={fieldClass} value={form.workerId} onChange={(e) => setForm((p) => ({ ...p, workerId: e.target.value }))}>
              {workers.map((w) => <option key={w.id} value={w.id}>{w.name} — {w.role}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Data</label>
              <input type="date" className={fieldClass} value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Tipo</label>
              <select className={fieldClass} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Shift['type'] }))}>
                {Object.entries(SHIFT_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Início</label>
              <input type="time" className={fieldClass} value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))} />
            </div>
            <div>
              <label className={labelClass}>Término</label>
              <input type="time" className={fieldClass} value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Intervalo (min)</label>
              <input type="number" min="0" className={fieldClass} value={form.breakMinutes} onChange={(e) => setForm((p) => ({ ...p, breakMinutes: parseInt(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={fieldClass} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as Shift['status'] }))}>
                <option value="scheduled">Agendado</option>
                <option value="confirmed">Confirmado</option>
                <option value="absent">Ausente</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Frente de Trabalho</label>
            <input className={fieldClass} value={form.workFront ?? ''} onChange={(e) => setForm((p) => ({ ...p, workFront: e.target.value }))} />
          </div>
          {form.type === 'overtime' && (
            <div>
              <label className={labelClass}>Motivo da HE</label>
              <input className={fieldClass} value={form.overtimeReason ?? ''} onChange={(e) => setForm((p) => ({ ...p, overtimeReason: e.target.value }))} />
            </div>
          )}
          <div className="flex justify-between pt-1">
            {onDelete && (
              <button type="button" onClick={onDelete} className="px-3 py-1.5 rounded-lg border border-[#ef4444]/40 text-[#ef4444] text-xs hover:bg-[#ef4444]/10">
                Remover
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#f5f5f5]">Cancelar</button>
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold">Salvar</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── CLT Settings Modal ───────────────────────────────────────────────────────

function CLTSettingsModal({ settings, onSave, onClose }: { settings: CLTSettings; onSave: (s: Partial<CLTSettings>) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...settings })
  const num = (field: keyof CLTSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))
  const fieldClass = 'w-full bg-[#333333] border border-[#1f3c5e] rounded-lg px-3 py-2 text-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316]'
  const labelClass = 'block text-[#6b6b6b] text-xs mb-1'
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#333333] border border-[#525252] rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-[#525252]">
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Configurações CLT</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label className={labelClass}>Jornada diária (h)</label><input type="number" className={fieldClass} value={form.maxDailyHours} onChange={num('maxDailyHours')} /></div>
          <div><label className={labelClass}>HE máx/dia (h)</label><input type="number" className={fieldClass} value={form.maxOvertimeHours} onChange={num('maxOvertimeHours')} /></div>
          <div><label className={labelClass}>Jornada semanal (h)</label><input type="number" className={fieldClass} value={form.maxWeeklyHours} onChange={num('maxWeeklyHours')} /></div>
          <div><label className={labelClass}>Descanso mín entre turnos (min)</label><input type="number" className={fieldClass} value={form.minRestMinutes} onChange={num('minRestMinutes')} /></div>
          <div><label className={labelClass}>Início noturno (h)</label><input type="number" className={fieldClass} value={form.nightStart} onChange={num('nightStart')} /></div>
          <div><label className={labelClass}>Fim noturno (h)</label><input type="number" className={fieldClass} value={form.nightEnd} onChange={num('nightEnd')} /></div>
          <div><label className={labelClass}>Adicional noturno (%)</label><input type="number" className={fieldClass} value={form.nightDifferential} onChange={num('nightDifferential')} /></div>
          <div><label className={labelClass}>Taxa HE (%)</label><input type="number" className={fieldClass} value={form.overtimeRate} onChange={num('overtimeRate')} /></div>
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs">Cancelar</button>
            <button onClick={() => { onSave(form); onClose() }} className="px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold">Salvar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Monthly View ─────────────────────────────────────────────────────────────

function MonthlyView({ shifts, year, month, onDayClick }: { shifts: Shift[]; year: number; month: number; onDayClick: (date: string) => void }) {
  const dates = monthDates(year, month)
  const firstDow = dates[0].getDay() // 0=Sun

  // Build shift counts per date
  const shiftsByDate = useMemo(() => {
    const m = new Map<string, { total: number; absent: number; dayOff: number }>()
    shifts.forEach((s) => {
      const cur = m.get(s.date) ?? { total: 0, absent: 0, dayOff: 0 }
      if (s.type === 'day_off') cur.dayOff++
      else if (s.status === 'absent') cur.absent++
      else cur.total++
      m.set(s.date, cur)
    })
    return m
  }, [shifts])

  const days = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const blanks = firstDow === 0 ? 6 : firstDow - 1

  return (
    <div>
      <div className="grid grid-cols-7 gap-px">
        {days.map((d) => (
          <div key={d} className="py-2 text-center text-[10px] text-[#6b6b6b] font-semibold">{d}</div>
        ))}
        {Array.from({ length: blanks }).map((_, i) => <div key={`b-${i}`} />)}
        {dates.map((date) => {
          const ymd  = toYMD(date)
          const info = shiftsByDate.get(ymd)
          const dow  = date.getDay()
          const isWeekend = dow === 0 || dow === 6
          const color = info
            ? info.absent > 0 ? '#ef4444' : info.dayOff > 0 ? '#6b6b6b' : '#22c55e'
            : isWeekend ? '#1f3c5e' : '#525252'
          return (
            <button
              key={ymd}
              onClick={() => onDayClick(ymd)}
              className="flex flex-col items-center justify-start p-1 rounded-lg border hover:border-[#f97316]/50 transition-colors h-14"
              style={{ backgroundColor: `${color}0f`, borderColor: `${color}30` }}
            >
              <span className="text-[11px] font-semibold" style={{ color: isWeekend ? '#3f3f3f' : '#f5f5f5' }}>{date.getDate()}</span>
              {info && (
                <span className="text-[9px] mt-0.5" style={{ color }}>
                  {info.dayOff > 0 ? 'DSR' : `${info.total}↑${info.absent > 0 ? ` ${info.absent}✗` : ''}`}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Weekly View ──────────────────────────────────────────────────────────────

function WeeklyView({ shifts, workers, dates, onCellClick }: {
  shifts: Shift[]
  workers: { id: string; name: string }[]
  dates: Date[]
  onCellClick: (workerId: string, date: string) => void
}) {
  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift[]>()
    shifts.forEach((s) => {
      const key = `${s.workerId}|${s.date}`
      m.set(key, [...(m.get(key) ?? []), s])
    })
    return m
  }, [shifts])

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left px-2 py-2 text-[#6b6b6b] font-medium w-32">Colaborador</th>
            {dates.map((d) => (
              <th key={toYMD(d)} className="text-center px-1 py-2 text-[#6b6b6b] font-medium min-w-[80px]">
                <div>{['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()]}</div>
                <div className="text-[10px]">{d.getDate().toString().padStart(2, '0')}/{(d.getMonth() + 1).toString().padStart(2, '0')}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.id} className="border-t border-[#525252]">
              <td className="px-2 py-1.5 text-[#f5f5f5] font-medium truncate max-w-[128px]">{w.name.split(' ')[0]}</td>
              {dates.map((d) => {
                const ymd = toYMD(d)
                const dayShifts = shiftMap.get(`${w.id}|${ymd}`) ?? []
                return (
                  <td
                    key={ymd}
                    className="px-1 py-1 text-center cursor-pointer hover:bg-[#484848]"
                    onClick={() => onCellClick(w.id, ymd)}
                  >
                    {dayShifts.length === 0 ? (
                      <span className="text-[#1f3c5e]">—</span>
                    ) : (
                      dayShifts.map((s) => {
                        const color = SHIFT_TYPE_COLOR[s.status === 'absent' ? 'absent' : s.type]
                        return (
                          <div key={s.id} className="rounded px-1 py-0.5 text-[9px] font-semibold leading-tight" style={{ backgroundColor: `${color}22`, color }}>
                            {s.type === 'day_off' ? 'DSR' : s.status === 'absent' ? 'Falta' : `${s.startTime}–${s.endTime}`}
                          </div>
                        )
                      })
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Daily View ───────────────────────────────────────────────────────────────

function DailyView({ shifts, workers, selectedDate, onAddShift, onEditShift }: {
  shifts: Shift[]
  workers: { id: string; name: string; role: string }[]
  selectedDate: string
  onAddShift: () => void
  onEditShift: (shift: Shift) => void
}) {
  const dayShifts = shifts.filter((s) => s.date === selectedDate)
  const workerMap = new Map(workers.map((w) => [w.id, w]))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        <button onClick={onAddShift} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold">
          <Plus size={12} /> Adicionar Turno
        </button>
      </div>
      {dayShifts.length === 0 ? (
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-6 text-center">
          <p className="text-[#6b6b6b] text-sm">Nenhum turno registrado para este dia.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {dayShifts.map((s) => {
            const w = workerMap.get(s.workerId)
            const color = SHIFT_TYPE_COLOR[s.status === 'absent' ? 'absent' : s.type]
            const hours = calcShiftHours(s)
            return (
              <div
                key={s.id}
                className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:border-[#f97316]/30"
                style={{ borderLeft: `3px solid ${color}` }}
                onClick={() => onEditShift(s)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[#f5f5f5] text-xs font-semibold truncate">{w?.name ?? s.workerId}</span>
                    <span className="text-[#6b6b6b] text-[10px]">{w?.role}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-[#6b6b6b]">
                    {s.type !== 'day_off' && <span>{s.startTime}–{s.endTime} · {hours.toFixed(1)}h</span>}
                    {s.workFront && <span>📍 {s.workFront}</span>}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0" style={{ backgroundColor: `${color}18`, color }}>
                  {s.type === 'day_off' ? 'DSR' : s.status === 'absent' ? 'Falta' : SHIFT_TYPE_LABEL[s.type]}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function EscalaInteligentePanel() {
  const {
    workers, shifts, violations, cltSettings,
    addShift, updateShift, removeShift, generateSchedule, revalidateCLT, updateCLTSettings,
  } = useMaoDeObraStore(useShallow((s) => ({
    workers: s.workers, shifts: s.shifts, violations: s.violations,
    cltSettings: s.cltSettings,
    addShift: s.addShift, updateShift: s.updateShift, removeShift: s.removeShift,
    generateSchedule: s.generateSchedule, revalidateCLT: s.revalidateCLT,
    updateCLTSettings: s.updateCLTSettings,
  })))

  const now = new Date()
  const [viewMode,     setViewMode]     = useState<'month' | 'week' | 'day'>('month')
  const [year,         setYear]         = useState(now.getFullYear())
  const [month,        setMonth]        = useState(now.getMonth())
  const [selectedDate, setSelectedDate] = useState(toYMD(now))
  const [shiftDialog,  setShiftDialog]  = useState<{ open: boolean; initial?: Partial<Shift> }>({ open: false })
  const [showSettings, setShowSettings] = useState(false)

  const weekDates = useMemo(() => weekOf(new Date(selectedDate + 'T00:00:00')), [selectedDate])
  const activeWorkers = useMemo(() => workers.filter((w) => w.status !== 'suspended'), [workers])

  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`

  const blocking = useMemo(() => violations.filter((v) => v.severity === 'blocking'), [violations])
  const warnings  = useMemo(() => violations.filter((v) => v.severity === 'warning'), [violations])

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date)
    setViewMode('day')
  }, [])

  function handleCellClick(workerId: string, date: string) {
    setSelectedDate(date)
    setShiftDialog({ open: true, initial: { workerId, date } })
  }

  function handleSaveShift(shift: Omit<Shift, 'id'>) {
    if (shiftDialog.initial?.id) {
      updateShift(shiftDialog.initial.id, shift)
    } else {
      addShift(shift)
    }
    revalidateCLT()
    setShiftDialog({ open: false })
  }

  function handleDeleteShift() {
    if (shiftDialog.initial?.id) {
      removeShift(shiftDialog.initial.id)
      revalidateCLT()
    }
    setShiftDialog({ open: false })
  }

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* View mode */}
        <div className="flex rounded-lg border border-[#525252] overflow-hidden">
          {([['month', Calendar, 'Mês'], ['week', LayoutGrid, 'Semana'], ['day', List, 'Dia']] as const).map(([mode, Icon, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors"
              style={{
                background: viewMode === mode ? '#f97316' : 'transparent',
                color: viewMode === mode ? '#fff' : '#6b6b6b',
              }}
            >
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* Month/Year navigation */}
        {viewMode !== 'day' && (
          <>
            <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }} className="px-2 py-1.5 text-[#6b6b6b] hover:text-[#f5f5f5]">‹</button>
            <span className="text-[#f5f5f5] text-xs font-semibold min-w-20 text-center">{monthNames[month]} {year}</span>
            <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }} className="px-2 py-1.5 text-[#6b6b6b] hover:text-[#f5f5f5]">›</button>
          </>
        )}

        {viewMode === 'day' && (
          <>
            <button onClick={() => { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() - 1); setSelectedDate(toYMD(d)) }} className="px-2 py-1.5 text-[#6b6b6b] hover:text-[#f5f5f5]">‹</button>
            <span className="text-[#f5f5f5] text-xs font-semibold">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            <button onClick={() => { const d = new Date(selectedDate + 'T00:00:00'); d.setDate(d.getDate() + 1); setSelectedDate(toYMD(d)) }} className="px-2 py-1.5 text-[#6b6b6b] hover:text-[#f5f5f5]">›</button>
          </>
        )}

        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#f5f5f5]">
            <Settings size={12} /> CLT
          </button>
          <button
            onClick={() => { generateSchedule(currentMonthStr) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3b82f6] text-white text-xs font-semibold hover:bg-[#2563eb]"
          >
            <Zap size={12} /> Gerar Escala Automática
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main calendar/grid */}
        <div className="lg:col-span-2 bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
          {viewMode === 'month' && (
            <MonthlyView shifts={shifts} year={year} month={month} onDayClick={handleDayClick} />
          )}
          {viewMode === 'week' && (
            <WeeklyView shifts={shifts} workers={activeWorkers} dates={weekDates} onCellClick={handleCellClick} />
          )}
          {viewMode === 'day' && (
            <DailyView
              shifts={shifts}
              workers={activeWorkers}
              selectedDate={selectedDate}
              onAddShift={() => setShiftDialog({ open: true, initial: { date: selectedDate } })}
              onEditShift={(s) => setShiftDialog({ open: true, initial: s })}
            />
          )}
        </div>

        {/* CLT Alert Panel */}
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[#f5f5f5] text-sm font-semibold">Alertas CLT</p>
            <div className="flex gap-1.5">
              {blocking.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: '#ef444418', color: '#ef4444' }}>
                  {blocking.length} bloqueante{blocking.length !== 1 ? 's' : ''}
                </span>
              )}
              {warnings.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{ backgroundColor: '#f59e0b18', color: '#f59e0b' }}>
                  {warnings.length} aviso{warnings.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {violations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-[#22c55e] text-xs text-center">✓ Nenhuma violação CLT detectada</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-[400px]">
              {violations.slice(0, 20).map((v) => {
                const color = SEVERITY_COLOR[v.severity]
                return (
                  <div key={v.id} className="rounded-lg p-2.5" style={{ backgroundColor: `${color}0f`, border: `1px solid ${color}22` }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[9px] font-bold px-1 rounded" style={{ backgroundColor: `${color}22`, color }}>{SEVERITY_LABEL[v.severity]}</span>
                      <span className="text-[#6b6b6b] text-[9px]">{v.date}</span>
                    </div>
                    <p className="text-[10px] leading-relaxed" style={{ color }}>{v.description}</p>
                  </div>
                )
              })}
              {violations.length > 20 && (
                <p className="text-[#6b6b6b] text-[10px] text-center">+ {violations.length - 20} mais…</p>
              )}
            </div>
          )}

          {/* Legend */}
          <div className="border-t border-[#525252] pt-3">
            <p className="text-[#6b6b6b] text-[10px] mb-2">Tipos de turno</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(SHIFT_TYPE_LABEL).map(([type, label]) => (
                <span key={type} className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: `${SHIFT_TYPE_COLOR[type]}18`, color: SHIFT_TYPE_COLOR[type] }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {shiftDialog.open && (
        <ShiftDialog
          initial={shiftDialog.initial}
          workers={activeWorkers}
          onSave={handleSaveShift}
          onDelete={shiftDialog.initial?.id ? handleDeleteShift : undefined}
          onClose={() => setShiftDialog({ open: false })}
        />
      )}

      {showSettings && (
        <CLTSettingsModal
          settings={cltSettings}
          onSave={(s) => { updateCLTSettings(s); revalidateCLT() }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
