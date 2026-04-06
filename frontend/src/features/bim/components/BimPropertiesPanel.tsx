import { useBimStore } from '@/store/bimStore'
import { X, Ruler, Layers as LayersIcon, DollarSign } from 'lucide-react'

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function BimPropertiesPanel() {
  const project = useBimStore((s) => s.project)
  const selectedId = useBimStore((s) => s.selectedSegmentId)
  const selectSegment = useBimStore((s) => s.selectSegment)

  const segment = project?.segments.find((s) => s.id === selectedId) ?? null

  if (!segment) {
    return (
      <div className="w-56 bg-[#2c2c2c] border-l border-[#3d3d3d] flex flex-col items-center justify-center p-4 shrink-0">
        <LayersIcon size={28} className="text-gray-700 mb-2" />
        <p className="text-gray-600 text-xs text-center">Clique num trecho para ver as propriedades</p>
      </div>
    )
  }

  return (
    <div className="w-56 bg-[#2c2c2c] border-l border-[#3d3d3d] flex flex-col shrink-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#3d3d3d]">
        <span className="text-gray-100 text-xs font-semibold">Propriedades</span>
        <button
          onClick={() => selectSegment(null)}
          className="text-gray-600 hover:text-[#f5f5f5] transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Segment ID */}
      <div className="px-3 py-2 border-b border-[#3d3d3d]">
        <p className="text-indigo-400 text-xs font-bold">{segment.trechoCode || segment.id.slice(0, 8)}</p>
        {segment.phase && <p className="text-[#6b6b6b] text-xs">{segment.phase}</p>}
      </div>

      {/* Geometry */}
      <Section icon={<Ruler size={12} className="text-blue-400" />} title="Geometria">
        <Row label="Extensão" value={`${segment.lengthM.toFixed(1)} m`} />
        <Row label="Prof. média" value={`${segment.avgDepthM.toFixed(2)} m`} />
        <Row label="Pontos" value={String(segment.vertices.length)} />
      </Section>

      {/* Attributes */}
      <Section icon={<LayersIcon size={12} className="text-yellow-400" />} title="Atributos">
        <Row label="Diâmetro" value={`DN${segment.diameter}`} />
        <Row label="Material" value={segment.material} />
        {Object.entries(segment.attributes).map(([k, v]) => (
          <Row key={k} label={k} value={String(v)} />
        ))}
      </Section>

      {/* Cost */}
      <Section icon={<DollarSign size={12} className="text-green-400" />} title="Custo">
        <Row label="Custo/m" value={fmtBRL(segment.unitCostBRL)} />
        <Row label="Total" value={fmtBRL(segment.totalCostBRL)} accent />
      </Section>

      {/* Schedule */}
      {segment.constructionDate && (
        <Section icon={<span className="text-orange-400 text-xs">📅</span>} title="Cronograma">
          <Row label="Início" value={segment.constructionDate} />
        </Section>
      )}

      {/* Vertices preview */}
      <div className="px-3 py-2 border-t border-[#3d3d3d]">
        <p className="text-[#6b6b6b] text-xs font-semibold uppercase tracking-wider mb-1">Coordenadas</p>
        <div className="space-y-0.5 max-h-32 overflow-y-auto">
          {segment.vertices.map((v, i) => (
            <p key={i} className="text-gray-600 text-[10px] font-mono">
              {v[0].toFixed(1)}, {v[1].toFixed(1)}, {v[2].toFixed(2)}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-2 border-b border-[#3d3d3d]">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[#a3a3a3] text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-1">
      <span className="text-gray-600 text-xs truncate">{label}</span>
      <span className={`text-xs font-medium truncate max-w-[90px] ${accent ? 'text-green-400' : 'text-[#f5f5f5]'}`}>
        {value}
      </span>
    </div>
  )
}
