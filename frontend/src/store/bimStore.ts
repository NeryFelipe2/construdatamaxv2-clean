/**
 * bimStore.ts — Zustand store for the BIM 3D/4D/5D module.
 * Supports multiple projects (demo + imported), cross-module sync with
 * Planejamento (4D dates) and Quantitativos (5D costs).
 */
import { create } from 'zustand'
import type { BimProject, BimSegment, BimLayer, BimColorMode, BimTab } from '@/types'
import { MOCK_BIM_PROJECT, MOCK_BIM_SANEAMENTO, MOCK_BIM_BUILDING } from '@/data/mockBim'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcLength(vertices: [number, number, number][]): number {
  let len = 0
  for (let i = 1; i < vertices.length; i++) {
    const dx = vertices[i][0] - vertices[i - 1][0]
    const dy = vertices[i][1] - vertices[i - 1][1]
    const dz = vertices[i][2] - vertices[i - 1][2]
    len += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  return Math.round(len * 10) / 10
}

function avgDepth(vertices: [number, number, number][]): number {
  if (vertices.length === 0) return 0
  const sum = vertices.reduce((acc, v) => acc + Math.abs(v[2]), 0)
  return Math.round((sum / vertices.length) * 100) / 100
}

function dateRangeFromSegments(segments: BimSegment[]): { start: string; end: string } {
  const dates = segments
    .map((s) => s.constructionDate)
    .filter((d): d is string => !!d && d.length === 10)
    .sort()
  return {
    start: dates[0] ?? '2025-01-01',
    end:   dates[dates.length - 1] ?? '2025-12-31',
  }
}

// ─── Shapefile parsing ────────────────────────────────────────────────────────

async function parseShapefileToSegments(
  shp: ArrayBuffer,
  dbf: ArrayBuffer,
): Promise<BimSegment[]> {
  const shpjs = await import('shpjs')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geometries: any[] = (shpjs as any).parseShp(shp)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attributes: Record<string, string | number>[] = (shpjs as any).dbf.parseDbf(dbf)

  return geometries.map((geom, i) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coords: any[] = geom.coordinates ?? []
    const vertices: [number, number, number][] = coords.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => [c[0] ?? 0, c[1] ?? 0, c[2] ?? 0],
    )
    const attrs = attributes[i] ?? {}
    const diameter = Number(attrs['DIAMETER'] ?? attrs['DN'] ?? 200)
    const material = String(attrs['MATERIAL'] ?? 'PVC')
    const unitCost = 85
    const length = calcLength(vertices)

    return {
      id: crypto.randomUUID(),
      vertices,
      attributes: attrs,
      trechoCode: String(attrs['TRECHO'] ?? ''),
      lengthM:   length,
      avgDepthM: avgDepth(vertices),
      diameter,
      material,
      unitCostBRL:  unitCost,
      totalCostBRL: Math.round(length * unitCost),
      constructionDate: String(attrs['DATE'] ?? attrs['DATA'] ?? ''),
      phase: String(attrs['PHASE'] ?? attrs['FASE'] ?? ''),
    }
  })
}

// ─── State ────────────────────────────────────────────────────────────────────

interface BimState {
  activeTab:       BimTab
  projects:        BimProject[]
  activeProjectId: string | null
  project:         BimProject | null   // derived: projects.find(id === activeProjectId)
  selectedSegmentId: string | null
  colorMode:       BimColorMode
  timelineDateRange: { start: string; end: string }
  activeDate:      string
  layers:          BimLayer[]          // mirror of active project layers
  isLoading:       boolean
  loadError:       string | null

  // Forge / APS Viewer
  viewerMode:       'threejs' | 'forge'
  droneMode:        boolean
  forgeToken:       string | null
  forgeTokenExpiry: number | null
  forgeUrn:         string | null
  forgeClientId:    string | null

