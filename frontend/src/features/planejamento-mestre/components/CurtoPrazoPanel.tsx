/**
 * CurtoPrazoPanel — Curto Prazo: 15-day production board.
 * Consumes useOperacaoCampoStore for calendar data, PPC, and S-curve.
 * Layout: calendar grid (top) + weekly PPC strip + impact section (S-curve + delay table).
 */
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, Activity } from 'lucide-react'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { useShallow } from 'zustand/react/shallow'
import type { TrendPoint, NotableServiceCurve } from '@/types'
import { cn } from '@/lib/utils'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function getDayName(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

function ppcColor(v: number): string {
  if (v >= 80) return 'text-[#22c55e]'
  if (v >= 60) return 'text-[#fbbf24]'
  return 'text-[#ef4444]'
}

function ppcBadgeColor(v: number): string {
  if (v >= 80) return 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
  if (v >= 60) return 'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/30'
  return 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
}

// ─── S-Curve chart ────────────────────────────────────────────────────────────

function SCurve({ points }: { points: TrendPoint[] }) {
  const valid = points.filter((p) => p.plannedCumulativePct > 0 || p.actualCumulativePct > 0)
  if (valid.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-[#6b6b6b] text-xs">
        Sem dados suficientes
      </div>
    )
  }

  const W = 400, H = 140, PAD_L = 36, PAD_B = 20, PAD_T = 8

  function px(i: number, total: number) { return PAD_L + (i / Math.max(1, total - 1)) * (W - PAD_L - 8) }
  function py(v: number) { return H - PAD_B - ((v / 100) * (H - PAD_B - PAD_T)) }

  const plannedPath = valid.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i, valid.length).toFixed(1)},${py(p.plannedCumulativePct).toFixed(1)}`
  ).join(' ')

  const actualPoints = valid.filter((p) => p.actualCumulativePct > 0)
  const actualPath = actualPoints.map((p) => {
    const i = valid.indexOf(p)
    return `${i === actualPoints.indexOf(p) && i === 0 ? 'M' : 'L'}${px(i, valid.length).toFixed(1)},${py(p.actualCumulativePct).toFixed(1)}`
  }).join(' ')

  const lastActual  = actualPoints[actualPoints.length - 1]
  const matchedPlan = valid.find((p) => p.date === lastActual?.date)
  const isDelayed   = lastActual && matchedPlan && lastActual.actualCumulativePct < matchedPlan.plannedCumulativePct - 2

  const step = Math.max(1, Math.floor(valid.length / 5))
  const xLabels = valid.filter((_, i) => i % step === 0 || i === valid.length - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {/* Grid */}
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={PAD_L} y1={py(v)} x2={W - 8} y2={py(v)} stroke="#525252" strokeWidth={0.5} strokeDasharray="4,3" />
          <text x={PAD_L - 3} y={py(v) + 3} textAnchor="end" fontSize={8} fill="#6b6b6b" fontFamily="monospace">{v}%</text>
        </g>
      ))}

      {/* Red zone if delayed */}
      {isDelayed && actualPoints.length > 1 && (() => {
        const areaPath = actualPoints.map((p, i) => {
          const vi = valid.indexOf(p)
          return `${i === 0 ? 'M' : 'L'}${px(vi, valid.length).toFixed(1)},${py(p.actualCumulativePct).toFixed(1)}`
        }).join(' ')
        const closePath = [...actualPoints].reverse().map((p) => {
          const vi = valid.indexOf(p)
          const plan = valid[vi]
          return `L${px(vi, valid.length).toFixed(1)},${py(plan?.plannedCumulativePct ?? 0).toFixed(1)}`
        }).join(' ')
        return <path d={`${areaPath} ${closePath} Z`} fill="#ef4444" opacity={0.1} />
      })()}

      {/* Planned — dashed */}
      <path d={plannedPath} fill="none" stroke="#6b7280" strokeWidth={2} strokeDasharray="6,3" />
      {/* Actual — solid */}
      {actualPath && <path d={actualPath} fill="none" stroke="#f97316" strokeWidth={2.5} />}

      {/* X labels */}
      {xLabels.map((p) => {
        const i = valid.indexOf(p)
        return (
          <text key={p.date} x={px(i, valid.length)} y={H - 4} textAnchor="middle" fontSize={7} fill="#6b6b6b" fontFamily="monospace">
            {p.date.slice(5).replace('-', '/')}
          </text>
        )
      })}

      {/* Legend */}
      <line x1={W - 140} y1={PAD_T + 4} x2={W - 122} y2={PAD_T + 4} stroke="#6b7280" strokeWidth={2} strokeDasharray="6,3" />
      <text x={W - 119} y={PAD_T + 7} fontSize={8} fill="#9ca3af">Previsto</text>
      <line x1={W - 70} y1={PAD_T + 4} x2={W - 52} y2={PAD_T + 4} stroke="#f97316" strokeWidth={2.5} />
      <text x={W - 49} y={PAD_T + 7} fontSize={8} fill="#9ca3af">Realizado</text>

      {isDelayed && (
        <text x={PAD_L + 4} y={PAD_T + 12} fontSize={8} fill="#ef4444">▲ Atraso detectado</text>
      )}
    </svg>
  )
}

// ─── Notable Service bars ─────────────────────────────────────────────────────

function ServiceBar({ curve }: { curve: NotableServiceCurve }) {
  const last = [...curve.dataPoints].reverse().find((p) => p.planned > 0 || p.actual > 0)
  if (!last) return null
  const planPct = Math.min(100, Math.round((last.planned / Math.max(1, last.planned)) * 100))
  const actPct  = last.planned > 0 ? Math.min(100, Math.round((last.actual / last.planned) * 100)) : 0
  const color   = actPct >= 80 ? '#22c55e' : actPct >= 60 ? '#fbbf24' : '#ef4444'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#a3a3a3] truncate max-w-[160px]">{curve.serviceName}</span>
        <span className="text-[10px] font-mono" style={{ color }}>{actPct}%</span>
      </div>
      <div className="relative h-2 rounded-full bg-[#484848] overflow-hidden">
        {/* Planned bar */}
        <div className="absolute inset-0 bg-[#3a4a6b] rounded-full" style={{ width: `${planPct}%` }} />
        {/* Actual bar */}
        <div className="absolute inset-0 rounded-full transition-all" style={{ width: `${actPct}%`, backgroundColor: color }} />
      </div>
      <div className="flex justify-between text-[9px] text-[#6b6b6b]">
        <span>Plan: {last.planned} {curve.unit}</span>
        <span>Real: {last.actual} {curve.unit}</span>
      </div>
    </div>
  )
}

// ─── Delay impact table ───────────────────────────────────────────────────────

function DelayImpactTable() {
  const { activities, calendarDays } = useOperacaoCampoStore(
    useShallow((s) => ({ activities: s.activities, calendarDays: s.calendarDays }))
  )

  const today = new Date().toISOString().slice(0, 10)
  const pastDays = calendarDays.filter((d) => d.date <= today)

  const impacts = activities.map((act) => {
    const days = pastDays.filter((d) => d.activityId === act.id)
    const totalPlanned = days.reduce((s, d) => s + (d.plannedQty ?? 0), 0)
    const totalActual  = days.reduce((s, d) => s + (d.actualQty ?? 0), 0)
    const rate = totalPlanned > 0 ? totalActual / totalPlanned : 1
    const deltaQty = totalPlanned - totalActual
    return { act, totalPlanned, totalActual, rate, deltaQty }
  }).filter((r) => r.rate < 0.85 && r.totalPlanned > 0)
    .sort((a, b) => a.rate - b.rate)

  if (impacts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-[#22c55e] text-xs py-3">
        <span>✓</span>
        <span>Todas as atividades estão dentro do ritmo planejado.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {impacts.map(({ act, totalPlanned, totalActual, rate }) => (
        <div key={act.id} className="flex items-center gap-3 py-1.5 border-b border-[#525252]/30">
          <AlertTriangle size={12} className="text-[#ef4444] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#f5f5f5] truncate">{act.name}</p>
            <p className="text-[9px] text-[#6b6b6b]">Plan: {totalPlanned} · Real: {totalActual}</p>
          </div>
          <span className={cn('text-[10px] font-bold tabular-nums px-2 py-0.5 rounded border', ppcBadgeColor(Math.round(rate * 100)))}>
            {Math.round(rate * 100)}%
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function CurtoPrazoPanel() {
  const {
    activities, calendarDays, selectedDate, weeklyPpcResults,
    trendPoints, notableServiceCurves,
    setSelectedDate, updateCalendarDay, loadDemoData,
  } = useOperacaoCampoStore(
    useShallow((s) => ({
      activities:           s.activities,
      calendarDays:         s.calendarDays,
      selectedDate:         s.selectedDate,
      weeklyPpcResults:     s.weeklyPpcResults,
      trendPoints:          s.trendPoints,
      notableServiceCurves: s.notableServiceCurves,
      setSelectedDate:      s.setSelectedDate,
      updateCalendarDay:    s.updateCalendarDay,
      loadDemoData:         s.loadDemoData,
    }))
  )

  useEffect(() => {
    if (activities.length === 0) loadDemoData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date().toISOString().slice(0, 10)

  // Build 15 workdays from selectedDate
  const visibleDates: string[] = []
  const iter = new Date(selectedDate + 'T00:00:00')
  while (visibleDates.length < 15) {
    const dow = iter.getDay()
    if (dow !== 0 && dow !== 6) visibleDates.push(iter.toISOString().slice(0, 10))
    iter.setDate(iter.getDate() + 1)
  }

  function shiftDate(days: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().slice(0, 10))
  }

  // Daily PPC: for each date, how many activities have actual >= planned?
  function dailyPpc(date: string): number | null {
    const entries = calendarDays.filter((d) => d.date === date && (d.plannedQty ?? 0) > 0)
    if (entries.length === 0) return null
    const met = entries.filter((d) => (d.actualQty ?? 0) >= (d.plannedQty ?? 0)).length
    return Math.round((met / entries.length) * 100)
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto">

      {/* ── A: 15-Day Production Calendar ─────────────────────────────────── */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap px-4 py-3 border-b border-[#525252]">
          <h3 className="text-[#f5f5f5] text-sm font-semibold flex-1">
            Agenda de Produção — 15 Dias
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => shiftDate(-15)} className="p-1.5 rounded border border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-[#a3a3a3] font-mono px-2">
              {fmtShortDate(visibleDates[0] ?? today)} — {fmtShortDate(visibleDates[14] ?? today)}
            </span>
            <button onClick={() => shiftDate(15)} className="p-1.5 rounded border border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]">
              <ChevronRight size={14} />
            </button>
            <button onClick={() => setSelectedDate(today)} className="text-xs text-[#f97316] hover:underline ml-1">
              Hoje
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table
            className="w-full text-[10px] border-collapse"
            style={{ minWidth: `${160 + visibleDates.length * 52}px` }}
          >
            <thead>
              <tr className="bg-[#2c2c2c]">
                <th className="sticky left-0 z-10 bg-[#2c2c2c] px-3 py-2 text-left text-[#6b6b6b] font-medium w-32">Atividade</th>
                <th className="sticky left-32 z-10 bg-[#2c2c2c] px-1 py-2 text-center text-[#6b6b6b] font-medium w-8 border-r border-[#525252]/50">P/R</th>
                {visibleDates.map((date) => (
                  <th
                    key={date}
                    className={cn(
                      'px-1 py-2 text-center font-medium min-w-[48px]',
                      date === today ? 'text-[#f97316] bg-[#f97316]/5' : 'text-[#6b6b6b]'
                    )}
                  >
                    <div className="font-semibold">{fmtShortDate(date)}</div>
                    <div className="text-[8px] uppercase opacity-60">{getDayName(date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <>
                  {/* Planejado row */}
                  <tr key={`${act.id}-P`} className="border-t border-[#525252]/40">
                    <td
                      rowSpan={2}
                      className="sticky left-0 z-10 bg-[#3d3d3d] px-3 py-1.5 text-[#f5f5f5] text-[11px] font-medium align-middle border-r border-[#525252]/50"
                    >
                      <div className="truncate max-w-[120px]">{act.name}</div>
                      <div className="text-[#6b6b6b] text-[9px]">{act.trechoCode ?? ''}</div>
                    </td>
                    <td className="sticky left-32 z-10 bg-[#3d3d3d] px-1 py-0.5 text-center text-[#6b6b6b] text-[9px] font-semibold border-r border-[#525252]/50">P</td>
                    {visibleDates.map((date) => {
                      const entry = calendarDays.find((d) => d.date === date && d.activityId === act.id)
                      return (
                        <td key={date} className={cn('px-1 py-0.5 text-center font-mono bg-[#484848]/20', date === today && 'bg-[#f97316]/5')}>
                          <span className="text-[#6b6b6b]">{entry?.plannedQty ?? '—'}</span>
                        </td>
                      )
                    })}
                  </tr>
                  {/* Realizado row */}
                  <tr key={`${act.id}-R`} className="border-b border-[#525252]/30">
                    <td className="sticky left-32 z-10 bg-[#3d3d3d] px-1 py-0.5 text-center text-[#f97316] text-[9px] font-semibold border-r border-[#525252]/50">R</td>
                    {visibleDates.map((date) => {
                      const entry = calendarDays.find((d) => d.date === date && d.activityId === act.id)
                      const planned = entry?.plannedQty ?? 0
                      const actual  = entry?.actualQty
                      const isPast  = date <= today

                      let bg = ''
                      if (actual !== null && actual !== undefined) {
                        bg = actual >= planned ? 'bg-[#22c55e]/8' : 'bg-[#ef4444]/8'
                      }

                      return (
                        <td key={date} className={cn('px-0.5 py-0.5 text-center', bg, date === today && 'bg-[#f97316]/5')}>
                          {isPast || date === today ? (
                            <input
                              type="number"
                              min={0}
                              value={actual ?? ''}
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : Number(e.target.value)
                                updateCalendarDay(date, act.id, { actualQty: val })
                              }}
                              className="w-full bg-transparent text-center text-[#f5f5f5] font-mono focus:outline-none focus:bg-[#f97316]/10 rounded px-0.5 py-0.5"
                              placeholder="—"
                            />
                          ) : (
                            <span className="text-[#525252]">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </>
              ))}

              {/* Daily PPC footer row */}
              <tr className="border-t-2 border-[#525252] bg-[#2c2c2c]">
                <td className="sticky left-0 z-10 bg-[#2c2c2c] px-3 py-1.5 text-[#f97316] text-[10px] font-bold" colSpan={2}>
                  PPC Diário
                </td>
                {visibleDates.map((date) => {
                  const v = dailyPpc(date)
                  return (
                    <td key={date} className="px-1 py-1.5 text-center bg-[#2c2c2c]">
                      {v !== null ? (
                        <span className={cn('font-bold font-mono text-[10px]', ppcColor(v))}>{v}%</span>
                      ) : (
                        <span className="text-[#525252] text-[10px]">—</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── B: Weekly PPC Strip ───────────────────────────────────────────── */}
      {weeklyPpcResults.length > 0 && (
        <div>
          <h3 className="text-[#f5f5f5] text-sm font-semibold mb-3">PPC Semanal</h3>
          <div className="grid grid-cols-6 gap-2">
            {weeklyPpcResults.slice(-6).map((w, i) => (
              <div key={i} className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-3 flex flex-col gap-1.5">
                <p className="text-[#6b6b6b] text-[10px] font-semibold">S{i + 1}</p>
                <p className={cn('text-xl font-bold tabular-nums', ppcColor(w.ppc))}>{w.ppc}%</p>
                <div className="h-1 rounded-full bg-[#484848] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${w.ppc}%`, backgroundColor: w.ppc >= 80 ? '#22c55e' : w.ppc >= 60 ? '#fbbf24' : '#ef4444' }}
                  />
                </div>
                <p className="text-[9px] text-[#6b6b6b]">{w.totalCompleted}/{w.totalPlanned} concl.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── C: Impact Visualization ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* S-Curve */}
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-[#f97316]" />
            <h3 className="text-[#f5f5f5] text-sm font-semibold">Curva S — Previsto vs Realizado</h3>
          </div>
          <SCurve points={trendPoints} />
        </div>

        {/* Delay impact */}
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={14} className="text-[#ef4444]" />
            <h3 className="text-[#f5f5f5] text-sm font-semibold">Impacto — Atividades em Atraso</h3>
          </div>
          <DelayImpactTable />
        </div>
      </div>

      {/* ── D: Notable Services ───────────────────────────────────────────── */}
      {notableServiceCurves.length > 0 && (
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-[#f97316]" />
            <h3 className="text-[#f5f5f5] text-sm font-semibold">Serviços Notáveis — Planejado vs Realizado</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {notableServiceCurves.map((curve) => (
              <ServiceBar key={curve.id} curve={curve} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
