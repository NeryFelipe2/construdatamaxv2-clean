/**
 * DashboardPanel — RDO dashboard with KPIs, charts, and trecho table.
 * All charts use inline SVG (no external library).
 */
import { useMemo, useState } from 'react'
import { useRdoStore } from '@/store/rdoStore'
import type { RdoTrechoStatus } from '@/types'

const STATUS_LABEL: Record<RdoTrechoStatus, string> = {
  not_started: 'Não Iniciado',
  in_progress: 'Em Execução',
  completed:   'Concluído',
}
const STATUS_COLOR: Record<RdoTrechoStatus, string> = {
  not_started: 'bg-red-900/40 text-red-300 border-red-700/50',
  in_progress: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  completed:   'bg-green-900/40 text-green-300 border-green-700/50',
}
const STATUS_SVG_COLOR: Record<RdoTrechoStatus, string> = {
  completed:   '#22c55e',
  in_progress: '#f59e0b',
  not_started: '#ef4444',
}

function KpiCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
      <div className="text-xs text-[#a3a3a3] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent ? 'text-[#f97316]' : 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-[#6b6b6b] mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Donut chart ──────────────────────────────────────────────────────────────

function DonutChart({ completed, inProgress, notStarted, total }: {
  completed: number; inProgress: number; notStarted: number; total: number
}) {
  const cx = 100, cy = 100, r = 70, strokeW = 28
  const circ = 2 * Math.PI * r

  const pctCompleted   = total > 0 ? completed   / total : 0
  const pctInProgress  = total > 0 ? inProgress  / total : 0
  const pctNotStarted  = total > 0 ? notStarted  / total : 0

  const dCompleted   = pctCompleted   * circ
  const dInProgress  = pctInProgress  * circ
  const dNotStarted  = pctNotStarted  * circ

  const offCompleted  = 0
  const offInProgress = circ - dCompleted
  const offNotStarted = circ - dCompleted - dInProgress

  return (
    <svg viewBox="0 0 200 200" className="w-40 h-40 mx-auto -rotate-90">
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth={strokeW} />
      ) : (
        <>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#374151" strokeWidth={strokeW} />
          {dNotStarted > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef4444" strokeWidth={strokeW}
              strokeDasharray={`${dNotStarted} ${circ}`} strokeDashoffset={-offNotStarted} />
          )}
          {dInProgress > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth={strokeW}
              strokeDasharray={`${dInProgress} ${circ}`} strokeDashoffset={-offInProgress} />
          )}
          {dCompleted > 0 && (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#22c55e" strokeWidth={strokeW}
              strokeDasharray={`${dCompleted} ${circ}`} strokeDashoffset={-offCompleted} />
          )}
        </>
      )}
    </svg>
  )
}

// ─── Line chart (cumulative advance) ─────────────────────────────────────────

function LineChart({ data }: { data: { date: string; meters: number }[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-40 text-[#6b6b6b] text-xs">
        Dados insuficientes para o gráfico.
      </div>
    )
  }
  const W = 400, H = 160
  const PAD = { l: 48, r: 16, t: 12, b: 28 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const maxM = Math.max(...data.map((d) => d.meters), 1)
  const n = data.length

  const pts = data
    .map((d, i) => {
      const x = PAD.l + (i / (n - 1)) * iw
      const y = PAD.t + ih - (d.meters / maxM) * ih
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = PAD.t + ih - pct * ih
        return (
          <g key={pct}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#374151" strokeWidth="1" strokeDasharray="4,4" />
            <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#6b7280">
              {(pct * maxM).toFixed(0)}
            </text>
          </g>
        )
      })}
      {data.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n / 2)).map((d) => {
        const i = data.indexOf(d)
        const x = PAD.l + (i / (n - 1)) * iw
        return (
          <text key={d.date} x={x} y={H - 6} textAnchor="middle" fontSize="8" fill="#6b7280">
            {d.date.slice(5)}
          </text>
        )
      })}
      <polyline points={pts} fill="none" stroke="#0ea5e9" strokeWidth="2" />
      {data.map((d, i) => {
        const x = PAD.l + (i / (n - 1)) * iw
        const y = PAD.t + ih - (d.meters / maxM) * ih
        return <circle key={d.date} cx={x} cy={y} r="3" fill="#0ea5e9" />
      })}
    </svg>
  )
}

