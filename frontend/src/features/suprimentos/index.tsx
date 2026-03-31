import { useState } from 'react'
import { SuprimentosHeader }    from './components/SuprimentosHeader'
import { ConciliacaoPanel }     from './components/ConciliacaoPanel'
import { ExcecoesPanel }        from './components/ExcecoesPanel'
import { PrevisaoDemandaPanel } from './components/PrevisaoDemandaPanel'
import { RequisicoesPipeline }  from './components/RequisicoesPipeline'
import { MateriaisOverviewPanel } from './components/MateriaisOverviewPanel'
import { ContractPanel }        from './components/ContractPanel'
import type { SuprimentosTab }  from './components/SuprimentosHeader'

export function SuprimentosPage() {
  const [activeTab, setActiveTab] = useState<SuprimentosTab>('conciliacao')

  return (
    <div className="flex flex-col h-full p-5 gap-5 overflow-hidden">
      <SuprimentosHeader activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'conciliacao' && <ConciliacaoPanel />}
      {activeTab === 'excecoes'    && <ExcecoesPanel />}
      {activeTab === 'previsao'    && <PrevisaoDemandaPanel />}
      {activeTab === 'requisicoes' && <RequisicoesPipeline />}
      {activeTab === 'materiais'   && <MateriaisOverviewPanel />}
      {activeTab === 'contratos'   && <ContractPanel />}
    </div>
  )
}
