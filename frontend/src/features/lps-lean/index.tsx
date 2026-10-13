/**
 * LpsPage — Last Planner System / Lean Construction module.
 *
 * Deep-links do trilho guiado (Fase 3): ?tab=X troca a aba ativa do lpsStore
 * (ex.: /app/lps-lean?tab=restricoes) e ?guia=pN mostra o GuiaRibbon no topo
 * (o ribbon se autogerencia lendo o searchParam).
 */
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GuiaRibbon } from '@/components/shared/GuiaRibbon'
import type { LpsTab } from '@/types'
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
import { useProjectContext } from '@/store/projectContext'

/** Abas válidas pro deep-link ?tab= (mesma união de LpsTab em types). */
const LPS_TABS_VALIDAS: LpsTab[] = [
  'semaforo', 'lookahead', 'ppc', 'takt', 'restricoes',
  'analytics', 'timeline-restricoes', 'alertas', 'mao-de-obra', 'integracoes',
]

export function LpsPage() {
  const activeTab = useLpsStore((s) => s.activeTab)
  const setActiveTab = useLpsStore((s) => s.setActiveTab)
  const loadFromProject = useLpsStore((s) => s.loadFromProject)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const [searchParams] = useSearchParams()

  useEffect(() => {
    if (activeProjectId) void loadFromProject(activeProjectId)
  }, [activeProjectId, loadFromProject])

  // Deep-link do trilho: ?tab=restricoes|semaforo|ppc|... abre direto a aba.
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && (LPS_TABS_VALIDAS as string[]).includes(tab)) setActiveTab(tab as LpsTab)
  }, [searchParams, setActiveTab])

  return (
    <div className="flex flex-col h-full bg-gray-950 overflow-hidden">
      <GuiaRibbon />
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
