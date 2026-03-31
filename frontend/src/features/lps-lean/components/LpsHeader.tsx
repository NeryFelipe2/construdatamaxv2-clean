/**
 * LpsHeader — KPI strip + tab navigation for the LPS/Lean module.
 */
import { useMemo } from 'react'
import { Target, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC } from '@/store/lpsStore'
import type { LpsTab } from '@/types'

const CNC_LABELS: Record<string, string> = {
  weather:   'Clima',
  equipment: 'Equipamento',
  labor:     'Mão de Obra',
  material:  'Material',
  design:    'Projeto',
  other:     'Outro',
}

const TABS: { id: LpsTab; label: string }[] = [
  { id: 'semaforo',   label: 'Semáforo' },
  { id: 'lookahead',  label: 'Look-ahead' },
  { id: 'ppc',        label: 'PPC Dashboard' },
  { id: 'takt',       label: 'Takt Time' },
  { id: 'restricoes', label: 'Restrições' },
  { id: 'analytics',  label: 'Analytics' },
]

export function LpsHeader() {
  const activeTab    = useLpsStore((s) => s.activeTab)
  const setActiveTab = useLpsStore((s) => s.setActiveTab)
  const activities   = useLpsStore((s) => s.activities)

  const weekly = useMemo(() => computeWeeklyPPC(activities), [activities])

  // PPC média últimas 4 semanas (past only)
  const pastWeekly = weekly.slice(-5, -1)  // 4 semanas passadas
  const avgPpc = pastWeekly.length > 0
    ? Math.round(pastWeekly.reduce((s, w) => s + w.ppc, 0) / pastWeekly.length)
    : 0

  // Tendência: comparar última vs penúltima
  const last    = weekly[weekly.length - 2]?.ppc ?? 0
  const prev    = weekly[weekly.length - 3]?.ppc ?? 0
  const trend   = last - prev

  // Atividades da semana atual
  const currentWeek = weekly[weekly.length - 1]
  const weekPlanned   = currentWeek?.planned   ?? 0
  const weekCompleted = currentWeek?.completed ?? 0

  // Top CNC
  const cncCount = activities
    .filter((a) => a.cncCategory)
    .reduce<Record<string, number>>((acc, a) => {
      const cat = a.cncCategory!
      acc[cat] = (acc[cat] ?? 0) + 1
      return acc
    }, {})
  const topCnc = Object.entries(cncCount).sort((a, b) => b[1] - a[1])[0]

  const ppcColor = avgPpc >= 80 ? 'text-green-400' : avgPpc >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="bg-gray-900 border-b border-gray-800">
      {/* KPI strip */}
      <div className="px-6 py-4 flex items-center gap-8 flex-wrap border-b border-gray-800/60">
        {/* Logo / title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
            <Target size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">LPS / Lean</p>
            <p className="text-[10px] text-gray-500 leading-tight">Last Planner System</p>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-700 shrink-0" />

        {/* PPC médio */}
        <Kpi label="PPC (4 sem.)" value={`${avgPpc}%`} valueClass={ppcColor} />

        {/* Tendência */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tendência</span>
          <div className="flex items-center gap-1">
            {trend > 0
              ? <TrendingUp size={16} className="text-green-400" />
              : trend < 0
                ? <TrendingDown size={16} className="text-red-400" />
                : <Minus size={16} className="text-gray-500" />}
            <span className={`text-sm font-bold ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {trend > 0 ? `+${trend}` : trend === 0 ? '—' : trend}pp
            </span>
          </div>
        </div>

        {/* Semana atual */}
        <Kpi
          label="Esta Semana"
          value={`${weekCompleted}/${weekPlanned}`}
          sub="concluídas/planejadas"
          valueClass={weekPlanned > 0 && weekCompleted === weekPlanned ? 'text-green-400' : 'text-white'}
        />

        {/* Top CNC */}
        {topCnc && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">Principal CNC</span>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-orange-400" />
              <span className="text-sm font-semibold text-orange-300">{CNC_LABELS[topCnc[0]] ?? topCnc[0]}</span>
              <span className="text-xs text-gray-500">({topCnc[1]}×)</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-6 pt-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'text-orange-400 border-orange-500'
                : 'text-gray-500 border-transparent hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, sub, valueClass = 'text-white' }: {
  label: string; value: string; sub?: string; valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
      {sub && <span className="text-[10px] text-gray-600">{sub}</span>}
    </div>
  )
}
