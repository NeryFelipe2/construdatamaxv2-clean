/**
 * HistogramPanel — Daily resource usage histogram (headcount + equipment).
 * Shows 30 work days at a time with prev/next navigation.
 * Inline SVG grouped-bar chart.
 */
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Play, Download } from 'lucide-react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { exportHistogramCsv } from '../utils/exportEngine'

const PAGE_SIZE = 30
const W = 700
const H = 260
const PAD = { left: 44, right: 20, top: 16, bottom: 36 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

export function HistogramPanel() {
  const { histogramPoints, runSchedule, isScheduleDirty } = usePlanejamentoStore()
  const [page, setPage] = useState(0)

  if (histogramPoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-[#6b6b6b]">
        <p className="text-sm">Gere o planejamento para visualizar o histograma de recursos.</p>
        <button onClick={runSchedule}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 transition-colors">
          <Play size={15} /> Gerar Planejamento
        </button>
      </div>
    )
  }

  const totalPages = Math.ceil(histogramPoints.length / PAGE_SIZE)
  const slice = histogramPoints.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const maxHead = Math.max(...histogramPoints.map((p) => p.headcount), 1)
  const maxEquip = Math.max(...histogramPoints.map((p) => p.equipmentUnits), 1)
  const maxVal = Math.max(maxHead, maxEquip)

  const totalHH = histogramPoints.reduce((s, p) => s + p.headcount, 0)
  const peakHead = maxHead
  const avgHead = histogramPoints.length > 0 ? (totalHH / histogramPoints.length).toFixed(1) : '0'
  const equipDays = histogramPoints.reduce((s, p) => s + p.equipmentUnits, 0)

  const n = slice.length
  const groupW = INNER_W / n
  const barW = groupW * 0.35

  function barX(i: number, sub: 0 | 1) {
    return PAD.left + i * groupW + (sub === 0 ? 2 : barW + 4)
  }
  function bh(v: number) { return (v / maxVal) * INNER_H }
  function by(v: number) { return PAD.top + INNER_H - bh(v) }

  const yGrid = [0, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), maxVal]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-white font-semibold">Histograma de Recursos</h2>
        <div className="flex gap-2">
          {isScheduleDirty && (
            <button onClick={runSchedule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-orange-600 hover:bg-orange-500 text-white transition-colors">
              <Play size={12} /> Atualizar
            </button>
          )}
          <button onClick={() => exportHistogramCsv(histogramPoints)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] transition-colors">
            <Download size={12} /> CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Pico Mão de Obra', value: `${peakHead} pessoas` },
          { label: 'Média Diária (MO)', value: `${avgHead} pessoas` },
          { label: 'Total Hh', value: totalHH.toLocaleString('pt-BR') },
          { label: 'Equipamentos × Dias', value: equipDays.toLocaleString('pt-BR') },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#3d3d3d] rounded-lg p-3 border border-[#525252]">
            <div className="text-xs text-[#a3a3a3]">{label}</div>
            <div className="text-white font-semibold text-sm mt-1">{value}</div>
          </div>
        ))}
      </div>

      {/* Navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 mb-3 text-sm text-[#a3a3a3]">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
            className="p-1 rounded hover:bg-[#484848] disabled:opacity-30 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <span>Dias {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, histogramPoints.length)} de {histogramPoints.length}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}
            className="p-1 rounded hover:bg-[#484848] disabled:opacity-30 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* SVG chart */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl mx-auto">
          {/* Y grid */}
          {yGrid.map((v) => {
            const y = by(v)
            return (
              <g key={v}>
                <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
                  stroke="#374151" strokeWidth="1" strokeDasharray={v === 0 ? undefined : '4,4'} />
                <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{v}</text>
              </g>
            )
          })}

          {/* Bars */}
          {slice.map((p, i) => {
            const hColor = '#3b82f6'
            const eColor = '#8b5cf6'
            const headH = bh(p.headcount)
            const equipH = bh(p.equipmentUnits)
            return (
              <g key={p.date}>
                <rect x={barX(i, 0)} y={by(p.headcount)} width={barW} height={headH}
                  fill={hColor} opacity="0.8" rx="1">
                  <title>{p.date}: {p.headcount} pessoas</title>
                </rect>
                <rect x={barX(i, 1)} y={by(p.equipmentUnits)} width={barW} height={equipH}
                  fill={eColor} opacity="0.8" rx="1">
                  <title>{p.date}: {p.equipmentUnits} equip.</title>
                </rect>
                {/* X label every 5 */}
                {i % 5 === 0 && (
                  <text x={PAD.left + i * groupW + groupW / 2} y={H - 8}
                    textAnchor="middle" fontSize="9" fill="#6b7280">
                    {p.dayIndex + 1}
                  </text>
                )}
              </g>
            )
          })}

          {/* Axes */}
          <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + INNER_H} stroke="#6b7280" strokeWidth="1" />
          <line x1={PAD.left} y1={PAD.top + INNER_H} x2={W - PAD.right} y2={PAD.top + INNER_H} stroke="#6b7280" strokeWidth="1" />
        </svg>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-3 text-sm text-[#a3a3a3]">
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-sm bg-blue-500 inline-block opacity-80" />
          Mão de Obra (pessoas/dia)
        </span>
        <span className="flex items-center gap-2">
          <span className="w-4 h-4 rounded-sm bg-violet-500 inline-block opacity-80" />
          Equipamentos (unid./dia)
        </span>
      </div>
    </div>
  )
}
