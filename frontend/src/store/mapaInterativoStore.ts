/**
 * mapaInterativoStore.ts — Zustand store for the Mapa Interativo module.
 * Manages nodes, segments, tools, layers, undo history, and basemap selection.
 */
import { create } from 'zustand'
import type { MapNode, MapSegment, MapLayer, MapTool, MapNetworkType } from '@/types'
import { supabase } from '@/lib/supabase'
import wcrMapa from '@/data/wcr/mapa.json'  // fallback: snapshot congelado (usado só se o fetch ao vivo falhar/vier vazio)

// ─── Snapshot type for undo ────────────────────────────────────────────────

interface MapSnapshot {
  nodes: MapNode[]
  segments: MapSegment[]
}

// ─── Default layers ───────────────────────────────────────────────────────

const DEFAULT_LAYERS: MapLayer[] = [
  { id: 'sewer',   name: 'Esgoto',    color: '#2abfdc', visible: true },
  { id: 'water',   name: 'Água',      color: '#38bdf8', visible: true },
  { id: 'drainage',name: 'Drenagem',  color: '#4ade80', visible: true },
  { id: 'civil',   name: 'Civil',     color: '#94a3b8', visible: true },
  { id: 'generic', name: 'Genérico',  color: '#a78bfa', visible: true },
]

// ─── Demo data — snapshot congelado (WCR Boi Malhado, gerado pelo motor) ──

function makeDemoData(): { nodes: MapNode[]; segments: MapSegment[] } {
  return wcrMapa as unknown as { nodes: MapNode[]; segments: MapSegment[] }
}

// ─── State interface ──────────────────────────────────────────────────────

interface MapaInterativoState {
  nodes: MapNode[]
  segments: MapSegment[]
  activeTool: MapTool
  pendingConnectNodeId: string | null
  layers: MapLayer[]
  history: MapSnapshot[]
  basemap: 'satellite' | 'streets' | 'dark' | 'light' | 'outdoors'
  utmZone: string
  measurePoint1: { lat: number; lng: number } | null
  mapMode: 'saneamento' | 'construcao' | null
  selectedProjectId: string | null
  activeNetworkType: MapNetworkType
  fitBoundsRequestId: number
  /** true = nodes/segments vieram de leitura ao vivo do Supabase; false = snapshot congelado (mapa.json). */
  isLive: boolean
  /** mensagem de erro da última tentativa de leitura ao vivo (null = sem erro). */
  loadError: string | null
  /** mostrar/ocultar a camada de rede planejada (tracejada, sem status de execução confirmado). */
  showPlanejado: boolean

  // Actions
  addNode: (node: Omit<MapNode, 'id'>) => void
  removeNodes: (ids: string[]) => void
  addSegment: (segment: Omit<MapSegment, 'id'>) => void
  removeSegments: (ids: string[]) => void
  updateNode: (id: string, updates: Partial<Omit<MapNode, 'id'>>) => void
  setTool: (tool: MapTool) => void
  setPendingConnectNodeId: (id: string | null) => void
  setMeasurePoint1: (pt: { lat: number; lng: number } | null) => void
  undo: () => void
  clearAll: () => void
  setBasemap: (b: 'satellite' | 'streets' | 'dark' | 'light' | 'outdoors') => void
  setLayerVisible: (layerId: MapNetworkType, visible: boolean) => void
  importNodes: (nodes: MapNode[]) => void
  importSegments: (segments: MapSegment[]) => void
  loadDemoData: () => void
  clearData: () => void
  setMapMode: (mode: 'saneamento' | 'construcao' | null) => void
  setSelectedProjectId: (id: string | null) => void
  setActiveNetworkType: (t: MapNetworkType) => void
  loadFromPipeline: () => void
  requestFitBounds: () => void
  loadFromSupabase: () => Promise<void>
  setShowPlanejado: (v: boolean) => void
}

// ─── Helper: push undo snapshot ───────────────────────────────────────────

function pushHistory(history: MapSnapshot[], nodes: MapNode[], segments: MapSegment[]): MapSnapshot[] {
  const next = [...history, { nodes: [...nodes], segments: [...segments] }]
  return next.length > 20 ? next.slice(next.length - 20) : next
}

// ─── Store ────────────────────────────────────────────────────────────────

const { nodes: demoNodes, segments: demoSegments } = makeDemoData()

