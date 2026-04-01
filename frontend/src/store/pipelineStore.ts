/**
 * pipelineStore.ts — Store central de integração.
 *
 * Quando o LegacyApp roda o pipeline (processar DWG/DXF), os resultados são
 * publicados aqui. Todos os módulos Palantir (Mapa Interativo, Planejamento,
 * Rede 360, BIM, Torre de Controle, Gestão 360, Pré-Construção) consomem
 * desta store para exibir dados reais ao invés de mocks.
 *
 * Premissa ConstruData: TUDO INTEGRADO.
 */
import { create } from 'zustand'
import {
  apiDashboard,
  apiGeoJson,
  apiManageRede,
  apiNucleos,
  apiNsList,
  apiCronograma,
  apiCurvaS,
  apiProcessarUltimo,
} from '@/lib/api'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PipelineNode {
  id: string
  lat: number
  lng: number
  label: string
  nodeType: 'junction' | 'endpoint' | 'structure'
  elevation?: number
  depth?: number
  /** extra props from backend */
  [key: string]: unknown
}

export interface PipelineSegment {
  id: string
  fromNodeId: string
  toNodeId: string
  networkType: 'sewer' | 'water' | 'drainage' | 'civil' | 'generic'
  diameter?: number
  material?: string
  length?: number
  slope?: number
  label?: string
  [key: string]: unknown
}

export interface PipelineNS {
  id: number
  codigo?: string
  nucleo: string
  status: string
  extensao_m?: number
  n_pvs?: number
  n_trechos?: number
  [key: string]: unknown
}

export interface PipelineSummary {
  n_pvs: number
  n_trechos: number
  extensao_total_m: number
  ns_geradas: number
  ns_erros: number
  nucleo: string
  motor: string
  arquivo: string
  job_id: string | null
}

export interface PipelineState {
  /** Indica se há dados reais do pipeline (backend rodou ao menos uma vez) */
  hasRealData: boolean
  loading: boolean
  lastError: string | null
  lastUpdated: string | null

  /** Nucleo selecionado globalmente */
  selectedNucleo: string
  nucleos: string[]

  /** Dados do último processamento */
  summary: PipelineSummary | null

  /** Rede: nós e trechos extraídos */
  nodes: PipelineNode[]
  segments: PipelineSegment[]

  /** GeoJSON completo do cadastro */
  geoJson: { type: string; features: Array<Record<string, unknown>> } | null

  /** NS geradas */
  nsList: PipelineNS[]

  /** Dashboard KPIs */
  dashboard: Record<string, unknown> | null

  /** Cronograma */
  cronograma: Record<string, unknown> | null

  /** Curva S */
  curvaS: Record<string, unknown> | null

  // ── Actions ──

  /** Chamado pelo LegacyApp após pipeline rodar com sucesso */
  publishPipelineResult: (summary: PipelineSummary) => void

  /** Carrega todos os dados do backend para o nucleo selecionado */
  fetchAll: (nucleo?: string) => Promise<void>

  /** Seleciona nucleo e recarrega */
  setSelectedNucleo: (nucleo: string) => void

