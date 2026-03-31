/**
 * MapaImportModal — File import modal for the Mapa Interativo module.
 * Supports: .txt/.csv (lat/lng OR UTM easting,northing,elevation),
 *           .dxf (LINE/LWPOLYLINE), .shp (BBox), .json (platform format),
 *           .ifc (message), .dwg (message)
 *
 * UTM auto-detection: if first column > 360 or second column > 90, treats
 * as UTM and converts via the shared utmToWgs84 utility.
 */
import { useState, useRef } from 'react'
import { Upload, X, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'
import { utmToWgs84 } from '@/utils/utmToWgs84'
import type { MapNode, MapSegment, MapNetworkType, MapNodeType } from '@/types'

interface Props {
  onClose: () => void
}

type ParseResult =
  | { ok: true; nodes: MapNode[]; segments: MapSegment[]; message: string; isUtm?: boolean }
  | { ok: false; message: string }

// ─── Parsers ──────────────────────────────────────────────────────────────────

function parseTxt(
  text: string,
  utmZone: number,
  utmHemi: 'N' | 'S',
  connectSequential: boolean,
  networkType: MapNetworkType,
): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'))
  const nodes: MapNode[] = []
  let detectedUtm = false

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(/[\t,;]+/).map((s) => s.trim())
    if (parts.length < 2) continue
    const nums = parts.slice(0, 3).map(Number)
    if (isNaN(nums[0]) || isNaN(nums[1])) continue

    const [col1, col2, col3] = nums

    // Detect UTM: easting typically 100000–900000, northing 0–10000000
    const looksLikeUtm = Math.abs(col1) > 360 || Math.abs(col2) > 90

    if (looksLikeUtm) {
      detectedUtm = true
      try {
        const { lat, lng } = utmToWgs84(col1, col2, utmZone, utmHemi)
        const elevation = !isNaN(col3) ? col3 : undefined
        const label = `PV-${String(i + 1).padStart(2, '0')}`
        nodes.push({ id: crypto.randomUUID(), lat, lng, nodeType: 'junction', label, elevation })
      } catch {
        continue
      }
    } else {
      // Lat/lng format
      const lat = col1
      const lng = col2
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue
      const label = parts.find((p) => isNaN(Number(p)))
      nodes.push({ id: crypto.randomUUID(), lat, lng, nodeType: 'junction' as MapNodeType, label })
    }
  }

  if (nodes.length === 0) {
    return { ok: false, message: detectedUtm
      ? 'UTM detectado mas conversão falhou. Verifique a zona UTM.'
      : 'Nenhuma coordenada válida encontrada.' }
  }

  const segments: MapSegment[] = []
  if (connectSequential && nodes.length >= 2) {
    for (let i = 0; i < nodes.length - 1; i++) {
      segments.push({
        id: crypto.randomUUID(),
        fromNodeId: nodes[i].id,
        toNodeId: nodes[i + 1].id,
        networkType,
      })
    }
  }

  const msg = detectedUtm
    ? `UTM Zona ${utmZone}${utmHemi}: ${nodes.length} pontos importados${segments.length > 0 ? `, ${segments.length} trechos criados.` : '.'}`
    : `${nodes.length} pontos importados${segments.length > 0 ? `, ${segments.length} trechos criados.` : '.'}`

  return { ok: true, nodes, segments, message: msg, isUtm: detectedUtm }
}

function parseDxf(text: string): ParseResult {
  const nodes: MapNode[] = []
  const segments: MapSegment[] = []

  const lines = text.split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const code = lines[i]?.trim()
    const val  = lines[i + 1]?.trim()
    i += 2

    if (code === '0' && val === 'LINE') {
      const coords: number[] = []
      while (i < lines.length) {
        const c = lines[i]?.trim()
        const v = lines[i + 1]?.trim()
        i += 2
        if (c === '0') { i -= 2; break }
        if (['10', '20', '11', '21'].includes(c)) coords.push(parseFloat(v ?? '0'))
      }
      if (coords.length >= 4) {
        const [x1, y1, x2, y2] = coords
        const n1: MapNode = { id: crypto.randomUUID(), lat: y1, lng: x1, nodeType: 'junction' }
        const n2: MapNode = { id: crypto.randomUUID(), lat: y2, lng: x2, nodeType: 'endpoint' }
        nodes.push(n1, n2)
        segments.push({ id: crypto.randomUUID(), fromNodeId: n1.id, toNodeId: n2.id, networkType: 'generic' as MapNetworkType })
      }
    }

    if (code === '0' && val === 'LWPOLYLINE') {
      const pts: [number, number][] = []
      while (i < lines.length) {
        const c = lines[i]?.trim()
        const v = lines[i + 1]?.trim()
        i += 2
        if (c === '0') { i -= 2; break }
        if (c === '10') {
          const x = parseFloat(v ?? '0')
          const nextCode = lines[i]?.trim()
          const nextVal  = lines[i + 1]?.trim()
          if (nextCode === '20') {
            pts.push([x, parseFloat(nextVal ?? '0')])
            i += 2
          }
        }
      }
      if (pts.length >= 2) {
        const ptNodes: MapNode[] = pts.map(([x, y]) => ({
          id: crypto.randomUUID(), lat: y, lng: x, nodeType: 'junction' as MapNodeType,
        }))
        nodes.push(...ptNodes)
        for (let pi = 0; pi < ptNodes.length - 1; pi++) {
          segments.push({
            id: crypto.randomUUID(),
            fromNodeId: ptNodes[pi].id,
            toNodeId: ptNodes[pi + 1].id,
            networkType: 'generic' as MapNetworkType,
          })
        }
      }
    }
  }

  if (nodes.length === 0) return { ok: false, message: 'Nenhuma entidade LINE/LWPOLYLINE encontrada no DXF.' }
  return { ok: true, nodes, segments, message: `${nodes.length} nós e ${segments.length} trechos importados do DXF.` }
}

