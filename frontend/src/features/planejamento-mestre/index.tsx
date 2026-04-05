/**
 * PlanejamentoMestrePage — main page for the Planejamento Mestre module.
 */
import { useEffect } from 'react'
import { usePlanejamentoMestreStore } from '@/store/planejamentoMestreStore'
import { PlanejamentoMestreHeader } from './components/PlanejamentoMestreHeader'
import { PlanejamentoMacroPanel } from './components/PlanejamentoMacroPanel'
import { DerivacaoPanel } from './components/DerivacaoPanel'
import { CurtoPrazoPanel } from './components/CurtoPrazoPanel'
import { VisaoIntegradaPanel } from './components/VisaoIntegradaPanel'
import { ProgramacaoSemanalPanel } from './components/ProgramacaoSemanalPanel'

export function PlanejamentoMestrePage() {
  const activeTab = usePlanejamentoMestreStore((s) => s.activeTab)
  const activities = usePlanejamentoMestreStore((s) => s.activities)
  const loadDemoData = usePlanejamentoMestreStore((s) => s.loadDemoData)

  useEffect(() => {
    if (activities.length === 0) loadDemoData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PlanejamentoMestreHeader />
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'macro'     && <PlanejamentoMacroPanel />}
        {activeTab === 'derivacao' && <DerivacaoPanel />}
        {activeTab === 'whatif'    && <CurtoPrazoPanel />}
        {activeTab === 'integrada' && <VisaoIntegradaPanel />}
        {activeTab === 'semanal'   && <ProgramacaoSemanalPanel />}
      </div>
    </div>
  )
}