  /** Reset */
  clear: () => void
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function geoJsonToNodes(geoJson: { features: Array<Record<string, unknown>> }): PipelineNode[] {
  const nodes: PipelineNode[] = []
  for (const f of geoJson.features) {
    const props = (f.properties ?? {}) as Record<string, unknown>
    const geom = f.geometry as { type?: string; coordinates?: number[] } | undefined
    if (!geom?.coordinates) continue
    const featureType = String(props.feature_type ?? '').toLowerCase()
    if (featureType !== 'pv' && featureType !== 'no' && featureType !== 'node') continue

    const [lng, lat] = geom.coordinates
    nodes.push({
      id: String(props.id ?? props.codigo ?? `pv-${nodes.length}`),
      lat, lng,
      label: String(props.codigo ?? props.nome ?? `PV-${nodes.length + 1}`),
      nodeType: featureType === 'no' ? 'endpoint' : 'junction',
      elevation: props.cota_terreno != null ? Number(props.cota_terreno) : undefined,
      depth: props.profundidade != null ? Number(props.profundidade) : undefined,
    })
  }
  return nodes
}

function geoJsonToSegments(geoJson: { features: Array<Record<string, unknown>> }): PipelineSegment[] {
  const segs: PipelineSegment[] = []
  for (const f of geoJson.features) {
    const props = (f.properties ?? {}) as Record<string, unknown>
    const geom = f.geometry as { type?: string } | undefined
    const featureType = String(props.feature_type ?? '').toLowerCase()
    if (featureType !== 'trecho' && featureType !== 'tubo' && featureType !== 'segment') continue
    if (geom?.type !== 'LineString') continue

    segs.push({
      id: String(props.id ?? props.codigo ?? `seg-${segs.length}`),
      fromNodeId: String(props.pv_montante ?? props.from ?? ''),
      toNodeId: String(props.pv_jusante ?? props.to ?? ''),
      networkType: inferNetworkType(props),
      diameter: props.diametro != null ? Number(props.diametro) : undefined,
      material: props.material ? String(props.material) : undefined,
      length: props.extensao != null ? Number(props.extensao) : undefined,
      slope: props.declividade != null ? Number(props.declividade) : undefined,
      label: props.codigo ? String(props.codigo) : undefined,
    })
  }
  return segs
}

function inferNetworkType(props: Record<string, unknown>): PipelineSegment['networkType'] {
  const tipo = String(props.tipo ?? props.rede ?? props.sistema ?? '').toLowerCase()
  if (tipo.includes('esgoto') || tipo.includes('sewer')) return 'sewer'
  if (tipo.includes('agua') || tipo.includes('água') || tipo.includes('water')) return 'water'
  if (tipo.includes('drena') || tipo.includes('pluv')) return 'drainage'
  if (tipo.includes('civil')) return 'civil'
  return 'sewer' // default para projeto de saneamento
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const usePipelineStore = create<PipelineState>((set, get) => ({
  hasRealData: false,
  loading: false,
  lastError: null,
  lastUpdated: null,
  selectedNucleo: '',
  nucleos: [],
  summary: null,
  nodes: [],
  segments: [],
  geoJson: null,
  nsList: [],
  dashboard: null,
  cronograma: null,
  curvaS: null,

  publishPipelineResult: (summary) => {
    set({ summary, hasRealData: true, lastUpdated: new Date().toISOString() })
    // Auto-fetch dados atualizados do backend
    get().fetchAll(summary.nucleo)
  },

  fetchAll: async (nucleo) => {
    const n = nucleo ?? get().selectedNucleo
    set({ loading: true, lastError: null })
    try {
      const [geoR, nucleosR, nsR, dashR, cronoR, curvaR] = await Promise.allSettled([
        apiGeoJson(n || undefined),
        apiNucleos(),
        apiNsList(n || undefined),
        apiDashboard(n || undefined),
        apiCronograma(n || undefined),
        apiCurvaS(n || undefined),
      ])

      const geoJson = geoR.status === 'fulfilled' ? geoR.value : null
      const nucleos = nucleosR.status === 'fulfilled' ? nucleosR.value.items.map(i => i.nome) : []
      const nsList = nsR.status === 'fulfilled'
        ? (nsR.value.items ?? []).map((item: Record<string, unknown>) => ({
            id: Number(item.id ?? 0),
            codigo: String(item.codigo ?? ''),
            nucleo: String(item.nucleo ?? ''),
            status: String(item.status ?? ''),
            extensao_m: item.extensao_m != null ? Number(item.extensao_m) : undefined,
            n_pvs: item.n_pvs != null ? Number(item.n_pvs) : undefined,
            n_trechos: item.n_trechos != null ? Number(item.n_trechos) : undefined,
            ...item,
          } as PipelineNS))
        : []
      const dashboard = dashR.status === 'fulfilled' ? dashR.value as Record<string, unknown> : null
      const cronograma = cronoR.status === 'fulfilled' ? cronoR.value as Record<string, unknown> : null
      const curvaS = curvaR.status === 'fulfilled' ? curvaR.value as Record<string, unknown> : null

      const nodes = geoJson ? geoJsonToNodes(geoJson) : []
      const segments = geoJson ? geoJsonToSegments(geoJson) : []

      const hasRealData = nodes.length > 0 || nsList.length > 0 || dashboard !== null

      set({
        hasRealData,
        geoJson,
        nucleos,
        nodes,
        segments,
        nsList,
        dashboard,
        cronograma,
        curvaS,
        loading: false,
        lastUpdated: new Date().toISOString(),
        selectedNucleo: n,
      })
    } catch (err) {
      set({ loading: false, lastError: err instanceof Error ? err.message : 'Erro ao carregar dados' })
    }
  },

  setSelectedNucleo: (nucleo) => {
    set({ selectedNucleo: nucleo })
    get().fetchAll(nucleo)
  },

  clear: () => set({
    hasRealData: false, summary: null, nodes: [], segments: [],
    geoJson: null, nsList: [], dashboard: null, cronograma: null,
    curvaS: null, nucleos: [], lastError: null,
  }),
}))

// ─── Auto-sync: propagar dados do pipeline para todos os módulos ─────────

usePipelineStore.subscribe((state, prev) => {
  // Só propagar quando hasRealData muda de false→true ou quando nodes/nsList mudam
  if (!state.hasRealData) return
  if (state.lastUpdated === prev.lastUpdated) return

  // Propagar para cada módulo de forma lazy (fire-and-forget)
  import('./mapaInterativoStore').then(({ useMapaInterativoStore }) => {
    useMapaInterativoStore.getState().loadFromPipeline()
  }).catch(() => {})

  import('./planejamentoStore').then(({ usePlanejamentoStore }) => {
    usePlanejamentoStore.getState().loadFromPipeline()
  }).catch(() => {})

  import('./rede360Store').then(({ useRede360Store }) => {
    (useRede360Store.getState() as any).loadFromPipeline?.()
  }).catch(() => {})

  import('./bimStore').then(({ useBimStore }) => {
    useBimStore.getState().loadFromPipeline()
  }).catch(() => {})

  import('./torreDeControleStore').then(({ useTorreStore }) => {
    useTorreStore.getState().loadFromPipeline()
  }).catch(() => {})

  import('./gestao360Store').then(({ useGestao360Store }) => {
    useGestao360Store.getState().fetchFromBackend(state.selectedNucleo || undefined)
  }).catch(() => {})
})
