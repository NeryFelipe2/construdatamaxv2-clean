/**
 * RdoPage — root of the RDO module.
 *
 * Deep-links do trilho guiado (Fase 3): ?tab=X troca a aba do rdoStore e
 * ?guia=pN mostra o GuiaRibbon no topo (P4 — apontar o dia chega aqui via
 * /app/rdo?guia=p4).
 */
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardPaste } from 'lucide-react'
import { GuiaRibbon } from '@/components/shared/GuiaRibbon'
import type { RdoTab } from '@/types'
import { useRdoStore } from '@/store/rdoStore'
import { useProjectContext } from '@/store/projectContext'
import { RdoHeader }      from './components/RdoHeader'
import { ApontamentoModal } from './components/ApontamentoModal'
import { DashboardPanel } from './components/DashboardPanel'
import { NovoRdoPanel }   from './components/NovoRdoPanel'
import { RdoAutomaticoPanel } from './components/RdoAutomaticoPanel'
import { HistoricoPanel } from './components/HistoricoPanel'
import { DiarioObraPage } from '@/features/diario-obra'
import { IntegracaoPanel } from './components/IntegracaoPanel'
import { FinanceiroPanel } from './components/FinanceiroPanel'
import { ProducaoPanel } from './components/ProducaoPanel'
import { WhatsAppBotPanel } from './components/WhatsAppBotPanel'
import { WhatsAppFluxoPanel } from './components/WhatsAppFluxoPanel'

/** Abas válidas pro deep-link ?tab= (mesma união de RdoTab em types). */
const RDO_TABS_VALIDAS: RdoTab[] = [
  'dashboard', 'novo', 'automatico', 'historico', 'diario',
  'integracao', 'financeiro', 'producao', 'whatsapp-bot', 'whatsapp-fluxo',
]

export function RdoPage() {
  const activeTab = useRdoStore((s) => s.activeTab)
  const setActiveTab = useRdoStore((s) => s.setActiveTab)
  const loadFromSupabase = useRdoStore((s) => s.loadFromSupabase)
  const activeProjectId = useProjectContext((s) => s.activeProjectId)
  const [showApontamento, setShowApontamento] = useState(false)
  const [searchParams] = useSearchParams()

  // Carrega RDOs do Supabase (gravados pelo Router WhatsApp) + refresh 30s
  useEffect(() => {
    loadFromSupabase(activeProjectId)
    const t = setInterval(() => loadFromSupabase(activeProjectId), 30000)
    return () => clearInterval(t)
  }, [loadFromSupabase, activeProjectId])

  // Deep-link do trilho: ?tab=producao|historico|... abre direto a aba.
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && (RDO_TABS_VALIDAS as string[]).includes(tab)) setActiveTab(tab as RdoTab)
  }, [searchParams, setActiveTab])

  function renderPanel() {
    switch (activeTab) {
      case 'dashboard':       return <DashboardPanel />
      case 'novo':            return <NovoRdoPanel />
      case 'automatico':      return <RdoAutomaticoPanel />
      case 'historico':       return <HistoricoPanel />
      case 'diario':          return <DiarioObraPage />
      case 'integracao':      return <IntegracaoPanel />
      case 'financeiro':      return <FinanceiroPanel />
      case 'producao':        return <ProducaoPanel />
      case 'whatsapp-bot':    return <WhatsAppBotPanel />
      case 'whatsapp-fluxo':  return <WhatsAppFluxoPanel />
      default:                return <DashboardPanel />
    }
  }

  return (
    <div className="flex flex-col h-full bg-gray-950">
      <GuiaRibbon />
      <RdoHeader />
      {/* Apontamento por tags (WhatsApp → RDO → Medição) — fora do NovoRdoPanel, sem backend Render */}
      <div className="flex items-center justify-end px-4 py-1.5 border-b border-[#3f3f3f] bg-gray-950">
        <button
          onClick={() => setShowApontamento(true)}
          className="flex items-center gap-1.5 text-[11px] font-semibold text-[#38bdf8] border border-[#38bdf8]/40 hover:bg-[#38bdf8]/10 rounded-md px-3 py-1.5 transition-colors"
        >
          <ClipboardPaste size={12} /> Colar apontamento
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {renderPanel()}
      </div>
      {showApontamento && (
        <ApontamentoModal
          onClose={() => setShowApontamento(false)}
          onSaved={() => loadFromSupabase(activeProjectId)}
        />
      )}
    </div>
  )
}

