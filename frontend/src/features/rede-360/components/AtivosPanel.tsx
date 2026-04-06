/**
 * AtivosPanel — Full-width panel for browsing and filtering network assets.
 */
import { useState, useMemo } from 'react'
import { Download } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import type { NetworkAssetType, NetworkAssetStatus, RiskLevel, MapNetworkType } from '@/types'

const ASSET_TYPE_LABELS: Record<NetworkAssetType, string> = {
  circuit:    'Circuito',
  pipe:       'Tubulação',
  pv:         'PV',
  structure:  'Estrutura',
  device:     'Dispositivo',
  vegetation: 'Vegetação',
  hardening:  'Reforço',
}

const NETWORK_TYPE_LABELS: Record<MapNetworkType, string> = {
  sewer:    'Esgoto',
  water:    'Água',
  drainage: 'Drenagem',
  civil:    'Civil',
  generic:  'Genérico',
}

const STATUS_COLORS: Record<NetworkAssetStatus, string> = {
  operational: 'bg-green-900/40 text-green-300',
  degraded:    'bg-yellow-900/40 text-yellow-300',
  critical:    'bg-orange-900/40 text-orange-300',
  offline:     'bg-red-900/40 text-red-300',
  maintenance: 'bg-blue-900/40 text-blue-300',
}

const STATUS_LABELS: Record<NetworkAssetStatus, string> = {
  operational: 'Operacional',
  degraded:    'Degradado',
  critical:    'Crítico',
  offline:     'Offline',
  maintenance: 'Manutenção',
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low:      'bg-green-900/40 text-green-300',
  medium:   'bg-yellow-900/40 text-yellow-300',
  high:     'bg-orange-900/40 text-orange-300',
  critical: 'bg-red-900/40 text-red-300',
}

const RISK_LABELS: Record<RiskLevel, string> = {
  low:      'Baixo',
  medium:   'Médio',
  high:     'Alto',
  critical: 'Crítico',
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function isOverdue(date?: string): boolean {
  if (!date) return false
  return date < new Date().toISOString().slice(0, 10)
}

export function AtivosPanel() {
  const { assets, setSelectedAssetId, setActiveTab } = useRede360Store(
    useShallow((s) => ({
      assets:             s.assets,
      setSelectedAssetId: s.setSelectedAssetId,
      setActiveTab:       s.setActiveTab,
    }))
  )

  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [networkFilter, setNetworkFilter] = useState('')

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      const q = search.toLowerCase()
      if (q && !a.name.toLowerCase().includes(q) && !a.code.toLowerCase().includes(q)) return false
      if (typeFilter    && a.type        !== typeFilter)    return false
      if (statusFilter  && a.status      !== statusFilter)  return false
      if (riskFilter    && a.riskLevel   !== riskFilter)    return false
      if (networkFilter && a.networkType !== networkFilter) return false
      return true
    })
  }, [assets, search, typeFilter, statusFilter, riskFilter, networkFilter])

  function handleExportCsv() {
    const headers = ['Código', 'Nome', 'Tipo', 'Rede', 'Status', 'Risco', 'Última Inspeção', 'Próxima Due']
    const rows = filtered.map((a) => [
      a.code, a.name, ASSET_TYPE_LABELS[a.type], NETWORK_TYPE_LABELS[a.networkType],
      STATUS_LABELS[a.status], RISK_LABELS[a.riskLevel],
      fmtDate(a.lastInspection), fmtDate(a.nextInspectionDue),
    ])
    const csv = [headers, ...rows].map((r) => r.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'ativos-rede360.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const selectCls = 'bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1.5 text-xs text-[#f5f5f5] focus:outline-none'

  return (
    <div className="p-4 h-full overflow-y-auto">
      <div className="bg-[#333333] rounded-xl border border-[#525252] overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#525252] flex-wrap">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código..."
            className="bg-[#3d3d3d] border border-[#525252] rounded px-3 py-1.5 text-xs text-[#f5f5f5] placeholder-[#6b6b6b] focus:outline-none flex-1 min-w-36"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
            <option value="">Todos os tipos</option>
            {Object.entries(ASSET_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className={selectCls}>
            <option value="">Todos os riscos</option>
            {Object.entries(RISK_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={networkFilter} onChange={(e) => setNetworkFilter(e.target.value)} className={selectCls}>
            <option value="">Todas as redes</option>
            {Object.entries(NETWORK_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#3d3d3d] hover:bg-[#484848] border border-[#525252] text-[#a3a3a3] text-xs transition-colors ml-auto"
          >
            <Download size={12} />
            Exportar CSV
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#6b6b6b] border-b border-[#525252]">
                {['Código', 'Nome', 'Tipo', 'Rede', 'Status', 'Risco', 'Última Inspeção', 'Próxima Due', 'Ações'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-[#6b6b6b]">Nenhum ativo encontrado.</td>
                </tr>
              )}
              {filtered.map((asset) => {
                const due = asset.nextInspectionDue
                const overdue = isOverdue(due)
                return (
                  <tr
                    key={asset.id}
                    className="bg-[#3d3d3d] hover:bg-[#484848] transition-colors cursor-pointer"
                    onClick={() => { setSelectedAssetId(asset.id); setActiveTab('home') }}
                  >
                    <td className="px-4 py-2.5 font-mono text-[#a3a3a3]">{asset.code}</td>
                    <td className="px-4 py-2.5 text-[#f5f5f5] font-medium max-w-[180px] truncate">{asset.name}</td>
                    <td className="px-4 py-2.5 text-[#a3a3a3]">{ASSET_TYPE_LABELS[asset.type]}</td>
                    <td className="px-4 py-2.5 text-[#a3a3a3]">{NETWORK_TYPE_LABELS[asset.networkType]}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${STATUS_COLORS[asset.status]}`}>
                        {STATUS_LABELS[asset.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${RISK_COLORS[asset.riskLevel]}`}>
                        {RISK_LABELS[asset.riskLevel]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#a3a3a3]">{fmtDate(asset.lastInspection)}</td>
                    <td className={`px-4 py-2.5 ${overdue ? 'text-red-400 font-medium' : 'text-[#a3a3a3]'}`}>
                      {fmtDate(due)}{overdue ? ' ⚠' : ''}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedAssetId(asset.id); setActiveTab('home') }}
                        className="px-2 py-1 rounded bg-[#333333] hover:bg-[#525252] text-[#f97316] text-xs transition-colors"
                      >
                        Ver
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
