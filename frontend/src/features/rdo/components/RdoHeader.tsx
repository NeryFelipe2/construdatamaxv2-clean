/**
 * RdoHeader — top navigation and action bar for the RDO module.
 */
import { useState } from 'react'
import { FileText, Plus, Download, Settings } from 'lucide-react'
import { useRdoStore } from '@/store/rdoStore'
import { LogoConfigModal } from './LogoConfigModal'
import type { RdoTab } from '@/types'

const TABS: { key: RdoTab; label: string }[] = [
  { key: 'dashboard',  label: 'Dashboard'         },
  { key: 'novo',       label: '+ Novo RDO'         },
  { key: 'historico',  label: 'Histórico de RDOs'  },
  { key: 'integracao', label: 'RDO × Planejamento' },
  { key: 'financeiro', label: 'Financeiro'         },
]

function escapeCell(value: string | number | null | undefined): string {
  const str = String(value ?? '').replace(/[\x00-\x1F\x7F]/g, '')
  const neutralized = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str
  return `"${neutralized.replace(/"/g, '""')}"`
}

export function RdoHeader() {
  const { activeTab, setActiveTab, rdos } = useRdoStore()
  const [showLogoModal, setShowLogoModal] = useState(false)

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
    <>
    <div className="bg-[#2c2c2c] border-b border-[#525252] print:hidden">
      {/* Title + actions */}
      <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#f97316]">
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-lg leading-tight">RDO</h1>
            <p className="text-[#a3a3a3] text-xs">Relatório Diário de Obras</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogoModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#a3a3a3] hover:text-[#f97316] hover:bg-[#484848] transition-colors border border-[#525252] hover:border-[#f97316]/30"
          >
            <Settings size={15} />
            <span className="hidden sm:inline">Configurar Logo</span>
          </button>
          <button
            onClick={() => setActiveTab('novo')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors bg-[#f97316] hover:bg-[#ea580c]"
          >
            <Plus size={15} />
            Novo RDO
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#484848] text-[#f5f5f5] hover:bg-[#525252] transition-colors"
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
                    ? 'text-[#f97316] border-[#f97316] bg-[#3d3d3d]'
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

    {showLogoModal && <LogoConfigModal onClose={() => setShowLogoModal(false)} />}
    </>
  )
}
