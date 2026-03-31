import { useBimStore } from '@/store/bimStore'
import { Building2, DollarSign, Eye, EyeOff, Layers as LayersIcon, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

const PROJECT_ICONS: Record<string, React.ReactNode> = {
  building:   <Building2 size={12} />,
  sanitation: <Droplets size={12} />,
  generic:    <LayersIcon size={12} />,
}

export function BimLeftPanel() {
  const projects       = useBimStore((s) => s.projects)
  const activeProjectId = useBimStore((s) => s.activeProjectId)
  const project        = useBimStore((s) => s.project)
  const layers         = useBimStore((s) => s.layers)
  const toggleLayer    = useBimStore((s) => s.toggleLayer)
  const setActiveProject = useBimStore((s) => s.setActiveProject)

  if (projects.length === 0) {
    return (
      <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col items-center justify-center p-4 shrink-0">
        <LayersIcon size={32} className="text-gray-700 mb-2" />
        <p className="text-gray-600 text-xs text-center">Ative o modo Demo ou importe um arquivo</p>
      </div>
    )
  }

  const totalCost   = project?.segments.reduce((s, seg) => s + seg.totalCostBRL, 0) ?? 0
  const totalLength = project?.segments.reduce((s, seg) => s + seg.lengthM, 0) ?? 0

  return (
    <div className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 overflow-y-auto">
      {/* Project switcher */}
      {projects.length > 0 && (
        <div className="p-2 border-b border-gray-800">
          <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-1">Projetos</p>
          <div className="space-y-0.5">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className={cn(
                  'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-lg text-xs transition-colors',
                  p.id === activeProjectId
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/40'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200',
                )}
              >
                <span className={cn(
                  'shrink-0',
                  p.type === 'building' ? 'text-blue-400' :
                  p.type === 'sanitation' ? 'text-green-400' : 'text-gray-500',
                )}>
                  {PROJECT_ICONS[p.type ?? 'generic']}
                </span>
                <span className="truncate font-medium leading-tight">{p.name}</span>
                {p.id === activeProjectId && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {project && (
        <>
          {/* Project info */}
          <div className="p-3 border-b border-gray-800">
            <div className="space-y-1">
              <Row label="Trechos"    value={String(project.segments.length)} />
              <Row label="Extensão"   value={`${totalLength.toFixed(0)} m`} />
              <Row label="Fonte"      value={project.shapefileSourceName} truncate />
              <Row label="Importado"  value={new Date(project.uploadedAt).toLocaleDateString('pt-BR')} />
            </div>
          </div>

          {/* Budget summary */}
          <div className="p-3 border-b border-gray-800">
            <div className="flex items-center gap-2 mb-1.5">
              <DollarSign size={12} className="text-green-400 shrink-0" />
              <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider">Custo Total</span>
            </div>
            <p className="text-green-400 font-bold text-base leading-tight">{fmtBRL(totalCost)}</p>
            <p className="text-gray-600 text-xs mt-0.5">
              {fmtBRL(totalLength > 0 ? Math.round(totalCost / totalLength) : 0)}/m médio
            </p>
          </div>

          {/* Layers */}
          <div className="p-3 flex-1">
            <p className="text-gray-500 text-[10px] font-semibold uppercase tracking-wider mb-1.5">Camadas</p>
            <div className="space-y-0.5">
              {layers.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className="flex items-center gap-2 w-full text-left rounded px-2 py-1 hover:bg-gray-800 transition-colors group"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: layer.visible ? layer.color : '#374151' }}
                  />
                  <span className={`text-xs flex-1 truncate ${layer.visible ? 'text-gray-200' : 'text-gray-600'}`}>
                    {layer.name}
                  </span>
                  {layer.visible
                    ? <Eye size={11} className="text-gray-600 group-hover:text-gray-400 shrink-0" />
                    : <EyeOff size={11} className="text-gray-700 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Row({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-gray-600 text-xs">{label}</span>
      <span className={`text-gray-300 text-xs font-medium ${truncate ? 'truncate max-w-[100px]' : ''}`}>{value}</span>
    </div>
  )
}
