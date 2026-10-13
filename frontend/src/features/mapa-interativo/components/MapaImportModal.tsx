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
import { useProjectContext } from '@/store/projectContext'
import { utmToWgs84 } from '@/utils/utmToWgs84'
import { parseKmlText, parseKmz, parseShpReal, parseGpkg, type GeoImportResult } from '@/utils/geoImport'
import { salvarImportComoAFazer } from '@/hooks/useGeoAFazer'
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
  const [salvarBanco, setSalvarBanco] = useState(false)
  const [salvandoBanco, setSalvandoBanco] = useState(false)
  const [bancoMsg, setBancoMsg] = useState<string | null>(null)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const projetos = useProjectContext((s) => s.projetos)
  const projetoAtivo = projetos.find((p) => p.id === activeProjectId) ?? null
  const fileRef = useRef<HTMLInputElement>(null)
  const lastTextRef = useRef<string | null>(null)
  const lastExtRef  = useRef<string>('')

  /** Converte nós com coordenadas UTM cruas (|lat|>90) para WGS84 usando zona/hemisfério da UI. */
  function fixUtmNodes(r: ParseResult): ParseResult {
    if (!r.ok) return r
    const pareceUtm = r.nodes.some((n) => Math.abs(n.lat) > 90 || Math.abs(n.lng) > 180)
    if (!pareceUtm) return r
    setShowUtmOpts(true)
    const nodes = r.nodes.map((n) => {
      if (Math.abs(n.lat) <= 90 && Math.abs(n.lng) <= 180) return n
      // DXF grava easting em lng(x) e northing em lat(y)
      const { lat, lng } = utmToWgs84(n.lng, n.lat, utmZone, utmHemi)
      return { ...n, lat, lng }
    })
    return { ...r, nodes, isUtm: true, message: `${r.message} (UTM ${utmZone}${utmHemi} → WGS84)` }
  }

  function geoToParse(r: GeoImportResult, formato: string): ParseResult {
    const avisos = r.warnings.length > 0 ? ` ⚠ ${r.warnings.join(' ')}` : ''
    return {
      ok: true,
      nodes: r.nodes,
      segments: r.segments,
      message: `${formato}: ${r.nodes.length} nós, ${r.segments.length} trechos (${r.featuresLidas} features).${avisos}`,
    }
  }

  function parseText(text: string, ext: string) {
    lastTextRef.current = text
    lastExtRef.current  = ext
    let r: ParseResult
    if (ext === 'dxf')  r = fixUtmNodes(parseDxf(text))
    else if (ext === 'json') r = parseJson(text)
    else if (ext === 'kml') {
      try { r = geoToParse(parseKmlText(text, { utmZone, utmHemi, networkType: netType }), 'KML') }
      catch (e) { r = { ok: false, message: e instanceof Error ? e.message : 'Erro ao ler KML.' } }
    }
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
      setResult({ ok: false, message: 'Formato DWG é binário proprietário da Autodesk. Converta para DXF (AutoCAD/LibreCAD/FreeCAD) e importe o DXF, ou use o Motor NS V5 (backend) que aceita DWG direto.' })
      setLoading(false)
      return
    }
    if (ext === 'ifc') {
      setResult({ ok: false, message: 'Formato IFC binário não suportado diretamente. Exporte como IFC-JSON ou DXF no seu software BIM (Revit, ArchiCAD, FreeCAD).' })
      setLoading(false)
      return
    }
    const opts = { utmZone, utmHemi, networkType: netType }
    if (ext === 'shp' || ext === 'zip') {
      file.arrayBuffer()
        .then((buf) => parseShpReal(buf, file.name, opts))
        .then((r) => setResult(fixUtmNodes(geoToParse(r, ext === 'zip' ? 'Shapefile (zip)' : 'SHP'))))
        .catch((e) => setResult({ ok: false, message: e instanceof Error ? e.message : 'Erro ao ler shapefile.' }))
        .finally(() => setLoading(false))
      return
    }
    if (ext === 'kmz') {
      file.arrayBuffer()
        .then((buf) => parseKmz(buf, opts))
        .then((r) => setResult(geoToParse(r, 'KMZ')))
        .catch((e) => setResult({ ok: false, message: e instanceof Error ? e.message : 'Erro ao ler KMZ.' }))
        .finally(() => setLoading(false))
      return
    }
    if (ext === 'gpkg') {
      file.arrayBuffer()
        .then((buf) => parseGpkg(buf, opts))
        .then((r) => setResult(geoToParse(r, `GPKG [${r.tabelas.join(', ')}]`)))
        .catch((e) => setResult({ ok: false, message: e instanceof Error ? e.message : 'Erro ao ler GPKG.' }))
        .finally(() => setLoading(false))
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

  async function handleConfirm() {
    if (!result || !result.ok) return
    if (salvarBanco) {
      if (!activeProjectId || !projetoAtivo) {
        setBancoMsg('Selecione um projeto ativo no topo do site para salvar como A Fazer.')
        return
      }
      setSalvandoBanco(true)
      setBancoMsg(null)
      try {
        const r = await salvarImportComoAFazer({
          nodes: result.nodes,
          segments: result.segments,
          projetoId: activeProjectId,
          nucleo: projetoAtivo.nome,
          isAgua: netType === 'water',
        })
        setBancoMsg(`Banco: ${r.pvs} PVs, ${r.trechos} trechos, ${r.ns} NS gravados em ${projetoAtivo.nome}.${r.avisos.length ? ' ⚠ ' + r.avisos.join(' ') : ''}`)
      } catch (e) {
        setBancoMsg(`Erro ao salvar no banco: ${e instanceof Error ? e.message : String(e)}`)
        setSalvandoBanco(false)
        return // não fecha nem importa pro mapa se o banco falhou — usuário decide
      }
      setSalvandoBanco(false)
    }
    if (result.nodes.length > 0)    importNodes(result.nodes)
    if (result.segments.length > 0) importSegments(result.segments)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#2c2c2c] border border-[#525252] rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-6 py-4 border-b border-[#525252]">
          <h3 className="text-sm font-bold text-white">Importar Arquivo</h3>
          <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#f5f5f5]"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-4">
          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-[#525252] rounded-xl p-6 text-center cursor-pointer hover:border-orange-500 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <Upload size={28} className="mx-auto text-[#6b6b6b] mb-2" />
            <p className="text-sm text-[#a3a3a3]">Arraste ou clique para selecionar</p>
            <p className="text-[10px] text-gray-600 mt-1">.kml .kmz .shp .zip .gpkg .dxf .txt .csv .json</p>
            {fileName && <p className="text-xs text-orange-400 mt-2 font-semibold">{fileName}</p>}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".txt,.csv,.dxf,.shp,.zip,.json,.ifc,.dwg,.kml,.kmz,.gpkg"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />

          {/* UTM options — shown when UTM coords detected */}
          {showUtmOpts && (
            <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-3 flex flex-col gap-2">
              <p className="text-xs text-blue-300 font-semibold">🌐 Coordenadas UTM detectadas</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-[#6b6b6b] uppercase block mb-1">Zona UTM</label>
                  <input
                    type="number" min={1} max={60} value={utmZone}
                    onChange={(e) => { setUtmZone(Number(e.target.value)); }}
                    onBlur={reparse}
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#6b6b6b] uppercase block mb-1">Hemisfério</label>
                  <select
                    value={utmHemi}
                    onChange={(e) => { setUtmHemi(e.target.value as 'N' | 'S'); }}
                    onBlur={reparse}
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
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
                <span className="text-xs text-[#f5f5f5]">Conectar como sequência de trechos</span>
              </label>

              {connectSeq && (
                <div>
                  <label className="text-[10px] text-[#6b6b6b] uppercase block mb-1">Tipo de Rede</label>
                  <select
                    value={netType}
                    onChange={(e) => setNetType(e.target.value as MapNetworkType)}
                    className="w-full bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500"
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
          {loading && <p className="text-xs text-[#a3a3a3] text-center">Analisando arquivo...</p>}
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

          {/* Salvar no banco como A Fazer */}
          <label className="flex items-center gap-2 cursor-pointer bg-[#3d3d3d]/50 border border-[#525252] rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={salvarBanco}
              onChange={(e) => setSalvarBanco(e.target.checked)}
              className="accent-orange-500"
            />
            <span className="text-xs text-[#f5f5f5]">
              Salvar no banco como <span className="font-semibold text-orange-400">A Fazer</span> (gera PV / Trecho / NS)
              {projetoAtivo ? <span className="text-[#6b6b6b]"> — projeto: {projetoAtivo.nome}</span> : <span className="text-red-400"> — nenhum projeto ativo!</span>}
            </span>
          </label>
          {bancoMsg && (
            <div className={`p-3 rounded-lg text-xs ${bancoMsg.startsWith('Erro') || bancoMsg.startsWith('Selecione') ? 'bg-red-900/30 border border-red-800 text-red-300' : 'bg-green-900/30 border border-green-800 text-green-300'}`}>
              {bancoMsg}
            </div>
          )}

          {/* Format info */}
          <div className="text-[10px] text-gray-600 space-y-0.5">
            <p><span className="text-[#6b6b6b]">.kml/.kmz</span> — Google Earth (WGS84), pontos e linhas</p>
            <p><span className="text-[#6b6b6b]">.shp/.zip</span> — Shapefile; zip com .prj reprojeta sozinho, .shp puro usa a zona UTM acima</p>
            <p><span className="text-[#6b6b6b]">.gpkg</span> — GeoPackage (QGIS); detecta SIRGAS2000/WGS84 UTM pelo EPSG</p>
            <p><span className="text-[#6b6b6b]">.dxf</span> — LINE/LWPOLYLINE; UTM convertido pela zona acima</p>
            <p><span className="text-[#6b6b6b]">.txt/.csv</span> — lat,lng ou easting,northing (UTM auto-detectado) · <span className="text-[#6b6b6b]">.json</span> — nativo</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#525252]">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#a3a3a3] hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!result?.ok || salvandoBanco}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <FileText size={13} className="inline mr-1" />
            {salvandoBanco ? 'Salvando no banco…' : salvarBanco ? 'Importar + Salvar A Fazer' : 'Importar'}
          </button>
        </div>
      </div>
    </div>
  )
}
