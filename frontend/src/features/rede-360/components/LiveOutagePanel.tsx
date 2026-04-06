import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'

export function LiveOutagePanel() {
  const { outages, assets } = useRede360Store(
    useShallow((s) => ({ outages: s.outages, assets: s.assets }))
  )
  const [basemap, setBasemap] = useState('dark')

  const activeOutages = outages.filter((o) => o.status === 'active')
  const monitoringOutages = outages.filter((o) => o.status === 'monitoring')
  const totalAffectedCustomers = outages
    .filter((o) => o.status !== 'resolved')
    .reduce((acc, o) => acc + (o.affectedCustomers ?? 0), 0)

  const BASEMAP_URL: Record<string, string> = {
    dark:    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    streets: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  }

  function fmtTime(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
  }

  return (
    <div className="flex flex-col h-full">
      {/* KPI bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-[#0a1628] border-b border-[#525252] shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-red-400 text-sm font-semibold">{activeOutages.length} Interrupções Ativas</span>
        </div>
        <div className="text-[#6b6b6b] text-xs">|</div>
        <div className="text-yellow-400 text-xs">{monitoringOutages.length} Em Monitoramento</div>
        <div className="text-[#6b6b6b] text-xs">|</div>
        <div className="text-[#a3a3a3] text-xs">{totalAffectedCustomers.toLocaleString('pt-BR')} clientes afetados</div>
        <div className="ml-auto">
          <select value={basemap} onChange={(e) => setBasemap(e.target.value)}
            className="bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5]">
            <option value="dark">Dark</option>
            <option value="streets">Ruas</option>
          </select>
        </div>
      </div>

      {/* Map */}
      <div style={{ height: '55%' }} className="shrink-0">
        <MapContainer center={[-23.55, -46.63]} zoom={12} style={{ height: '100%' }}>
          <TileLayer url={BASEMAP_URL[basemap] ?? BASEMAP_URL.dark} attribution="© CartoDB" />
          {outages.filter((o) => o.status !== 'resolved').map((outage) => {
            const asset = assets.find((a) => outage.affectedAssetIds.includes(a.id))
            if (!asset) return null
            return (
              <CircleMarker key={outage.id} center={[asset.lat, asset.lng]}
                radius={outage.status === 'active' ? 22 : 16}
                pathOptions={{
                  fillColor: outage.status === 'active' ? '#ef4444' : '#eab308',
                  color: outage.status === 'active' ? '#ef4444' : '#eab308',
                  weight: 2, fillOpacity: 0.3,
                }}>
                <Tooltip permanent direction="top">
                  <div className="text-xs font-semibold">{outage.type}</div>
                </Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      {/* Outage table */}
      <div className="flex-1 overflow-auto overflow-x-auto bg-[#2c2c2c]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[#0a1628]">
            <tr className="border-b border-[#525252] text-[#6b6b6b]">
              <th className="text-left px-4 py-2">ID</th>
              <th className="text-left px-4 py-2">Tipo</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Ativos Afetados</th>
              <th className="text-left px-4 py-2">Clientes</th>
              <th className="text-left px-4 py-2">Início</th>
              <th className="text-left px-4 py-2">ETR</th>
              <th className="text-left px-4 py-2">Causa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#525252]/50">
            {outages.map((o) => (
              <tr key={o.id} className="hover:bg-[#3d3d3d] transition-colors">
                <td className="px-4 py-2 font-mono text-[#a3a3a3]">{o.id}</td>
                <td className="px-4 py-2 text-[#f5f5f5]">{o.type}</td>
                <td className="px-4 py-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs ${o.status === 'active' ? 'bg-red-900/40 text-red-300' : o.status === 'monitoring' ? 'bg-yellow-900/40 text-yellow-300' : 'bg-green-900/40 text-green-300'}`}>
                    {o.status === 'active' ? 'Ativo' : o.status === 'monitoring' ? 'Monitoramento' : 'Resolvido'}
                  </span>
                </td>
                <td className="px-4 py-2 text-[#a3a3a3]">{o.affectedAssetIds.length}</td>
                <td className="px-4 py-2 text-[#a3a3a3]">{(o.affectedCustomers ?? 0).toLocaleString('pt-BR')}</td>
                <td className="px-4 py-2 text-[#a3a3a3]">{fmtTime(o.startTime)}</td>
                <td className="px-4 py-2 text-[#a3a3a3]">{o.estimatedRestoreTime ? fmtTime(o.estimatedRestoreTime) : '—'}</td>
                <td className="px-4 py-2 text-[#6b6b6b] max-w-xs truncate">{o.cause ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
