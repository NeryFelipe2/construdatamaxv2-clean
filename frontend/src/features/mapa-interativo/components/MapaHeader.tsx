/**
 * MapaHeader — Full toolbar for Mapa Interativo module.
 * Tools, basemap selector, UTM zone, import/export buttons.
 */
import { useState } from 'react'
import {
  Map, ZoomIn, ZoomOut, RotateCcw, Trash2, Save, FolderOpen,
  Plus, Link, MousePointer, Scissors, Move, Building2,
  ArrowRightLeft, Upload, Download, Maximize2, BarChart2,
} from 'lucide-react'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'
import { useProjetosStore }       from '@/store/projetosStore'
import { MapaImportModal }        from './MapaImportModal'
import { MapaExportModal }        from './MapaExportModal'
import { MapaTransformCrsModal }  from './MapaTransformCrsModal'
import type { MapTool, MapNetworkType } from '@/types'

const NETWORK_TYPE_OPTIONS: { id: MapNetworkType; label: string; color: string }[] = [
  { id: 'sewer',    label: 'Esgoto',   color: '#f97316' },
  { id: 'water',    label: 'Água',     color: '#38bdf8' },
  { id: 'drainage', label: 'Drenagem', color: '#4ade80' },
  { id: 'civil',    label: 'Civil',    color: '#94a3b8' },
  { id: 'generic',  label: 'Genérico', color: '#a78bfa' },
]

const UTM_ZONES = ['18S', '19S', '20S', '21S', '22S', '23S', '24S', '25S', '23N', '24N']

const TOOL_BUTTONS: { id: MapTool; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
  { id: 'addNode',        label: 'Adicionar Ponto',   icon: Plus },
  { id: 'connect',        label: 'Ligar Pontos',       icon: Link },
  { id: 'deleteNode',     label: 'Excluir Nós',        icon: Trash2 },
  { id: 'deleteSegment',  label: 'Excluir Trechos',    icon: Scissors },
  { id: 'measure',        label: 'Medir Distância',    icon: MousePointer },
  { id: 'structure',      label: 'Modo Estrutura',     icon: Building2 },
]

