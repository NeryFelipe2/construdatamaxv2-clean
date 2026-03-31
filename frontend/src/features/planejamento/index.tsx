/**
 * PlanejamentoPage — root of the Planejamento module.
 * Routes between 9 tabs via the store's activeTab state.
 */
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { PlanejamentoHeader } from './components/PlanejamentoHeader'
import { ConfigPanel }      from './components/ConfigPanel'
import { TrechosPanel }     from './components/TrechosPanel'
import { GanttPanel }       from './components/GanttPanel'
import { SCurvePanel }      from './components/SCurvePanel'
import { AbcPanel }         from './components/AbcPanel'
import { HistogramPanel }   from './components/HistogramPanel'
import { DailyPlanPanel }   from './components/DailyPlanPanel'
import { NotesPanel }       from './components/NotesPanel'
import { ScenariosPanel }   from './components/ScenariosPanel'

export function PlanejamentoPage() {
  const activeTab = usePlanejamentoStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'config':    return <ConfigPanel />
      case 'trechos':   return <TrechosPanel />
      case 'gantt':     return <GanttPanel />
      case 'scurve':    return <SCurvePanel />
      case 'abc':       return <AbcPanel />
      case 'histogram': return <HistogramPanel />
      case 'daily':     return <DailyPlanPanel />
      case 'notes':     return <NotesPanel />
      case 'scenarios': return <ScenariosPanel />
      default:          return <ConfigPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <PlanejamentoHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
