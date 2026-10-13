/**
 * geoImport.ts — Parsers client-side de formatos geográficos para o Mapa Interativo.
 * KML/KMZ (togeojson+jszip), SHP real (shpjs), GPKG (sql.js lendo SQLite + GPB/WKB).
 * Converte tudo para { nodes, segments } no formato da plataforma, reprojetando
 * UTM→WGS84 quando necessário (SIRGAS2000 UTM ≈ WGS84 UTM para fins de mapa).
 *
 * Honestidade de dado: nada é inventado — diâmetro/material só entram se vierem
 * nos atributos do arquivo; features não suportadas são contadas e reportadas.
 */
import JSZip from 'jszip'
import { kml as kmlToGeoJson } from '@tmcw/togeojson'
import { utmToWgs84 } from '@/utils/utmToWgs84'
import type { MapNode, MapSegment, MapNetworkType, MapNodeType } from '@/types'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface GeoImportOptions {
  utmZone: number
  utmHemi: 'N' | 'S'
  networkType: MapNetworkType
}

export interface GeoImportResult {
  nodes: MapNode[]
  segments: MapSegment[]
  warnings: string[]
  featuresLidas: number
  featuresIgnoradas: number
}

type Coord = [number, number] // [lng|x, lat|y]

// ─── Reprojeção ───────────────────────────────────────────────────────────────

/** EPSG → zona UTM. SIRGAS2000 UTM S: 31978-31985 (zona = epsg-31960). WGS84 UTM: 327xx S / 326xx N. */
function epsgToUtm(srs: number): { zone: number; hemi: 'N' | 'S' } | null {
  if (srs >= 31978 && srs <= 31985) return { zone: srs - 31960, hemi: 'S' }
  if (srs >= 32701 && srs <= 32760) return { zone: srs - 32700, hemi: 'S' }
  if (srs >= 32601 && srs <= 32660) return { zone: srs - 32600, hemi: 'N' }
  return null
}

/** Converte um par (x,y) para lat/lng WGS84, usando SRS conhecido ou heurística+fallback. */
function toWgs84(x: number, y: number, srs: number | null, opts: GeoImportOptions): { lat: number; lng: number } {
  if (srs === 4326 || srs === 4674 /* SIRGAS2000 geográfico ≈ WGS84 */) return { lat: y, lng: x }
  const utm = srs != null ? epsgToUtm(srs) : null
  if (utm) return utmToWgs84(x, y, utm.zone, utm.hemi)
  // Heurística: coordenadas geográficas cabem em ±180/±90
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return { lat: y, lng: x }
  return utmToWgs84(x, y, opts.utmZone, opts.utmHemi)
}

// ─── GeoJSON → rede (nós + trechos) ──────────────────────────────────────────

/** Distância haversine em metros. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

function pickProp(props: Record<string, unknown> | null | undefined, keys: string[]): string | undefined {
  if (!props) return undefined
  for (const k of Object.keys(props)) {
    if (keys.includes(k.toLowerCase())) {
      const v = props[k]
      if (v != null && String(v).trim() !== '') return String(v)
    }
  }
  return undefined
}

/**
 * Converte um FeatureCollection GeoJSON em nodes/segments da plataforma.
 * Reusa nós por coordenada (7 casas ≈ 1cm) para manter topologia entre linhas.
 * `srs`: EPSG das coordenadas do arquivo (null = desconhecido → heurística).
 */
export function geojsonToNetwork(
  fc: { features: Array<{ geometry: { type: string; coordinates: unknown } | null; properties?: Record<string, unknown> | null }> },
  opts: GeoImportOptions,
  srs: number | null = null,
): GeoImportResult {
  const nodes: MapNode[] = []
  const segments: MapSegment[] = []
  const warnings: string[] = []
  const nodeByCoord = new Map<string, MapNode>()
  let lidas = 0
  let ignoradas = 0

  function getNode(c: Coord, label?: string, nodeType: MapNodeType = 'junction'): MapNode {
    const { lat, lng } = toWgs84(c[0], c[1], srs, opts)
    const key = `${lat.toFixed(7)},${lng.toFixed(7)}`
    const existing = nodeByCoord.get(key)
    if (existing) {
      if (label && !existing.label) existing.label = label
      return existing
    }
    const node: MapNode = { id: crypto.randomUUID(), lat, lng, nodeType, label }
    nodeByCoord.set(key, node)
    nodes.push(node)
    return node
  }

  function addLine(coords: Coord[], props: Record<string, unknown> | null | undefined) {
    if (coords.length < 2) return
    const nome = pickProp(props, ['name', 'nome', 'label', 'trecho', 'ns', 'id'])
    const dn = pickProp(props, ['dn', 'dn_mm', 'diametro', 'diameter', 'diam'])
    const material = pickProp(props, ['material', 'mat', 'tubo'])
    const lineNodes = coords.map((c) => getNode(c))
    for (let i = 0; i < lineNodes.length - 1; i++) {
      segments.push({
        id: crypto.randomUUID(),
        fromNodeId: lineNodes[i].id,
        toNodeId: lineNodes[i + 1].id,
        networkType: opts.networkType,
        diameter: dn ? Number(String(dn).replace(/[^\d.]/g, '')) || undefined : undefined,
        material: material ?? undefined,
        label: nome,
      })
    }
  }

  for (const f of fc.features ?? []) {
    const g = f.geometry
    if (!g) { ignoradas++; continue }
    const props = f.properties
    lidas++
    switch (g.type) {
      case 'Point': {
        const c = g.coordinates as Coord
        getNode(c, pickProp(props, ['name', 'nome', 'label', 'pv', 'id']))
        break
      }
      case 'MultiPoint': {
        for (const c of g.coordinates as Coord[]) getNode(c, pickProp(props, ['name', 'nome']))
        break
      }
      case 'LineString': {
        addLine(g.coordinates as Coord[], props)
        break
      }
      case 'MultiLineString': {
        for (const line of g.coordinates as Coord[][]) addLine(line, props)
        break
      }
      case 'Polygon':
      case 'MultiPolygon':
        ignoradas++
        lidas--
        break
      default:
        ignoradas++
        lidas--
    }
  }

  if (ignoradas > 0) warnings.push(`${ignoradas} feature(s) ignoradas (polígonos/sem geometria — só pontos e linhas viram rede).`)
  return { nodes, segments, warnings, featuresLidas: lidas, featuresIgnoradas: ignoradas }
}

