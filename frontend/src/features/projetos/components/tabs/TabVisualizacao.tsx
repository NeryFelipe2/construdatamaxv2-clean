import { cn, formatCurrency } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, DesignViewType } from '@/types'
import { lazy, Suspense, useEffect } from 'react'
import { projectToBim } from '../../utils/projectToBim'
import { useBimStore } from '@/store/bimStore'

// Lazy-load BimCanvas + BIM panels so Three.js stays in its own chunk
const BimCanvas = lazy(() =>
  import('@/features/bim/components/BimCanvas').then((m) => ({ default: m.BimCanvas }))
)
const Bim4DPanel = lazy(() =>
  import('@/features/bim/components/Bim4DPanel').then((m) => ({ default: m.Bim4DPanel }))
)
const Bim5DPanel = lazy(() =>
  import('@/features/bim/components/Bim5DPanel').then((m) => ({ default: m.Bim5DPanel }))
)

// ─── 3D Building View — real BimCanvas ────────────────────────────────────────

// Shared hook: upserts the synthetic BimProject into the bimStore.
function useInjectBimProject(project: Project) {
  useEffect(() => {
    const bimProject = projectToBim(project)
    const { addProject, setActiveProject } = useBimStore.getState()
    const existing = useBimStore.getState().projects.find((p) => p.id === bimProject.id)
    if (!existing) {
      addProject(bimProject)
    } else {
      // Refresh project data then re-activate so derived state (layers, dates) updates
      useBimStore.setState((s) => ({
        projects: s.projects.map((p) => p.id === bimProject.id ? bimProject : p),
      }))
      setActiveProject(bimProject.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])
}

function View3D({ project }: { project: Project }) {
  useInjectBimProject(project)

  const progress = project.executionPhases.length > 0
    ? Math.round(project.executionPhases.reduce((s, p) => s + p.progress, 0) / project.executionPhases.length)
    : 0

  return (
    <div className="flex flex-col gap-2">
      {/* Canvas */}
      <div className="bim-canvas-container" style={{ minHeight: 280, height: '40vh', maxHeight: 420, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-[#3f3f3f] text-xs">
            Carregando modelo 3D...
          </div>
        }>
          <BimCanvas />
        </Suspense>
      </div>
      {/* Footer info */}
      <div className="flex items-center justify-between px-4 pb-3 flex-wrap gap-2">
        <p className="text-[10px] text-[#6b6b6b]">{project.name} — Modelo BIM 3D · arraste para orbitar, scroll para zoom</p>
        <span className="text-xs font-mono text-[#22c55e] font-semibold">Avanço médio: {progress}%</span>
      </div>
    </div>
  )
}

// ─── 4D Timeline View — BimCanvas + Bim4DPanel ────────────────────────────────

function View4D({ project }: { project: Project }) {
  useInjectBimProject(project)
  // Switch color mode to date when 4D tab is active
  useEffect(() => {
    useBimStore.getState().setColorMode('date')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  const progress = project.executionPhases.length > 0
    ? Math.round(project.executionPhases.reduce((s, p) => s + p.progress, 0) / project.executionPhases.length)
    : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="bim-canvas-container" style={{ minHeight: 250, height: '35vh', maxHeight: 380, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-[#3f3f3f] text-xs">Carregando modelo 3D...</div>}>
          <BimCanvas />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <Bim4DPanel />
      </Suspense>
      <div className="flex items-center justify-between px-4 pb-3 flex-wrap gap-2">
        <p className="text-[10px] text-[#6b6b6b]">{project.name} — Simulação 4D · mova o slider para ver a construção ao longo do tempo</p>
        <span className="text-xs font-mono text-[#22c55e] font-semibold">Avanço médio: {progress}%</span>
      </div>
    </div>
  )
}

// ─── 5D Cost View — BimCanvas + Bim5DPanel ────────────────────────────────────

function View5D({ project }: { project: Project }) {
  useInjectBimProject(project)
  // Switch color mode to cost when 5D tab is active
  useEffect(() => {
    useBimStore.getState().setColorMode('cost')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id])

  return (
    <div className="flex flex-col gap-2">
      <div className="bim-canvas-container" style={{ minHeight: 250, height: '35vh', maxHeight: 380, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<div className="flex items-center justify-center h-full text-[#3f3f3f] text-xs">Carregando modelo 3D...</div>}>
          <BimCanvas />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <Bim5DPanel />
      </Suspense>
      <div className="px-4 pb-3">
        <p className="text-[10px] text-[#6b6b6b]">{project.name} — Análise 5D · heatmap de custo por elemento estrutural</p>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TabVisualizacao({ project }: { project: Project }) {
  const activeView    = useProjetosStore((s) => s.activeDesignView)
  const setActiveView = useProjetosStore((s) => s.setActiveDesignView)

  const views: DesignViewType[] = ['3D', '4D', '5D']

  const VIEW_DESCRIPTIONS: Record<DesignViewType, string> = {
    '3D': 'Modelo estrutural do edifício com progresso de andares',
    '4D': 'Cronograma das fases ao longo do tempo (Planejamento + Execução)',
    '5D': 'Comparativo orçamentário: Orçado × Projetado × Gasto',
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab bar */}
      <div className="flex items-end gap-0 px-5 pt-4 border-b border-[#20406a] shrink-0">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={cn(
              'px-5 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px',
              activeView === v
                ? 'text-[#2abfdc] border-[#2abfdc]'
                : 'text-[#6b6b6b] border-transparent hover:text-[#a3a3a3]'
            )}
          >
            {v}
          </button>
        ))}
        <span className="ml-4 text-[10px] text-[#3f3f3f] self-center">
          {VIEW_DESCRIPTIONS[activeView]}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Visualization panel */}
        <div className="mx-5 mt-4 rounded-xl border border-[#20406a] bg-[#14294e] overflow-hidden">
          {activeView === '3D' && <View3D project={project} />}
          {activeView === '4D' && <View4D project={project} />}
          {activeView === '5D' && <View5D project={project} />}
        </div>

        {/* Demands table */}
        {project.demands.length > 0 && (
          <div className="mx-5 mt-4 mb-5 flex flex-col gap-2">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b6b6b]">
              Demandas e Custos
            </span>
            <div className="rounded-xl border border-[#20406a] overflow-x-auto">
              <table className="w-full min-w-[480px] text-xs">
                <thead>
                  <tr className="border-b border-[#20406a] bg-[#0d2040]">
                    {['Item', 'Quantidade', 'Unidade', 'Custo Unit.', 'Total Estimado'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 text-[9px] uppercase tracking-widest font-semibold text-[#6b6b6b]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {project.demands.map((d, i) => (
                    <tr key={d.id} className={cn(i < project.demands.length - 1 && 'border-b border-[#14294e]')}>
                      <td className="px-4 py-3 text-[#f5f5f5]">{d.label}</td>
                      <td className="px-4 py-3 font-mono text-[#a3a3a3]">{d.quantity.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 text-[#6b6b6b]">{d.unit}</td>
                      <td className="px-4 py-3 font-mono text-[#a3a3a3]">{formatCurrency(d.estimatedCost / d.quantity)}</td>
                      <td className="px-4 py-3 font-mono text-[#2abfdc] font-semibold">{formatCurrency(d.estimatedCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
