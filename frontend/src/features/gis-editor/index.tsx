/**
 * GIS Editor — Editor de rede no mapa estilo QGIS/QWater.
 * Funcionalidades:
 * - Mapa satelite/OSM base
 * - Desenhar PVs (pontos) e trechos (linhas) na rede
 * - Editar atributos (DN, material, profundidade)
 * - Upload de PDF/imagem como camada de fundo
 * - Export GeoJSON
 */
import { useEffect, useRef, useState, useCallback } from "react"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import "leaflet-draw"
import "leaflet-draw/dist/leaflet.draw.css"
import {
  MapPin, Minus, Trash2, Download, Upload, Layers, Settings,
  ZoomIn, ZoomOut, Crosshair, FileText, Image,
} from "lucide-react"
import { useProjectContext } from "@/store/projectContext"

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

const PV_ICON = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#00e6a0;border:2px solid #0a0e1a;box-shadow:0 0 6px rgba(0,230,160,0.5)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

interface PvNode {
  id: string; lat: number; lng: number; nome: string; cota: number; prof: number
}
interface Trecho {
  id: string; from: string; to: string; dn: number; material: string; ext: number; latlngs: [number, number][]
}

export function GisEditorPage() {
  const activeProjeto = useProjectContext(s => {
    const p = s.projetos.find(p => p.id === s.activeProjectId)
    return p ?? null
  })

  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const drawnItemsRef = useRef<L.FeatureGroup>(new L.FeatureGroup())

  const [pvs, setPvs] = useState<PvNode[]>([])
  const [trechos, setTrechos] = useState<Trecho[]>([])
  const [tool, setTool] = useState<"select" | "pv" | "trecho" | "pan">("pan")
  const [selectedPv, setSelectedPv] = useState<PvNode | null>(null)
  const [showPanel, setShowPanel] = useState(true)
  const [trechoStartId, setTrechoStartId] = useState<string | null>(null)
  const toolRef = useRef(tool)
  toolRef.current = tool
  const pvsRef = useRef(pvs)
  pvsRef.current = pvs
  const trechoStartIdRef = useRef(trechoStartId)
  trechoStartIdRef.current = trechoStartId

  function handlePvClickForTrecho(pv: PvNode) {
    if (toolRef.current !== "trecho") { setSelectedPv(pv); return }
    const startId = trechoStartIdRef.current
    if (!startId) { setTrechoStartId(pv.id); return }
    if (startId === pv.id) { setTrechoStartId(null); return }
    const from = pvsRef.current.find(p => p.id === startId)
    if (!from) { setTrechoStartId(null); return }
    const latlngs: [number, number][] = [[from.lat, from.lng], [pv.lat, pv.lng]]
    const ext = mapRef.current ? mapRef.current.distance([from.lat, from.lng], [pv.lat, pv.lng]) : 0
    const trecho: Trecho = { id: `trecho-${Date.now()}`, from: from.id, to: pv.id, dn: 150, material: "PVC", ext: Math.round(ext * 100) / 100, latlngs }
    L.polyline(latlngs, { color: "#00e6a0", weight: 3 }).addTo(drawnItemsRef.current)
    setTrechos(ts => [...ts, trecho])
    setTrechoStartId(null)
  }

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [-23.96, -46.33], // Santos default
      zoom: 15,
      zoomControl: false,
    })

    // Tile layers
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "OSM" })
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { attribution: "Esri" })
    osm.addTo(map)

    L.control.layers({ "Ruas (OSM)": osm, "Satelite": sat }, {}, { position: "topright" }).addTo(map)
    L.control.zoom({ position: "topright" }).addTo(map)

    drawnItemsRef.current.addTo(map)
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Click handler for PV placement
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    function handleClick(e: L.LeafletMouseEvent) {
      if (tool === "pv") {
        const id = `pv-${Date.now()}`
        const pv: PvNode = { id, lat: e.latlng.lat, lng: e.latlng.lng, nome: `PV-${pvs.length + 1}`, cota: 0, prof: 0 }
        const marker = L.marker(e.latlng, { icon: PV_ICON, draggable: true })
          .bindTooltip(pv.nome, { permanent: true, direction: "top", offset: [0, -10], className: "pv-tooltip" })
        marker.on("click", () => handlePvClickForTrecho(pv))
        marker.on("dragend", (ev: any) => {
          const pos = ev.target.getLatLng()
          setPvs(ps => ps.map(p => p.id === id ? { ...p, lat: pos.lat, lng: pos.lng } : p))
        })
        drawnItemsRef.current.addLayer(marker)
        setPvs(ps => [...ps, pv])
      }
    }

    map.on("click", handleClick)
    return () => { map.off("click", handleClick) }
  }, [tool, pvs.length])

  // Export GeoJSON
  function exportGeoJSON() {
    const features: any[] = []
    pvs.forEach(pv => {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [pv.lng, pv.lat] },
        properties: { id: pv.id, nome: pv.nome, cota_terreno: pv.cota, profundidade: pv.prof, feature_type: "pv" },
      })
    })
    trechos.forEach(t => {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: t.latlngs.map(([lat, lng]) => [lng, lat]) },
        properties: { id: t.id, pv_montante: t.from, pv_jusante: t.to, diametro: t.dn, material: t.material, extensao: t.ext, feature_type: "trecho" },
      })
    })
    const geoJson = { type: "FeatureCollection", features }
    const blob = new Blob([JSON.stringify(geoJson, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `rede_${activeProjeto?.nome ?? "projeto"}.geojson`; a.click()
    URL.revokeObjectURL(url)
  }

  // Import GeoJSON
  function importGeoJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const gj = JSON.parse(reader.result as string)
        const layer = L.geoJSON(gj, {
          pointToLayer: (f, latlng) => L.marker(latlng, { icon: PV_ICON }),
          style: { color: "#00e6a0", weight: 3 },
        })
        layer.addTo(drawnItemsRef.current)
        mapRef.current?.fitBounds(layer.getBounds())
      } catch { alert("Erro ao ler GeoJSON") }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  // Load PDF/image overlay
  function loadImageOverlay(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !mapRef.current) return
    const reader = new FileReader()
    reader.onload = () => {
      const bounds = mapRef.current!.getBounds()
      L.imageOverlay(reader.result as string, bounds, { opacity: 0.6 }).addTo(mapRef.current!)
    }
    reader.readAsDataURL(file)
    e.target.value = ""
  }

  const toolBtns = [
    { id: "pan" as const, icon: Crosshair, label: "Navegar" },
    { id: "pv" as const, icon: MapPin, label: "Adicionar PV" },
    { id: "trecho" as const, icon: Minus, label: "Tracar Trecho" },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Toolbar */}
      <div className="w-12 bg-[#0d2040] border-r border-[#20406a] flex flex-col items-center py-2 gap-1 shrink-0">
        {toolBtns.map(t => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${tool === t.id ? "bg-[#00e6a0]/20 text-[#00e6a0]" : "text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]"}`}>
            <t.icon size={18} />
          </button>
        ))}
        <div className="border-t border-[#20406a] w-8 my-1" />
        <button onClick={exportGeoJSON} title="Exportar GeoJSON" className="w-10 h-10 rounded-lg flex items-center justify-center text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8]">
          <Download size={18} />
        </button>
        <label title="Importar GeoJSON" className="w-10 h-10 rounded-lg flex items-center justify-center text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] cursor-pointer">
          <Upload size={18} />
          <input type="file" accept=".geojson,.json" onChange={importGeoJSON} className="hidden" />
        </label>
        <label title="Carregar imagem como fundo" className="w-10 h-10 rounded-lg flex items-center justify-center text-[#6b6b6b] hover:bg-[#14294e] hover:text-[#8fb3c8] cursor-pointer">
          <Image size={18} />
          <input type="file" accept="image/*" onChange={loadImageOverlay} className="hidden" />
        </label>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Tool indicator */}
        <div className="absolute top-3 left-3 z-[1000] bg-[#0d2040]/90 border border-[#20406a] rounded-lg px-3 py-1.5 text-xs text-[#e4f2f8]">
          {tool === "pv" ? "Clique no mapa para adicionar PV" : tool === "trecho" ? (trechoStartId ? "Clique no PV de destino para tracar o trecho" : "Clique no PV de origem para tracar o trecho") : "Navegacao"}
          <span className="ml-2 text-[#5a8caa]">PVs: {pvs.length} | Trechos: {trechos.length}</span>
        </div>
      </div>

      {/* Properties Panel */}
      {showPanel && (
        <div className="w-72 bg-[#0d2040] border-l border-[#20406a] overflow-y-auto shrink-0">
          <div className="p-3 border-b border-[#20406a]">
            <h3 className="text-xs font-bold text-[#00e6a0] uppercase tracking-wider">Editor GIS</h3>
            <p className="text-[10px] text-[#5a8caa] mt-0.5">{activeProjeto?.nome ?? "Nenhum projeto"}</p>
          </div>

          {/* PV List */}
          <div className="p-3 space-y-2">
            <div className="text-[10px] text-[#5a8caa] uppercase font-bold">PVs ({pvs.length})</div>
            {pvs.length === 0 && <div className="text-[10px] text-[#5a8caa] italic">Selecione a ferramenta PV e clique no mapa</div>}
            {pvs.map(pv => (
              <div key={pv.id} onClick={() => setSelectedPv(pv)}
                className={`p-2 rounded-lg border text-xs cursor-pointer transition-colors ${selectedPv?.id === pv.id ? "bg-[#00e6a0]/10 border-[#00e6a0]/30 text-[#00e6a0]" : "bg-[#112645] border-[#20406a] text-[#e4f2f8] hover:border-[#00e6a0]/20"}`}>
                <div className="font-medium">{pv.nome}</div>
                <div className="text-[10px] text-[#5a8caa] font-mono">{pv.lat.toFixed(6)}, {pv.lng.toFixed(6)}</div>
              </div>
            ))}
          </div>

          {/* Selected PV Properties */}
          {selectedPv && (
            <div className="p-3 border-t border-[#20406a] space-y-2">
              <div className="text-[10px] text-[#00e6a0] uppercase font-bold">Propriedades: {selectedPv.nome}</div>
              <div>
                <label className="text-[10px] text-[#5a8caa]">Nome</label>
                <input value={selectedPv.nome} onChange={e => { const v = e.target.value; setSelectedPv(s => s ? { ...s, nome: v } : s); setPvs(ps => ps.map(p => p.id === selectedPv.id ? { ...p, nome: v } : p)) }}
                  className="w-full bg-[#112645] border border-[#20406a] rounded px-2 py-1.5 text-xs text-[#e4f2f8]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#5a8caa]">Cota (m)</label>
                  <input type="number" value={selectedPv.cota} onChange={e => { const v = Number(e.target.value); setSelectedPv(s => s ? { ...s, cota: v } : s); setPvs(ps => ps.map(p => p.id === selectedPv.id ? { ...p, cota: v } : p)) }}
                    className="w-full bg-[#112645] border border-[#20406a] rounded px-2 py-1.5 text-xs text-[#e4f2f8]" />
                </div>
                <div>
                  <label className="text-[10px] text-[#5a8caa]">Prof. (m)</label>
                  <input type="number" value={selectedPv.prof} onChange={e => { const v = Number(e.target.value); setSelectedPv(s => s ? { ...s, prof: v } : s); setPvs(ps => ps.map(p => p.id === selectedPv.id ? { ...p, prof: v } : p)) }}
                    className="w-full bg-[#112645] border border-[#20406a] rounded px-2 py-1.5 text-xs text-[#e4f2f8]" />
                </div>
              </div>
            </div>
          )}

          {/* Trechos List */}
          <div className="p-3 border-t border-[#20406a] space-y-2">
            <div className="text-[10px] text-[#5a8caa] uppercase font-bold">Trechos ({trechos.length})</div>
            {trechos.length === 0 && <div className="text-[10px] text-[#5a8caa] italic">Selecione a ferramenta Tracar Trecho e clique em 2 PVs</div>}
            {trechos.map(t => (
              <div key={t.id} className="p-2 rounded-lg border text-xs bg-[#112645] border-[#20406a] text-[#e4f2f8]">
                <div className="font-medium">{t.from} → {t.to}</div>
                <div className="text-[10px] text-[#5a8caa] font-mono">DN {t.dn} | {t.material} | {t.ext} m</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