// ─── KML / KMZ ────────────────────────────────────────────────────────────────

export function parseKmlText(text: string, opts: GeoImportOptions): GeoImportResult {
  const dom = new DOMParser().parseFromString(text, 'text/xml')
  const err = dom.querySelector('parsererror')
  if (err) throw new Error('KML inválido (XML malformado).')
  const fc = kmlToGeoJson(dom) as Parameters<typeof geojsonToNetwork>[0]
  // KML é sempre WGS84 (lng,lat) por especificação
  return geojsonToNetwork(fc, opts, 4326)
}

export async function parseKmz(buffer: ArrayBuffer, opts: GeoImportOptions): Promise<GeoImportResult> {
  const zip = await JSZip.loadAsync(buffer)
  const names = Object.keys(zip.files).filter((n) => n.toLowerCase().endsWith('.kml'))
  if (names.length === 0) throw new Error('KMZ não contém nenhum .kml interno.')
  const docKml = names.find((n) => n.toLowerCase() === 'doc.kml') ?? names[0]
  const text = await zip.files[docKml].async('text')
  return parseKmlText(text, opts)
}

// ─── SHP (shpjs — geometria real, não bbox) ──────────────────────────────────

export async function parseShpReal(buffer: ArrayBuffer, fileName: string, opts: GeoImportOptions): Promise<GeoImportResult> {
  const shp = (await import('shpjs')).default
  const ext = fileName.split('.').pop()?.toLowerCase()
  let fc: { features: Array<{ geometry: { type: string; coordinates: unknown } | null; properties?: Record<string, unknown> | null }> }
  let srs: number | null = null
  if (ext === 'zip') {
    // Zip com .shp+.dbf+.prj → shpjs reprojeta para WGS84 quando há .prj
    const out = await shp(buffer)
    const fcs = Array.isArray(out) ? out : [out]
    fc = { features: fcs.flatMap((f) => (f as { features?: unknown[] }).features ?? []) } as typeof fc
    srs = 4326
  } else {
    // .shp isolado: geometria crua, sem projeção conhecida → heurística/fallback UTM
    const geoms = shp.parseShp(buffer) as Array<{ type: string; coordinates: unknown }>
    fc = { features: geoms.map((g) => ({ geometry: g, properties: null })) }
    srs = null
  }
  return geojsonToNetwork(fc, opts, srs)
}

// ─── GPKG (sql.js + parser GPB/WKB) ──────────────────────────────────────────

/** Lê o header GeoPackage Binary e retorna offset do WKB + srs_id. */
function readGpbHeader(view: DataView): { wkbOffset: number; srsId: number } | null {
  if (view.byteLength < 8) return null
  if (view.getUint8(0) !== 0x47 || view.getUint8(1) !== 0x50) return null // "GP"
  const flags = view.getUint8(3)
  const little = (flags & 0x01) === 1
  const envInd = (flags >> 1) & 0x07
  const srsId = view.getInt32(4, little)
  const envSizes = [0, 32, 48, 48, 64]
  const envSize = envSizes[envInd] ?? 0
  return { wkbOffset: 8 + envSize, srsId }
}

