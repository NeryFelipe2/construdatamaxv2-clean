import { useShallow } from 'zustand/react/shallow'
import { Cpu, TrendingUp, AlertTriangle, DollarSign, Activity } from 'lucide-react'
import { useOtimizacaoFrotaStore, calcProjectedMonthlySavings } from '@/store/otimizacaoFrotaStore'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { cn } from '@/lib/utils'

export type FrotaTab = 'roteamento' | 'manutencao' | 'buylease'

interface Props {
  activeTab:   FrotaTab
  onTabChange: (tab: FrotaTab) => void
}

const TABS: Array<{ id: FrotaTab; label: string }> = [
  { id: 'roteamento', label: 'Roteamento de Frota'         },
  { id: 'manutencao', label: 'Manutenção Preditiva'        },
  { id: 'buylease',   label: 'Comprar vs Alugar (BIM 5D)'  },
]

export function OtimizacaoHeader({ activeTab, onTabChange }: Props) {
  const { routingRecs, healthScores, buyLeaseAnalyses } = useOtimizacaoFrotaStore(
    useShallow((s) => ({
      routingRecs:      s.routingRecs,
      healthScores:     s.healthScores,
      buyLeaseAnalyses: s.buyLeaseAnalyses,
    }))
  )
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)

  const totalEquip    = equipamentos.length
  const idleEquip     = equipamentos.filter((e) => e.status === 'idle').length
  const utilizationPct = totalEquip > 0 ? Math.round(((totalEquip - idleEquip) / totalEquip) * 100) : 0
  const criticalAlerts = healthScores.filter((h) => h.riskLevel === 'critical' || h.riskLevel === 'high').length
  const monthlySavings = calcProjectedMonthlySavings(routingRecs, buyLeaseAnalyses)

  const kpis = [
    {
      label: 'Utilização da Frota',
      value: `${utilizationPct}%`,
      icon:  Activity,
      color: utilizationPct >= 70 ? '#22c55e' : utilizationPct >= 50 ? '#f59e0b' : '#ef4444',
    },
    {
      label: 'Equipamentos Ociosos',
      value: String(idleEquip),
      icon:  TrendingUp,
      color: idleEquip === 0 ? '#22c55e' : idleEquip <= 2 ? '#f59e0b' : '#ef4444',
    },
    {
      label: 'Alertas Críticos/Altos',
      value: String(criticalAlerts),
      icon:  AlertTriangle,
      color: criticalAlerts === 0 ? '#22c55e' : criticalAlerts <= 2 ? '#f59e0b' : '#ef4444',
    },
    {
      label: 'Economia Projetada/mês',
      value: monthlySavings > 0
        ? `R$${(monthlySavings / 1000).toFixed(0)}k`
        : '—',
      icon:  DollarSign,
      color: '#22c55e',
    },
  ]

  return (
    <div className="flex flex-col gap-4 px-6 pt-6 pb-0">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2abfdc]/15">
          <Cpu size={18} className="text-[#2abfdc]" />
        </div>
        <div>
          <h1 className="text-[#f5f5f5] text-lg font-semibold leading-none">
            Otimização de Frota e Equipamentos
          </h1>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            Roteamento inteligente · Manutenção preditiva · Análise Comprar vs Alugar
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-[#14294e] border border-[#20406a] rounded-xl px-4 py-3 flex items-center gap-3"
          >
            <div
              className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ backgroundColor: `${kpi.color}18` }}
            >
              <kpi.icon size={16} style={{ color: kpi.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-[#6b6b6b] text-xs truncate">{kpi.label}</p>
              <p className="text-[#f5f5f5] text-lg font-bold leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#20406a] -mb-px">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-[#2abfdc] text-[#2abfdc]'
                : 'border-transparent text-[#6b6b6b] hover:text-[#f5f5f5]',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
