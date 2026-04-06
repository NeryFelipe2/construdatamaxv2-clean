/**
 * RiscoPanel — Risk analysis panel with KPI cards, risk list, and bar chart.
 */
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import type { RiskLevel, NetworkAssetType } from '@/types'

const RISK_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low']

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

const RISK_BG: Record<RiskLevel, string> = {
  critical: 'bg-red-900/40 text-red-300 border border-red-700/50',
  high:     'bg-orange-900/40 text-orange-300 border border-orange-700/50',
  medium:   'bg-yellow-900/40 text-yellow-300 border border-yellow-700/50',
  low:      'bg-green-900/40 text-green-300 border border-green-700/50',
}

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: 'Crítico',
  high:     'Alto',
  medium:   'Médio',
  low:      'Baixo',
}

const ASSET_TYPE_LABELS: Record<NetworkAssetType, string> = {
  circuit:    'Circuito',
  pipe:       'Tubulação',
  pv:         'PV',
  structure:  'Estrutura',
  device:     'Dispositivo',
  vegetation: 'Vegetação',
  hardening:  'Reforço',
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

export function RiscoPanel() {
  const { assets, addServiceOrder } = useRede360Store(
    useShallow((s) => ({
      assets:          s.assets,
      addServiceOrder: s.addServiceOrder,
    }))
  )

  const riskCounts = RISK_ORDER.reduce<Record<RiskLevel, number>>(
    (acc, r) => ({ ...acc, [r]: assets.filter((a) => a.riskLevel === r).length }),
    { critical: 0, high: 0, medium: 0, low: 0 }
  )

  const sortedAssets = [...assets].sort(
    (a, b) => RISK_ORDER.indexOf(a.riskLevel) - RISK_ORDER.indexOf(b.riskLevel)
  )

  // Chart data: group by type, count per risk level
  const assetTypes = [...new Set(assets.map((a) => a.type))] as NetworkAssetType[]
  const W = 360, H = 160, PAD = { l: 60, r: 12, t: 12, b: 28 }
  const iw = W - PAD.l - PAD.r
  const maxCount = Math.max(
    ...assetTypes.map((t) => assets.filter((a) => a.type === t).length),
    1
  )
  const barWidth = assetTypes.length > 0 ? iw / assetTypes.length * 0.7 : 40

  return (
    <div className="p-4 h-full overflow-y-auto space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {RISK_ORDER.map((risk) => (
          <div
            key={risk}
            className="bg-[#333333] rounded-xl border border-[#525252] p-4"
            style={{ borderLeftColor: RISK_COLORS[risk], borderLeftWidth: 3 }}
          >
            <div className="text-[#6b6b6b] text-xs mb-1">{RISK_LABELS[risk]}</div>
            <div className="text-2xl font-bold" style={{ color: RISK_COLORS[risk] }}>
              {riskCounts[risk]}
            </div>
            <div className="text-[#6b6b6b] text-xs mt-0.5">ativos</div>
          </div>
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ativos em risco */}
        <div className="bg-[#333333] rounded-xl border border-[#525252] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#525252]">
            <h3 className="text-[#f5f5f5] text-sm font-semibold">Ativos em Risco</h3>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            {sortedAssets.map((asset) => {
              const canGenerateOS = asset.riskLevel === 'critical' || asset.riskLevel === 'high'
              const overdue = isOverdue(asset.nextInspectionDue)
              return (
                <div key={asset.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-[#525252]/50 hover:bg-[#3d3d3d] transition-colors">
                  <span className={`px-1.5 py-0.5 rounded text-xs shrink-0 mt-0.5 ${RISK_BG[asset.riskLevel]}`}>
                    {RISK_LABELS[asset.riskLevel]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[#f5f5f5] text-xs font-medium truncate">{asset.code} — {asset.name}</div>
                    <div className="text-[#6b6b6b] text-xs">
                      {ASSET_TYPE_LABELS[asset.type]}
                      {asset.nextInspectionDue && (
                        <> · Due: <span className={overdue ? 'text-red-400' : ''}>{fmtDate(asset.nextInspectionDue)}{overdue ? ' ⚠' : ''}</span></>
                      )}
                    </div>
                  </div>
                  {canGenerateOS && (
                    <button
                      onClick={() => addServiceOrder({
                        code:        `OS-AUTO-${Date.now().toString().slice(-4)}`,
                        assetId:     asset.id,
                        type:        'Inspeção',
                        priority:    'high',
                        status:      'pending',
                        description: `Inspeção gerada automaticamente para ativo de risco ${RISK_LABELS[asset.riskLevel]}: ${asset.name}`,
                      })}
                      className="shrink-0 px-2 py-1 rounded bg-[#3d3d3d] hover:bg-[#525252] text-[#f97316] text-xs border border-[#525252] transition-colors"
                    >
                      Gerar OS
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Bar chart: Distribuição por Tipo */}
        <div className="bg-[#333333] rounded-xl border border-[#525252] p-4">
          <h3 className="text-[#f5f5f5] text-sm font-semibold mb-4">Distribuição por Tipo</h3>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const y = PAD.t + (H - PAD.t - PAD.b) * (1 - pct)
              const val = Math.round(pct * maxCount)
              return (
                <g key={pct}>
                  <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#525252" strokeWidth="1" strokeDasharray="3,3" />
                  <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#6b6b6b">{val}</text>
                </g>
              )
            })}

            {/* Bars: stacked by risk level */}
            {assetTypes.map((type, ti) => {
              const x = PAD.l + (ti / assetTypes.length) * iw + (iw / assetTypes.length - barWidth) / 2
              let yTop = H - PAD.b
              return (
                <g key={type}>
                  {RISK_ORDER.slice().reverse().map((risk) => {
                    const count = assets.filter((a) => a.type === type && a.riskLevel === risk).length
                    if (count === 0) return null
                    const barH = (count / maxCount) * (H - PAD.t - PAD.b)
                    yTop -= barH
                    return (
                      <rect
                        key={risk}
                        x={x}
                        y={yTop}
                        width={barWidth}
                        height={barH}
                        fill={RISK_COLORS[risk]}
                        opacity={0.8}
                      />
                    )
                  })}
                  <text
                    x={x + barWidth / 2}
                    y={H - PAD.b + 14}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#6b6b6b"
                  >
                    {ASSET_TYPE_LABELS[type].slice(0, 6)}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-2">
            {RISK_ORDER.map((risk) => (
              <div key={risk} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: RISK_COLORS[risk] }} />
                <span className="text-[#6b6b6b] text-xs">{RISK_LABELS[risk]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