export function MapaHeader({
  showAnalytics = false,
  onToggleAnalytics,
}: {
  showAnalytics?: boolean
  onToggleAnalytics?: () => void
}) {
  const nodes    = useMapaInterativoStore((s) => s.nodes)
  const segments = useMapaInterativoStore((s) => s.segments)
  const activeTool = useMapaInterativoStore((s) => s.activeTool)
  const basemap   = useMapaInterativoStore((s) => s.basemap)
  const utmZone   = useMapaInterativoStore((s) => s.utmZone)
  const history   = useMapaInterativoStore((s) => s.history)
  const activeNetworkType = useMapaInterativoStore((s) => s.activeNetworkType)
  const selectedProjectId = useMapaInterativoStore((s) => s.selectedProjectId)
  const setTool   = useMapaInterativoStore((s) => s.setTool)
  const undo      = useMapaInterativoStore((s) => s.undo)
  const clearAll  = useMapaInterativoStore((s) => s.clearAll)
  const setBasemap = useMapaInterativoStore((s) => s.setBasemap)
  const loadDemoData = useMapaInterativoStore((s) => s.loadDemoData)
  const setActiveNetworkType = useMapaInterativoStore((s) => s.setActiveNetworkType)
  const setSelectedProjectId = useMapaInterativoStore((s) => s.setSelectedProjectId)

  const projects = useProjetosStore((s) => s.projects)

  const [showImport, setShowImport]     = useState(false)
  const [showExport, setShowExport]     = useState(false)
  const [showTransform, setShowTransform] = useState(false)

  function handleImportBim() {
    import('@/store/bimStore').then(({ useBimStore }) => {
      const bimState = useBimStore.getState()
      const proj = bimState.project
      if (!proj) { alert('Nenhum projeto BIM ativo. Abra um projeto em /bim primeiro.'); return }
      const { addNode, addSegment } = useMapaInterativoStore.getState()
      const BASE_LAT = -12.9714, BASE_LNG = -38.5014
      const SCALE = 0.00001  // 1 unit ≈ ~1.1m

      proj.segments.forEach((seg) => {
        if (seg.vertices.length < 2) return
        const [x1, , z1] = seg.vertices[0]
        const [x2, , z2] = seg.vertices[seg.vertices.length - 1]
        const n1 = { lat: BASE_LAT + z1 * SCALE, lng: BASE_LNG + x1 * SCALE, nodeType: 'junction' as const }
        const n2 = { lat: BASE_LAT + z2 * SCALE, lng: BASE_LNG + x2 * SCALE, nodeType: 'endpoint' as const }
        const id1 = crypto.randomUUID()
        const id2 = crypto.randomUUID()
        addNode({ ...n1 })
        addNode({ ...n2 })
        // addNode returns void, so we re-fetch last two added
        const state = useMapaInterativoStore.getState()
        const last2 = state.nodes.slice(-2)
        if (last2.length === 2) {
          addSegment({ fromNodeId: last2[0].id, toNodeId: last2[1].id, networkType: 'civil' as MapNetworkType, label: seg.trechoCode })
        }
        void id1; void id2
      })
    }).catch(() => alert('Erro ao acessar dados BIM.'))
  }

  function handleImportPlanejamento() {
    import('@/store/planejamentoStore').then(({ usePlanejamentoStore }) => {
      const state = usePlanejamentoStore.getState()
      const trechos = state.scenarios[0]?.trechos ?? []
      if (trechos.length === 0) { alert('Nenhum trecho encontrado no módulo Planejamento.'); return }
      const BASE_LAT = -12.9714, BASE_LNG = -38.5014
      const baseLen = useMapaInterativoStore.getState().nodes.length

      trechos.forEach((t: { code: string }, i: number) => {
        const lat1 = BASE_LAT + i * 0.001
        const lat2 = lat1 + 0.0008
        const lng  = BASE_LNG + (i % 3) * 0.002

        useMapaInterativoStore.getState().addNode({ lat: lat1, lng, nodeType: 'junction', label: `${t.code}-I` })
        useMapaInterativoStore.getState().addNode({ lat: lat2, lng, nodeType: 'junction', label: `${t.code}-F` })

        const updated = useMapaInterativoStore.getState()
        const newNodes = updated.nodes.slice(baseLen + i * 2)
        if (newNodes.length >= 2) {
          useMapaInterativoStore.getState().addSegment({ fromNodeId: newNodes[0].id, toNodeId: newNodes[1].id, networkType: 'sewer', label: t.code })
        }
      })
    }).catch(() => alert('Erro ao acessar dados de Planejamento.'))
  }

  function handleSave() {
    const { nodes, segments } = useMapaInterativoStore.getState()
    const data = JSON.stringify({ nodes, segments }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'mapa-interativo.json'; a.click()
    URL.revokeObjectURL(url)
  }

  function handleLoad() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      file.text().then((text) => {
        try {
          const data = JSON.parse(text)
          if (data.nodes && data.segments) {
            useMapaInterativoStore.getState().loadDemoData()  // reset
            // Replace with loaded data
            useMapaInterativoStore.setState({ nodes: data.nodes, segments: data.segments })
          }
        } catch { alert('Arquivo JSON inválido.') }
      })
    }
    input.click()
  }

  const isToolActive = (id: MapTool) => activeTool === id

  return (
    <>
      <div className="bg-[#2c2c2c] border-b border-[#3d3d3d] px-3 py-2 flex flex-col gap-2">
        {/* Row 1: Title + counters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-orange-600 flex items-center justify-center">
              <Map size={14} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white hidden sm:block">Mapa Interativo</span>
          </div>
          <span className="text-xs text-[#6b6b6b] font-mono">
            {nodes.length} pts · {segments.length} trechos
          </span>
        </div>

        {/* Row 2: Tool buttons — horizontally scrollable on mobile */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5">
          {/* View tools */}
          <ToolBtn label="Ajustar" icon={<Maximize2 size={13} />} onClick={() => loadDemoData()} />
          <ToolBtn label="Desfazer" icon={<RotateCcw size={13} />} onClick={undo} disabled={history.length === 0} />
          <ToolBtn label="Limpar" icon={<Trash2 size={13} />} onClick={clearAll} danger />
          <ToolBtn label="Salvar" icon={<Save size={13} />} onClick={handleSave} />
          <ToolBtn label="Carregar" icon={<FolderOpen size={13} />} onClick={handleLoad} />

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* Editing tools */}
          {TOOL_BUTTONS.map((tb) => (
            <ToolBtn
              key={tb.id}
              label={tb.label}
              icon={<tb.icon size={13} />}
              active={isToolActive(tb.id)}
              danger={tb.id === 'deleteNode' || tb.id === 'deleteSegment'}
              onClick={() => setTool(isToolActive(tb.id) ? 'idle' : tb.id)}
            />
          ))}

          <ToolBtn label="Mover em Massa" icon={<Move size={13} />} onClick={() => {}} />

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* CRS + UTM */}
          <ToolBtn label="Transf. CRS" icon={<ArrowRightLeft size={13} />} onClick={() => setShowTransform(true)} />
          <select
            value={utmZone}
            onChange={(e) => useMapaInterativoStore.setState({ utmZone: e.target.value })}
            className="bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
          >
            {UTM_ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* Basemap */}
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as typeof basemap)}
            className="bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none"
          >
            <option value="satellite">Satélite</option>
            <option value="streets">Ruas (Voyager)</option>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
            <option value="outdoors">Relevo</option>
          </select>

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* Import BIM / Planejamento */}
          <ToolBtn label="Importar BIM"    icon={<ZoomIn size={13} />}  onClick={handleImportBim} />
          <ToolBtn label="Import. Trechos" icon={<ZoomOut size={13} />} onClick={handleImportPlanejamento} />

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* Import / Export */}
          <ToolBtn label="Importar" icon={<Upload size={13} />}   onClick={() => setShowImport(true)} />
          <ToolBtn label="Exportar" icon={<Download size={13} />} onClick={() => setShowExport(true)} />

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* Analytics toggle */}
          <ToolBtn
            label="Análise 3D/4D/5D"
            icon={<BarChart2 size={13} />}
            active={showAnalytics}
            onClick={() => onToggleAnalytics?.()}
          />

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* Project selector */}
          <select
            value={selectedProjectId ?? ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="bg-[#3d3d3d] border border-[#525252] rounded px-2 py-1 text-xs text-[#f5f5f5] focus:outline-none max-w-[140px]"
          >
            <option value="">(Nenhum projeto)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="w-px h-5 bg-[#484848] mx-1" />

          {/* Network type pills (for connect tool) */}
          <span className="text-[10px] text-[#6b6b6b] self-center">Tipo:</span>
          {NETWORK_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setActiveNetworkType(opt.id)}
              title={`Tipo de rede: ${opt.label}`}
              className={`px-2 py-1 rounded text-[10px] font-semibold border transition-colors ${
                activeNetworkType === opt.id
                  ? 'text-white border-transparent'
                  : 'bg-[#3d3d3d] border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]'
              }`}
              style={activeNetworkType === opt.id ? { background: opt.color, borderColor: opt.color } : {}}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showImport    && <MapaImportModal    onClose={() => setShowImport(false)} />}
      {showExport    && <MapaExportModal    onClose={() => setShowExport(false)} />}
      {showTransform && <MapaTransformCrsModal onClose={() => setShowTransform(false)} defaultZone={useMapaInterativoStore.getState().utmZone} />}
    </>
  )
}

// ─── ToolBtn ─────────────────────────────────────────────────────────────────

function ToolBtn({
  label, icon, onClick, active = false, danger = false, disabled = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? 'bg-orange-600 text-white'
          : danger
            ? 'bg-red-900/40 text-red-400 hover:bg-red-900/70'
            : 'bg-[#3d3d3d] text-[#f5f5f5] hover:bg-[#484848] hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
