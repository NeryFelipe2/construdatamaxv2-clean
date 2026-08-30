/**
 * PlanejamentoMacroPanel — WBS Gantt with Previsto vs Tendência bars,
 * baseline management, activity CRUD, and export (PDF / Excel / PNG).
 */
import { useRef, useState, useMemo } from 'react'
import { Plus, Save, Download, X, Check, FileDown, Image, FileSpreadsheet, Search, SlidersHorizontal, BarChart3, Activity, Users } from 'lucide-react'
import * as XLSX from 'xlsx'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useProjectContext } from '@/store/projectContext'
import { useCronogramaEquipe } from '@/hooks/useCronogramaEquipe'
import { getProjectDateRange, daysBetween } from '../utils/masterEngine'
import { computeAbcCurve, computeHistogram, type MasterAbcZone } from '../utils/masterAnalysisEngine'
import type { MasterActivity, MasterActivityStatus } from '@/types'

// ─── Colors ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<MasterActivityStatus, string> = {
  not_started: '#6b6b6b',
  in_progress: '#f97316',
  completed:   '#22c55e',
  delayed:     '#ef4444',
}

const STATUS_LABEL: Record<MasterActivityStatus, string> = {
  not_started: 'Não iniciada',
  in_progress: 'Em andamento',
  completed:   'Concluída',
  delayed:     'Atrasada',
}

const NETWORK_COLOR: Record<string, string> = {
  agua:   '#f97316',
  esgoto: '#22c55e',
  civil:  '#f59e0b',
  geral:  '#a78bfa',
}

function networkColor(nt: string | undefined): string {
  return nt ? (NETWORK_COLOR[nt] ?? '#6b7280') : '#6b7280'
}

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// ─── Gantt SVG ───────────────────────────────────────────────────────────────

interface GanttChartProps {
  activities: MasterActivity[]
  collapsed: Set<string>
  onToggle: (id: string) => void
  svgRef: React.RefObject<SVGSVGElement | null>
}

