/**
 * PlanejamentoPage — root of the Planejamento module.
 * Routes between 9 tabs via the store's activeTab state.
 */
import { useEffect } from 'react'
import { usePlanejamentoStore } from '@/store/planejamentoStore'
import { useAppModeStore } from '@/store/appModeStore'
import { useProjectContext } from '@/store/projectContext'
import { carregarPlanTrechosTeams } from '@/hooks/usePlanTrechosTeams'
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
  const setProjetoAtivoId = usePlanejamentoStore((s) => s.setProjetoAtivoId)
  const hidratarTrechos = usePlanejamentoStore((s) => s.hidratarTrechos)
  const hidratarTeams = usePlanejamentoStore((s) => s.hidratarTeams)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  // Trechos/equipes reais persistidos em plan_trechos/plan_teams — carrega
  // uma vez por projeto ativo (e de novo se o projeto mudar), pra sobreviver
  // a F5. Em modo demo, projetoAtivoId fica null (nenhuma leitura/escrita
  // real) e o mock/demo atual permanece na tela. A hidratação é sempre
  // incondicional (mesmo com array vazio) pra nunca deixar trechos/equipes
  // do projeto anterior vazarem pro projeto novo — espelha o padrão de
  // planejamentoMestreStore.loadFromRealData.
  useEffect(() => {
    setProjetoAtivoId(isDemoMode ? null : activeProjectId)
    if (isDemoMode || !activeProjectId) return
    carregarPlanTrechosTeams(activeProjectId).then((result) => {
      hidratarTrechos(result.trechos)
      hidratarTeams(result.teams)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, activeProjectId])

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
