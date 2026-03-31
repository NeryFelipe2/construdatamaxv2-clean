/**
 * MapaAnalyticsPanel — Collapsible 3D/4D/5D analysis panel for Mapa Interativo.
 * Tab 3D: SVG elevation profile. Tab 4D: execution timeline. Tab 5D: cost breakdown.
 */
import { useState, useEffect } from 'react'
import { BarChart2, TrendingUp, CalendarDays, DollarSign } from 'lucide-react'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'
import type { MapNode, MapSegment, MapNetworkType } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function haversineM(a: MapNode, b: MapNode): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2
    + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(1)}k`
  return `R$ ${n.toFixed(0)}`
}

const NETWORK_COST_PER_M: Record<MapNetworkType, number> = {
  sewer:    350,
  water:    280,
  drainage: 320,
  civil:    180,
  generic:  200,
}

const NETWORK_COLOR: Record<MapNetworkType, string> = {
  sewer:    '#2abfdc',
  water:    '#38bdf8',
  drainage: '#a78bfa',
  civil:    '#22c55e',
  generic:  '#6b7280',
}

const NETWORK_LABEL: Record<MapNetworkType, string> = {
  sewer:    'Esgoto',
  water:    'Água',
  drainage: 'Drenagem',
  civil:    'Civil',
  generic:  'Genérico',
}

// ─── Tab 3D — Elevation Profile ───────────────────────────────────────────────

function Tab3D({ nodes, segments }: { nodes: MapNode[]; segments: MapSegment[] }) {
  // Build ordered path: follow segments sequentially or just use all nodes with elevation
  const elevNodes = nodes.filter((n) => n.elevation !== undefined)
  if (elevNodes.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#6b6b6b]">
        <TrendingUp size={28} className="text-[#3f3f3f]" />
        <p className="text-xs">Nenhum dado de elevação disponível.</p>
        <p className="text-[10px]">Importe um arquivo .txt com coluna de elevação para ver o perfil.</p>
      </div>
    )
  }

  // Build a path by chaining segments; fall back to elevNodes order if no chains
  const ordered: MapNode[] = []
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const visited = new Set<string>()

  // Find start nodes (appear as fromNodeId but not as toNodeId in any segment)
  const toIds = new Set(segments.map((s) => s.toNodeId))
  const starts = segments.filter((s) => !toIds.has(s.fromNodeId)).map((s) => s.fromNodeId)
  const startId = starts[0] ?? segments[0]?.fromNodeId

  if (startId) {
    let cur = startId
    while (cur && !visited.has(cur)) {
      visited.add(cur)
      const n = nodeMap.get(cur)
      if (n) ordered.push(n)
      const next = segments.find((s) => s.fromNodeId === cur && !visited.has(s.toNodeId))
      cur = next?.toNodeId ?? ''
    }
  }

  const path = ordered.length >= 2 ? ordered : elevNodes

  // Compute cumulative distances
  let cumDist = 0
  const points: { dist: number; elev: number; label: string }[] = []
  for (let i = 0; i < path.length; i++) {
    if (i > 0) cumDist += haversineM(path[i - 1], path[i])
    if (path[i].elevation !== undefined) {
      points.push({ dist: cumDist, elev: path[i].elevation!, label: path[i].label ?? `P${i + 1}` })
    }
  }

  if (points.length < 2) return null

  const W = 560, H = 140
  const PAD = { t: 16, r: 16, b: 40, l: 52 }
  const iW = W - PAD.l - PAD.r
  const iH = H - PAD.t - PAD.b

  const maxDist = points[points.length - 1].dist
  const elevs = points.map((p) => p.elev)
  const minE = Math.min(...elevs)
  const maxE = Math.max(...elevs)
  const rangeE = maxE - minE || 1
  const avgE = elevs.reduce((a, b) => a + b, 0) / elevs.length

  function xOf(d: number) { return PAD.l + (d / maxDist) * iW }
  function yOf(e: number) { return PAD.t + iH - ((e - minE) / rangeE) * iH }

  const polyline = points.map((p) => `${xOf(p.dist)},${yOf(p.elev)}`).join(' ')
  const area = `${xOf(0)},${PAD.t + iH} ${polyline} ${xOf(maxDist)},${PAD.t + iH}`

  // Y axis labels
  const yTicks = [minE, (minE + maxE) / 2, maxE]

  return (
    <div className="flex flex-col gap-3">
      {/* KPI row */}
      <div className="flex gap-4 px-4 pt-3">
        {[
          { label: 'Elevação Mín.', value: `${minE.toFixed(2)} m`, color: 'text-[#38bdf8]' },
          { label: 'Elevação Máx.', value: `${maxE.toFixed(2)} m`, color: 'text-[#2abfdc]' },
          { label: 'Elevação Média', value: `${avgE.toFixed(2)} m`, color: 'text-[#a3a3a3]' },
          { label: 'Comprimento Total', value: `${(maxDist / 1000).toFixed(3)} km`, color: 'text-[#22c55e]' },
        ].map((k) => (
          <div key={k.label} className="flex flex-col">
            <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">{k.label}</span>
            <span className={`text-sm font-bold font-mono ${k.color}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* SVG chart */}
      <div className="overflow-x-auto px-4 pb-3">
        <svg width={W} height={H} className="font-mono">
          <defs>
            <linearGradient id="elev-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2abfdc" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#2abfdc" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((e, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={yOf(e)} x2={PAD.l + iW} y2={yOf(e)} stroke="#20406a" strokeWidth={1} />
              <text x={PAD.l - 4} y={yOf(e) + 4} fill="#6b6b6b" fontSize={9} textAnchor="end">{e.toFixed(1)}</text>
            </g>
          ))}

          {/* Axes */}
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + iH} stroke="#3f3f3f" strokeWidth={1} />
          <line x1={PAD.l} y1={PAD.t + iH} x2={PAD.l + iW} y2={PAD.t + iH} stroke="#3f3f3f" strokeWidth={1} />

          {/* Area fill */}
          <polygon points={area} fill="url(#elev-grad)" />

          {/* Elevation line */}
          <polyline points={polyline} fill="none" stroke="#2abfdc" strokeWidth={2} strokeLinejoin="round" />

          {/* Points */}
          {points.map((p, i) => (
            <circle key={i} cx={xOf(p.dist)} cy={yOf(p.elev)} r={2.5} fill="#2abfdc" />
          ))}

          {/* X axis: distance labels (every ~5 points max) */}
          {points.filter((_, i) => i % Math.max(1, Math.floor(points.length / 5)) === 0).map((p, i) => (
            <text key={i} x={xOf(p.dist)} y={H - 8} fill="#6b6b6b" fontSize={9} textAnchor="middle">
              {(p.dist / 1000).toFixed(2)}km
            </text>
          ))}

          {/* Y axis label */}
          <text x={10} y={H / 2} fill="#6b6b6b" fontSize={9} textAnchor="middle"
            transform={`rotate(-90, 10, ${H / 2})`}>Elev. (m)</text>
        </svg>
      </div>
    </div>
  )
}