function parseShpBbox(buffer: ArrayBuffer, _fileName: string): ParseResult {
  const view = new DataView(buffer)
  if (view.byteLength < 100) return { ok: false, message: 'Arquivo SHP muito pequeno ou inválido.' }

  const fileCode = view.getInt32(0, false)
  if (fileCode !== 9994) return { ok: false, message: 'Código de arquivo SHP inválido (esperado 9994).' }

  const xMin = view.getFloat64(36, true)
  const yMin = view.getFloat64(44, true)
  const xMax = view.getFloat64(52, true)
  const yMax = view.getFloat64(60, true)

  if (isNaN(xMin) || isNaN(yMin) || isNaN(xMax) || isNaN(yMax)) {
    return { ok: false, message: 'Não foi possível ler o bounding box do SHP.' }
  }

  const corners: MapNode[] = [
    { id: crypto.randomUUID(), lat: yMin, lng: xMin, label: 'SHP-SW', nodeType: 'endpoint' },
    { id: crypto.randomUUID(), lat: yMin, lng: xMax, label: 'SHP-SE', nodeType: 'endpoint' },
    { id: crypto.randomUUID(), lat: yMax, lng: xMax, label: 'SHP-NE', nodeType: 'endpoint' },
    { id: crypto.randomUUID(), lat: yMax, lng: xMin, label: 'SHP-NW', nodeType: 'endpoint' },
  ]
  const segs: MapSegment[] = [
    { id: crypto.randomUUID(), fromNodeId: corners[0].id, toNodeId: corners[1].id, networkType: 'generic', label: 'SHP bbox' },
    { id: crypto.randomUUID(), fromNodeId: corners[1].id, toNodeId: corners[2].id, networkType: 'generic', label: 'SHP bbox' },
    { id: crypto.randomUUID(), fromNodeId: corners[2].id, toNodeId: corners[3].id, networkType: 'generic', label: 'SHP bbox' },
    { id: crypto.randomUUID(), fromNodeId: corners[3].id, toNodeId: corners[0].id, networkType: 'generic', label: 'SHP bbox' },
  ]

  return {
    ok: true, nodes: corners, segments: segs,
    message: `SHP importado como bounding box (${xMin.toFixed(4)}, ${yMin.toFixed(4)}) → (${xMax.toFixed(4)}, ${yMax.toFixed(4)}).`,
  }
}

