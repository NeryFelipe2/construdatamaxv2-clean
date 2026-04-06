import { useState } from 'react'
import { Layers, Upload, GitBranch, Ruler, DollarSign, CalendarCheck, FolderOpen, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBimStore } from '@/store/bimStore'
import type { BimTab } from '@/types'

const TABS: { key: BimTab; label: string }[] = [
  { key: 'viewer', label: 'Visualizador 3D' },
  { key: '4d',     label: 'Análise 4D (Prazo)' },
  { key: '5d',     label: 'Análise 5D (Custo)' },
]

function fmtBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `R$ ${(n / 1_000).toFixed(0)}k`
  return `R$ ${n.toFixed(0)}`
}

interface Props { onUploadClick: () => void }

export function BimHeader({ onUploadClick }: Props) {
  const activeTab     = useBimStore((s) => s.activeTab)
  const setActiveTab  = useBimStore((s) => s.setActiveTab)
  const project       = useBimStore((s) => s.project)
  const activeDate    = useBimStore((s) => s.activeDate)
  const [showProjects, setShowProjects] = useState(false)
  const [projectList, setProjectList]   = useState<{ id: string; name: string }[]>([])

  function openProjects() {
    import('@/store/projetosStore').then(({ useProjetosStore }) => {
      const projetos = useProjetosStore.getState().projects
      setProjectList(projetos.map((p) => ({ id: p.id, name: p.name })))
      setShowProjects(true)
    })
  }

  function loadProject(id: string) {
    setShowProjects(false)
    import('@/store/projetosStore').then(({ useProjetosStore }) => {
      const p = useProjetosStore.getState().projects.find((x) => x.id === id)
      if (!p) return
      import('@/features/projetos/utils/projectToBim').then(({ projectToBim }) => {
        const bimProject = projectToBim(p)
        const { projects, addProject, setActiveProject } = useBimStore.getState()
        const existing = projects.find((x) => x.id === bimProject.id)
        if (existing) { setActiveProject(existing.id) } else { addProject(bimProject) }
      })
    })
  }

  // KPI calculations
  const segs        = project?.segments ?? []
  const totalSegs   = segs.length
  const totalLength = segs.reduce((s, seg) => s + (seg.lengthM ?? 0), 0)
  const totalCost   = segs.reduce((s, seg) => s + (seg.totalCostBRL ?? 0), 0)
  const completed   = segs.filter((seg) => seg.constructionDate && seg.constructionDate <= activeDate).length
  const pctDone     = totalSegs > 0 ? Math.round((completed / totalSegs) * 100) : 0

  return (
    <div className="flex flex-col bg-[#2c2c2c] border-b border-[#3d3d3d] shrink-0">
      {/* Top row: title | tabs | upload */}
      <div className="flex items-center gap-2 h-12 px-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-indigo-600 shrink-0">
            <Layers size={14} className="text-white" />
          </div>
          <span className="text-gray-100 font-semibold text-sm hidden sm:block">BIM 3D / 4D / 5D</span>
        </div>

        {/* Tabs — scrollable on mobile */}
        <div className="flex items-center gap-1 bg-[#3d3d3d] rounded-lg p-0.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-2 sm:px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0',
                activeTab === t.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-[#a3a3a3] hover:text-[#f5f5f5]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Projetos dropdown */}
          <div className="relative">
            <button
              onClick={openProjects}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-[#484848] hover:bg-[#525252] text-[#f5f5f5] text-xs font-medium transition-colors"
            >
              <FolderOpen size={13} />
              <span className="hidden sm:inline">Projetos</span>
              <ChevronDown size={11} />
            </button>
            {showProjects && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProjects(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#3d3d3d] border border-[#525252] rounded-lg shadow-xl min-w-[200px] py-1 max-h-[60vh] overflow-y-auto">
                  {projectList.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-[#6b6b6b]">Nenhum projeto cadastrado.</p>
                  ) : (
                    projectList.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => loadProject(p.id)}
                        className="w-full text-left px-3 py-2 text-xs text-[#f5f5f5] hover:bg-[#484848] hover:text-white transition-colors truncate"
                      >
                        {p.name}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <button
            onClick={onUploadClick}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors"
          >
            <Upload size={13} />
            <span className="hidden sm:inline">Importar</span>
          </button>
        </div>
      </div>

      {/* KPI bar — horizontally scrollable on mobile */}
      <div className="flex items-center border-t border-[#3d3d3d] divide-x divide-[#3d3d3d] overflow-x-auto scrollbar-none">
        <KpiCell icon={<GitBranch size={12} className="text-indigo-400" />} label="Trechos" value={String(totalSegs)} />
        <KpiCell icon={<Ruler size={12} className="text-blue-400" />} label="Extensão" value={`${totalLength.toFixed(0)} m`} />
        <KpiCell icon={<DollarSign size={12} className="text-green-400" />} label="Custo Total" value={fmtBRL(totalCost)} />
        <KpiCell
          icon={<CalendarCheck size={12} className="text-orange-400" />}
          label={`Concluído`}
          value={`${pctDone}%`}
          accent={pctDone === 100 ? 'text-green-400' : pctDone > 50 ? 'text-yellow-400' : 'text-[#f5f5f5]'}
        />
        {project?.type && (
          <div className="flex items-center px-3 py-1.5 shrink-0">
            <span className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap',
              project.type === 'building'   ? 'bg-blue-900/40 text-blue-300'   :
              project.type === 'sanitation' ? 'bg-green-900/40 text-green-300' :
              'bg-[#484848] text-[#a3a3a3]',
            )}>
              {project.type === 'building' ? 'Construção Civil' :
               project.type === 'sanitation' ? 'Saneamento' : 'Genérico'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function KpiCell({
  icon, label, value, accent = 'text-[#f5f5f5]',
}: {
  icon: React.ReactNode; label: string; value: string; accent?: string
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 flex-1 min-w-0">
      {icon}
      <div className="min-w-0">
        <p className="text-gray-600 text-[10px] truncate">{label}</p>
        <p className={`text-xs font-semibold ${accent}`}>{value}</p>
      </div>
    </div>
  )
}