  setActiveTab(tab: BimTab): void
  addProject(p: BimProject): void
  setActiveProject(id: string): void
  loadShapefile(shp: ArrayBuffer, dbf: ArrayBuffer): Promise<void>
  loadSurveyFile(text: string, fileName: string): void
  loadDxfFile(buffer: ArrayBuffer, fileName: string): void
  selectSegment(id: string | null): void
  setColorMode(mode: BimColorMode): void
  setActiveDate(date: string): void
  toggleLayer(id: string): void
  syncWithPlanejamento(): Promise<void>
  syncWithQuantitativos(): Promise<void>
  loadDemoData(): void
  clearData(): void

  // Forge actions
  setViewerMode(mode: 'threejs' | 'forge'): void
  setForgeCredentials(clientId: string, clientSecret: string): void
  setForgeToken(token: string, expiry: number): void
  setForgeUrn(urn: string): void
  toggleDroneMode(): void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBimStore = create<BimState>((set, get) => ({
  activeTab:         'viewer',
  projects:          [],
  activeProjectId:   null,
  project:           null,
  selectedSegmentId: null,
  colorMode:         'default',
  timelineDateRange: { start: '2025-01-01', end: '2025-12-31' },
  activeDate:        '2025-06-01',
  layers:            [],
  isLoading:         false,
  loadError:         null,

  // Forge / APS
  viewerMode:       'threejs',
  droneMode:        false,
  forgeToken:       null,
  forgeTokenExpiry: null,
  forgeUrn:         null,
  forgeClientId:    null,

  setActiveTab(tab) { set({ activeTab: tab }) },

  addProject(p) {
    const range = dateRangeFromSegments(p.segments)
    set((s) => ({
      projects:          [...s.projects, p],
      activeProjectId:   p.id,
      project:           p,
      layers:            p.layers.map((l) => ({ ...l, visible: true })),
      timelineDateRange: range,
      activeDate:        range.start,
      selectedSegmentId: null,
    }))
  },

  setActiveProject(id) {
    const p = get().projects.find((proj) => proj.id === id) ?? null
    if (!p) return
    const range = dateRangeFromSegments(p.segments)
    set({
      activeProjectId:   id,
      project:           p,
      layers:            p.layers.map((l) => ({ ...l, visible: true })),
      timelineDateRange: range,
      activeDate:        range.start,
      selectedSegmentId: null,
      colorMode:         'default',
    })
  },

  async loadShapefile(shp, dbf) {
    set({ isLoading: true, loadError: null })
    try {
      const segments = await parseShapefileToSegments(shp, dbf)
      const range = dateRangeFromSegments(segments)
      const p: BimProject = {
        id:                  crypto.randomUUID(),
        name:                'Shapefile importado',
        type:                'sanitation',
        segments,
        layers:              MOCK_BIM_PROJECT.layers,
        uploadedAt:          new Date().toISOString(),
        shapefileSourceName: 'importado.shp',
      }
      set((s) => ({
        projects:          [...s.projects, p],
        activeProjectId:   p.id,
        project:           p,
        layers:            p.layers.map((l) => ({ ...l, visible: true })),
        timelineDateRange: range,
        activeDate:        range.start,
        selectedSegmentId: null,
        isLoading:         false,
      }))
    } catch (err) {
      set({ isLoading: false, loadError: String(err) })
    }
  },

  loadSurveyFile(text, fileName) {
    // Inline parsing: id,name,northing,easting,depth per line
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    type SurveyPoint = { id: string; name: string; x: number; y: number; z: number }
    const pts: SurveyPoint[] = []

    for (const line of lines) {
      const cols = line.split(',').map((c) => c.trim())
      if (cols.length < 5) continue
      const n = parseFloat(cols[2])
      const e = parseFloat(cols[3])
      const d = parseFloat(cols[4])
      if (isNaN(n) || isNaN(e) || isNaN(d)) continue
      pts.push({ id: cols[0], name: cols[1] ?? '', x: e, y: n, z: -Math.abs(d) })
    }

    if (pts.length < 2) return

    // Normalize to local coordinates
    const minX = Math.min(...pts.map((p) => p.x))
    const minY = Math.min(...pts.map((p) => p.y))
    const normalized = pts.map((p) => ({ ...p, x: p.x - minX, y: p.y - minY }))

    // Group by side (D / E suffix)
    const groups: Record<string, SurveyPoint[]> = {}
    for (const pt of normalized) {
      const suffix = pt.name.match(/[DE]$/i)?.[0]?.toUpperCase() ?? 'X'
      groups[suffix] = groups[suffix] ?? []
      groups[suffix].push(pt)
    }

    const segments: BimSegment[] = []
    let segIdx = 0
    for (const [_side, group] of Object.entries(groups)) {
      for (let i = 0; i < group.length - 1; i++) {
        const a = group[i]
        const b = group[i + 1]
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz)
        segments.push({
          id: `survey-${++segIdx}`,
          vertices: [[a.x, a.y, a.z], [b.x, b.y, b.z]],
          attributes: { NOME_INI: a.name, NOME_FIM: b.name, DIAMETER: 200, MATERIAL: 'PVC' },
          trechoCode: `S${String(segIdx).padStart(2, '0')}`,
          lengthM:    Math.round(len * 10) / 10,
          avgDepthM:  Math.round(((Math.abs(a.z) + Math.abs(b.z)) / 2) * 100) / 100,
          diameter:   200,
          material:   'PVC',
          unitCostBRL:  85,
          totalCostBRL: Math.round(len * 85),
          phase:      a.name.replace(/[0-9DE]+$/, '').trim() || 'Levantamento',
        })
      }
    }

    const p: BimProject = {
      id:                  crypto.randomUUID(),
      name:                fileName.replace(/\.[^.]+$/, '') || 'Levantamento',
      type:                'sanitation',
      segments,
      layers: [
        { id: 'sv-pvc',   name: 'PVC',   visible: true, color: '#3b82f6', attribute: 'MATERIAL' },
        { id: 'sv-dn200', name: 'DN200', visible: true, color: '#8b5cf6', attribute: 'DIAMETER' },
      ],
      uploadedAt:          new Date().toISOString(),
      shapefileSourceName: fileName,
    }

    set((s) => ({
      projects:          [...s.projects, p],
      activeProjectId:   p.id,
      project:           p,
      layers:            p.layers,
      timelineDateRange: dateRangeFromSegments(segments),
      activeDate:        new Date().toISOString().slice(0, 10),
      selectedSegmentId: null,
    }))
  },

  loadDxfFile(buffer, fileName) {
    import('../features/bim/utils/dxfParser').then(({ parseDxf, buildLayersFromSegments }) => {
      set({ isLoading: true, loadError: null })
      try {
        const segments = parseDxf(buffer)
        if (segments.length === 0) {
          set({ isLoading: false, loadError: 'Nenhuma entidade encontrada no arquivo DXF.' })
          return
        }
        // Detect project type from layer names
        const hasBuilding = segments.some(
          (s) => s.elementType === 'slab' || s.elementType === 'column' || s.elementType === 'wall',
        )
        const projectType: import('@/types').BimProject['type'] = hasBuilding ? 'building' : 'sanitation'
        const layers = buildLayersFromSegments(segments)
        const range  = dateRangeFromSegments(segments)
        const p: import('@/types').BimProject = {
          id:                  crypto.randomUUID(),
          name:                fileName.replace(/\.dxf$/i, '') || 'DXF importado',
          type:                projectType,
          segments,
          layers,
          uploadedAt:          new Date().toISOString(),
          shapefileSourceName: fileName,
        }
        set((s) => ({
          projects:          [...s.projects, p],
          activeProjectId:   p.id,
          project:           p,
          layers:            layers.map((l) => ({ ...l, visible: true })),
          timelineDateRange: range,
          activeDate:        range.start,
          selectedSegmentId: null,
          isLoading:         false,
          loadError:         null,
        }))
      } catch (err) {
        set({ isLoading: false, loadError: `Erro ao processar DXF: ${String(err)}` })
      }
    })
  },

  selectSegment(id)    { set({ selectedSegmentId: id }) },
  setColorMode(mode)   { set({ colorMode: mode }) },
  setActiveDate(date)  { set({ activeDate: date }) },

  toggleLayer(id) {
    set((s) => {
      const newLayers = s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
      const newProject = s.project ? { ...s.project, layers: newLayers } : null
      const newProjects = s.projects.map((p) =>
        p.id === s.activeProjectId ? { ...p, layers: newLayers } : p,
      )
      return { layers: newLayers, project: newProject, projects: newProjects }
    })
  },

  async syncWithPlanejamento() {
    try {
      const { usePlanejamentoStore } = await import('./planejamentoStore')
      type PT = { code: string; plannedStartDate?: string }
      const state = usePlanejamentoStore.getState() as unknown as { trechos: PT[] }
      const trechos = state.trechos ?? []
      set((s) => {
        if (!s.project) return s
        const updated = s.project.segments.map((seg) => {
          const match = trechos.find((t) => t.code === seg.trechoCode)
          if (!match?.plannedStartDate) return seg
          return { ...seg, constructionDate: match.plannedStartDate }
        })
        const newProject = { ...s.project, segments: updated }
        const newProjects = s.projects.map((p) =>
          p.id === s.activeProjectId ? newProject : p,
        )
        const range = dateRangeFromSegments(updated)
        return {
          project:           newProject,
          projects:          newProjects,
          timelineDateRange: range,
        }
      })
    } catch { /* silently ignore */ }
  },

  async syncWithQuantitativos() {
    try {
      const { useQuantitativosStore } = await import('./quantitativosStore')
      type QItem = { code: string; description: string; unitCost: number }
      const state = useQuantitativosStore.getState() as unknown as { currentItems: QItem[] }
      const items = state.currentItems ?? []
      set((s) => {
        if (!s.project) return s
        const updated = s.project.segments.map((seg) => {
          const match = items.find(
            (it) =>
              it.description.toLowerCase().includes(`dn${seg.diameter}`) ||
              it.code === seg.trechoCode,
          )
          if (!match) return seg
          const unitCostBRL = match.unitCost
          return {
            ...seg,
            unitCostBRL,
            totalCostBRL: Math.round(seg.lengthM * unitCostBRL),
          }
        })
        const newProject = { ...s.project, segments: updated }
        const newProjects = s.projects.map((p) =>
          p.id === s.activeProjectId ? newProject : p,
        )
        return { project: newProject, projects: newProjects }
      })
    } catch { /* silently ignore */ }
  },

  loadDemoData() {
    const demos = [MOCK_BIM_SANEAMENTO, MOCK_BIM_PROJECT, MOCK_BIM_BUILDING]
    const first = demos[0]
    const range = dateRangeFromSegments(first.segments)
    set({
      projects:          demos,
      activeProjectId:   first.id,
      project:           first,
      layers:            first.layers.map((l) => ({ ...l, visible: true })),
      timelineDateRange: range,
      activeDate:        '2025-04-01',
      selectedSegmentId: null,
      colorMode:         'default',
      activeTab:         'viewer',
      isLoading:         false,
      loadError:         null,
    })
  },

  clearData() {
    set({
      projects:          [],
      activeProjectId:   null,
      project:           null,
      layers:            [],
      selectedSegmentId: null,
      colorMode:         'default',
      timelineDateRange: { start: '2025-01-01', end: '2025-12-31' },
      activeDate:        '2025-06-01',
      isLoading:         false,
      loadError:         null,
      activeTab:         'viewer',
    })
  },

  setViewerMode(mode) { set({ viewerMode: mode }) },
  toggleDroneMode()   { set((s) => ({ droneMode: !s.droneMode })) },
  setForgeToken(token, expiry) { set({ forgeToken: token, forgeTokenExpiry: expiry }) },
  setForgeUrn(urn)    { set({ forgeUrn: urn }) },
  setForgeCredentials(clientId, clientSecret) {
    try {
      localStorage.setItem('aps-client-id',     clientId)
      localStorage.setItem('aps-client-secret', clientSecret)
    } catch { /* noop */ }
    set({ forgeClientId: clientId })
    void clientSecret  // stored in localStorage only, not in state
  },
}))
