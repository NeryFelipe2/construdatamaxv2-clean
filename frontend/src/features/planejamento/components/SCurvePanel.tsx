/**
 * SCurvePanel — Physical and financial S-curve charts using inline SVG.
 */
import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Play, Download } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { exportSCurveCsv } from '../utils/exportEngine'

const W = 700
const H = 320
const PAD = { left: 60, right: 30, top: 20, bottom: 40 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function lerp(val: number, maxVal: number, dimension: number) {
  return (val / maxVal) * dimension
}

export function SCurvePanel() {
  const { scurvePoints, workDays, runSchedule, isScheduleDirty } = usePlanejamentoStore()

  // X ticks: ~6 month labels
  const monthTicks = useMemo(() => {
    const seen = new Set<string>()
    return workDays
      .map((d, i) => {
        const key = d.slice(0, 7) // yyyy-MM
        if (seen.has(key)) return null
        seen.add(key)
        return { idx: i, label: format(parseISO(d), 'MMM/yy', { locale: ptBR }) }
      })
      .filter(Boolean) as { idx: number; label: string }[]
  }, [workDays])

  if (scurvePoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-500">
        <p className="text-sm">Gere o planejamento para visualizar a Curva S.</p>
        <button onClick={runSchedule}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors">
          <Play size={15} /> Gerar Planejamento
        </button>
      </div>
    )
  }

  const n = scurvePoints.length

  function toX(idx: number) { return PAD.left + lerp(idx, n - 1, INNER_W) }
  function toY(pct: number) { return PAD.top + INNER_H - lerp(pct, 100, INNER_H) }

  const physicalPoints = scurvePoints
    .map((p) => `${toX(p.dayIndex).toFixed(1)},${toY(p.cumulativePhysicalPct).toFixed(1)}`)
    .join(' ')

  const financialPoints = scurvePoints
    .map((p) => `${toX(p.dayIndex).toFixed(1)},${toY(p.cumulativeFinancialPct).toFixed(1)}`)
    .join(' ')

  const yGrid = [0, 25, 50, 75, 100]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Curva S — Progresso Acumulado</h2>
        <div className="flex gap-2">
          {isScheduleDirty && (
            <button onClick={runSchedule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
              <Play size={12} /> Atualizar
            </button>
          )}
          <button onClick={() => exportSCurveCsv(scurvePoints)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl mx-auto">
          {/* Y grid lines */}
          {yGrid.map((pct) => {
            const y = toY(pct)
            return (
              <g key={pct}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="#374151" strokeWidth="1" strokeDasharray={pct === 0 ? undefined : '4,4'} />
                <text x={PAD.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{pct}%</text>
              </g>
            )
          })}

          {/* X month ticks */}
          {monthTicks.map((tick) => {
            const x = toX(tick.idx)
            return (
              <g key={tick.idx}>
                <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + INNER_H}
                  stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />
                <text x={x} y={H - 8} textAnchor="middle" fontSize="10" fill="#9ca3af">{tick.label}</text>
              </g>
            )
          })}

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + INNER_H} stroke="#6b7280" strokeWidth="1" />
          <line x1={PAD.left} y1={PAD.top + INNER_H} x2={W - PAD.right} y2={PAD.top + INNER_H} stroke="#6b7280" strokeWidth="1" />

          {/* Financial line (dashed, orange) */}
          <polyline points={financialPoints} fill="none" stroke="#2abfdc" strokeWidth="2"
            strokeDasharray="6,4" opacity="0.9" />

          {/* Physical line (solid, blue) */}
          <polyline points={physicalPoints} fill="none" stroke="#3b82f6" strokeWidth="2.5" />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-3 text-sm text-gray-400">
        <span className="flex items-center gap-2">
          <svg width="24" height="10"><line x1="0" y1="5" x2="24" y2="5" stroke="#3b82f6" strokeWidth="2.5" /></svg>
          Físico Previsto (%)
        </span>
        <span className="flex items-center gap-2">
          <svg width="24" height="10">
            <line x1="0" y1="5" x2="24" y2="5" stroke="#2abfdc" strokeWidth="2" strokeDasharray="5,3" />
          </svg>
          Financeiro Previsto (%)
        </span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {[
          { label: 'Dias Úteis', value: String(n) },
          {
            label: 'Custo Total',
            value: scurvePoints[n - 1].cumulativeCostBRL.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
          },
          { label: 'Metros Totais', value: `${scurvePoints[n - 1].cumulativeMeters.toFixed(0)} m` },
          { label: 'Físico Final', value: `${scurvePoints[n - 1].cumulativePhysicalPct.toFixed(1)}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
            <div className="text-xs text-gray-400">{label}</div>
            <div className="text-white font-semibold text-sm mt-1">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
