/**
 * WhatIfPanel — What-if simulator for Planejamento Mestre.
 * Transient adjustments to activity dates, dual S-curve comparison.
 */
import { useEffect } from 'react'
import { RotateCcw, TrendingUp, CalendarDays } from 'lucide-react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { getProjectDateRange, daysBetween, applyWhatIfAdjustments } from '../utils/masterEngine'
import type { MasterSCurvePoint } from '../utils/masterEngine'

// ─── Dual S-Curve Chart ──────────────────────────────────────────────────────

function DualSCurveChart({
  original, simulated,
}: {
  original: MasterSCurvePoint[]
  simulated: MasterSCurvePoint[]
}) {
  if (original.length < 2) return null

  const W = 560, H = 200, PAD_L = 50, PAD_B = 24, PAD_T = 10

  function px(i: number, total: number) { return PAD_L + (i / Math.max(1, total - 1)) * (W - PAD_L) }
  function py(v: number) { return H - PAD_B - ((v / 100) * (H - PAD_B - PAD_T)) }

  const origPath = original.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${px(i, original.length).toFixed(1)},${py(p.cumulativePct).toFixed(1)}`
  ).join(' ')

  const simPath = simulated.length > 0
    ? simulated.map((p, i) =>
        `${i === 0 ? 'M' : 'L'}${px(i, simulated.length).toFixed(1)},${py(p.cumulativePct).toFixed(1)}`
      ).join(' ')
    : ''

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100]

  // X-axis labels (sample every N points)
  const step = Math.max(1, Math.floor(original.length / 8))
  const xLabels = original.filter((_, i) => i % step === 0 || i === original.length - 1)

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4">
      <h3 className="text-[#f5f5f5] text-sm font-semibold mb-3 flex items-center gap-2">
        <TrendingUp size={14} className="text-[#f97316]" />
        Curvas S — Original vs Simulada
      </h3>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto max-h-[250px]" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD_L} y1={py(v)} x2={W} y2={py(v)} stroke="#525252" strokeWidth={0.5} strokeDasharray="4,3" />
              <text x={PAD_L - 4} y={py(v) + 3} textAnchor="end" fontSize={9} fill="#6b6b6b" fontFamily="monospace">{v}%</text>
            </g>
          ))}

          {/* Original curve */}
          <path d={origPath} fill="none" stroke="#6b7280" strokeWidth={2} strokeDasharray="6,3" />

          {/* Simulated curve */}
          {simPath && (
            <path d={simPath} fill="none" stroke="#f97316" strokeWidth={2.5} />
          )}

          {/* X-axis labels */}
          {xLabels.map((p) => {
            const idx = original.indexOf(p)
            return (
              <text key={p.date} x={px(idx, original.length)} y={H - 4} textAnchor="middle" fontSize={8} fill="#6b6b6b" fontFamily="monospace">
                {p.date.slice(5, 10).replace('-', '/')}
              </text>
            )
          })}

          {/* Legend */}
          <line x1={W - 180} y1={16} x2={W - 158} y2={16} stroke="#6b7280" strokeWidth={2} strokeDasharray="6,3" />
          <text x={W - 154} y={19} fontSize={9} fill="#9ca3af">Original</text>
          <line x1={W - 100} y1={16} x2={W - 78} y2={16} stroke="#f97316" strokeWidth={2.5} />
          <text x={W - 74} y={19} fontSize={9} fill="#9ca3af">Simulada</text>
        </svg>
      </div>
    </div>
  )
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function WhatIfPanel() {
  const activities          = usePlanejamentoMestreStore((s) => s.activities)
  const whatIfAdjustments   = usePlanejamentoMestreStore((s) => s.whatIfAdjustments)
  const originalSCurve      = usePlanejamentoMestreStore((s) => s.originalSCurve)
  const simulatedSCurve     = usePlanejamentoMestreStore((s) => s.simulatedSCurve)
  const addWhatIfAdjustment = usePlanejamentoMestreStore((s) => s.addWhatIfAdjustment)
  const clearWhatIfAdjustments = usePlanejamentoMestreStore((s) => s.clearWhatIfAdjustments)
  const runWhatIfSimulation = usePlanejamentoMestreStore((s) => s.runWhatIfSimulation)

  // Compute simulation whenever adjustments change
  useEffect(() => {
    if (activities.length > 0) {
      runWhatIfSimulation()
    }
  }, [whatIfAdjustments, activities.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const leafActivities = activities.filter((a) => a.level >= 1 && !a.isMilestone)

  // Compute impact metrics
  const { end: origEnd } = getProjectDateRange(activities)
  const adjusted = applyWhatIfAdjustments(activities, whatIfAdjustments)
  const { end: simEnd } = getProjectDateRange(adjusted)
  const deltaDays = daysBetween(origEnd, simEnd)

  // Compute % at a reference date (today)
  const today = new Date().toISOString().slice(0, 10)
  const origPctToday = originalSCurve.find((p) => p.date >= today)?.cumulativePct ?? 0
  const simPctToday = simulatedSCurve.find((p) => p.date >= today)?.cumulativePct ?? 0
  const deltaPct = simPctToday - origPctToday

  return (
    <div className="flex flex-col gap-4">
      {/* Info banner */}
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl px-4 py-3 flex items-center justify-between">
        <p className="text-[#6b6b6b] text-xs">
          Ajuste dias de atraso (+) ou aceleração (-) por atividade. <strong className="text-[#a3a3a3]">Nenhum dado é gravado</strong> — apenas comparação visual.
        </p>
        <button
          onClick={clearWhatIfAdjustments}
          disabled={whatIfAdjustments.length === 0}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#ef4444] hover:border-[#ef4444]/40 transition-colors disabled:opacity-40"
        >
          <RotateCcw size={12} />Limpar
        </button>
      </div>

      {/* Impact KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold tabular-nums" style={{ color: deltaDays > 0 ? '#ef4444' : deltaDays < 0 ? '#22c55e' : '#6b6b6b' }}>
            {deltaDays > 0 ? `+${deltaDays}` : deltaDays}
          </p>
          <p className="text-xs font-semibold text-[#a3a3a3]">dias de impacto</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold tabular-nums text-[#a3a3a3]">
            {simEnd ? simEnd.split('-').reverse().slice(0, 2).join('/') : '—'}
          </p>
          <p className="text-xs font-semibold text-[#a3a3a3]">nova data final</p>
        </div>
        <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 text-center">
          <p className="text-3xl font-bold tabular-nums" style={{ color: deltaPct < -1 ? '#ef4444' : deltaPct > 1 ? '#22c55e' : '#6b6b6b' }}>
            {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
          </p>
          <p className="text-xs font-semibold text-[#a3a3a3]">delta % hoje</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Activity adjustments */}
        <div className="lg:col-span-2 bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-3 max-h-[500px] overflow-y-auto">
          <h3 className="text-[#f5f5f5] text-sm font-semibold flex items-center gap-2">
            <CalendarDays size={14} className="text-[#f97316]" />
            Ajustar Atividades
          </h3>

          {leafActivities.map((act) => {
            const adj = whatIfAdjustments.find((a) => a.activityId === act.id)
            const startDelta = adj?.deltaStartDays ?? 0
            const durDelta = adj?.deltaDurationDays ?? 0

            return (
              <div key={act.id} className="bg-[#484848] rounded-lg px-3 py-2.5">
                <p className="text-[#f5f5f5] text-xs font-medium mb-2 truncate">{act.wbsCode} {act.name}</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] text-[#6b6b6b] uppercase tracking-widest">Início</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="range"
                        min={-30}
                        max={60}
                        value={startDelta}
                        onChange={(e) => addWhatIfAdjustment({
                          activityId: act.id,
                          deltaStartDays: Number(e.target.value),
                          deltaDurationDays: durDelta,
                        })}
                        className="flex-1 h-1 accent-[#f97316]"
                      />
                      <span className={`text-xs font-mono w-10 text-right ${startDelta > 0 ? 'text-[#ef4444]' : startDelta < 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]'}`}>
                        {startDelta > 0 ? `+${startDelta}` : startDelta}d
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-[#6b6b6b] uppercase tracking-widest">Duração</label>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="range"
                        min={-15}
                        max={30}
                        value={durDelta}
                        onChange={(e) => addWhatIfAdjustment({
                          activityId: act.id,
                          deltaStartDays: startDelta,
                          deltaDurationDays: Number(e.target.value),
                        })}
                        className="flex-1 h-1 accent-[#f97316]"
                      />
                      <span className={`text-xs font-mono w-10 text-right ${durDelta > 0 ? 'text-[#ef4444]' : durDelta < 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]'}`}>
                        {durDelta > 0 ? `+${durDelta}` : durDelta}d
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {leafActivities.length === 0 && (
            <p className="text-[#6b6b6b] text-xs text-center py-6">
              Nenhuma atividade no cronograma mestre.
            </p>
          )}
        </div>

        {/* Right: S-Curve chart */}
        <div className="lg:col-span-3">
          <DualSCurveChart original={originalSCurve} simulated={simulatedSCurve} />
        </div>
      </div>
    </div>
  )
}
