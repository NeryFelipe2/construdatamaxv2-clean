import { cn } from '@/lib/utils'
import { useShallow } from 'zustand/react/shallow'
import { useSuprimentosStore } from '@/store/suprimentosStore'

export type SuprimentosTab = 'conciliacao' | 'excecoes' | 'previsao' | 'requisicoes' | 'materiais' | 'contratos'

interface Props {
  activeTab: SuprimentosTab
  onTabChange: (tab: SuprimentosTab) => void
}

const TABS: { key: SuprimentosTab; label: string }[] = [
  { key: 'conciliacao', label: 'Conciliação'         },
  { key: 'excecoes',    label: 'Exceções'             },
  { key: 'previsao',    label: 'Previsão de Demanda'  },
  { key: 'requisicoes', label: 'Requisições'          },
  { key: 'materiais',   label: 'Materiais & Fornecedores' },
  { key: 'contratos',   label: 'Contrato 360'          },
]

export function SuprimentosHeader({ activeTab, onTabChange }: Props) {
  const { purchaseOrders, matches, exceptions } = useSuprimentosStore(
    useShallow((s) => ({
      purchaseOrders: s.purchaseOrders,
      matches:        s.matches,
      exceptions:     s.exceptions,
    }))
  )

  const totalPOs       = purchaseOrders.length
  const conciliado     = matches.filter((m) => m.status === 'matched').length
  const parcial        = matches.filter((m) => m.status === 'partial').length
  const comExcecao     = matches.filter((m) => m.status === 'discrepancy').length
  const openExceptions = exceptions.filter((e) => e.status === 'open' || e.status === 'escalated').length

  const kpis = [
    { label: 'Conciliadas',   value: conciliado,     color: 'text-[#4ade80]',  bg: 'bg-[#16a34a]/10 border-[#16a34a]/30' },
    { label: 'Parciais',      value: parcial,         color: 'text-[#fbbf24]',  bg: 'bg-[#ca8a04]/10 border-[#ca8a04]/30' },
    { label: 'Com Exceção',   value: comExcecao,      color: 'text-[#f87171]',  bg: 'bg-[#dc2626]/10 border-[#dc2626]/30' },
    { label: 'Total OCs',     value: totalPOs,         color: 'text-[#f5f5f5]',  bg: 'bg-[#1e1e1e] border-[#20406a]'        },
  ]

  return (
    <div className="flex flex-col gap-4 shrink-0">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(({ label, value, color, bg }) => (
          <div key={label} className={cn('border rounded-xl p-4 flex flex-col gap-1', bg)}>
            <p className="text-[#6b6b6b] text-xs">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar + exception badge */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 bg-[#1e1e1e] border border-[#20406a] rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                'px-4 py-1.5 rounded text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-[#2abfdc] text-white'
                  : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {openExceptions > 0 && (
          <span
            onClick={() => onTabChange('excecoes')}
            className="px-2.5 py-1 rounded-full bg-[#dc2626]/20 text-[#f87171] text-xs font-semibold cursor-pointer hover:bg-[#dc2626]/30 transition-colors"
          >
            {openExceptions} exceção{openExceptions > 1 ? 'ões' : ''} aberta{openExceptions > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
