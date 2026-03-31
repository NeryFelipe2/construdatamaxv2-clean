import { Eye, EyeOff } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useRede360Store } from '@/store/rede360Store'

const LAYERS = [
  { key: 'orders',           label: 'Service Orders',    color: '#eab308' },
  { key: 'outages',          label: 'Live Outages',      color: '#ef4444' },
  { key: 'assets',           label: 'Assets',            color: '#2abfdc' },
  { key: 'riskLayers',       label: 'Risk Layers',       color: '#f97316' },
  { key: 'serviceDistricts', label: 'Service Districts', color: '#a78bfa' },
  { key: 'landCover',        label: 'Land Cover',        color: '#4ade80' },
  { key: 'circuits',         label: 'Circuits',          color: '#38bdf8' },
]

export function GridLayerPanel() {
  const { layerVisibility, setLayerVisibility } = useRede360Store(
    useShallow((s) => ({
      layerVisibility:    s.layerVisibility,
      setLayerVisibility: s.setLayerVisibility,
    }))
  )

  const allVisible = LAYERS.every((l) => layerVisibility[l.key] !== false)

  function toggleAll() {
    const newVal = !allVisible
    LAYERS.forEach((l) => setLayerVisibility(l.key, newVal))
  }

  return (
    <div className="hidden md:flex w-48 shrink-0 bg-[#0d2040] border-r border-[#20406a] flex-col overflow-y-auto">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#20406a] flex items-center justify-between">
        <span className="text-[#8fb3c8] text-xs font-semibold uppercase tracking-wider">Camadas</span>
        <button
          onClick={toggleAll}
          className="text-xs text-[#2abfdc] hover:text-[#f5f5f5] transition-colors"
        >
          {allVisible ? 'Ocultar' : 'Mostrar'} all
        </button>
      </div>
      {/* Layer rows */}
      <div className="flex flex-col py-1">
        {LAYERS.map(({ key, label, color }) => {
          const visible = layerVisibility[key] !== false
          return (
            <button
              key={key}
              onClick={() => setLayerVisibility(key, !visible)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-[#14294e] transition-colors group text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0 transition-opacity"
                style={{ backgroundColor: color, opacity: visible ? 1 : 0.3 }}
              />
              <span className={`text-xs flex-1 transition-colors ${visible ? 'text-[#f5f5f5]' : 'text-[#6b6b6b]'}`}>
                {label}
              </span>
              {visible
                ? <Eye size={12} className="text-[#6b6b6b] group-hover:text-[#8fb3c8]" />
                : <EyeOff size={12} className="text-[#6b6b6b]" />
              }
            </button>
          )
        })}
      </div>
    </div>
  )
}