// ─── DashboardPanel ───────────────────────────────────────────────────────────

export function DashboardPanel() {
  const { rdos } = useRdoStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  // Aggregate trechos across all RDOs (latest executedMeters per trechoCode)
  const trechoMap = useMemo(() => {
    const map = new Map<string, {
      code: string; desc: string; planned: number; executed: number; status: RdoTrechoStatus
    }>()
    for (const rdo of rdos) {
      for (const t of rdo.trechos) {
        const existing = map.get(t.trechoCode)
        if (!existing || t.executedMeters > (existing?.executed ?? 0)) {
          map.set(t.trechoCode, {
            code: t.trechoCode,
            desc: t.trechoDescription,
            planned: t.plannedMeters,
            executed: t.executedMeters,
            status: t.status,
          })
        }
      }
    }
    return map
  }, [rdos])

  const trechos = [...trechoMap.values()]

  const totalPlanned  = trechos.reduce((s, t) => s + t.planned, 0)
  const totalExecuted = trechos.reduce((s, t) => s + t.executed, 0)
  const progressPct   = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0
  const rdosToday     = rdos.filter((r) => r.date === today).length

  const counts = {
    completed:   trechos.filter((t) => t.status === 'completed').length,
    in_progress: trechos.filter((t) => t.status === 'in_progress').length,
    not_started: trechos.filter((t) => t.status === 'not_started').length,
  }

  // Cumulative advance by date
  const advanceData = useMemo(() => {
    const dateMap = new Map<string, number>()
    for (const rdo of rdos) {
      const prev = dateMap.get(rdo.date) ?? 0
      const dayExec = rdo.trechos.reduce((s, t) => s + t.executedMeters, 0)
      dateMap.set(rdo.date, Math.max(prev, dayExec))
    }
    const sorted = [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))
    let cum = 0
    return sorted.map(([date, m]) => { cum += m; return { date, meters: cum } })
  }, [rdos])

  // Services aggregated
  const serviceMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const rdo of rdos) {
      for (const s of rdo.services) {
        m.set(s.description, (m.get(s.description) ?? 0) + s.quantity)
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [rdos])
  const maxSvc = serviceMap[0]?.[1] ?? 1

  // Filter trechos table
  const filteredTrechos = trechos.filter((t) => {
    if (search && !t.code.toLowerCase().includes(search.toLowerCase()) &&
        !t.desc.toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter && t.status !== statusFilter) return false
    return true
  })

  return (
    <div className="p-6 space-y-6">
      {/* Row 1 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total de RDOs"    value={String(rdos.length)} />
        <KpiCard label="Progresso Geral"  value={`${progressPct.toFixed(1)}%`} accent />
        <KpiCard label="Metros Executados" value={`${totalExecuted.toFixed(2)} m`} accent />
        <KpiCard label="RDOs Hoje"        value={String(rdosToday)} />
      </div>

      {/* Row 2 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Planejado"  value={`${totalPlanned.toFixed(2)} m`}   sub="Extensão total da rede" />
        <KpiCard label="Total Executado"  value={`${totalExecuted.toFixed(2)} m`}  sub="Extensão já executada" accent />
        <KpiCard label="Restante"         value={`${(totalPlanned - totalExecuted).toFixed(2)} m`} sub="A ser executado" />
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
          <div className="text-xs text-[#a3a3a3] mb-1">Progresso</div>
          <div className="text-xl font-bold text-violet-400">{progressPct.toFixed(1)}%</div>
          <div className="mt-2 h-2 bg-[#484848] rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, progressPct)}%` }} />
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Line chart */}
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-white font-medium text-sm">Avanço Diário (Acumulado)</span>
          </div>
          <LineChart data={advanceData} />
        </div>

        {/* Donut */}
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
          <div className="text-white font-medium text-sm mb-3">Status dos Trechos</div>
          <div className="flex items-center gap-6">
            <DonutChart
              completed={counts.completed}
              inProgress={counts.in_progress}
              notStarted={counts.not_started}
              total={trechos.length}
            />
            <div className="space-y-2 text-sm">
              {(['completed', 'in_progress', 'not_started'] as RdoTrechoStatus[]).map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: STATUS_SVG_COLOR[s] }} />
                  <span className="text-[#f5f5f5]">{STATUS_LABEL[s]}: <strong className="text-white">{counts[s]}</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Serviços mais executados */}
      {serviceMap.length > 0 && (
        <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
          <div className="text-white font-medium text-sm mb-3">Serviços Mais Executados</div>
          <div className="space-y-2">
            {serviceMap.map(([name, qty]) => (
              <div key={name} className="flex items-center gap-3">
                <div className="text-[#f5f5f5] text-xs w-48 truncate shrink-0">{name}</div>
                <div className="flex-1 h-2 bg-[#484848] rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500 rounded-full" style={{ width: `${(qty / maxSvc) * 100}%` }} />
                </div>
                <div className="text-[#a3a3a3] text-xs w-16 text-right shrink-0">{qty.toFixed(0)} m</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progresso por Sistema */}
      {(() => {
        const SYSTEMS = [
          { key: 'agua',         label: 'Água',         color: '#38bdf8' },
          { key: 'esgoto',       label: 'Esgoto',       color: '#f97316' },
          { key: 'drenagem',     label: 'Drenagem',     color: '#4ade80' },
          { key: 'estrutura',    label: 'Estrutura',    color: '#a78bfa' },
          { key: 'pavimentacao', label: 'Pavimentação', color: '#fb923c' },
          { key: 'outro',        label: 'Outro',        color: '#94a3b8' },
        ]
        const allTrechos = rdos.flatMap((r) => r.trechos)
        const sysData = SYSTEMS.map((s) => {
          const entries = allTrechos.filter((t) => (t.system ?? 'outro') === s.key)
          const planned  = entries.reduce((acc, t) => acc + t.plannedMeters, 0)
          const executed = entries.reduce((acc, t) => acc + t.executedMeters, 0)
          return { ...s, planned, executed, pct: planned > 0 ? Math.min(100, (executed / planned) * 100) : 0 }
        }).filter((s) => s.planned > 0 || s.executed > 0)

        if (sysData.length === 0) return null
        return (
          <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-4">
            <h3 className="text-white text-sm font-semibold mb-3">Progresso por Sistema</h3>
            <div className="flex flex-col gap-2">
              {sysData.map((s) => (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="text-xs text-[#6b6b6b] w-24 shrink-0">{s.label}</span>
                  <div className="flex-1 h-4 bg-[#484848] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                  </div>
                  <span className="text-xs text-[#f5f5f5] w-36 text-right shrink-0">
                    {s.executed.toFixed(0)}m / {s.planned.toFixed(0)}m ({s.pct.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Detalhamento por Trecho */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252] flex-wrap gap-3">
          <span className="text-white font-medium text-sm">Detalhamento por Trecho</span>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Buscar trecho…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-[#484848] border border-[#5e5e5e] rounded px-3 py-1.5 text-xs text-white placeholder-[#6b6b6b] focus:outline-none focus:border-[#f97316]/50"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#484848] border border-[#5e5e5e] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#f97316]/50"
            >
              <option value="">Todos os Status</option>
              <option value="completed">Concluído</option>
              <option value="in_progress">Em Execução</option>
              <option value="not_started">Não Iniciado</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[#525252]">
              <tr>
                {['Trecho', 'Planejado (m)', 'Executado (m)', 'Progresso', 'Status'].map((h) => (
                  <th key={h} className="text-left text-[#a3a3a3] px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3d3d3d]">
              {filteredTrechos.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-[#6b6b6b] text-xs">Nenhum trecho encontrado.</td></tr>
              )}
              {filteredTrechos.map((t) => {
                const pct = t.planned > 0 ? (t.executed / t.planned) * 100 : 0
                return (
                  <tr key={t.code} className="hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-[#f5f5f5] font-medium">{t.code}</div>
                      <div className="text-[#6b6b6b] text-xs truncate max-w-[200px]">{t.desc}</div>
                    </td>
                    <td className="px-4 py-3 text-[#f5f5f5]">{t.planned.toFixed(2)}</td>
                    <td className="px-4 py-3 text-[#f97316] font-medium">{t.executed.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-[#484848] rounded-full overflow-hidden min-w-[60px]">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${Math.min(100, pct)}%`, backgroundColor: STATUS_SVG_COLOR[t.status] }} />
                        </div>
                        <span className="text-xs text-[#a3a3a3] w-10 text-right">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLOR[t.status]}`}>
                        {STATUS_LABEL[t.status].toUpperCase()}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
