/**
 * ModelViewPanel — slide-in mini BIM viewer panel (right side, 420px).
 * Lazy-loads BimCanvas and shows the first available BIM project.
 */
import { lazy, Suspense, useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { useBimStore } from '@/store/bimStore'

const BimCanvas = lazy(() =>
  import('@/features/bim/components/BimCanvas').then((m) => ({ default: m.BimCanvas }))
)

export function ModelViewPanel({ onClose }: { onClose: () => void }) {
  const project  = useBimStore((s) => s.project)
  const projects = useBimStore((s) => s.projects)
  const loadDemoData    = useBimStore((s) => s.loadDemoData)
  const setActiveProject = useBimStore((s) => s.setActiveProject)

  // If no project loaded yet, load demo data
  useEffect(() => {
    if (!project && projects.length === 0) {
      loadDemoData()
    } else if (!project && projects.length > 0) {
      setActiveProject(projects[0].id)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="fixed right-0 top-0 bottom-0 z-50 flex flex-col bg-[#0d1117] border-l border-[#20406a] shadow-2xl w-full sm:w-[420px]"
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#20406a] flex items-center justify-between shrink-0">
        <div>
          <p className="text-[#f5f5f5] text-sm font-semibold">Visão do Modelo BIM</p>
          <p className="text-[#6b6b6b] text-xs mt-0.5">
            {project ? project.name : 'Carregando projeto...'}
          </p>
        </div>
        <button onClick={onClose} className="text-[#6b6b6b] hover:text-[#a3a3a3]"><X size={18} /></button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full text-[#3f3f3f] text-xs">
            Carregando modelo 3D...
          </div>
        }>
          {(project || projects.length > 0) && <BimCanvas />}
          {!project && projects.length === 0 && (
            <div className="flex items-center justify-center h-full text-[#3f3f3f] text-xs">
              Nenhum modelo disponível. Faça upload no módulo BIM.
            </div>
          )}
        </Suspense>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[#20406a] shrink-0 flex items-center justify-between">
        <p className="text-[10px] text-[#3f3f3f]">Visualização passiva — sem controles 4D/5D</p>
        <a
          href="/bim"
          className="flex items-center gap-1.5 text-xs text-[#3b82f6] hover:text-[#60a5fa] transition-colors"
        >
          <ExternalLink size={12} />
          Abrir BIM completo
        </a>
      </div>
    </div>
  )
}
