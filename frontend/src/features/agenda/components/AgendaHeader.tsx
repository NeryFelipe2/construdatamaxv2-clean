import { useState } from 'react'
import { CalendarDays, Play, LayoutGrid } from 'lucide-react'
import { ScenarioCompareModal } from './ScenarioCompareModal'
import { ModelViewPanel } from './ModelViewPanel'

export function AgendaHeader() {
  const [showScenarios, setShowScenarios] = useState(false)
  const [showModel,     setShowModel]     = useState(false)

  return (
    <>
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#20406a] bg-[#112645] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#2abfdc]/15">
            <CalendarDays size={15} className="text-[#2abfdc]" />
          </div>
          <h1 className="text-[#f5f5f5] text-base font-bold tracking-tight">Agenda</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScenarios(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] text-xs font-semibold hover:bg-[#22c55e]/25 transition-colors"
          >
            <Play size={12} className="fill-[#22c55e]" />
            Executar Cenários
          </button>
          <button
            onClick={() => setShowModel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#20406a] text-[#a3a3a3] text-xs font-semibold hover:text-[#f5f5f5] hover:border-[#1f3c5e] transition-colors"
          >
            <LayoutGrid size={12} />
            Visão do Modelo
          </button>
        </div>
      </div>

      {showScenarios && <ScenarioCompareModal onClose={() => setShowScenarios(false)} />}
      {showModel     && <ModelViewPanel onClose={() => setShowModel(false)} />}
    </>
  )
}
