/**
 * MapaCanvas — Leaflet map with full network editing capabilities.
 * Supports: addNode, connect, deleteNode, deleteSegment, measure, structure tools.
 */
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, CircleMarker, Polyline, useMapEvents, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'
import type { MapNode, MapNetworkType } from '@/types'

// ─── Color maps ───────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  junction:  '#3b82f6',
  endpoint:  '#22c55e',
  structure: '#f97316',
}

const NETWORK_COLORS: Record<MapNetworkType, string> = {
  sewer:    '#f97316',
  water:    '#38bdf8',
  drainage: '#4ade80',
  civil:    '#94a3b8',
  generic:  '#a78bfa',
}

// ─── Tile layers ──────────────────────────────────────────────────────────────

const TILE_URLS: Record<string, string> = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  streets:   'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark:      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light:     'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  outdoors:  'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
}

const TILE_ATTRS: Record<string, string> = {
  satellite: '© Esri',
  streets:   '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  dark:      '© OpenStreetMap © CARTO',
  light:     '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
  outdoors:  '© <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
}

// ─── Haversine distance (meters) ─────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── FitBounds helper ─────────────────────────────────────────────────────────

function FitBoundsOnLoad({ nodes }: { nodes: MapNode[] }) {
  const map = useMap()
  const fitted = useRef(false)

  useEffect(() => {
    if (!fitted.current && nodes.length > 0) {
      fitted.current = true
      const lats = nodes.map((n) => n.lat)
      const lngs = nodes.map((n) => n.lng)
      map.fitBounds(
        [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
        { padding: [40, 40] }
      )
    }
  }, [map, nodes])

  return null
}

// ─── Map interaction handler ──────────────────────────────────────────────────

function MapInteractionHandler() {
  const store = useMapaInterativoStore()

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng
      const { activeTool, measurePoint1, setMeasurePoint1 } = store

      if (activeTool === 'addNode') {
        store.addNode({ lat, lng, nodeType: 'junction' })
      }

      if (activeTool === 'structure') {
        store.addNode({ lat, lng, nodeType: 'structure' })
      }

      if (activeTool === 'measure') {
        if (!measurePoint1) {
          setMeasurePoint1({ lat, lng })
        } else {
          const dist = haversine(measurePoint1.lat, measurePoint1.lng, lat, lng)
          alert(`Distância: ${dist.toFixed(1)} m`)
          setMeasurePoint1(null)
          store.setTool('idle')
        }
      }
    },
  })

  return null
}

// ─── Main canvas ─────────────────────────────────────────────────────────────

export function MapaCanvas() {
  const nodes               = useMapaInterativoStore((s) => s.nodes)
  const segments            = useMapaInterativoStore((s) => s.segments)
  const layers              = useMapaInterativoStore((s) => s.layers)
  const activeTool          = useMapaInterativoStore((s) => s.activeTool)
  const pendingConnectNodeId = useMapaInterativoStore((s) => s.pendingConnectNodeId)
  const basemap             = useMapaInterativoStore((s) => s.basemap)
  const measurePoint1       = useMapaInterativoStore((s) => s.measurePoint1)
  const addSegment          = useMapaInterativoStore((s) => s.addSegment)
  const removeNodes         = useMapaInterativoStore((s) => s.removeNodes)
  const removeSegments      = useMapaInterativoStore((s) => s.removeSegments)
  const setPendingConnectNodeId = useMapaInterativoStore((s) => s.setPendingConnectNodeId)
  const activeNetworkType   = useMapaInterativoStore((s) => s.activeNetworkType)

  const layerVisible = (nt: MapNetworkType) =>
    layers.find((l) => l.id === nt)?.visible ?? true

  function handleNodeClick(node: MapNode) {
    if (activeTool === 'deleteNode') {
      removeNodes([node.id])
      return
    }
    if (activeTool === 'connect') {
      if (!pendingConnectNodeId) {
        setPendingConnectNodeId(node.id)
      } else if (pendingConnectNodeId !== node.id) {
        addSegment({ fromNodeId: pendingConnectNodeId, toNodeId: node.id, networkType: activeNetworkType })
        setPendingConnectNodeId(null)
      }
      return
    }
  }

  // Cursor style based on active tool
  const cursorMap: Record<string, string> = {
    addNode:       'crosshair',
    structure:     'crosshair',
    connect:       'cell',
    deleteNode:    'not-allowed',
    deleteSegment: 'not-allowed',
    measure:       'crosshair',
    idle:          'grab',
  }

  const centerLat = nodes.length > 0
    ? nodes.reduce((s, n) => s + n.lat, 0) / nodes.length
    : -12.9714
  const centerLng = nodes.length > 0
    ? nodes.reduce((s, n) => s + n.lng, 0) / nodes.length
    : -38.5014

  return (
    <div className="relative w-full h-full" style={{ cursor: cursorMap[activeTool] ?? 'grab' }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={14}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer url={TILE_URLS[basemap]} attribution={TILE_ATTRS[basemap]} />

        <FitBoundsOnLoad nodes={nodes} />
        <MapInteractionHandler />

        {/* Segments */}
        {segments
          .filter((s) => layerVisible(s.networkType))
          .map((seg) => {
            const from = nodes.find((n) => n.id === seg.fromNodeId)
            const to   = nodes.find((n) => n.id === seg.toNodeId)
            if (!from || !to) return null
            const color = NETWORK_COLORS[seg.networkType] ?? '#a78bfa'
            return (
              <Polyline
                key={seg.id}
                positions={[[from.lat, from.lng], [to.lat, to.lng]]}
                pathOptions={{
                  color,
                  weight: activeTool === 'deleteSegment' ? 6 : 3,
                  opacity: 0.85,
                }}
                eventHandlers={{
                  click: () => {
                    if (activeTool === 'deleteSegment') {
                      removeSegments([seg.id])
                    }
                  },
                }}
              />
            )
          })}

        {/* Nodes */}
        {nodes.map((node) => {
          const isPending = pendingConnectNodeId === node.id
          const color = isPending ? '#f97316' : (NODE_COLORS[node.nodeType] ?? '#3b82f6')
          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lng]}
              radius={activeTool === 'deleteNode' ? 10 : 7}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.9,
                color: isPending ? '#fff' : color,
                weight: isPending ? 2 : 1,
              }}
              eventHandlers={{ click: () => handleNodeClick(node) }}
            >
            </CircleMarker>
          )
        })}

        {/* Measure first point */}
        {measurePoint1 && (
          <CircleMarker
            center={[measurePoint1.lat, measurePoint1.lng]}
            radius={8}
            pathOptions={{ fillColor: '#eab308', fillOpacity: 0.9, color: '#fff', weight: 2 }}
          />
        )}
      </MapContainer>
    </div>
  )
}
