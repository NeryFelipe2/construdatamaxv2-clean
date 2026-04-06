/**
 * IntegracaoPanel — 3 sub-tabs integrating RDO data with Planejamento.
 * Sub-tabs: Dashboard Integrado | Curva S Comparativa | Análise de Atrasos
 */
import { useState, useEffect } from 'react'
import { useRdoStore } from '@/store/rdoStore'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import type { RdoTrechoEntry } from '@/types'
import { RefreshCw } from 'lucide-react'

// ─── Types for planejamento cross-read ────────────────────────────────────────

interface PlanTrechoLite {
  id:          string
  code:        string
  name:        string
  totalMeters: number
  startDate?:  string
  endDate?:    string
}

interface SCurvePt { date: string; pvPct: number; evPct: number; acBRL: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

type SubTab = 'dashboard' | 'scurve' | 'delays'

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard Integrado' },
  { key: 'scurve',    label: 'Curva S Comparativa' },
  { key: 'delays',    label: 'Análise de Atrasos' },
]

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color = 'sky' }: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  const colorMap: Record<string, string> = {
    sky:     'text-[#f97316]',
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    rose:    'text-rose-400',
    violet:  'text-violet-400',
  }
  return (
    <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? 'text-[#f97316]'}`}>{value}</p>
      {sub && <p className="text-[#6b6b6b] text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Dashboard Integrado ──────────────────────────────────────────────────────

function DashboardIntegrado({
  rdoTrechos,
  planTrechos,
  rdoCount,
  totalWorkDays,
  elapsedWorkDays,
}: {
  rdoTrechos:      RdoTrechoEntry[]
  planTrechos:     PlanTrechoLite[]
  rdoCount:        number
  totalWorkDays:   number
  elapsedWorkDays: number
}) {
  const totalPlanned = planTrechos.reduce((s, t) => s + t.totalMeters, 0)
  const totalExecuted = rdoTrechos.reduce((s, t) => s + t.executedMeters, 0)
  const progressPct = totalPlanned > 0 ? (totalExecuted / totalPlanned) * 100 : 0

  // Merge trechos: plan as base, overlay executed from RDOs
  const merged: {
    code: string; name: string; planned: number; executed: number; source: string
  }[] = planTrechos.map((pt) => {
    const rdoMatch = rdoTrechos.find((r) => r.trechoCode === pt.code)
    return {
      code:     pt.code,
      name:     pt.name,
      planned:  pt.totalMeters,
      executed: rdoMatch?.executedMeters ?? 0,
      source:   rdoMatch ? 'RDO' : 'Manual',
    }
  })

  // Add any RDO-only trechos not in plan
  rdoTrechos.forEach((r) => {
    if (!planTrechos.find((p) => p.code === r.trechoCode)) {
      merged.push({ code: r.trechoCode, name: r.trechoDescription, planned: r.plannedMeters, executed: r.executedMeters, source: 'RDO' })
    }
  })

  const daysPlanned = totalWorkDays
  const delayDays = elapsedWorkDays > 0 && progressPct < (elapsedWorkDays / Math.max(totalWorkDays, 1)) * 100
    ? Math.round(elapsedWorkDays - (progressPct / 100) * totalWorkDays)
    : 0

  return (
    <div className="space-y-5">
      {/* Row 1 KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Planejado (m)" value={totalPlanned.toFixed(0)} color="sky" />
        <KpiCard label="Executado (m)" value={totalExecuted.toFixed(0)} color="emerald" />
        <KpiCard label="Progresso" value={`${progressPct.toFixed(1)}%`} color="violet" />
        <KpiCard
          label="Prod. Média"
          value={rdoCount > 0 ? `${(totalExecuted / rdoCount).toFixed(1)} m/dia` : '—'}
          color="amber"
        />
      </div>
      {/* Row 2 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard label="Dias Planejados" value={daysPlanned || '—'} color="sky" />
        <KpiCard label="RDOs Preenchidos" value={rdoCount} color="emerald" />
        <KpiCard
          label="Atraso Estimado"
          value={delayDays > 0 ? `${delayDays} dias` : 'No prazo'}
          color={delayDays > 0 ? 'rose' : 'emerald'}
        />
      </div>

      {/* Trecho table */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
        <div className="px-5 py-3 border-b border-[#525252]">
          <h3 className="text-[#f5f5f5] font-medium text-sm">Detalhamento por Trecho</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#6b6b6b] text-xs border-b border-[#525252]">
                <th className="text-left px-5 py-2.5 font-medium">Trecho</th>
                <th className="text-right px-3 py-2.5 font-medium">Planejado (m)</th>
                <th className="text-right px-3 py-2.5 font-medium">Executado (m)</th>
                <th className="text-center px-3 py-2.5 font-medium">Fonte</th>
                <th className="px-5 py-2.5 font-medium">Progresso</th>
                <th className="text-center px-3 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {merged.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-[#6b6b6b] py-8 px-5">
                    Nenhum trecho disponível. Crie RDOs com trechos ou carregue o planejamento.
                  </td>
                </tr>
              )}
              {merged.map((row, i) => {
                const pct = row.planned > 0 ? Math.min((row.executed / row.planned) * 100, 100) : 0
                const status = row.executed === 0 ? 'not_started' : pct >= 100 ? 'completed' : 'in_progress'
                return (
                  <tr key={i} className="border-b border-[#525252]/50 hover:bg-gray-750/30">
                    <td className="px-5 py-3">
                      <p className="text-[#f5f5f5] font-mono text-xs">{row.code}</p>
                      <p className="text-[#6b6b6b] text-xs">{row.name}</p>
                    </td>
                    <td className="px-3 py-3 text-right text-[#f5f5f5]">{row.planned.toFixed(1)}</td>
                    <td className="px-3 py-3 text-right text-[#f5f5f5]">{row.executed.toFixed(1)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs bg-sky-900/40 text-[#ea580c]">{row.source}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#484848] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[#a3a3a3] text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {status === 'completed'   ? <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/50 text-emerald-300">Concluído</span>
                       : status === 'in_progress' ? <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-900/50 text-yellow-300">Em Execução</span>
                       : <span className="px-2 py-0.5 rounded-full text-xs bg-[#484848] text-[#a3a3a3]">Não Iniciado</span>}
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

// ─── Curva S Comparativa ──────────────────────────────────────────────────────

function CurvaSComparativa({
  points,
  budgetBRL,
}: {
  points: SCurvePt[]
  budgetBRL: number
}) {
  const [mode, setMode] = useState<'financial' | 'physical' | 'both'>('both')
  const W = 700, H = 300, PL = 60, PR = 20, PT = 20, PB = 40

  if (points.length < 2) {
    return (
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] p-8 text-center text-[#6b6b6b]">
        Dados insuficientes para gerar a curva. Adicione lançamentos financeiros e trechos ao planejamento.
      </div>
    )
  }

  const maxAC = Math.max(...points.map((p) => p.acBRL), budgetBRL)

  function xOf(i: number) { return PL + (i / (points.length - 1)) * (W - PL - PR) }
  function yOfPct(pct: number) { return PT + (1 - pct / 100) * (H - PT - PB) }
  function yOfBRL(brl: number) { return PT + (1 - brl / maxAC) * (H - PT - PB) }

  const pvPts  = points.map((p, i) => `${xOf(i).toFixed(1)},${yOfPct(p.pvPct).toFixed(1)}`).join(' ')
  const evPts  = points.map((p, i) => `${xOf(i).toFixed(1)},${yOfPct(p.evPct).toFixed(1)}`).join(' ')
  const acPts  = points.map((p, i) => `${xOf(i).toFixed(1)},${yOfBRL(p.acBRL).toFixed(1)}`).join(' ')

  // Month ticks
  const ticks: { x: number; label: string }[] = []
  let lastMonth = ''
  points.forEach((p, i) => {
    const m = p.date.slice(0, 7)
    if (m !== lastMonth) {
      lastMonth = m
      const [y, mo] = m.split('-')
      ticks.push({ x: xOf(i), label: `${mo}/${y.slice(2)}` })
    }
  })

  return (
    <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
      <div className="px-5 py-3 border-b border-[#525252] flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-[#f5f5f5] font-medium text-sm">Curva S Comparativa</h3>
        <div className="flex items-center gap-1">
          {(['financial', 'physical', 'both'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                mode === m ? 'bg-sky-600 text-white' : 'bg-[#484848] text-[#f5f5f5] hover:bg-[#525252]'
              }`}
            >
              {m === 'financial' ? 'Financeiro' : m === 'physical' ? 'Físico (%)' : 'Ambos'}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 320 }}>
          {/* Y-axis ticks */}
          {[0, 25, 50, 75, 100].map((pct) => {
            const y = yOfPct(pct)
            return (
              <g key={pct}>
                <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#374151" strokeWidth="1" />
                <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">{pct}%</text>
              </g>
            )
          })}

          {/* X-axis ticks */}
          {ticks.map((t) => (
            <g key={t.label}>
              <line x1={t.x} y1={PT} x2={t.x} y2={H - PB} stroke="#374151" strokeWidth="1" strokeDasharray="3 3" />
              <text x={t.x} y={H - PB + 14} textAnchor="middle" fontSize="9" fill="#9CA3AF">{t.label}</text>
            </g>
          ))}

          {/* Lines */}
          {(mode === 'physical' || mode === 'both') && (
            <polyline points={pvPts} fill="none" stroke="#3b82f6" strokeWidth="2" />
          )}
          {(mode === 'physical' || mode === 'both') && (
            <polyline points={evPts} fill="none" stroke="#10b981" strokeWidth="2" />
          )}
          {(mode === 'financial' || mode === 'both') && (
            <polyline points={acPts} fill="none" stroke="#f43f5e" strokeWidth="2" strokeDasharray="5 3" />
          )}
        </svg>

        {/* Legend */}
        <div className="flex items-center gap-5 justify-center mt-2 flex-wrap">
          {(mode === 'physical' || mode === 'both') && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 bg-blue-500" />
                <span className="text-[#a3a3a3] text-xs">PV (Planejado)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 bg-emerald-500" />
                <span className="text-[#a3a3a3] text-xs">EV (Valor Agregado)</span>
              </div>
            </>
          )}
          {(mode === 'financial' || mode === 'both') && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-rose-500" style={{ borderTop: '2px dashed #f43f5e', background: 'none' }} />
              <span className="text-[#a3a3a3] text-xs">AC (Custo Real)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Análise de Atrasos ───────────────────────────────────────────────────────

function AnaliseAtrasos({
  rdoTrechos,
  planTrechos,
}: {
  rdoTrechos: RdoTrechoEntry[]
  planTrechos: PlanTrechoLite[]
}) {
  interface DelayRow {
    code: string
    name: string
    plannedStart: string
    plannedEnd:   string
    delayDays:    number
    status:       'on_time' | 'minor' | 'late'
  }

  const rows: DelayRow[] = planTrechos
    .filter((pt) => pt.startDate && pt.endDate)
    .map((pt) => {
      const rdoMatch = rdoTrechos.find((r) => r.trechoCode === pt.code)
      const today = new Date().toISOString().slice(0, 10)
      const plannedEnd = pt.endDate!
      let delayDays = 0

      if (rdoMatch && rdoMatch.status !== 'completed' && today > plannedEnd) {
        const diff = (new Date(today).getTime() - new Date(plannedEnd).getTime()) / (1000 * 60 * 60 * 24)
        delayDays = Math.round(diff)
      }

      return {
        code:         pt.code,
        name:         pt.name,
        plannedStart: pt.startDate!,
        plannedEnd,
        delayDays,
        status: delayDays === 0 ? 'on_time' : delayDays <= 5 ? 'minor' : 'late',
      }
    })

  const totalDelayDays = rows.reduce((s, r) => s + r.delayDays, 0)
  const lateCount = rows.filter((r) => r.status !== 'on_time').length

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Trechos em Atraso</p>
          <p className={`text-2xl font-bold ${lateCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{lateCount}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Dias de Atraso Acumulado</p>
          <p className={`text-2xl font-bold ${totalDelayDays > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{totalDelayDays}</p>
        </div>
        <div className="bg-[#3d3d3d] rounded-xl p-4 border border-[#525252]">
          <p className="text-[#a3a3a3] text-xs mb-1">Trechos Monitorados</p>
          <p className="text-2xl font-bold text-[#f97316]">{rows.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#3d3d3d] rounded-xl border border-[#525252] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#6b6b6b] text-xs border-b border-[#525252]">
                <th className="text-left px-5 py-2.5 font-medium">Trecho</th>
                <th className="text-center px-3 py-2.5 font-medium">Início Plan.</th>
                <th className="text-center px-3 py-2.5 font-medium">Término Plan.</th>
                <th className="text-center px-3 py-2.5 font-medium">Dias de Atraso</th>
                <th className="text-center px-3 py-2.5 font-medium">Situação</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-[#6b6b6b] py-10 px-5">
                    Nenhum trecho com datas de planejamento disponíveis.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-[#525252]/50 ${
                    row.status === 'late'    ? 'bg-red-950/20'    :
                    row.status === 'minor'   ? 'bg-yellow-950/20' :
                                               ''
                  }`}
                >
                  <td className="px-5 py-3">
                    <p className="text-[#f5f5f5] font-mono text-xs">{row.code}</p>
                    <p className="text-[#6b6b6b] text-xs">{row.name}</p>
                  </td>
                  <td className="px-3 py-3 text-center text-[#f5f5f5]">{fmtDate(row.plannedStart)}</td>
                  <td className="px-3 py-3 text-center text-[#f5f5f5]">{fmtDate(row.plannedEnd)}</td>
                  <td className="px-3 py-3 text-center">
                    <span className={`text-sm font-medium ${
                      row.delayDays === 0 ? 'text-emerald-400' :
                      row.delayDays <= 5  ? 'text-yellow-400'  :
                                           'text-rose-400'
                    }`}>
                      {row.delayDays === 0 ? '—' : `+${row.delayDays} dias`}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {row.status === 'on_time' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-900/50 text-emerald-300">No Prazo</span>
                    ) : row.status === 'minor' ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-900/50 text-yellow-300">Atraso Leve</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-900/50 text-red-300">Em Atraso</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function IntegracaoPanel() {
  const { rdos, financialEntries, budgetBRL, syncExecutionToPlanejamento } = useRdoStore()
  const { trechos: planTrechosRaw, workDays } = usePlanejamentoStore()
  const [activeTab, setActiveTab] = useState<SubTab>('dashboard')
  const [syncing, setSyncing] = useState(false)

  // Live subscription to planejamentoStore — no lazy imports needed
  const today = new Date().toISOString().slice(0, 10)
  const totalWorkDays = workDays.length
  const elapsedWorkDays = workDays.filter((d) => d <= today).length

  const planTrechos: PlanTrechoLite[] = planTrechosRaw.map((t) => ({
    id:          t.id,
    code:        t.code,
    name:        t.description,
    totalMeters: t.lengthM,
    startDate:   t.plannedStartDate,
    endDate:     t.plannedEndDate,
  }))

  // Flatten all RDO trechos (latest executedMeters wins per trecho code)
  const rdoTrechos: RdoTrechoEntry[] = (() => {
    const map = new Map<string, RdoTrechoEntry>()
    rdos.forEach((rdo) => {
      rdo.trechos.forEach((t) => {
        const existing = map.get(t.trechoCode)
        if (!existing || rdo.date >= (rdos.find((r) => r.trechos.some((tr) => tr.id === existing.id))?.date ?? '')) {
          map.set(t.trechoCode, t)
        }
      })
    })
    return Array.from(map.values())
  })()

  // Auto-sync execution to Planejamento whenever RDOs change
  useEffect(() => {
    syncExecutionToPlanejamento()
  }, [rdos, syncExecutionToPlanejamento])

  function handleManualSync() {
    setSyncing(true)
    syncExecutionToPlanejamento()
    setTimeout(() => setSyncing(false), 800)
  }

  // Build Curva S points from RDO data + financial entries
  const scurvePoints: SCurvePt[] = (() => {
    if (rdos.length === 0) return []
    const allDates = [
      ...rdos.map((r) => r.date),
      ...financialEntries.map((e) => e.date),
    ].sort()
    const uniqueDates = [...new Set(allDates)]

    const totalPlanned = planTrechos.reduce((s, t) => s + t.totalMeters, 0)
    const wdCount = totalWorkDays || uniqueDates.length

    return uniqueDates.map((date, i) => {
      const pvPct = wdCount > 0 ? Math.min(((i + 1) / wdCount) * 100, 100) : 0
      const cumExecuted = rdos
        .filter((r) => r.date <= date)
        .reduce((s, r) => s + r.trechos.reduce((ts, t) => ts + t.executedMeters, 0), 0)
      const evPct = totalPlanned > 0 ? Math.min((cumExecuted / totalPlanned) * 100, 100) : 0
      const acBRL = financialEntries
        .filter((e) => e.type === 'expense' && e.date <= date)
        .reduce((s, e) => s + e.valueBRL, 0)
      return { date, pvPct, evPct, acBRL }
    })
  })()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-white font-semibold text-lg">RDO × Planejamento</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#525252] text-xs text-[#a3a3a3] hover:text-[#f5f5f5] hover:border-gray-500 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </button>
          <div className="flex items-center gap-1 bg-[#3d3d3d] rounded-lg p-1 border border-[#525252]">
            {SUB_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-sky-600 text-white'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <DashboardIntegrado
          rdoTrechos={rdoTrechos}
          planTrechos={planTrechos}
          rdoCount={rdos.length}
          totalWorkDays={totalWorkDays}
          elapsedWorkDays={elapsedWorkDays}
        />
      )}
      {activeTab === 'scurve' && (
        <CurvaSComparativa points={scurvePoints} budgetBRL={budgetBRL} />
      )}
      {activeTab === 'delays' && (
        <AnaliseAtrasos rdoTrechos={rdoTrechos} planTrechos={planTrechos} />
      )}
    </div>
  )
}
