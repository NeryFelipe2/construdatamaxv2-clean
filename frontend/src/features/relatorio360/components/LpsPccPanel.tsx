/**
 * LpsPccPanel — LPS / PPC / Previsto × Realizado section for Relatório 360.
 * Uses useOperacaoCampoStore for weekly PPC, trend S-curve, and notable services.
 */
import { useEffect } from 'react'
import { TrendingUp, Activity, Target } from 'lucide-react'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { useShallow } from 'zustand/react/shallow'
import type { TrendPoint, WeeklyPpcResult, NotableServiceCurve } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ppcBadge(v: number): string {
  if (v >= 80) return 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
  if (v >= 60) return 'bg-[#fbbf24]/15 text-[#fbbf24] border-[#fbbf24]/30'
  return 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
}

function ppcBar(v: number): string {
  if (v >= 80) return '#22c55e'
  if (v >= 60) return '#fbbf24'
  return '#ef4444'
}

// ─── PPC per week list ────────────────────────────────────────────────────────

function PpcList({ results }: { results: WeeklyPpcResult[] }) {
  if (results.length === 0) return (
    <p className="text-[#6b6b6b] text-xs text-center py-4">Sem dados de PPC</p>
  )

  return (
    <div className="flex flex-col gap-2">
      {results.slice(-8).map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-[10px] text-[#6b6b6b] w-6 text-right tabular-nums">S{i + 1}</span>
          <div className="flex-1 h-2 rounded-full bg-[#484848] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${w.ppc}%`, backgroundColor: ppcBar(w.ppc) }}
            />
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border tabular-nums ${ppcBadge(w.ppc)}`}>
            {w.ppc}%
          </span>
          <span className="text-[9px] text-[#6b6b6b] w-16 text-right">{w.totalCompleted}/{w.totalPlanned}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Dual S-curve ─────────────────────────────────────────────────────────────

function SCurvePanel({ points }: { points: TrendPoint[] }) {
  const valid = points.filter((p) => p.plannedCumulativePct > 0 || p.actualCumulativePct > 0)
  if (valid.length < 2) return (
    <div className="flex items-center justify-center h-32 text-[#6b6b6b] text-xs">
      Dados insuficientes para a curva
    </div>
  )

  const W = 360, H = 130, PAD_L = 34, PAD_B = 18, PAD_T = 6

  function px(i: number) { return PAD_L + (i / Math.max(1, valid.length - 1)) * (W - PAD_L - 6) }
  function py(v: number) { return H - PAD_B - ((v / 100) * (H - PAD_B - PAD_T)) }

  const plannedPath = valid.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.plannedCumulativePct).toFixed(1)}`).join(' ')
  const actualPts   = valid.filter((p) => p.actualCumulativePct > 0)
  const actualPath  = actualPts.map((p) => {
    const i = valid.indexOf(p)
    return `${actualPts.indexOf(p) === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.actualCumulativePct).toFixed(1)}`
  }).join(' ')

  const lastA = actualPts[actualPts.length - 1]
  const matchP = valid.find((p) => p.date === lastA?.date)
  const delayed = lastA && matchP && lastA.actualCumulativePct < matchP.plannedCumulativePct - 2

  const step = Math.max(1, Math.floor(valid.length / 5))
  const xLabels = valid.filter((_, i) => i % step === 0 || i === valid.length - 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={PAD_L} y1={py(v)} x2={W - 6} y2={py(v)} stroke="#525252" strokeWidth={0.5} strokeDasharray="3,3" />
          <text x={PAD_L - 3} y={py(v) + 3} textAnchor="end" fontSize={7} fill="#6b6b6b" fontFamily="monospace">{v}%</text>
        </g>
      ))}

      {delayed && actualPts.length > 1 && (() => {
        const areaPath = actualPts.map((p, i) => {
          const vi = valid.indexOf(p)
          return `${i === 0 ? 'M' : 'L'}${px(vi).toFixed(1)},${py(p.actualCumulativePct).toFixed(1)}`
        }).join(' ')
        const closePath = [...actualPts].reverse().map((p) => {
          const vi = valid.indexOf(p)
          return `L${px(vi).toFixed(1)},${py(valid[vi]?.plannedCumulativePct ?? 0).toFixed(1)}`
        }).join(' ')
        return <path d={`${areaPath} ${closePath} Z`} fill="#ef4444" opacity={0.1} />
      })()}

      <path d={plannedPath} fill="none" stroke="#6b7280" strokeWidth={1.8} strokeDasharray="5,3" />
      {actualPath && <path d={actualPath} fill="none" stroke="#f97316" strokeWidth={2.5} />}

      {xLabels.map((p) => {
        const i = valid.indexOf(p)
        return (
          <text key={p.date} x={px(i)} y={H - 3} textAnchor="middle" fontSize={7} fill="#6b6b6b" fontFamily="monospace">
            {p.date.slice(5).replace('-', '/')}
          </text>
        )
      })}

      <line x1={W - 130} y1={PAD_T + 5} x2={W - 116} y2={PAD_T + 5} stroke="#6b7280" strokeWidth={1.8} strokeDasharray="5,3" />
      <text x={W - 113} y={PAD_T + 8} fontSize={8} fill="#9ca3af">Previsto</text>
      <line x1={W - 60} y1={PAD_T + 5} x2={W - 46} y2={PAD_T + 5} stroke="#f97316" strokeWidth={2.5} />
      <text x={W - 43} y={PAD_T + 8} fontSize={8} fill="#9ca3af">Realizado</text>

      {delayed && (
        <text x={PAD_L + 4} y={PAD_T + 14} fontSize={8} fill="#ef4444">▲ Atraso detectado</text>
      )}
    </svg>
  )
}

