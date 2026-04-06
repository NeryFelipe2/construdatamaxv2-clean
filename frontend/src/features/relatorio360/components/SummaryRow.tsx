import { ClipboardList, Clock, DollarSign, Wrench, Users, Target, TrendingUp } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { useSummaryMetrics } from '@/hooks/useRelatorio360'
import { useOperacaoCampoStore } from '@/store/operacaoCampoStore'
import { formatCurrencyCompact, formatHours } from '@/lib/utils'

export function SummaryRow() {
  const {
    activityCount,
    timecardCount,
    totalTimecardHours,
    totalTimecardCost,
    equipmentCount,
    totalEquipmentHours,
    totalEquipmentCost,
  } = useSummaryMetrics()

  const weeklyPpcResults = useOperacaoCampoStore((s) => s.weeklyPpcResults)
  const trendPoints      = useOperacaoCampoStore((s) => s.trendPoints)

  const totalCost = totalTimecardCost + totalEquipmentCost

  const latestPpc = weeklyPpcResults.length > 0
    ? weeklyPpcResults[weeklyPpcResults.length - 1].ppc
    : null

  const validTrend = trendPoints.filter((p) => p.actualCumulativePct > 0)
  const lastTrend  = validTrend[validTrend.length - 1]
  const lastPlan   = trendPoints.find((p) => p.date === lastTrend?.date)
  const deviation  = lastTrend && lastPlan
    ? Math.round((lastTrend.actualCumulativePct - lastPlan.plannedCumulativePct) * 10) / 10
    : null

  const ppcVariant = latestPpc === null ? 'default'
    : latestPpc >= 80 ? 'success'
    : latestPpc >= 60 ? 'warning'
    : 'danger'

  const devVariant = deviation === null ? 'default'
    : deviation >= 0 ? 'success'
    : deviation >= -5 ? 'warning'
    : 'danger'

  return (
    <div className="px-3 sm:px-6 py-4 flex flex-col gap-3">
      {/* Top row — 4 cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Atividades"
          value={String(activityCount)}
          sub="tarefas"
          icon={ClipboardList}
          variant="accent"
        />
        <StatCard
          label="Apontamentos"
          value={String(timecardCount)}
          sub="registros"
          icon={Users}
        />
        <StatCard
          label="Horas M.O."
          value={formatHours(totalTimecardHours)}
          sub={formatCurrencyCompact(totalTimecardCost)}
          icon={Clock}
        />
        <StatCard
          label="Equipamentos"
          value={String(equipmentCount)}
          sub={`${formatHours(totalEquipmentHours)} utilizadas`}
          icon={Wrench}
        />
      </div>
      {/* Bottom row — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Custo Total"
          value={formatCurrencyCompact(totalCost)}
          sub="M.O. + Equip."
          icon={DollarSign}
          variant="accent"
        />
        <StatCard
          label="PPC Semanal"
          value={latestPpc !== null ? `${latestPpc}%` : '—'}
          sub={latestPpc !== null
            ? (latestPpc >= 80 ? 'meta atingida' : latestPpc >= 60 ? 'atenção' : 'abaixo da meta')
            : 'sem dados'}
          icon={Target}
          variant={ppcVariant}
        />
        <StatCard
          label="Desvio Acumulado"
          value={deviation !== null ? `${deviation > 0 ? '+' : ''}${deviation}%` : '—'}
          sub={deviation !== null ? (deviation >= 0 ? 'adiantado' : 'em atraso') : 'sem dados'}
          icon={TrendingUp}
          variant={devVariant}
        />
      </div>
    </div>
  )
}
