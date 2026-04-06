import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProjetosStore } from '@/store/projetosStore'
import type { Project, ProjectStatus } from '@/types'

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active:    'Ativo',
  planning:  'Planejamento',
  completed: 'Concluído',
  on_hold:   'Em Espera',
}

const STATUS_COLOR: Record<ProjectStatus, string> = {
  active:    'text-[#22c55e] bg-[#22c55e]/10',
  planning:  'text-[#f97316] bg-[#f97316]/10',
  completed: 'text-[#a3a3a3] bg-[#a3a3a3]/10',
  on_hold:   'text-[#ef4444] bg-[#ef4444]/10',
}

function overallProgress(project: Project): number {
  const allPhases = [...project.planningPhases, ...project.executionPhases]
  if (allPhases.length === 0) return 0
  return Math.round(allPhases.reduce((s, p) => s + p.progress, 0) / allPhases.length)
}

export function ProjetosSidebar() {
  const projects         = useProjetosStore((s) => s.projects)
  const selectedId       = useProjetosStore((s) => s.selectedProjectId)
  const selectProject    = useProjetosStore((s) => s.selectProject)
  const setEditingProject = useProjetosStore((s) => s.setEditingProject)

  return (
    <aside
      className="flex flex-col border-r border-[#525252] bg-[#333333] shrink-0 overflow-hidden w-full lg:w-[300px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#525252] shrink-0">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#a3a3a3]">
          Projetos ({projects.length})
        </span>
        <button
          onClick={() => setEditingProject('new')}
          className="flex items-center gap-1 text-[10px] font-semibold text-[#f97316] hover:text-[#ea580c] transition-colors"
        >
          <Plus size={13} />
          Novo
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {projects.map((project) => {
          const progress = overallProgress(project)
          const isSelected = project.id === selectedId

          return (
            <button
              key={project.id}
              onClick={() => selectProject(project.id)}
              className={cn(
                'w-full text-left px-4 py-3 flex flex-col gap-2 border-b border-[#3d3d3d] transition-colors',
                isSelected
                  ? 'bg-[#f97316]/10 border-l-2 border-l-[#f97316]'
                  : 'hover:bg-[#484848] border-l-2 border-l-transparent'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[10px] font-mono text-[#6b6b6b]">{project.code}</span>
                  <span className="text-sm font-semibold text-[#f5f5f5] leading-snug line-clamp-2">
                    {project.name}
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide',
                    STATUS_COLOR[project.status]
                  )}
                >
                  {STATUS_LABEL[project.status]}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#6b6b6b]">Progresso geral</span>
                  <span className="text-[10px] font-mono text-[#a3a3a3]">{progress}%</span>
                </div>
                <div className="h-1 rounded-full bg-[#525252] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#f97316] transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="text-[10px] text-[#6b6b6b]">
                Gerente: <span className="text-[#a3a3a3]">{project.manager}</span>
              </div>
            </button>
          )
        })}

        {projects.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center">
            <span className="text-[#3f3f3f] text-xs">Nenhum projeto cadastrado</span>
            <button
              onClick={() => setEditingProject('new')}
              className="text-xs text-[#f97316] hover:underline"
            >
              Criar primeiro projeto
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