function GanttChart({ activities, collapsed, onToggle, svgRef }: GanttChartProps) {
  // Determine which activities to show (hide children of collapsed parents)
  function isVisible(act: MasterActivity): boolean {
    if (!act.parentId) return true
    if (collapsed.has(act.parentId)) return false
    const parent = activities.find((a) => a.id === act.parentId)
    return parent ? isVisible(parent) : true
  }

  const visible = activities.filter((a) => a.level >= 0 && isVisible(a))
  if (visible.length === 0) return (
    <p className="text-[#6b6b6b] text-xs text-center py-8">Nenhuma atividade cadastrada</p>
  )

  const { start: projStart, end: projEnd } = getProjectDateRange(activities)
  const totalDays = Math.max(1, daysBetween(projStart, projEnd))

  const LABEL_W = 300
  const W       = 1000
  const ROW_H   = 36
  const PAD_TOP = 40
  const svgH    = PAD_TOP + visible.length * ROW_H + 20

  function xOf(date: string) { return Math.round((daysBetween(projStart, date) / totalDays) * W) }
  function wOf(s: string, e: string) { return Math.max(3, Math.round((daysBetween(s, e) / totalDays) * W)) }

  // Month markers
  const months: { date: string; label: string }[] = []
  const dIter = new Date(projStart + 'T00:00:00')
  dIter.setDate(1)
  if (dIter.toISOString().slice(0, 10) < projStart) dIter.setMonth(dIter.getMonth() + 1)
  while (dIter.toISOString().slice(0, 10) <= projEnd) {
    const iso = dIter.toISOString().slice(0, 10)
    months.push({ date: iso, label: dIter.toLocaleDateString('pt-BR', { month: 'short' }) })
    dIter.setMonth(dIter.getMonth() + 1)
  }

  const today = new Date().toISOString().slice(0, 10)

  // Determine which activities have children
  const parentIds = new Set(activities.map((a) => a.parentId).filter(Boolean) as string[])

  return (
    <div className="overflow-x-auto">
      <svg ref={svgRef} width={LABEL_W + W + 20} height={svgH} className="font-mono text-[10px]" style={{ background: '#0d1626' }}>
        {/* Month headers */}
        {months.map((m) => {
          const x = LABEL_W + xOf(m.date)
          return (
            <g key={m.date}>
              <line x1={x} y1={0} x2={x} y2={svgH - 14} stroke="#1e3a5f" strokeWidth={0.5} />
              <text x={x + 3} y={14} fontSize={9} fill="#4a7fa0">{m.label}</text>
            </g>
          )
        })}

        {/* Today line */}
        {today >= projStart && today <= projEnd && (() => {
          const tx = LABEL_W + xOf(today)
          return (
            <>
              <line x1={tx} y1={0} x2={tx} y2={svgH - 14} stroke="#f97316" strokeWidth={1} strokeDasharray="3,2" opacity={0.7} />
              <text x={tx + 2} y={24} fontSize={8} fill="#f97316">hoje</text>
            </>
          )
        })()}

        {/* Activity rows */}
        {visible.map((act, i) => {
          const y       = PAD_TOP + i * ROW_H
          const indent  = act.level * 14
          const color   = STATUS_COLOR[act.status]
          const nColor  = networkColor(act.networkType)
          const hasKids = parentIds.has(act.id)
          const isCollapsed = collapsed.has(act.id)
          const isL0  = act.level === 0
          const isL1  = act.level === 1

          const bPx   = xOf(act.plannedStart)
          const bW    = wOf(act.plannedStart, act.plannedEnd)
          const tPx   = xOf(act.trendStart)
          const tW    = wOf(act.trendStart, act.trendEnd)

          const maxLabelChars = Math.floor((LABEL_W - indent - 32) / 5.5)
          const labelName = act.name.length > maxLabelChars
            ? act.name.slice(0, maxLabelChars - 1) + '…'
            : act.name
          const label = `${act.wbsCode} ${labelName}`

          const tooltip = `${act.wbsCode} ${act.name}\nInício: ${act.plannedStart} → ${act.trendStart}\nFim: ${act.plannedEnd} → ${act.trendEnd}\nAndamento: ${act.percentComplete}%\nStatus: ${STATUS_LABEL[act.status]}`

          return (
            <g key={act.id}>
              <title>{tooltip}</title>

              {/* Row background */}
              {isL0 && <rect x={0} y={y - 1} width={LABEL_W + W} height={ROW_H} fill="#3d3d3d40" />}
              {isL1 && i % 2 === 0 && <rect x={0} y={y - 1} width={LABEL_W + W} height={ROW_H} fill="#0d1f3510" />}

              {/* Network type accent line (left) */}
              {act.networkType && (
                <rect x={0} y={y} width={3} height={ROW_H - 2} fill={nColor} opacity={0.7} rx={1} />
              )}

              {/* Toggle triangle for parents */}
              {hasKids && (
                <text
                  x={indent + 5}
                  y={y + ROW_H / 2 + 3}
                  fontSize={9}
                  fill="#4a7fa0"
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => onToggle(act.id)}
                >
                  {isCollapsed ? '▶' : '▼'}
                </text>
              )}

              {/* WBS label */}
              <text
                x={indent + (hasKids ? 18 : 8)}
                y={y + ROW_H / 2 + 3}
                fontSize={isL0 ? 11 : 10}
                fontWeight={isL0 || isL1 ? 'bold' : 'normal'}
                fill={isL0 ? '#e2f0f8' : '#a3a3a3'}
                style={{ cursor: hasKids ? 'pointer' : 'default' }}
                onClick={hasKids ? () => onToggle(act.id) : undefined}
              >
                {label}
              </text>

              {/* % complete */}
              <text x={LABEL_W - 30} y={y + ROW_H / 2 + 3} textAnchor="end" fontSize={8} fill={color}>
                {act.isMilestone ? '◆' : `${act.percentComplete}%`}
              </text>

              {act.isMilestone ? (
                <>
                  <polygon
                    points={`${LABEL_W + bPx},${y + 4} ${LABEL_W + bPx + 6},${y + 10} ${LABEL_W + bPx},${y + 16} ${LABEL_W + bPx - 6},${y + 10}`}
                    fill="#6b728030" stroke="#6b7280" strokeWidth={0.8}
                  />
                  <polygon
                    points={`${LABEL_W + tPx},${y + 8} ${LABEL_W + tPx + 4},${y + 12} ${LABEL_W + tPx},${y + 16} ${LABEL_W + tPx - 4},${y + 12}`}
                    fill={color} opacity={0.9}
                  />
                </>
              ) : (
                <>
                  {/* Previsto bar */}
                  <rect x={LABEL_W + bPx} y={y + 4} width={bW} height={9} rx={2} fill="#3a4a6b" opacity={0.5} />
                  {/* Tendência bar (network-colored) */}
                  <rect x={LABEL_W + tPx} y={y + 17} width={tW} height={isL0 ? 9 : 7} rx={2} fill={nColor} opacity={0.8} />
                  {/* Progress fill */}
                  {act.percentComplete > 0 && (
                    <rect
                      x={LABEL_W + tPx}
                      y={y + 17}
                      width={Math.round(tW * act.percentComplete / 100)}
                      height={isL0 ? 9 : 7}
                      rx={2}
                      fill={nColor}
                    />
                  )}
                </>
              )}
            </g>
          )
        })}

        {/* Legend */}
        <g transform={`translate(${LABEL_W + 4}, ${svgH - 16})`}>
          <rect x={0} y={0} width={8} height={5} rx={1} fill="#3a4a6b" opacity={0.5} />
          <text x={12} y={5} fontSize={8} fill="#6b6b6b">Previsto</text>
          <rect x={55} y={0} width={8} height={5} rx={1} fill="#f97316" opacity={0.8} />
          <text x={67} y={5} fontSize={8} fill="#6b6b6b">Tendência</text>
          {/* Network legend */}
          {Object.entries(NETWORK_COLOR).map(([nt, c], i) => (
            <g key={nt} transform={`translate(${130 + i * 55}, 0)`}>
              <rect x={0} y={0} width={8} height={5} rx={1} fill={c} opacity={0.8} />
              <text x={12} y={5} fontSize={8} fill="#6b6b6b">{nt.charAt(0).toUpperCase() + nt.slice(1)}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  )
}

// ─── ABC Curve Panel ─────────────────────────────────────────────────────────

const ABC_ZONE_COLOR: Record<MasterAbcZone, string> = {
  A: '#22c55e',
  B: '#f97316',
  C: '#ef4444',
}

function MasterAbcPanel({ activities }: { activities: MasterActivity[] }) {
  const abcItems = useMemo(() => computeAbcCurve(activities), [activities])

  if (abcItems.length === 0) {
    return <p className="text-[#6b6b6b] text-xs text-center py-8">Sem atividades com peso definido para calcular a curva ABC</p>
  }

  const W = 900
  const H = 260
  const PAD_L = 40
  const PAD_B = 24
  const barAreaW = W - PAD_L - 10
  const barW = Math.max(2, barAreaW / abcItems.length - 2)

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: '#0d1626', minWidth: 480 }}>
          {/* Y axis gridlines (0/25/50/75/100%) */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = H - PAD_B - (pct / 100) * (H - PAD_B - 20)
            return (
              <g key={pct}>
                <line x1={PAD_L} y1={y} x2={W - 10} y2={y} stroke="#1e3a5f" strokeWidth={0.5} />
                <text x={PAD_L - 6} y={y + 3} fontSize={8} fill="#4a7fa0" textAnchor="end">{pct}%</text>
              </g>
            )
          })}

          {/* Bars (individual share) */}
          {abcItems.map((item, i) => {
            const x = PAD_L + i * (barW + 2)
            const barH = (item.sharePct / 100) * (H - PAD_B - 20)
            const color = ABC_ZONE_COLOR[item.zone]
            return (
              <g key={item.activity.id}>
                <title>{`${item.activity.wbsCode} ${item.activity.name}\nPeso: ${item.weight}\nParticipação: ${item.sharePct}%\nAcumulado: ${item.cumulativePct}%\nZona: ${item.zone}`}</title>
                <rect x={x} y={H - PAD_B - barH} width={barW} height={barH} fill={color} opacity={0.8} rx={1} />
              </g>
            )
          })}

          {/* Cumulative line */}
          <polyline
            fill="none"
            stroke="#2abfdc"
            strokeWidth={1.5}
            points={abcItems.map((item, i) => {
              const x = PAD_L + i * (barW + 2) + barW / 2
              const y = H - PAD_B - (item.cumulativePct / 100) * (H - PAD_B - 20)
              return `${x},${y}`
            }).join(' ')}
          />

          {/* 75% / 95% threshold lines */}
          {[75, 95].map((pct) => {
            const y = H - PAD_B - (pct / 100) * (H - PAD_B - 20)
            return <line key={pct} x1={PAD_L} y1={y} x2={W - 10} y2={y} stroke="#6b6b6b" strokeWidth={0.5} strokeDasharray="4,3" />
          })}
        </svg>
      </div>

      {/* Legend + zone counts */}
      <div className="flex items-center gap-4 flex-wrap text-[10px]">
        {(['A', 'B', 'C'] as MasterAbcZone[]).map((zone) => {
          const count = abcItems.filter((i) => i.zone === zone).length
          return (
            <div key={zone} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ABC_ZONE_COLOR[zone] }} />
              <span className="text-[#a3a3a3]">Zona {zone}</span>
              <span className="text-[#6b6b6b]">({count})</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ backgroundColor: '#2abfdc' }} />
          <span className="text-[#a3a3a3]">Acumulado</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-64 overflow-y-auto rounded-lg border border-[#525252]">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="border-b border-[#525252] bg-[#2c2c2c]">
              <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">WBS</th>
              <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Atividade</th>
              <th className="px-3 py-2 text-right text-[#6b6b6b] font-medium">Peso</th>
              <th className="px-3 py-2 text-right text-[#6b6b6b] font-medium">%</th>
              <th className="px-3 py-2 text-right text-[#6b6b6b] font-medium">Acum. %</th>
              <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">Zona</th>
            </tr>
          </thead>
          <tbody>
            {abcItems.map((item) => (
              <tr key={item.activity.id} className="border-b border-[#525252]/50 hover:bg-[#484848]">
                <td className="px-3 py-1.5 font-mono text-[#6b6b6b]">{item.activity.wbsCode}</td>
                <td className="px-3 py-1.5 text-[#f5f5f5]">{item.activity.name}</td>
                <td className="px-3 py-1.5 text-right text-[#a3a3a3] font-mono">{item.weight}</td>
                <td className="px-3 py-1.5 text-right text-[#a3a3a3] font-mono">{item.sharePct}%</td>
                <td className="px-3 py-1.5 text-right text-[#a3a3a3] font-mono">{item.cumulativePct}%</td>
                <td className="px-3 py-1.5 text-center">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-semibold"
                    style={{ backgroundColor: ABC_ZONE_COLOR[item.zone] + '20', color: ABC_ZONE_COLOR[item.zone] }}
                  >
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

// ─── Resource Histogram Panel ────────────────────────────────────────────────

function MasterHistogramPanel({ activities }: { activities: MasterActivity[] }) {
  const { start, end } = useMemo(() => getProjectDateRange(activities), [activities])
  const points = useMemo(() => computeHistogram(activities, start, end), [activities, start, end])

  if (points.length === 0) {
    return <p className="text-[#6b6b6b] text-xs text-center py-8">Sem atividades no período para calcular o histograma</p>
  }

  const W = 900
  const H = 220
  const PAD_L = 34
  const PAD_B = 20
  const maxActivities = Math.max(1, ...points.map((p) => p.activeActivities))
  const barAreaW = W - PAD_L - 10
  const barW = Math.max(1, barAreaW / points.length - 1)

  // Sample month labels for x axis (avoid overcrowding)
  const monthTicks: { i: number; label: string }[] = []
  let lastMonth = ''
  points.forEach((p, i) => {
    const month = p.date.slice(0, 7)
    if (month !== lastMonth) {
      monthTicks.push({ i, label: new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }) })
      lastMonth = month
    }
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ background: '#0d1626', minWidth: 480 }}>
          {/* Y gridlines */}
          {Array.from({ length: 4 }, (_, i) => Math.round((maxActivities / 3) * i)).map((val) => {
            const y = H - PAD_B - (val / maxActivities) * (H - PAD_B - 16)
            return (
              <g key={val}>
                <line x1={PAD_L} y1={y} x2={W - 10} y2={y} stroke="#1e3a5f" strokeWidth={0.5} />
                <text x={PAD_L - 6} y={y + 3} fontSize={8} fill="#4a7fa0" textAnchor="end">{val}</text>
              </g>
            )
          })}

          {/* Month ticks */}
          {monthTicks.map((m) => {
            const x = PAD_L + m.i * (barW + 1)
            return <text key={m.i} x={x} y={H - 6} fontSize={8} fill="#4a7fa0">{m.label}</text>
          })}

          {/* Bars: active activities (bar), overlaid line: active teams */}
          {points.map((p, i) => {
            const x = PAD_L + i * (barW + 1)
            const barH = (p.activeActivities / maxActivities) * (H - PAD_B - 16)
            return (
              <g key={p.date}>
                <title>{`${p.date}\nAtividades ativas: ${p.activeActivities}\nEquipes ativas: ${p.activeTeams}\nPeso em execução: ${p.totalWeight}`}</title>
                <rect x={x} y={H - PAD_B - barH} width={barW} height={barH} fill="#f97316" opacity={0.55} rx={1} />
              </g>
            )
          })}

          {/* Active teams line */}
          <polyline
            fill="none"
            stroke="#2abfdc"
            strokeWidth={1.5}
            points={points.map((p, i) => {
              const x = PAD_L + i * (barW + 1) + barW / 2
              const y = H - PAD_B - (p.activeTeams / maxActivities) * (H - PAD_B - 16)
              return `${x},${y}`
            }).join(' ')}
          />
        </svg>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-[10px]">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#f97316', opacity: 0.7 }} />
          <span className="text-[#a3a3a3]">Atividades ativas / dia</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5" style={{ backgroundColor: '#2abfdc' }} />
          <span className="text-[#a3a3a3]">Equipes distintas ativas / dia</span>
        </div>
      </div>
    </div>
  )
}

// ─── New Activity Form ───────────────────────────────────────────────────────

/**
 * Em modo real, o motor (`useMasterScheduleEngine`) AGREGA os itens de
 * `planejamento_itens` por núcleo×sistema — não existe uma atividade solta
 * por WBS. Então "criar atividade" aqui vira "lançar uma quantidade real"
 * (sistema + metros), que grava em `planejamento_itens` e entra na soma do
 * grupo certo assim que a engine recarrega (reloadRealData).
 */
function NewRealItemForm({ onClose }: { onClose: () => void }) {
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const projetos = useProjectContext((s) => s.projetos)
  const reloadRealData = usePlanejamentoMestreStore((s) => s.reloadRealData)
  const projetoAtivo = projetos.find((p) => p.id === activeProjectId) ?? null

  const [form, setForm] = useState({
    sistema: 'AGUA' as 'AGUA' | 'ESGOTO',
    descricao: '',
    quantidadeM: '',
    equipeOriginal: '',
    rua: '',
    dataInicio: new Date().toISOString().slice(0, 10),
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!activeProjectId || !projetoAtivo) { setErro('Selecione um projeto ativo no topo do site.'); return }
    const qtd = Number(form.quantidadeM)
    if (!form.descricao.trim() || !Number.isFinite(qtd) || qtd <= 0) { setErro('Preencha descrição e uma quantidade maior que zero.'); return }
    setSalvando(true)
    setErro(null)
    try {
      const { criarItemPlanejamentoMestre } = await import('@/hooks/useMasterActivities')
      await criarItemPlanejamentoMestre({
        projetoId: activeProjectId,
        nucleo: projetoAtivo.nome,
        sistema: form.sistema,
        quantidadeM: qtd,
        descricao: form.descricao.trim(),
        equipeOriginal: form.equipeOriginal.trim() || undefined,
        rua: form.rua.trim() || undefined,
        dataInicio: form.dataInicio || undefined,
      })
      reloadRealData?.()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao gravar item.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">Nova Quantidade — {projetoAtivo?.nome ?? 'selecione um projeto'}</p>
        <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={16} /></button>
      </div>
      <p className="text-[10px] text-[#a3a3a3]">
        Dado real: entra na soma da Visão Geral do núcleo/sistema assim que salvar. Não cria WBS solto — o motor agrega por núcleo×sistema×equipe.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Sistema *</label>
          <select className={inputCls} value={form.sistema} onChange={(e) => setForm((f) => ({ ...f, sistema: e.target.value as 'AGUA' | 'ESGOTO' }))}>
            <option value="AGUA">Água</option>
            <option value="ESGOTO">Esgoto</option>
          </select>
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Metros (m) *</label>
          <input type="number" min={0} step="0.01" className={inputCls} value={form.quantidadeM} onChange={(e) => setForm((f) => ({ ...f, quantidadeM: e.target.value }))} required />
        </div>
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Descrição *</label>
          <input className={inputCls} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Rede de água — Rua 4" required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Equipe (líder)</label>
          <input className={inputCls} value={form.equipeOriginal} onChange={(e) => setForm((f) => ({ ...f, equipeOriginal: e.target.value }))} placeholder="opcional" />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Rua / local</label>
          <input className={inputCls} value={form.rua} onChange={(e) => setForm((f) => ({ ...f, rua: e.target.value }))} placeholder="opcional" />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Início previsto</label>
          <input type="date" className={inputCls} value={form.dataInicio} onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))} />
        </div>
      </div>
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#a3a3a3]">Cancelar</button>
        <button type="submit" disabled={salvando} className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c] disabled:opacity-50">
          <Check size={12} className="inline mr-1" />{salvando ? 'Gravando…' : 'Gravar'}
        </button>
      </div>
    </form>
  )
}

