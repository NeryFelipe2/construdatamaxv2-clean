/**
 * MapaExportModal — Export map data as GeoJSON, DXF, or PDF.
 */
import { X, Download } from 'lucide-react'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'

interface Props {
  onClose: () => void
}

export function MapaExportModal({ onClose }: Props) {
  const nodes    = useMapaInterativoStore((s) => s.nodes)
  const segments = useMapaInterativoStore((s) => s.segments)

  // ─── GeoJSON ─────────────────────────────────────────────────────────────

  function exportGeoJSON() {
    const features = [
      ...nodes.map((n) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
        properties: { id: n.id, label: n.label ?? '', nodeType: n.nodeType, elevation: n.elevation ?? null },
      })),
      ...segments.map((s) => {
        const from = nodes.find((n) => n.id === s.fromNodeId)
        const to   = nodes.find((n) => n.id === s.toNodeId)
        if (!from || !to) return null
        return {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [to.lng, to.lat]] },
          properties: {
            id: s.id, networkType: s.networkType,
            diameter: s.diameter ?? null, material: s.material ?? null,
            depth: s.depth ?? null, label: s.label ?? '',
          },
        }
      }).filter(Boolean),
    ]

    const geojson = JSON.stringify({ type: 'FeatureCollection', features }, null, 2)
    download('mapa-interativo.geojson', geojson, 'application/geo+json')
  }

  // ─── DXF ─────────────────────────────────────────────────────────────────

  function exportDXF() {
    const lines: string[] = [
      '0\nSECTION', '2\nHEADER', '0\nENDSEC',
      '0\nSECTION', '2\nENTITIES',
    ]

    for (const n of nodes) {
      lines.push(
        '0\nPOINT',
        '8\n0',
        `10\n${n.lng.toFixed(6)}`,
        `20\n${n.lat.toFixed(6)}`,
        '30\n0.0',
      )
    }

    for (const s of segments) {
      const from = nodes.find((n) => n.id === s.fromNodeId)
      const to   = nodes.find((n) => n.id === s.toNodeId)
      if (!from || !to) continue
      lines.push(
        '0\nLINE',
        '8\n0',
        `10\n${from.lng.toFixed(6)}`,
        `20\n${from.lat.toFixed(6)}`,
        '30\n0.0',
        `11\n${to.lng.toFixed(6)}`,
        `21\n${to.lat.toFixed(6)}`,
        '31\n0.0',
      )
    }

    lines.push('0\nENDSEC', '0\nEOF')
    download('mapa-interativo.dxf', lines.join('\n'), 'application/dxf')
  }

  // ─── PDF (print) ─────────────────────────────────────────────────────────

  function exportPDF() {
    window.print()
  }

  // ─── JSON (platform) ─────────────────────────────────────────────────────

  function exportJSON() {
    const data = JSON.stringify({ nodes, segments }, null, 2)
    download('mapa-interativo.json', data, 'application/json')
  }

  function download(name: string, content: string, type: string) {
    const blob = new Blob([content], { type })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-sm shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252]">
          <h3 className="text-sm font-bold text-white">Exportar Mapa</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        {/* Options */}
        <div className="px-6 py-5 flex flex-col gap-3">
          <p className="text-xs text-[#6b6b6b] mb-1">{nodes.length} nós · {segments.length} trechos</p>

          <ExportOption
            label="GeoJSON"
            desc="Padrão aberto para SIG (QGIS, ArcGIS, Mapbox)"
            ext=".geojson"
            onClick={() => { exportGeoJSON(); onClose() }}
          />
          <ExportOption
            label="DXF"
            desc="AutoCAD / LibreCAD (pontos POINT + linhas LINE)"
            ext=".dxf"
            onClick={() => { exportDXF(); onClose() }}
          />
          <ExportOption
            label="JSON Plataforma"
            desc="Formato nativo — pode reimportar depois"
            ext=".json"
            onClick={() => { exportJSON(); onClose() }}
          />
          <ExportOption
            label="PDF (Imprimir)"
            desc="Impressão da tela atual do mapa"
            ext=".pdf"
            onClick={() => { exportPDF(); onClose() }}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-[#525252]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#a3a3a3] hover:text-white transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

function ExportOption({ label, desc, ext, onClick }: {
  label: string; desc: string; ext: string; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg bg-[#3d3d3d] hover:bg-[#484848] transition-colors text-left w-full"
    >
      <Download size={16} className="text-orange-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{label} <span className="text-[#6b6b6b] font-normal text-xs">{ext}</span></p>
        <p className="text-[10px] text-[#6b6b6b] truncate">{desc}</p>
      </div>
    </button>
  )
}
