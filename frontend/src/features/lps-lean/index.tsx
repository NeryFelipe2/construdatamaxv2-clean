/**
 * LpsPage — Last Planner System / Lean Construction module.
 */
import { LpsHeader } from './components/LpsHeader'
import { SemaforoPanel } from './components/SemaforoPanel'
import { LookAheadPanel } from './components/LookAheadPanel'
import { PpcDashboard } from './components/PpcDashboard'
import { TaktTimePanel } from './components/TaktTimePanel'
import { RestricoesPanel } from './components/RestricoesPanel'
import { LpsAnalyticsPanel } from './components/LpsAnalyticsPanel'
import { TimelineRestricoesPanel } from './components/TimelineRestricoesPanel'
import { AlertasPanel } from './components/AlertasPanel'
import { MaoDeObraLpsPanel } from './components/MaoDeObraLpsPanel'
import { IntegracoesPanel } from './components/IntegracoesPanel'
import { useLpsStore } from '@/store/lpsStore'

export function LpsPage() {
  const activeTab = useLpsStore((s) => s.activeTab)

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      <LpsHeader />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'semaforo'            && <SemaforoPanel />}
        {activeTab === 'lookahead'           && <LookAheadPanel />}
        {activeTab === 'ppc'                 && <PpcDashboard />}
        {activeTab === 'takt'                && <TaktTimePanel />}
        {activeTab === 'restricoes'          && <RestricoesPanel />}
        {activeTab === 'analytics'           && <LpsAnalyticsPanel />}
        {activeTab === 'timeline-restricoes' && <div className="p-6"><TimelineRestricoesPanel /></div>}
        {activeTab === 'alertas'             && <div className="p-6"><AlertasPanel /></div>}
        {activeTab === 'mao-de-obra'         && <div className="p-6"><MaoDeObraLpsPanel /></div>}
        {activeTab === 'integracoes'         && <div className="p-6"><IntegracoesPanel /></div>}
      </div>
    </div>
  )
}
