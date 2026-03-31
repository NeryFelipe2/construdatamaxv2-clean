/**
 * QuantitativosPage — root of the Quantitativos e Orçamento module.
 */
import { useQuantitativosStore } from '@/store/quantitativosStore'
import { QuantHeader }     from './components/QuantHeader'
import { ComposicaoPanel } from './components/ComposicaoPanel'
import { ResumoPanel }     from './components/ResumoPanel'
import { BancoDadosPanel } from './components/BancoDadosPanel'
import { HistoricoPanel }  from './components/HistoricoPanel'

export function QuantitativosPage() {
  const activeTab = useQuantitativosStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'composicao': return <ComposicaoPanel />
      case 'resumo':     return <ResumoPanel />
      case 'banco':      return <BancoDadosPanel />
      case 'historico':  return <HistoricoPanel />
      default:           return <ComposicaoPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <QuantHeader />
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
    </div>
  )
}
