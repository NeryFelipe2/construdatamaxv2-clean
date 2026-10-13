import { MaoDeObraHeader }       from './components/MaoDeObraHeader'
import { DashboardPanel }        from './components/DashboardPanel'
import { ApontamentosPanel }     from './components/ApontamentosPanel'
import { EscalamentoPanel }      from './components/EscalamentoPanel'
import { SegurancaPanel }        from './components/SegurancaPanel'
import { FuncionariosRealPanel } from './components/FuncionariosRealPanel'
import { EscalaInteligentePanel } from './components/EscalaInteligentePanel'
import { PostosPanel }           from './components/PostosPanel'
import { CMOPanel }              from './components/CMOPanel'
import { FaltasSubsPanel }       from './components/FaltasSubsPanel'
import { FolhaPagamentoPanel }   from './components/FolhaPagamentoPanel'
import { RHFinanceiroPanel }     from './components/RHFinanceiroPanel'
import { GestaoFrotasPanel }     from './components/gestao-frotas/GestaoFrotasPanel'
import { AusenciasCalendarioPanel } from './components/AusenciasCalendarioPanel'
import { useMaoDeObraStore }     from '@/store/maoDeObraStore'

export function MaoDeObraPage() {
  const activeTab = useMaoDeObraStore((s) => s.activeTab)

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard':     return <DashboardPanel />
      // cadastro único (pessoas) — o mesmo do RDO e das Equipes
      case 'funcionarios':  return <FuncionariosRealPanel />
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
    <div className="flex flex-col h-full bg-[#2c2c2c]">
      <MaoDeObraHeader />

      <div className="flex-1 overflow-auto px-6 py-5">
        {renderPanel()}
      </div>
    </div>
  )
}
