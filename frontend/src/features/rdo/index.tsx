/**
 * RdoPage — root of the RDO module.
 */
import { useEffect } from 'react'
import { useRdoStore } from '@/store/rdoStore'
import { useProjectContext } from '@/store/projectContext'
import { RdoHeader }      from './components/RdoHeader'
import { DashboardPanel } from './components/DashboardPanel'
import { NovoRdoPanel }   from './components/NovoRdoPanel'
import { RdoAutomaticoPanel } from './components/RdoAutomaticoPanel'
import { HistoricoPanel } from './components/HistoricoPanel'
import { IntegracaoPanel } from './components/IntegracaoPanel'
import { FinanceiroPanel } from './components/FinanceiroPanel'
import { WhatsAppBotPanel } from './components/WhatsAppBotPanel'
import { WhatsAppFluxoPanel } from './components/WhatsAppFluxoPanel'

export function RdoPage() {
  const activeTab = useRdoStore((s) => s.activeTab)
  const loadFromSupabase = useRdoStore((s) => s.loadFromSupabase)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)

  // Carrega RDOs do Supabase (gravados pelo Router WhatsApp) + refresh 30s
  useEffect(() => {
    loadFromSupabase(activeProjectId)
    const t = setInterval(() => loadFromSupabase(activeProjectId), 30000)
    return () => clearInterval(t)
  }, [loadFromSupabase, activeProjectId])

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard':       return <DashboardPanel />
      case 'novo':            return <NovoRdoPanel />
      case 'automatico':      return <RdoAutomaticoPanel />
      case 'historico':       return <HistoricoPanel />
      case 'integracao':      return <IntegracaoPanel />
      case 'financeiro':      return <FinanceiroPanel />
      case 'whatsapp-bot':    return <WhatsAppBotPanel />
      case 'whatsapp-fluxo':  return <WhatsAppFluxoPanel />
      default:                return <DashboardPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <RdoHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}

