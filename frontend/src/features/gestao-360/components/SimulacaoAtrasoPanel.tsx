/**
 * SimulacaoAtrasoPanel — "What-if" delay simulation for Gestão 360.
 * Calls generateSchedule() twice (base + with delays) and diffs the results.
 * Features: inline edit, delete with confirmation, improved Gantt, burn chart, infographic.
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, Clock, AlertTriangle, CalendarDays, DollarSign, Pencil, Trash2, Check, X } from 'lucide-react'
import { generateSchedule } from '@/features/planejamento/utils/scheduleEngine'
import type { TrechoDelay, PlanTrecho, GanttRow } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(1)}k`
  return `R$ ${n.toFixed(0)}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a || !b) return 0
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

// ─── Improved Gantt ───────────────────────────────────────────────────────────

function GanttComparison({
  base, delayed, allDates,
}: {
  base: GanttRow[]
  delayed: GanttRow[]
  allDates: string[]
}) {
  if (base.length === 0 || allDates.length === 0) return null

  const rows = base.slice(0, 15)
  const totalDays = allDates.length
  const W = 500, ROW_H = 22, LABEL_W = 160

  const today = new Date().toISOString().slice(0, 10)
  const todayIdx = allDates.indexOf(today)
  const todayX = todayIdx >= 0 ? LABEL_W + Math.round((todayIdx / totalDays) * W) : -1

  function xOf(date: string): number {
    const idx = allDates.indexOf(date)
    if (idx < 0) return 0
    return Math.round((idx / totalDays) * W)
  }
  function wOf(start: string, end: string): number {
    const s = xOf(start)
    const e = xOf(end) + Math.round(W / totalDays)
    return Math.max(3, e - s)
  }

  const svgH = rows.length * ROW_H + 32

  return (
    <div className="overflow-x-auto">
      <svg width={LABEL_W + W + 80} height={svgH} className="font-mono text-[10px]">
        {/* Column headers — month markers */}
        {allDates.filter((_, i) => i % Math.max(1, Math.floor(totalDays / 8)) === 0).map((d) => {
          const x = LABEL_W + xOf(d)
          const label = d.slice(5, 10).replace('-', '/')
          return (
            <g key={d}>
              <line x1={x} y1={0} x2={x} y2={svgH - 14} stroke="#20406a" strokeWidth={0.5} />
              <text x={x + 2} y={svgH - 2} fontSize={8} fill="#5a8caa">{label}</text>
            </g>
          )
        })}

        {/* Today line */}
        {todayX > 0 && (
          <>
            <line x1={todayX} y1={0} x2={todayX} y2={svgH - 14} stroke="#2abfdc" strokeWidth={1} strokeDasharray="3,2" opacity={0.8} />
            <text x={todayX + 2} y={10} fontSize={8} fill="#2abfdc">hoje</text>
          </>
        )}

        {/* Rows */}
        {rows.map((row, i) => {
          const delayedRow = delayed[i]
          const y = 14 + i * ROW_H
          const bx = xOf(row.startDate)
          const bw = wOf(row.startDate, row.endDate)
          const dx = delayedRow ? xOf(delayedRow.startDate) : bx
          const dw = delayedRow ? wOf(delayedRow.startDate, delayedRow.endDate) : bw

          const delayDiff = delayedRow
            ? daysBetween(row.endDate, delayedRow.endDate)
            : 0
          const delayColor =
            delayDiff === 0 ? '#22c55e' :
            delayDiff <= 14  ? '#eab308' : '#ef4444'

          const label = row.trecho.code.length > 18
            ? row.trecho.code.slice(0, 17) + '…'
            : row.trecho.code

          // Alternating row backgrounds
          const rowBg = i % 2 === 0 ? '#1a366208' : 'transparent'

          return (
            <g key={row.trecho.id}>
              {/* Row bg */}
              <rect x={0} y={y - 2} width={LABEL_W + W} height={ROW_H} fill={rowBg} />

              {/* Label */}
              <text x={LABEL_W - 6} y={y + 10} textAnchor="end" fontSize={9} fill="#8fb3c8">
                {label}
              </text>

              {/* Base bar */}
              <rect x={LABEL_W + bx} y={y} width={bw} height={9} rx={2} fill="#3a4a6b" opacity={0.9} />

              {/* Delayed bar */}
              {delayedRow && (dx !== bx || dw !== bw) && (
                <rect x={LABEL_W + dx} y={y + 12} width={dw} height={5} rx={2} fill={delayColor} opacity={0.8} />
              )}

              {/* Delay badge */}
              {delayDiff > 0 && (
                <text x={LABEL_W + dx + dw + 3} y={y + 17} fontSize={8} fill={delayColor}>
                  +{delayDiff}d
                </text>
              )}
            </g>
          )
        })}

        {/* Legend */}
        <rect x={LABEL_W + W + 6} y={14} width={10} height={8} rx={2} fill="#3a4a6b" opacity={0.9} />
        <text x={LABEL_W + W + 20} y={21} fill="#9ca3af" fontSize={9}>Base</text>
        <rect x={LABEL_W + W + 6} y={26} width={10} height={5} rx={2} fill="#22c55e" opacity={0.8} />
        <text x={LABEL_W + W + 20} y={31} fill="#9ca3af" fontSize={9}>Sem atraso</text>
        <rect x={LABEL_W + W + 6} y={35} width={10} height={5} rx={2} fill="#eab308" opacity={0.8} />
        <text x={LABEL_W + W + 20} y={40} fill="#9ca3af" fontSize={9}>≤14d</text>
        <rect x={LABEL_W + W + 6} y={44} width={10} height={5} rx={2} fill="#ef4444" opacity={0.8} />
        <text x={LABEL_W + W + 20} y={49} fill="#9ca3af" fontSize={9}>&gt;14d</text>
      </svg>
    </div>
  )
}

