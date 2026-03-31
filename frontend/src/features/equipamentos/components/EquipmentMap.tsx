import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Tooltip,
  Circle, Polyline, LayersControl, ScaleControl, useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { EquipmentStatus } from '@/types'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { useThemeStore } from '@/store/themeStore'
import { STATUS_CONFIG } from '../constants'

// ─── Tile layer URLs ───────────────────────────────────────────────────────────

const TILES = {
  voyager:  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark:     'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
} as const

const TILE_ATTR = {
  voyager:   '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  dark:      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, GeoEye',
}

// ─── Priority colors for routing polylines ────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#2abfdc',
  medium:   '#eab308',
  low:      '#22c55e',
}

// ─── Custom SVG pin marker ─────────────────────────────────────────────────────

function createPinIcon(status: EquipmentStatus, selected: boolean, label: string): L.DivIcon {
  const color = STATUS_CONFIG[status].color
  const size = selected ? 42 : 34
  const pulse = status === 'alert'
    ? `<div style="
        position:absolute;top:0;left:0;right:0;bottom:0;border-radius:50%;
        border:2px solid ${color};opacity:0.5;
        animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;
      "></div>`
    : ''

  const shortLabel = label.length > 14 ? label.slice(0, 13) + '…' : label

  return L.divIcon({
    className: '',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
        <div style="position:relative;width:${size}px;height:${size + 10}px;">
          ${pulse}
          <svg xmlns="http://www.w3.org/2000/svg"
            width="${size}" height="${size + 10}"
            viewBox="0 0 34 44" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,.55))">
            <path d="M17 0C7.611 0 0 7.611 0 17c0 6.23 3.34 11.68 8.32 14.74L17 44l8.68-12.26C30.66 28.68 34 23.23 34 17 34 7.611 26.389 0 17 0z"
              fill="${color}" />
            <circle cx="17" cy="17" r="8"
              fill="${selected ? '#fff' : 'rgba(255,255,255,0.92)'}"/>
            ${selected
              ? `<circle cx="17" cy="17" r="4" fill="${color}"/>`
              : `<circle cx="17" cy="17" r="3" fill="${color}" opacity="0.7"/>`}
          </svg>
        </div>
        <div style="background:rgba(13,17,23,0.85);border:1px solid ${color}40;border-radius:3px;
          padding:1px 5px;font-size:9px;font-weight:600;color:${color};white-space:nowrap;
          font-family:Inter,system-ui,sans-serif;line-height:1.4;pointer-events:none;">
          ${shortLabel}
        </div>
      </div>`,
    iconSize: [size, size + 28],
    iconAnchor: [size / 2, size + 10],
    popupAnchor: [0, -(size + 18)],
  })
}

// ─── Fly-to on selection ───────────────────────────────────────────────────────

function MapController() {
  const map          = useMap()
  const selectedId   = useEquipamentosStore((s) => s.selectedId)
  const equipamentos = useEquipamentosStore((s) => s.equipamentos)
  const prevId       = useRef<string | null>(null)

  useEffect(() => {
    if (selectedId && selectedId !== prevId.current) {
      const eq = equipamentos.find((e) => e.id === selectedId)
      if (eq && eq.lat !== null && eq.lng !== null) {
        map.flyTo([eq.lat, eq.lng], Math.max(map.getZoom(), 16), { duration: 0.9 })
      }
    }
    prevId.current = selectedId
  }, [selectedId, equipamentos, map])

  return null
}

// ─── CSS ───────────────────────────────────────────────────────────────────────

function getMapCSS(isDark: boolean) {
  const bg     = isDark ? '#14294e' : '#ffffff'
  const border = isDark ? '#20406a' : '#d4d8df'
  const text   = isDark ? '#f5f5f5' : '#1a1d23'
  const muted  = isDark ? '#6b6b6b' : '#78828f'
  return `
  @keyframes ping {
    75%, 100% { transform: scale(1.8); opacity: 0; }
  }
  .equip-popup .leaflet-popup-content-wrapper {
    background: ${bg}; border: 1px solid ${border};
    border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,${isDark ? '0.6' : '0.15'});
    color: ${text}; padding: 0;
  }
  .equip-popup .leaflet-popup-content { margin: 0; }
  .equip-popup .leaflet-popup-tip { background: ${bg}; }
  .equip-popup .leaflet-popup-close-button {
    color: ${muted} !important; font-size: 16px !important;
    top: 8px !important; right: 10px !important;
  }
  .equip-popup .leaflet-popup-close-button:hover { color: ${text} !important; }
  .leaflet-control-zoom a { background: #fff !important; border-color: #d4d8df !important; color: #505863 !important; }
  .leaflet-control-zoom a:hover { background: #f0f2f5 !important; color: #2abfdc !important; }
  .leaflet-control-attribution { background: rgba(255,255,255,0.85) !important; color: #78828f !important; font-size: 9px !important; }
  .leaflet-control-attribution a { color: #505863 !important; }
  .leaflet-control-layers { background: ${bg} !important; border: 1px solid ${border} !important; border-radius: 8px !important; color: ${text} !important; }
  .leaflet-control-layers-toggle { background-color: ${bg} !important; }
  .leaflet-control-layers label { color: ${text} !important; }
  .leaflet-tooltip { background: ${bg}; border: 1px solid ${border}; color: ${text}; font-size: 11px; padding: 3px 8px; border-radius: 6px; }
  .leaflet-tooltip-top:before { border-top-color: ${border}; }
`
}

// ─── Filter pill ───────────────────────────────────────────────────────────────

const FILTER_OPTIONS: Array<{ value: EquipmentStatus | null; label: string }> = [
  { value: null,          label: 'Todos'      },
  { value: 'active',      label: 'Ativo'      },
  { value: 'idle',        label: 'Parado'     },
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'alert',       label: 'Alerta'     },
  { value: 'offline',     label: 'Inativo'    },
]

// ─── Main map component ────────────────────────────────────────────────────────

export function EquipmentMap() {
  const equipamentos      = useEquipamentosStore((s) => s.equipamentos)
  const selectedId        = useEquipamentosStore((s) => s.selectedId)
  const selectEquipamento = useEquipamentosStore((s) => s.selectEquipamento)
  const updateLocation    = useEquipamentosStore((s) => s.updateLocation)
  const setEditing        = useEquipamentosStore((s) => s.setEditing)
  const routingRecs       = useOtimizacaoFrotaStore((s) => s.routingRecs)

  const theme = useThemeStore((s) => s.theme)
  const isDark = theme === 'dark'

  const [filterStatus, setFilterStatus] = useState<EquipmentStatus | null>(null)
  const [isFullscreen,  setIsFullscreen] = useState(false)

  // ── Memoized derivations ─────────────────────────────────────────────────────
  const mapCSS      = useMemo(() => getMapCSS(isDark), [isDark])
  const positioned  = useMemo(() => equipamentos.filter((e) => e.lat !== null && e.lng !== null), [equipamentos])
  const visible     = useMemo(
    () => filterStatus ? positioned.filter((e) => e.status === filterStatus) : positioned,
    [filterStatus, positioned]
  )
  const routeLines  = useMemo(() => routingRecs.filter(
    (r) => r.accepted !== false && r.fromLat !== null && r.fromLng !== null && r.toLat !== null && r.toLng !== null
  ), [routingRecs])
  const statusCounts = useMemo(() => Object.entries(STATUS_CONFIG).map(([status, cfg]) => ({
    status: status as EquipmentStatus,
    label:  cfg.label,
    color:  cfg.color,
    count:  positioned.filter((e) => e.status === status).length,
  })), [positioned])

  // ── Memoized icon factory ────────────────────────────────────────────────────
  const getIcon = useCallback((status: EquipmentStatus, selected: boolean, label: string) =>
    createPinIcon(status, selected, label), [])

  // ── Stable event handler factories ───────────────────────────────────────────
  const makeClickHandler  = useCallback((id: string) => () => selectEquipamento(selectedId === id ? null : id), [selectEquipamento, selectedId])
  const makeDragHandler   = useCallback((id: string) => (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => {
    const { lat, lng } = e.target.getLatLng()
    updateLocation(id, lat, lng)
  }, [updateLocation])

  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999, background: '#111' } : {}),
      }}
    >
      <style>{mapCSS}</style>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, padding: '8px 10px', background: isDark ? '#112645' : '#ffffff', flexWrap: 'wrap', flexShrink: 0, borderBottom: `1px solid ${isDark ? '#20406a' : '#e5e8ed'}` }}>
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => setFilterStatus(opt.value)}
            style={{
              padding: '3px 10px', borderRadius: 99, border: '1px solid',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              borderColor: filterStatus === opt.value ? '#2abfdc' : (isDark ? '#20406a' : '#d4d8df'),
              background:  filterStatus === opt.value ? '#2abfdc' : 'transparent',
              color:       filterStatus === opt.value ? '#fff' : (isDark ? '#a3a3a3' : '#505863'),
            }}
          >
            {opt.label}
            {opt.value !== null && (
              <span style={{ marginLeft: 4, opacity: 0.75 }}>
                ({positioned.filter((e) => e.status === opt.value).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Map container */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <MapContainer
          center={[-23.5190, -46.6290]}
          zoom={13}
          style={{ height: '100%', width: '100%', background: '#f5f5f5' }}
          zoomControl
        >
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Voyager">
              <TileLayer url={TILES.voyager} attribution={TILE_ATTR.voyager} subdomains="abcd" maxZoom={20} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Dark Matter">
              <TileLayer url={TILES.dark} attribution={TILE_ATTR.dark} subdomains="abcd" maxZoom={20} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satélite">
              <TileLayer url={TILES.satellite} attribution={TILE_ATTR.satellite} maxZoom={19} />
            </LayersControl.BaseLayer>

            <LayersControl.Overlay checked name="Zonas de Operação">
              <>
                {visible.map((eq) =>
                  eq.lat !== null && eq.lng !== null ? (
                    <Circle
                      key={`zone-${eq.id}`}
                      center={[eq.lat, eq.lng]}
                      radius={400}
                      pathOptions={{
                        color:       STATUS_CONFIG[eq.status].color,
                        fillColor:   STATUS_CONFIG[eq.status].color,
                        fillOpacity: 0.06,
                        weight:      1,
                        dashArray:   '4 4',
                      }}
                    />
                  ) : null
                )}
              </>
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Rotas Sugeridas">
              <>
                {routeLines.map((r) => (
                  <Polyline
                    key={`route-${r.id}`}
                    positions={[[r.fromLat!, r.fromLng!], [r.toLat!, r.toLng!]]}
                    pathOptions={{
                      color:     PRIORITY_COLOR[r.priority] ?? '#2abfdc',
                      weight:    2.5,
                      dashArray: '8 6',
                      opacity:   0.8,
                    }}
                  >
                    <Tooltip sticky>
                      {r.equipmentCode} → {r.toSiteName}<br />
                      {r.estimatedDistanceKm}km · +{r.utilizationGainPct}% utilização
                    </Tooltip>
                  </Polyline>
                ))}
              </>
            </LayersControl.Overlay>
          </LayersControl>

          <ScaleControl position="bottomleft" imperial={false} />
          <MapController />

          {visible.map((eq) => (
            <Marker
              key={eq.id}
              position={[eq.lat!, eq.lng!]}
              icon={getIcon(eq.status, selectedId === eq.id, `${eq.code} ${eq.name}`)}
              draggable
              eventHandlers={{
                click:   makeClickHandler(eq.id),
                dragend: makeDragHandler(eq.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -10]}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{eq.code}</span>
                {' — '}{eq.name}
              </Tooltip>

              <Popup className="equip-popup" minWidth={220}>
                <div style={{ padding: '14px 16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#2abfdc', fontWeight: 700 }}>
                      {eq.code}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                      background: STATUS_CONFIG[eq.status].colorMuted,
                      color: STATUS_CONFIG[eq.status].color,
                    }}>
                      {STATUS_CONFIG[eq.status].label}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13, color: '#f5f5f5' }}>{eq.name}</p>
                  <p style={{ margin: '0 0 8px', fontSize: 11, color: '#6b6b6b' }}>{eq.brand} {eq.model} · {eq.year}</p>
                  {eq.siteName && (
                    <p style={{ margin: '0 0 6px', fontSize: 11, color: '#a3a3a3' }}>📍 {eq.siteName}</p>
                  )}
                  {eq.operator && (
                    <p style={{ margin: '0 0 10px', fontSize: 11, color: '#6b6b6b' }}>👷 {eq.operator}</p>
                  )}
                  <p style={{ margin: '0 0 12px', fontSize: 11, color: '#6b6b6b' }}>
                    ⏱ {eq.engineHours.toLocaleString('pt-BR')}h de motor
                  </p>
                  {eq.alerts.filter(a => !a.acknowledged).length > 0 && (
                    <div style={{
                      background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: '6px 10px', marginBottom: 10,
                    }}>
                      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#ef4444' }}>
                        ⚠ {eq.alerts.filter(a => !a.acknowledged).length} alerta(s) ativo(s)
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => setEditing(eq.id)}
                    style={{
                      width: '100%', padding: '6px', borderRadius: 8, border: '1px solid #20406a',
                      background: 'transparent', color: '#2abfdc', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Editar Equipamento
                  </button>
                  <p style={{ margin: '8px 0 0', fontSize: 9, color: '#3f3f3f', textAlign: 'center' }}>
                    Arraste o marcador para reposicionar
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Fullscreen toggle */}
        <button
          onClick={() => setIsFullscreen((v) => !v)}
          title={isFullscreen ? 'Sair do modo tela cheia' : 'Tela cheia'}
          style={{
            position: 'absolute', top: 10, left: 10, zIndex: 1000,
            background: '#14294e', border: '1px solid #20406a', borderRadius: 8,
            padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            color: '#f5f5f5',
          }}
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Mini stats panel */}
        <div style={{
          position: 'absolute', bottom: 28, right: 10, zIndex: 1000,
          background: 'rgba(26,26,26,0.92)', border: '1px solid #20406a',
          borderRadius: 8, padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {statusCounts.filter((s) => s.count > 0).map((s) => (
            <div key={s.status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#a3a3a3' }}>{s.label}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#f5f5f5', marginLeft: 'auto', paddingLeft: 8 }}>{s.count}</span>
            </div>
          ))}
        </div>

        {/* Empty state */}
        {visible.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 500, pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(17,17,17,0.85)', border: '1px solid #20406a',
              borderRadius: 12, padding: '16px 24px', textAlign: 'center',
            }}>
              <p style={{ margin: 0, color: '#6b6b6b', fontSize: 13 }}>
                {filterStatus ? `Nenhum equipamento "${STATUS_CONFIG[filterStatus].label}"` : 'Nenhum equipamento com localização definida'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
