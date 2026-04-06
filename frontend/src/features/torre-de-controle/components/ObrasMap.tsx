import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer, TileLayer, Marker, Popup, Tooltip,
  Circle, Polyline, LayersControl, ScaleControl,
  useMap, useMapEvents,
} from 'react-leaflet'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Maximize2, Minimize2, Ruler, X } from 'lucide-react'
import { useTorreStore } from '@/store/torreDeControleStore'
import { useEquipamentosStore } from '@/store/equipamentosStore'
import { useOtimizacaoFrotaStore } from '@/store/otimizacaoFrotaStore'
import { haversineKm } from '@/store/otimizacaoFrotaStore'
import { useThemeStore } from '@/store/themeStore'
import type { ConstructionSite, ObraStatus } from '@/types'

// ─── Tile URLs ────────────────────────────────────────────────────────────────

const TILES = {
  voyager:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
} as const

const TILE_ATTR = {
  voyager:   '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  dark:      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  satellite: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Source: Esri, Maxar, GeoEye',
}

// ─── Status colors ────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<ObraStatus, string> = {
  active:    '#f97316',
  planning:  '#3b82f6',
  paused:    '#eab308',
  completed: '#22c55e',
}

const STATUS_LABEL: Record<ObraStatus, string> = {
  active:    'Ativa',
  planning:  'Planejamento',
  paused:    'Pausada',
  completed: 'Concluída',
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
}

// ─── Custom SVG construction helmet marker ────────────────────────────────────

function createHelmetIcon(site: ConstructionSite, isSelected: boolean) {
  const size       = isSelected ? 46 : 38
  const color      = STATUS_COLOR[site.status]
  const hasCritical = site.risks.some((r) => r.level === 'critical' && r.status === 'active')
  const ringSize   = size + 8

  const pulse = hasCritical ? `
    <div style="position:absolute;top:-4px;left:-4px;right:-4px;bottom:-4px;border-radius:50%;background:${color};opacity:0.25;
      animation:ping 1.4s cubic-bezier(0,0,0.2,1) infinite;"></div>` : ''

  // Modern filled circle marker with building icon
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 46 46">
      <!-- Outer status ring -->
      <circle cx="23" cy="23" r="21" fill="${color}" opacity="0.18"/>
      <circle cx="23" cy="23" r="21" fill="none" stroke="${color}" stroke-width="${isSelected ? 3 : 2}" opacity="${isSelected ? 1 : 0.7}"/>
      <!-- Inner filled circle -->
      <circle cx="23" cy="23" r="14" fill="${color}" opacity="0.95"/>
      <!-- Building icon (white) centered -->
      <g transform="translate(13,13)" fill="white" opacity="0.95">
        <!-- Building outline -->
        <rect x="3" y="5" width="14" height="12" rx="1" fill="none" stroke="white" stroke-width="1.5"/>
        <!-- Roof peak -->
        <polyline points="1,6 10,1 19,6" fill="none" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
        <!-- Door -->
        <rect x="8" y="12" width="4" height="5" rx="0.5" fill="white"/>
        <!-- Windows -->
        <rect x="4" y="8" width="3" height="3" rx="0.5" fill="white"/>
        <rect x="13" y="8" width="3" height="3" rx="0.5" fill="white"/>
      </g>
    </svg>`

  // Short label: trim to 18 chars
  const shortName = site.name.length > 18 ? site.name.slice(0, 17) + '…' : site.name

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
      <div style="position:relative;width:${ringSize}px;height:${ringSize}px;display:flex;align-items:center;justify-content:center;
        filter:drop-shadow(0 4px 12px rgba(0,0,0,0.5));">
        ${pulse}
        <div style="position:absolute;top:4px;left:4px;">${svg}</div>
      </div>
      <div style="background:rgba(10,22,40,0.92);border:1px solid ${color}50;border-radius:4px;
        padding:2px 7px;font-size:9px;font-weight:700;color:${color};white-space:nowrap;
        font-family:Inter,system-ui,sans-serif;line-height:1.5;pointer-events:none;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);">
        ${shortName}
      </div>
    </div>`

  return L.divIcon({ html, className: '', iconSize: [ringSize, ringSize + 22], iconAnchor: [ringSize / 2, ringSize / 2], popupAnchor: [0, -(ringSize / 2 + 14)] })
}

