/**
 * EvmPage — root of the EVM (Earned Value Management) module.
 * Routes between 5 tabs via the store's activeTab state.
 */
import { EvmHeader } from './components/EvmHeader'
import { DashboardPanel } from './components/DashboardPanel'
import { MedicaoPonderadaPanel } from './components/MedicaoPonderadaPanel'
import { PlanoContasPanel } from './components/PlanoContasPanel'
import { WorkPackagesPanel } from './components/WorkPackagesPanel'
import { IndicesPanel } from './components/IndicesPanel'
import { useEvmStore } from '@/store/evmStore'
import type { EvmTab } from '@/types'

const panels: Record<EvmTab, () => React.ReactNode> = {
  'dashboard':      DashboardPanel,
  'medicao':        MedicaoPonderadaPanel,
  'plano-contas':   PlanoContasPanel,
  'work-packages':  WorkPackagesPanel,
  'indices':        IndicesPanel,
}

export function EvmPage() {
  const activeTab = useEvmStore((s) => s.activeTab)
  const Panel = panels[activeTab] ?? DashboardPanel

  return (
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <EvmHeader />
      <div className="flex-1 overflow-auto">
        <Panel />
      </div>
    </div>
  )
}
