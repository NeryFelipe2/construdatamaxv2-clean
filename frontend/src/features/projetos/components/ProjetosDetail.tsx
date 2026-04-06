import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import { TabVisaoGeral }   from './tabs/TabVisaoGeral'
import { TabPlanejamento } from './tabs/TabPlanejamento'
import { TabExecucao }     from './tabs/TabExecucao'
import { TabOrcamento }    from './tabs/TabOrcamento'
import { TabVisualizacao } from './tabs/TabVisualizacao'
import { TabDocumentos }   from './tabs/TabDocumentos'
import { FolderOpen }      from 'lucide-react'

const TABS = [
  'Visão Geral',
  'Planejamento',
  'Execução',
  'Orçamento',
  '3D / 4D / 5D',
  'Documentos',
]

export function ProjetosDetail() {
  const projects    = useProjetosStore((s) => s.projects)
  const selectedId  = useProjetosStore((s) => s.selectedProjectId)
  const activeTab   = useProjetosStore((s) => s.activeTab)
  const setActiveTab = useProjetosStore((s) => s.setActiveTab)

  const project = selectedId ? projects.find((p) => p.id === selectedId) ?? null : null

  if (!project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
        <FolderOpen size={40} className="text-[#525252]" />
        <p className="text-sm text-[#3f3f3f]">Selecione um projeto para visualizar</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-end gap-0 border-b border-[#525252] px-4 shrink-0 overflow-x-auto">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            className={cn(
              'px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px',
              activeTab === i
                ? 'text-[#f97316] border-[#f97316]'
                : 'text-[#6b6b6b] border-transparent hover:text-[#a3a3a3]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 0 && <TabVisaoGeral   project={project} />}
        {activeTab === 1 && <TabPlanejamento project={project} />}
        {activeTab === 2 && <TabExecucao     project={project} />}
        {activeTab === 3 && <TabOrcamento    project={project} />}
        {activeTab === 4 && <TabVisualizacao project={project} />}
        {activeTab === 5 && <TabDocumentos   project={project} />}
      </div>
    </div>
  )
}
