import { useState } from 'react'
import { PanelLeft, PanelRight, X } from 'lucide-react'
import { BimLeftPanel }       from './BimLeftPanel'
import { BimCanvas }          from './BimCanvas'
import { BimControls }        from './BimControls'
import { BimPropertiesPanel } from './BimPropertiesPanel'
import { BimForgeViewer }     from './BimForgeViewer'
import { BimSaneamentoPanel } from './BimSaneamentoPanel'
import { Bim4DPanel }         from './Bim4DPanel'
import { Bim5DPanel }         from './Bim5DPanel'
import { useBimStore }        from '@/store/bimStore'

export function BimLayout() {
  const activeTab  = useBimStore((s) => s.activeTab)
  const viewerMode = useBimStore((s) => s.viewerMode)
  const project    = useBimStore((s) => s.project)

  const isSanitation = project?.type === 'sanitation'

  // Mobile panel visibility state
  const [mobileLeft,  setMobileLeft]  = useState(false)
  const [mobileRight, setMobileRight] = useState(false)

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Mobile panel toggles — only shown on small screens */}
      <div className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-[#2c2c2c] border-b border-[#3d3d3d] shrink-0">
        <button
          onClick={() => { setMobileLeft((v) => !v); setMobileRight(false) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            mobileLeft
              ? 'bg-indigo-600/20 border-indigo-600/40 text-indigo-300'
              : 'border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]'
          }`}
        >
          <PanelLeft size={13} />
          Projetos
        </button>
        <button
          onClick={() => { setMobileRight((v) => !v); setMobileLeft(false) }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            mobileRight
              ? 'bg-indigo-600/20 border-indigo-600/40 text-indigo-300'
              : 'border-[#525252] text-[#a3a3a3] hover:text-[#f5f5f5]'
          }`}
        >
          <PanelRight size={13} />
          Propriedades
        </button>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0 relative">

        {/* ─── Left panel — desktop: sidebar, mobile: overlay ─────────────── */}
        {/* Desktop */}
        <div className="hidden md:block">
          <BimLeftPanel />
        </div>

        {/* Mobile overlay */}
        {mobileLeft && (
          <div className="absolute inset-0 z-30 flex md:hidden">
            <div className="w-72 max-w-[85vw] h-full bg-[#2c2c2c] border-r border-[#3d3d3d] flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#3d3d3d] shrink-0">
                <span className="text-[#f5f5f5] text-xs font-semibold">Projetos / Camadas</span>
                <button onClick={() => setMobileLeft(false)} className="text-[#6b6b6b] hover:text-[#f5f5f5]">
                  <X size={15} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <BimLeftPanel />
              </div>
            </div>
            <div className="flex-1 bg-black/50" onClick={() => setMobileLeft(false)} />
          </div>
        )}

        {/* ─── Center: controls toolbar + canvas ──────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <BimControls />
          {viewerMode === 'forge' ? (
            <BimForgeViewer />
          ) : (
            <BimCanvas />
          )}
        </div>

        {/* ─── Right panels — desktop: sidebar, mobile: overlay ───────────── */}
        {/* Desktop */}
        <div className="hidden md:block">
          {viewerMode === 'threejs' && isSanitation && <BimSaneamentoPanel />}
          {viewerMode === 'threejs' && !isSanitation && <BimPropertiesPanel />}
          {viewerMode === 'forge'   && <BimPropertiesPanel />}
        </div>

        {/* Mobile overlay */}
        {mobileRight && (
          <div className="absolute inset-0 z-30 flex flex-row-reverse md:hidden">
            <div className="w-72 max-w-[85vw] h-full bg-[#2c2c2c] border-l border-[#3d3d3d] flex flex-col overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-3 py-2 border-b border-[#3d3d3d] shrink-0">
                <span className="text-[#f5f5f5] text-xs font-semibold">Propriedades</span>
                <button onClick={() => setMobileRight(false)} className="text-[#6b6b6b] hover:text-[#f5f5f5]">
                  <X size={15} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {viewerMode === 'threejs' && isSanitation && <BimSaneamentoPanel />}
                {viewerMode === 'threejs' && !isSanitation && <BimPropertiesPanel />}
                {viewerMode === 'forge'   && <BimPropertiesPanel />}
              </div>
            </div>
            <div className="flex-1 bg-black/50" onClick={() => setMobileRight(false)} />
          </div>
        )}
      </div>

      {/* ─── Bottom panel: 4D / 5D ──────────────────────────────────────── */}
      {activeTab === '4d' && <Bim4DPanel />}
      {activeTab === '5d' && <Bim5DPanel />}
      {activeTab === 'viewer' && (
        <div className="h-8 shrink-0 bg-[#2c2c2c] border-t border-[#3d3d3d] flex items-center px-4">
          <p className="text-gray-600 text-xs truncate">
            {viewerMode === 'forge'
              ? 'Autodesk APS Viewer — Visualização nativa de modelos BIM'
              : 'Modo Visualizador 3D — Use as abas 4D/5D para análise temporal e de custos'}
          </p>
        </div>
      )}
    </div>
  )
}
