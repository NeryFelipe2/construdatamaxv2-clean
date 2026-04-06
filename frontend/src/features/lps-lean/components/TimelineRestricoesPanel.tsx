/**
 * TimelineRestricoesPanel — SVG Gantt timeline of all restrictions.
 */
import { useState } from 'react'
import { useLpsStore } from '@/store/lpsStore'
import { useShallow } from 'zustand/react/shallow'
import type { LpsRestrictionCategory, LpsRestrictionStatus } from '@/types'

const CAT_COLORS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: '#3b82f6',
  materiais:          '#06b6d4',
  equipamentos:       '#eab308',
  mao_de_obra:        '#a855f7',
  externo:            '#64748b',
  outros:             '#6b7280',
}

const CAT_LABELS: Record<LpsRestrictionCategory, string> = {
  projeto_engenharia: 'Engenharia',
  materiais:          'Materiais',
  equipamentos:       'Equipamentos',
  mao_de_obra:        'Mão de Obra',
  externo:            'Externo',
  outros:             'Outros',
}

const STATUS_OPACITY: Record<LpsRestrictionStatus, number> = {
  identificada: 0.9,
  em_resolucao: 0.75,
  resolvida:    0.4,
}

export function TimelineRestricoesPanel() {
  const restrictions = useLpsStore(useShallow((s) => s.restrictions))
  const [filterCat, setFilterCat] = useState<LpsRestrictionCategory | ''>('')
  const [filterStatus, setFilterStatus] = useState<LpsRestrictionStatus | ''>('')

  const filtered = restrictions.filter((r) => {
    if (filterCat && r.categoria !== filterCat) return false
    if (filterStatus && r.status !== filterStatus) return false
    return true
  }).sort((a, b) => (a.prazoRemocao ?? '').localeCompare(b.prazoRemocao ?? ''))

  // Date range
  const today = new Date().toISOString().slice(0, 10)
  const allDates = filtered.flatMap((r) => [r.createdAt, r.prazoRemocao ?? today]).filter(Boolean)
  if (allDates.length === 0) allDates.push(today)
  const minDate = allDates.sort()[0]
  const maxDate = allDates.sort()[allDates.length - 1]
  const totalDays = Math.max(1, Math.round((new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86_400_000) + 14)

  const LABEL_W = 180
  const W = 500
  const ROW_H = 28
  const PAD_TOP = 24
  const svgH = PAD_TOP + filtered.length * ROW_H + 20

  function xOf(date: string) {
    const d = Math.round((new Date(date).getTime() - new Date(minDate).getTime()) / 86_400_000)
    return Math.round((d / totalDays) * W)
  }

  // Today line
  const todayX = LABEL_W + xOf(today)

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value as LpsRestrictionCategory | '')}
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
        >
          <option value="">Todas as categorias</option>
          {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as LpsRestrictionStatus | '')}
          className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
        >
          <option value="">Todos os status</option>
          <option value="identificada">Identificada</option>
          <option value="em_resolucao">Em resolução</option>
          <option value="resolvida">Resolvida</option>
        </select>
        <span className="text-[#6b6b6b] text-xs ml-auto">{filtered.length} restrição(ões)</span>
      </div>

      {/* Timeline */}
      <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 overflow-x-auto">
        {filtered.length === 0 ? (
          <p className="text-[#6b6b6b] text-xs text-center py-8">Nenhuma restrição encontrada.</p>
        ) : (
          <svg width={LABEL_W + W + 20} height={svgH} className="font-mono text-[10px]">
            {/* Today line */}
            <line x1={todayX} y1={0} x2={todayX} y2={svgH} stroke="#f97316" strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
            <text x={todayX + 2} y={12} fontSize={8} fill="#f97316">hoje</text>

            {/* Rows */}
            {filtered.map((r, i) => {
              const y = PAD_TOP + i * ROW_H
              const color = CAT_COLORS[r.categoria]
              const opacity = STATUS_OPACITY[r.status]
              const startX = xOf(r.createdAt)
              const endX = xOf(r.prazoRemocao ?? today)
              const barW = Math.max(6, endX - startX)

              const isOverdue = r.prazoRemocao && r.prazoRemocao < today && r.status !== 'resolvida'
              const label = r.tema.length > 20 ? r.tema.slice(0, 19) + '…' : r.tema

              return (
                <g key={r.id}>
                  {i % 2 === 0 && <rect x={0} y={y - 2} width={LABEL_W + W} height={ROW_H} fill="#3d3d3d08" />}
                  <text x={4} y={y + 10} fontSize={9} fill="#a3a3a3">{label}</text>
                  <text x={LABEL_W - 4} y={y + 10} textAnchor="end" fontSize={8} fill="#6b6b6b">{r.responsavel ?? '—'}</text>

                  {/* Bar */}
                  <rect
                    x={LABEL_W + startX}
                    y={y + 2}
                    width={barW}
                    height={14}
                    rx={3}
                    fill={isOverdue ? '#ef4444' : color}
                    opacity={opacity}
                  />

                  {/* Status indicator */}
                  {r.status === 'resolvida' && (
                    <text x={LABEL_W + startX + barW + 4} y={y + 12} fontSize={9} fill="#22c55e">✓</text>
                  )}
                  {isOverdue && (
                    <text x={LABEL_W + startX + barW + 4} y={y + 12} fontSize={9} fill="#ef4444">!</text>
                  )}
                </g>
              )
            })}

            {/* Legend */}
            {Object.entries(CAT_COLORS).slice(0, 4).map(([, color], i) => (
              <g key={i} transform={`translate(${LABEL_W + i * 80}, ${svgH - 14})`}>
                <rect x={0} y={0} width={8} height={8} rx={2} fill={color} opacity={0.8} />
                <text x={12} y={7} fontSize={8} fill="#6b6b6b">{Object.values(CAT_LABELS)[i]}</text>
              </g>
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
