/**
 * QuantHeader — top navigation bar for the Quantitativos e Orçamento module.
 * Accent color: #8b5cf6 (violet-500)
 */
import { Calculator, Download } from 'lucide-react'
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { exportToCsv, exportToXlsx } from '../utils/exportEngine'
import type { QuantTab } from '@/types'

const TABS: { key: QuantTab; label: string }[] = [
  { key: 'composicao', label: 'Composição' },
  { key: 'resumo',     label: 'Resumo de Custos' },
  { key: 'banco',      label: 'Banco de Dados' },
  { key: 'historico',  label: 'Histórico' },
]

const ACCENT = '#8b5cf6'

export function QuantHeader() {
  const { activeTab, setActiveTab, currentItems, bdiGlobal } = useQuantitativosStore()

  return (
    <div className="bg-gray-900 border-b border-gray-700 print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <Calculator size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">Quantitativos e Orçamento</h1>
            <p className="text-gray-400 text-xs">SINAPI · SEINFRA · Base Própria</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCsv(currentItems)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
          >
            <Download size={15} />
            CSV
          </button>
          <button
            onClick={() => exportToXlsx(currentItems, bdiGlobal)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: ACCENT }}
          >
            <Download size={15} />
            Excel (.xlsx)
          </button>
        </div>
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
                className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'text-white border-violet-500 bg-gray-800'
                    : 'text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50'
                }`}
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
