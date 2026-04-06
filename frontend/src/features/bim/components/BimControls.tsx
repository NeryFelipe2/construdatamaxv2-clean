import { Circle, Cpu, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBimStore } from '@/store/bimStore'
import type { BimColorMode } from '@/types'

const COLOR_MODES: { key: BimColorMode; label: string; dot: string }[] = [
  { key: 'default',  label: 'Material',     dot: '#6366f1' },
  { key: 'depth',    label: 'Profundidade', dot: '#3b82f6' },
  { key: 'date',     label: 'Prazo (4D)',   dot: '#f59e0b' },
  { key: 'cost',     label: 'Custo (5D)',   dot: '#ef4444' },
  { key: 'diameter', label: 'Diâmetro',     dot: '#f97316' },
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
    <div className="flex items-center gap-1 px-3 py-2 bg-[#3d3d3d]/80 border-b border-[#525252] overflow-x-auto scrollbar-none shrink-0">
      {/* Viewer mode toggle */}
      <div className="flex items-center bg-[#2c2c2c]/60 rounded-lg border border-[#525252] p-0.5 mr-2">
        <button
          onClick={() => setViewerMode('threejs')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
            viewerMode === 'threejs' ? 'bg-[#484848] text-gray-100' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
          )}
        >
          <Cpu size={11} />
          Three.js
        </button>
        <button
          onClick={() => setViewerMode('forge')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
            viewerMode === 'forge' ? 'bg-[#f97316]/20 text-[#f97316]' : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
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
              ? 'bg-[#f97316]/15 border-[#f97316]/40 text-[#f97316]'
              : 'border-[#525252] text-[#6b6b6b] hover:text-[#f5f5f5] hover:border-[#5e5e5e]',
          )}
        >
          <Navigation size={11} />
          Drone
        </button>
      )}

      {/* Color mode selector — Three.js only */}
      {viewerMode === 'threejs' && (
        <>
          <span className="text-[#6b6b6b] text-xs font-medium mr-1">Cor:</span>
          {COLOR_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setColorMode(m.key)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors',
                colorMode === m.key
                  ? 'bg-[#484848] text-gray-100'
                  : 'text-[#6b6b6b] hover:text-[#f5f5f5]',
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
