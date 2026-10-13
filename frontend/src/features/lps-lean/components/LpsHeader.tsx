/**
 * LpsHeader — KPI strip + tab navigation for the LPS/Lean module.
 *
 * Honestidade dos KPIs (27/07): os números são ancorados na SEMANA ISO CORRENTE
 * real, não na última semana que tiver dado — antes o header mostrava a carga
 * histórica de lps_tasks (W15-W27, importada em 14/07) como "esta semana"
 * (148/150, PPC 99%), o exato falso-alto que a regra "nenhum número inventado"
 * proíbe. Sem compromisso gravado na semana corrente, mostra 0/0 e aponta pro
 * wizard do Semáforo. O PPC (4 sem.) considera só as 4 semanas ISO anteriores à
 * corrente e declara quantas delas têm dado.
 */
import { useMemo } from 'react'
import { Target, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react'
import { useLpsStore, computeWeeklyPPC, isoWeek, weekOffset } from '@/store/lpsStore'
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
  { id: 'semaforo',            label: 'Semáforo' },
  { id: 'lookahead',           label: 'Look-ahead' },
  { id: 'ppc',                 label: 'PPC Dashboard' },
  { id: 'takt',                label: 'Takt Time' },
  { id: 'restricoes',          label: 'Restrições' },
  { id: 'analytics',           label: 'Analytics' },
  { id: 'timeline-restricoes', label: 'Timeline Restrições' },
  { id: 'alertas',             label: 'Alertas' },
  { id: 'mao-de-obra',         label: 'Mão de Obra' },
  { id: 'integracoes',         label: 'Integrações' },
]

export function LpsHeader() {
  const activeTab    = useLpsStore((s) => s.activeTab)
  const setActiveTab = useLpsStore((s) => s.setActiveTab)
  const activities   = useLpsStore((s) => s.activities)
  const connectionStatus = useLpsStore((s) => s.connectionStatus)

  const weekly = useMemo(() => computeWeeklyPPC(activities), [activities])

  // Semana ISO corrente REAL (não a última com dado — ver cabeçalho)
  const semanaCorrente = useMemo(() => isoWeek(new Date()), [])
  const ultimas4 = useMemo(
    () => [-4, -3, -2, -1].map((off) => weekOffset(new Date(), off)),
    [],
  )

  // PPC média das 4 semanas ISO anteriores à corrente — só as que têm dado
  const pastWeekly = weekly.filter((w) => ultimas4.includes(w.week))
  const avgPpc = pastWeekly.length > 0
    ? Math.round(pastWeekly.reduce((s, w) => s + w.ppc, 0) / pastWeekly.length)
    : null

  // Tendência: últimas 2 semanas (das 4 anteriores) que têm dado
  const trend = pastWeekly.length >= 2
    ? pastWeekly[pastWeekly.length - 1].ppc - pastWeekly[pastWeekly.length - 2].ppc
    : 0

  // Compromissos da semana ISO corrente (0/0 honesto se ninguém comprometeu ainda)
  const currentWeek = weekly.find((w) => w.week === semanaCorrente)
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

  const ppcColor = avgPpc === null
    ? 'text-[#a3a3a3]'
    : avgPpc >= 80 ? 'text-green-400' : avgPpc >= 60 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="bg-[#2c2c2c] border-b border-[#3d3d3d]">
      {/* KPI strip */}
      <div className="px-6 py-4 flex items-center gap-8 flex-wrap border-b border-[#3d3d3d]/60">
        {/* Logo / title */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
            <Target size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-bold text-white leading-tight">LPS / Lean</p>
            <p className="text-[10px] text-[#6b6b6b] leading-tight">Last Planner System</p>
          </div>
          <span className={`ml-2 inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold ${
            connectionStatus === 'connected'
              ? 'bg-green-500/15 text-green-300'
              : connectionStatus === 'partial'
                ? 'bg-yellow-500/15 text-yellow-300'
                : 'bg-[#484848] text-[#a3a3a3]'
          }`}>
            {connectionStatus === 'connected' ? 'Conectado' : connectionStatus === 'partial' ? 'Parcial' : 'Local'}
          </span>
        </div>

        <div className="w-px h-8 bg-[#484848] shrink-0" />

        {/* PPC médio — só semanas anteriores à corrente que têm dado */}
        <Kpi
          label="PPC (4 sem.)"
          value={avgPpc === null ? '—' : `${avgPpc}%`}
          sub={avgPpc === null ? 'sem dado nas 4 sem.' : `${pastWeekly.length} de 4 sem. c/ dado`}
          valueClass={ppcColor}
        />

        {/* Tendência */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">Tendência</span>
          <div className="flex items-center gap-1">
            {trend > 0
              ? <TrendingUp size={16} className="text-green-400" />
              : trend < 0
                ? <TrendingDown size={16} className="text-red-400" />
                : <Minus size={16} className="text-[#6b6b6b]" />}
            <span className={`text-sm font-bold ${trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-[#a3a3a3]'}`}>
              {trend > 0 ? `+${trend}` : trend === 0 ? '—' : trend}pp
            </span>
          </div>
        </div>

        {/* Semana ISO corrente real — 0/0 até alguém comprometer no Semáforo */}
        <Kpi
          label={`Esta Semana (${semanaCorrente})`}
          value={`${weekCompleted}/${weekPlanned}`}
          sub={weekPlanned === 0 ? 'nenhum compromisso — use o Semáforo' : 'concluídas/planejadas'}
          valueClass={weekPlanned > 0 && weekCompleted === weekPlanned ? 'text-green-400' : 'text-white'}
        />

        {/* Top CNC */}
        {topCnc && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">Principal CNC</span>
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-orange-400" />
              <span className="text-sm font-semibold text-orange-300">{CNC_LABELS[topCnc[0]] ?? topCnc[0]}</span>
              <span className="text-xs text-[#6b6b6b]">({topCnc[1]}×)</span>
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
                : 'text-[#6b6b6b] border-transparent hover:text-[#f5f5f5]'
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
      <span className="text-[10px] text-[#6b6b6b] uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-bold ${valueClass}`}>{value}</span>
      {sub && <span className="text-[10px] text-gray-600">{sub}</span>}
    </div>
  )
}
