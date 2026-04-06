/**
 * LpsAnalyticsPanel — 4 SVG analytics charts for LPS restrictions + activities.
 * Charts: 1) Restrições por Tipo, 2) por Responsável, 3) Tempo Médio Resolução, 4) Evolução Semanal
 */
import { useMemo } from 'react'
import { useLpsStore, computeWeeklyPPC } from '@/store/lpsStore'
import type { LpsRestrictionCategory, LpsRestrictionStatus } from '@/types'

const CATEGORY_LABELS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: 'Projeto/Eng.',
  materiais:          'Materiais',
  equipamentos:       'Equipamentos',
  mao_de_obra:        'Mão de Obra',
  externo:            'Externo',
  outros:             'Outros',
}

const CATEGORY_COLORS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: '#6366f1',
  materiais:          '#f97316',
  equipamentos:       '#eab308',
  mao_de_obra:        '#a78bfa',
  externo:            '#38bdf8',
  outros:             '#94a3b8',
}

const STATUS_LABELS: Record<LpsRestrictionStatus, string> = {
  identificada:  'Identificada',
  em_resolucao:  'Em Resolução',
  resolvida:     'Resolvida',
}

export function LpsAnalyticsPanel() {
  const restrictions = useLpsStore((s) => s.restrictions)
  const activities   = useLpsStore((s) => s.activities)

  const today = new Date().toISOString().slice(0, 10)

  // KPI strip
  const total     = restrictions.length
  const ativas    = restrictions.filter((r) => r.status !== 'resolvida').length
  const criticas  = restrictions.filter((r) => r.prazoRemocao && r.prazoRemocao < today && r.status !== 'resolvida').length
  const resolvidas = restrictions.filter((r) => r.status === 'resolvida').length
  const weekly    = useMemo(() => computeWeeklyPPC(activities), [activities])
  const last4     = weekly.slice(-4)
  const avgPpc    = last4.length > 0
    ? Math.round(last4.reduce((s, w) => s + w.ppc, 0) / last4.length)
    : 0
  const resolvedWithTime = restrictions.filter((r) => r.status === 'resolvida' && r.resolvedAt && r.createdAt)
  const avgResolutionDays = resolvedWithTime.length > 0
    ? Math.round(
        resolvedWithTime.reduce((s, r) => {
          const diff = new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime()
          return s + diff / 86400000
        }, 0) / resolvedWithTime.length
      )
    : 0

  // Chart 1: Restrições por Tipo (horizontal bar)
  const byCategory = useMemo(() => {
    const map: Partial<Record<LpsRestrictionCategory, number>> = {}
    for (const r of restrictions) {
      map[r.categoria] = (map[r.categoria] ?? 0) + 1
    }
    return (Object.entries(map) as [LpsRestrictionCategory, number][])
      .sort((a, b) => b[1] - a[1])
  }, [restrictions])

  // Chart 2: por Status + por Responsável
  const byStatus = useMemo(() => {
    const map: Partial<Record<LpsRestrictionStatus, number>> = {}
    for (const r of restrictions) {
      map[r.status] = (map[r.status] ?? 0) + 1
    }
    return Object.entries(map) as [LpsRestrictionStatus, number][]
  }, [restrictions])

  const byResponsavel = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of restrictions) {
      const k = r.responsavel?.trim() || 'Sem responsável'
      map[k] = (map[k] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [restrictions])

  // Chart 4: Evolução semanal (criadas vs resolvidas ao longo do tempo)
  const weeklyEvolution = useMemo(() => {
    // Group by creation week
    const created: Record<string, number> = {}
    const resolved: Record<string, number> = {}
    for (const r of restrictions) {
      const cWeek = r.createdAt ? r.createdAt.slice(0, 7) : 'N/A'
      created[cWeek] = (created[cWeek] ?? 0) + 1
      if (r.resolvedAt) {
        const rWeek = r.resolvedAt.slice(0, 7)
        resolved[rWeek] = (resolved[rWeek] ?? 0) + 1
      }
    }
    const months = Array.from(new Set([...Object.keys(created), ...Object.keys(resolved)])).sort()
    return months.map((m) => ({ month: m, criadas: created[m] ?? 0, resolvidas: resolved[m] ?? 0 }))
  }, [restrictions])

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard label="Total"         value={String(total)}             color="text-white" />
        <KpiCard label="Ativas"        value={String(ativas)}            color="text-yellow-400" />
        <KpiCard label="Críticas"      value={String(criticas)}          color="text-red-400" />
        <KpiCard label="Resolvidas"    value={String(resolvidas)}        color="text-green-400" />
        <KpiCard label="PPC Médio"     value={`${avgPpc}%`}             color={avgPpc >= 80 ? 'text-green-400' : avgPpc >= 60 ? 'text-yellow-400' : 'text-red-400'} />
        <KpiCard label="Tempo Médio"   value={avgResolutionDays > 0 ? `${avgResolutionDays}d` : '—'} color="text-blue-400" />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Restrições por Tipo */}
        <ChartCard title="Restrições por Tipo">
          {byCategory.length === 0 ? (
            <Empty />
          ) : (
            <div className="flex flex-col gap-2">
              {byCategory.map(([cat, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-[#f5f5f5]">{CATEGORY_LABELS[cat]}</span>
                      <span className="text-xs font-semibold text-[#f5f5f5]">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2.5 bg-[#3d3d3d] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CATEGORY_COLORS[cat] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>

        {/* Chart 2: por Status */}
        <ChartCard title="Restrições por Status">
          {byStatus.length === 0 ? (
            <Empty />
          ) : (
            <StatusDonut byStatus={byStatus} total={total} />
          )}
        </ChartCard>

        {/* Chart 3: por Responsável */}
        <ChartCard title="Restrições por Responsável / Área">
          {byResponsavel.length === 0 ? (
            <Empty />
          ) : (
            <BarChart
              data={byResponsavel.map(([label, v]) => ({ label, value: v }))}
              color="#f97316"
            />
          )}
        </ChartCard>

        {/* Chart 4: Evolução mensal */}
        <ChartCard title="Evolução Mensal — Criadas vs. Resolvidas">
          {weeklyEvolution.length === 0 ? (
            <Empty />
          ) : (
            <GroupedBarChart data={weeklyEvolution} />
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Sub-charts ───────────────────────────────────────────────────────────────

function StatusDonut({ byStatus, total }: { byStatus: [LpsRestrictionStatus, number][]; total: number }) {
  const STATUS_CHART_COLORS: Record<LpsRestrictionStatus, string> = {
    identificada:  '#ef4444',
    em_resolucao:  '#eab308',
    resolvida:     '#22c55e',
  }

  const R = 60
  const CX = 80
  const CY = 70
  let cumAngle = -Math.PI / 2

  const arcs = byStatus.map(([status, count]) => {
    const angle = total > 0 ? (count / total) * 2 * Math.PI : 0
    const startAngle = cumAngle
    cumAngle += angle
    const endAngle = cumAngle

    const x1 = CX + R * Math.cos(startAngle)
    const y1 = CY + R * Math.sin(startAngle)
    const x2 = CX + R * Math.cos(endAngle)
    const y2 = CY + R * Math.sin(endAngle)
    const large = angle > Math.PI ? 1 : 0

    return { status, count, path: `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z` }
  })

  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={140}>
        {arcs.map((arc) => (
          <path key={arc.status} d={arc.path} fill={STATUS_CHART_COLORS[arc.status]} opacity={0.85} />
        ))}
        <circle cx={CX} cy={CY} r={28} fill="#111827" />
        <text x={CX} y={CY + 5} textAnchor="middle" fill="white" fontSize={14} fontWeight="bold">{total}</text>
      </svg>
      <div className="flex flex-col gap-2">
        {byStatus.map(([status, count]) => (
          <div key={status} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_CHART_COLORS[status] }} />
            <span className="text-xs text-[#f5f5f5]">{STATUS_LABELS[status]}</span>
            <span className="text-xs font-bold text-white ml-1">{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const W = 320, H = 120, LEFT = 80, BOT = 10
  const BAR_H = (H - BOT) / data.length - 4

  return (
    <svg width={W} height={H} className="overflow-visible">
      {data.map((d, i) => {
        const barW = ((d.value / maxVal) * (W - LEFT - 20))
        const y = i * (BAR_H + 4)
        return (
          <g key={d.label}>
            <text x={LEFT - 4} y={y + BAR_H / 2 + 4} textAnchor="end" fill="#9ca3af" fontSize={9}
              className="truncate"
            >
              {d.label.length > 14 ? d.label.slice(0, 12) + '…' : d.label}
            </text>
            <rect x={LEFT} y={y} width={Math.max(barW, 2)} height={BAR_H} rx={3} fill={color} opacity={0.8} />
            <text x={LEFT + barW + 4} y={y + BAR_H / 2 + 4} fill={color} fontSize={9} fontWeight="bold">
              {d.value}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function GroupedBarChart({ data }: { data: { month: string; criadas: number; resolvidas: number }[] }) {
  const maxVal = Math.max(...data.flatMap((d) => [d.criadas, d.resolvidas]), 1)
  const W = 320, H = 120, LEFT = 20, BOT = 20
  const chartH = H - BOT
  const slotW = (W - LEFT) / Math.max(data.length, 1)
  const barW = Math.max(8, slotW / 2 - 4)

  return (
    <svg width={W} height={H}>
      {/* Y axis lines */}
      {[0, 50, 100].map((pct) => {
        const y = chartH - (pct / 100) * chartH
        return (
          <line key={pct} x1={LEFT} y1={y} x2={W} y2={y} stroke="#1f2937" strokeWidth={1} />
        )
      })}

      {data.map((d, i) => {
        const x = LEFT + i * slotW + slotW / 2
        const hC = (d.criadas / maxVal) * chartH
        const hR = (d.resolvidas / maxVal) * chartH
        return (
          <g key={d.month}>
            <rect x={x - barW - 1} y={chartH - hC} width={barW} height={Math.max(hC, 1)} rx={2} fill="#ef4444" opacity={0.8} />
            <rect x={x + 1} y={chartH - hR} width={barW} height={Math.max(hR, 1)} rx={2} fill="#22c55e" opacity={0.8} />
            <text x={x} y={H - 2} textAnchor="middle" fill="#6b7280" fontSize={8}>
              {d.month.slice(2)}
            </text>
          </g>
        )
      })}

      {/* Legend */}
      <rect x={W - 90} y={4} width={8} height={8} rx={1} fill="#ef4444" opacity={0.8} />
      <text x={W - 78} y={12} fill="#9ca3af" fontSize={8}>Criadas</text>
      <rect x={W - 90} y={16} width={8} height={8} rx={1} fill="#22c55e" opacity={0.8} />
      <text x={W - 78} y={24} fill="#9ca3af" fontSize={8}>Resolvidas</text>
    </svg>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-[#3d3d3d] bg-[#2c2c2c] p-4 flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-widest text-[#6b6b6b]">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#3d3d3d] bg-[#2c2c2c] p-5">
      <p className="text-xs font-semibold text-white mb-4">{title}</p>
      {children}
    </div>
  )
}

function Empty() {
  return <p className="text-gray-600 text-xs text-center py-8">Sem dados suficientes.</p>
}
