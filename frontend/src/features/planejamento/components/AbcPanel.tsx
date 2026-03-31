/**
 * AbcPanel — ABC/Pareto cost analysis with inline SVG bar chart.
 */
import { Play, Download } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { exportAbcCsv } from '../utils/exportEngine'

const ZONE_COLORS = { A: '#ef4444', B: '#f59e0b', C: '#22c55e' }
const ZONE_BG     = { A: 'bg-red-900/40 text-red-300 border-red-700/50', B: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50', C: 'bg-green-900/40 text-green-300 border-green-700/50' }

const W = 700
const H = 260
const PAD = { left: 56, right: 20, top: 16, bottom: 36 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function fmtR(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function AbcPanel() {
  const { abcItems, runSchedule, isScheduleDirty } = usePlanejamentoStore()

  if (abcItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-gray-500">
        <p className="text-sm">Gere o planejamento para visualizar a Curva ABC.</p>
        <button onClick={runSchedule}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors">
          <Play size={15} /> Gerar Planejamento
        </button>
      </div>
    )
  }

  const n = abcItems.length
  const maxCost = Math.max(...abcItems.map((i) => i.totalCostBRL))
  const barW = INNER_W / n

  function barX(idx: number) { return PAD.left + idx * barW }
  function barH(cost: number) { return (cost / maxCost) * INNER_H }
  function barY(cost: number) { return PAD.top + INNER_H - barH(cost) }
  function lineX(idx: number) { return barX(idx) + barW / 2 }
  function lineY(pct: number) { return PAD.top + INNER_H - (pct / 100) * INNER_H }

  const linePoints = abcItems.map((item, i) => `${lineX(i)},${lineY(item.cumulativePct)}`).join(' ')

  // Reference lines at 75% and 95%
  const y75 = lineY(75)
  const y95 = lineY(95)

  const totals = { A: 0, B: 0, C: 0 }
  for (const item of abcItems) totals[item.zone] += item.totalCostBRL
  const grand = abcItems.reduce((s, i) => s + i.totalCostBRL, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-semibold">Curva ABC — Análise de Custos</h2>
        <div className="flex gap-2">
          {isScheduleDirty && (
            <button onClick={runSchedule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
              <Play size={12} /> Atualizar
            </button>
          )}
          <button onClick={() => exportAbcCsv(abcItems)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Zone summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['A', 'B', 'C'] as const).map((z) => (
          <div key={z} className={`rounded-lg px-4 py-3 border ${ZONE_BG[z]}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-lg">Zona {z}</span>
              <span className="text-xs opacity-70">{z === 'A' ? '≤75%' : z === 'B' ? '75–95%' : '>95%'}</span>
            </div>
            <div className="font-semibold">{fmtR(totals[z])}</div>
            <div className="text-xs opacity-70">{grand > 0 ? ((totals[z] / grand) * 100).toFixed(1) : '0.0'}% do total</div>
          </div>
        ))}
      </div>

      {/* SVG chart */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl mx-auto">
          {/* Y axis labels */}
          {[0, 25, 50, 75, 95, 100].map((pct) => {
            const y = lineY(pct)
            return (
              <g key={pct}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{pct}%</text>
              </g>
            )
          })}

          {/* Reference lines */}
          <line x1={PAD.left} y1={y75} x2={W - PAD.right} y2={y75}
            stroke="#ef4444" strokeWidth="1.5" strokeDasharray="8,4" opacity="0.7" />
          <text x={W - PAD.right + 2} y={y75 + 4} fontSize="10" fill="#ef4444">A</text>

          <line x1={PAD.left} y1={y95} x2={W - PAD.right} y2={y95}
            stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="8,4" opacity="0.7" />
          <text x={W - PAD.right + 2} y={y95 + 4} fontSize="10" fill="#f59e0b">B</text>

          {/* Bars */}
          {abcItems.map((item, i) => {
            const x = barX(i)
            const bh = barH(item.totalCostBRL)
            const by = barY(item.totalCostBRL)
            const color = ZONE_COLORS[item.zone]
            return (
              <rect key={item.trecho.id} x={x + 1} y={by} width={barW - 2} height={bh}
                fill={color} opacity="0.7" rx="1">
                <title>{item.trecho.code}: {fmtR(item.totalCostBRL)}</title>
              </rect>
            )
          })}

          {/* Cumulative line */}
          <polyline points={linePoints} fill="none" stroke="#2abfdc" strokeWidth="2.5" />
          {abcItems.map((item, i) => (
            <circle key={item.trecho.id} cx={lineX(i)} cy={lineY(item.cumulativePct)}
              r="3" fill="#2abfdc" />
          ))}

          {/* X labels */}
          {abcItems.map((item, i) => (
            <text key={item.trecho.id} x={barX(i) + barW / 2} y={H - 8}
              textAnchor="middle" fontSize="9" fill="#6b7280">
              {item.trecho.code}
            </text>
          ))}

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + INNER_H} stroke="#6b7280" strokeWidth="1" />
          <line x1={PAD.left} y1={PAD.top + INNER_H} x2={W - PAD.right} y2={PAD.top + INNER_H} stroke="#6b7280" strokeWidth="1" />
        </svg>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="text-left text-gray-400 px-4 py-3 font-medium">Código</th>
              <th className="text-left text-gray-400 px-4 py-3 font-medium">Descrição</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">Metros</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">Custo Total</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">% Total</th>
              <th className="text-right text-gray-400 px-4 py-3 font-medium">% Acumulado</th>
              <th className="text-center text-gray-400 px-4 py-3 font-medium">Zona</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {abcItems.map((item) => (
              <tr key={item.trecho.id} className="bg-gray-900 hover:bg-gray-800 transition-colors">
                <td className="px-4 py-2.5 text-gray-200 font-medium">{item.trecho.code}</td>
                <td className="px-4 py-2.5 text-gray-300">{item.trecho.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-200">{item.trecho.lengthM} m</td>
                <td className="px-4 py-2.5 text-right text-white font-medium">{fmtR(item.totalCostBRL)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{item.sharePct.toFixed(1)}%</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{item.cumulativePct.toFixed(1)}%</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`px-2 py-0.5 rounded text-xs font-bold border ${ZONE_BG[item.zone]}`}>
                    {item.zone}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
