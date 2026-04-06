/**
 * PlanejamentoHeader — top navigation and action bar for the Planejamento module.
 * Accent color: #f97316 (orange-500)
 */
import { CalendarClock, Play, Download, Printer, AlertTriangle } from 'lucide-react'
import { usePlanejamentoStore, type PlanejamentoTab } from '@/store/planejamentoStore'
import { exportFullProjectCsv } from '../utils/exportEngine'

const TABS: { key: PlanejamentoTab; label: string }[] = [
  { key: 'config',     label: 'Configuração'       },
  { key: 'trechos',    label: 'Trechos'             },
  { key: 'gantt',      label: 'Cronograma'          },
  { key: 'scurve',     label: 'Curva S'             },
  { key: 'abc',        label: 'Curva ABC'           },
  { key: 'histogram',  label: 'Histograma'          },
  { key: 'daily',      label: 'Plano Diário'        },
  { key: 'notes',      label: 'Notas de Serviço'    },
  { key: 'scenarios',  label: 'Planejamentos Salvos' },
]

export function PlanejamentoHeader() {
  const {
    activeTab, setActiveTab,
    isScheduleDirty, runSchedule,
    ganttRows, abcItems, projectEndDate,
    teams,
  } = usePlanejamentoStore()

  function handleExportCsv() {
    const teamNames = teams.map((t) => t.name)
    exportFullProjectCsv(ganttRows, teamNames, abcItems, projectEndDate)
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f97316' }}>
            <CalendarClock size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">Planejamento de Trechos</h1>
            <p className="text-[#a3a3a3] text-xs">Cronograma e análise de trechos</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={runSchedule}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: '#f97316' }}
          >
            <Play size={15} />
            Gerar Planejamento
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <Download size={15} />
            Exportar CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
          >
            <Printer size={15} />
            Imprimir PDF
          </button>
        </div>
      </div>

      {/* Dirty warning */}
      {isScheduleDirty && (
        <div className="mx-6 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-900/40 border border-amber-700/60 text-amber-300 text-xs">
          <AlertTriangle size={14} />
          Configurações alteradas. Clique em <strong className="mx-1">Gerar Planejamento</strong> para atualizar o cronograma.
        </div>
      )}

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
                    ? 'text-white border-orange-500 bg-[#3d3d3d]'
                    : 'text-[#a3a3a3] border-transparent hover:text-[#f5f5f5] hover:bg-[#3d3d3d]/50'
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
