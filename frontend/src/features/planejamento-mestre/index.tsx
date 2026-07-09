/**
 * PlanejamentoMestrePage — main page for the Planejamento Mestre module.
 */
import { useEffect } from 'react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { useAppModeStore } from '@/store/appModeStore'
import { useProjectContext } from '@/store/projectContext'
import { useMasterScheduleEngine } from '@/hooks/useMasterScheduleEngine'
import { PlanejamentoMestreHeader } from './components/PlanejamentoMestreHeader'
import { PlanejamentoMacroPanel } from './components/PlanejamentoMacroPanel'
import { DerivacaoPanel } from './components/DerivacaoPanel'
import { CurtoPrazoPanel } from './components/CurtoPrazoPanel'
import { VisaoIntegradaPanel } from './components/VisaoIntegradaPanel'
import { ProgramacaoSemanalPanel } from './components/ProgramacaoSemanalPanel'
import { CronogramaPorEquipePanel } from './components/CronogramaPorEquipePanel'

export function PlanejamentoMestrePage() {
  const activeTab = usePlanejamentoMestreStore((s) => s.activeTab)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const loadDemoData = usePlanejamentoMestreStore((s) => s.loadDemoData)
  const loadFromRealData = usePlanejamentoMestreStore((s) => s.loadFromRealData)
  const isDemoMode = useAppModeStore((s) => s.isDemoMode)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  const engine = useMasterScheduleEngine(isDemoMode ? null : activeProjectId)

  useEffect(() => {
    if (activities.length === 0 && isDemoMode) loadDemoData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isDemoMode) return
    if (engine.loading) return
    loadFromRealData(engine.activities, engine.matchQuality)
  }, [isDemoMode, engine.loading, engine.activities, engine.matchQuality, loadFromRealData])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PlanejamentoMestreHeader />
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'macro'     && <PlanejamentoMacroPanel />}
        {activeTab === 'derivacao' && <DerivacaoPanel />}
        {activeTab === 'whatif'    && <CurtoPrazoPanel />}
        {activeTab === 'integrada' && <VisaoIntegradaPanel />}
        {activeTab === 'semanal'   && <ProgramacaoSemanalPanel />}
        {activeTab === 'por-equipe' && <CronogramaPorEquipePanel />}
      </div>
    </div>
  )
}