// ─── Tab 4D — Execution Timeline ──────────────────────────────────────────────

interface GanttRowLite { code: string; startDate: string; endDate: string }

function Tab4D({ segments }: { segments: MapSegment[] }) {
  const [rows, setRows] = useState<GanttRowLite[]>([])

  useEffect(() => {
    import('@/store/planejamentoStore').then(({ usePlanejamentoStore }) => {
      const s = usePlanejamentoStore.getState()
      const result: GanttRowLite[] = []
      s.trechos.forEach((t) => {
        const match = segments.find((seg) => seg.label === t.code)
        if (!match) return
        // find scheduled row from cached ganttRows if available
        const row = (s as unknown as Record<string, unknown>).lastGanttRows as GanttRowLite[] | undefined
        const ganttRow = row?.find((r) => r.code === t.code)
        if (ganttRow) result.push(ganttRow)
      })
      // If no cached rows, generate schedule lazily
      if (result.length === 0 && s.trechos.length > 0 && s.teams.length > 0) {
        import('@/features/planejamento/utils/scheduleEngine').then(({ generateSchedule }) => {
          const sched = generateSchedule(s.trechos, s.teams, s.productivityTable, s.scheduleConfig, s.holidays)
          const mapped = sched.ganttRows.map((r) => ({
            code: r.trecho.code,
            startDate: r.startDate,
            endDate: r.endDate,
          }))
          const filtered = mapped.filter((r) => segments.some((seg) => seg.label === r.code))
          setRows(filtered.length > 0 ? filtered : mapped.slice(0, 20))
        })
      } else {
        setRows(result)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.length])

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#6b6b6b]">
        <CalendarDays size={28} className="text-[#3f3f3f]" />
        <p className="text-xs">Nenhum dado de cronograma correspondente.</p>
        <p className="text-[10px]">Os segmentos do mapa precisam ter labels correspondentes aos trechos do módulo Planejamento.</p>
      </div>
    )
  }

  const allDates = rows.flatMap((r) => [r.startDate, r.endDate]).sort()
  const minDate = allDates[0]
  const maxDate = allDates[allDates.length - 1]
  const totalMs = new Date(maxDate).getTime() - new Date(minDate).getTime() || 1

  const W = 520, ROW_H = 24, PAD_L = 80

  function xOf(d: string) {
    return PAD_L + ((new Date(d).getTime() - new Date(minDate).getTime()) / totalMs) * (W - PAD_L - 16)
  }

  return (
    <div className="overflow-x-auto px-4 py-3">
      <p className="text-[10px] text-[#6b6b6b] mb-2">
        {rows.length} trechos com cronograma correspondente · {minDate} → {maxDate}
      </p>
      <svg width={W} height={rows.length * ROW_H + 20} className="font-mono">
        {rows.map((r, i) => {
          const x1 = xOf(r.startDate)
          const x2 = xOf(r.endDate)
          const bw = Math.max(4, x2 - x1)
          const y = i * ROW_H + 10
          const label = r.code.length > 8 ? r.code.slice(0, 8) + '…' : r.code
          return (
            <g key={r.code}>
              <text x={0} y={y + 10} fill="#9ca3af" fontSize={10}>{label}</text>
              <rect x={x1} y={y} width={bw} height={14} rx={3} fill="#2abfdc" opacity={0.75} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Tab 5D — Cost Breakdown ───────────────────────────────────────────────────

function Tab5D({ nodes, segments }: { nodes: MapNode[]; segments: MapSegment[] }) {
  if (segments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-[#6b6b6b]">
        <DollarSign size={28} className="text-[#3f3f3f]" />
        <p className="text-xs">Nenhum segmento encontrado para análise de custos.</p>
      </div>
    )
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  // Cost per network type
  const costByType: Record<string, { type: MapNetworkType; totalM: number; totalCost: number; count: number }> = {}
  let grandTotal = 0

  segments.forEach((seg) => {
    const from = nodeMap.get(seg.fromNodeId)
    const to = nodeMap.get(seg.toNodeId)
    if (!from || !to) return
    const dist = haversineM(from, to)
    const costPerM = NETWORK_COST_PER_M[seg.networkType] ?? 200
    const cost = dist * costPerM
    grandTotal += cost
    if (!costByType[seg.networkType]) {
      costByType[seg.networkType] = { type: seg.networkType, totalM: 0, totalCost: 0, count: 0 }
    }
    costByType[seg.networkType].totalM += dist
    costByType[seg.networkType].totalCost += cost
    costByType[seg.networkType].count += 1
  })

  const types = Object.values(costByType).sort((a, b) => b.totalCost - a.totalCost)
  const maxCost = types[0]?.totalCost ?? 1

  const W = 500, BAR_H = 22, PAD_L = 90

  return (
    <div className="flex flex-col gap-4 px-4 py-3">
      {/* Grand total KPI */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Custo Total Estimado</span>
          <span className="text-xl font-bold font-mono text-[#2abfdc]">{fmtBRL(grandTotal)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Custo Médio/metro</span>
          <span className="text-xl font-bold font-mono text-[#a3a3a3]">
            {fmtBRL(grandTotal / (types.reduce((s, t) => s + t.totalM, 0) || 1))}/m
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-widest text-[#6b6b6b]">Ext. Total</span>
          <span className="text-xl font-bold font-mono text-[#22c55e]">
            {(types.reduce((s, t) => s + t.totalM, 0) / 1000).toFixed(3)} km
          </span>
        </div>
      </div>

      {/* Bar chart per type */}
      <svg width={W} height={types.length * (BAR_H + 6) + 10} className="font-mono">
        {types.map((t, i) => {
          const bw = Math.max(4, (t.totalCost / maxCost) * (W - PAD_L - 100))
          const y = i * (BAR_H + 6)
          const color = NETWORK_COLOR[t.type]
          return (
            <g key={t.type}>
              <text x={0} y={y + 15} fill="#9ca3af" fontSize={10}>{NETWORK_LABEL[t.type]}</text>
              <rect x={PAD_L} y={y + 2} width={bw} height={BAR_H - 4} rx={3} fill={color} opacity={0.75} />
              <text x={PAD_L + bw + 6} y={y + 15} fill={color} fontSize={10} fontWeight="bold">
                {fmtBRL(t.totalCost)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Detail table */}
      <div className="rounded-xl border border-[#20406a] overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#0d2040] border-b border-[#20406a]">
              {['Tipo de Rede', 'Trechos', 'Extensão', 'R$/m', 'Custo Est.'].map((h) => (
                <th key={h} className="text-left px-3 py-2 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((t, i) => (
              <tr key={t.type} className={i < types.length - 1 ? 'border-b border-[#14294e]' : ''}>
                <td className="px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: NETWORK_COLOR[t.type] }} />
                    <span style={{ color: NETWORK_COLOR[t.type] }} className="font-medium">{NETWORK_LABEL[t.type]}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5 font-mono text-[#a3a3a3]">{t.count}</td>
                <td className="px-3 py-2.5 font-mono text-[#a3a3a3]">{(t.totalM / 1000).toFixed(3)} km</td>
                <td className="px-3 py-2.5 font-mono text-[#a3a3a3]">R$ {NETWORK_COST_PER_M[t.type]}/m</td>
                <td className="px-3 py-2.5 font-mono text-[#2abfdc] font-semibold">{fmtBRL(t.totalCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type AnalyticsTab = '3D' | '4D' | '5D'

export function MapaAnalyticsPanel() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('3D')
  const nodes    = useMapaInterativoStore((s) => s.nodes)
  const segments = useMapaInterativoStore((s) => s.segments)

  const tabs: { id: AnalyticsTab; label: string; icon: React.ReactNode }[] = [
    { id: '3D', label: 'Perfil 3D', icon: <TrendingUp size={12} /> },
    { id: '4D', label: 'Execução 4D', icon: <CalendarDays size={12} /> },
    { id: '5D', label: 'Custo 5D', icon: <DollarSign size={12} /> },
  ]

  return (
    <div className="border-t border-[#20406a] bg-[#0d2040]" style={{ maxHeight: 320, overflowY: 'auto' }}>
      {/* Tab bar */}
      <div className="flex items-center gap-0 px-4 pt-2 border-b border-[#20406a] bg-[#081321]">
        <BarChart2 size={12} className="text-[#2abfdc] mr-3" />
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'text-[#2abfdc] border-[#2abfdc]'
                : 'text-[#6b6b6b] border-transparent hover:text-[#a3a3a3]'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === '3D' && <Tab3D nodes={nodes} segments={segments} />}
      {activeTab === '4D' && <Tab4D segments={segments} />}
      {activeTab === '5D' && <Tab5D nodes={nodes} segments={segments} />}
    </div>
  )
}
