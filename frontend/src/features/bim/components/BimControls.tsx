import { Circle, Cpu, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBimStore } from '@/store/bimStore'
import type { BimColorMode } from '@/types'

const COLOR_MODES: { key: BimColorMode; label: string; dot: string }[] = [
  { key: 'default',  label: 'Material',     dot: '#6366f1' },
  { key: 'depth',    label: 'Profundidade', dot: '#3b82f6' },
  { key: 'date',     label: 'Prazo (4D)',   dot: '#f59e0b' },
  { key: 'cost',     label: 'Custo (5D)',   dot: '#ef4444' },
  { key: 'diameter', label: 'Diâmetro',     dot: '#2abfdc' },
  { key: 'pressure', label: 'Pressão',      dot: '#22c55e' },
]

export function BimControls() {
  const colorMode    = useBimStore((s) => s.colorMode)
  const viewerMode   = useBimStore((s) => s.viewerMode)
  const droneMode    = useBimStore((s) => s.droneMode)
  const setColorMode = useBimStore((s) => s.setColorMode)
  const setViewerMode   = useBimStore((s) => s.setViewerMode)
  const toggleDroneMode = useBimStore((s) => s.toggleDroneMode)

  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-gray-800/80 border-b border-gray-700 overflow-x-auto scrollbar-none shrink-0">
      {/* Viewer mode toggle */}
      <div className="flex items-center bg-gray-900/60 rounded-lg border border-gray-700 p-0.5 mr-2">
        <button
          onClick={() => setViewerMode('threejs')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
            viewerMode === 'threejs' ? 'bg-gray-700 text-gray-100' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Cpu size={11} />
          Three.js
        </button>
        <button
          onClick={() => setViewerMode('forge')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
            viewerMode === 'forge' ? 'bg-[#2abfdc]/20 text-[#2abfdc]' : 'text-gray-500 hover:text-gray-300',
          )}
        >
          <Navigation size={11} />
          Forge APS
        </button>
      </div>

      {/* Drone mode toggle — Three.js only */}
      {viewerMode === 'threejs' && (
        <button
          onClick={toggleDroneMode}
          title="Modo Drone (WASD)"
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors mr-2',
            droneMode
              ? 'bg-[#2abfdc]/15 border-[#2abfdc]/40 text-[#2abfdc]'
              : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600',
          )}
        >
          <Navigation size={11} />
          Drone
        </button>
      )}

      {/* Color mode selector — Three.js only */}
      {viewerMode === 'threejs' && (
        <>
          <span className="text-gray-500 text-xs font-medium mr-1">Cor:</span>
          {COLOR_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setColorMode(m.key)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
                colorMode === m.key
                  ? 'bg-gray-700 text-gray-100'
                  : 'text-gray-500 hover:text-gray-300',
              )}
            >
              <Circle size={8} fill={m.dot} stroke="none" />
              {m.label}
            </button>
          ))}
        </>
      )}
    </div>
  )
}
