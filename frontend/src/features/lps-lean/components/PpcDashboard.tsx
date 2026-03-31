/**
 * PpcDashboard — PPC weekly bar chart + Pareto of CNC causes.
 * SVG-native, no external chart library.
 */
import { useMemo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC, weekLabel } from '@/store/lpsStore'
import type { LpsCncCategory } from '@/types'

const CNC_LABELS: Record<LpsCncCategory, string> = {
  weather:   'Clima',
  equipment: 'Equipamento',
  labor:     'Mão de Obra',
  material:  'Material',
  design:    'Projeto',
  other:     'Outro',
}

const CNC_COLORS: Record<LpsCncCategory, string> = {
  weather:   '#38bdf8',
  equipment: '#7de8f5',
  labor:     '#a78bfa',
  material:  '#4ade80',
  design:    '#f472b6',
  other:     '#94a3b8',
}

const META_PPC = 80  // % target line

export function PpcDashboard() {
  const activities = useLpsStore((s) => s.activities)

  const weekly = useMemo(() => computeWeeklyPPC(activities), [activities])

  // Last 10 weeks for the chart
  const chartWeeks = weekly.slice(-10)

  // Moving average (4 weeks)
  const movingAvg = chartWeeks.map((_, i) => {
    const window = chartWeeks.slice(Math.max(0, i - 3), i + 1)
    return Math.round(window.reduce((s, w) => s + w.ppc, 0) / window.length)
  })

  // Trend: last vs 4 weeks ago
  const lastPpc = chartWeeks[chartWeeks.length - 1]?.ppc ?? 0
  const prevPpc = chartWeeks[chartWeeks.length - 5]?.ppc ?? lastPpc
  const trend = lastPpc - prevPpc

  // Current avg (last 4 weeks)
  const last4 = chartWeeks.slice(-4)
  const avgPpc = last4.length > 0
    ? Math.round(last4.reduce((s, w) => s + w.ppc, 0) / last4.length)
    : 0

  // CNC pareto
  const cncCount = activities
    .filter((a) => a.cncCategory && !a.completed)
    .reduce<Record<string, number>>((acc, a) => {
      const cat = a.cncCategory!
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    }, {})
  const cncTotal = Object.values(cncCount).reduce((s, n) => s + n, 0)
  const cncEntries = Object.entries(cncCount)
    .sort((a, b) => b[1] - a[1]) as [LpsCncCategory, number][]

  // Chart dimensions
  const CHART_W = 600
  const CHART_H = 160
  const LEFT    = 40
  const BOT     = 30
  const BAR_W   = Math.max(12, (CHART_W - LEFT - 20) / Math.max(chartWeeks.length, 1) - 6)

  function barX(i: number) {
    const slot = (CHART_W - LEFT - 20) / Math.max(chartWeeks.length, 1)
    return LEFT + i * slot + slot / 2 - BAR_W / 2
  }
  function barY(ppc: number) {
    return CHART_H - (ppc / 100) * CHART_H
  }

  const metaY = CHART_H - (META_PPC / 100) * CHART_H

  return (
    <div className="p-6 flex flex-col gap-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard
          label="PPC Médio (4 sem.)"
          value={`${avgPpc}%`}
          color={avgPpc >= META_PPC ? 'text-green-400' : avgPpc >= 60 ? 'text-yellow-400' : 'text-red-400'}
        />
        <KpiCard
          label="Meta PPC"
          value={`${META_PPC}%`}
          color="text-orange-400"
        />
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">Tendência</p>
          <div className="flex items-center gap-2">
            {trend > 0
              ? <TrendingUp size={20} className="text-green-400" />
              : trend < 0
                ? <TrendingDown size={20} className="text-red-400" />
                : <span className="text-gray-500 text-lg">—</span>}
            <span className={`text-lg font-bold ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {trend > 0 ? `+${trend}` : trend}pp
            </span>
          </div>
          <p className="text-[10px] text-gray-600">vs 4 semanas atrás</p>
        </div>
      </div>

      {/* PPC Chart + Pareto side by side */}
      <div className="grid grid-cols-5 gap-4">
        {/* Bar chart — 3/5 */}
        <div className="col-span-3 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs font-semibold text-white mb-3">PPC Semanal — Últimas {chartWeeks.length} Semanas</p>
          {chartWeeks.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-10">Sem dados de PPC</p>
          ) : (
            <div className="overflow-x-auto">
              <svg width={CHART_W} height={CHART_H + BOT + 10}>
                {/* Y grid lines */}
                {[0, 25, 50, 75, 100].map((v) => {
                  const y = CHART_H - (v / 100) * CHART_H
                  return (
                    <g key={v}>
                      <line x1={LEFT} y1={y} x2={CHART_W} y2={y} stroke="#1f2937" strokeWidth={1} />
                      <text x={LEFT - 4} y={y + 4} textAnchor="end" className="fill-gray-500" fontSize={9} fontFamily="monospace">
                        {v}%
                      </text>
                    </g>
                  )
                })}

                {/* Meta line */}
                <line x1={LEFT} y1={metaY} x2={CHART_W} y2={metaY} stroke="#2abfdc" strokeWidth={1.5} strokeDasharray="4 3" />
                <text x={CHART_W - 2} y={metaY - 3} textAnchor="end" fill="#2abfdc" fontSize={9}>Meta {META_PPC}%</text>

                {/* Bars */}
                {chartWeeks.map((w, i) => {
                  const h   = (w.ppc / 100) * CHART_H
                  const x   = barX(i)
                  const y   = CHART_H - h
                  const col = w.ppc >= META_PPC ? '#22c55e' : w.ppc >= 60 ? '#eab308' : '#ef4444'
                  return (
                    <g key={w.week}>
                      <rect x={x} y={y} width={BAR_W} height={Math.max(h, 1)} rx={3} fill={col} opacity={0.8} />
                      {h > 16 && (
                        <text x={x + BAR_W / 2} y={y - 2} textAnchor="middle" fill={col} fontSize={9} fontWeight="bold">
                          {w.ppc}%
                        </text>
                      )}
                      <text x={x + BAR_W / 2} y={CHART_H + 14} textAnchor="middle" className="fill-gray-500" fontSize={8}>
                        {weekLabel(w.week)}
                      </text>
                    </g>
                  )
                })}

                {/* Moving average line */}
                {movingAvg.length > 1 && (
                  <polyline
                    points={movingAvg.map((v, i) => {
                      const x = barX(i) + BAR_W / 2
                      return `${x},${barY(v)}`
                    }).join(' ')}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
              </svg>
            </div>
          )}
          <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-green-500 inline-block" /> ≥80%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-yellow-500 inline-block" /> 60-80%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-red-500 inline-block" /> &lt;60%</span>
            <span className="flex items-center gap-1"><span className="w-8 border-t-2 border-dashed border-indigo-400 inline-block" /> Média móvel 4 sem.</span>
          </div>
        </div>

        {/* Pareto CNC — 2/5 */}
        <div className="col-span-2 rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs font-semibold text-white mb-3">Pareto de CNC</p>
          {cncEntries.length === 0 ? (
            <p className="text-gray-600 text-xs text-center py-10">Nenhuma CNC registrada</p>
          ) : (
            <div className="flex flex-col gap-2">
              {cncEntries.map(([cat, count]) => {
                const pct = Math.round((count / cncTotal) * 100)
                const color = CNC_COLORS[cat] ?? '#6b7280'
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-300">{CNC_LABELS[cat] ?? cat}</span>
                      <span className="text-xs font-semibold text-gray-200">{count}× ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                    </div>
                  </div>
                )
              })}
              <p className="text-[10px] text-gray-600 mt-2">Total: {cncTotal} causas registradas</p>
            </div>
          )}
        </div>
      </div>

      {/* Weekly detail table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-800/80 border-b border-gray-700">
            <tr>
              <th className="text-left text-gray-400 px-4 py-2.5 font-semibold">Semana</th>
              <th className="text-right text-gray-400 px-4 py-2.5 font-semibold">Planejadas</th>
              <th className="text-right text-gray-400 px-4 py-2.5 font-semibold">Concluídas</th>
              <th className="text-right text-gray-400 px-4 py-2.5 font-semibold">PPC</th>
              <th className="text-left text-gray-400 px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {[...weekly].reverse().slice(0, 8).map((w) => (
              <tr key={w.week} className="bg-gray-900 hover:bg-gray-800/60">
                <td className="px-4 py-2 text-gray-300 font-mono">{weekLabel(w.week)} <span className="text-gray-600">({w.week})</span></td>
                <td className="px-4 py-2 text-right text-gray-400">{w.planned}</td>
                <td className="px-4 py-2 text-right text-gray-400">{w.completed}</td>
                <td className="px-4 py-2 text-right font-bold font-mono">
                  <span className={w.ppc >= META_PPC ? 'text-green-400' : w.ppc >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                    {w.ppc}%
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${w.ppc >= META_PPC ? 'bg-green-500' : w.ppc >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                    <span className={`text-xs ${w.ppc >= META_PPC ? 'text-green-400' : w.ppc >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {w.ppc >= META_PPC ? 'Acima da meta' : w.ppc >= 60 ? 'Abaixo da meta' : 'Crítico'}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex flex-col gap-1">
      <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
