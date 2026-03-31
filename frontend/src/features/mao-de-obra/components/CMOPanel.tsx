import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { projectMonthlyCost } from '@/features/mao-de-obra/utils/cltEngine'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtH(n: number) {
  return `${n.toFixed(1)}h`
}

// ─── Inline SVG bar chart ──────────────────────────────────────────────────────

interface BarItem {
  role: string
  base: number
  ot: number
  night: number
}

function fmtCompact(n: number): string {
  if (n >= 1000) return `R$${(n / 1000).toFixed(1)}k`
  return `R$${n.toFixed(0)}`
}

function RoleBarChart({ items }: { items: BarItem[] }) {
  if (items.length === 0) return null
  const maxVal = Math.max(...items.map(i => i.base + i.ot + i.night), 1)
  const barH   = 28
  const gap    = 10
  const labelW = 140
  const PADL   = labelW
  const PADR   = 72    // space for cost label
  const VW     = 600
  const chartW = VW - PADL - PADR
  const H      = items.length * (barH + gap) + 32

  // Y-grid lines at 25/50/75/100%
  const gridPcts = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg width="100%" viewBox={`0 0 ${VW} ${H}`} className="overflow-visible">
      {/* Grid lines */}
      {gridPcts.map((pct) => {
        const x = PADL + pct * chartW
        return (
          <g key={pct}>
            <line x1={x} y1={0} x2={x} y2={H - 20} stroke="var(--color-border)" strokeWidth={0.5} strokeDasharray="3 3" />
            <text x={x} y={H - 4} textAnchor="middle" fontSize={8} fill="var(--color-text-muted)">
              {fmtCompact(maxVal * pct)}
            </text>
          </g>
        )
      })}
      {items.map((item, idx) => {
        const y      = 8 + idx * (barH + gap)
        const total  = item.base + item.ot + item.night
        const wBase  = (item.base  / maxVal) * chartW
        const wOT    = (item.ot   / maxVal) * chartW
        const wNight = (item.night / maxVal) * chartW
        const truncLabel = item.role.length > 20 ? item.role.slice(0, 19) + '…' : item.role
        return (
          <g key={item.role}>
            <text x={0} y={y + barH / 2 + 5} fontSize={10} fill="var(--color-text-secondary)">
              {truncLabel}
            </text>
            {/* Base */}
            <rect x={PADL} y={y} width={Math.max(0, wBase)} height={barH} fill="#3b82f6" rx={2} />
            {/* OT */}
            <rect x={PADL + wBase} y={y} width={Math.max(0, wOT)} height={barH} fill="#f59e0b" rx={2} />
            {/* Night */}
            <rect x={PADL + wBase + wOT} y={y} width={Math.max(0, wNight)} height={barH} fill="#8b5cf6" rx={2} />
            {/* Total label at end */}
            {total > 0 && (
              <text x={PADL + wBase + wOT + wNight + 5} y={y + barH / 2 + 5} fontSize={9}
                fill="var(--color-text-muted)">
                {fmtCompact(total)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── CMOPanel ─────────────────────────────────────────────────────────────────

export function CMOPanel() {
  const { workers, shifts, cltSettings } = useMaoDeObraStore(
    useShallow(s => ({ workers: s.workers, shifts: s.shifts, cltSettings: s.cltSettings }))
  )

  const now = new Date()
  const [yearMonth, setYearMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  )
  const [scenario, setScenario] = useState<'base' | 'optimized'>('base')
  const [otReductionPct, setOtReductionPct] = useState(30)    // % reduction in overtime
  const [nightRedistPct, setNightRedistPct] = useState(0)     // % night shifts redistributed to day

  // For optimized scenario: reduce overtime and redistribute night shifts
  const scenarioShifts = useMemo(() => {
    if (scenario === 'base') return shifts
    const factor = 1 - otReductionPct / 100
    return shifts.map(s => {
      if (s.type !== 'overtime') return s
      const start = parseInt(s.startTime.split(':')[0]) * 60 + parseInt(s.startTime.split(':')[1])
      const end   = parseInt(s.endTime.split(':')[0])   * 60 + parseInt(s.endTime.split(':')[1])
      const durMin = end > start ? end - start : 24 * 60 - start + end
      const newDur = Math.round(durMin * factor)
      const newEnd = ((start + newDur) % (24 * 60))
      const newEndHH = String(Math.floor(newEnd / 60)).padStart(2, '0')
      const newEndMM = String(newEnd % 60).padStart(2, '0')
      return { ...s, endTime: `${newEndHH}:${newEndMM}` }
    })
  }, [shifts, scenario, otReductionPct])

  const summary = useMemo(
    () => projectMonthlyCost(workers, scenarioShifts.filter(s => s.date.startsWith(yearMonth)), cltSettings),
    [workers, scenarioShifts, yearMonth, cltSettings]
  )

  // Navigation
  function prevMonth() {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = yearMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setYearMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const monthLabel = new Date(yearMonth + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Savings potential for optimized scenario
  const baseSummary = useMemo(
    () => projectMonthlyCost(workers, shifts.filter(s => s.date.startsWith(yearMonth)), cltSettings),
    [workers, shifts, yearMonth, cltSettings]
  )
  const savings = baseSummary.totalCost - summary.totalCost
  const fgtsTotal = summary.totalCost * 0.08

  const kpiCards = [
    { label: 'Total Bruto',         value: fmt(summary.baseCost + summary.overtimeCost + summary.nightCost), color: 'text-[var(--color-accent)]' },
    { label: 'Horas Regulares',     value: fmtH(summary.regularHours),  color: 'text-[#22c55e]' },
    { label: 'Custo Hora Extra',    value: fmt(summary.overtimeCost),    color: summary.overtimeCost > 2000 ? 'text-[#f59e0b]' : 'text-[var(--color-text-primary)]' },
    { label: 'Adicional Noturno',   value: fmt(summary.nightCost),       color: 'text-[#8b5cf6]' },
    { label: 'FGTS (empregador)',   value: fmt(fgtsTotal),               color: 'text-[#ef4444]' },
    { label: 'Total Geral',         value: fmt(summary.totalCost + fgtsTotal), color: 'text-[var(--color-text-primary)]' },
  ]

  const barItems: BarItem[] = summary.roleBreakdown.map(r => ({
    role:  r.role,
    base:  r.baseCost,
    ot:    r.overtimeCost,
    night: r.nightCost,
  }))

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Month selector */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors text-lg">
            ‹
          </button>
          <span className="min-w-[160px] text-center text-sm font-semibold text-[var(--color-text-primary)] capitalize">
            {monthLabel}
          </span>
          <button onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors text-lg">
            ›
          </button>
        </div>

        {/* Scenario toggle */}
        <div className="flex gap-1 p-1 rounded-xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
          {(['base', 'optimized'] as const).map(sc => (
            <button key={sc} onClick={() => setScenario(sc)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                scenario === sc
                  ? 'bg-[var(--color-accent)] text-white shadow-sm'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}>
              {sc === 'base' ? 'Base' : 'Otimizado'}
            </button>
          ))}
        </div>
      </div>

      {/* Optimization controls (only when optimized) */}
      {scenario === 'optimized' && (
        <div className="rounded-xl bg-[#22c55e]/10 border border-[#22c55e]/30 p-4 flex flex-col gap-4">
          <p className="text-sm font-semibold text-[#22c55e]">Parâmetros de Otimização</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-[var(--color-text-secondary)]">Redução de HE</label>
                <span className="font-semibold text-[#f59e0b]">{otReductionPct}%</span>
              </div>
              <input type="range" min={0} max={50} value={otReductionPct}
                onChange={(e) => setOtReductionPct(Number(e.target.value))}
                className="w-full accent-orange-500" />
              <p className="text-[10px] text-[var(--color-text-muted)]">Reduz horas extras de {100 - otReductionPct}% dos turnos OT</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <label className="text-[var(--color-text-secondary)]">Redistribuição Noturno</label>
                <span className="font-semibold text-[#8b5cf6]">{nightRedistPct}%</span>
              </div>
              <input type="range" min={0} max={100} value={nightRedistPct}
                onChange={(e) => setNightRedistPct(Number(e.target.value))}
                className="w-full accent-purple-500" />
              <p className="text-[10px] text-[var(--color-text-muted)]">Simulação: redistribuir {nightRedistPct}% dos turnos noturnos para o dia</p>
            </div>
          </div>
          {savings > 0 && (
            <div className="border-t border-[#22c55e]/20 pt-3 flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Economia estimada:</p>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="text-[#f59e0b]">
                  HE: <strong>{fmt(baseSummary.overtimeCost - summary.overtimeCost)}</strong>
                </span>
                <span className="text-[#8b5cf6]">
                  Not.: <strong>{fmt(Math.round(baseSummary.nightCost * nightRedistPct / 100 * 0.3))}</strong> (estimado)
                </span>
                <span className="text-[#22c55e] font-bold">
                  Total: {fmt(savings)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(card => (
          <div key={card.label}
            className="flex flex-col items-center px-3 py-3 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
            <span className={`text-base font-bold ${card.color}`}>{card.value}</span>
            <span className="text-xs text-[var(--color-text-muted)] text-center mt-0.5 leading-tight">{card.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Role breakdown table */}
        <div className="rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Custo por Cargo</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  {['Cargo', 'Qnt.', 'H. Reg.', 'H.E.', 'H. Not.', 'Total'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {summary.roleBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-[var(--color-text-muted)]">
                      Sem dados para este mês
                    </td>
                  </tr>
                ) : summary.roleBreakdown.map(r => (
                  <tr key={r.role} className="hover:bg-[var(--color-surface)] transition-colors">
                    <td className="px-3 py-2 font-medium text-[var(--color-text-primary)] max-w-[120px] truncate">{r.role}</td>
                    <td className="px-3 py-2 text-center text-[var(--color-text-secondary)]">{r.workerCount}</td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">{fmtH(r.regularHours)}</td>
                    <td className="px-3 py-2 text-[#f59e0b]">{fmtH(r.overtimeHours)}</td>
                    <td className="px-3 py-2 text-[#8b5cf6]">{fmtH(r.nightHours)}</td>
                    <td className="px-3 py-2 font-semibold text-[var(--color-text-primary)]">{fmt(r.totalCost)}</td>
                  </tr>
                ))}
              </tbody>
              {summary.roleBreakdown.length > 0 && (
                <tfoot className="border-t-2 border-[var(--color-border)]">
                  <tr className="bg-[var(--color-surface)]">
                    <td className="px-3 py-2 font-bold text-[var(--color-text-primary)]">Total</td>
                    <td className="px-3 py-2 text-center font-semibold text-[var(--color-text-secondary)]">
                      {summary.roleBreakdown.reduce((s, r) => s + r.workerCount, 0)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[var(--color-text-secondary)]">{fmtH(summary.regularHours)}</td>
                    <td className="px-3 py-2 font-semibold text-[#f59e0b]">{fmtH(summary.overtimeHours)}</td>
                    <td className="px-3 py-2 font-semibold text-[#8b5cf6]">{fmtH(summary.nightHours)}</td>
                    <td className="px-3 py-2 font-bold text-[var(--color-text-primary)]">{fmt(summary.totalCost)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/* Bar chart */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Custo por Cargo — Composição</h3>
          {barItems.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-8">Sem dados para este mês</p>
          ) : (
            <RoleBarChart items={barItems} />
          )}
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--color-border)]">
            {[
              { color: 'bg-[#3b82f6]', label: 'Regular' },
              { color: 'bg-[#f59e0b]', label: 'Hora Extra' },
              { color: 'bg-[#8b5cf6]', label: 'Noturno' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded-sm ${color}`} />
                <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
