/**
 * EvmHeader — top bar with KPI cards and tab navigation for the EVM module.
 */
import { DollarSign, Download, RefreshCw } from 'lucide-react'
import { useEvmStore } from '@/store/evmStore'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import type { EvmTab } from '@/types'

const TABS: { key: EvmTab; label: string }[] = [
  { key: 'dashboard',     label: 'Dashboard' },
  { key: 'medicao',       label: 'Medição Ponderada' },
  { key: 'plano-contas',  label: 'Plano de Contas' },
  { key: 'work-packages', label: 'Work Packages' },
  { key: 'indices',       label: 'Índices' },
]

function KpiCard({
  label,
  value,
  isCurrency = false,
  isIndex = false,
}: {
  label: string
  value: number
  isCurrency?: boolean
  isIndex?: boolean
}) {
  const formatted = isCurrency
    ? formatCurrency(value)
    : value.toFixed(2)

  const color = isIndex
    ? value >= 1
      ? '#22c55e'
      : '#ef4444'
    : '#f5f5f5'

  return (
    <div className="bg-[#3d3d3d] border border-[#525252] rounded-xl p-4 min-w-[140px]">
      <p className="text-[#a3a3a3] text-xs mb-1">{label}</p>
      <p className="font-mono text-lg font-semibold" style={{ color }}>
        {formatted}
      </p>
    </div>
  )
}

export function EvmHeader() {
  const { activeTab, setActiveTab, evmMetrics, loadDemoData, recalculateMetrics } = useEvmStore()
  const { CPI, SPI, BAC, EAC, VAC } = evmMetrics

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <DollarSign size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">
              Gerenciamento de Valor (EVM)
            </h1>
            <p className="text-[#a3a3a3] text-xs">Earned Value Management</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadDemoData}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[#f97316] transition-colors hover:bg-[#ea580c]"
          >
            <Download size={15} />
            Carregar Demo
          </button>
          <button
            onClick={recalculateMetrics}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <RefreshCw size={15} />
            Recalcular
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="px-6 pb-4 flex gap-3 overflow-x-auto scrollbar-hide">
        <KpiCard label="CPI" value={CPI} isIndex />
        <KpiCard label="SPI" value={SPI} isIndex />
        <KpiCard label="BAC (R$)" value={BAC} isCurrency />
        <KpiCard label="EAC (R$)" value={EAC} isCurrency />
        <KpiCard label="VAC (R$)" value={VAC} isCurrency />
      </div>

      {/* Tab bar */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex px-6 gap-1 min-w-max pb-0">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2',
                  isActive
                    ? 'text-white border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
