/**
 * RdoPage — root of the RDO module.
 */
import { useRdoStore } from '@/store/rdoStore'
import { RdoHeader }      from './components/RdoHeader'
import { DashboardPanel } from './components/DashboardPanel'
import { NovoRdoPanel }   from './components/NovoRdoPanel'
import { HistoricoPanel } from './components/HistoricoPanel'
import { IntegracaoPanel } from './components/IntegracaoPanel'
import { FinanceiroPanel } from './components/FinanceiroPanel'

export function RdoPage() {
  const activeTab = useRdoStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard':  return <DashboardPanel />
      case 'novo':       return <NovoRdoPanel />
      case 'historico':  return <HistoricoPanel />
      case 'integracao': return <IntegracaoPanel />
      case 'financeiro': return <FinanceiroPanel />
      default:           return <DashboardPanel />
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
