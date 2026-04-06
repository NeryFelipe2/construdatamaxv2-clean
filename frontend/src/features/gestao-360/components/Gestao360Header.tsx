import { useShallow } from 'zustand/react/shallow'
import { LayoutDashboard, TrendingUp, TrendingDown, AlertTriangle, FileEdit, Activity } from 'lucide-react'
import { useGestao360Store } from '@/store/gestao360Store'
import { useProjetosStore } from '@/store/projetosStore'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import type { Gestao360Tab } from '@/store/gestao360Store'

const TABS: Array<{ id: Gestao360Tab; label: string }> = [
  { id: 'dashboard',    label: 'Dashboard de Obras'    },
  { id: 'jobacosting',  label: 'Custo em Tempo Real'   },
  { id: 'changeorders', label: 'Ordens de Mudança'      },
  { id: 'command',      label: 'Centro de Comando'      },
  { id: 'simulation',   label: 'Simulação de Atrasos'  },
]

export function Gestao360Header() {
  const { selectedProjectId, selectProject, activeTab, setActiveTab, changeOrders } = useGestao360Store(
    useShallow((s) => ({
      selectedProjectId: s.selectedProjectId,
      selectProject:     s.selectProject,
      activeTab:         s.activeTab,
      setActiveTab:      s.setActiveTab,
      changeOrders:      s.changeOrders,
    }))
  )
  const projects      = useProjetosStore((s) => s.projects)
  const healthScores  = useOtimizacaoFrotaStore((s) => s.healthScores)
  const sites         = useTorreStore((s) => s.sites)

  const project = projects.find((p) => p.id === selectedProjectId) ?? projects[0] ?? null

  // ─── EAC derived values ────────────────────────────────────────────
  const lines        = project?.budgetLines ?? []
  const budgeted     = lines.reduce((s, l) => s + l.budgeted, 0)
  const spent        = lines.reduce((s, l) => s + l.spent, 0)
  const eac          = lines.reduce((s, l) => s + l.projected, 0)
  const budgetDelta  = budgeted > 0 ? ((eac - budgeted) / budgeted) * 100 : 0

  // ─── SPI/CPI from execution phases ────────────────────────────────
  const execPhases = project?.executionPhases ?? []
  const avgProgress = execPhases.length
    ? execPhases.reduce((s, p) => s + p.progress, 0) / execPhases.length
    : 0

  const today = new Date()
  const start = project ? new Date(project.startDate + 'T00:00:00') : today
  const end   = project ? new Date(project.endDate   + 'T00:00:00') : today
  const totalMs    = Math.max(1, end.getTime() - start.getTime())
  const elapsedMs  = Math.min(totalMs, Math.max(0, today.getTime() - start.getTime()))
  const plannedPct = (elapsedMs / totalMs) * 100

  const spi = plannedPct > 0 ? avgProgress / plannedPct : 1
  const cpi = spent > 0 ? (budgeted * (avgProgress / 100)) / spent : 1

  // ─── Cross-module critical alerts ─────────────────────────────────
  const criticalEquip = healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high').length
  const criticalRisks = sites.flatMap((s) => s.risks).filter((r) => r.level === 'critical' && r.status === 'active').length
  const totalAlerts   = criticalEquip + criticalRisks
  const openCOs       = changeOrders.filter((co) => co.status === 'submitted').length

  function spiCpiColor(v: number) {
    if (v >= 0.9) return '#22c55e'
    if (v >= 0.7) return '#eab308'
    return '#ef4444'
  }

  const kpis = [
    {
      label: 'EAC Projetado',
      value: eac > 0 ? `R$${(eac / 1_000_000).toFixed(1)}M` : '—',
      icon:  TrendingUp,
      color: '#f97316',
    },
    {
      label: 'Δ Orçamento',
      value: budgeted > 0 ? `${budgetDelta > 0 ? '+' : ''}${budgetDelta.toFixed(1)}%` : '—',
      icon:  budgetDelta > 5 ? TrendingUp : TrendingDown,
      color: Math.abs(budgetDelta) <= 5 ? '#22c55e' : Math.abs(budgetDelta) <= 15 ? '#eab308' : '#ef4444',
    },
    {
      label: 'CPI',
      value: cpi > 0 ? cpi.toFixed(2) : '—',
      icon:  Activity,
      color: spiCpiColor(cpi),
    },
    {
      label: 'SPI',
      value: spi > 0 ? spi.toFixed(2) : '—',
      icon:  Activity,
      color: spiCpiColor(spi),
    },
    {
      label: 'OMs em Aprovação',
      value: String(openCOs),
      icon:  FileEdit,
      color: openCOs === 0 ? '#22c55e' : '#f97316',
    },
    {
      label: 'Alertas Críticos',
      value: String(totalAlerts),
      icon:  AlertTriangle,
      color: totalAlerts === 0 ? '#22c55e' : totalAlerts <= 2 ? '#eab308' : '#ef4444',
    },
  ]

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-0">
      {/* Title + project selector */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#f97316]/15">
            <LayoutDashboard size={18} className="text-[#f97316]" />
          </div>
          <div>
            <h1 className="text-[#f5f5f5] text-lg font-semibold leading-none">
              Gestão de Projeto 360
            </h1>
            <p className="text-[#6b6b6b] text-xs mt-0.5">
              Centro de Comando · Custo em Tempo Real · Ordens de Mudança
            </p>
          </div>
        </div>

        {/* Project selector */}
        {projects.length > 0 && (
          <select
            value={selectedProjectId ?? project?.id ?? ''}
            onChange={(e) => selectProject(e.target.value)}
            className="ml-auto px-3 py-1.5 rounded-lg bg-[#3d3d3d] border border-[#525252] text-[#f5f5f5] text-sm focus:outline-none focus:border-[#f97316]/60"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#3d3d3d] border border-[#525252] rounded-xl px-3 py-3 flex items-center gap-2"
          >
            <div
              className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0"
              style={{ backgroundColor: `${kpi.color}18` }}
            >
              <kpi.icon size={14} style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[#6b6b6b] text-[10px] truncate">{kpi.label}</p>
              <p className="text-[#f5f5f5] text-base font-bold leading-tight" style={{ color: kpi.color }}>
                {kpi.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="flex gap-1 border-b border-[#525252] -mb-px overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? 'px-4 py-2.5 text-sm font-medium border-b-2 border-[#f97316] text-[#f97316] whitespace-nowrap shrink-0'
                : 'px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-[#6b6b6b] hover:text-[#f5f5f5] whitespace-nowrap shrink-0 transition-colors'
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