/** Parser WKB mínimo: Point, LineString, MultiPoint, MultiLineString (com variantes Z/M). */
function parseWkb(view: DataView, offset: number): { type: string; coordinates: unknown; next: number } | null {
  if (offset + 5 > view.byteLength) return null
  const little = view.getUint8(offset) === 1
  let raw = view.getUint32(offset + 1, little)
  let hasZ = false
  let hasM = false
  if (raw & 0x80000000) { hasZ = true; raw &= 0x7fffffff }
  if (raw & 0x40000000) { hasM = true; raw &= 0x3fffffff }
  let base = raw
  if (base >= 3000) { hasZ = true; hasM = true; base -= 3000 }
  else if (base >= 2000) { hasM = true; base -= 2000 }
  else if (base >= 1000) { hasZ = true; base -= 1000 }
  const dims = 2 + (hasZ ? 1 : 0) + (hasM ? 1 : 0)
  let o = offset + 5

  const readPt = (): Coord => {
    const x = view.getFloat64(o, little)
    const y = view.getFloat64(o + 8, little)
    o += 8 * dims
    return [x, y]
  }

  switch (base) {
    case 1: { // Point
      const c = readPt()
      return { type: 'Point', coordinates: c, next: o }
    }
    case 2: { // LineString
      const n = view.getUint32(o, little); o += 4
      const coords: Coord[] = []
      for (let i = 0; i < n; i++) coords.push(readPt())
      return { type: 'LineString', coordinates: coords, next: o }
    }
    case 4: { // MultiPoint — cada ponto é um WKB completo
      const n = view.getUint32(o, little); o += 4
      const coords: Coord[] = []
      for (let i = 0; i < n; i++) {
        const sub = parseWkb(view, o)
        if (!sub || sub.type !== 'Point') return null
        coords.push(sub.coordinates as Coord)
        o = sub.next
      }
      return { type: 'MultiPoint', coordinates: coords, next: o }
    }
    case 5: { // MultiLineString — cada linha é um WKB completo
      const n = view.getUint32(o, little); o += 4
      const lines: Coord[][] = []
      for (let i = 0; i < n; i++) {
        const sub = parseWkb(view, o)
        if (!sub || sub.type !== 'LineString') return null
        lines.push(sub.coordinates as Coord[])
        o = sub.next
      }
      return { type: 'MultiLineString', coordinates: lines, next: o }
    }
    default:
      return null // Polygon etc — ignorado pelo chamador
  }
}

export async function parseGpkg(buffer: ArrayBuffer, opts: GeoImportOptions): Promise<GeoImportResult & { tabelas: string[] }> {
  const mod = await import('sql.js')
  const initSqlJs = (typeof mod.default === 'function' ? mod.default : mod) as unknown as (cfg?: object) => Promise<{ Database: new (data: Uint8Array) => { exec: (sql: string) => Array<{ values: unknown[][] }>; prepare: (sql: string) => { step: () => boolean; getAsObject: () => Record<string, unknown>; free: () => void }; close: () => void } }>
  // wasmBinary direto: evita qualquer resolução de caminho do bundler (o entry
  // "browser" do sql.js no Vite ignora locateFile e busca o wasm no lugar errado)
  const wasmResp = await fetch('/sql-wasm.wasm')
  if (!wasmResp.ok) throw new Error('sql-wasm.wasm não encontrado no servidor (public/).')
  const wasmBinary = await wasmResp.arrayBuffer()
  const SQL = await initSqlJs({ wasmBinary })
  const db = new SQL.Database(new Uint8Array(buffer))
  try {
    const contents = db.exec(
      `select c.table_name, g.column_name, g.srs_id
       from gpkg_contents c join gpkg_geometry_columns g on g.table_name = c.table_name
       where c.data_type = 'features'`,
    )
    if (contents.length === 0 || contents[0].values.length === 0) {
      throw new Error('GPKG não contém tabelas de features (gpkg_contents vazio).')
    }

    const allFeatures: Array<{ geometry: { type: string; coordinates: unknown } | null; properties: Record<string, unknown> | null }> = []
    const tabelas: string[] = []
    const warnings: string[] = []
    let srsGeral: number | null = null
    let naoSuportadas = 0

    for (const [tableName, geomCol, srsId] of contents[0].values as Array<[string, string, number]>) {
      tabelas.push(String(tableName))
      if (srsGeral == null && typeof srsId === 'number') srsGeral = srsId
      // Colunas de atributo úteis (nome/dn/material) sem trazer blob gigante desnecessário
      const stmt = db.prepare(`select * from "${String(tableName).replace(/"/g, '""')}"`)
      while (stmt.step()) {
        const row = stmt.getAsObject() as Record<string, unknown>
        const blob = row[geomCol] as Uint8Array | null
        const props: Record<string, unknown> = {}
        for (const k of Object.keys(row)) if (k !== geomCol) props[k] = row[k]
        if (!blob || !(blob instanceof Uint8Array)) { allFeatures.push({ geometry: null, properties: props }); continue }
        const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength)
        const gpb = readGpbHeader(view)
        if (!gpb) { naoSuportadas++; continue }
        const wkb = parseWkb(view, gpb.wkbOffset)
        if (!wkb) { naoSuportadas++; continue }
        allFeatures.push({ geometry: { type: wkb.type, coordinates: wkb.coordinates }, properties: props })
      }
      stmt.free()
    }

    if (naoSuportadas > 0) warnings.push(`${naoSuportadas} geometria(s) não suportadas (polígonos/curvas) foram ignoradas.`)
    const result = geojsonToNetwork({ features: allFeatures }, opts, srsGeral)
    result.warnings.push(...warnings)
    return { ...result, tabelas }
  } finally {
    db.close()
  }
}
