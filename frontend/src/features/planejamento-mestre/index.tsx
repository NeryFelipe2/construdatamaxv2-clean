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
  const setReloadRealData = usePlanejamentoMestreStore((s) => s.setReloadRealData)
  const setProjetoAtivoId = usePlanejamentoMestreStore((s) => s.setProjetoAtivoId)
  const hidratarProgramacaoSemanal = usePlanejamentoMestreStore((s) => s.hidratarProgramacaoSemanal)
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

  // Painéis filhos (ex. NewActivityForm) chamam reloadRealData() depois de
  // escrever em planejamento_itens, pra puxar o agregado atualizado sem F5.
  useEffect(() => {
    setReloadRealData(isDemoMode ? null : engine.reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, engine.reload])

  // Programação Semanal (Previsto/Realizado) agora persiste em
  // `planejamento_mestre_programacao` — carrega tudo do projeto ativo uma vez
  // (e de novo se o projeto mudar), pra sobreviver a F5.
  useEffect(() => {
    setProjetoAtivoId(isDemoMode ? null : activeProjectId)
    if (isDemoMode || !activeProjectId) return
    import('@/hooks/useMasterActivities').then(({ carregarProgramacaoSemanal }) => {
      carregarProgramacaoSemanal(activeProjectId).then(hidratarProgramacaoSemanal)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemoMode, activeProjectId])

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
