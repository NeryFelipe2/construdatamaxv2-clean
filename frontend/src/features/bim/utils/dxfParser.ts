/**
 * dxfParser.ts — Pure browser DXF parser (AutoCAD Drawing Exchange Format).
 *
 * Parses ASCII DXF files and converts entities to BimSegment objects.
 * Supported entities: LINE, LWPOLYLINE, POLYLINE (+ VERTEX), 3DPOLYLINE,
 *                     CIRCLE, ARC, SPLINE, 3DFACE
 *
 * Security:
 *  - No eval, no dynamic code execution
 *  - Strict numeric parsing with NaN guards
 *  - Hard limit of 100 000 entities to prevent DoS from malformed files
 */
import type { BimSegment } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ENTITIES = 100_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeFloat(v: string): number {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

function calcLength(vertices: [number, number, number][]): number {
  let len = 0
  for (let i = 1; i < vertices.length; i++) {
    const dx = vertices[i][0] - vertices[i - 1][0]
    const dy = vertices[i][1] - vertices[i - 1][1]
    const dz = vertices[i][2] - vertices[i - 1][2]
    len += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return Math.round(len * 100) / 100
}

function avgDepth(vertices: [number, number, number][]): number {
  if (vertices.length === 0) return 0
  const sum = vertices.reduce((acc, v) => acc + Math.abs(v[2]), 0)
  return Math.round((sum / vertices.length) * 100) / 100
}

/** Derive element type from DXF layer name (heuristic) */
function layerToElementType(layer: string): BimSegment['elementType'] {
  const l = layer.toUpperCase()
  if (/TUBO|PIPE|REDE|ESGOTO|AGUA|AGUA|CANAL|DRENAGEM|SEWER|WATER|DRAIN/.test(l)) return 'pipe'
  if (/LAJE|SLAB|PISO|FLOOR|FORRO|TETO/.test(l))                                   return 'slab'
  if (/PILAR|COLUNA|COLUMN|PILLAR/.test(l))                                         return 'column'
  if (/PAREDE|WALL|MURO|FACADE|FACHADA|VEDACAO/.test(l))                            return 'wall'
  if (/VIGA|BEAM|BALDRAME|CINTAS|CINTA/.test(l))                                    return 'beam'
  return 'pipe' // default for construction drawings
}

/** Approximate ARC as N line segments */
function arcToVertices(
  cx: number, cy: number, cz: number,
  radius: number,
  startDeg: number, endDeg: number,
  segments = 12,
): [number, number, number][] {
  const pts: [number, number, number][] = []
  let a0 = (startDeg * Math.PI) / 180
  let a1 = (endDeg * Math.PI) / 180
  // Ensure arc sweeps counter-clockwise
  if (a1 <= a0) a1 += 2 * Math.PI
  const step = (a1 - a0) / segments
  for (let i = 0; i <= segments; i++) {
    const angle = a0 + i * step
    pts.push([cx + radius * Math.cos(angle), cy + radius * Math.sin(angle), cz])
  }
  return pts
}

// ─── Token reader ─────────────────────────────────────────────────────────────

interface DxfToken { code: number; value: string }

function tokenize(text: string): DxfToken[] {
  const lines = text.split(/\r?\n/)
  const tokens: DxfToken[] = []
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = parseInt(lines[i].trim(), 10)
    if (isNaN(code)) continue
    tokens.push({ code, value: lines[i + 1]?.trim() ?? '' })
  }
  return tokens
}

// ─── Raw entity storage ────────────────────────────────────────────────────────

interface RawEntity {
  type:    string
  layer:   string
  codes:   Map<number, string[]>  // code → list of values (some codes repeat)
}

function newRaw(type: string): RawEntity {
  return { type, layer: '0', codes: new Map() }
}

function pushCode(e: RawEntity, code: number, value: string) {
  const arr = e.codes.get(code)
  if (arr) arr.push(value)
  else e.codes.set(code, [value])
}

function getCode(e: RawEntity, code: number, idx = 0): string {
  return e.codes.get(code)?.[idx] ?? ''
}

function getCodeF(e: RawEntity, code: number, idx = 0): number {
  return safeFloat(getCode(e, code, idx))
}

// ─── Entity → BimSegment converters ──────────────────────────────────────────

function makeSeg(
  vertices: [number, number, number][],
  layer: string,
  attrs: Record<string, string | number> = {},
  diameterMm = 200,
): BimSegment | null {
  if (vertices.length < 2) return null
  const length = calcLength(vertices)
  if (length < 0.001) return null  // degenerate
  return {
    id:          crypto.randomUUID(),
    vertices,
    attributes:  { LAYER: layer, ...attrs },
    trechoCode:  String(attrs['TRECHO'] ?? ''),
    lengthM:     length,
    avgDepthM:   avgDepth(vertices),
    diameter:    diameterMm,
    material:    String(attrs['MATERIAL'] ?? 'DXF'),
    unitCostBRL: 0,
    totalCostBRL: 0,
    constructionDate: String(attrs['DATE'] ?? attrs['DATA'] ?? ''),
    phase:       String(attrs['PHASE'] ?? attrs['FASE'] ?? layer),
    elementType: layerToElementType(layer),
  }
}

function convertLine(e: RawEntity): BimSegment | null {
  const x0 = getCodeF(e, 10), y0 = getCodeF(e, 20), z0 = getCodeF(e, 30)
  const x1 = getCodeF(e, 11), y1 = getCodeF(e, 21), z1 = getCodeF(e, 31)
  return makeSeg([[x0, y0, z0], [x1, y1, z1]], e.layer)
}

function convertLwpolyline(e: RawEntity): BimSegment | null {
  const xs = e.codes.get(10) ?? []
  const ys = e.codes.get(20) ?? []
  const elevation = getCodeF(e, 38)
  const vertices: [number, number, number][] = xs.map((x, i) => [
    safeFloat(x), safeFloat(ys[i] ?? '0'), elevation,
  ])
  return makeSeg(vertices, e.layer)
}

function convertPolyline(e: RawEntity, vertices3d: [number, number, number][]): BimSegment | null {
  if (vertices3d.length < 2) return null
  return makeSeg(vertices3d, e.layer)
}

function convertCircle(e: RawEntity): BimSegment | null {
  const cx = getCodeF(e, 10), cy = getCodeF(e, 20), cz = getCodeF(e, 30)
  const r = getCodeF(e, 40)
  if (r <= 0) return null
  // Represent circle as a single node (manhole / junction)
  const pts = arcToVertices(cx, cy, cz, r, 0, 360, 12)
  return makeSeg(pts, e.layer, {}, Math.round(r * 2000))  // diameter in mm
}

function convertArc(e: RawEntity): BimSegment | null {
  const cx = getCodeF(e, 10), cy = getCodeF(e, 20), cz = getCodeF(e, 30)
  const r  = getCodeF(e, 40)
  const a0 = getCodeF(e, 50)
  const a1 = getCodeF(e, 51)
  if (r <= 0) return null
  const pts = arcToVertices(cx, cy, cz, r, a0, a1, 12)
  return makeSeg(pts, e.layer)
}

function convertSpline(e: RawEntity): BimSegment | null {
  const xs = e.codes.get(10) ?? []
  const ys = e.codes.get(20) ?? []
  const zs = e.codes.get(30) ?? []
  const vertices: [number, number, number][] = xs.map((x, i) => [
    safeFloat(x), safeFloat(ys[i] ?? '0'), safeFloat(zs[i] ?? '0'),
  ])
  return makeSeg(vertices, e.layer)
}

function convert3dFace(e: RawEntity): BimSegment | null {
  // 3DFACE has 4 corner points: codes 10-13, 20-23, 30-33
  const corners: [number, number, number][] = []
  for (let i = 0; i < 4; i++) {
    corners.push([getCodeF(e, 10 + i), getCodeF(e, 20 + i), getCodeF(e, 30 + i)])
  }
  // Close the polygon
  corners.push(corners[0])
  return makeSeg(corners, e.layer)
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parse an ASCII DXF file (provided as ArrayBuffer) into BimSegment[].
 * Returns an empty array on failure (never throws).
 */
export function parseDxf(buffer: ArrayBuffer): BimSegment[] {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    return []
  }

  const tokens = tokenize(text)
  const segments: BimSegment[] = []

  let inEntities = false
  let currentEntity: RawEntity | null = null
  let isPolyline = false
  let polyVertices: [number, number, number][] = []
  let polyEntity:   RawEntity | null = null
  let entityCount = 0

  for (let i = 0; i < tokens.length; i++) {
    const { code, value } = tokens[i]

    // ── Section detection ──────────────────────────────────────────────────
    if (code === 0 && value === 'SECTION') {
      // next token should be code 2 with section name
      const next = tokens[i + 1]
      if (next?.code === 2) {
        inEntities = next.value === 'ENTITIES'
        i++
      }
      continue
    }
    if (code === 0 && value === 'ENDSEC') {
      inEntities = false
      // Flush pending polyline
      if (isPolyline && polyEntity && polyVertices.length >= 2) {
        const seg = convertPolyline(polyEntity, polyVertices)
        if (seg) segments.push(seg)
      }
      isPolyline = false; polyVertices = []; polyEntity = null; currentEntity = null
      continue
    }

    if (!inEntities) continue

    // ── Entity boundary ────────────────────────────────────────────────────
    if (code === 0) {
      // Flush the previous entity
      if (currentEntity && !isPolyline) {
        const t = currentEntity.type
        let seg: BimSegment | null = null
        if (t === 'LINE')        seg = convertLine(currentEntity)
        else if (t === 'LWPOLYLINE') seg = convertLwpolyline(currentEntity)
        else if (t === 'CIRCLE')     seg = convertCircle(currentEntity)
        else if (t === 'ARC')        seg = convertArc(currentEntity)
        else if (t === 'SPLINE')     seg = convertSpline(currentEntity)
        else if (t === '3DFACE')     seg = convert3dFace(currentEntity)
        if (seg) segments.push(seg)
      }

      const entityType = value

      if (entityType === 'POLYLINE' || entityType === '3DPOLYLINE') {
        // Flush previous polyline if any
        if (isPolyline && polyEntity && polyVertices.length >= 2) {
          const seg = convertPolyline(polyEntity, polyVertices)
          if (seg) segments.push(seg)
        }
        isPolyline   = true
        polyVertices = []
        polyEntity   = newRaw(entityType)
        currentEntity = polyEntity
      } else if (entityType === 'VERTEX' && isPolyline) {
        // Don't reset currentEntity; let group code accumulation handle vertex
        currentEntity = newRaw('VERTEX')
      } else if (entityType === 'SEQEND') {
        // End of polyline vertices
        if (isPolyline && polyEntity && polyVertices.length >= 2) {
          const seg = convertPolyline(polyEntity, polyVertices)
          if (seg) segments.push(seg)
        }
        isPolyline = false; polyVertices = []; polyEntity = null
        currentEntity = null
      } else {
        // Regular entity
        if (isPolyline && polyEntity && polyVertices.length >= 2) {
          const seg = convertPolyline(polyEntity, polyVertices)
          if (seg) segments.push(seg)
        }
        isPolyline = false; polyVertices = []; polyEntity = null
        currentEntity = newRaw(entityType)
      }

      entityCount++
      if (entityCount > MAX_ENTITIES) break
      continue
    }

    // ── Accumulate group codes ──────────────────────────────────────────────
    if (!currentEntity) continue

    // Layer name
    if (code === 8) {
      currentEntity.layer = value
      if (isPolyline && currentEntity === polyEntity) polyEntity.layer = value
    } else {
      pushCode(currentEntity, code, value)
    }

    // For VERTEX entities, accumulate 3D coords into polyVertices array
    if (currentEntity.type === 'VERTEX') {
      // We'll collect X/Y/Z once we have all three codes.
      // DXF guarantees 10 comes before 20 before 30 for the same vertex,
      // so when we hit code 30 we have a complete vertex.
      if (code === 30) {
        const x = safeFloat(getCode(currentEntity, 10))
        const y = safeFloat(getCode(currentEntity, 20))
        const z = safeFloat(getCode(currentEntity, 30))
        polyVertices.push([x, y, z])
      }
    }

    // For POLYLINE header (before VERTEX entities), capture layer
    if (isPolyline && currentEntity === polyEntity) {
      // Already handled above
    }
  }

  // Flush any remaining entity
  if (currentEntity && !isPolyline) {
    const t = currentEntity.type
    let seg: BimSegment | null = null
    if (t === 'LINE')        seg = convertLine(currentEntity)
    else if (t === 'LWPOLYLINE') seg = convertLwpolyline(currentEntity)
    else if (t === 'CIRCLE')     seg = convertCircle(currentEntity)
    else if (t === 'ARC')        seg = convertArc(currentEntity)
    else if (t === 'SPLINE')     seg = convertSpline(currentEntity)
    else if (t === '3DFACE')     seg = convert3dFace(currentEntity)
    if (seg) segments.push(seg)
  }
  if (isPolyline && polyEntity && polyVertices.length >= 2) {
    const seg = convertPolyline(polyEntity, polyVertices)
    if (seg) segments.push(seg)
  }

  return segments
}

// ─── Layer extractor (for generating BimLayer list) ─────────────────────────

export function extractDxfLayers(buffer: ArrayBuffer): string[] {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } catch {
    return []
  }
  const tokens = tokenize(text)
  const layerNames = new Set<string>()

  // Pass 1: collect from TABLES / LAYER
  let inTables = false, inLayerTable = false
  for (let i = 0; i < tokens.length; i++) {
    const { code, value } = tokens[i]
    if (code === 0 && value === 'SECTION') {
      const next = tokens[i + 1]
      if (next?.code === 2) { inTables = next.value === 'TABLES'; i++ }
      continue
    }
    if (code === 0 && value === 'ENDSEC') { inTables = false; inLayerTable = false; continue }
    if (!inTables) continue
    if (code === 0 && value === 'TABLE') {
      const next = tokens[i + 1]
      if (next?.code === 2) { inLayerTable = next.value === 'LAYER'; i++ }
      continue
    }
    if (code === 0 && value === 'ENDTAB') { inLayerTable = false; continue }
    if (inLayerTable && code === 2) layerNames.add(value)
  }

  // Pass 2: collect layer names from entity group code 8
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].code === 8) layerNames.add(tokens[i].value)
  }

  return [...layerNames].filter((l) => l !== '0' && l.length > 0)
}

/** Build BimLayer list from parsed segments */
export function buildLayersFromSegments(segments: BimSegment[]): import('@/types').BimLayer[] {
  const layerMap = new Map<string, string>()
  for (const s of segments) {
    const layer = String(s.attributes['LAYER'] ?? '')
    if (!layer) continue
    if (!layerMap.has(layer)) {
      // Assign color based on element type
      const colorMap: Record<string, string> = {
        pipe:   '#2abfdc',
        slab:   '#94a3b8',
        column: '#f59e0b',
        wall:   '#64748b',
        beam:   '#a78bfa',
      }
      layerMap.set(layer, colorMap[s.elementType ?? 'pipe'] ?? '#6366f1')
    }
  }
  return [...layerMap.entries()].map(([name, color]) => ({
    id:      name,
    name,
    visible: true,
    color,
  }))
}
