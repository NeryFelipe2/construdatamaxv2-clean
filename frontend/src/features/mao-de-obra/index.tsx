import { useState } from 'react'
import { MaoDeObraHeader }       from './components/MaoDeObraHeader'
import type { MaoDeObraTab }     from './components/MaoDeObraHeader'
import { DashboardPanel }        from './components/DashboardPanel'
import { ApontamentosPanel }     from './components/ApontamentosPanel'
import { EscalamentoPanel }      from './components/EscalamentoPanel'
import { SegurancaPanel }        from './components/SegurancaPanel'
import { FuncionariosPanel }     from './components/FuncionariosPanel'
import { EscalaInteligentePanel } from './components/EscalaInteligentePanel'
import { PostosPanel }           from './components/PostosPanel'
import { CMOPanel }              from './components/CMOPanel'
import { FaltasSubsPanel }       from './components/FaltasSubsPanel'
import { FolhaPagamentoPanel }   from './components/FolhaPagamentoPanel'
import { RHFinanceiroPanel }     from './components/RHFinanceiroPanel'
import { GestaoFrotasPanel }     from './components/gestao-frotas/GestaoFrotasPanel'
import { AusenciasCalendarioPanel } from './components/AusenciasCalendarioPanel'

export function MaoDeObraPage() {
  const [activeTab, setActiveTab] = useState<MaoDeObraTab>('dashboard')

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard':     return <DashboardPanel />
      case 'funcionarios':  return <FuncionariosPanel />
      case 'escala':        return <EscalaInteligentePanel />
      case 'postos':        return <PostosPanel />
      case 'cmo':           return <CMOPanel />
      case 'faltas':        return <FaltasSubsPanel />
      case 'folha':         return <FolhaPagamentoPanel />
      case 'rh-financeiro': return <RHFinanceiroPanel />
      case 'frotas':        return <GestaoFrotasPanel />
      case 'ausencias':     return <AusenciasCalendarioPanel />
      case 'apontamentos':  return <ApontamentosPanel />
      case 'escalamento':   return <EscalamentoPanel />
      case 'seguranca':     return <SegurancaPanel />
      default:              return <DashboardPanel />
    }
  }

  return (
    <div className="flex flex-col h-full">
      <MaoDeObraHeader activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {renderPanel()}
      </div>
    </div>
  )
}