// ─── MapController — fly-to on selection ─────────────────────────────────────

function MapController() {
  const sites      = useTorreStore((s) => s.sites)
  const selectedId = useTorreStore((s) => s.selectedId)
  const prevId     = useRef<string | null>(null)
  const map        = useMap()

  useEffect(() => {
    if (!selectedId || selectedId === prevId.current) return
    prevId.current = selectedId
    const site = sites.find((s) => s.id === selectedId)
    if (site?.lat != null && site.lng != null) {
      map.flyTo([site.lat, site.lng], Math.max(map.getZoom(), 15), { duration: 0.9 })
    }
  }, [selectedId, sites, map])

  return null
}

// ─── Distance measure controller ─────────────────────────────────────────────

interface MeasurePoint { lat: number; lng: number }

function DistanceMeasureController({
  active,
  points,
  onPoint,
}: {
  active: boolean
  points: MeasurePoint[]
  onPoint: (p: MeasurePoint) => void
}) {
  const map = useMapEvents({
    click(e) {
      if (!active || points.length >= 2) return
      onPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })

  // Change cursor when active
  useEffect(() => {
    if (active) {
      map.getContainer().style.cursor = 'crosshair'
    } else {
      map.getContainer().style.cursor = ''
    }
    return () => { map.getContainer().style.cursor = '' }
  }, [active, map])

  return null
}

// ─── CSS ───────────────────────────────────────────────────────────────────────

function getMapCSS(isDark: boolean) {
  const bg     = isDark ? '#3d3d3d' : '#ffffff'
  const border = isDark ? '#525252' : '#d4d8df'
  const text   = isDark ? '#f5f5f5' : '#1a1d23'
  const muted  = isDark ? '#6b6b6b' : '#78828f'
  return `
  @keyframes ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
  .torre-popup .leaflet-popup-content-wrapper {
    background: ${bg}; border: 1px solid ${border};
    border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,${isDark ? '0.6' : '0.15'}); padding: 0;
  }
  .torre-popup .leaflet-popup-content { margin: 0; }
  .torre-popup .leaflet-popup-tip { background: ${bg}; }
  .torre-popup .leaflet-popup-close-button { color: ${muted} !important; font-size: 16px; top: 8px; right: 10px; }
  .leaflet-control-zoom a { background: #fff !important; border-color: #d4d8df !important; color: #505863 !important; }
  .leaflet-control-zoom a:hover { background: #f0f2f5 !important; color: #f97316 !important; }
  .leaflet-control-attribution { background: rgba(255,255,255,0.85) !important; color: #78828f !important; font-size: 9px !important; }
  .leaflet-control-layers { background: ${bg} !important; border: 1px solid ${border} !important; border-radius: 8px !important; color: ${text} !important; }
  .leaflet-control-layers label { color: ${text} !important; }
  .leaflet-tooltip { background: ${bg}; border: 1px solid ${border}; color: ${text}; font-size: 11px; padding: 3px 8px; border-radius: 6px; }
  .leaflet-tooltip-top:before { border-top-color: ${border}; }
`
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ObrasMap() {
  const sites         = useTorreStore((s) => s.sites)
  const selectedId    = useTorreStore((s) => s.selectedId)
  const selectSite    = useTorreStore((s) => s.selectSite)
  const setEditing    = useTorreStore((s) => s.setEditing)
  const updateLocation = useTorreStore((s) => s.updateLocation)
  const equipamentos  = useEquipamentosStore((s) => s.equipamentos)
  const routingRecs   = useOtimizacaoFrotaStore((s) => s.routingRecs)
  const isDark        = useThemeStore((s) => s.theme === 'dark')

  const [isFullscreen,   setIsFullscreen]   = useState(false)
  const [measureActive,  setMeasureActive]  = useState(false)
  const [measurePoints,  setMeasurePoints]  = useState<MeasurePoint[]>([])

  // ── Memoized derivations ─────────────────────────────────────────────────────
  const mapCSS     = useMemo(() => getMapCSS(isDark), [isDark])
  const withCoords = useMemo(() => sites.filter((s) => s.lat != null && s.lng != null), [sites])
  const routeLines = useMemo(() => routingRecs.filter(
    (r) => r.accepted !== false && r.fromLat !== null && r.fromLng !== null && r.toLat !== null && r.toLng !== null
  ), [routingRecs])

  // O(1) equipment count lookup instead of O(n) per site per render
  const equipCountBySiteName = useMemo(() => {
    const map = new Map<string, number>()
    equipamentos.forEach((e) => {
      if (e.siteName) map.set(e.siteName, (map.get(e.siteName) ?? 0) + 1)
    })
    return map
  }, [equipamentos])

  const measuredKm = useMemo(() =>
    measurePoints.length === 2
      ? haversineKm(measurePoints[0].lat, measurePoints[0].lng, measurePoints[1].lat, measurePoints[1].lng)
      : null,
    [measurePoints]
  )

  const handleMeasurePoint = useCallback((p: MeasurePoint) => {
    setMeasurePoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]))
  }, [])

  const clearMeasure = useCallback(() => {
    setMeasurePoints([])
    setMeasureActive(false)
  }, [])

  // ── Memoized icon factory ────────────────────────────────────────────────────
  const getIcon = useCallback((site: ConstructionSite, selected: boolean) =>
    createHelmetIcon(site, selected), [])

  // ── Stable event handler factories ───────────────────────────────────────────
  const makeClickHandler  = useCallback((id: string) => () => selectSite(id), [selectSite])
  const makeDragHandler   = useCallback((id: string) => (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => {
    const { lat, lng } = e.target.getLatLng()
    updateLocation(id, lat, lng)
  }, [updateLocation])

  // Circle radius: proportional to totalArea (min 200m, max 800m)
  const siteRadius = useCallback((totalArea: number) =>
    Math.min(800, Math.max(200, Math.sqrt(totalArea) * 3)), [])

  return (
    <div
      className="flex-1 relative overflow-hidden"
      style={{
        background: '#111',
        ...(isFullscreen ? { position: 'fixed', inset: 0, zIndex: 9999 } : {}),
      }}
    >
      <style>{mapCSS}</style>

      <MapContainer
        center={[-23.5505, -46.6333]}
        zoom={11}
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

          <LayersControl.Overlay checked name="Áreas dos Canteiros">
            <>
              {withCoords.map((site) => (
                <Circle
                  key={`area-${site.id}`}
                  center={[site.lat!, site.lng!]}
                  radius={siteRadius(site.totalArea)}
                  pathOptions={{
                    color:       STATUS_COLOR[site.status],
                    fillColor:   STATUS_COLOR[site.status],
                    fillOpacity: 0.08,
                    weight:      1.5,
                    dashArray:   '6 4',
                  }}
                />
              ))}
            </>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Rotas Sugeridas">
            <>
              {routeLines.map((r) => (
                <Polyline
                  key={`route-${r.id}`}
                  positions={[[r.fromLat!, r.fromLng!], [r.toLat!, r.toLng!]]}
                  pathOptions={{
                    color:     PRIORITY_COLOR[r.priority] ?? '#f97316',
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

        <DistanceMeasureController
          active={measureActive}
          points={measurePoints}
          onPoint={handleMeasurePoint}
        />

        {/* Distance measure polyline */}
        {measurePoints.length === 2 && (
          <Polyline
            positions={measurePoints.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#22c55e', weight: 2, dashArray: '6 4' }}
          >
            <Tooltip permanent direction="center">
              {measuredKm} km
            </Tooltip>
          </Polyline>
        )}

        {withCoords.map((site) => (
          <Marker
            key={site.id}
            position={[site.lat!, site.lng!]}
            icon={getIcon(site, site.id === selectedId)}
            draggable
            eventHandlers={{
              click:   makeClickHandler(site.id),
              dragend: makeDragHandler(site.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {site.code} — {site.name}
            </Tooltip>

            <Popup className="torre-popup">
              <div style={{ padding: '12px 14px', minWidth: 210, fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: STATUS_COLOR[site.status], fontWeight: 700 }}>
                    {site.code}
                  </span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    background: STATUS_COLOR[site.status] + '20', color: STATUS_COLOR[site.status],
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {STATUS_LABEL[site.status]}
                  </span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f5f5f5', marginBottom: 6, lineHeight: 1.3 }}>
                  {site.name}
                </div>
                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 2 }}>📍 {site.street}, {site.number}</div>
                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 8 }}>{site.district} — {site.city}/{site.state}</div>
                <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 4 }}>👷 Gerente: {site.manager}</div>

                {/* Equipment count */}
                {(() => {
                  const cnt = equipCountBySiteName.get(site.name) ?? 0
                  return cnt > 0 ? (
                    <div style={{ fontSize: 11, color: '#a3a3a3', marginBottom: 8 }}>
                      🚜 {cnt} equipamento{cnt !== 1 ? 's' : ''} no canteiro
                    </div>
                  ) : null
                })()}

                <div style={{ fontSize: 11, color: '#6b6b6b', marginBottom: 8 }}>
                  📐 {site.totalArea.toLocaleString('pt-BR')} m² · {site.floors} {site.floors === 1 ? 'piso' : 'pisos'}
                </div>

                {site.risks.filter((r) => r.status === 'active').length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: '4px 8px', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>
                      ⚠ {site.risks.filter((r) => r.status === 'active').length} risco(s) ativo(s)
                    </span>
                  </div>
                )}
                <button
                  onClick={() => { selectSite(site.id); setEditing(site.id) }}
                  style={{
                    width: '100%', background: 'transparent', border: '1px solid #525252',
                    borderRadius: 6, color: '#f97316', fontSize: 11, fontWeight: 600,
                    padding: '5px 8px', cursor: 'pointer',
                  }}
                >
                  Editar Obra
                </button>
                <div style={{ textAlign: 'center', fontSize: 9, color: '#3f3f3f', marginTop: 6 }}>
                  Arraste para reposicionar
                </div>
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
          background: '#3d3d3d', border: '1px solid #525252', borderRadius: 8,
          padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          color: '#f5f5f5',
        }}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      {/* Distance measure toggle */}
      <button
        onClick={() => {
          if (measureActive) { clearMeasure() } else { setMeasureActive(true); setMeasurePoints([]) }
        }}
        title="Medir distância entre dois pontos"
        style={{
          position: 'absolute', top: 50, left: 10, zIndex: 1000,
          background: measureActive ? '#22c55e' : '#3d3d3d',
          border: `1px solid ${measureActive ? '#22c55e' : '#525252'}`,
          borderRadius: 8, padding: '6px 8px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', color: '#fff',
        }}
      >
        <Ruler size={14} />
      </button>

      {/* Distance result banner */}
      {measuredKm !== null && (
        <div style={{
          position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'rgba(26,26,26,0.95)', border: '1px solid #22c55e', borderRadius: 8,
          padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>📏 {measuredKm} km</span>
          <button onClick={clearMeasure} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b6b6b', display: 'flex' }}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* Measure instructions */}
      {measureActive && measurePoints.length < 2 && measuredKm === null && (
        <div style={{
          position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          background: 'rgba(26,26,26,0.9)', border: '1px solid #525252', borderRadius: 8,
          padding: '6px 14px', fontSize: 11, color: '#a3a3a3',
        }}>
          {measurePoints.length === 0 ? 'Clique no 1º ponto' : 'Clique no 2º ponto'}
        </div>
      )}

      {/* Empty state */}
      {withCoords.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 500, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(26,26,26,0.9)', border: '1px solid #525252',
            borderRadius: 12, padding: '16px 24px', textAlign: 'center',
          }}>
            <p style={{ color: '#6b6b6b', fontSize: 12, margin: 0 }}>Nenhuma obra com localização definida</p>
            <p style={{ color: '#3f3f3f', fontSize: 10, margin: '4px 0 0' }}>Edite uma obra e preencha as coordenadas</p>
          </div>
        </div>
      )}
    </div>
  )
}