export const useMapaInterativoStore = create<MapaInterativoState>((set, get) => ({
  nodes: demoNodes,
  segments: demoSegments,
  activeTool: 'idle',
  pendingConnectNodeId: null,
  layers: DEFAULT_LAYERS,
  history: [],
  basemap: 'satellite',
  utmZone: '24S',
  measurePoint1: null,
  mapMode: 'saneamento',  // WCR: já abre no mapa (rede real), sem seletor
  selectedProjectId: null,
  activeNetworkType: 'sewer',
  fitBoundsRequestId: 0,
  isLive: false,
  loadError: null,
  showPlanejado: true,

  addNode: (node) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: [...s.nodes, { ...node, id: crypto.randomUUID() }],
    })),

  removeNodes: (ids) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: s.nodes.filter((n) => !ids.includes(n.id)),
      segments: s.segments.filter((seg) => !ids.includes(seg.fromNodeId) && !ids.includes(seg.toNodeId)),
    })),

  addSegment: (segment) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      segments: [...s.segments, { ...segment, id: crypto.randomUUID() }],
    })),

  removeSegments: (ids) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      segments: s.segments.filter((seg) => !ids.includes(seg.id)),
    })),

  updateNode: (id, updates) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
    })),

  setTool: (tool) => set({ activeTool: tool, pendingConnectNodeId: null, measurePoint1: null }),

  setPendingConnectNodeId: (id) => set({ pendingConnectNodeId: id }),

  setMeasurePoint1: (pt) => set({ measurePoint1: pt }),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return {}
      const prev = s.history[s.history.length - 1]
      return {
        nodes: prev.nodes,
        segments: prev.segments,
        history: s.history.slice(0, -1),
      }
    }),

  clearAll: () =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: [],
      segments: [],
    })),

  setBasemap: (b) => set({ basemap: b }),

  setLayerVisible: (layerId, visible) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === layerId ? { ...l, visible } : l)),
    })),

  importNodes: (newNodes) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      nodes: [...s.nodes, ...newNodes],
    })),

  importSegments: (newSegments) =>
    set((s) => ({
      history: pushHistory(s.history, s.nodes, s.segments),
      segments: [...s.segments, ...newSegments],
    })),

  loadDemoData: () => {
    const { nodes, segments } = makeDemoData()
    set({ nodes, segments, history: [] })
  },

  clearData: () => set({ nodes: [], segments: [], history: [] }),

  setMapMode: (mode) => {
    const layerUpdates: Partial<MapaInterativoState> = { mapMode: mode }
    if (mode === 'saneamento') {
      layerUpdates.layers = DEFAULT_LAYERS.map((l) =>
        ['sewer', 'water', 'drainage'].includes(l.id)
          ? { ...l, visible: true }
          : { ...l, visible: false }
      )
    } else if (mode === 'construcao') {
      layerUpdates.layers = DEFAULT_LAYERS.map((l) =>
        ['civil', 'generic'].includes(l.id)
          ? { ...l, visible: true }
          : { ...l, visible: false }
      )
    }
    set(layerUpdates)
  },

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),

  setActiveNetworkType: (t) => set({ activeNetworkType: t }),

  /**
   * Carrega nós e trechos reais do pipelineStore (integração central).
   * Chamado automaticamente quando o pipeline gera dados novos.
   */
  loadFromPipeline: () => {
    import('./pipelineStore').then(({ usePipelineStore }) => {
      const { nodes: pNodes, segments: pSegs, hasRealData } = usePipelineStore.getState()
      if (!hasRealData || pNodes.length === 0) return
      const mapped = pNodes.map((n) => ({
        id: n.id,
        lat: n.lat,
        lng: n.lng,
        label: n.label,
        nodeType: n.nodeType,
        elevation: n.elevation,
      })) as MapNode[]
      const mappedSegs = pSegs.map((s) => ({
        id: s.id,
        fromNodeId: s.fromNodeId,
        toNodeId: s.toNodeId,
        networkType: s.networkType,
        diameter: s.diameter,
        material: s.material,
        label: s.label,
      })) as MapSegment[]
      set({ nodes: mapped, segments: mappedSegs, history: [], mapMode: 'saneamento' })
    })
  },

  requestFitBounds: () => set((s) => ({ fitBoundsRequestId: s.fitBoundsRequestId + 1 })),

  setShowPlanejado: (v) => set({ showPlanejado: v }),

  /**
   * Substitui o snapshot estático (mapa.json, exportado uma vez em algum
   * momento passado) por uma leitura AO VIVO de `pv`+`trecho` (rede
   * executada) + `rede_planejada` (Retorno, sem status de execução
   * confirmado — vira segmentos com origem:'planejado', renderizados
   * tracejados). Respeita `selectedProjectId` quando setado. Se o Supabase
   * não estiver disponível ou não houver linhas com coordenada, mantém o
   * snapshot já carregado (nunca esvazia o mapa em silêncio) e grava
   * `loadError` pra tela poder avisar o usuário.
   */
  loadFromSupabase: async () => {
    if (!supabase) return
    const projetoId = get().selectedProjectId

    let pvQuery = supabase
      .from('pv')
      .select('id, nome, lat, lon, tipo, is_agua, projeto_id')
      .not('lat', 'is', null)
      .not('lon', 'is', null)
    if (projetoId) pvQuery = pvQuery.eq('projeto_id', projetoId)
    const { data: pvRows, error: e1 } = await pvQuery

    let trechoQuery = supabase
      .from('trecho')
      .select('id, ns_id, pv_ini, pv_fim, ext_m, dn_mm, material, projeto_id')
    if (projetoId) trechoQuery = trechoQuery.eq('projeto_id', projetoId)
    const { data: trechoRows, error: e2 } = await trechoQuery

    let planejadoQuery = supabase
      .from('rede_planejada')
      .select('id, sistema, dn, material, ns_numero, status_campo, lat_ini, lon_ini, lat_fim, lon_fim, projeto_id')
      .not('lat_ini', 'is', null)
    if (projetoId) planejadoQuery = planejadoQuery.eq('projeto_id', projetoId)
    // erro em rede_planejada não é fatal — só significa que essa camada extra fica vazia
    const { data: planejadoRows } = await planejadoQuery

    if (e1 || e2) {
      set({ loadError: e1?.message ?? e2?.message ?? 'Erro ao carregar rede do Supabase' })
      return
    }
    if ((!pvRows || pvRows.length === 0) && (!planejadoRows || planejadoRows.length === 0)) {
      set({ loadError: null }) // sem dado real pra este projeto — mantém snapshot, sem marcar como erro
      return
    }

    const pvPorChave = new Map<string, NonNullable<typeof pvRows>[number]>()
    for (const p of pvRows ?? []) pvPorChave.set(`${p.projeto_id ?? ''}|${p.nome}`, p)

    const nodesExecutado: MapNode[] = (pvRows ?? []).map((p) => ({
      id: `pv-${p.id}`,
      lat: p.lat as number,
      lng: p.lon as number,
      label: p.nome,
      nodeType: p.tipo === 'endpoint' ? 'endpoint' : 'junction',
    }))

    const segmentsExecutado: MapSegment[] = (trechoRows ?? [])
      .map((t) => {
        const ini = pvPorChave.get(`${t.projeto_id ?? ''}|${t.pv_ini}`)
        const fim = pvPorChave.get(`${t.projeto_id ?? ''}|${t.pv_fim}`)
        if (!ini || !fim) return null
        return {
          id: `trecho-${t.id}`,
          fromNodeId: `pv-${ini.id}`,
          toNodeId: `pv-${fim.id}`,
          networkType: (ini.is_agua ? 'water' : 'sewer') as MapNetworkType,
          diameter: t.dn_mm ?? 200,
          material: t.material ?? 'PVC',
        } satisfies MapSegment
      })
      .filter((s): s is MapSegment => s !== null)

    // rede_planejada não compartilha PV com `pv`/`trecho` — cria nós sintéticos
    // por trecho direto das coordenadas do próprio registro.
    const nodesPlanejado: MapNode[] = []
    const segmentsPlanejado: MapSegment[] = []
    for (const r of planejadoRows ?? []) {
      if (r.lat_ini == null || r.lon_ini == null || r.lat_fim == null || r.lon_fim == null) continue
      const idIni = `rp-ini-${r.id}`
      const idFim = `rp-fim-${r.id}`
      nodesPlanejado.push({ id: idIni, lat: r.lat_ini as number, lng: r.lon_ini as number, nodeType: 'junction' })
      nodesPlanejado.push({ id: idFim, lat: r.lat_fim as number, lng: r.lon_fim as number, nodeType: 'endpoint' })
      segmentsPlanejado.push({
        id: `rede-planejada-${r.id}`,
        fromNodeId: idIni,
        toNodeId: idFim,
        networkType: (r.sistema === 'AGUA' ? 'water' : 'sewer') as MapNetworkType,
        material: r.material ?? undefined,
        label: r.ns_numero ?? undefined,
        origem: 'planejado',
      })
    }

    const nodes = [...nodesExecutado, ...nodesPlanejado]
    const segments = [...segmentsExecutado, ...segmentsPlanejado]
    if (nodes.length === 0) return
    set({ nodes, segments, history: [], mapMode: 'saneamento', isLive: true, loadError: null })
  },
}))
