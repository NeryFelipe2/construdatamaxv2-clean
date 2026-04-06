import { ChevronDown, ChevronUp } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import type { GridAssetTab, RiskLevel } from '@/types'

const RISK_COLORS: Record<RiskLevel, string> = {
  low:      'bg-green-900/40 text-green-300',
  medium:   'bg-yellow-900/40 text-yellow-300',
  high:     'bg-orange-900/40 text-orange-300',
  critical: 'bg-red-900/40 text-red-300',
}
const RISK_LABELS: Record<RiskLevel, string> = { low: 'Low', medium: 'Moderate', high: 'High', critical: 'Critical' }

function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`px-1.5 py-0.5 rounded text-xs ${RISK_COLORS[level]}`}>{RISK_LABELS[level]}</span>
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-3 py-1.5 text-[#6b6b6b] font-medium text-xs whitespace-nowrap">{children}</th>
}
function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-1.5 text-xs text-[#a3a3a3] whitespace-nowrap ${mono ? 'font-mono' : ''}`}>{children}</td>
}

export function GridBottomPanel() {
  const store = useRede360Store(
    useShallow((s) => ({
      circuitAssets:      s.circuitAssets,
      deviceAssets:       s.deviceAssets,
      weatherStations:    s.weatherStations,
      customers:          s.customers,
      structureAssets:    s.structureAssets,
      vegetationPoints:   s.vegetationPoints,
      hardeningPoints:    s.hardeningPoints,
      activeGridTab:      s.activeGridTab,
      bottomPanelOpen:    s.bottomPanelOpen,
      setActiveGridTab:   s.setActiveGridTab,
      setBottomPanelOpen: s.setBottomPanelOpen,
    }))
  )

  const {
    circuitAssets, deviceAssets, weatherStations, customers, structureAssets,
    vegetationPoints, hardeningPoints, activeGridTab, bottomPanelOpen,
    setActiveGridTab, setBottomPanelOpen,
  } = store

  const TABS: { id: GridAssetTab; label: string; count: number; color: string }[] = [
    { id: 'circuit',    label: 'Circuit Asset',                        count: circuitAssets.length,    color: '#38bdf8' },
    { id: 'device',     label: 'Device Asset',                         count: deviceAssets.length,     color: '#f97316' },
    { id: 'weather',    label: 'NWS Weather Station',                  count: weatherStations.length,  color: '#a78bfa' },
    { id: 'customer',   label: 'Customer',                             count: customers.length,        color: '#eab308' },
    { id: 'structure',  label: 'Structure Asset',                      count: structureAssets.length,  color: '#94a3b8' },
    { id: 'vegetation', label: 'Vegetation Management Point Activity',  count: vegetationPoints.length, color: '#4ade80' },
    { id: 'hardening',  label: 'System Hardening Point Activity',      count: hardeningPoints.length,  color: '#f97316' },
  ]

  if (!bottomPanelOpen) {
    return (
      <div className="h-8 bg-[#2c2c2c] border-t border-[#525252] flex items-center px-3 shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto flex-1">
          {TABS.map((t) => (
            <span key={t.id} className="flex items-center gap-1 text-xs text-[#6b6b6b] whitespace-nowrap">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              {t.label} <span className="text-[#a3a3a3]">{t.count}</span>
            </span>
          ))}
        </div>
        <button onClick={() => setBottomPanelOpen(true)} className="ml-2 p-1 text-[#6b6b6b] hover:text-[#f5f5f5] shrink-0">
          <ChevronUp size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="h-52 bg-[#2c2c2c] border-t border-[#525252] flex flex-col shrink-0">
      {/* Tab strip */}
      <div className="flex items-center border-b border-[#525252] overflow-x-auto shrink-0 bg-[#0a1628]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveGridTab(tab.id)}
            className={[
              'flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-r border-[#525252] transition-colors shrink-0',
              activeGridTab === tab.id ? 'bg-[#3d3d3d] text-[#f5f5f5]' : 'text-[#6b6b6b] hover:text-[#a3a3a3]',
            ].join(' ')}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tab.color }} />
            {tab.label}
            <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#525252] text-[#a3a3a3] text-xs">{tab.count}</span>
          </button>
        ))}
        <button onClick={() => setBottomPanelOpen(false)} className="ml-auto px-3 py-2 text-[#6b6b6b] hover:text-[#f5f5f5] shrink-0">
          <ChevronDown size={14} />
        </button>
      </div>

      {/* Table area */}
      <div className="flex-1 overflow-auto">
        {activeGridTab === 'circuit' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a1628]">
              <tr className="border-b border-[#525252]">
                <Th>Circuit ID</Th><Th>Circuit Name</Th><Th>Circuit Class</Th>
                <Th>Risk Classification</Th><Th>Risk Level</Th><Th>Circuit Customer Count</Th>
                <Th>Protected Devices on Circuit</Th><Th>Installed Structures</Th>
                <Th>Line Segments</Th><Th>District Name</Th><Th>Is In Area of Interest</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {circuitAssets.map((c) => (
                <tr key={c.id} className="hover:bg-[#3d3d3d] transition-colors">
                  <Td mono>{c.circuitId}</Td>
                  <Td>{c.circuitName}</Td>
                  <Td>{c.circuitClass}</Td>
                  <Td>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${c.riskLevel === 'critical' ? 'bg-red-900/40 text-red-300' : c.riskLevel === 'high' ? 'bg-orange-900/40 text-orange-300' : c.riskLevel === 'medium' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-green-900/40 text-green-300'}`}>
                      {c.riskClassification}
                    </span>
                  </Td>
                  <td className="px-3 py-1.5"><RiskBadge level={c.riskLevel} /></td>
                  <Td>{c.customerCount.toLocaleString('pt-BR')}</Td>
                  <Td>{c.protectedDeviceCount}</Td>
                  <Td>{c.installedStructureCount.toLocaleString('pt-BR')}</Td>
                  <Td>{c.lineSegmentCount.toLocaleString('pt-BR')}</Td>
                  <Td>{c.districtName}</Td>
                  <Td>{c.isInAreaOfInterest ? '✓ Yes' : '— No'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeGridTab === 'device' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a1628]">
              <tr className="border-b border-[#525252]">
                <Th>Device ID</Th><Th>Type</Th><Th>Manufacturer</Th><Th>Model</Th>
                <Th>Status</Th><Th>Risk</Th><Th>Circuit ID</Th><Th>Installed</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {deviceAssets.map((d) => (
                <tr key={d.id} className="hover:bg-[#3d3d3d] transition-colors">
                  <Td mono>{d.deviceId}</Td>
                  <Td>{d.deviceType}</Td>
                  <Td>{d.manufacturer ?? '—'}</Td>
                  <Td>{d.model ?? '—'}</Td>
                  <Td>{d.status}</Td>
                  <td className="px-3 py-1.5"><RiskBadge level={d.riskLevel} /></td>
                  <Td mono>{d.circuitId ?? '—'}</Td>
                  <Td>{d.installedDate ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeGridTab === 'weather' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a1628]">
              <tr className="border-b border-[#525252]">
                <Th>Station ID</Th><Th>Station Name</Th><Th>Temp (°C)</Th>
                <Th>Wind (km/h)</Th><Th>Precip (mm)</Th><Th>Alerts</Th><Th>Last Updated</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {weatherStations.map((w) => (
                <tr key={w.id} className="hover:bg-[#3d3d3d] transition-colors">
                  <Td mono>{w.stationId}</Td>
                  <Td>{w.stationName}</Td>
                  <Td>{w.currentTempC ?? '—'}</Td>
                  <Td>{w.windKmh ?? '—'}</Td>
                  <Td>{w.precipitationMm ?? '—'}</Td>
                  <Td>{w.alerts && w.alerts.length > 0 ? w.alerts[0] : '—'}</Td>
                  <Td>{new Date(w.lastUpdated).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeGridTab === 'customer' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a1628]">
              <tr className="border-b border-[#525252]">
                <Th>Customer ID</Th><Th>Address</Th><Th>Service Type</Th><Th>Circuit ID</Th><Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-[#3d3d3d] transition-colors">
                  <Td mono>{c.customerId}</Td>
                  <Td>{c.address}</Td>
                  <Td>{c.serviceType}</Td>
                  <Td mono>{c.circuitId ?? '—'}</Td>
                  <Td>{c.status === 'active' ? <span className="text-green-400">Active</span> : <span className="text-[#6b6b6b]">Inactive</span>}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeGridTab === 'structure' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a1628]">
              <tr className="border-b border-[#525252]">
                <Th>Structure ID</Th><Th>Type</Th><Th>Condition</Th><Th>Risk</Th>
                <Th>Circuit ID</Th><Th>Inspection Date</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {structureAssets.map((s) => (
                <tr key={s.id} className="hover:bg-[#3d3d3d] transition-colors">
                  <Td mono>{s.structureId}</Td>
                  <Td>{s.structureType}</Td>
                  <Td>{s.condition}</Td>
                  <td className="px-3 py-1.5"><RiskBadge level={s.riskLevel} /></td>
                  <Td mono>{s.circuitId ?? '—'}</Td>
                  <Td>{s.inspectionDate ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeGridTab === 'vegetation' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a1628]">
              <tr className="border-b border-[#525252]">
                <Th>Point ID</Th><Th>Address</Th><Th>Priority</Th><Th>Status</Th>
                <Th>Last Trim</Th><Th>Circuit ID</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {vegetationPoints.map((v) => (
                <tr key={v.id} className="hover:bg-[#3d3d3d] transition-colors">
                  <Td mono>{v.pointId}</Td>
                  <Td>{v.address ?? '—'}</Td>
                  <Td>{v.priority}</Td>
                  <Td>{v.status}</Td>
                  <Td>{v.lastTrimDate ?? '—'}</Td>
                  <Td mono>{v.circuitId ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeGridTab === 'hardening' && (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#0a1628]">
              <tr className="border-b border-[#525252]">
                <Th>Point ID</Th><Th>Type</Th><Th>Status</Th><Th>Completion</Th>
                <Th>Circuit ID</Th><Th>Risk</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#525252]/50">
              {hardeningPoints.map((h) => (
                <tr key={h.id} className="hover:bg-[#3d3d3d] transition-colors">
                  <Td mono>{h.pointId}</Td>
                  <Td>{h.hardeningType}</Td>
                  <Td>{h.status}</Td>
                  <Td>{h.completionDate ?? '—'}</Td>
                  <Td mono>{h.circuitId ?? '—'}</Td>
                  <td className="px-3 py-1.5"><RiskBadge level={h.riskLevel} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
