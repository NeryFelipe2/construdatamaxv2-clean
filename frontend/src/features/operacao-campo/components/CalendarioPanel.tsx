/**
 * CalendarioPanel — Calendar grid with Line A (planned) / Line B (actual).
 * Supports 15-day and monthly view modes.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { useShallow } from 'zustand/react/shallow'

function fmtShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function getDayName(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
}

export function CalendarioPanel() {
  const {
    activities, calendarDays, viewMode, selectedDate,
    setViewMode, setSelectedDate, updateCalendarDay, weeklyPpcResults,
  } = useOperacaoCampoStore(
    useShallow((s) => ({
      activities:       s.activities,
      calendarDays:     s.calendarDays,
      viewMode:         s.viewMode,
      selectedDate:     s.selectedDate,
      setViewMode:      s.setViewMode,
      setSelectedDate:  s.setSelectedDate,
      updateCalendarDay: s.updateCalendarDay,
      weeklyPpcResults: s.weeklyPpcResults,
    }))
  )

  const today = new Date().toISOString().slice(0, 10)

  // Compute visible dates
  const startD = new Date(selectedDate + 'T00:00:00')
  const daysToShow = viewMode === '15d' ? 15 : 30
  const visibleDates: string[] = []
  let count = 0
  const iter = new Date(startD)
  while (count < daysToShow) {
    const dow = iter.getDay()
    if (dow !== 0 && dow !== 6) {
      visibleDates.push(iter.toISOString().slice(0, 10))
      count++
    }
    iter.setDate(iter.getDate() + 1)
  }

  function shiftDate(days: number) {
    const d = new Date(selectedDate + 'T00:00:00')
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().slice(0, 10))
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-w-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex gap-1">
          {(['15d', 'monthly'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                viewMode === m
                  ? 'bg-[#f97316]/20 text-[#f97316] border border-[#f97316]/40'
                  : 'border border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]'
              }`}
            >
              {m === '15d' ? '15 dias' : 'Mensal'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button onClick={() => shiftDate(viewMode === '15d' ? -15 : -30)} className="p-1.5 rounded border border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]">
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-[#a3a3a3] font-mono px-2">
            {fmtShortDate(visibleDates[0] ?? selectedDate)} — {fmtShortDate(visibleDates[visibleDates.length - 1] ?? selectedDate)}
          </span>
          <button onClick={() => shiftDate(viewMode === '15d' ? 15 : 30)} className="p-1.5 rounded border border-[#525252] text-[#6b6b6b] hover:text-[#a3a3a3]">
            <ChevronRight size={14} />
          </button>
        </div>

        <button
          onClick={() => setSelectedDate(today)}
          className="text-xs text-[#f97316] hover:underline"
        >
          Hoje
        </button>
      </div>

      {/* Grid */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-collapse" style={{ minWidth: `${120 + visibleDates.length * 56}px` }}>
            <thead>
              <tr className="bg-[#2c2c2c]">
                <th className="sticky left-0 z-10 bg-[#2c2c2c] px-3 py-2 text-left text-[#6b6b6b] font-medium w-28 min-w-[112px]">Atividade</th>
                <th className="sticky left-28 z-10 bg-[#2c2c2c] px-1 py-2 text-center text-[#6b6b6b] font-medium w-8">A/B</th>
                {visibleDates.map((date) => (
                  <th
                    key={date}
                    className={`px-1 py-2 text-center font-medium min-w-[48px] ${
                      date === today ? 'text-[#f97316] bg-[#f97316]/5' : 'text-[#6b6b6b]'
                    }`}
                  >
                    <div>{fmtShortDate(date)}</div>
                    <div className="text-[8px] uppercase">{getDayName(date)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((act) => (
                <>
                  {/* Line A — Planned (read-only) */}
                  <tr key={`${act.id}-A`} className="border-t border-[#525252]">
                    <td rowSpan={2} className="sticky left-0 z-10 bg-[#3d3d3d] px-3 py-1.5 text-[#f5f5f5] font-medium align-middle border-r border-[#525252]">
                      {act.name}
                    </td>
                    <td className="sticky left-28 z-10 bg-[#3d3d3d] px-1 py-0.5 text-center text-[#6b6b6b] font-bold border-r border-[#525252]">A</td>
                    {visibleDates.map((date) => {
                      const entry = calendarDays.find((d) => d.date === date && d.activityId === act.id)
                      return (
                        <td key={date} className={`px-1 py-0.5 text-center font-mono bg-[#484848]/30 ${date === today ? 'bg-[#f97316]/5' : ''}`}>
                          <span className="text-[#6b6b6b]">{entry?.plannedQty ?? '—'}</span>
                        </td>
                      )
                    })}
                  </tr>
                  {/* Line B — Actual (editable) */}
                  <tr key={`${act.id}-B`} className="border-b border-[#525252]/50">
                    <td className="sticky left-28 z-10 bg-[#3d3d3d] px-1 py-0.5 text-center text-[#f97316] font-bold border-r border-[#525252]">B</td>
                    {visibleDates.map((date) => {
                      const entry = calendarDays.find((d) => d.date === date && d.activityId === act.id)
                      const planned = entry?.plannedQty ?? 0
                      const actual = entry?.actualQty
                      const isPast = date <= today

                      let bgColor = ''
                      if (actual !== null && actual !== undefined) {
                        bgColor = actual >= planned ? 'bg-[#22c55e]/10' : 'bg-[#ef4444]/10'
                      }

                      return (
                        <td key={date} className={`px-0.5 py-0.5 text-center ${bgColor} ${date === today ? 'bg-[#f97316]/5' : ''}`}>
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
                            <span className="text-[#3f3f3f]">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </>
              ))}

              {/* PPC row */}
              {weeklyPpcResults.length > 0 && (
                <tr className="border-t-2 border-[#525252] bg-[#2c2c2c]">
                  <td className="sticky left-0 z-10 bg-[#2c2c2c] px-3 py-2 text-[#f97316] font-bold" colSpan={2}>PPC</td>
                  {visibleDates.map((date) => {
                    // Find which week this date belongs to and show PPC on Fridays
                    const d = new Date(date + 'T00:00:00')
                    const isFriday = d.getDay() === 5
                    if (!isFriday) return <td key={date} className="bg-[#2c2c2c]" />

                    const weekPpc = weeklyPpcResults.find((_w, idx) => {
                      // Simple: show latest PPC on each Friday
                      return idx === weeklyPpcResults.length - 1
                    })
                    const ppc = weekPpc?.ppc ?? 0
                    const color = ppc >= 80 ? '#22c55e' : ppc >= 60 ? '#eab308' : '#ef4444'

                    return (
                      <td key={date} className="px-1 py-2 text-center bg-[#2c2c2c]">
                        <span className="font-bold font-mono" style={{ color }}>{ppc}%</span>
                      </td>
                    )
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
