import 'leaflet/dist/leaflet.css'
import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, Polyline, LayersControl, ScaleControl } from 'react-leaflet'
import * as L from 'leaflet'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useThemeStore } from '@/store/themeStore'
import type { ObraStatus } from '@/types'

// ─── Tile URLs ────────────────────────────────────────────────────────────────

const TILES = {
  voyager:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
} as const

const STATUS_COLOR: Record<ObraStatus, string> = {
  active:    '#2abfdc',
  planning:  '#3b82f6',
  paused:    '#eab308',
  completed: '#22c55e',
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#2abfdc',
  medium:   '#eab308',
  low:      '#22c55e',
}

// ─── Site marker ──────────────────────────────────────────────────────────────

function createSiteIcon(status: ObraStatus) {
  const color = STATUS_COLOR[status]
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
    iconSize:   [18, 18],
    iconAnchor: [9, 9],
  })
}

// ─── Equipment marker ─────────────────────────────────────────────────────────

function createEquipIcon(isIdle: boolean) {
  const color = isIdle ? '#6b6b6b' : '#22c55e'
  return L.divIcon({
    className: '',
    html: `<div style="width:12px;height:12px;border-radius:3px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);transform:rotate(45deg);"></div>`,
    iconSize:   [12, 12],
    iconAnchor: [6, 6],
  })
}

// ─── Accepted route animation CSS ─────────────────────────────────────────────

const ACCEPTED_ANIM_CSS = `
@keyframes dashMove {
  to { stroke-dashoffset: -32; }
}
.route-accepted path {
  animation: dashMove 1.2s linear infinite;
}
`

// ─── Map CSS ──────────────────────────────────────────────────────────────────

function getMapCSS(isDark: boolean) {
  const bg     = isDark ? '#14294e' : '#ffffff'
  const border = isDark ? '#20406a' : '#d4d8df'
  const text   = isDark ? '#f5f5f5' : '#1a1d23'
  return `
  .leaflet-control-zoom a { background: #fff !important; border-color: #d4d8df !important; color: #505863 !important; }
  .leaflet-control-zoom a:hover { background: #f0f2f5 !important; color: #2abfdc !important; }
  .leaflet-control-attribution { background: rgba(255,255,255,0.85) !important; color: #78828f !important; font-size: 9px !important; }
  .leaflet-control-layers { background: ${bg} !important; border: 1px solid ${border} !important; border-radius: 8px !important; }
  .leaflet-control-layers label { color: ${text} !important; }
  .leaflet-tooltip { background: ${bg}; border: 1px solid ${border}; color: ${text}; font-size: 11px; padding: 3px 8px; border-radius: 6px; }
  .leaflet-tooltip-top:before { border-top-color: ${border}; }
`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FleetRoutingMap() {
  const routingRecs  = useOtimizacaoFrotaStore((s) => s.routingRecs)
  const sites        = useTorreStore((s) => s.sites)
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const isDark       = useThemeStore((s) => s.theme === 'dark')

  // ── Memoized derivations ─────────────────────────────────────────────────────
  const mapCSS      = useMemo(() => getMapCSS(isDark), [isDark])
  const withCoords  = useMemo(() => sites.filter((s) => s.lat != null && s.lng != null), [sites])
  const equipsOnMap = useMemo(() => equipamentos.filter((e) => e.lat !== null && e.lng !== null), [equipamentos])
  const routeLines  = useMemo(() => routingRecs.filter(
    (r) => r.accepted !== false && r.fromLat !== null && r.fromLng !== null && r.toLat !== null && r.toLng !== null
  ), [routingRecs])

  return (
    <div className="w-full rounded-xl overflow-hidden border border-[#20406a]" style={{ height: 380 }}>
      <style>{mapCSS}{ACCEPTED_ANIM_CSS}</style>
      <MapContainer
        center={[-23.5400, -46.6300]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Voyager">
            <TileLayer url={TILES.voyager} subdomains="abcd" maxZoom={20}
              attribution='&copy; OpenStreetMap &copy; CARTO' />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Dark Matter">
            <TileLayer url={TILES.dark} subdomains="abcd" maxZoom={20}
              attribution='&copy; OpenStreetMap &copy; CARTO' />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satélite">
            <TileLayer url={TILES.satellite} maxZoom={19}
              attribution='&copy; Esri' />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="Canteiros">
            <>
              {withCoords.map((site) => (
                <Marker key={site.id} position={[site.lat!, site.lng!]} icon={createSiteIcon(site.status)}>
                  <Tooltip direction="top" offset={[0, -12]}>{site.code} — {site.name}</Tooltip>
                </Marker>
              ))}
            </>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Equipamentos">
            <>
              {equipsOnMap.map((eq) => (
                <Marker key={eq.id} position={[eq.lat!, eq.lng!]} icon={createEquipIcon(eq.status === 'idle')}>
                  <Tooltip direction="top" offset={[0, -8]}>
                    {eq.code} · {eq.name} · {eq.status === 'idle' ? '⚪ Ocioso' : '🟢 Ativo'}
                  </Tooltip>
                </Marker>
              ))}
            </>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Rotas Sugeridas">
            <>
              {routeLines.map((r) => (
                <Polyline
                  key={`route-${r.id}`}
                  positions={[[r.fromLat!, r.fromLng!], [r.toLat!, r.toLng!]]}
                  className={r.accepted === true ? 'route-accepted' : ''}
                  pathOptions={{
                    color:     PRIORITY_COLOR[r.priority] ?? '#2abfdc',
                    weight:    r.accepted === true ? 3.5 : 3,
                    dashArray: '10 6',
                    opacity:   r.accepted === true ? 1 : 0.75,
                  }}
                >
                  <Tooltip sticky>
                    {r.equipmentCode} → {r.toSiteName} · {r.estimatedDistanceKm}km
                    {r.accepted === true ? ' ✓ Aceito' : ''}
                  </Tooltip>
                </Polyline>
              ))}
            </>
          </LayersControl.Overlay>
        </LayersControl>

        <ScaleControl position="bottomleft" imperial={false} />
      </MapContainer>
    </div>
  )
}