// ─── Cost Burn Area Chart ─────────────────────────────────────────────────────

interface BurnPoint { week: number; date: string; base: number; delayed: number }

function ImpactBurnChart({ base, delayed }: { base: GanttRow[]; delayed: GanttRow[] }) {
  if (base.length === 0) return null

  // Build weekly cumulative cost for both scenarios
  const allDates = (() => {
    const dates: Set<string> = new Set()
    const addRange = (rows: GanttRow[]) => {
      rows.forEach((r) => {
        const start = new Date(r.startDate + 'T00:00:00')
        const end   = new Date(r.endDate   + 'T00:00:00')
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          dates.add(d.toISOString().slice(0, 10))
        }
      })
    }
    addRange(base)
    addRange(delayed)
    return Array.from(dates).sort()
  })()

  if (allDates.length === 0) return null

  // Daily cost lookup
  function buildDailyCost(rows: GanttRow[]): Record<string, number> {
    const map: Record<string, number> = {}
    rows.forEach((r) => {
      const start = new Date(r.startDate + 'T00:00:00')
      const end   = new Date(r.endDate   + 'T00:00:00')
      const days  = Math.max(1, (end.getTime() - start.getTime()) / 86_400_000)
      const daily = r.totalCostBRL / days
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = d.toISOString().slice(0, 10)
        map[key] = (map[key] ?? 0) + daily
      }
    })
    return map
  }

  const baseCost    = buildDailyCost(base)
  const delayedCost = buildDailyCost(delayed)

  // Weekly samples
  const points: BurnPoint[] = []
  let cumBase = 0, cumDelayed = 0
  allDates.forEach((d, i) => {
    cumBase    += baseCost[d]    ?? 0
    cumDelayed += delayedCost[d] ?? 0
    if (i % 7 === 0 || i === allDates.length - 1) {
      points.push({ week: points.length, date: d, base: cumBase, delayed: cumDelayed })
    }
  })

  if (points.length < 2) return null

  const maxVal = Math.max(...points.map((p) => Math.max(p.base, p.delayed)), 1)
  const W = 560, H = 140, PAD_L = 60, PAD_B = 24

  function px(i: number) { return PAD_L + (i / (points.length - 1)) * (W - PAD_L) }
  function py(v: number) { return H - PAD_B - ((v / maxVal) * (H - PAD_B - 10)) }

  const basePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.base).toFixed(1)}`).join(' ')
  const baseArea = `${basePath} L${px(points.length - 1).toFixed(1)},${(H - PAD_B).toFixed(1)} L${px(0).toFixed(1)},${(H - PAD_B).toFixed(1)} Z`

  const delayPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.delayed).toFixed(1)}`).join(' ')
  const delayArea = `${delayPath} L${px(points.length - 1).toFixed(1)},${(H - PAD_B).toFixed(1)} L${px(0).toFixed(1)},${(H - PAD_B).toFixed(1)} Z`

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: maxVal * f, y: py(maxVal * f) }))

  // X-axis — monthly labels
  const xLabels = points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 6)) === 0)

  return (
    <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
      <h3 className="text-[#e4f2f8] text-sm font-semibold mb-3 flex items-center gap-2">
        <DollarSign size={14} className="text-[#2abfdc]" />
        Impacto no Custo ao Longo do Tempo
      </h3>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="font-mono text-[10px]">
          <defs>
            <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6b7280" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6b7280" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id="delayGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2abfdc" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2abfdc" stopOpacity="0.03" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={PAD_L} y1={t.y} x2={W} y2={t.y} stroke="#20406a" strokeWidth={0.5} strokeDasharray="4,3" />
              <text x={PAD_L - 4} y={t.y + 3} textAnchor="end" fontSize={8} fill="#5a8caa">
                {t.v >= 1_000_000 ? `R$${(t.v / 1_000_000).toFixed(1)}M` : t.v > 0 ? `R$${(t.v / 1_000).toFixed(0)}k` : 'R$0'}
              </text>
            </g>
          ))}

          {/* Base area + line */}
          <path d={baseArea} fill="url(#baseGrad)" />
          <path d={basePath} fill="none" stroke="#6b7280" strokeWidth={1.5} strokeLinejoin="round" />

          {/* Delayed area + line */}
          <path d={delayArea} fill="url(#delayGrad)" />
          <path d={delayPath} fill="none" stroke="#2abfdc" strokeWidth={2} strokeLinejoin="round" />

          {/* X-axis labels */}
          {xLabels.map((p, i) => (
            <text key={i} x={px(points.indexOf(p))} y={H - 4} textAnchor="middle" fontSize={8} fill="#5a8caa">
              {p.date.slice(5, 10).replace('-', '/')}
            </text>
          ))}

          {/* Legend */}
          <line x1={W - 110} y1={12} x2={W - 96} y2={12} stroke="#6b7280" strokeWidth={2} />
          <text x={W - 92} y={15} fontSize={9} fill="#9ca3af">Base</text>
          <line x1={W - 60} y1={12} x2={W - 46} y2={12} stroke="#2abfdc" strokeWidth={2} />
          <text x={W - 42} y={15} fontSize={9} fill="#9ca3af">C/ Atrasos</text>
        </svg>
      </div>
    </div>
  )
}

