import { useState, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useMaoDeObraStore } from '@/store/maoDeObraStore'
import { generateMonthPayroll } from '@/features/mao-de-obra/utils/payrollEngine'

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ─── Inline SVG line chart ────────────────────────────────────────────────────

function TrendLineChart({ values, color = '#3b82f6' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const W = 280, H = 80, PAD = 10
  const min   = Math.min(...values)
  const max   = Math.max(...values, 1)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2)
    return `${x},${y}`
  })

  const polyline = points.join(' ')

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {values.map((_v, i) => {
        const [x, y] = (points[i] ?? '0,0').split(',').map(Number)
        return (
          <g key={i}>
            <circle cx={x} cy={y} r={3} fill={color} />
            <text x={x} y={H - 2} fontSize={8} textAnchor="middle" fill="var(--color-text-muted)">
              {new Date(2026, 5 - values.length + i, 1).toLocaleDateString('pt-BR', { month: 'short' })}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Donut chart for contract types ──────────────────────────────────────────

function DonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null
  const R = 40, CX = 50, CY = 50

  let cumAngle = -Math.PI / 2
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI
    const x1 = CX + R * Math.cos(cumAngle)
    const y1 = CY + R * Math.sin(cumAngle)
    cumAngle += angle
    const x2 = CX + R * Math.cos(cumAngle)
    const y2 = CY + R * Math.sin(cumAngle)
    const large = angle > Math.PI ? 1 : 0
    return { ...d, x1, y1, x2, y2, large, angle }
  })

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={90} height={90}>
        {slices.map((s, i) => (
          <path key={i}
            d={`M ${CX} ${CY} L ${s.x1} ${s.y1} A ${R} ${R} 0 ${s.large} 1 ${s.x2} ${s.y2} Z`}
            fill={s.color} stroke="var(--color-surface-elevated)" strokeWidth={1} />
        ))}
        <circle cx={CX} cy={CY} r={22} fill="var(--color-surface-elevated)" />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill="var(--color-text-primary)">{total}</text>
      </svg>
      <div className="space-y-1.5">
        {slices.map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-[var(--color-text-secondary)]">{s.label}</span>
            <span className="text-xs font-semibold text-[var(--color-text-primary)] ml-auto">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── RHFinanceiroPanel ────────────────────────────────────────────────────────

export function RHFinanceiroPanel() {
  const { workers, shifts, cltSettings, violations, workPosts, absences, payrollHistory } =
    useMaoDeObraStore(useShallow(s => ({
      workers:        s.workers,
      shifts:         s.shifts,
      cltSettings:    s.cltSettings,
      violations:     s.violations,
      workPosts:      s.workPosts,
      absences:       s.absences,
      payrollHistory: s.payrollHistory,
    })))

  const [budgetCap, setBudgetCap] = useState<number>(100_000)
  const [editBudget, setEditBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState(String(budgetCap))
  const [trendPeriod, setTrendPeriod] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal')

  const activeWorkers = workers.filter(w => w.status === 'active')

  // Current month payroll (compute on-the-fly if not yet generated)
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const currentPayroll = useMemo(() => {
    const existing = payrollHistory.find(p => p.month === currentMonth)
    if (existing) return existing
    return generateMonthPayroll(workers, shifts, cltSettings, currentMonth)
  }, [payrollHistory, currentMonth, workers, shifts, cltSettings])

  // Cost trend data based on selected period
  const trendMonthCount = trendPeriod === 'mensal' ? 6 : trendPeriod === 'trimestral' ? 8 : trendPeriod === 'semestral' ? 12 : 24
  const trendData = useMemo(() => {
    const months: string[] = []
    for (let i = trendMonthCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return months.map(m => {
      const found = payrollHistory.find(p => p.month === m)
      return found?.totalEmployerCost ?? 0
    })
  }, [payrollHistory, now, trendMonthCount])

  // Trend stats
  const trendFirst = trendData.find(v => v > 0) ?? 0
  const trendLast = [...trendData].reverse().find(v => v > 0) ?? 0
  const trendChangePct = trendFirst > 0 ? Math.round(((trendLast - trendFirst) / trendFirst) * 100) : 0

  // Contract type breakdown
  const contractBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const w of activeWorkers) {
      const key = w.contractType ?? 'clt'
      counts[key] = (counts[key] ?? 0) + 1
    }
    return [
      { label: 'CLT',          value: counts['clt']        ?? 0, color: '#3b82f6' },
      { label: 'PJ',           value: counts['pj']         ?? 0, color: '#f59e0b' },
      { label: 'Freelancer',   value: counts['freelancer'] ?? 0, color: '#8b5cf6' },
      { label: 'Aprendiz',     value: counts['apprentice'] ?? 0, color: '#22c55e' },
    ].filter(d => d.value > 0)
  }, [activeWorkers])

  // Department breakdown
  const deptBreakdown = useMemo(() => {
    const costByDept: Record<string, { cost: number; count: number }> = {}
    for (const payslip of currentPayroll.payslips) {
      const worker = workers.find(w => w.id === payslip.workerId)
      const dept   = worker?.department ?? 'Outros'
      if (!costByDept[dept]) costByDept[dept] = { cost: 0, count: 0 }
      costByDept[dept].cost  += payslip.employerCost
      costByDept[dept].count += 1
    }
    return Object.entries(costByDept)
      .map(([dept, data]) => ({ dept, ...data }))
      .sort((a, b) => b.cost - a.cost)
  }, [currentPayroll, workers])

  // OT hours pct
  const otHours  = useMemo(() => currentPayroll.payslips.reduce((s, p) => s + p.overtimeHours, 0), [currentPayroll])
  const regHours = useMemo(() => currentPayroll.payslips.reduce((s, p) => s + (p.hoursWorked - p.overtimeHours), 0), [currentPayroll])
  const otPct    = (regHours + otHours) > 0 ? (otHours / (regHours + otHours) * 100).toFixed(1) : '0.0'

  // Uncovered posts today
  const today = now.toISOString().split('T')[0]
  const uncoveredPosts = useMemo(() => {
    return workPosts.filter(p => {
      const dayShifts = shifts.filter(s =>
        s.date === today && s.type !== 'day_off' && s.workFront === p.workFront
      )
      const matching = dayShifts.filter(s => workers.find(w => w.id === s.workerId)?.role === p.role)
      return matching.length < p.minWorkers
    }).length
  }, [workPosts, shifts, workers, today])

  const avgCostPerWorker = activeWorkers.length > 0
    ? currentPayroll.totalEmployerCost / activeWorkers.length
    : 0

  const budgetOverrun = currentPayroll.totalEmployerCost > budgetCap

  function saveBudget() {
    const v = parseFloat(budgetInput.replace(',', '.'))
    if (!isNaN(v) && v > 0) setBudgetCap(v)
    setEditBudget(false)
  }

  return (
    <div className="space-y-6">
      {/* Budget alert */}
      {budgetOverrun && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/30">
          <span className="text-lg">⚠️</span>
          <span className="text-sm font-medium text-[#ef4444]">
            Custo mensal ({fmt(currentPayroll.totalEmployerCost)}) supera o orçamento definido ({fmt(budgetCap)})
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Headcount Ativo',          value: activeWorkers.length,                       color: 'text-[var(--color-text-primary)]', suffix: '' },
          { label: 'Custo RH (mês atual)',      value: fmt(currentPayroll.totalEmployerCost),      color: budgetOverrun ? 'text-[#ef4444]' : 'text-[var(--color-accent)]', suffix: '' },
          { label: 'Custo Médio / Colaborador', value: fmt(avgCostPerWorker),                      color: 'text-[var(--color-text-primary)]', suffix: '' },
          { label: '% HE / Total',              value: `${otPct}%`,                               color: parseFloat(otPct) > 5 ? 'text-[#f59e0b]' : 'text-[#22c55e]', suffix: '' },
        ].map(card => (
          <div key={card.label}
            className="flex flex-col items-center py-3 px-2 rounded-2xl bg-[var(--color-surface-elevated)] border border-[var(--color-border)]">
            <span className={`text-base font-bold ${card.color}`}>{card.value}</span>
            <span className="text-xs text-[var(--color-text-muted)] text-center mt-0.5">{card.label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Department breakdown */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface-elevated)]">
          <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Custo por Departamento</h3>
            <span className="text-xs text-[var(--color-text-muted)]">{new Date(currentMonth + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                  {['Departamento', 'Colaboradores', 'Custo Total', '% do Total'].map(h => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {deptBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Gere a folha para ver os custos por departamento</td>
                  </tr>
                ) : deptBreakdown.map(d => {
                  const pct = currentPayroll.totalEmployerCost > 0
                    ? (d.cost / currentPayroll.totalEmployerCost * 100).toFixed(1)
                    : '0.0'
                  return (
                    <tr key={d.dept} className="hover:bg-[var(--color-surface)] transition-colors">
                      <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">{d.dept}</td>
                      <td className="px-4 py-2 text-center text-[var(--color-text-secondary)]">{d.count}</td>
                      <td className="px-4 py-2 font-semibold text-[var(--color-text-primary)]">{fmt(d.cost)}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                            <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-[var(--color-text-secondary)] w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: contract type donut + violations */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Tipos de Contrato</h3>
            <DonutChart data={contractBreakdown} />
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">Alertas RH</h3>
            <div className="space-y-2">
              {[
                {
                  label: 'Violações CLT',
                  value: violations.filter(v => v.severity === 'blocking').length,
                  color: violations.filter(v => v.severity === 'blocking').length > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]',
                  icon: violations.filter(v => v.severity === 'blocking').length > 0 ? '⚠' : '✓',
                },
                {
                  label: 'Postos Descobertos',
                  value: uncoveredPosts,
                  color: uncoveredPosts > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]',
                  icon: uncoveredPosts > 0 ? '⚠' : '✓',
                },
                {
                  label: 'Faltas Descobertas',
                  value: absences.filter(a => a.status === 'uncovered').length,
                  color: absences.filter(a => a.status === 'uncovered').length > 0 ? 'text-[#f59e0b]' : 'text-[#22c55e]',
                  icon: absences.filter(a => a.status === 'uncovered').length > 0 ? '!' : '✓',
                },
              ].map(alert => (
                <div key={alert.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${alert.color}`}>{alert.icon}</span>
                    <span className="text-[var(--color-text-secondary)]">{alert.label}</span>
                  </div>
                  <span className={`font-bold text-sm ${alert.color}`}>{alert.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Budget cap setting */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-2">Orçamento Mensal</h3>
            {editBudget ? (
              <div className="flex gap-2">
                <input
                  type="number"
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveBudget()}
                />
                <button onClick={saveBudget}
                  className="px-3 py-2 rounded-lg bg-[var(--color-accent)] text-white text-xs font-bold hover:opacity-90 transition-opacity">
                  OK
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className={`text-base font-bold ${budgetOverrun ? 'text-[#ef4444]' : 'text-[var(--color-text-primary)]'}`}>
                  {fmt(budgetCap)}
                </span>
                <button onClick={() => { setBudgetInput(String(budgetCap)); setEditBudget(true) }}
                  className="text-xs text-[var(--color-accent)] hover:underline">
                  Editar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cost trend chart */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-4">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Tendência de Custo RH</h3>
            {trendChangePct !== 0 && (
              <span className={`text-xs font-semibold ${trendChangePct > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {trendChangePct > 0 ? '▲' : '▼'} {Math.abs(trendChangePct)}%
              </span>
            )}
          </div>
          <div className="flex gap-1 p-0.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
            {(['mensal', 'trimestral', 'semestral', 'anual'] as const).map((p) => (
              <button key={p} onClick={() => setTrendPeriod(p)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  trendPeriod === p ? 'bg-[var(--color-accent)] text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                }`}>
                {p === 'mensal' ? '6m' : p === 'trimestral' ? '2a' : p === 'semestral' ? '3a' : '∞'}
              </button>
            ))}
          </div>
        </div>
        {trendData.some(v => v > 0) ? (
          <TrendLineChart values={trendData} color="var(--color-accent)" />
        ) : (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">
            Gere folhas de pagamento para visualizar a tendência.
          </p>
        )}
      </div>
    </div>
  )
}