function parseJson(text: string): ParseResult {
  try {
    const data = JSON.parse(text)
    const nodes: MapNode[]       = Array.isArray(data.nodes)    ? data.nodes    : []
    const segments: MapSegment[] = Array.isArray(data.segments) ? data.segments : []
    if (nodes.length === 0 && segments.length === 0) {
      return { ok: false, message: 'JSON não contém nodes/segments válidos.' }
    }
    return { ok: true, nodes, segments, message: `${nodes.length} nós e ${segments.length} trechos carregados do JSON.` }
  } catch {
    return { ok: false, message: 'Erro ao analisar JSON.' }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

const NETWORK_LABELS: Record<MapNetworkType, string> = {
  sewer:    'Esgoto',
  water:    'Água',
  drainage: 'Drenagem',
  civil:    'Civil',
  generic:  'Genérico',
}

export function MapaImportModal({ onClose }: Props) {
  const importNodes    = useMapaInterativoStore((s) => s.importNodes)
  const importSegments = useMapaInterativoStore((s) => s.importSegments)

  const [result, setResult]         = useState<ParseResult | null>(null)
  const [fileName, setFileName]     = useState('')
  const [loading, setLoading]       = useState(false)
  const [utmZone, setUtmZone]       = useState(24)
  const [utmHemi, setUtmHemi]       = useState<'N' | 'S'>('S')
  const [connectSeq, setConnectSeq] = useState(true)
  const [netType, setNetType]       = useState<MapNetworkType>('sewer')
  const [showUtmOpts, setShowUtmOpts] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const lastTextRef = useRef<string | null>(null)
  const lastExtRef  = useRef<string>('')

  function parseText(text: string, ext: string) {
    lastTextRef.current = text
    lastExtRef.current  = ext
    let r: ParseResult
    if (ext === 'dxf')  r = parseDxf(text)
    else if (ext === 'json') r = parseJson(text)
    else {
      r = parseTxt(text, utmZone, utmHemi, connectSeq, netType)
      if (r.ok && r.isUtm) setShowUtmOpts(true)
    }
    setResult(r)
    setLoading(false)
  }

  function handleFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    setFileName(file.name)
    setResult(null)
    setLoading(true)
    setShowUtmOpts(false)

    if (ext === 'dwg') {
      setResult({ ok: false, message: 'Formato DWG é binário proprietário da Autodesk. Converta para DXF via AutoCAD, LibreCAD ou FreeCAD antes de importar.' })
      setLoading(false)
      return
    }
    if (ext === 'ifc') {
      setResult({ ok: false, message: 'Formato IFC binário não suportado diretamente. Exporte como IFC-JSON ou DXF no seu software BIM (Revit, ArchiCAD, FreeCAD).' })
      setLoading(false)
      return
    }
    if (ext === 'shp') {
      file.arrayBuffer().then((buf) => { setResult(parseShpBbox(buf, file.name)); setLoading(false) })
      return
    }

    file.text().then((text) => parseText(text, ext))
  }

  // Re-parse when UTM settings change (for already-loaded UTM files)
  function reparse() {
    if (lastTextRef.current && (lastExtRef.current === 'txt' || lastExtRef.current === 'csv' || lastExtRef.current === '')) {
      setResult(parseTxt(lastTextRef.current, utmZone, utmHemi, connectSeq, netType))
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleConfirm() {
    if (!result || !result.ok) return
    if (result.nodes.length > 0)    importNodes(result.nodes)
    if (result.segments.length > 0) importSegments(result.segments)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h3 className="text-sm font-bold text-white">Importar Arquivo</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-gray-700 rounded-xl p-6 text-center cursor-pointer hover:border-orange-500 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <Upload size={28} className="mx-auto text-gray-500 mb-2" />
            <p className="text-sm text-gray-400">Arraste ou clique para selecionar</p>
            <p className="text-[10px] text-gray-600 mt-1">.txt .csv .dxf .shp .json .ifc .dwg</p>
            {fileName && <p className="text-xs text-orange-400 mt-2 font-semibold">{fileName}</p>}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.dxf,.shp,.json,.ifc,.dwg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          {/* UTM options — shown when UTM coords detected */}
          {showUtmOpts && (
            <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-3 flex flex-col gap-2">
              <p className="text-xs text-blue-300 font-semibold">🌐 Coordenadas UTM detectadas</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase block mb-1">Zona UTM</label>
                  <input
                    type="number" min={1} max={60} value={utmZone}
                    onChange={(e) => { setUtmZone(Number(e.target.value)); }}
                    onBlur={reparse}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase block mb-1">Hemisfério</label>
                  <select
                    value={utmHemi}
                    onChange={(e) => { setUtmHemi(e.target.value as 'N' | 'S'); }}
                    onBlur={reparse}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="S">Sul (S)</option>
                    <option value="N">Norte (N)</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={connectSeq}
                  onChange={(e) => setConnectSeq(e.target.checked)}
                  className="accent-orange-500"
                />
                <span className="text-xs text-gray-300">Conectar como sequência de trechos</span>
              </label>

              {connectSeq && (
                <div>
                  <label className="text-[10px] text-gray-500 uppercase block mb-1">Tipo de Rede</label>
                  <select
                    value={netType}
                    onChange={(e) => setNetType(e.target.value as MapNetworkType)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
                  >
                    {(Object.keys(NETWORK_LABELS) as MapNetworkType[]).map((k) => (
                      <option key={k} value={k}>{NETWORK_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                onClick={reparse}
                className="self-end text-xs text-orange-400 hover:text-orange-300 transition-colors"
              >
                Recalcular →
              </button>
            </div>
          )}

          {/* Result */}
          {loading && <p className="text-xs text-gray-400 text-center">Analisando arquivo...</p>}
          {result && (
            <div className={`flex items-start gap-3 p-3 rounded-lg text-xs ${
              result.ok ? 'bg-green-900/30 border border-green-800' : 'bg-red-900/30 border border-red-800'
            }`}>
              {result.ok
                ? <CheckCircle size={14} className="text-green-400 shrink-0 mt-0.5" />
                : <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />}
              <p className={result.ok ? 'text-green-300' : 'text-red-300'}>{result.message}</p>
            </div>
          )}

          {/* Format info */}
          <div className="text-[10px] text-gray-600 space-y-0.5">
            <p><span className="text-gray-500">.txt/.csv</span> — lat,lng ou <span className="text-blue-500">easting,northing[,elevação]</span> (UTM auto-detectado)</p>
            <p><span className="text-gray-500">.dxf</span> — entidades LINE e LWPOLYLINE → nós e trechos</p>
            <p><span className="text-gray-500">.shp</span> — importa bounding box como 4 nós de canto</p>
            <p><span className="text-gray-500">.json</span> — formato nativo da plataforma &#123; nodes, segments &#125;</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!result?.ok}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <FileText size={13} className="inline mr-1" />
            Importar
          </button>
        </div>
      </div>
    </div>
  )
}
