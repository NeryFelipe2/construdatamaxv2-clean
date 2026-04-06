import { useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'
import { GridLayerPanel } from './GridLayerPanel'
import { AtivoDrillDownPanel } from './AtivoDrillDownPanel'
import type { RiskLevel, MapNetworkType } from '@/types'

const RISK_COLORS: Record<RiskLevel, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
}

const NETWORK_COLORS: Record<MapNetworkType, string> = {
  sewer:    '#f97316',
  water:    '#38bdf8',
  drainage: '#4ade80',
  civil:    '#94a3b8',
  generic:  '#a78bfa',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8', medium: '#eab308', high: '#f97316', emergency: '#ef4444',
}

const BASEMAPS: Record<string, { url: string; label: string; attribution: string }> = {
  dark:      { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',             label: 'Dark',      attribution: '© CartoDB' },
  streets:   { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',  label: 'Ruas',      attribution: '© CartoDB' },
  satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', label: 'Satélite', attribution: '© Esri' },
  light:     { url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',            label: 'Light',     attribution: '© CartoDB' },
}

export function MapaOperacionalPanel() {
  const {
    assets, serviceOrders, outages, circuitAssets, deviceAssets, weatherStations,
    layerVisibility, selectedAssetId, selectedCircuitId,
    setSelectedAssetId, setSelectedCircuitId,
  } = useRede360Store(
    useShallow((s) => ({
      assets:               s.assets,
      serviceOrders:        s.serviceOrders,
      outages:              s.outages,
      circuitAssets:        s.circuitAssets,
      deviceAssets:         s.deviceAssets,
      weatherStations:      s.weatherStations,
      layerVisibility:      s.layerVisibility,
      selectedAssetId:      s.selectedAssetId,
      selectedCircuitId:    s.selectedCircuitId,
      setSelectedAssetId:   s.setSelectedAssetId,
      setSelectedCircuitId: s.setSelectedCircuitId,
    }))
  )

  const [basemap, setBasemap] = useState('dark')
  const bm = BASEMAPS[basemap] ?? BASEMAPS.dark

  // suppress unused variable warnings
  void selectedAssetId
  void selectedCircuitId

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left layer panel */}
      <GridLayerPanel />

      {/* Map area */}
      <div className="flex-1 relative">
        <MapContainer
          center={[-23.55, -46.63]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer url={bm.url} attribution={bm.attribution} />

          {/* Circuit polylines */}
          {layerVisibility.circuits && circuitAssets.map((c) =>
            c.polyline ? (
              <Polyline
                key={`pl-${c.id}`}
                positions={c.polyline}
                pathOptions={{
                  color: NETWORK_COLORS[c.networkType],
                  weight: 3,
                  opacity: 0.75,
                }}
              />
            ) : null
          )}

          {/* Circuit centroid markers */}
          {layerVisibility.circuits && circuitAssets.map((c) => (
            <CircleMarker
              key={`cm-${c.id}`}
              center={[c.lat, c.lng]}
              radius={9}
              pathOptions={{
                fillColor: RISK_COLORS[c.riskLevel],
                color: '#38bdf8',
                weight: 2,
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => setSelectedCircuitId(c.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-xs">
                  <strong>{c.circuitId}</strong> — {c.circuitName}<br />
                  {c.circuitClass} · {c.districtName}
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Asset markers (NetworkAsset) */}
          {layerVisibility.assets && assets
            .filter((a) => layerVisibility[a.networkType] !== false)
            .map((a) => (
              <CircleMarker
                key={a.id}
                center={[a.lat, a.lng]}
                radius={7}
                pathOptions={{
                  fillColor: RISK_COLORS[a.riskLevel],
                  color: 'white',
                  weight: 1.5,
                  fillOpacity: 0.85,
                }}
                eventHandlers={{ click: () => setSelectedAssetId(a.id) }}
              >
                <Tooltip direction="top" offset={[0, -6]}>
                  <div className="text-xs"><strong>{a.code}</strong> — {a.name}</div>
                </Tooltip>
              </CircleMarker>
            ))
          }

          {/* Device markers */}
          {layerVisibility.assets && deviceAssets.map((d) => (
            <CircleMarker
              key={d.id}
              center={[d.lat, d.lng]}
              radius={6}
              pathOptions={{
                fillColor: '#f97316',
                color: 'white',
                weight: 1.5,
                fillOpacity: 0.85,
              }}
            >
              <Tooltip direction="top" offset={[0, -5]}>
                <div className="text-xs"><strong>{d.deviceId}</strong> — {d.deviceType}</div>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Weather station markers */}
          {layerVisibility.assets && weatherStations.map((w) => (
            <CircleMarker
              key={w.id}
              center={[w.lat, w.lng]}
              radius={9}
              pathOptions={{
                fillColor: '#a78bfa',
                color: 'white',
                weight: 2,
                fillOpacity: 0.9,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-xs">
                  <strong>{w.stationId}</strong> — {w.stationName}<br />
                  {w.currentTempC}°C · {w.windKmh} km/h
                </div>
              </Tooltip>
            </CircleMarker>
          ))}

          {/* Service order markers */}
          {layerVisibility.orders && serviceOrders.map((order) => {
            const asset = assets.find((a) => a.id === order.assetId)
            if (!asset) return null
            return (
              <CircleMarker
                key={order.id}
                center={[asset.lat + 0.001, asset.lng + 0.001]}
                radius={6}
                pathOptions={{
                  fillColor: PRIORITY_COLORS[order.priority] ?? '#94a3b8',
                  color: 'white',
                  weight: 1,
                  fillOpacity: 0.8,
                  dashArray: '4',
                }}
              >
                <Tooltip direction="top">
                  <div className="text-xs"><strong>{order.code}</strong> — {order.type}</div>
                </Tooltip>
              </CircleMarker>
            )
          })}

          {/* Outage overlays */}
          {layerVisibility.outages && outages
            .filter((o) => o.status !== 'resolved')
            .map((outage) => {
              const asset = assets.find((a) => outage.affectedAssetIds.includes(a.id))
              if (!asset) return null
              return (
                <CircleMarker
                  key={outage.id}
                  center={[asset.lat, asset.lng]}
                  radius={20}
                  pathOptions={{
                    fillColor: '#ef4444',
                    color: '#ef4444',
                    weight: 2,
                    fillOpacity: 0.2,
                  }}
                >
                  <Tooltip direction="top">
                    <div className="text-xs">
                      <strong>Interrupção</strong> — {outage.type}<br />
                      {outage.affectedCustomers} clientes afetados
                    </div>
                  </Tooltip>
                </CircleMarker>
              )
            })
          }
        </MapContainer>

        {/* Basemap selector */}
        <div className="absolute top-3 right-3 z-[1000]">
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value)}
            className="bg-[#2c2c2c]/90 border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none backdrop-blur-sm"
          >
            {Object.entries(BASEMAPS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {/* Map legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-[#2c2c2c]/90 border border-[#525252] rounded-lg p-2 backdrop-blur-sm">
          <div className="text-[#6b6b6b] text-xs font-semibold mb-1.5">Legenda</div>
          {[
            { color: '#ef4444', label: 'Crítico' },
            { color: '#f97316', label: 'Alto' },
            { color: '#eab308', label: 'Médio' },
            { color: '#22c55e', label: 'Baixo' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-xs text-[#a3a3a3]">{label}</span>
            </div>
          ))}
          <div className="border-t border-[#525252] mt-1 pt-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#f97316]" />
              <span className="text-xs text-[#a3a3a3]">Dispositivo</span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#a78bfa]" />
              <span className="text-xs text-[#a3a3a3]">Estação NWS</span>
            </div>
          </div>
        </div>

        {/* Drill-down panel */}
        <AtivoDrillDownPanel />
      </div>
    </div>
  )
}
