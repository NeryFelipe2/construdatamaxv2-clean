/**
 * RdoHeader — top navigation and action bar for the RDO module.
 * Accent color: #0ea5e9 (sky-500)
 */
import { FileText, Plus, Download } from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import type { RdoTab } from '@/types'

const TABS: { key: RdoTab; label: string }[] = [
  { key: 'dashboard',  label: 'Dashboard'         },
  { key: 'novo',       label: '+ Novo RDO'         },
  { key: 'historico',  label: 'Histórico de RDOs'  },
  { key: 'integracao', label: 'RDO × Planejamento' },
  { key: 'financeiro', label: 'Financeiro'         },
]

const ACCENT = '#0ea5e9'

function escapeCell(value: string | number | null | undefined): string {
  const str = String(value ?? '').replace(/[\x00-\x1F\x7F]/g, '')
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  return `"${neutralized.replace(/"/g, '""')}"`
}

export function RdoHeader() {
  const { activeTab, setActiveTab, rdos } = useRdoStore()

  function handleExportCsv() {
    const BOM = '\uFEFF'
    const header = [
      escapeCell('Nº RDO'),
      escapeCell('Data'),
      escapeCell('Responsável'),
      escapeCell('Trechos'),
      escapeCell('Metros Executados'),
      escapeCell('Fotos'),
    ].join(',')
    const rows = rdos.map((r) =>
      [
        escapeCell(r.number),
        escapeCell(r.date),
        escapeCell(r.responsible),
        escapeCell(r.trechos.length),
        escapeCell(r.trechos.reduce((s, t) => s + t.executedMeters, 0).toFixed(2)),
        escapeCell(r.photos.length),
      ].join(','),
    )
    const csv = BOM + [header, ...rows].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rdos-${new Date().toISOString().slice(0, 10)}.csv`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="bg-gray-900 border-b border-gray-700 print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: ACCENT }}>
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">RDO</h1>
            <p className="text-gray-400 text-xs">Relatório Diário de Obras</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('novo')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus size={15} />
            Novo RDO
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
          >
            <Download size={15} />
            Exportar CSV
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
                    ? 'text-white border-sky-500 bg-gray-800'
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
