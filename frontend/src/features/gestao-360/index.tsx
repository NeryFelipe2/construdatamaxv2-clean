import { useGestao360Store } from '@/store/gestao360Store'
import { Gestao360Header } from './components/Gestao360Header'
import { Gestao360MapDashboard } from './components/Gestao360MapDashboard'
import { JobCostingPanel } from './components/JobCostingPanel'
import { ChangeOrderPanel } from './components/ChangeOrderPanel'
import { CommandCenterPanel } from './components/CommandCenterPanel'
import { SimulacaoAtrasoPanel } from './components/SimulacaoAtrasoPanel'

export function Gestao360Page() {
  const activeTab = useGestao360Store((s) => s.activeTab)

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#2c2c2c]">
      {/* Sticky header + tab bar */}
      <div className="sticky top-0 z-10 bg-[#2c2c2c] border-b border-[#525252]">
        <Gestao360Header />
      </div>

      {/* Tab content */}
      {activeTab === 'dashboard' ? (
        <Gestao360MapDashboard />
      ) : (
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'jobacosting'  && <JobCostingPanel />}
          {activeTab === 'changeorders' && <ChangeOrderPanel />}
          {activeTab === 'command'      && <CommandCenterPanel />}
          {activeTab === 'simulation'   && <SimulacaoAtrasoPanel />}
        </div>
      )}
    </div>
  )
}
