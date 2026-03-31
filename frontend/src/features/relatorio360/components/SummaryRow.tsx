import { ClipboardList, Clock, DollarSign, Wrench, Users } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { useSummaryMetrics } from '@/hooks/useRelatorio360'
import { formatCurrency, formatHours } from '@/lib/utils'

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

  const totalCost = totalTimecardCost + totalEquipmentCost

  return (
    <div className="grid grid-cols-5 gap-3 px-6 py-4">
      <StatCard
        label="Atividades"
        value={String(activityCount)}
        sub="tarefas"
        icon={ClipboardList}
        accent
      />
      <StatCard
        label="Apontamentos"
        value={String(timecardCount)}
        sub="registros"
        icon={Users}
      />
      <StatCard
        label="Horas Mão de Obra"
        value={formatHours(totalTimecardHours)}
        sub={formatCurrency(totalTimecardCost)}
        icon={Clock}
      />
      <StatCard
        label="Equipamentos"
        value={String(equipmentCount)}
        sub={`${formatHours(totalEquipmentHours)} utilizadas`}
        icon={Wrench}
      />
      <StatCard
        label="Custo Total"
        value={formatCurrency(totalCost)}
        sub="M.O. + Equip."
        icon={DollarSign}
        accent
      />
    </div>
  )
}
