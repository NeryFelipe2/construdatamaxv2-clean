/**
 * AtivoDrillDownPanel — Side panel showing asset details.
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import type { NetworkAssetStatus, RiskLevel } from '@/types'

type DrillTab = 'geral' | 'monitoramento' | 'historico' | 'os'

const DRILL_TABS: { id: DrillTab; label: string }[] = [
  { id: 'geral',         label: 'Geral'        },
  { id: 'monitoramento', label: 'Monitoramento' },
  { id: 'historico',     label: 'Histórico'     },
  { id: 'os',            label: 'OS'            },
]

const STATUS_COLORS: Record<NetworkAssetStatus, string> = {
  operational: 'bg-green-900/40 text-green-300 border border-green-700/50',
  degraded:    'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  critical:    'bg-orange-900/40 text-orange-300 border border-orange-700/50',
  offline:     'bg-red-900/40 text-red-300 border border-red-700/50',
  maintenance: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',
}

const STATUS_LABELS: Record<NetworkAssetStatus, string> = {
  operational: 'Operacional',
  degraded:    'Degradado',
  critical:    'Crítico',
  offline:     'Offline',
  maintenance: 'Manutenção',
}

const RISK_COLORS: Record<RiskLevel, string> = {
  low:      'bg-green-900/40 text-green-300 border border-green-700/50',
  medium:   'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  high:     'bg-orange-900/40 text-orange-300 border border-orange-700/50',
  critical: 'bg-red-900/40 text-red-300 border border-red-700/50',
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

export function AtivoDrillDownPanel() {
  const { assets, serviceOrders, selectedAssetId, setSelectedAssetId } = useRede360Store(
    useShallow((s) => ({
      assets: s.assets,
      serviceOrders: s.serviceOrders,
      selectedAssetId: s.selectedAssetId,
      setSelectedAssetId: s.setSelectedAssetId,
    }))
  )

  const [drillTab, setDrillTab] = useState<DrillTab>('geral')
  const asset = assets.find((a) => a.id === selectedAssetId)

  if (!asset) return null

  const assetOrders = serviceOrders.filter((o) => o.assetId === asset.id)

  const mockHistory = asset.lastInspection
    ? [
        { date: asset.lastInspection, label: 'Inspeção realizada', detail: 'Inspeção de rotina concluída.' },
        {
          date: new Date(new Date(asset.lastInspection).getTime() - 180 * 86400000).toISOString().slice(0, 10),
          label: 'Inspeção realizada',
          detail: 'Vistoria semestral sem anomalias.',
        },
        {
          date: new Date(new Date(asset.lastInspection).getTime() - 365 * 86400000).toISOString().slice(0, 10),
          label: 'Inspeção realizada',
          detail: 'Inspeção anual com limpeza preventiva.',
        },
      ]
    : []

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-[#112645] border-l border-[#20406a] z-[1000] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-[#20406a] shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#6b6b6b] text-xs font-mono">{asset.code}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[asset.status]}`}>
              {STATUS_LABELS[asset.status]}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${RISK_COLORS[asset.riskLevel]}`}>
              Risco: {RISK_LABELS[asset.riskLevel]}
            </span>
          </div>
          <div className="text-[#f5f5f5] text-sm font-semibold mt-1 truncate">{asset.name}</div>
        </div>
        <button
          onClick={() => setSelectedAssetId(null)}
          className="ml-2 p-1 rounded hover:bg-[#14294e] text-[#6b6b6b] hover:text-[#f5f5f5] transition-colors shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Sub-tab bar */}
      <div className="flex border-b border-[#20406a] shrink-0">
        {DRILL_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setDrillTab(tab.id)}
            className={[
              'flex-1 py-2 text-xs font-medium transition-colors',
              drillTab === tab.id
                ? 'border-b-2 border-[#2abfdc] text-[#f5f5f5]'
                : 'text-[#6b6b6b] hover:text-[#8fb3c8]',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {drillTab === 'geral' && (
          <div className="space-y-2">
            {[
              { label: 'Tipo',             value: asset.type },
              { label: 'Rede',             value: asset.networkType },
              { label: 'Instalação',       value: fmtDate(asset.installationDate) },
              { label: 'Última inspeção',  value: fmtDate(asset.lastInspection) },
              {
                label: 'Próxima inspeção',
                value: fmtDate(asset.nextInspectionDue),
                warn: isOverdue(asset.nextInspectionDue),
              },
              { label: 'Material',         value: asset.material ?? '—' },
              { label: 'Diâmetro',         value: asset.diameter ? `${asset.diameter} mm` : '—' },
              { label: 'Comprimento',      value: asset.lengthM ? `${asset.lengthM} m` : '—' },
              { label: 'Clientes',         value: asset.customerCount?.toLocaleString('pt-BR') ?? '—' },
            ].map(({ label, value, warn }) => (
              <div key={label} className="flex justify-between items-start">
                <span className="text-[#6b6b6b] text-xs">{label}</span>
                <span className={`text-xs font-medium ml-2 text-right ${warn ? 'text-red-400' : 'text-[#f5f5f5]'}`}>
                  {value}{warn ? ' ⚠' : ''}
                </span>
              </div>
            ))}
            {asset.notes && (
              <div className="mt-3 p-2 bg-[#14294e] rounded text-xs text-[#8fb3c8] border border-[#20406a]">
                {asset.notes}
              </div>
            )}
          </div>
        )}

        {drillTab === 'monitoramento' && (
          <div className="space-y-3">
            {asset.flowLMin !== undefined && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b] text-xs">Vazão</span>
                <span className="text-[#f5f5f5] text-xs">{asset.flowLMin} L/min</span>
              </div>
            )}
            {asset.pressureBar !== undefined && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b] text-xs">Pressão</span>
                <span className="text-[#f5f5f5] text-xs">{asset.pressureBar} bar</span>
              </div>
            )}
            {asset.lossPercent !== undefined && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b] text-xs">Perda</span>
                <span className={`text-xs font-medium ${asset.lossPercent > 10 ? 'text-orange-400' : 'text-[#f5f5f5]'}`}>
                  {asset.lossPercent}%
                </span>
              </div>
            )}
            {asset.waterQuality && (
              <div className="flex justify-between">
                <span className="text-[#6b6b6b] text-xs">Qualidade água</span>
                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                  asset.waterQuality === 'good'     ? 'bg-green-900/40 text-green-300' :
                  asset.waterQuality === 'warning'  ? 'bg-yellow-900/40 text-yellow-300' :
                                                      'bg-red-900/40 text-red-300'
                }`}>
                  {asset.waterQuality === 'good' ? 'Boa' : asset.waterQuality === 'warning' ? 'Atenção' : 'Crítica'}
                </span>
              </div>
            )}
            {asset.sensorReadings && asset.sensorReadings.length > 0 && (
              <div className="mt-2">
                <div className="text-[#6b6b6b] text-xs font-semibold mb-2">Sensores</div>
                <div className="overflow-x-auto"><table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#6b6b6b] border-b border-[#20406a]">
                      <th className="text-left py-1">Parâmetro</th>
                      <th className="text-right py-1">Valor</th>
                      <th className="text-right py-1">Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {asset.sensorReadings.map((sr, i) => (
                      <tr key={i} className="border-b border-[#20406a]/50">
                        <td className="py-1 text-[#8fb3c8]">{sr.parameter}</td>
                        <td className="py-1 text-right text-[#f5f5f5]">{sr.value} {sr.unit}</td>
                        <td className="py-1 text-right text-[#6b6b6b]">
                          {new Date(sr.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              </div>
            )}
            {!asset.sensorReadings?.length && asset.flowLMin === undefined && asset.pressureBar === undefined && (
              <p className="text-[#6b6b6b] text-xs italic">Sem dados de monitoramento.</p>
            )}
          </div>
        )}

        {drillTab === 'historico' && (
          <div className="space-y-3">
            {mockHistory.length === 0 ? (
              <p className="text-[#6b6b6b] text-xs italic">Sem histórico disponível.</p>
            ) : (
              <div className="relative pl-4 border-l border-[#20406a]">
                {mockHistory.map((entry, i) => (
                  <div key={i} className="mb-4 relative">
                    <div className="absolute -left-[17px] w-2.5 h-2.5 rounded-full bg-[#2abfdc] border-2 border-[#112645]" />
                    <div className="text-[#6b6b6b] text-xs">{fmtDate(entry.date)}</div>
                    <div className="text-[#f5f5f5] text-xs font-medium mt-0.5">{entry.label}</div>
                    <div className="text-[#8fb3c8] text-xs mt-0.5">{entry.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {drillTab === 'os' && (
          <div className="space-y-2">
            {assetOrders.length === 0 ? (
              <p className="text-[#6b6b6b] text-xs italic">Nenhuma OS vinculada a este ativo.</p>
            ) : (
              assetOrders.map((order) => (
                <div key={order.id} className="bg-[#14294e] rounded border border-[#20406a] p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#6b6b6b] text-xs font-mono">{order.code}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      order.priority === 'emergency' ? 'bg-red-900/40 text-red-300'    :
                      order.priority === 'high'      ? 'bg-orange-900/40 text-orange-300' :
                      order.priority === 'medium'    ? 'bg-yellow-900/40 text-yellow-300' :
                                                       'bg-gray-800 text-gray-400'
                    }`}>
                      {order.priority === 'emergency' ? 'Emergência' :
                       order.priority === 'high'      ? 'Alta'       :
                       order.priority === 'medium'    ? 'Média'      : 'Baixa'}
                    </span>
                  </div>
                  <div className="text-[#f5f5f5] text-xs">{order.description}</div>
                  <div className="text-[#6b6b6b] text-xs mt-1">
                    Status: {order.status === 'pending'     ? 'Pendente'      :
                             order.status === 'in_progress' ? 'Em Execução'   :
                             order.status === 'completed'   ? 'Concluída'     : 'Cancelada'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