function NewActivityForm({ onClose }: { onClose: () => void }) {
  const addActivity = usePlanejamentoMestreStore((s) => s.addActivity)
  const activities  = usePlanejamentoMestreStore((s) => s.activities)
  const dataSource  = usePlanejamentoMestreStore((s) => s.dataSource)

  const [form, setForm] = useState({
    wbsCode: '', name: '',
    parentId: '' as string,
    plannedStart: new Date().toISOString().slice(0, 10),
    plannedEnd: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    responsibleTeam: '', isMilestone: false, weight: 5,
    networkType: '' as string,
  })

  const parentActivity = activities.find((a) => a.id === form.parentId) ?? null
  const derivedLevel   = parentActivity ? parentActivity.level + 1 : 0

  // Modo dado real: WBS manual não se aplica (motor agrega por núcleo×sistema
  // a partir de planejamento_itens) — usa o formulário de lançamento real.
  if (dataSource === 'real') return <NewRealItemForm onClose={onClose} />

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.wbsCode.trim() || !form.name.trim()) return
    const dur = daysBetween(form.plannedStart, form.plannedEnd)
    addActivity({
      wbsCode: form.wbsCode, name: form.name,
      parentId: form.parentId || null, level: derivedLevel,
      plannedStart: form.plannedStart, plannedEnd: form.plannedEnd,
      trendStart: form.plannedStart, trendEnd: form.plannedEnd,
      durationDays: Math.max(0, dur), percentComplete: 0, status: 'not_started',
      isMilestone: form.isMilestone, responsibleTeam: form.responsibleTeam || undefined,
      weight: form.weight,
      networkType: (form.networkType || undefined) as MasterActivity['networkType'],
    })
    onClose()
  }

  const inputCls = 'w-full bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60'

  return (
    <form onSubmit={handleSubmit} className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[#f5f5f5] text-sm font-semibold">Nova Atividade</p>
        <button type="button" onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Atividade Pai</label>
          <select className={inputCls} value={form.parentId} onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}>
            <option value="">— Raiz (sem parent) — Nível 0</option>
            {activities.map((a) => (
              <option key={a.id} value={a.id}>{'  '.repeat(a.level)}{a.wbsCode} — {a.name}  (N{a.level})</option>
            ))}
          </select>
          {parentActivity && <p className="text-[10px] text-[#f97316] mt-0.5">Nível calculado: {derivedLevel}</p>}
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Código WBS *</label>
          <input className={inputCls} value={form.wbsCode} onChange={(e) => setForm((f) => ({ ...f, wbsCode: e.target.value }))} placeholder="1.1.6" required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Tipo de Rede</label>
          <select className={inputCls} value={form.networkType} onChange={(e) => setForm((f) => ({ ...f, networkType: e.target.value }))}>
            <option value="">— Geral —</option>
            <option value="agua">Água</option>
            <option value="esgoto">Esgoto</option>
            <option value="civil">Civil</option>
            <option value="geral">Geral</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Nome *</label>
          <input className={inputCls} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Início</label>
          <input type="date" className={inputCls} value={form.plannedStart} onChange={(e) => setForm((f) => ({ ...f, plannedStart: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Fim</label>
          <input type="date" className={inputCls} value={form.plannedEnd} onChange={(e) => setForm((f) => ({ ...f, plannedEnd: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Equipe</label>
          <input className={inputCls} value={form.responsibleTeam} onChange={(e) => setForm((f) => ({ ...f, responsibleTeam: e.target.value }))} />
        </div>
        <div>
          <label className="text-[#6b6b6b] text-[10px] block mb-1">Peso</label>
          <input type="number" min={0} max={100} className={inputCls} value={form.weight} onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) }))} />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={form.isMilestone} onChange={(e) => setForm((f) => ({ ...f, isMilestone: e.target.checked }))} className="accent-[#f97316]" />
          <span className="text-[#6b6b6b] text-xs">Marco (Milestone)</span>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#a3a3a3]">Cancelar</button>
        <button type="submit" className="px-4 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]">
          <Check size={12} className="inline mr-1" />Criar
        </button>
      </div>
    </form>
  )
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function exportExcel(activities: MasterActivity[]) {
  const rows = activities.map((a) => ({
    'WBS':         a.wbsCode,
    'Atividade':   a.name,
    'Nível':       a.level,
    'Tipo Rede':   a.networkType ?? '',
    'Início Plan': a.plannedStart,
    'Fim Plan':    a.plannedEnd,
    'Início Tend': a.trendStart,
    'Fim Tend':    a.trendEnd,
    '% Conc.':     a.percentComplete,
    'Status':      a.status,
    'Equipe':      a.responsibleTeam ?? '',
    'Peso':        a.weight ?? '',
    'Marco':       a.isMilestone ? 'Sim' : 'Não',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'WBS')
  XLSX.writeFile(wb, 'planejamento-mestre-longo-prazo.xlsx')
}

function exportPng(svgEl: SVGSVGElement | null) {
  if (!svgEl) return
  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svgEl)
  const blob = new Blob([svgStr], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  const img  = new window.Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width  = svgEl.width.baseVal.value * 2
    canvas.height = svgEl.height.baseVal.value * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)
    ctx.fillStyle = '#0d1626'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    const link = document.createElement('a')
    link.download = 'gantt-longo-prazo.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  img.src = url
}

function exportPdf() {
  window.print()
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function PlanejamentoMacroPanel() {
  const activities    = usePlanejamentoMestreStore((s) => s.activities)
  const baselines     = usePlanejamentoMestreStore((s) => s.baselines)
  const activeBlId    = usePlanejamentoMestreStore((s) => s.activeBaselineId)
  const saveBaseline  = usePlanejamentoMestreStore((s) => s.saveBaseline)
  const loadBaseline  = usePlanejamentoMestreStore((s) => s.loadBaseline)

  // M6 — "tudo conversa": em vez de reescrever o motor macro (risco alto,
  // não priorizado), mostramos lado a lado a projeção do motor atual (por
  // velocidade histórica, já no ar) e o fim projetado pelo cronograma que o
  // Felipe monta por equipe (aba "Por Equipe"), quando existir. Puramente
  // aditivo/informativo — não altera o Gantt nem os cálculos existentes.
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const cron = useCronogramaEquipe(activeProjectId)
  const dataFimPelasEquipes = useMemo(() => {
    const fins = cron.cronogramasPorEquipe
      .map((c) => c.dataFim)
      .filter((d): d is string => !!d)
    if (fins.length === 0) return null
    return fins.sort().at(-1)!
  }, [cron.cronogramasPorEquipe])

  const [showNewForm, setShowNewForm]   = useState(false)
  const [blName, setBlName]             = useState('')
  const [showBlSave, setShowBlSave]     = useState(false)
  const [collapsed, setCollapsed]       = useState<Set<string>>(new Set())
  const [search, setSearch]             = useState('')
  const [filterStatus, setFilterStatus] = useState<MasterActivityStatus | ''>('')
  const [filterNetwork, setFilterNetwork] = useState<string>('')
  const [filterService, setFilterService] = useState<string>('')
  const [showFilters, setShowFilters]   = useState(false)
  const [view, setView] = useState<'gantt' | 'analise'>('gantt')
  const svgRef = useRef<SVGSVGElement | null>(null)

  const filtered = useMemo(() =>
    activities.filter((a) =>
      (!search || a.name.toLowerCase().includes(search.toLowerCase()) || a.wbsCode.toLowerCase().includes(search.toLowerCase())) &&
      (!filterStatus  || a.status          === filterStatus) &&
      (!filterNetwork || a.networkType     === filterNetwork) &&
      (!filterService || a.serviceCategory === filterService)
    ),
    [activities, search, filterStatus, filterNetwork, filterService],
  )

  // Fim projetado pelo motor macro atual (velocidade histórica / RDO) — o
  // mesmo cálculo já usado no header ("Dias p/ fim"), só reaproveitado aqui
  // para comparar lado a lado com o fim projetado pelas equipes.
  const motorEnd = useMemo(() => getProjectDateRange(activities).end, [activities])

  const activeFilterCount = [search, filterStatus, filterNetwork, filterService].filter(Boolean).length

  function clearFilters() {
    setSearch('')
    setFilterStatus('')
    setFilterNetwork('')
    setFilterService('')
  }

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSaveBaseline() {
    if (!blName.trim()) return
    saveBaseline(blName.trim())
    setBlName('')
    setShowBlSave(false)
  }

  const btnCls = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-[#6b6b6b] text-xs hover:text-[#f97316] hover:border-[#f97316]/40 transition-colors'

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      {/* ── Resumo: motor macro × cronograma por equipe (M6, "tudo conversa") ── */}
      <div className="flex items-center gap-2 flex-wrap text-xs bg-[#2c2c2c] border border-[#525252] rounded-lg px-4 py-2.5 print:hidden">
        <Users size={13} className="text-[#a78bfa] shrink-0" />
        <span className="text-[#6b6b6b]">Fim previsto (motor macro, por velocidade):</span>
        <span className="text-[#f5f5f5] font-semibold tabular-nums">{activities.length > 0 ? fmtDate(motorEnd) : '—'}</span>
        <span className="text-[#525252] hidden sm:inline">·</span>
        <span className="text-[#6b6b6b]">Fim previsto pelas equipes (cronograma por equipe):</span>
        {dataFimPelasEquipes ? (
          <span className="text-[#a78bfa] font-semibold tabular-nums">{fmtDate(dataFimPelasEquipes)}</span>
        ) : (
          <span className="text-[#6b6b6b] italic">nenhum trabalho atribuído ainda na aba "Por Equipe"</span>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 flex-wrap print:hidden">
        {/* Baseline */}
        <div className="flex items-center gap-2">
          <span className="text-[#6b6b6b] text-xs">Baseline:</span>
          <select
            value={activeBlId ?? ''}
            onChange={(e) => e.target.value && loadBaseline(e.target.value)}
            className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60"
          >
            <option value="">— Selecionar —</option>
            {baselines.map((bl) => (
              <option key={bl.id} value={bl.id}>{bl.name}</option>
            ))}
          </select>
        </div>

        {showBlSave ? (
          <div className="flex items-center gap-2">
            <input
              className="bg-[#2c2c2c] border border-[#525252] rounded-lg px-3 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/60 w-40"
              placeholder="Nome da baseline"
              value={blName}
              onChange={(e) => setBlName(e.target.value)}
              autoFocus
            />
            <button onClick={handleSaveBaseline} className="px-2.5 py-1.5 rounded-lg bg-[#22c55e]/20 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/30">
              <Save size={12} className="inline mr-1" />Salvar
            </button>
            <button onClick={() => setShowBlSave(false)} className="text-[#6b6b6b] hover:text-[#a3a3a3] text-xs">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setShowBlSave(true)} className={btnCls}>
            <Download size={12} />Salvar Baseline
          </button>
        )}

        {/* View toggle: Gantt vs Análise (ABC / Histograma) */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg border border-[#525252] bg-[#2c2c2c]">
          <button
            onClick={() => setView('gantt')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              view === 'gantt' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
            }`}
          >
            Gantt
          </button>
          <button
            onClick={() => setView('analise')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              view === 'analise' ? 'bg-[#f97316] text-white' : 'text-[#6b6b6b] hover:text-[#f5f5f5]'
            }`}
          >
            <BarChart3 size={12} />Análise ABC/Histograma
          </button>
        </div>

        {/* Export buttons */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={exportPdf} className={btnCls} title="Exportar PDF">
            <FileDown size={12} />PDF
          </button>
          <button onClick={() => exportExcel(filtered)} className={btnCls} title="Exportar Excel">
            <FileSpreadsheet size={12} />Excel
          </button>
          <button onClick={() => exportPng(svgRef.current)} className={btnCls} title="Exportar PNG">
            <Image size={12} />PNG
          </button>
        </div>

        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#f97316] text-white text-xs font-semibold hover:bg-[#ea580c]"
        >
          <Plus size={13} />Nova Atividade
        </button>
      </div>

      {/* New activity form */}
      {showNewForm && <NewActivityForm onClose={() => setShowNewForm(false)} />}

      {/* ── Filter Bar ── */}
      <div className="print:hidden">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou WBS..."
              className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-[#3d3d3d] border border-[#525252] text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50 transition-colors"
            />
          </div>

          {/* Toggle advanced filters */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-[#f97316]/50 bg-[#f97316]/10 text-[#f97316]'
                : 'border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5]'
            }`}
          >
            <SlidersHorizontal size={12} />
            Filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-[#ef4444] hover:bg-[#ef4444]/10 border border-[#ef4444]/30 transition-colors"
            >
              <X size={11} />Limpar
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {/* Status filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Status:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as MasterActivityStatus | '')}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todos</option>
                <option value="not_started">Não iniciada</option>
                <option value="in_progress">Em andamento</option>
                <option value="completed">Concluída</option>
                <option value="delayed">Atrasada</option>
              </select>
            </div>

            {/* Network type filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Rede:</span>
              <select
                value={filterNetwork}
                onChange={(e) => setFilterNetwork(e.target.value)}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todas</option>
                <option value="agua">Água</option>
                <option value="esgoto">Esgoto</option>
                <option value="civil">Civil</option>
                <option value="geral">Geral</option>
              </select>
            </div>

            {/* Service category filter */}
            <div className="flex items-center gap-2">
              <span className="text-[#6b6b6b] text-xs shrink-0">Serviço:</span>
              <select
                value={filterService}
                onChange={(e) => setFilterService(e.target.value)}
                className="bg-[#3d3d3d] border border-[#525252] rounded-lg px-2.5 py-1.5 text-xs text-[#f5f5f5] focus:outline-none focus:border-[#f97316]/50"
              >
                <option value="">Todos</option>
                <option value="LA">LA — Ligação de Água</option>
                <option value="LE">LE — Ligação de Esgoto</option>
                <option value="intra">Intra</option>
                <option value="interligacao">Interligação</option>
                <option value="reposicao">Reposição</option>
                <option value="na_rede">Na Rede</option>
                <option value="OS">OS — Ordem de Serviço</option>
                <option value="pavimentacao">Pavimentação</option>
                <option value="recomposicao">Recomposição</option>
              </select>
            </div>

            <span className="text-[#6b6b6b] text-xs ml-auto">
              {filtered.length} de {activities.length} atividade{activities.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {view === 'gantt' && (
        <>
          {/* ── Gantt Chart ── */}
          <div className="bg-[#0d1626] border border-[#525252] rounded-xl overflow-hidden print:border-0">
            <div className="px-4 py-3 border-b border-[#525252] flex items-center justify-between print:hidden">
              <div>
                <h3 className="text-[#f5f5f5] text-sm font-semibold">Cronograma Macro — Previsto vs Tendência</h3>
                <p className="text-[#6b6b6b] text-xs mt-0.5">
                  {filtered.length} atividade{filtered.length !== 1 ? 's' : ''}
                  {activeFilterCount > 0 ? ` (filtrado de ${activities.length})` : ''}
                  {' '}· Clique em ▶/▼ para expandir/recolher
                </p>
              </div>
            </div>
            <div className="p-3">
              <GanttChart
                activities={filtered}
                collapsed={collapsed}
                onToggle={toggleCollapse}
                svgRef={svgRef}
              />
            </div>
          </div>

          {/* ── Activity list table ── */}
          <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#525252] bg-[#2c2c2c]">
                    <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">WBS</th>
                    <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Atividade</th>
                    <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Tipo</th>
                    <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Início</th>
                    <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Fim</th>
                    <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Tendência</th>
                    <th className="px-3 py-2 text-center text-[#6b6b6b] font-medium">%</th>
                    <th className="px-3 py-2 text-left text-[#6b6b6b] font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.filter((a) => a.level >= 1).map((act) => {
                    const color  = STATUS_COLOR[act.status]
                    const nColor = networkColor(act.networkType)
                    const delta  = daysBetween(act.plannedEnd, act.trendEnd)
                    return (
                      <tr key={act.id} className="border-b border-[#525252]/50 hover:bg-[#484848]">
                        <td
                          className="px-3 py-2 font-mono text-[#6b6b6b]"
                          style={{ paddingLeft: `${10 + act.level * 14}px` }}
                        >
                          {act.isMilestone ? '◆ ' : ''}{act.wbsCode}
                        </td>
                        <td className="px-3 py-2 text-[#f5f5f5]">{act.name}</td>
                        <td className="px-3 py-2">
                          {act.networkType ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase"
                              style={{ backgroundColor: nColor + '20', color: nColor }}
                            >
                              {act.networkType}
                            </span>
                          ) : <span className="text-[#525252]">—</span>}
                        </td>
                        <td className="px-3 py-2 text-[#a3a3a3] font-mono">{fmtDate(act.plannedStart)}</td>
                        <td className="px-3 py-2 text-[#a3a3a3] font-mono">{fmtDate(act.plannedEnd)}</td>
                        <td className="px-3 py-2 font-mono">
                          <span className={delta > 0 ? 'text-[#ef4444]' : delta < 0 ? 'text-[#22c55e]' : 'text-[#6b6b6b]'}>
                            {fmtDate(act.trendEnd)}{delta > 0 ? ` (+${delta}d)` : delta < 0 ? ` (${delta}d)` : ''}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center font-mono" style={{ color }}>{act.percentComplete}%</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: color + '18', color }}>
                            {STATUS_LABEL[act.status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {view === 'analise' && (
        <>
          {/* ── Curva ABC (Pareto) ── */}
          <div className="bg-[#0d1626] border border-[#525252] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#525252] flex items-center gap-2">
              <BarChart3 size={14} className="text-[#f97316]" />
              <div>
                <h3 className="text-[#f5f5f5] text-sm font-semibold">Curva ABC — Peso das Atividades</h3>
                <p className="text-[#6b6b6b] text-xs mt-0.5">
                  Atividades ordenadas por peso decrescente · Zona A (≤75% acumulado) concentra o esforço crítico
                  {activeFilterCount > 0 ? ` · filtrado de ${activities.length}` : ''}
                </p>
              </div>
            </div>
            <div className="p-3">
              <MasterAbcPanel activities={filtered} />
            </div>
          </div>

          {/* ── Histograma de Recursos ── */}
          <div className="bg-[#0d1626] border border-[#525252] rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#525252] flex items-center gap-2">
              <Activity size={14} className="text-[#2abfdc]" />
              <div>
                <h3 className="text-[#f5f5f5] text-sm font-semibold">Histograma de Recursos</h3>
                <p className="text-[#6b6b6b] text-xs mt-0.5">
                  Atividades e equipes ativas por dia, ao longo do cronograma de tendência
                </p>
              </div>
            </div>
            <div className="p-3">
              <MasterHistogramPanel activities={filtered} />
            </div>
          </div>
        </>
      )}

      {/* Print styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #root { display: block !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