// ─── Delay Summary Infographic ────────────────────────────────────────────────

function DelaySummaryInfographic({
  deltaDays,
  deltaCost,
  baseCost,
}: {
  deltaDays: number
  deltaCost: number
  baseCost: number
}) {
  const pctExtra = baseCost > 0 ? ((deltaCost / baseCost) * 100) : 0
  const hasDelay = deltaDays > 0

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 text-center flex flex-col gap-1">
        <p className="text-3xl font-bold tabular-nums" style={{ color: hasDelay ? '#ef4444' : '#22c55e' }}>
          {deltaDays > 0 ? `+${deltaDays}` : deltaDays}
        </p>
        <p className="text-xs font-semibold text-[#8fb3c8]">dias de atraso</p>
        <p className="text-[10px] text-[#5a8caa]">{hasDelay ? 'impacto no prazo' : 'no prazo'}</p>
      </div>
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 text-center flex flex-col gap-1">
        <p className="text-3xl font-bold tabular-nums" style={{ color: deltaCost > 0 ? '#f97316' : '#22c55e' }}>
          {deltaCost > 0 ? `+${fmtBRL(deltaCost)}` : fmtBRL(deltaCost)}
        </p>
        <p className="text-xs font-semibold text-[#8fb3c8]">impacto no custo</p>
        <p className="text-[10px] text-[#5a8caa]">{deltaCost > 0 ? 'custo adicional' : 'sem impacto'}</p>
      </div>
      <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 text-center flex flex-col gap-1">
        <p className="text-3xl font-bold tabular-nums" style={{ color: pctExtra > 0 ? '#eab308' : '#22c55e' }}>
          {pctExtra > 0 ? `+${pctExtra.toFixed(1)}%` : '0%'}
        </p>
        <p className="text-xs font-semibold text-[#8fb3c8]">custo adicional</p>
        <p className="text-[10px] text-[#5a8caa]">sobre o custo base</p>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface ScheduleSummary {
  endDate: string | null
  workDays: number
  totalCost: number
  ganttRows: GanttRow[]
  allDates: string[]
}

export function SimulacaoAtrasoPanel() {
  const [trechos, setTrechos] = useState<PlanTrecho[]>([])
  const [delays, setDelays]   = useState<TrechoDelay[]>([])
  const [base, setBase]       = useState<ScheduleSummary | null>(null)
  const [delayed, setDelayed] = useState<ScheduleSummary | null>(null)

  // Add delay form
  const [selCode, setSelCode]     = useState('')
  const [delayDays, setDelayDays] = useState(1)

  // Edit state
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [editDays, setEditDays]       = useState(1)

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => {
    import('@/store/planejamentoStore').then(({ usePlanejamentoStore }) => {
      const s = usePlanejamentoStore.getState()
      setTrechos(s.trechos)
    })
  }, [])

  const runSchedules = useCallback(() => {
    import('@/store/planejamentoStore').then(({ usePlanejamentoStore }) => {
      const s = usePlanejamentoStore.getState()
      if (s.trechos.length === 0 || s.teams.length === 0) return

      const baseResult    = generateSchedule(s.trechos, s.teams, s.productivityTable, s.scheduleConfig, s.holidays)
      const delayedResult = generateSchedule(s.trechos, s.teams, s.productivityTable, s.scheduleConfig, s.holidays, delays)

      const allSet   = new Set([...baseResult.workDays, ...delayedResult.workDays])
      const allDates = Array.from(allSet).sort()

      setBase({
        endDate:   baseResult.projectEndDate,
        workDays:  baseResult.workDays.length,
        totalCost: baseResult.totalCostBRL,
        ganttRows: baseResult.ganttRows,
        allDates,
      })
      setDelayed({
        endDate:   delayedResult.projectEndDate,
        workDays:  delayedResult.workDays.length,
        totalCost: delayedResult.totalCostBRL,
        ganttRows: delayedResult.ganttRows,
        allDates,
      })
    })
  }, [delays])

  useEffect(() => { runSchedules() }, [runSchedules])

  function addDelay() {
    if (!selCode || delayDays < 1) return
    setDelays((prev) => {
      const exists = prev.find((d) => d.trechoCode === selCode)
      if (exists) {
        return prev.map((d) => d.trechoCode === selCode
          ? { ...d, delayDays: d.delayDays + delayDays }
          : d)
      }
      return [...prev, { trechoCode: selCode, delayDays }]
    })
  }

  function saveEdit(code: string) {
    setDelays((prev) => prev.map((d) => d.trechoCode === code ? { ...d, delayDays: editDays } : d))
    setEditingCode(null)
  }

  function removeDelay(code: string) {
    setDelays((prev) => prev.filter((d) => d.trechoCode !== code))
    setConfirmDelete(null)
  }

  const deltaDays = base && delayed ? daysBetween(base.endDate, delayed.endDate) : 0
  const deltaCost = base && delayed ? delayed.totalCost - base.totalCost : 0

  return (
    <div className="flex flex-col gap-5">
      {/* Infographic */}
      <DelaySummaryInfographic deltaDays={deltaDays} deltaCost={deltaCost} baseCost={base?.totalCost ?? 0} />

      {/* Section A + B side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Section A — Configure Delays */}
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4 flex flex-col gap-3">
          <h3 className="text-[#e4f2f8] text-sm font-semibold flex items-center gap-2">
            <Clock size={14} className="text-[#2abfdc]" />
            Configurar Atrasos
          </h3>

          <div className="flex gap-2">
            <select
              value={selCode}
              onChange={(e) => setSelCode(e.target.value)}
              className="flex-1 bg-[#0d2040] border border-[#20406a] rounded-lg px-2 py-1.5 text-xs text-[#e4f2f8] focus:outline-none focus:border-[#2abfdc]/60"
            >
              <option value="">Selecionar trecho…</option>
              {trechos.map((t) => (
                <option key={t.id} value={t.code}>{t.code} — {t.description.slice(0, 30)}</option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={365}
              value={delayDays}
              onChange={(e) => setDelayDays(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-[#0d2040] border border-[#20406a] rounded-lg px-2 py-1.5 text-xs text-[#e4f2f8] text-center focus:outline-none focus:border-[#2abfdc]/60"
            />
            <button
              onClick={addDelay}
              disabled={!selCode}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[#2abfdc] hover:bg-[#1a9ab8] text-white text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={12} /> dias
            </button>
          </div>

          {delays.length === 0 ? (
            <p className="text-[#6b6b6b] text-xs text-center py-4">
              Nenhum atraso configurado.<br />Selecione um trecho e adicione dias.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {delays.map((d) => (
                <div key={d.trechoCode} className="bg-[#1a3662] rounded-lg px-3 py-2">
                  {editingCode === d.trechoCode ? (
                    // ─ Editing row
                    <div className="flex items-center gap-2">
                      <span className="text-[#e4f2f8] text-xs font-mono flex-1">{d.trechoCode}</span>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={editDays}
                        onChange={(e) => setEditDays(Math.max(1, Number(e.target.value)))}
                        className="w-16 bg-[#0d2040] border border-[#2abfdc]/60 rounded px-1.5 py-0.5 text-xs text-[#e4f2f8] text-center focus:outline-none"
                        autoFocus
                      />
                      <span className="text-[#5a8caa] text-xs">d</span>
                      <button
                        onClick={() => saveEdit(d.trechoCode)}
                        className="text-[#22c55e] hover:text-[#22c55e]/80 transition-colors"
                        title="Salvar"
                      >
                        <Check size={13} />
                      </button>
                      <button
                        onClick={() => setEditingCode(null)}
                        className="text-[#6b6b6b] hover:text-[#e4f2f8] transition-colors"
                        title="Cancelar"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    // ─ Normal row
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[#e4f2f8] text-xs font-mono">{d.trechoCode}</span>
                        <span className="ml-2 text-[#2abfdc] text-xs font-bold">+{d.delayDays}d</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setEditingCode(d.trechoCode); setEditDays(d.delayDays) }}
                          className="text-[#5a8caa] hover:text-[#2abfdc] transition-colors"
                          title="Editar"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(d.trechoCode)}
                          className="text-[#5a8caa] hover:text-[#ef4444] transition-colors"
                          title="Remover"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {delays.length > 0 && (
            <button
              onClick={() => setDelays([])}
              className="text-xs text-[#6b6b6b] hover:text-[#ef4444] transition-colors text-center"
            >
              Limpar todos os atrasos
            </button>
          )}
        </div>

        {/* Section B — Impact KPIs */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 content-start">
          <KpiCard
            icon={<CalendarDays size={14} className="text-[#38bdf8]" />}
            label="Data Original"
            value={fmtDate(base?.endDate ?? null)}
            accent="text-[#38bdf8]"
          />
          <KpiCard
            icon={<CalendarDays size={14} className={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Nova Data Final"
            value={fmtDate(delayed?.endDate ?? null)}
            accent={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
          <KpiCard
            icon={<AlertTriangle size={14} className={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Atraso Total"
            value={deltaDays > 0 ? `+${deltaDays} dias` : deltaDays === 0 ? 'Sem atraso' : `${deltaDays} dias`}
            accent={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
          <KpiCard
            icon={<DollarSign size={14} className={deltaCost > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Impacto no Custo"
            value={deltaCost > 0 ? `+${fmtBRL(deltaCost)}` : deltaCost === 0 ? 'Sem impacto' : fmtBRL(deltaCost)}
            accent={deltaCost > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
          <KpiCard
            icon={<DollarSign size={14} className="text-[#a78bfa]" />}
            label="Custo Base"
            value={fmtBRL(base?.totalCost ?? 0)}
            accent="text-[#a78bfa]"
          />
          <KpiCard
            icon={<DollarSign size={14} className="text-[#2abfdc]" />}
            label="Custo C/ Atrasos"
            value={fmtBRL(delayed?.totalCost ?? 0)}
            accent="text-[#2abfdc]"
          />
          <KpiCard
            icon={<Clock size={14} className="text-[#a3a3a3]" />}
            label="Dias Úteis Base"
            value={String(base?.workDays ?? 0)}
            accent="text-[#a3a3a3]"
          />
          <KpiCard
            icon={<Clock size={14} className={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'} />}
            label="Dias Úteis C/ Atrasos"
            value={String(delayed?.workDays ?? 0)}
            accent={deltaDays > 0 ? 'text-[#ef4444]' : 'text-[#22c55e]'}
          />
        </div>
      </div>

      {/* Cost Burn Chart */}
      {base && delayed && base.ganttRows.length > 0 && (
        <ImpactBurnChart base={base.ganttRows} delayed={delayed.ganttRows} />
      )}

      {/* Gantt Comparativo */}
      {base && delayed && base.ganttRows.length > 0 && (
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-4">
          <h3 className="text-[#e4f2f8] text-sm font-semibold mb-3 flex items-center gap-2">
            <CalendarDays size={14} className="text-[#2abfdc]" />
            Gantt Comparativo
            <span className="text-[#6b6b6b] text-xs font-normal">(primeiros 15 trechos)</span>
          </h3>
          <GanttComparison
            base={base.ganttRows}
            delayed={delayed.ganttRows}
            allDates={base.allDates}
          />
        </div>
      )}

      {trechos.length === 0 && (
        <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-8 text-center">
          <Clock size={32} className="text-[#6b6b6b] mx-auto mb-3" />
          <p className="text-[#6b6b6b] text-sm">
            Nenhum trecho encontrado no módulo Planejamento.
          </p>
          <p className="text-[#6b6b6b] text-xs mt-1">
            Acesse <span className="text-[#2abfdc]">/planejamento</span> e cadastre trechos para usar a simulação.
          </p>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete !== null && (() => {
        const d = delays.find((d) => d.trechoCode === confirmDelete)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-[#14294e] border border-[#20406a] rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
              <h4 className="text-[#e4f2f8] font-semibold mb-2">Confirmar Exclusão</h4>
              <p className="text-[#8fb3c8] text-sm mb-4">
                Remover o atraso de <span className="text-[#ef4444] font-bold">{d?.delayDays} dias</span> no trecho <span className="text-[#2abfdc] font-mono">{confirmDelete}</span>?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-lg border border-[#20406a] text-[#8fb3c8] text-sm hover:border-[#5a8caa] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => removeDelay(confirmDelete)}
                  className="px-4 py-2 rounded-lg bg-[#ef4444]/20 border border-[#ef4444]/40 text-[#ef4444] text-sm hover:bg-[#ef4444]/30 transition-colors"
                >
                  Confirmar exclusão
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─── KpiCard ─────────────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="bg-[#14294e] border border-[#20406a] rounded-xl px-3 py-3 flex items-center gap-2">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0 bg-[#1a3662]">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[#6b6b6b] text-[10px] truncate">{label}</p>
        <p className={`text-sm font-bold leading-tight truncate ${accent}`}>{value}</p>
      </div>
    </div>
  )
}
