/**
 * MapaLayersPanel — Collapsible layer visibility toggle panel.
 */
import { useState } from 'react'
import { Layers, ChevronRight, ChevronDown } from 'lucide-react'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'
import type { MapNetworkType } from '@/types'

export function MapaLayersPanel() {
  const layers        = useMapaInterativoStore((s) => s.layers)
  const setLayerVisible = useMapaInterativoStore((s) => s.setLayerVisible)
  const [open, setOpen] = useState(true)

  return (
    <div className="absolute top-3 right-3 z-[1000] bg-gray-900/95 border border-gray-700 rounded-xl shadow-xl min-w-[140px] max-w-[180px]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 w-full text-xs font-semibold text-white hover:text-orange-400 transition-colors"
      >
        <Layers size={13} />
        <span>Camadas</span>
        {open ? <ChevronDown size={12} className="ml-auto" /> : <ChevronRight size={12} className="ml-auto" />}
      </button>

      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 border-t border-gray-800 pt-2">
          {layers.map((layer) => (
            <label key={layer.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(e) => setLayerVisible(layer.id as MapNetworkType, e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                  layer.visible ? 'border-transparent' : 'border-gray-600 bg-transparent'
                }`}
                style={{ backgroundColor: layer.visible ? layer.color + 'cc' : undefined }}
              >
                {layer.visible && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1 4L3 6L7 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-300 group-hover:text-white transition-colors">{layer.name}</span>
              <div className="w-2 h-2 rounded-full ml-auto flex-shrink-0" style={{ backgroundColor: layer.color }} />
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
