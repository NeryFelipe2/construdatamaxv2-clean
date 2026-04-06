import { useState } from 'react'
import { OtimizacaoHeader } from './components/OtimizacaoHeader'
import { RoteamentoPanel } from './components/RoteamentoPanel'
import { ManutencaoPreditivaPanel } from './components/ManutencaoPreditivaPanel'
import { BuyLeasePanel } from './components/BuyLeasePanel'
import type { FrotaTab } from './components/OtimizacaoHeader'

export default function OtimizacaoFrotaPage() {
  const [activeTab, setActiveTab] = useState<FrotaTab>('roteamento')

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#2c2c2c]">
      {/* Sticky header + tab bar */}
      <div className="sticky top-0 z-10 bg-[#2c2c2c] border-b border-[#525252]">
        <OtimizacaoHeader activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Tab content */}
      <div className="flex-1 px-6 py-5">
        {activeTab === 'roteamento' && <RoteamentoPanel />}
        {activeTab === 'manutencao' && <ManutencaoPreditivaPanel />}
        {activeTab === 'buylease'   && <BuyLeasePanel />}
      </div>
    </div>
  )
}
