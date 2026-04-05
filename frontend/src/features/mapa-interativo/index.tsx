/**
 * MapaInterativoPage — Interactive network map module.
 * Full Leaflet-based editor for sewer/water/civil networks.
 * Shows a mode selector (Saneamento vs Construção) on first open.
 */
import { useState } from 'react'
import { Droplets, HardHat, ArrowLeftRight } from 'lucide-react'
import { MapaHeader }        from './components/MapaHeader'
import { MapaCanvas }        from './components/MapaCanvas'
import { MapaLayersPanel }   from './components/MapaLayersPanel'
import { MapaAnalyticsPanel } from './components/MapaAnalyticsPanel'
import { useMapaInterativoStore } from '@/store/mapaInterativoStore'

// ─── Mode selector ────────────────────────────────────────────────────────────

function ModeSelectorOverlay() {
  const setMapMode = useMapaInterativoStore((s) => s.setMapMode)

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 bg-[#071422]">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[#f5f5f5] mb-2">Mapa Interativo</h1>
        <p className="text-sm text-[#6b6b6b]">Selecione o modo de trabalho para configurar as camadas automaticamente</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 px-4 w-full max-w-xl">
        {/* Saneamento */}
        <button
          onClick={() => setMapMode('saneamento')}
          className="flex flex-col items-center gap-3 flex-1 p-6 rounded-2xl border border-[#525252] bg-[#2c2c2c] hover:border-[#f97316]/60 hover:bg-[#f97316]/5 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center group-hover:bg-[#f97316]/20 transition-colors">
            <Droplets size={32} className="text-[#f97316]" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-[#f5f5f5] mb-1">Saneamento</p>
            <p className="text-xs text-[#6b6b6b] leading-relaxed">Redes de esgoto, água e drenagem. PVs, nós e tubulações.</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {['Esgoto', 'Água', 'Drenagem'].map((l) => (
              <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">{l}</span>
            ))}
          </div>
        </button>

        {/* Construção */}
        <button
          onClick={() => setMapMode('construcao')}
          className="flex flex-col items-center gap-3 flex-1 p-6 rounded-2xl border border-[#525252] bg-[#2c2c2c] hover:border-[#f97316]/60 hover:bg-[#f97316]/5 transition-all group"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#f97316]/10 border border-[#f97316]/30 flex items-center justify-center group-hover:bg-[#f97316]/20 transition-colors">
            <HardHat size={32} className="text-[#f97316]" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-[#f5f5f5] mb-1">Construção</p>
            <p className="text-xs text-[#6b6b6b] leading-relaxed">Obras civis, estruturas e elementos construtivos.</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {['Civil 3D', 'Genérico'].map((l) => (
              <span key={l} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316] border border-[#f97316]/20">{l}</span>
            ))}
          </div>
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function MapaInterativoPage() {
  const [showAnalytics, setShowAnalytics] = useState(false)
  const mapMode = useMapaInterativoStore((s) => s.mapMode)

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      <MapaHeader
        showAnalytics={showAnalytics}
        onToggleAnalytics={() => setShowAnalytics((v) => !v)}
      />

      {mapMode === null ? (
        <ModeSelectorOverlay />
      ) : (
        <>
          {/* Mode indicator strip */}
          <div className="flex items-center gap-2 px-4 py-1.5 bg-[#071422] border-b border-[#525252] shrink-0">
            {mapMode === 'saneamento'
              ? <Droplets size={12} className="text-[#f97316]" />
              : <HardHat size={12} className="text-[#f97316]" />
            }
            <span className="text-[11px] text-[#a3a3a3] font-medium">
              Modo: {mapMode === 'saneamento' ? 'Saneamento' : 'Construção'}
            </span>
            <button
              onClick={() => useMapaInterativoStore.getState().setMapMode(null)}
              className="ml-2 flex items-center gap-1 text-[10px] text-[#6b6b6b] hover:text-[#f97316] transition-colors"
            >
              <ArrowLeftRight size={10} />
              Trocar Modo
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <MapaCanvas />
            <MapaLayersPanel />
          </div>
          {showAnalytics && <MapaAnalyticsPanel />}
        </>
      )}
    </div>
  )
}