// ─── Notable service progress bars ────────────────────────────────────────────

function NotableServicesPanel({ curves }: { curves: NotableServiceCurve[] }) {
  if (curves.length === 0) return (
    <p className="text-[#6b6b6b] text-xs text-center py-4">Sem serviços notáveis configurados</p>
  )

  return (
    <div className="flex flex-col gap-3">
      {curves.map((curve) => {
        const last    = [...curve.dataPoints].reverse().find((p) => p.planned > 0 || p.actual > 0)
        if (!last) return null
        const actPct  = last.planned > 0 ? Math.min(100, Math.round((last.actual / last.planned) * 100)) : 0
        const color   = ppcBar(actPct)
        return (
          <div key={curve.id} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#a3a3a3] truncate max-w-[200px]">{curve.serviceName}</span>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-[#6b6b6b]">{last.actual}/{last.planned} {curve.unit}</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color }}>{actPct}%</span>
              </div>
            </div>
            <div className="relative h-2 rounded-full bg-[#484848] overflow-hidden">
              <div className="absolute inset-0 bg-[#3a4a6b] rounded-full" style={{ width: '100%' }} />
              <div className="absolute inset-0 rounded-full" style={{ width: `${actPct}%`, backgroundColor: color }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function LpsPccPanel() {
  const { weeklyPpcResults, trendPoints, notableServiceCurves, activities, loadDemoData } = useOperacaoCampoStore(
    useShallow((s) => ({
      weeklyPpcResults:     s.weeklyPpcResults,
      trendPoints:          s.trendPoints,
      notableServiceCurves: s.notableServiceCurves,
      activities:           s.activities,
      loadDemoData:         s.loadDemoData,
    }))
  )

  useEffect(() => {
    if (activities.length === 0) loadDemoData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target size={16} className="text-[#f97316]" />
        <h2 className="text-[#f5f5f5] text-base font-bold">LPS / PPC — Previsto × Realizado</h2>
      </div>

      {/* Top row: PPC list + S-curve */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* PPC per week */}
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target size={13} className="text-[#f97316]" />
            <h3 className="text-[#f5f5f5] text-sm font-semibold">PPC por Semana</h3>
          </div>
          <PpcList results={weeklyPpcResults} />
        </div>

        {/* S-curve */}
        <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={13} className="text-[#f97316]" />
            <h3 className="text-[#f5f5f5] text-sm font-semibold">Curva S — Planejado vs Realizado</h3>
          </div>
          <SCurvePanel points={trendPoints} />
        </div>
      </div>

      {/* Notable services */}
      <div className="rounded-xl border border-[#525252] bg-[#3d3d3d] p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={13} className="text-[#f97316]" />
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Serviços Notáveis — Planejado vs Realizado</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NotableServicesPanel curves={notableServiceCurves} />
        </div>
      </div>
    </div>
  )
}
