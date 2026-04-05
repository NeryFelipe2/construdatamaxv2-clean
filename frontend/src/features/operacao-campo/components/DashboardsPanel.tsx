/**
 * DashboardsPanel — Curvas de Serviços Notáveis + Gráfico de Tendência.
 */
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { useShallow } from 'zustand/react/shallow'
import { TrendingUp, Activity } from 'lucide-react'
import type { NotableServiceCurve, TrendPoint } from '@/types'

// ─── Notable Service Chart ───────────────────────────────────────────────────

function ServiceChart({ curve }: { curve: NotableServiceCurve }) {
  const validPoints = curve.dataPoints.filter((p) => p.actual > 0 || p.planned > 0)
  if (validPoints.length < 2) return null

  const maxVal = Math.max(...validPoints.flatMap((p) => [p.planned, p.actual]), 1)
  const W = 280, H = 80, PAD_L = 30, PAD_B = 16

  function px(i: number) { return PAD_L + (i / Math.max(1, validPoints.length - 1)) * (W - PAD_L) }
  function py(v: number) { return H - PAD_B - ((v / maxVal) * (H - PAD_B - 6)) }

  const plannedPath = validPoints.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.planned).toFixed(1)}`
  ).join(' ')

  const actualPath = validPoints.filter((p) => p.actual > 0).map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(validPoints.indexOf(p)).toFixed(1)},${py(p.actual).toFixed(1)}`
  ).join(' ')

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#f5f5f5] text-xs font-semibold">{curve.serviceName}</span>
        <span className="text-[#6b6b6b] text-[10px]">{curve.unit}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_L} y1={py(maxVal * f)} x2={W} y2={py(maxVal * f)} stroke="#525252" strokeWidth={0.5} />
            <text x={PAD_L - 3} y={py(maxVal * f) + 3} textAnchor="end" fontSize={7} fill="#6b6b6b" fontFamily="monospace">
              {Math.round(maxVal * f)}
            </text>
          </g>
        ))}

        {/* Planned (dashed) */}
        <path d={plannedPath} fill="none" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4,3" />

        {/* Actual (solid) */}
        {actualPath && <path d={actualPath} fill="none" stroke="#f97316" strokeWidth={2} />}

        {/* Legend */}
        <line x1={W - 100} y1={8} x2={W - 86} y2={8} stroke="#6b7280" strokeWidth={1.5} strokeDasharray="4,3" />
        <text x={W - 83} y={11} fontSize={7} fill="#6b6b6b">Plan.</text>
        <line x1={W - 55} y1={8} x2={W - 41} y2={8} stroke="#f97316" strokeWidth={2} />
        <text x={W - 38} y={11} fontSize={7} fill="#6b6b6b">Real</text>
      </svg>
    </div>
  )
}

// ─── Trend Mini S-Curve ──────────────────────────────────────────────────────

function TrendMiniSCurve({ points }: { points: TrendPoint[] }) {
  const valid = points.filter((p) => p.plannedCumulativePct > 0 || p.actualCumulativePct > 0)
  if (valid.length < 2) return null

  const W = 280, H = 120, PAD_L = 30, PAD_B = 16

  function px(i: number) { return PAD_L + (i / Math.max(1, valid.length - 1)) * (W - PAD_L) }
  function py(v: number) { return H - PAD_B - ((v / 100) * (H - PAD_B - 6)) }

  const plannedPath = valid.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.plannedCumulativePct).toFixed(1)}`
  ).join(' ')

  const actualValid = valid.filter((p) => p.actualCumulativePct > 0)
  const actualPath = actualValid.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(valid.indexOf(p)).toFixed(1)},${py(p.actualCumulativePct).toFixed(1)}`
  ).join(' ')

  // Deviation area (red zone where actual < planned)
  const lastActual = actualValid[actualValid.length - 1]
  const lastPlanned = valid.find((p) => p.date === lastActual?.date)
  const isDelayed = lastActual && lastPlanned && lastActual.actualCumulativePct < lastPlanned.plannedCumulativePct - 2

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp size={13} className="text-[#f97316]" />
        <span className="text-[#f5f5f5] text-xs font-semibold">Tendência — Curva S</span>
        {isDelayed && <span className="text-[#ef4444] text-[10px] font-semibold">Atraso detectado</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* Grid */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={py(v)} x2={W} y2={py(v)} stroke="#525252" strokeWidth={0.5} />
            <text x={PAD_L - 3} y={py(v) + 3} textAnchor="end" fontSize={7} fill="#6b6b6b" fontFamily="monospace">{v}%</text>
          </g>
        ))}

        {/* Red zone if delayed */}
        {isDelayed && actualValid.length > 1 && (() => {
          const areaPath = actualValid.map((p, i) =>
            `${i === 0 ? 'M' : 'L'}${px(valid.indexOf(p)).toFixed(1)},${py(p.actualCumulativePct).toFixed(1)}`
          ).join(' ')
          const closingPath = [...actualValid].reverse().map((p) => {
            const planned = valid.find((v) => v.date === p.date)
            return `L${px(valid.indexOf(planned!)).toFixed(1)},${py(planned?.plannedCumulativePct ?? 0).toFixed(1)}`
          }).join(' ')
          return <path d={`${areaPath} ${closingPath} Z`} fill="#ef4444" opacity={0.12} />
        })()}

        {/* Planned line */}
        <path d={plannedPath} fill="none" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5,3" />

        {/* Actual line */}
        {actualPath && <path d={actualPath} fill="none" stroke="#f97316" strokeWidth={2.5} />}

        {/* Legend */}
        <line x1={W - 120} y1={10} x2={W - 106} y2={10} stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5,3" />
        <text x={W - 103} y={13} fontSize={8} fill="#6b6b6b">Previsto</text>
        <line x1={W - 55} y1={10} x2={W - 41} y2={10} stroke="#f97316" strokeWidth={2.5} />
        <text x={W - 38} y={13} fontSize={8} fill="#6b6b6b">Real</text>
      </svg>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function DashboardsPanel() {
  const { notableServiceCurves, trendPoints } = useOperacaoCampoStore(
    useShallow((s) => ({
      notableServiceCurves: s.notableServiceCurves,
      trendPoints:          s.trendPoints,
    }))
  )

  return (
    <div className="flex flex-col gap-4 w-full lg:w-[380px] shrink-0">
      {/* Notable service curves */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-[#f97316]" />
          <h3 className="text-[#f5f5f5] text-sm font-semibold">Curvas de Serviços Notáveis</h3>
        </div>
        <div className="flex flex-col gap-3">
          {notableServiceCurves.length === 0 ? (
            <p className="text-[#6b6b6b] text-xs text-center py-6">Nenhum dado disponível</p>
          ) : (
            notableServiceCurves.map((curve) => (
              <ServiceChart key={curve.id} curve={curve} />
            ))
          )}
        </div>
      </div>

      {/* Trend S-curve */}
      <TrendMiniSCurve points={trendPoints} />
    </div>
  )
}
